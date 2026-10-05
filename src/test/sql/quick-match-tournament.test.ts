import { createTestDb, getPlayer, getRoom, newUserId, rpc, signInAs, signOut, type TestDb } from './helpers';

type Res = { success: boolean; error?: string; [k: string]: unknown };
type QM = Res & { status?: 'WAITING' | 'MATCHED'; room_code?: string };
type Side = { name: string; avatar: string; is_me: boolean } | null;
type Match = {
  round: number;
  slot: number;
  room_code: string | null;
  room_status: string | null;
  player_a: Side;
  player_b: Side;
  winner_side: 'a' | 'b' | null;
};
type TournamentView = Res & {
  tournament: {
    code: string;
    name: string;
    size: number;
    status: string;
    rounds: number;
    is_organizer: boolean;
    am_registered: boolean;
    champion: { name: string; avatar: string } | null;
  };
  players: { name: string; avatar: string; is_me: boolean; eliminated: boolean }[];
  matches: Match[];
  my_room_code: string | null;
};

const qm = (db: TestDb, name: string, avatar = '🚀') =>
  rpc<QM>(db, 'quick_match_rpc', { p_name: name, p_avatar: avatar });

const correctIndexOf = async (db: TestDb, questionId: number) =>
  ((await db.query('SELECT correct_index FROM public.questions WHERE id = $1', [questionId])).rows[0] as {
    correct_index: number;
  }).correct_index;

const roomPlayerIds = async (db: TestDb, code: string) =>
  ((await db.query('SELECT auth_user_id FROM public.room_players WHERE room_code = $1', [code])).rows as {
    auth_user_id: string;
  }[]).map((r) => r.auth_user_id);

/** Readies both players, moves the start into the past, lets `winner` answer correctly and `loser` wrongly, then finishes. */
const playRoom = async (db: TestDb, code: string, winner: string, loser: string) => {
  for (const uid of [winner, loser]) {
    await signInAs(db, uid);
    await rpc(db, 'set_player_ready_and_check_start', { p_room_code: code, p_player_id: uid, p_ready_state: true });
  }
  await db.query("UPDATE public.rooms SET started_at = now() - interval '1 second' WHERE code = $1", [code]);
  await db.query(
    "UPDATE public.room_players SET question_started_at = now() - interval '1 second' WHERE room_code = $1",
    [code]
  );
  const questions = (await getRoom(db, code))!.match_questions as { id: number }[];
  for (const [uid, correct] of [
    [winner, true],
    [loser, false],
  ] as const) {
    await signInAs(db, uid);
    for (const q of questions) {
      const ci = await correctIndexOf(db, q.id);
      await rpc(db, 'submit_answer_rpc', {
        p_room_code: code,
        p_player_id: uid,
        p_question_id: q.id,
        p_selected_option_index: correct ? ci : (ci + 1) % 4,
      });
    }
  }
  await signInAs(db, winner);
  const fin = await rpc<Res>(db, 'finish_room_rpc', { p_room_code: code });
  if (!fin.success) throw new Error('finish failed ' + JSON.stringify(fin));
};

const matchRows = async (db: TestDb, tcode: string) =>
  (
    await db.query(
      'SELECT * FROM public.tournament_matches WHERE tournament_code = $1 ORDER BY round, slot',
      [tcode]
    )
  ).rows as {
    round: number;
    slot: number;
    player_a: string;
    player_b: string;
    room_code: string | null;
    winner: string | null;
  }[];

const tournamentRow = async (db: TestDb, tcode: string) =>
  (await db.query('SELECT * FROM public.tournaments WHERE code = $1', [tcode])).rows[0] as {
    status: string;
    champion: string | null;
  };

/** Creates a tournament of `size` with an organizer who also plays, filled with players. */
const createFullTournament = async (db: TestDb, size: 4 | 8 = 4) => {
  const organizer = newUserId();
  await signInAs(db, organizer);
  const created = await rpc<Res & { code: string }>(db, 'create_tournament_rpc', {
    p_name: 'Kupa',
    p_size: size,
    p_player_name: 'Org',
    p_avatar: '🚀',
  });
  if (!created.success) throw new Error('create failed ' + JSON.stringify(created));
  const players = [organizer];
  for (let i = 1; i < size; i++) {
    const uid = newUserId();
    await signInAs(db, uid);
    const j = await rpc<Res>(db, 'join_tournament_rpc', { p_code: created.code, p_name: `P${i}`, p_avatar: '⚡' });
    if (!j.success) throw new Error('join failed ' + JSON.stringify(j));
    players.push(uid);
  }
  return { code: created.code, organizer, players };
};

describe('hızlı eşleşme', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });
  beforeEach(async () => {
    await db.query('DELETE FROM public.matchmaking_queue');
  });

  it('oturum yoksa ve kimlik geçersizse hata döner', async () => {
    await signOut(db);
    expect((await qm(db, 'A')).success).toBe(false);
    await signInAs(db, newUserId());
    expect(await qm(db, 'A', 'x')).toMatchObject({ success: false, error: 'Geçersiz avatar' });
    expect((await qm(db, '')).success).toBe(false);
  });

  it('iki kullanıcı eşleşir, aynı odadadır ve bekleyen taraf sonraki poll ile MATCHED alır', async () => {
    const a = newUserId();
    const b = newUserId();
    await signInAs(db, a);
    expect(await qm(db, 'Ali', '🚀')).toEqual({ success: true, status: 'WAITING' });
    expect(await qm(db, 'Ali', '🚀')).toEqual({ success: true, status: 'WAITING' });

    await signInAs(db, b);
    const mb = await qm(db, 'Bora', '⚡');
    expect(mb.status).toBe('MATCHED');
    const code = mb.room_code!;
    expect(code).toMatch(/^[0-9]{6}$/);

    const room = await getRoom(db, code);
    expect(room?.status).toBe('LOBBY');
    expect(room?.tournament_code).toBeNull();
    expect(room?.match_questions as unknown[]).toHaveLength(10);
    expect((await getPlayer(db, code, a))?.is_host).toBe(true);
    expect((await getPlayer(db, code, b))?.is_host).toBe(false);
    expect((await getPlayer(db, code, b))?.name).toBe('Bora');

    await signInAs(db, a);
    expect(await qm(db, 'Ali', '🚀')).toEqual({ success: true, status: 'MATCHED', room_code: code });
    const left = await db.query('SELECT * FROM public.matchmaking_queue WHERE auth_user_id IN ($1, $2)', [a, b]);
    expect(left.rows).toHaveLength(0);

    // A new poll starts waiting again rather than returning the old room.
    expect((await qm(db, 'Ali', '🚀')).status).toBe('WAITING');
  });

  it('kendisiyle eşleşmez', async () => {
    const a = newUserId();
    await signInAs(db, a);
    expect((await qm(db, 'Solo')).status).toBe('WAITING');
    expect((await qm(db, 'Solo')).status).toBe('WAITING');
    const rows = await db.query('SELECT * FROM public.matchmaking_queue WHERE auth_user_id = $1', [a]);
    expect(rows.rows).toHaveLength(1);
  });

  it('30 saniyeden uzun süredir poll etmeyen bekleyenle eşleşmez', async () => {
    const a = newUserId();
    const b = newUserId();
    await signInAs(db, a);
    await qm(db, 'Eski');
    await db.query("UPDATE public.matchmaking_queue SET created_at = now() - interval '31 seconds' WHERE auth_user_id = $1", [a]);
    await signInAs(db, b);
    expect((await qm(db, 'Yeni')).status).toBe('WAITING');
  });

  it('poll created_at tazeler, en eski bekleyen seçilir', async () => {
    const a = newUserId();
    const b = newUserId();
    const c = newUserId();
    // Two waiting players (inserted directly: a second poller would simply match the first one).
    await db.query(
      `INSERT INTO public.matchmaking_queue(auth_user_id, name, avatar, created_at) VALUES
         ($1, 'A', '🚀', now() - interval '20 seconds'), ($2, 'B', '⚡', now() - interval '10 seconds')`,
      [a, b]
    );
    await signInAs(db, c);
    const res = await qm(db, 'C');
    expect(res.status).toBe('MATCHED');
    expect((await roomPlayerIds(db, res.room_code!)).sort()).toEqual([a, c].sort());
  });

  it('cancel kendi satırını siler, sonrasında eşleşme olmaz', async () => {
    const a = newUserId();
    const b = newUserId();
    await signInAs(db, a);
    await qm(db, 'A');
    expect(await rpc(db, 'cancel_quick_match_rpc')).toEqual({ success: true });
    expect((await db.query('SELECT 1 FROM public.matchmaking_queue WHERE auth_user_id = $1', [a])).rows).toHaveLength(0);
    await signInAs(db, b);
    expect((await qm(db, 'B')).status).toBe('WAITING');
    await signOut(db);
    expect((await rpc<Res>(db, 'cancel_quick_match_rpc')).success).toBe(false);
  });
});

describe('create_room_rpc (_create_room_for ile)', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it('sunucu kodlu oda kurmaya devam eder', async () => {
    const uid = newUserId();
    await signInAs(db, uid);
    const res = await rpc<Res & { code: string; player_id: string }>(db, 'create_room_rpc', {
      p_code: null,
      p_name: ' Host ',
      p_avatar: '🚀',
      p_match_questions: null,
      p_player_id: null,
    });
    expect(res.success).toBe(true);
    expect(res.code).toMatch(/^[0-9]{6}$/);
    expect(res.player_id).toBe(uid);
    const p = await getPlayer(db, res.code, uid);
    expect(p?.is_host).toBe(true);
    expect(p?.name).toBe('Host');
    expect((await getRoom(db, res.code))?.tournament_code).toBeNull();
  });
});

describe('turnuva kaydı', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it('oluşturma doğrulamaları', async () => {
    await signOut(db);
    expect((await rpc<Res>(db, 'create_tournament_rpc', { p_name: 'Kupa', p_size: 4, p_player_name: 'A', p_avatar: '🚀' })).success).toBe(false);
    await signInAs(db, newUserId());
    expect((await rpc<Res>(db, 'create_tournament_rpc', { p_name: 'ab', p_size: 4, p_player_name: 'A', p_avatar: '🚀' })).success).toBe(false);
    expect((await rpc<Res>(db, 'create_tournament_rpc', { p_name: 'x'.repeat(41), p_size: 4, p_player_name: 'A', p_avatar: '🚀' })).success).toBe(false);
    expect((await rpc<Res>(db, 'create_tournament_rpc', { p_name: 'Kupa', p_size: 6, p_player_name: 'A', p_avatar: '🚀' })).success).toBe(false);
    expect((await rpc<Res>(db, 'create_tournament_rpc', { p_name: 'Kupa', p_size: 4, p_player_name: 'A', p_avatar: 'x' })).success).toBe(false);
  });

  it('oluştur (katılmadan) / katıl / idempotent / dolu / ayrıl', async () => {
    const org = newUserId();
    await signInAs(db, org);
    const c = await rpc<Res & { code: string }>(db, 'create_tournament_rpc', {
      p_name: '  Okul Kupası ',
      p_size: 4,
      p_player_name: null,
      p_avatar: null,
      p_join: false,
    });
    expect(c.success).toBe(true);
    expect(c.code).toMatch(/^[0-9]{6}$/);

    let view = await rpc<TournamentView>(db, 'get_tournament_rpc', { p_code: c.code });
    expect(view.tournament).toMatchObject({
      code: c.code,
      name: 'Okul Kupası',
      size: 4,
      status: 'REGISTRATION',
      rounds: 2,
      is_organizer: true,
      am_registered: false,
      champion: null,
    });
    expect(view.players).toEqual([]);
    expect(view.matches).toEqual([]);
    expect(view.my_room_code).toBeNull();

    const ids = [newUserId(), newUserId(), newUserId(), newUserId()];
    for (const [i, uid] of ids.entries()) {
      await signInAs(db, uid);
      expect(await rpc(db, 'join_tournament_rpc', { p_code: c.code, p_name: `P${i}`, p_avatar: '⚡' })).toEqual({
        success: true,
        code: c.code,
      });
    }
    // Idempotent re-join
    expect((await rpc<Res>(db, 'join_tournament_rpc', { p_code: c.code, p_name: 'P3', p_avatar: '⚡' })).success).toBe(true);

    await signInAs(db, newUserId());
    expect(await rpc(db, 'join_tournament_rpc', { p_code: c.code, p_name: 'Late', p_avatar: '⚡' })).toEqual({
      success: false,
      error: 'Turnuva dolu',
    });
    expect(await rpc(db, 'join_tournament_rpc', { p_code: '000000', p_name: 'X', p_avatar: '⚡' })).toEqual({
      success: false,
      error: 'Turnuva bulunamadı',
    });

    await signInAs(db, ids[3]);
    view = await rpc<TournamentView>(db, 'get_tournament_rpc', { p_code: c.code });
    expect(view.tournament.am_registered).toBe(true);
    expect(view.tournament.is_organizer).toBe(false);
    expect(view.players).toHaveLength(4);
    expect(view.players.filter((p) => p.is_me)).toEqual([{ name: 'P3', avatar: '⚡', is_me: true, eliminated: false }]);

    expect(await rpc(db, 'leave_tournament_rpc', { p_code: c.code })).toEqual({ success: true });
    view = await rpc<TournamentView>(db, 'get_tournament_rpc', { p_code: c.code });
    expect(view.players).toHaveLength(3);
    expect(view.tournament.am_registered).toBe(false);
  });

  it('başlatma yetkisi, dolmadan başlatılamaz, başladıktan sonra ayrılınamaz', async () => {
    const org = newUserId();
    await signInAs(db, org);
    const c = await rpc<Res & { code: string }>(db, 'create_tournament_rpc', {
      p_name: 'Kupa',
      p_size: 4,
      p_player_name: 'Org',
      p_avatar: '🚀',
    });
    expect(await rpc(db, 'start_tournament_rpc', { p_code: c.code })).toEqual({
      success: false,
      error: 'Turnuva henüz dolmadı',
    });
    const others = [newUserId(), newUserId(), newUserId()];
    for (const uid of others) {
      await signInAs(db, uid);
      await rpc(db, 'join_tournament_rpc', { p_code: c.code, p_name: 'P', p_avatar: '⚡' });
    }
    await signInAs(db, others[0]);
    expect((await rpc<Res>(db, 'start_tournament_rpc', { p_code: c.code })).success).toBe(false);
    await signInAs(db, org);
    expect(await rpc(db, 'start_tournament_rpc', { p_code: c.code })).toEqual({ success: true });
    expect((await rpc<Res>(db, 'start_tournament_rpc', { p_code: c.code })).success).toBe(false);

    await signInAs(db, others[1]);
    expect(await rpc(db, 'leave_tournament_rpc', { p_code: c.code })).toEqual({
      success: false,
      error: 'Turnuva başladı, ayrılamazsın',
    });
    await signInAs(db, newUserId());
    expect((await rpc<Res>(db, 'join_tournament_rpc', { p_code: c.code, p_name: 'X', p_avatar: '⚡' })).success).toBe(false);
  });

  it('get_tournament_rpc bilinmeyen kodda hata döner', async () => {
    await signInAs(db, newUserId());
    expect(await rpc(db, 'get_tournament_rpc', { p_code: '999999' })).toEqual({
      success: false,
      error: 'Turnuva bulunamadı',
    });
  });
});

describe('turnuva akışı', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it('4 kişilik turnuva uçtan uca oynanır: yarı finaller → final → şampiyon', async () => {
    const t = await createFullTournament(db, 4);
    await signInAs(db, t.organizer);
    expect(await rpc(db, 'start_tournament_rpc', { p_code: t.code })).toEqual({ success: true });
    expect((await tournamentRow(db, t.code)).status).toBe('RUNNING');

    let rows = await matchRows(db, t.code);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => [r.round, r.slot])).toEqual([
      [1, 0],
      [1, 1],
    ]);
    const seated = rows.flatMap((r) => [r.player_a, r.player_b]).sort();
    expect(seated).toEqual([...t.players].sort());
    for (const r of rows) {
      const room = await getRoom(db, r.room_code!);
      expect(room?.tournament_code).toBe(t.code);
      expect(room?.status).toBe('LOBBY');
      expect((await getPlayer(db, r.room_code!, r.player_a))?.is_host).toBe(true);
      expect((await getPlayer(db, r.room_code!, r.player_b))?.is_host).toBe(false);
    }

    // get_tournament_rpc from a player's perspective
    await signInAs(db, rows[0].player_a);
    let view = await rpc<TournamentView>(db, 'get_tournament_rpc', { p_code: t.code });
    expect(view.my_room_code).toBe(rows[0].room_code);
    expect(view.matches).toHaveLength(2);
    expect(view.matches[0]).toMatchObject({ round: 1, slot: 0, room_code: rows[0].room_code, room_status: 'LOBBY', winner_side: null });
    expect(view.matches[0].player_a?.is_me).toBe(true);
    expect(view.matches[0].player_b?.is_me).toBe(false);

    // Semifinal 0: player_b wins. Final not created yet... it holds the winner on side a.
    await playRoom(db, rows[0].room_code!, rows[0].player_b, rows[0].player_a);
    rows = await matchRows(db, t.code);
    expect(rows[0].winner).toBe(rows[0].player_b);
    let final = rows.find((r) => r.round === 2);
    expect(final?.player_a).toBe(rows[0].player_b);
    expect(final?.player_b).toBeNull();
    expect(final?.room_code).toBeNull();
    expect((await tournamentRow(db, t.code)).status).toBe('RUNNING');

    await signInAs(db, rows[0].player_a);
    view = await rpc<TournamentView>(db, 'get_tournament_rpc', { p_code: t.code });
    expect(view.my_room_code).toBeNull();
    expect(view.matches[0].winner_side).toBe('b');
    expect(view.matches[0].room_status).toBe('RESULT');
    expect(view.players.find((p) => p.is_me)?.eliminated).toBe(true);

    // Semifinal 1: player_a wins → final room is created.
    await playRoom(db, rows[1].room_code!, rows[1].player_a, rows[1].player_b);
    rows = await matchRows(db, t.code);
    final = rows.find((r) => r.round === 2)!;
    expect(final.slot).toBe(0);
    expect(final.player_a).toBe(rows[0].player_b);
    expect(final.player_b).toBe(rows[1].player_a);
    expect(final.room_code).toMatch(/^[0-9]{6}$/);
    expect((await getRoom(db, final.room_code!))?.tournament_code).toBe(t.code);
    expect((await roomPlayerIds(db, final.room_code!)).sort()).toEqual([final.player_a, final.player_b].sort());

    await signInAs(db, final.player_b);
    view = await rpc<TournamentView>(db, 'get_tournament_rpc', { p_code: t.code });
    expect(view.my_room_code).toBe(final.room_code);

    // Final: player_b wins.
    await playRoom(db, final.room_code!, final.player_b, final.player_a);
    const tr = await tournamentRow(db, t.code);
    expect(tr.status).toBe('FINISHED');
    expect(tr.champion).toBe(final.player_b);

    view = await rpc<TournamentView>(db, 'get_tournament_rpc', { p_code: t.code });
    expect(view.tournament.status).toBe('FINISHED');
    expect(view.tournament.champion).not.toBeNull();
    expect(view.tournament.champion!.name).toBe(view.players.find((p) => p.is_me)!.name);
    expect(view.matches.find((m) => m.round === 2)?.winner_side).toBe('b');
    expect(view.my_room_code).toBeNull();
    expect(view.players.filter((p) => !p.eliminated)).toHaveLength(1);

    // Leaderboard logic still runs for tournament rooms.
    const lb = await db.query('SELECT * FROM public.leaderboard_entries WHERE room_code = $1', [final.room_code]);
    expect(lb.rows).toHaveLength(2);
  });

  it('beraberlikte fazla doğru, sonra erken bitiren kazanır', async () => {
    const t = await createFullTournament(db, 4);
    await signInAs(db, t.organizer);
    await rpc(db, 'start_tournament_rpc', { p_code: t.code });
    const [m] = await matchRows(db, t.code);
    const code = m.room_code!;
    for (const uid of [m.player_a, m.player_b]) {
      await signInAs(db, uid);
      await rpc(db, 'set_player_ready_and_check_start', { p_room_code: code, p_player_id: uid, p_ready_state: true });
    }
    await db.query(
      `UPDATE public.room_players SET score = 500, correct_answers = 5,
         finished_at = CASE WHEN auth_user_id = $2 THEN now() - interval '5 seconds' ELSE now() END
       WHERE room_code = $1`,
      [code, m.player_b]
    );
    await db.query("UPDATE public.rooms SET status = 'RESULT' WHERE code = $1", [code]);
    expect((await matchRows(db, t.code))[0].winner).toBe(m.player_b);
  });

  it('LOBBY durumunda odadan çıkmak hükmen mağlubiyettir', async () => {
    const t = await createFullTournament(db, 4);
    await signInAs(db, t.organizer);
    await rpc(db, 'start_tournament_rpc', { p_code: t.code });
    const [m] = await matchRows(db, t.code);
    await signInAs(db, m.player_a);
    const res = await rpc<Res>(db, 'leave_room_rpc', { p_room_code: m.room_code });
    expect(res).toMatchObject({ success: true, deleted: false, remaining_status: 'LOBBY' });
    expect((await getRoom(db, m.room_code!))?.status).toBe('RESULT');
    const rows = await matchRows(db, t.code);
    expect(rows[0].winner).toBe(m.player_b);
    const loser = await db.query(
      'SELECT eliminated FROM public.tournament_players WHERE tournament_code = $1 AND auth_user_id = $2',
      [t.code, m.player_a]
    );
    expect(loser.rows[0]).toEqual({ eliminated: true });
    expect(rows.find((r) => r.round === 2)?.player_a).toBe(m.player_b);
  });

  it('maç sırasında çıkan kaybeder; oda boşalırsa player_a ilerler', async () => {
    const t = await createFullTournament(db, 4);
    await signInAs(db, t.organizer);
    await rpc(db, 'start_tournament_rpc', { p_code: t.code });
    const [m0, m1] = await matchRows(db, t.code);

    // Mid-match forfeit by player_b even with a higher score: player_a (left alone) wins.
    for (const uid of [m0.player_a, m0.player_b]) {
      await signInAs(db, uid);
      await rpc(db, 'set_player_ready_and_check_start', { p_room_code: m0.room_code, p_player_id: uid, p_ready_state: true });
    }
    await db.query('UPDATE public.room_players SET score = 900 WHERE room_code = $1 AND auth_user_id = $2', [m0.room_code, m0.player_b]);
    await signInAs(db, m0.player_b);
    await rpc(db, 'leave_room_rpc', { p_room_code: m0.room_code });
    expect((await matchRows(db, t.code))[0].winner).toBe(m0.player_a);

    // Emptying a room without a decided match: simulate the guest seat already gone, then host leaves.
    await db.query('DELETE FROM public.room_players WHERE room_code = $1 AND auth_user_id = $2', [m1.room_code, m1.player_a]);
    await signInAs(db, m1.player_b);
    const res = await rpc<Res>(db, 'leave_room_rpc', { p_room_code: m1.room_code });
    expect(res).toMatchObject({ success: true, deleted: true });
    expect(await getRoom(db, m1.room_code!)).toBeUndefined();
    const rows = await matchRows(db, t.code);
    expect(rows[1].winner).toBe(m1.player_a);
    const final = rows.find((r) => r.round === 2)!;
    expect(final.player_a).toBe(m0.player_a);
    expect(final.player_b).toBe(m1.player_a);
    expect(final.room_code).not.toBeNull();
  });

  it('turnuva odalarında rövanş ve yeniden başlatma reddedilir', async () => {
    const t = await createFullTournament(db, 4);
    await signInAs(db, t.organizer);
    await rpc(db, 'start_tournament_rpc', { p_code: t.code });
    const [m] = await matchRows(db, t.code);
    await playRoom(db, m.room_code!, m.player_a, m.player_b);
    await signInAs(db, m.player_a);
    expect(await rpc(db, 'request_rematch_rpc', { p_room_code: m.room_code, p_want: true })).toEqual({
      success: false,
      error: 'Turnuva maçında rövanş yapılamaz',
    });
    expect(await rpc(db, 'restart_room_rpc', { p_room_code: m.room_code })).toEqual({
      success: false,
      error: 'Turnuva maçında rövanş yapılamaz',
    });
    expect((await getRoom(db, m.room_code!))?.status).toBe('RESULT');
  });

  it('cleanup_stale_rooms_rpc RUNNING turnuva odalarını silmez', async () => {
    const t = await createFullTournament(db, 4);
    await signInAs(db, t.organizer);
    await rpc(db, 'start_tournament_rpc', { p_code: t.code });
    const [m] = await matchRows(db, t.code);
    const normal = newUserId();
    await signInAs(db, normal);
    const plain = await rpc<Res & { code: string }>(db, 'create_room_rpc', {
      p_code: null, p_name: 'N', p_avatar: '🚀', p_match_questions: null, p_player_id: null,
    });
    await db.query("UPDATE public.rooms SET created_at = now() - interval '7 hours' WHERE code IN ($1, $2)", [
      m.room_code,
      plain.code,
    ]);
    await rpc(db, 'cleanup_stale_rooms_rpc');
    expect(await getRoom(db, m.room_code!)).toBeDefined();
    expect(await getRoom(db, plain.code)).toBeUndefined();
  });

  it('8 kişilik turnuvada 3 tur oynanır', async () => {
    const t = await createFullTournament(db, 8);
    await signInAs(db, t.organizer);
    expect(await rpc(db, 'start_tournament_rpc', { p_code: t.code })).toEqual({ success: true });
    for (let round = 1; round <= 3; round++) {
      const rows = (await matchRows(db, t.code)).filter((r) => r.round === round);
      expect(rows).toHaveLength(8 / 2 ** round);
      for (const r of rows) await playRoom(db, r.room_code!, r.player_a, r.player_b);
    }
    const tr = await tournamentRow(db, t.code);
    expect(tr.status).toBe('FINISHED');
    const final = (await matchRows(db, t.code)).find((r) => r.round === 3)!;
    expect(tr.champion).toBe(final.player_a);
    await signInAs(db, t.organizer);
    const view = await rpc<TournamentView>(db, 'get_tournament_rpc', { p_code: t.code });
    expect(view.tournament.rounds).toBe(3);
    expect(view.matches).toHaveLength(7);
  });
});
