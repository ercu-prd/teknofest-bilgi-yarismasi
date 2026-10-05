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

describe('set_player_ready_and_check_start', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it('odanın üyesi olmayan biri ready gönderemez', async () => {
    const code = newRoomCode();
    await signInAs(db, newUserId());
    await rpc(db, 'create_room_rpc', { p_code: code, p_name: 'A', p_avatar: '🚀', p_match_questions: null, p_player_id: 'a' });

    await signInAs(db, newUserId());
    const res = await rpc(db, 'set_player_ready_and_check_start', { p_room_code: code, p_player_id: 'intruder', p_ready_state: true });
    expect(res).toMatchObject({ success: false });
  });

  it('sadece bir oyuncu hazırsa maç başlamaz', async () => {
    const hostId = newUserId();
    const code = newRoomCode();
    await signInAs(db, hostId);
    await rpc(db, 'create_room_rpc', { p_code: code, p_name: 'Host', p_avatar: '🚀', p_match_questions: null, p_player_id: hostId });
    await signInAs(db, newUserId());
    await rpc(db, 'join_room_atomic', { p_room_code: code, p_player_id: 'guest', p_name: 'Guest', p_avatar: '⚡' });

    await signInAs(db, hostId);
    const res = await rpc<{ match_started: boolean; status: string }>(db, 'set_player_ready_and_check_start', {
      p_room_code: code,
      p_player_id: hostId,
      p_ready_state: true,
    });
    expect(res.match_started).toBe(false);
    expect(res.status).toBe('LOBBY');
  });

  it('iki oyuncu da hazır olunca maç başlar ve started_at ileride bir zaman olur', async () => {
    const hostId = newUserId();
    const guestId = newUserId();
    const code = newRoomCode();
    await signInAs(db, hostId);
    await rpc(db, 'create_room_rpc', { p_code: code, p_name: 'Host', p_avatar: '🚀', p_match_questions: null, p_player_id: hostId });
    await signInAs(db, guestId);
    await rpc(db, 'join_room_atomic', { p_room_code: code, p_player_id: guestId, p_name: 'Guest', p_avatar: '⚡' });

    await signInAs(db, hostId);
    await rpc(db, 'set_player_ready_and_check_start', { p_room_code: code, p_player_id: hostId, p_ready_state: true });
    await signInAs(db, guestId);
    const res = await rpc<{ match_started: boolean; status: string }>(db, 'set_player_ready_and_check_start', {
      p_room_code: code,
      p_player_id: guestId,
      p_ready_state: true,
    });

    expect(res.match_started).toBe(true);
    expect(res.status).toBe('VS');
    const room = await getRoom(db, code);
    expect(room?.status).toBe('VS');
    expect(new Date(room!.started_at as string).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('submit_answer_rpc', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it('doğru cevap 100-150 arası puan verir ve index ilerletir', async () => {
    const { code, hostId, questions } = await createActiveMatch(db);
    const q = questions[0];
    const correctOpt = (await db.query('SELECT correct_index FROM public.questions WHERE id = $1', [q.id])).rows[0] as {
      correct_index: number;
    };

    await signInAs(db, hostId);
    const res = await rpc<{ success: boolean; is_correct: boolean; points_added: number; next_question_index: number }>(
      db,
      'submit_answer_rpc',
      { p_room_code: code, p_player_id: hostId, p_question_id: q.id, p_selected_option_index: correctOpt.correct_index }
    );

    expect(res.success).toBe(true);
    expect(res.is_correct).toBe(true);
    expect(res.points_added).toBeGreaterThanOrEqual(100);
    expect(res.points_added).toBeLessThanOrEqual(150);
    expect(res.next_question_index).toBe(1);

    const player = await getPlayer(db, code, hostId);
    expect(player?.current_question_index).toBe(1);
    expect(player?.score).toBe(res.points_added);
  });

  it('yanlış cevap 0 puan verir ve streak sıfırlanır', async () => {
    const { code, hostId, questions } = await createActiveMatch(db);
    const q = questions[0];
    const correctOpt = (await db.query('SELECT correct_index FROM public.questions WHERE id = $1', [q.id])).rows[0] as {
      correct_index: number;
    };
    const wrongOpt = (correctOpt.correct_index + 1) % 4;

    await signInAs(db, hostId);
    const res = await rpc<{ is_correct: boolean; points_added: number }>(db, 'submit_answer_rpc', {
      p_room_code: code,
      p_player_id: hostId,
      p_question_id: q.id,
      p_selected_option_index: wrongOpt,
    });

    expect(res.is_correct).toBe(false);
    expect(res.points_added).toBe(0);
  });

  it('geçersiz şık indeksini reddeder', async () => {
    const { code, hostId, questions } = await createActiveMatch(db);
    await signInAs(db, hostId);
    const res = await rpc(db, 'submit_answer_rpc', {
      p_room_code: code,
      p_player_id: hostId,
      p_question_id: questions[0].id,
      p_selected_option_index: 7,
    });
    expect(res).toMatchObject({ success: false });
  });

  it('o oyuncunun sırası gelmemiş bir soru id\'si reddedilir', async () => {
    const { code, hostId, questions } = await createActiveMatch(db);
    await signInAs(db, hostId);
    const res = await rpc(db, 'submit_answer_rpc', {
      p_room_code: code,
      p_player_id: hostId,
      p_question_id: questions[1].id, // henüz 0. index'teyken 1. soruyu cevaplamaya çalışıyor
      p_selected_option_index: 0,
    });
    expect(res).toMatchObject({ success: false });
  });

  it('aynı soru tekrar gönderilirse puan tekrar eklenmez (idempotent)', async () => {
    const { code, hostId, questions } = await createActiveMatch(db);
    const q = questions[0];
    await signInAs(db, hostId);

    const first = await rpc<{ points_added: number }>(db, 'submit_answer_rpc', {
      p_room_code: code,
      p_player_id: hostId,
      p_question_id: q.id,
      p_selected_option_index: 0,
    });
    const second = await rpc<{ success: boolean; already_answered: boolean; points_added: number }>(
      db,
      'submit_answer_rpc',
      { p_room_code: code, p_player_id: hostId, p_question_id: q.id, p_selected_option_index: 0 }
    );

    expect(second.success).toBe(true);
    expect(second.already_answered).toBe(true);
    expect(second.points_added).toBe(0);

    const player = await getPlayer(db, code, hostId);
    expect(player?.score).toBe(first.points_added);
  });

  it('odanın üyesi olmayan biri cevap gönderemez', async () => {
    const { code } = await createActiveMatch(db);
    await signInAs(db, newUserId());
    const res = await rpc(db, 'submit_answer_rpc', { p_room_code: code, p_player_id: 'intruder', p_question_id: 1, p_selected_option_index: 0 });
    expect(res).toMatchObject({ success: false });
  });

  it('90 saniye dolunca cevabı reddeder ve odayı RESULT yapar', async () => {
    const { code, hostId, questions } = await createActiveMatch(db);
    await db.query("UPDATE public.rooms SET started_at = now() - interval '91 seconds' WHERE code = $1", [code]);

    await signInAs(db, hostId);
    const res = await rpc(db, 'submit_answer_rpc', {
      p_room_code: code,
      p_player_id: hostId,
      p_question_id: questions[0].id,
      p_selected_option_index: 0,
    });
    expect(res).toMatchObject({ success: false });

    const room = await getRoom(db, code);
    expect(room?.status).toBe('RESULT');
  });

  it('iki oyuncu da son soruyu cevaplayınca match_finished true döner', async () => {
    const { code, hostId, guestId, questions } = await createActiveMatch(db);
    // Son soru hariç hepsini her iki oyuncu için de hızlıca geçelim.
    for (const player of [hostId, guestId]) {
      await signInAs(db, player);
      for (let i = 0; i < questions.length - 1; i++) {
        await rpc(db, 'submit_answer_rpc', {
          p_room_code: code,
          p_player_id: player,
          p_question_id: questions[i].id,
          p_selected_option_index: 0,
        });
      }
    }

    await signInAs(db, hostId);
    const hostLast = await rpc<{ match_finished: boolean }>(db, 'submit_answer_rpc', {
      p_room_code: code,
      p_player_id: hostId,
      p_question_id: questions[questions.length - 1].id,
      p_selected_option_index: 0,
    });
    expect(hostLast.match_finished).toBe(false);

    await signInAs(db, guestId);
    const guestLast = await rpc<{ match_finished: boolean }>(db, 'submit_answer_rpc', {
      p_room_code: code,
      p_player_id: guestId,
      p_question_id: questions[questions.length - 1].id,
      p_selected_option_index: 0,
    });
    expect(guestLast.match_finished).toBe(true);
  });
});
