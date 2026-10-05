import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Boots an in-memory Postgres (PGlite, no Docker required) and applies every
 * migration under supabase/migrations/ in order, exactly as Supabase would.
 *
 * Caveat: PGlite's default connection runs as a superuser, which bypasses
 * GRANT/REVOKE and Row Level Security checks. These tests therefore verify
 * each RPC's own business logic (auth.uid() checks, membership checks,
 * scoring, idempotency) but cannot verify that anon/PUBLIC are actually
 * locked out at the database privilege layer — that is reviewed by reading
 * the migrations' REVOKE statements instead.
 */
export async function createTestDb() {
  const db = await PGlite.create();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('app.current_uid', true), '')::uuid $$;
    CREATE PUBLICATION supabase_realtime;
  `);
  const dir = resolve(__dirname, '../../../supabase/migrations');
  for (const file of readdirSync(dir).sort()) {
    await db.exec(readFileSync(join(dir, file), 'utf8'));
  }
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/** Sets the simulated authenticated user for subsequent calls on this connection. */
export async function signInAs(db: TestDb, uid: string) {
  await db.query('SELECT set_config($1, $2, false)', ['app.current_uid', uid]);
}

/** Clears auth, simulating an anonymous (signed-out) request. */
export async function signOut(db: TestDb) {
  await db.query('SELECT set_config($1, $2, false)', ['app.current_uid', '']);
}

export const newUserId = () => randomUUID();

/** 6-digit numeric room code, unique enough across a single test run. */
export const newRoomCode = () => String(Math.floor(100000 + Math.random() * 900000));

/** Calls a public.*_rpc function the same way supabase-js's .rpc() does: named params. */
export async function rpc<T = Record<string, unknown>>(
  db: TestDb,
  name: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const keys = Object.keys(args);
  const assignments = keys.map((k, i) => `${k} := $${i + 1}`).join(', ');
  const values = keys.map((k) => args[k]);
  const res = await db.query<{ result: T }>(
    `SELECT public.${name}(${assignments}) AS result`,
    values
  );
  return res.rows[0].result;
}

export async function getRoom(db: TestDb, code: string) {
  const res = await db.query('SELECT * FROM public.rooms WHERE code = $1', [code]);
  return res.rows[0] as Record<string, unknown> | undefined;
}

export async function getPlayer(db: TestDb, code: string, authUserId: string) {
  const res = await db.query(
    'SELECT * FROM public.room_players WHERE room_code = $1 AND auth_user_id = $2',
    [code, authUserId]
  );
  return res.rows[0] as Record<string, unknown> | undefined;
}

/** Creates a two-player room already in an active match (status VS, started_at in the past). */
export async function createActiveMatch(db: TestDb) {
  const hostId = newUserId();
  const guestId = newUserId();
  const code = newRoomCode();

  await signInAs(db, hostId);
  const created = await rpc<{ success: boolean; code: string }>(db, 'create_room_rpc', {
    p_code: code,
    p_name: 'Host',
    p_avatar: '🚀',
    p_match_questions: null,
    p_player_id: hostId,
  });
  if (!created.success) throw new Error('setup: create_room_rpc failed: ' + JSON.stringify(created));

  await signInAs(db, guestId);
  await rpc(db, 'join_room_atomic', { p_room_code: code, p_player_id: guestId, p_name: 'Guest', p_avatar: '⚡' });

  await signInAs(db, hostId);
  await rpc(db, 'set_player_ready_and_check_start', { p_room_code: code, p_player_id: hostId, p_ready_state: true });
  await signInAs(db, guestId);
  await rpc(db, 'set_player_ready_and_check_start', { p_room_code: code, p_player_id: guestId, p_ready_state: true });

  // started_at is 3s in the future at ready-up time; push it into the past so answers are accepted immediately.
  await db.query("UPDATE public.rooms SET started_at = now() - interval '1 second' WHERE code = $1", [code]);
  await db.query(
    "UPDATE public.room_players SET question_started_at = now() - interval '1 second' WHERE room_code = $1",
    [code]
  );

  const room = await getRoom(db, code);
  const questions = room!.match_questions as { id: number; options: string[] }[];
  return { code, hostId, guestId, questions };
}
