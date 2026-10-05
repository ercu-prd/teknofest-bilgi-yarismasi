import { act, render, waitFor } from '@testing-library/react';
import { GameProvider, useGame } from './GameContext';

type Ctx = ReturnType<typeof useGame>;

const mocks = vi.hoisted(() => {
  const state = {
    configured: true,
    rooms: [] as Record<string, unknown>[],
    players: [] as Record<string, unknown>[],
    rpcResults: {} as Record<string, { data: unknown; error: unknown }>,
    handlers: [] as (() => void)[],
    statusCb: null as null | ((status: string) => void),
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
    on: vi.fn((_type: string, _opts: unknown, handler: () => void) => {
      state.handlers.push(handler);
      return channel;
    }),
    subscribe: vi.fn((cb: (status: string) => void) => {
      state.statusCb = cb;
      return channel;
    }),
  };

  const supabase = {
    from: vi.fn(query),
    rpc: vi.fn((name: string, _args?: unknown) =>
      Promise.resolve(state.rpcResults[name] ?? { data: { success: true }, error: null })
    ),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
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
    // oxlint-disable-next-line react/immutability -- test probe captures the context value
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

const room = (overrides: Record<string, unknown> = {}) => ({
  code: '123456',
  status: 'LOBBY',
  match_no: 1,
  started_at: null,
  match_questions: QUESTIONS,
  ...overrides,
});

const rpcCalls = (name: string) => mocks.supabase.rpc.mock.calls.filter(([n]) => n === name);
const fireRealtime = async () => {
  await act(async () => {
    mocks.state.handlers.forEach((h) => h());
  });
};

beforeEach(() => {
  mocks.state.configured = true;
  mocks.state.rooms = [];
  mocks.state.players = [];
  mocks.state.rpcResults = {};
  mocks.state.handlers = [];
  mocks.state.statusCb = null;
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

describe('GameContext - açılış', () => {
  it('sunucu saatini ve ayarlarını alır', async () => {
    mocks.state.rpcResults.get_server_time_rpc = {
      data: {
        success: true,
        server_time: new Date().toISOString(),
        settings: { match_seconds: 60, question_count: 8, countdown_seconds: 5 },
      },
      error: null,
    };
    const game = renderGame();
    await waitFor(() => expect(game().settings).toEqual({ matchSeconds: 60, questionCount: 8, countdownSeconds: 5 }));
  });

  it('sayfa yenilenince kayıtlı odaya geri döner ve kaldığı sorudan devam eder', async () => {
    sessionStorage.setItem('teknofest_room_code', '123456');
    mocks.state.rooms = [room({ status: 'VS', started_at: new Date(Date.now() - 20_000).toISOString() })];
    mocks.state.players = [hostRow({ current_question_index: 1 }), guestRow()];

    const game = renderGame();
    await waitFor(() => expect(game().currentScreen).toBe('VS'));
    expect(game().roomCode).toBe('123456');
    expect(game().myPlayerId).toBe('auth-user-1');
    expect(game().currentQuestionIndex).toBe(1);
    expect(mocks.supabase.channel).toHaveBeenCalledWith('room_123456');
  });

  it('kayıtlı oda artık yoksa ana ekranda kalır ve kaydı temizler', async () => {
    sessionStorage.setItem('teknofest_room_code', '654321');
    const game = renderGame();
    await waitFor(() => expect(game().errorMsg).toMatch(/mevcut değil/));
    expect(game().currentScreen).toBe('HOME');
    expect(sessionStorage.getItem('teknofest_room_code')).toBeNull();
  });
});

describe('GameContext - joinRoom', () => {
  it.each(['12345', '1234567', 'abcdef', '12 456', ''])('geçersiz kodu reddeder: "%s"', async (code) => {
    const game = renderGame();
    await act(() => game().joinRoom(code, 'Arda', 'pilot'));
    expect(game().errorMsg).toMatch(/Geçersiz oda kodu/);
    expect(rpcCalls('join_room_atomic')).toHaveLength(0);
  });

  it('başarılı katılımda LOBBY ekranına geçer ve odaya abone olur', async () => {
    mocks.state.rooms = [room()];
    mocks.state.players = [
      hostRow({ player_id: 'auth-user-2', auth_user_id: 'auth-user-2', name: 'Ev' }),
      guestRow({ player_id: 'auth-user-1', auth_user_id: 'auth-user-1', name: 'Ben' }),
    ];
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
    expect(game().myPlayer.name).toBe('Ben');
    expect(game().opponentPlayer?.name).toBe('Ev');
    expect(game().questions).toHaveLength(2);
    expect(sessionStorage.getItem('teknofest_room_code')).toBe('123456');
  });

  it('isim 16 karakterle sınırlanır', async () => {
    mocks.state.rooms = [room()];
    mocks.state.players = [hostRow()];
    mocks.state.rpcResults.join_room_atomic = { data: { success: true }, error: null };
    const game = renderGame();
    await act(() => game().joinRoom('123456', 'Çok Uzun Bir Oyuncu Adı', 'pilot'));
    const args = rpcCalls('join_room_atomic')[0][1] as { p_name: string };
    expect(args.p_name).toHaveLength(16);
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
  it('oda kodunu sunucuya ürettirir ve LOBBY ekranına geçer', async () => {
    mocks.state.rooms = [room()];
    mocks.state.players = [hostRow({ name: 'Arda' })];
    mocks.state.rpcResults.create_room_rpc = { data: { success: true, code: '123456', player_id: 'auth-user-1' }, error: null };

    const game = renderGame();
    await act(() => game().createRoom('  Arda  ', 'pilot'));

    const args = rpcCalls('create_room_rpc')[0][1] as Record<string, unknown>;
    expect(args.p_code).toBeNull();
    expect(args.p_name).toBe('Arda');
    expect(game().roomCode).toBe('123456');
    expect(game().currentScreen).toBe('LOBBY');
    expect(game().player1.isHost).toBe(true);
  });

  it('sunucu hatasını kullanıcıya iletir', async () => {
    mocks.state.rpcResults.create_room_rpc = { data: { success: false, error: 'Yeterli soru bulunamadı' }, error: null };
    const game = renderGame();
    await act(() => game().createRoom('Arda', 'pilot'));
    expect(game().errorMsg).toMatch(/Yeterli soru/);
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
    mocks.state.rooms = [room()];
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
    let res: Awaited<ReturnType<Ctx['answerQuestion']>> | undefined;
    await act(async () => {
      res = await game().answerQuestion(2);
    });
    expect(mocks.supabase.rpc).toHaveBeenCalledWith('submit_answer_rpc', {
      p_room_code: '123456',
      p_player_id: 'auth-user-1',
      p_question_id: 11,
      p_selected_option_index: 2,
    });
    expect(res).toEqual({ success: true, isCorrect: true, correctIndex: 2, pointsAdded: 140, matchFinished: false });
  });

  it('answerQuestion sunucu reddinde success:false döner', async () => {
    const game = await joinActiveRoom();
    mocks.state.rpcResults.submit_answer_rpc = { data: { success: false, error: 'Maç süresi bitti' }, error: null };
    let res: Awaited<ReturnType<Ctx['answerQuestion']>> | undefined;
    await act(async () => {
      res = await game().answerQuestion(0);
    });
    expect(res).toEqual({ success: false, error: 'Maç süresi bitti' });
  });

  it('advanceQuestionIndex son sorudan öteye geçmez', async () => {
    const game = await joinActiveRoom();
    act(() => game().advanceQuestionIndex());
    act(() => game().advanceQuestionIndex());
    act(() => game().advanceQuestionIndex());
    expect(game().currentQuestionIndex).toBe(1);
  });

  it('"Maç henüz tamamlanmadı" yanıtı kullanıcıya hata olarak gösterilmez', async () => {
    const game = await joinActiveRoom();
    mocks.state.rpcResults.finish_room_rpc = { data: { success: false, error: 'Maç henüz tamamlanmadı' }, error: null };
    await act(() => game().finishQuiz());
    expect(game().errorMsg).toBeNull();
    // Tekrar denenebilir olmalı.
    await act(() => game().finishQuiz());
    expect(rpcCalls('finish_room_rpc')).toHaveLength(2);
  });

  it('beklenmeyen bitirme hatası gösterilir', async () => {
    const game = await joinActiveRoom();
    mocks.state.rpcResults.finish_room_rpc = { data: { success: false, error: 'Bu odanın oyuncusu değilsin' }, error: null };
    await act(() => game().finishQuiz());
    expect(game().errorMsg).toBe('Bu odanın oyuncusu değilsin');
  });

  it('finishQuiz başarılıysa skorlara göre kazananı belirler', async () => {
    const game = await joinActiveRoom();
    mocks.state.rooms = [room({ status: 'RESULT' })];
    mocks.state.players = [hostRow({ score: 300 }), guestRow({ score: 450 })];
    await act(() => game().finishQuiz());
    expect(game().currentScreen).toBe('RESULT');
    expect(game().winner?.name).toBe('Misafir');
    expect(game().isDraw).toBe(false);
  });

  it('eşit skorda beraberlik verir', async () => {
    const game = await joinActiveRoom();
    mocks.state.rooms = [room({ status: 'RESULT' })];
    mocks.state.players = [hostRow({ score: 200 }), guestRow({ score: 200 })];
    await act(() => game().finishQuiz());
    expect(game().isDraw).toBe(true);
    expect(game().winner).toBeNull();
  });

  it('rakip ayrılırsa kalan oyuncu kazanır', async () => {
    const game = await joinActiveRoom();
    mocks.state.rooms = [room({ status: 'RESULT' })];
    mocks.state.players = [hostRow({ score: 0 })];
    await fireRealtime();
    expect(game().currentScreen).toBe('RESULT');
    expect(game().winner?.id).toBe('auth-user-1');
  });

  it('finishQuiz eşzamanlı çağrıldığında RPC yalnızca bir kez gider', async () => {
    const game = await joinActiveRoom();
    await act(async () => {
      await Promise.all([game().finishQuiz(), game().finishQuiz(), game().finishQuiz()]);
    });
    expect(rpcCalls('finish_room_rpc')).toHaveLength(1);
  });

  it('realtime olayında oda VS olunca VS ekranına geçer', async () => {
    const game = await joinActiveRoom();
    const startedAt = new Date(Date.now() + 3000).toISOString();
    mocks.state.rooms = [room({ status: 'VS', started_at: startedAt })];
    await fireRealtime();
    expect(game().currentScreen).toBe('VS');
    expect(game().matchStartTime).toBe(new Date(startedAt).getTime());
  });

  it('rövanşta (yeni match_no) soru indeksi sıfırlanır', async () => {
    const game = await joinActiveRoom();
    act(() => game().advanceQuestionIndex());
    mocks.state.rooms = [room({ status: 'VS', match_no: 2, started_at: new Date().toISOString() })];
    await fireRealtime();
    expect(game().currentScreen).toBe('VS');
    expect(game().currentQuestionIndex).toBe(0);
  });

  it('bağlantı koptuktan sonra yeniden abone olunca durumu yeniden çeker', async () => {
    const game = await joinActiveRoom();
    act(() => mocks.state.statusCb!('SUBSCRIBED'));
    expect(game().connectionStatus).toBe('connected');

    act(() => mocks.state.statusCb!('CHANNEL_ERROR'));
    expect(game().connectionStatus).toBe('reconnecting');

    mocks.state.rooms = [room({ status: 'RESULT' })];
    await act(async () => mocks.state.statusCb!('SUBSCRIBED'));
    await waitFor(() => expect(game().currentScreen).toBe('RESULT'));
    expect(game().connectionStatus).toBe('connected');
  });

  it('sekme tekrar görünür olunca durumu yeniden çeker', async () => {
    const game = await joinActiveRoom();
    mocks.state.rooms = [room({ status: 'RESULT' })];
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(game().currentScreen).toBe('RESULT'));
  });

  it('odadayken kalp atışı gönderir', async () => {
    await joinActiveRoom();
    await waitFor(() => expect(rpcCalls('heartbeat_rpc').length).toBeGreaterThan(0));
    expect(rpcCalls('heartbeat_rpc')[0][1]).toEqual({ p_room_code: '123456' });
  });

  it('rövanş isteği sunucuya iletilir', async () => {
    const game = await joinActiveRoom();
    await act(() => game().requestRematch());
    expect(mocks.supabase.rpc).toHaveBeenCalledWith('request_rematch_rpc', { p_room_code: '123456', p_want: true });
  });
});

describe('GameContext - odadan çıkış', () => {
  it('ana menüye dönünce sunucuda koltuk bırakılır, abonelik ve kayıt temizlenir', async () => {
    mocks.state.rooms = [room()];
    mocks.state.players = [hostRow(), guestRow()];
    mocks.state.rpcResults.join_room_atomic = { data: { success: true, player_id: 'auth-user-1' }, error: null };
    const game = renderGame();
    await act(() => game().joinRoom('123456', 'Ev', 'pilot'));

    await act(() => game().leaveRoom());

    expect(mocks.supabase.rpc).toHaveBeenCalledWith('leave_room_rpc', { p_room_code: '123456' });
    expect(mocks.supabase.removeChannel).toHaveBeenCalled();
    expect(sessionStorage.getItem('teknofest_room_code')).toBeNull();
    expect(game().currentScreen).toBe('HOME');
    expect(game().roomCode).toBe('');
    expect(game().player2).toBeNull();
  });
});

describe('GameContext - hızlı eşleşme', () => {
  it('eşleşme bulunana kadar bekler, sonra odaya girer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mocks.state.rpcResults.quick_match_rpc = { data: { success: true, status: 'WAITING' }, error: null };
      const game = renderGame();
      await act(() => game().startQuickMatch('Arda', 'pilot'));
      expect(game().currentScreen).toBe('MATCHMAKING');

      mocks.state.rooms = [room({ code: '777777' })];
      mocks.state.players = [hostRow({ room_code: '777777' }), guestRow({ room_code: '777777' })];
      mocks.state.rpcResults.quick_match_rpc = { data: { success: true, status: 'MATCHED', room_code: '777777' }, error: null };
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100);
      });

      await waitFor(() => expect(game().currentScreen).toBe('LOBBY'));
      expect(game().roomCode).toBe('777777');
    } finally {
      vi.useRealTimers();
    }
  });

  it('iptal edilince kuyruktan çıkar', async () => {
    mocks.state.rpcResults.quick_match_rpc = { data: { success: true, status: 'WAITING' }, error: null };
    const game = renderGame();
    await act(() => game().startQuickMatch('Arda', 'pilot'));
    await act(() => game().cancelQuickMatch());
    expect(rpcCalls('cancel_quick_match_rpc')).toHaveLength(1);
    expect(game().currentScreen).toBe('HOME');
  });
});
