import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TournamentScreen } from './TournamentScreen';
import type { TournamentData, TournamentMatch } from '../tournament/types';

const game = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const rpc = vi.hoisted(() => vi.fn());
const confettiMock = vi.hoisted(() => vi.fn());

vi.mock('../../context/GameContext', () => ({ useGame: () => game.value }));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc }, isSupabaseConfigured: true }));
vi.mock('canvas-confetti', () => ({ default: confettiMock }));
vi.mock('../ui/RoomQrCode', () => ({
  RoomQrCode: ({ url }: { url: string }) => <div data-testid="qr">{url}</div>,
}));

const setup = (overrides: Record<string, unknown> = {}) => {
  const fns = {
    openTournament: vi.fn(),
    enterRoom: vi.fn().mockResolvedValue(true),
    clearError: vi.fn(),
    setScreen: vi.fn(),
  };
  game.value = {
    player1: { id: 'me', name: 'Arda', avatar: '🚀', isHost: true, isReady: false, score: 0, correctAnswers: 0 },
    activeTournamentCode: null,
    errorMsg: null,
    ...fns,
    ...overrides,
  };
  const utils = render(<TournamentScreen />);
  return { ...fns, ...utils };
};

const side = (name: string, is_me = false) => ({ name, avatar: '🤖', is_me });

const tournamentData = (over: Partial<TournamentData['tournament']> = {}, rest: Partial<TournamentData> = {}) => ({
  success: true,
  tournament: {
    code: '123456',
    name: 'Tekno Kupa',
    size: 4,
    status: 'REGISTRATION',
    rounds: 2,
    is_organizer: false,
    am_registered: false,
    champion: null,
    ...over,
  },
  players: [
    { name: 'Arda', avatar: '🚀', is_me: true, eliminated: false },
    { name: 'Ece', avatar: '🤖', is_me: false, eliminated: false },
  ],
  matches: [] as TournamentMatch[],
  my_room_code: null,
  ...rest,
});

const ok = (data: unknown) => Promise.resolve({ data, error: null });

beforeEach(() => {
  rpc.mockReset();
  confettiMock.mockReset();
});

describe('TournamentScreen — giriş görünümü', () => {
  it('turnuva oluşturur ve doğru RPC parametrelerini gönderir', async () => {
    rpc.mockReturnValue(ok({ success: true, code: '654321' }));
    const { openTournament } = setup();

    fireEvent.change(screen.getByLabelText('Turnuva adı'), { target: { value: '  Final Kupası ' } });
    fireEvent.click(screen.getByRole('button', { name: '8 oyuncu' }));
    fireEvent.click(screen.getByLabelText('Ben de oynayacağım'));
    fireEvent.click(screen.getByRole('button', { name: /Turnuva oluştur/ }));

    await waitFor(() => expect(openTournament).toHaveBeenCalledWith('654321'));
    expect(rpc).toHaveBeenCalledWith('create_tournament_rpc', {
      p_name: 'Final Kupası',
      p_size: 8,
      p_player_name: 'Arda',
      p_avatar: '🚀',
      p_join: false,
    });
  });

  it('kısa turnuva adında RPC çağırmaz ve uyarır', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Turnuva adı'), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: /Turnuva oluştur/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('3-40 karakter');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('kodla katılır', async () => {
    rpc.mockReturnValue(ok({ success: true }));
    const { openTournament } = setup();
    fireEvent.change(screen.getByLabelText('Turnuva kodu'), { target: { value: '112233' } });
    fireEvent.click(screen.getByRole('button', { name: /Turnuvaya katıl/ }));
    await waitFor(() => expect(openTournament).toHaveBeenCalledWith('112233'));
    expect(rpc).toHaveBeenCalledWith('join_tournament_rpc', { p_code: '112233', p_name: 'Arda', p_avatar: '🚀' });
  });

  it('geçersiz kodda uyarır', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Turnuva kodu'), { target: { value: '12a3' } });
    fireEvent.click(screen.getByRole('button', { name: /Turnuvaya katıl/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('6 haneli');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('RPC hatasını gösterir', async () => {
    rpc.mockReturnValue(ok({ success: false, error: 'Turnuva dolu' }));
    const { openTournament } = setup();
    fireEvent.change(screen.getByLabelText('Turnuva kodu'), { target: { value: '112233' } });
    fireEvent.click(screen.getByRole('button', { name: /Turnuvaya katıl/ }));
    expect(await screen.findByText('Turnuva dolu')).toBeInTheDocument();
    expect(openTournament).not.toHaveBeenCalled();
  });

  it('oyuncu adı boşsa uyarır', () => {
    setup({ player1: { id: '', name: '  ', avatar: '🚀', isHost: true, isReady: false, score: 0, correctAnswers: 0 } });
    fireEvent.change(screen.getByLabelText('Turnuva kodu'), { target: { value: '112233' } });
    fireEvent.click(screen.getByRole('button', { name: /Turnuvaya katıl/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('takma ad');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('Ana menü butonu openTournament(null) çağırır', () => {
    const { openTournament } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Ana menü/ }));
    expect(openTournament).toHaveBeenCalledWith(null);
  });
});

describe('TournamentScreen — kayıt görünümü', () => {
  it('kod, QR, oyuncu listesi ve organizer için disabled başlat butonu', async () => {
    rpc.mockReturnValue(ok(tournamentData({ is_organizer: true, am_registered: true })));
    setup({ activeTournamentCode: '123456' });

    expect(await screen.findByTestId('tournament-code')).toHaveTextContent('123456');
    expect(rpc).toHaveBeenCalledWith('get_tournament_rpc', { p_code: '123456' });
    expect(screen.getByTestId('qr')).toHaveTextContent('tournament=123456');
    expect(screen.getByTestId('player-count')).toHaveTextContent('2/4');
    expect(screen.getByText('Ece')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Turnuvayı başlat/ })).toBeDisabled();
    expect(screen.getByText('2 oyuncu daha bekleniyor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ayrıl/ })).toBeInTheDocument();
  });

  it('dolunca başlat butonu aktif olur ve start_tournament_rpc çağrılır', async () => {
    const full = tournamentData(
      { is_organizer: true, am_registered: true },
      {
        players: ['Arda', 'Ece', 'Can', 'Su'].map((name, i) => ({ name, avatar: '🚀', is_me: i === 0, eliminated: false })),
      }
    );
    rpc.mockImplementation((fn: string) => ok(fn === 'get_tournament_rpc' ? full : { success: true }));
    setup({ activeTournamentCode: '123456' });

    const start = await screen.findByRole('button', { name: /Turnuvayı başlat/ });
    expect(start).toBeEnabled();
    fireEvent.click(start);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('start_tournament_rpc', { p_code: '123456' }));
  });

  it('kayıtlı değilsem Katıl, organizer değilsem başlat butonu yok', async () => {
    rpc.mockImplementation((fn: string) => ok(fn === 'get_tournament_rpc' ? tournamentData() : { success: true }));
    setup({ activeTournamentCode: '123456' });
    const join = await screen.findByRole('button', { name: /^Katıl$/ });
    expect(screen.queryByRole('button', { name: /Turnuvayı başlat/ })).not.toBeInTheDocument();
    fireEvent.click(join);
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('join_tournament_rpc', { p_code: '123456', p_name: 'Arda', p_avatar: '🚀' })
    );
  });

  it('Ayrıl → leave_tournament_rpc sonra openTournament(null)', async () => {
    rpc.mockImplementation((fn: string) =>
      ok(fn === 'get_tournament_rpc' ? tournamentData({ am_registered: true }) : { success: true })
    );
    const { openTournament } = setup({ activeTournamentCode: '123456' });
    fireEvent.click(await screen.findByRole('button', { name: /Ayrıl/ }));
    await waitFor(() => expect(openTournament).toHaveBeenCalledWith(null));
    expect(rpc).toHaveBeenCalledWith('leave_tournament_rpc', { p_code: '123456' });
  });
});

describe('TournamentScreen — polling', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  const flush = () => act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

  it('3 sn de bir yeniler, gizli sekmede atlar ve unmount sonrası durur', async () => {
    rpc.mockReturnValue(ok(tournamentData()));
    const { unmount } = setup({ activeTournamentCode: '123456' });
    await flush();
    expect(rpc).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(rpc).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(rpc).toHaveBeenCalledTimes(2);
    Reflect.deleteProperty(document, 'visibilityState');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(rpc).toHaveBeenCalledTimes(3);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it('turnuva bulunamazsa hata ve Ana menü gösterir, polling durur', async () => {
    rpc.mockReturnValue(ok({ success: false, error: 'Turnuva bulunamadı' }));
    const { openTournament } = setup({ activeTournamentCode: '999999' });
    await flush();
    expect(screen.getByRole('alert')).toHaveTextContent('Turnuva bulunamadı');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Ana menü/ }));
    expect(openTournament).toHaveBeenCalledWith(null);
  });
});

describe('TournamentScreen — eleme ağacı', () => {
  const running = (rest: Partial<TournamentData> = {}, over: Partial<TournamentData['tournament']> = {}) =>
    tournamentData(
      { status: 'RUNNING', size: 8, rounds: 3, am_registered: true, ...over },
      {
        matches: [
          { round: 1, slot: 0, room_code: '111111', room_status: 'RESULT', player_a: side('Arda', true), player_b: side('Ece'), winner_side: 'a' },
          { round: 1, slot: 1, room_code: '222222', room_status: 'QUIZ', player_a: side('Can'), player_b: side('Su'), winner_side: null },
          { round: 1, slot: 2, room_code: '333333', room_status: 'RESULT', player_a: side('Ali'), player_b: side('Naz'), winner_side: 'b' },
          { round: 1, slot: 3, room_code: '444444', room_status: 'RESULT', player_a: side('Efe'), player_b: side('Mert'), winner_side: 'a' },
          { round: 2, slot: 0, room_code: '555555', room_status: 'LOBBY', player_a: side('Arda', true), player_b: null, winner_side: null },
        ],
        my_room_code: '555555',
        ...rest,
      }
    );

  it('round başlıklarını, kazanan/kaybeden vurgusunu, canlı rozetini ve yer tutucuları gösterir', async () => {
    rpc.mockReturnValue(ok(running()));
    setup({ activeTournamentCode: '123456' });

    expect(await screen.findByText('Çeyrek final')).toBeInTheDocument();
    expect(screen.getByText('Yarı final')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();

    const cards = screen.getAllByTestId('bracket-match');
    expect(cards).toHaveLength(5);
    const first = cards[0];
    expect(first).toHaveAttribute('data-mine', 'true');
    expect(within(first).getByText('Ece').closest('[data-result]')).toHaveAttribute('data-result', 'loser');
    expect(within(first).getByText('Arda').closest('[data-result]')).toHaveAttribute('data-result', 'winner');
    expect(cards[1]).toHaveAttribute('data-mine', 'false');
    expect(within(cards[1]).getByText('Canlı')).toBeInTheDocument();
    expect(within(cards[0]).queryByText('Canlı')).not.toBeInTheDocument();
    // Yarı finalde 1 eksik maç + final = 2 yer tutucu
    expect(screen.getAllByTestId('bracket-placeholder')).toHaveLength(2);
  });

  it('4 kişilik turnuvada Yarı final ve Final başlıkları', async () => {
    rpc.mockReturnValue(ok(tournamentData({ status: 'RUNNING', size: 4, rounds: 2 })));
    setup({ activeTournamentCode: '123456' });
    expect(await screen.findByText('Yarı final')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.queryByText('Çeyrek final')).not.toBeInTheDocument();
  });

  it('Maçına gir → enterRoom(my_room_code)', async () => {
    rpc.mockReturnValue(ok(running()));
    const { enterRoom } = setup({ activeTournamentCode: '123456' });
    fireEvent.click(await screen.findByRole('button', { name: /Maçına gir/ }));
    await waitFor(() => expect(enterRoom).toHaveBeenCalledWith('555555'));
  });

  it('elendiysem bilgi mesajı gösterir', async () => {
    rpc.mockReturnValue(
      ok(
        running({
          my_room_code: null,
          players: [{ name: 'Arda', avatar: '🚀', is_me: true, eliminated: true }],
        })
      )
    );
    setup({ activeTournamentCode: '123456' });
    expect(await screen.findByText(/Elendin — turnuvayı izlemeye devam edebilirsin/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Maçına gir/ })).not.toBeInTheDocument();
  });

  it('FINISHED: şampiyon kartı ve konfeti', async () => {
    rpc.mockReturnValue(
      ok(running({ my_room_code: null }, { status: 'FINISHED', champion: { name: 'Arda', avatar: '👑' } }))
    );
    setup({ activeTournamentCode: '123456' });
    const card = await screen.findByTestId('champion-card');
    expect(within(card).getByText('Şampiyon')).toBeInTheDocument();
    expect(within(card).getByText('Arda')).toBeInTheDocument();
    expect(confettiMock).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Maçına gir/ })).not.toBeInTheDocument();
  });

  it('context hatasını (ör. odaya girilemedi) gösterir', async () => {
    rpc.mockReturnValue(ok(running()));
    setup({ activeTournamentCode: '123456', errorMsg: 'Odaya girilemedi.' });
    expect(await screen.findByText('Odaya girilemedi.')).toBeInTheDocument();
  });
});
