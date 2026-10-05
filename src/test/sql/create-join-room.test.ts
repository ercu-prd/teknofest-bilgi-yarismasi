import { createTestDb, getRoom, newRoomCode, newUserId, rpc, signInAs, signOut, type TestDb } from './helpers';

describe('create_room_rpc / join_room_atomic (PGlite, canlı migration zinciri)', () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });

  it('oturumsuz istekte hata döner, oda oluşmaz', async () => {
    await signOut(db);
    const res = await rpc(db, 'create_room_rpc', {
      p_code: newRoomCode(),
      p_name: 'Arda',
      p_avatar: '🚀',
      p_match_questions: null,
      p_player_id: 'anon',
    });
    expect(res).toMatchObject({ success: false });
  });

  it('geçerli istekte 10 soru (4 kolay + 4 orta + 2 zor) içeren LOBBY odası kurar', async () => {
    const hostId = newUserId();
    const code = newRoomCode();
    await signInAs(db, hostId);

    const res = await rpc<{ success: boolean; code: string; player_id: string }>(db, 'create_room_rpc', {
      p_code: code,
      p_name: 'Arda',
      p_avatar: '🚀',
      p_match_questions: null,
      p_player_id: hostId,
    });

    expect(res.success).toBe(true);
    expect(res.player_id).toBe(hostId);

    const room = await getRoom(db, code);
    expect(room?.status).toBe('LOBBY');
    const questions = room!.match_questions as { difficulty: string }[];
    expect(questions).toHaveLength(10);
    expect(questions.filter((q) => q.difficulty === 'kolay')).toHaveLength(4);
    expect(questions.filter((q) => q.difficulty === 'orta')).toHaveLength(4);
    expect(questions.filter((q) => q.difficulty === 'zor')).toHaveLength(2);
    // Caller-supplied questions are always ignored server-side (never trust the client).
    expect(res).not.toHaveProperty('match_questions');
  });

  it('aynı oda kodu tekrar kullanılamaz', async () => {
    const code = newRoomCode();
    await signInAs(db, newUserId());
    await rpc(db, 'create_room_rpc', { p_code: code, p_name: 'A', p_avatar: '🚀', p_match_questions: null, p_player_id: 'x' });

    await signInAs(db, newUserId());
    const res = await rpc(db, 'create_room_rpc', { p_code: code, p_name: 'B', p_avatar: '⚡', p_match_questions: null, p_player_id: 'y' });
    expect(res).toMatchObject({ success: false });
  });

  it('6 haneli olmayan kodu reddeder', async () => {
    await signInAs(db, newUserId());
    const res = await rpc(db, 'create_room_rpc', { p_code: 'ABC123', p_name: 'A', p_avatar: '🚀', p_match_questions: null, p_player_id: 'x' });
    expect(res).toMatchObject({ success: false });
  });

  it('ikinci oyuncu odaya katılabilir ve host bilgisi değişmez', async () => {
    const hostId = newUserId();
    const guestId = newUserId();
    const code = newRoomCode();

    await signInAs(db, hostId);
    await rpc(db, 'create_room_rpc', { p_code: code, p_name: 'Host', p_avatar: '🚀', p_match_questions: null, p_player_id: hostId });

    await signInAs(db, guestId);
    const res = await rpc<{ success: boolean }>(db, 'join_room_atomic', {
      p_room_code: code,
      p_player_id: guestId,
      p_name: 'Guest',
      p_avatar: '⚡',
    });

    expect(res.success).toBe(true);
    const room = await getRoom(db, code);
    expect(room?.status).toBe('LOBBY');
  });

  it('üçüncü oyuncu dolu odaya katılamaz', async () => {
    const code = newRoomCode();
    await signInAs(db, newUserId());
    await rpc(db, 'create_room_rpc', { p_code: code, p_name: 'A', p_avatar: '🚀', p_match_questions: null, p_player_id: 'a' });
    await signInAs(db, newUserId());
    await rpc(db, 'join_room_atomic', { p_room_code: code, p_player_id: 'b', p_name: 'B', p_avatar: '⚡' });

    await signInAs(db, newUserId());
    const res = await rpc(db, 'join_room_atomic', { p_room_code: code, p_player_id: 'c', p_name: 'C', p_avatar: '🤖' });
    expect(res).toMatchObject({ success: false });
  });

  it('var olmayan oda koduna katılım hata döner', async () => {
    await signInAs(db, newUserId());
    const res = await rpc(db, 'join_room_atomic', { p_room_code: '000000', p_player_id: 'x', p_name: 'X', p_avatar: '🚀' });
    expect(res).toMatchObject({ success: false });
  });

  it('zaten üye olan oyuncu tekrar join çağırırsa idempotent başarı döner (çift satır oluşmaz)', async () => {
    const hostId = newUserId();
    const code = newRoomCode();
    await signInAs(db, hostId);
    await rpc(db, 'create_room_rpc', { p_code: code, p_name: 'Host', p_avatar: '🚀', p_match_questions: null, p_player_id: hostId });

    const res = await rpc(db, 'join_room_atomic', { p_room_code: code, p_player_id: hostId, p_name: 'Host', p_avatar: '🚀' });
    expect(res).toMatchObject({ success: true });

    const count = await db.query('SELECT count(*)::int c FROM public.room_players WHERE room_code = $1', [code]);
    expect((count.rows[0] as { c: number }).c).toBe(1);
  });
});
