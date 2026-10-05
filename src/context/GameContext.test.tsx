import { act, render, waitFor } from '@testing-library/react';
import { GameProvider, useGame } from './GameContext';

type Ctx = ReturnType<typeof useGame>;

const mocks = vi.hoisted(() => {
  const state = {
    configured: true,
    rooms: [] as Record<string, unknown>[],
    players: [] as Record<string, unknown>[],
    rpcResults: {} as Record<string, { data: unknown; error: unknown }>,
    roomsHandler: null as null | ((payload: unknown) => Promise<void> | void),
  };

  const query = (table: string) => {
    const filters: Record<string, unknown> = {};
    const rows = () => {
      const source = table === 'rooms' ? state.rooms : state.players;
      return source.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
    };
    const builder = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return builder;
      },
      order: () => Promise.resolve({ data: rows(), error: null }),
      maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
    };
    return builder;
  };

  const channel = {
    on: vi.fn((_type: string, opts: { table: string }, handler: (p: unknown) => void) => {
      if (opts.table === 'rooms') state.roomsHandler = handler;
      return channel;
    }),
    subscribe: vi.fn(() => channel),
  };

  const supabase = {
    from: vi.fn(query),
    rpc: vi.fn((name: string) =>
      Promise.resolve(state.rpcResults[name] ?? { data: { success: true }, error: null })
    ),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: { user: { id: 'auth-user-1' } } }, error: null })
      ),
      signInAnonymously: vi.fn(() =>
        Promise.resolve({ data: { user: { id: 'auth-user-NEW' } }, error: null })
      ),
    },
  };

  return { state, supabase, channel };
});

vi.mock('../lib/supabase', () => ({
  supabase: mocks.supabase,
  get isSupabaseConfigured() {
    return mocks.state.configured;
  },
  ensureAnonymousSession: vi.fn(async () => (mocks.state.configured ? 'auth-user-1' : null)),
}));

const renderGame = () => {
  const ref: { current: Ctx | null } = { current: null };
  const Probe = () => {
    ref.current = useGame();
    return null;
  };
  render(
    <GameProvider>
      <Probe />
    </GameProvider>
  );
  return () => ref.current!;
};

const hostRow = (overrides: Record<string, unknown> = {}) => ({
  room_code: '123456',
  player_id: 'auth-user-1',
  auth_user_id: 'auth-user-1',
  name: 'Ev',
  avatar: '🚀',
  is_host: true,
  is_ready: false,
  score: 0,
  streak: 0,
  correct_answers: 0,
  current_question_index: 0,
  finished_at: null,
  ...overrides,
});

const guestRow = (overrides: Record<string, unknown> = {}) =>
  hostRow({ player_id: 'auth-user-2', auth_user_id: 'auth-user-2', name: 'Misafir', is_host: false, ...overrides });

const QUESTIONS = [
  { id: 11, category: 'bilim', question: 'S1', options: ['a', 'b', 'c', 'd'] },
  { id: 12, category: 'bilim', question: 'S2', options: ['a', 'b', 'c', 'd'] },
];

beforeEach(() => {
  mocks.state.configured = true;
  mocks.state.rooms = [];
  mocks.state.players = [];
  mocks.state.rpcResults = {};
  mocks.state.roomsHandler = null;
  vi.clearAllMocks();
});

describe('GameContext - yapılandırma yokken', () => {
  it('createRoom açıklayıcı hata verir ve RPC çağırmaz', async () => {
    mocks.state.configured = false;
    const game = renderGame();
    await act(() => game().createRoom('Arda', 'pilot'));
    expect(game().errorMsg).toMatch(/yapılandırılmamış/);
    expect(mocks.supabase.rpc).not.toHaveBeenCalled();
    expect(game().currentScreen).toBe('HOME');
  });
});

describe('GameContext - joinRoom', () => {
  it.each(['12345', '1234567', 'abcdef', '12 456', ''])('geçersiz kodu reddeder: "%s"', async (code) => {
    const game = renderGame();
    await act(() => game().joinRoom(code, 'Arda', 'pilot'));
    expect(game().errorMsg).toMatch(/Geçersiz oda kodu/);
    expect(mocks.supabase.rpc).not.toHaveBeenCalled();
  });

  it('başarılı katılımda LOBBY ekranına geçer ve odaya abone olur', async () => {
    mocks.state.rooms = [{ code: '123456', status: 'LOBBY', match_questions: QUESTIONS }];
    mocks.state.players = [hostRow({ player_id: 'auth-user-2', auth_user_id: 'auth-user-2', name: 'Ev' }), guestRow({ player_id: 'auth-user-1', auth_user_id: 'auth-user-1', name: 'Ben' })];
    mocks.state.rpcResults.join_room_atomic = { data: { success: true, player_id: 'auth-user-1' }, error: null };

    const game = renderGame();
    await act(() => game().joinRoom(' 123456 ', 'Ben', 'ai'));

    expect(mocks.supabase.rpc).toHaveBeenCalledWith('join_room_atomic', {
      p_room_code: '123456',
      p_player_id: 'auth-user-1',
      p_name: 'Ben',
      p_avatar: '🤖',
    });
    expect(game().currentScreen).toBe('LOBBY');
    expect(game().roomCode).toBe('123456');
    expect(game().myPlayer.name).toBe('Ben');
    expect(game().opponentPlayer?.name).toBe('Ev');
    expect(game().questions).toHaveLength(2);
    expect(mocks.supabase.channel).toHaveBeenCalledWith('room_123456');
    expect(sessionStorage.getItem('teknofest_room_code')).toBe('123456');
  });

  it('sunucu "Oda dolu" dönerse hatayı gösterir, ekran değişmez', async () => {
    mocks.state.rpcResults.join_room_atomic = { data: { success: false, error: 'Oda dolu' }, error: null };
    const game = renderGame();
    await act(() => game().joinRoom('123456', 'Ben', 'ai'));
    expect(game().errorMsg).toBe('Oda dolu');
    expect(game().currentScreen).toBe('HOME');
  });
});

describe('GameContext - createRoom', () => {
  it('6 haneli kodla oda kurar ve LOBBY ekranına geçer', async () => {
    const game = renderGame();
    await act(() => game().createRoom('  Arda  ', 'pilot'));

    const call = mocks.supabase.rpc.mock.calls.find(([name]) => name === 'create_room_rpc')!;
    const args = (call as unknown[])[1] as Record<string, unknown>;
    expect(args.p_code).toMatch(/^\d{6}$/);
    expect(args.p_name).toBe('Arda');
    expect(game().currentScreen).toBe('LOBBY');
    expect(game().player1.isHost).toBe(true);
  });

  it('kod çakışmasında hata mesajı gösterir', async () => {
    mocks.state.rpcResults.create_room_rpc = {
      data: { success: false, error: 'Kod kullanılıyor, tekrar deneyin' },
      error: null,
    };
    const game = renderGame();
    await act(() => game().createRoom('Arda', 'pilot'));
    expect(game().errorMsg).toMatch(/Kod kullanılıyor/);
    expect(game().currentScreen).toBe('HOME');
  });

  it('RPC ağ hatasını kullanıcıya iletir', async () => {
    mocks.state.rpcResults.create_room_rpc = { data: null, error: { code: '500', message: 'boom' } };
    const game = renderGame();
    await act(() => game().createRoom('Arda', 'pilot'));
    expect(game().errorMsg).toMatch(/boom/);
  });
});

describe('GameContext - maç akışı', () => {
  const joinActiveRoom = async () => {
    mocks.state.rooms = [{ code: '123456', status: 'LOBBY', match_questions: QUESTIONS }];
    mocks.state.players = [hostRow(), guestRow()];
    mocks.state.rpcResults.join_room_atomic = { data: { success: true, player_id: 'auth-user-1' }, error: null };
    const game = renderGame();
    await act(() => game().joinRoom('123456', 'Ev', 'pilot'));
    return game;
  };

  it('answerQuestion sunucu sonucunu döndürür', async () => {
    const game = await joinActiveRoom();
    mocks.state.rpcResults.submit_answer_rpc = {
      data: { success: true, is_correct: true, correct_index: 2, points_added: 140, match_finished: false },
      error: null,
    };
    let res: Awaited<ReturnType<Ctx['answerQuestion']>>;
    await act(async () => {
      res = await game().answerQuestion(2);
    });
    expect(mocks.supabase.rpc).toHaveBeenCalledWith('submit_answer_rpc', {
      p_room_code: '123456',
      p_player_id: 'auth-user-1',
      p_question_id: 11,
      p_selected_option_index: 2,
    });
    expect(res!).toEqual({ success: true, isCorrect: true, correctIndex: 2, pointsAdded: 140, matchFinished: false });
  });

  it('answerQuestion sunucu reddinde success:false döner', async () => {
    const game = await joinActiveRoom();
    mocks.state.rpcResults.submit_answer_rpc = { data: { success: false, error: 'Maç süresi bitti' }, error: null };
    let res: Awaited<ReturnType<Ctx['answerQuestion']>>;
    await act(async () => {
      res = await game().answerQuestion(0);
    });
    expect(res!).toEqual({ success: false, error: 'Maç süresi bitti' });
  });

  it('advanceQuestionIndex son sorudan öteye geçmez', async () => {
    const game = await joinActiveRoom();
    act(() => game().advanceQuestionIndex());
    act(() => game().advanceQuestionIndex());
    act(() => game().advanceQuestionIndex());
    expect(game().currentQuestionIndex).toBe(1);
  });

  it('finishQuiz sunucu reddederse RESULT ekranına geçmez ve hata gösterir', async () => {
    const game = await joinActiveRoom();
    mocks.state.rpcResults.finish_room_rpc = { data: { success: false, error: 'Maç henüz tamamlanmadı' }, error: null };
    await act(() => game().finishQuiz());
    expect(game().currentScreen).toBe('LOBBY');
    expect(game().errorMsg).toBe('Maç henüz tamamlanmadı');
  });

  it('finishQuiz başarılıysa skorlara göre kazananı belirler', async () => {
    const game = await joinActiveRoom();
    mocks.state.players = [hostRow({ score: 300 }), guestRow({ score: 450 })];
    await act(() => game().finishQuiz());
    expect(game().currentScreen).toBe('RESULT');
    expect(game().winner?.name).toBe('Misafir');
    expect(game().isDraw).toBe(false);
  });

  it('eşit skorda beraberlik verir', async () => {
    const game = await joinActiveRoom();
    mocks.state.players = [hostRow({ score: 200 }), guestRow({ score: 200 })];
    await act(() => game().finishQuiz());
    expect(game().isDraw).toBe(true);
    expect(game().winner).toBeNull();
  });

  it('finishQuiz eşzamanlı çağrıldığında RPC yalnızca bir kez gider', async () => {
    const game = await joinActiveRoom();
    await act(async () => {
      await Promise.all([game().finishQuiz(), game().finishQuiz(), game().finishQuiz()]);
    });
    const calls = mocks.supabase.rpc.mock.calls.filter(([name]) => name === 'finish_room_rpc');
    expect(calls).toHaveLength(1);
  });

  it('realtime ile oda durumu VS olunca VS ekranına geçer', async () => {
    const game = await joinActiveRoom();
    const startedAt = new Date(Date.now() + 3000).toISOString();
    await act(async () => {
      await mocks.state.roomsHandler!({ new: { code: '123456', status: 'VS', started_at: startedAt } });
    });
    expect(game().currentScreen).toBe('VS');
    expect(game().matchStartTime).toBe(new Date(startedAt).getTime());
  });

  it('realtime ile oda LOBBY olunca soru indeksi sıfırlanır', async () => {
    const game = await joinActiveRoom();
    act(() => game().advanceQuestionIndex());
    await act(async () => {
      await mocks.state.roomsHandler!({ new: { code: '123456', status: 'LOBBY', started_at: null } });
    });
    expect(game().currentScreen).toBe('LOBBY');
    expect(game().currentQuestionIndex).toBe(0);
  });
});

describe('GameContext - BİLİNEN HATALAR (düzeltilince it.fails -> it yapın)', () => {
  // GameContext.tsx:83-94 — her açılışta koşulsuz signInAnonymously() çağrılıyor.
  // Supabase bu çağrıda YENİ bir anonim kullanıcı oluşturur; sayfa yenilenince
  // auth.uid() değişir ve oyuncu kendi odasının üyesi olmaktan çıkar.
  it.fails('mevcut oturum varken yeni anonim kullanıcı oluşturmamalı', async () => {
    renderGame();
    await waitFor(() => expect(mocks.supabase.auth.getSession).toHaveBeenCalled());
    expect(mocks.supabase.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  // LobbyScreen "Ana Menü" sadece setScreen('HOME') yapıyor: oyuncu satırı odada
  // kalıyor, realtime aboneliği ve sessionStorage temizlenmiyor.
  it.fails('lobiden ana menüye dönünce oda aboneliği bırakılmalı', async () => {
    mocks.state.rooms = [{ code: '123456', status: 'LOBBY', match_questions: QUESTIONS }];
    mocks.state.players = [hostRow(), guestRow()];
    mocks.state.rpcResults.join_room_atomic = { data: { success: true, player_id: 'auth-user-1' }, error: null };
    const game = renderGame();
    await act(() => game().joinRoom('123456', 'Ev', 'pilot'));
    act(() => game().setScreen('HOME'));
    expect(mocks.supabase.removeChannel).toHaveBeenCalled();
    expect(sessionStorage.getItem('teknofest_room_code')).toBeNull();
  });
});
