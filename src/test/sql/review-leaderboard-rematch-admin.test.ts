import {
  createActiveMatch,
  createTestDb,
  getPlayer,
  getRoom,
  newRoomCode,
  newUserId,
  rpc,
  signInAs,
  signOut,
  type TestDb,
} from './helpers';

type Q = { id: number };

const correctIndexOf = async (db: TestDb, questionId: number) =>
  ((await db.query('SELECT correct_index FROM public.questions WHERE id = $1', [questionId])).rows[0] as {
    correct_index: number;
  }).correct_index;

/** Answers every question for one player; `correct` decides right vs. wrong options. */
const answerAll = async (db: TestDb, code: string, player: string, questions: Q[], correct: boolean) => {
  await signInAs(db, player);
  for (const q of questions) {
    const ci = await correctIndexOf(db, q.id);
    await rpc(db, 'submit_answer_rpc', {
      p_room_code: code,
      p_player_id: player,
      p_question_id: q.id,
      p_selected_option_index: correct ? ci : (ci + 1) % 4,
    });
  }
};

/** Plays a full match: host answers everything correctly, guest everything wrong, then finishes. */
const playFinishedMatch = async (db: TestDb) => {
  const m = await createActiveMatch(db);
  await answerAll(db, m.code, m.hostId, m.questions, true);
  await answerAll(db, m.code, m.guestId, m.questions, false);
  await signInAs(db, m.hostId);
  const fin = await rpc(db, 'finish_room_rpc', { p_room_code: m.code });
  if (!(fin as { success: boolean }).success) throw new Error('setup: finish failed ' + JSON.stringify(fin));
  return m;
};

const leaderboardRows = async (db: TestDb, code: string) =>
  (await db.query('SELECT * FROM public.leaderboard_entries WHERE room_code = $1 ORDER BY score DESC', [code]))
    .rows as { auth_user_id: string; score: number; correct_answers: number; won: boolean; match_no: number; name: string }[];

const makeAdmin = async (db: TestDb) => {
  const id = newUserId();
  await db.query('INSERT INTO public.quiz_admins(user_id) VALUES ($1)', [id]);
  return id;
};

describe('quiz_settings / get_server_time_rpc', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it('quiz_settings sabit ayarları döner', async () => {
    const res = await db.query<{ s: unknown }>('SELECT public.quiz_settings() AS s');
    expect(res.rows[0].s).toEqual({ match_seconds: 90, question_count: 10, countdown_seconds: 3 });
  });

  it('get_server_time_rpc ayarları da içerir', async () => {
    await signInAs(db, newUserId());
    const res = await rpc<{ success: boolean; server_time: string; settings: unknown }>(db, 'get_server_time_rpc');
    expect(res.success).toBe(true);
    expect(Math.abs(new Date(res.server_time).getTime() - Date.now())).toBeLessThan(60_000);
    expect(res.settings).toEqual({ match_seconds: 90, question_count: 10, countdown_seconds: 3 });
  });

  it('maç başlangıcı countdown_seconds kadar ileridedir ve streak artık yazılmaz', async () => {
    const { code, hostId, questions } = await createActiveMatch(db);
    await answerAll(db, code, hostId, questions.slice(0, 3), true);
    const host = await getPlayer(db, code, hostId);
    expect(host?.correct_answers).toBe(3);
    expect(host?.streak).toBe(0);

    // countdown: ready-up anında started_at ≈ now + 3 sn
    const h = newUserId();
    const g = newUserId();
    const c = newRoomCode();
    await signInAs(db, h);
    await rpc(db, 'create_room_rpc', { p_code: c, p_name: 'H', p_avatar: '🚀', p_match_questions: null, p_player_id: h });
    await signInAs(db, g);
    await rpc(db, 'join_room_atomic', { p_room_code: c, p_player_id: g, p_name: 'G', p_avatar: '⚡' });
    await rpc(db, 'set_player_ready_and_check_start', { p_room_code: c, p_player_id: g, p_ready_state: true });
    await signInAs(db, h);
    const res = await rpc<{ started_at: string }>(db, 'set_player_ready_and_check_start', {
      p_room_code: c,
      p_player_id: h,
      p_ready_state: true,
    });
    const delta = new Date(res.started_at).getTime() - Date.now();
    expect(delta).toBeGreaterThan(1_500);
    expect(delta).toBeLessThan(4_500);
  });

  it('match_seconds dolmadan finish edilemez, dolunca edilir', async () => {
    const { code, hostId } = await createActiveMatch(db);
    await db.query("UPDATE public.rooms SET started_at = now() - interval '89 seconds' WHERE code = $1", [code]);
    await signInAs(db, hostId);
    expect(await rpc(db, 'finish_room_rpc', { p_room_code: code })).toMatchObject({ success: false });
    await db.query("UPDATE public.rooms SET started_at = now() - interval '91 seconds' WHERE code = $1", [code]);
    expect(await rpc(db, 'finish_room_rpc', { p_room_code: code })).toMatchObject({ success: true, timed_out: true });
  });
});

describe('isim/avatar doğrulama ve sunucu tarafı oda kodu', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });

  const create = (name: string, avatar: string | null, code: string | null = newRoomCode()) =>
    rpc<{ success: boolean; code?: string; error?: string }>(db, 'create_room_rpc', {
      p_code: code,
      p_name: name,
      p_avatar: avatar,
      p_match_questions: null,
      p_player_id: 'x',
    });

  it('listedeki tüm avatarları kabul eder', async () => {
    for (const avatar of ['🚀', '⚡', '🤖', '🛡️', '👨‍🚀', '⚙️']) {
      await signInAs(db, newUserId());
      expect(await create('Oyuncu', avatar), avatar).toMatchObject({ success: true });
    }
  });

  it('listede olmayan veya boş avatarı reddeder', async () => {
    for (const avatar of ['🐱', '', null, '🛡']) {
      await signInAs(db, newUserId());
      expect(await create('Oyuncu', avatar)).toMatchObject({ success: false, error: 'Geçersiz avatar' });
    }
  });

  it('ismi trim eder; 1-16 karakter dışını reddeder', async () => {
    const hostId = newUserId();
    await signInAs(db, hostId);
    const ok = await create('  Arda  ', '🚀');
    expect(ok.success).toBe(true);
    expect((await getPlayer(db, ok.code!, hostId))?.name).toBe('Arda');

    await signInAs(db, newUserId());
    expect(await create('a'.repeat(16), '🚀')).toMatchObject({ success: true });
    await signInAs(db, newUserId());
    expect(await create('a'.repeat(17), '🚀')).toMatchObject({ success: false });
    await signInAs(db, newUserId());
    expect(await create('   ', '🚀')).toMatchObject({ success: false });
  });

  it('join_room_atomic da isim ve avatarı doğrular', async () => {
    const code = newRoomCode();
    await signInAs(db, newUserId());
    await create('Host', '🚀', code);

    await signInAs(db, newUserId());
    expect(
      await rpc(db, 'join_room_atomic', { p_room_code: code, p_player_id: 'g', p_name: 'G', p_avatar: '😈' })
    ).toMatchObject({ success: false, error: 'Geçersiz avatar' });
    expect(
      await rpc(db, 'join_room_atomic', { p_room_code: code, p_player_id: 'g', p_name: 'x'.repeat(20), p_avatar: '⚡' })
    ).toMatchObject({ success: false });
    expect(
      await rpc(db, 'join_room_atomic', { p_room_code: code, p_player_id: 'g', p_name: ' Guest ', p_avatar: '👨‍🚀' })
    ).toMatchObject({ success: true });
  });

  it('p_code NULL veya boşsa sunucu benzersiz 6 haneli kod üretir', async () => {
    const codes = new Set<string>();
    for (const code of [null, '', '   ', null, null]) {
      await signInAs(db, newUserId());
      const res = await create('Host', '🚀', code);
      expect(res.success).toBe(true);
      expect(res.code).toMatch(/^[0-9]{6}$/);
      expect(await getRoom(db, res.code!)).toMatchObject({ status: 'LOBBY' });
      codes.add(res.code!);
    }
    expect(codes.size).toBe(5);
  });

  it('elle verilen geçersiz kod hâlâ reddedilir', async () => {
    await signInAs(db, newUserId());
    expect(await create('Host', '🚀', '12AB56')).toMatchObject({ success: false });
  });

  it('_validate_player_identity hata mesajı ya da NULL döner', async () => {
    const r = await db.query<{ a: string | null; b: string | null; c: string | null }>(
      "SELECT public._validate_player_identity('Ali','🤖') a, public._validate_player_identity('Ali','x') b, public._validate_player_identity('',' 🤖') c"
    );
    expect(r.rows[0].a).toBeNull();
    expect(r.rows[0].b).toBe('Geçersiz avatar');
    expect(r.rows[0].c).not.toBeNull();
  });
});

describe('_pick_room_questions / is_active', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it('pasif sorular seçilmez', async () => {
    await db.query("UPDATE public.questions SET is_active = false WHERE difficulty = 'zor' AND id % 2 = 0");
    const inactive = new Set(
      ((await db.query('SELECT id FROM public.questions WHERE NOT is_active')).rows as { id: number }[]).map((r) => r.id)
    );
    for (let i = 0; i < 10; i++) {
      const res = await db.query<{ q: Q[] }>('SELECT public._pick_room_questions(NULL) AS q');
      expect(res.rows[0].q).toHaveLength(10);
      expect(res.rows[0].q.filter((q) => inactive.has(q.id))).toHaveLength(0);
    }
    await db.query('UPDATE public.questions SET is_active = true');
  });

  it('yeterli aktif soru yoksa NULL döner ve create_room_rpc hata verir', async () => {
    await db.query("UPDATE public.questions SET is_active = false WHERE difficulty = 'zor'");
    const res = await db.query<{ q: unknown }>('SELECT public._pick_room_questions(NULL) AS q');
    expect(res.rows[0].q).toBeNull();

    await signInAs(db, newUserId());
    expect(
      await rpc(db, 'create_room_rpc', { p_code: null, p_name: 'H', p_avatar: '🚀', p_match_questions: null, p_player_id: 'x' })
    ).toMatchObject({ success: false });
    await db.query('UPDATE public.questions SET is_active = true');
  });

  it('odanın mevcut ve önceki sorularını tekrar seçmez', async () => {
    const { code, questions } = await createActiveMatch(db);
    const current = new Set(questions.map((q) => q.id));
    const res = await db.query<{ q: Q[] }>('SELECT public._pick_room_questions($1) AS q', [code]);
    expect(res.rows[0].q.filter((q) => current.has(q.id))).toHaveLength(0);
  });
});

describe('get_match_review_rpc', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });

  type Review = {
    success: boolean;
    match_no: number;
    questions: {
      id: number;
      correct_index: number;
      options: string[];
      explanation: string | null;
      my_answer: { selected_option_index: number; is_correct: boolean; points_awarded: number } | null;
      opponent_answer: { selected_option_index: number; is_correct: boolean; points_awarded: number } | null;
    }[];
  };

  it('maç bitince soruları sırasıyla, doğru cevap ve iki oyuncunun cevaplarıyla döner', async () => {
    const { code, hostId, questions } = await playFinishedMatch(db);
    await signInAs(db, hostId);
    const res = await rpc<Review>(db, 'get_match_review_rpc', { p_room_code: code });
    expect(res.success).toBe(true);
    expect(res.match_no).toBe(1);
    expect(res.questions.map((q) => q.id)).toEqual(questions.map((q) => q.id));
    for (const q of res.questions) {
      expect(q.correct_index).toBe(await correctIndexOf(db, q.id));
      expect(q.options).toHaveLength(4);
      expect(q.my_answer).toMatchObject({ selected_option_index: q.correct_index, is_correct: true });
      expect(q.my_answer!.points_awarded).toBeGreaterThanOrEqual(100);
      expect(q.opponent_answer).toMatchObject({ is_correct: false, points_awarded: 0 });
    }
  });

  it('cevaplanmamış sorularda my_answer / opponent_answer null olur', async () => {
    const { code, hostId, questions } = await createActiveMatch(db);
    await answerAll(db, code, hostId, questions.slice(0, 2), true);
    await db.query("UPDATE public.rooms SET started_at = now() - interval '100 seconds' WHERE code = $1", [code]);
    await signInAs(db, hostId);
    await rpc(db, 'finish_room_rpc', { p_room_code: code });

    const res = await rpc<Review>(db, 'get_match_review_rpc', { p_room_code: code });
    expect(res.success).toBe(true);
    expect(res.questions[0].my_answer).not.toBeNull();
    expect(res.questions[2].my_answer).toBeNull();
    expect(res.questions.every((q) => q.opponent_answer === null)).toBe(true);
  });

  it('maç bitmeden inceleme yapılamaz', async () => {
    const { code, hostId } = await createActiveMatch(db);
    await signInAs(db, hostId);
    expect(await rpc(db, 'get_match_review_rpc', { p_room_code: code })).toMatchObject({ success: false });
  });

  it('üye olmayan inceleyemez', async () => {
    const { code } = await playFinishedMatch(db);
    await signInAs(db, newUserId());
    expect(await rpc(db, 'get_match_review_rpc', { p_room_code: code })).toMatchObject({ success: false });
  });

  it('rövanş sonrası sadece yeni maçın cevaplarını gösterir', async () => {
    const { code, hostId, guestId } = await playFinishedMatch(db);
    await signInAs(db, hostId);
    await rpc(db, 'request_rematch_rpc', { p_room_code: code });
    await signInAs(db, guestId);
    await rpc(db, 'request_rematch_rpc', { p_room_code: code });
    await db.query("UPDATE public.rooms SET started_at = now() - interval '100 seconds' WHERE code = $1", [code]);
    await rpc(db, 'finish_room_rpc', { p_room_code: code });

    const res = await rpc<Review>(db, 'get_match_review_rpc', { p_room_code: code });
    expect(res.match_no).toBe(2);
    expect(res.questions).toHaveLength(10);
    expect(res.questions.every((q) => q.my_answer === null && q.opponent_answer === null)).toBe(true);
  });
});

describe('liderlik tablosu', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });

  type Board = {
    success: boolean;
    period: string;
    entries: { rank: number; name: string; avatar: string; score: number; correct_answers: number; created_at: string }[];
  };

  it('RESULT geçişinde iki oyuncu da kaydedilir, kazanan doğru işaretlenir', async () => {
    const { code, hostId, guestId } = await playFinishedMatch(db);
    const rows = await leaderboardRows(db, code);
    expect(rows).toHaveLength(2);
    const host = rows.find((r) => r.auth_user_id === hostId)!;
    const guest = rows.find((r) => r.auth_user_id === guestId)!;
    expect(host).toMatchObject({ won: true, correct_answers: 10, match_no: 1, name: 'Host' });
    expect(host.score).toBeGreaterThanOrEqual(1000);
    expect(guest).toMatchObject({ won: false, score: 0, correct_answers: 0 });
  });

  it('beraberlikte kimse kazanmış sayılmaz; tekrar RESULT güncellemesi kopya oluşturmaz', async () => {
    const { code, hostId } = await createActiveMatch(db);
    await db.query("UPDATE public.rooms SET started_at = now() - interval '100 seconds' WHERE code = $1", [code]);
    await signInAs(db, hostId);
    await rpc(db, 'finish_room_rpc', { p_room_code: code });
    await rpc(db, 'finish_room_rpc', { p_room_code: code });
    await db.query("UPDATE public.rooms SET status = 'RESULT' WHERE code = $1", [code]);
    const rows = await leaderboardRows(db, code);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => !r.won)).toBe(true);
  });

  it('maç sırasında rakip ayrılırsa kalan oyuncu kazanan olarak kaydedilir', async () => {
    const { code, hostId, guestId } = await createActiveMatch(db);
    await signInAs(db, guestId);
    await rpc(db, 'leave_room_rpc', { p_room_code: code });
    const rows = await leaderboardRows(db, code);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ auth_user_id: hostId, won: true });
  });

  it('RESULT dışı durum değişiklikleri kayıt eklemez', async () => {
    const { code } = await createActiveMatch(db);
    await db.query("UPDATE public.rooms SET status = 'QUIZ' WHERE code = $1", [code]);
    expect(await leaderboardRows(db, code)).toHaveLength(0);
  });

  it('get_leaderboard_rpc skor azalan, eşitlikte eski kayıt önde sıralar ve oturumsuz çalışır', async () => {
    const fresh = await createTestDb();
    const insert = (name: string, score: number, ago: string) =>
      fresh.query(
        `INSERT INTO public.leaderboard_entries(room_code, match_no, auth_user_id, name, avatar, score, correct_answers, won, created_at)
         VALUES ('111111', 1, $1, $2, '🚀', $3, 5, false, now() - $4::interval)`,
        [newUserId(), name, score, ago]
      );
    await insert('B', 500, '10 minutes');
    await insert('A', 500, '20 minutes');
    await insert('C', 900, '5 minutes');
    await insert('D', 100, '1 minute');
    await insert('Eski', 5000, '3 days');

    await signOut(fresh);
    const today = await rpc<Board>(fresh, 'get_leaderboard_rpc', { p_period: 'today', p_limit: 3 });
    expect(today.success).toBe(true);
    expect(today.period).toBe('today');
    expect(today.entries.map((e) => [e.rank, e.name])).toEqual([
      [1, 'C'],
      [2, 'A'],
      [3, 'B'],
    ]);
    expect(today.entries[0]).toMatchObject({ avatar: '🚀', score: 900, correct_answers: 5 });

    const all = await rpc<Board>(fresh, 'get_leaderboard_rpc', { p_period: 'all' });
    expect(all.entries[0].name).toBe('Eski');
    expect(all.entries).toHaveLength(5);

    const defaults = await rpc<Board>(fresh, 'get_leaderboard_rpc');
    expect(defaults.period).toBe('today');
    expect(defaults.entries).toHaveLength(4);
  });

  it('limit 1..50 aralığına sıkıştırılır, geçersiz dönem reddedilir', async () => {
    const fresh = await createTestDb();
    await fresh.query(
      `INSERT INTO public.leaderboard_entries(room_code, match_no, auth_user_id, name, avatar, score, correct_answers, won)
       SELECT 'r' || g, 1, gen_random_uuid(), 'P' || g, '🚀', g, 1, false FROM generate_series(1, 60) g`
    );
    expect((await rpc<Board>(fresh, 'get_leaderboard_rpc', { p_period: 'all', p_limit: 0 })).entries).toHaveLength(1);
    expect((await rpc<Board>(fresh, 'get_leaderboard_rpc', { p_period: 'all', p_limit: 500 })).entries).toHaveLength(50);
    expect(await rpc(fresh, 'get_leaderboard_rpc', { p_period: 'week' })).toMatchObject({ success: false });
  });
});

describe('request_rematch_rpc', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it('tek taraf isteyince bekler, iki taraf isteyince yeni maç VS ile başlar', async () => {
    const { code, hostId, guestId, questions } = await playFinishedMatch(db);

    await signInAs(db, hostId);
    expect(await rpc(db, 'request_rematch_rpc', { p_room_code: code })).toEqual({
      success: true,
      started: false,
      waiting_for_opponent: true,
    });
    expect((await getRoom(db, code))?.status).toBe('RESULT');

    await signInAs(db, guestId);
    const res = await rpc<{ success: boolean; started: boolean; waiting_for_opponent: boolean }>(
      db,
      'request_rematch_rpc',
      { p_room_code: code, p_want: true }
    );
    expect(res).toMatchObject({ success: true, started: true, waiting_for_opponent: false });

    const room = await getRoom(db, code);
    expect(room).toMatchObject({ status: 'VS', match_no: 2 });
    const startedAt = new Date(room!.started_at as string).getTime();
    expect(startedAt - Date.now()).toBeGreaterThan(1_500);
    const newIds = (room!.match_questions as Q[]).map((q) => q.id);
    expect(newIds).toHaveLength(10);
    const old = new Set(questions.map((q) => q.id));
    expect(newIds.filter((id) => old.has(id))).toHaveLength(0);

    for (const id of [hostId, guestId]) {
      const p = await getPlayer(db, code, id);
      expect(p).toMatchObject({
        score: 0,
        correct_answers: 0,
        current_question_index: 0,
        finished_at: null,
        wants_rematch: false,
        is_ready: true,
      });
      expect(new Date(p!.question_started_at as string).getTime()).toBe(startedAt);
    }
  });

  it('isteğini geri çeken oyuncu sayılmaz', async () => {
    const { code, hostId, guestId } = await playFinishedMatch(db);
    await signInAs(db, hostId);
    await rpc(db, 'request_rematch_rpc', { p_room_code: code });
    expect(await rpc(db, 'request_rematch_rpc', { p_room_code: code, p_want: false })).toMatchObject({
      success: true,
      started: false,
      waiting_for_opponent: false,
    });
    await signInAs(db, guestId);
    expect(await rpc(db, 'request_rematch_rpc', { p_room_code: code })).toMatchObject({ started: false });
    expect((await getRoom(db, code))?.status).toBe('RESULT');
  });

  it('maç bitmeden rövanş istenemez; üye olmayan isteyemez', async () => {
    const { code, hostId } = await createActiveMatch(db);
    await signInAs(db, hostId);
    expect(await rpc(db, 'request_rematch_rpc', { p_room_code: code })).toMatchObject({ success: false });

    const done = await playFinishedMatch(db);
    await signInAs(db, newUserId());
    expect(await rpc(db, 'request_rematch_rpc', { p_room_code: done.code })).toMatchObject({ success: false });
  });

  it('rakip ayrılınca kalanın isteği sıfırlanır ve rövanş hata verir', async () => {
    const { code, hostId, guestId } = await playFinishedMatch(db);
    await signInAs(db, hostId);
    await rpc(db, 'request_rematch_rpc', { p_room_code: code });
    expect((await getPlayer(db, code, hostId))?.wants_rematch).toBe(true);

    await signInAs(db, guestId);
    await rpc(db, 'leave_room_rpc', { p_room_code: code });
    expect((await getPlayer(db, code, hostId))?.wants_rematch).toBe(false);

    await signInAs(db, hostId);
    expect(await rpc(db, 'request_rematch_rpc', { p_room_code: code })).toEqual({
      success: false,
      error: 'Rakip odadan ayrıldı',
    });
  });

  it('rövanş maçı bitince liderlik tablosuna yeni match_no ile eklenir', async () => {
    const { code, hostId, guestId } = await playFinishedMatch(db);
    await signInAs(db, hostId);
    await rpc(db, 'request_rematch_rpc', { p_room_code: code });
    await signInAs(db, guestId);
    await rpc(db, 'request_rematch_rpc', { p_room_code: code });
    await db.query("UPDATE public.rooms SET started_at = now() - interval '100 seconds' WHERE code = $1", [code]);
    await rpc(db, 'finish_room_rpc', { p_room_code: code });
    const rows = await leaderboardRows(db, code);
    expect(rows.map((r) => r.match_no).sort()).toEqual([1, 1, 2, 2]);
  });

  it('restart_room_rpc wants_rematch değerini sıfırlar', async () => {
    const { code, hostId } = await playFinishedMatch(db);
    await signInAs(db, hostId);
    await rpc(db, 'request_rematch_rpc', { p_room_code: code });
    expect(await rpc(db, 'restart_room_rpc', { p_room_code: code })).toMatchObject({ success: true, status: 'LOBBY' });
    expect((await getPlayer(db, code, hostId))?.wants_rematch).toBe(false);
  });
});

describe('admin RPC\'leri', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });

  const validQuestion = (overrides: Record<string, unknown> = {}) => ({
    p_id: null,
    p_category: 'bilim',
    p_difficulty: 'orta',
    p_question: 'Test sorusu: Mars kaçıncı gezegendir?',
    p_options: JSON.stringify(['1', '2', '3', '4']),
    p_correct_index: 3,
    p_explanation: 'Mars Güneşe göre 4. gezegendir.',
    ...overrides,
  });

  it('admin olmayan tüm admin RPC\'lerinde Yetkisiz alır', async () => {
    await signInAs(db, newUserId());
    const unauthorized = { success: false, error: 'Yetkisiz' };
    expect(await rpc(db, 'admin_list_questions_rpc')).toEqual(unauthorized);
    expect(await rpc(db, 'admin_upsert_question_rpc', validQuestion())).toEqual(unauthorized);
    expect(await rpc(db, 'admin_set_question_active_rpc', { p_id: 1, p_active: false })).toEqual(unauthorized);
    expect(await rpc(db, 'admin_stats_rpc')).toEqual(unauthorized);
    await signOut(db);
    expect(await rpc(db, 'admin_stats_rpc')).toEqual(unauthorized);
  });

  it('is_quiz_admin sadece quiz_admins üyeleri için true döner', async () => {
    const adminId = await makeAdmin(db);
    await signInAs(db, adminId);
    expect((await db.query<{ a: boolean }>('SELECT public.is_quiz_admin() a')).rows[0].a).toBe(true);
    await signInAs(db, newUserId());
    expect((await db.query<{ a: boolean }>('SELECT public.is_quiz_admin() a')).rows[0].a).toBe(false);
  });

  it('soru ekler, günceller, listeler ve filtreler', async () => {
    await signInAs(db, await makeAdmin(db));
    const created = await rpc<{ success: boolean; id: number }>(db, 'admin_upsert_question_rpc', validQuestion());
    expect(created.success).toBe(true);

    const updated = await rpc<{ success: boolean; id: number }>(
      db,
      'admin_upsert_question_rpc',
      validQuestion({ p_id: created.id, p_difficulty: 'kolay', p_options: JSON.stringify([' 1 ', '2', '3', '4']) })
    );
    expect(updated).toEqual({ success: true, id: created.id });

    type List = { success: boolean; questions: { id: number; difficulty: string; options: string[]; is_active: boolean; times_answered: number; correct_rate: number | null }[] };
    const list = await rpc<List>(db, 'admin_list_questions_rpc', { p_search: 'mars kaçıncı' });
    expect(list.success).toBe(true);
    expect(list.questions).toHaveLength(1);
    expect(list.questions[0]).toMatchObject({
      id: created.id,
      difficulty: 'kolay',
      options: ['1', '2', '3', '4'],
      is_active: true,
      times_answered: 0,
      correct_rate: null,
    });

    const all = await rpc<List>(db, 'admin_list_questions_rpc');
    expect(all.questions.length).toBeGreaterThan(100);
    expect(all.questions[0].id).toBe(created.id); // id azalan
    const zor = await rpc<List>(db, 'admin_list_questions_rpc', { p_category: 'mantık', p_difficulty: 'zor' });
    expect(zor.questions.length).toBeGreaterThan(0);
    expect(zor.questions.every((q) => q.difficulty === 'zor')).toBe(true);
  });

  it('geçersiz soru verilerini reddeder', async () => {
    await signInAs(db, await makeAdmin(db));
    const bad: Record<string, unknown>[] = [
      { p_category: 'spor' },
      { p_difficulty: 'çok zor' },
      { p_question: 'abc' },
      { p_question: 'x'.repeat(301) },
      { p_options: JSON.stringify(['a', 'b', 'c']) },
      { p_options: JSON.stringify(['a', 'b', 'c', 'd', 'e']) },
      { p_options: JSON.stringify(['a', 'b', 'c', 'a']) },
      { p_options: JSON.stringify(['a', 'b', 'c', '  ']) },
      { p_options: JSON.stringify(['a', 'b', 'c', 4]) },
      { p_options: JSON.stringify({ a: 1 }) },
      { p_correct_index: 4 },
      { p_correct_index: -1 },
      { p_question: 'CPU neyin kısaltmasıdır?' }, // mevcut soru metni
      { p_id: 99999999 },
    ];
    for (const o of bad) {
      expect(await rpc(db, 'admin_upsert_question_rpc', validQuestion(o)), JSON.stringify(o)).toMatchObject({ success: false });
    }
  });

  it('soruyu pasifleştirir; pasif soru maçlarda seçilmez', async () => {
    await signInAs(db, await makeAdmin(db));
    const zorIds = ((await db.query("SELECT id FROM public.questions WHERE difficulty = 'zor' ORDER BY id")).rows as { id: number }[]).map((r) => r.id);
    const keep = new Set(zorIds.slice(0, 2));
    for (const id of zorIds.slice(2)) {
      expect(await rpc(db, 'admin_set_question_active_rpc', { p_id: id, p_active: false })).toEqual({ success: true });
    }
    const { questions } = await createActiveMatch(db);
    const picked = (questions as (Q & { difficulty?: string })[]).filter((q) => q.difficulty === 'zor').map((q) => q.id);
    expect(picked.every((id) => keep.has(id))).toBe(true);

    expect(await rpc(db, 'admin_set_question_active_rpc', { p_id: 99999999, p_active: true })).toMatchObject({ success: false });
    await db.query('UPDATE public.questions SET is_active = true');
  });

  it('admin_stats_rpc sayıları ve en çok yanlış yapılan soruları döner', async () => {
    const fresh = await createTestDb();
    await playFinishedMatch(fresh); // host hepsini doğru, guest hepsini yanlış
    const m2 = await createActiveMatch(fresh);
    // İkinci maçta ilk soruyu iki oyuncu da yanlış cevaplasın.
    const q0 = m2.questions[0];
    await answerAll(fresh, m2.code, m2.hostId, [q0], false);
    await answerAll(fresh, m2.code, m2.guestId, [q0], false);

    await fresh.query('UPDATE public.questions SET is_active = false WHERE id = (SELECT min(id) FROM public.questions)');
    await signInAs(fresh, await makeAdmin(fresh));
    const stats = await rpc<{
      success: boolean;
      active_questions: number;
      total_questions: number;
      rooms_today: number;
      matches_today: number;
      most_missed: { id: number; question: string; times_answered: number; correct_rate: number }[];
    }>(fresh, 'admin_stats_rpc');

    expect(stats.success).toBe(true);
    expect(stats.active_questions).toBe(stats.total_questions - 1);
    expect(stats.rooms_today).toBe(2);
    expect(stats.matches_today).toBe(1);
    // Sadece en az 3 cevaplı sorular: q0 ikinci maçta da sorulduysa 4 cevaplıdır.
    expect(stats.most_missed.every((q) => q.times_answered >= 3)).toBe(true);
    const rates = stats.most_missed.map((q) => q.correct_rate);
    expect([...rates].sort((a, b) => a - b)).toEqual(rates);
    expect(stats.most_missed.length).toBeLessThanOrEqual(10);
  });

  it('most_missed en az 3 cevaplı soruları correct_rate artan sıralar', async () => {
    const fresh = await createTestDb();
    const { code } = await createActiveMatch(fresh);
    const ids = ((await fresh.query('SELECT id FROM public.questions ORDER BY id LIMIT 3')).rows as { id: number }[]).map((r) => r.id);
    // ids[0]: 3 cevap 0 doğru, ids[1]: 4 cevap 2 doğru, ids[2]: 2 cevap (hariç)
    const ins = (qid: number, n: number, correct: boolean) =>
      fresh.query(
        `INSERT INTO public.room_player_answers(room_code, match_no, player_id, question_id, selected_option_index, is_correct, points_awarded)
         SELECT $1, 100 + g, 'p' || $4 || g, $2, 0, $3, 0 FROM generate_series(1, $5) g`,
        [code, qid, correct, correct ? 'c' : 'w', n]
      );
    await ins(ids[0], 3, false);
    await ins(ids[1], 2, false);
    await ins(ids[1], 2, true);
    await ins(ids[2], 2, false);

    await signInAs(fresh, await makeAdmin(fresh));
    const stats = await rpc<{ most_missed: { id: number; times_answered: number; correct_rate: number }[] }>(fresh, 'admin_stats_rpc');
    expect(stats.most_missed).toEqual([
      expect.objectContaining({ id: ids[0], times_answered: 3, correct_rate: 0 }),
      expect.objectContaining({ id: ids[1], times_answered: 4, correct_rate: 0.5 }),
    ]);

    const list = await rpc<{ questions: { id: number; times_answered: number; correct_rate: number | null }[] }>(
      fresh,
      'admin_list_questions_rpc'
    );
    expect(list.questions.find((q) => q.id === ids[1])).toMatchObject({ times_answered: 4, correct_rate: 0.5 });
  });
});
