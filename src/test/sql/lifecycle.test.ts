import {
  createActiveMatch,
  createTestDb,
  getPlayer,
  getRoom,
  newRoomCode,
  newUserId,
  rpc,
  signInAs,
  type TestDb,
} from './helpers';

const finishAllAnswers = async (db: TestDb, code: string, players: string[], questions: { id: number }[]) => {
  for (const player of players) {
    await signInAs(db, player);
    for (const q of questions) {
      await rpc(db, 'submit_answer_rpc', { p_room_code: code, p_player_id: player, p_question_id: q.id, p_selected_option_index: 0 });
    }
  }
};

describe('finish_room_rpc', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it('maç bitmeden ve süre dolmadan bitirilemez', async () => {
    const { code, hostId } = await createActiveMatch(db);
    await signInAs(db, hostId);
    expect(await rpc(db, 'finish_room_rpc', { p_room_code: code })).toMatchObject({ success: false });
  });

  it('iki oyuncu da bitirince RESULT olur, tekrar çağrı idempotenttir', async () => {
    const { code, hostId, guestId, questions } = await createActiveMatch(db);
    await finishAllAnswers(db, code, [hostId, guestId], questions);

    await signInAs(db, hostId);
    expect(await rpc(db, 'finish_room_rpc', { p_room_code: code })).toMatchObject({ success: true, already_finished: false });
    await signInAs(db, guestId);
    expect(await rpc(db, 'finish_room_rpc', { p_room_code: code })).toMatchObject({ success: true, already_finished: true });
    expect((await getRoom(db, code))?.status).toBe('RESULT');
  });

  it('süre dolunca tek oyuncu bitirmemiş olsa da RESULT olur', async () => {
    const { code, hostId } = await createActiveMatch(db);
    await db.query("UPDATE public.rooms SET started_at = now() - interval '95 seconds' WHERE code = $1", [code]);
    await signInAs(db, hostId);
    expect(await rpc(db, 'finish_room_rpc', { p_room_code: code })).toMatchObject({ success: true, timed_out: true });
  });

  it('üye olmayan bitiremez', async () => {
    const { code } = await createActiveMatch(db);
    await signInAs(db, newUserId());
    expect(await rpc(db, 'finish_room_rpc', { p_room_code: code })).toMatchObject({ success: false });
  });
});

describe('restart_room_rpc', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it('skorları sıfırlar, match_no artırır, önceki maçın sorularını tekrar sormaz', async () => {
    const { code, hostId, guestId, questions } = await createActiveMatch(db);
    await finishAllAnswers(db, code, [hostId, guestId], questions);
    await signInAs(db, hostId);
    await rpc(db, 'finish_room_rpc', { p_room_code: code });

    const res = await rpc<{ success: boolean; match_no: number }>(db, 'restart_room_rpc', { p_room_code: code });
    expect(res).toMatchObject({ success: true, match_no: 2 });

    const room = await getRoom(db, code);
    expect(room?.status).toBe('LOBBY');
    const newIds = (room!.match_questions as { id: number }[]).map((q) => q.id);
    const oldIds = new Set(questions.map((q) => q.id));
    expect(newIds).toHaveLength(10);
    expect(newIds.filter((id) => oldIds.has(id))).toHaveLength(0);

    const host = await getPlayer(db, code, hostId);
    expect(host).toMatchObject({ score: 0, correct_answers: 0, current_question_index: 0, is_ready: false });
  });

  it('görülmemiş soru kalmayınca tüm havuza geri döner (hata vermez)', async () => {
    const { code, hostId } = await createActiveMatch(db);
    // Odada tüm zor soruların cevaplandığını simüle et.
    await db.query(
      `INSERT INTO public.room_player_answers(room_code, match_no, player_id, question_id, selected_option_index, is_correct, points_awarded)
       SELECT $1, 99, $2, id, 0, false, 0 FROM public.questions WHERE difficulty = 'zor'`,
      [code, hostId]
    );
    await signInAs(db, hostId);
    const res = await rpc(db, 'restart_room_rpc', { p_room_code: code });
    expect(res).toMatchObject({ success: true });
  });
});

describe('leave_room_rpc', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it('tek oyunculu odadan çıkınca oda silinir', async () => {
    const hostId = newUserId();
    const code = newRoomCode();
    await signInAs(db, hostId);
    await rpc(db, 'create_room_rpc', { p_code: code, p_name: 'H', p_avatar: '🚀', p_match_questions: null, p_player_id: hostId });

    expect(await rpc(db, 'leave_room_rpc', { p_room_code: code })).toMatchObject({ success: true, deleted: true });
    expect(await getRoom(db, code)).toBeUndefined();
  });

  it('lobide host çıkınca kalan oyuncu host olur ve hazır durumu sıfırlanır', async () => {
    const hostId = newUserId();
    const guestId = newUserId();
    const code = newRoomCode();
    await signInAs(db, hostId);
    await rpc(db, 'create_room_rpc', { p_code: code, p_name: 'H', p_avatar: '🚀', p_match_questions: null, p_player_id: hostId });
    await signInAs(db, guestId);
    await rpc(db, 'join_room_atomic', { p_room_code: code, p_player_id: guestId, p_name: 'G', p_avatar: '⚡' });
    await rpc(db, 'set_player_ready_and_check_start', { p_room_code: code, p_player_id: guestId, p_ready_state: true });

    await signInAs(db, hostId);
    expect(await rpc(db, 'leave_room_rpc', { p_room_code: code })).toMatchObject({ success: true, deleted: false });

    expect(await getPlayer(db, code, hostId)).toBeUndefined();
    expect(await getPlayer(db, code, guestId)).toMatchObject({ is_host: true, is_ready: false });

    // Oda artık yeni bir rakibi kabul edebilir.
    await signInAs(db, newUserId());
    expect(
      await rpc(db, 'join_room_atomic', { p_room_code: code, p_player_id: 'n', p_name: 'N', p_avatar: '🤖' })
    ).toMatchObject({ success: true });
  });

  it('maç sırasında çıkılırsa oda RESULT olur (rakip beklemede kalmaz)', async () => {
    const { code, hostId } = await createActiveMatch(db);
    await signInAs(db, hostId);
    await rpc(db, 'leave_room_rpc', { p_room_code: code });
    expect((await getRoom(db, code))?.status).toBe('RESULT');
  });

  it('üye olmayan çağrı hiçbir şeyi değiştirmez', async () => {
    const { code, hostId } = await createActiveMatch(db);
    await signInAs(db, newUserId());
    expect(await rpc(db, 'leave_room_rpc', { p_room_code: code })).toMatchObject({ success: true, deleted: false });
    expect(await getPlayer(db, code, hostId)).toBeDefined();
  });
});

describe('heartbeat_rpc / get_server_time_rpc / cleanup_stale_rooms_rpc', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it('heartbeat last_seen_at günceller, üye olmayanı reddeder', async () => {
    const { code, hostId } = await createActiveMatch(db);
    await db.query("UPDATE public.room_players SET last_seen_at = now() - interval '1 hour' WHERE room_code = $1", [code]);

    await signInAs(db, hostId);
    expect(await rpc(db, 'heartbeat_rpc', { p_room_code: code })).toMatchObject({ success: true });
    const seen = new Date((await getPlayer(db, code, hostId))!.last_seen_at as string).getTime();
    expect(Date.now() - seen).toBeLessThan(60_000);

    await signInAs(db, newUserId());
    expect(await rpc(db, 'heartbeat_rpc', { p_room_code: code })).toMatchObject({ success: false });
  });

  it('sunucu saati döner', async () => {
    const res = await rpc<{ server_time: string }>(db, 'get_server_time_rpc');
    expect(Math.abs(new Date(res.server_time).getTime() - Date.now())).toBeLessThan(60_000);
  });

  it('eski odaları siler, yenileri bırakır', async () => {
    const oldCode = newRoomCode();
    const freshCode = newRoomCode();
    await signInAs(db, newUserId());
    await rpc(db, 'create_room_rpc', { p_code: oldCode, p_name: 'O', p_avatar: '🚀', p_match_questions: null, p_player_id: 'o' });
    await signInAs(db, newUserId());
    await rpc(db, 'create_room_rpc', { p_code: freshCode, p_name: 'F', p_avatar: '🚀', p_match_questions: null, p_player_id: 'f' });
    await db.query("UPDATE public.rooms SET created_at = now() - interval '7 hours' WHERE code = $1", [oldCode]);

    const res = await rpc<{ deleted_count: number }>(db, 'cleanup_stale_rooms_rpc');
    expect(res.deleted_count).toBeGreaterThanOrEqual(1);
    expect(await getRoom(db, oldCode)).toBeUndefined();
    expect(await getRoom(db, freshCode)).toBeDefined();
  });
});

describe('soru havuzu (tüm migration\'lar sonrası)', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it('her soruda 4 benzersiz şık, geçerli doğru cevap ve benzersiz metin var', async () => {
    const rows = (await db.query('SELECT id, question, options, correct_index FROM public.questions')).rows as {
      question: string;
      options: string[];
      correct_index: number;
    }[];
    expect(rows.length).toBeGreaterThanOrEqual(100);
    expect(new Set(rows.map((r) => r.question)).size).toBe(rows.length);
    for (const r of rows) {
      expect(r.options, r.question).toHaveLength(4);
      expect(new Set(r.options).size, r.question).toBe(4);
      expect(r.correct_index).toBeGreaterThanOrEqual(0);
      expect(r.correct_index).toBeLessThanOrEqual(3);
    }
  });
});
