import { act, fireEvent, render, screen } from '@testing-library/react';
import { LeaderboardScreen, LEADERBOARD_REFRESH_MS } from './LeaderboardScreen';

const game = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../context/GameContext', () => ({ useGame: () => game.value }));

const mocks = vi.hoisted(() => ({
  configured: true,
  rpc: vi.fn(),
}));
vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mocks.rpc(...args) },
  get isSupabaseConfigured() {
    return mocks.configured;
  },
}));

const entry = (rank: number, name: string, score: number) => ({
  rank,
  name,
  avatar: '🚀',
  score,
  correct_answers: rank,
  created_at: `2026-10-05T10:0${rank}:00Z`,
});

const ok = (entries: unknown[], period = 'today') => ({ data: { success: true, period, entries }, error: null });

/** Lets pending promise callbacks run while fake timers are active. */
const flush = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
});

let setScreen: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  mocks.configured = true;
  mocks.rpc.mockReset();
  setScreen = vi.fn();
  game.value = { setScreen };
});
afterEach(() => {
  vi.useRealTimers();
  window.location.hash = '';
});

describe('LeaderboardScreen', () => {
  it('bugünün sıralamasını 10 kayıtla yükler ve ilk 3ü madalyayla vurgular', async () => {
    mocks.rpc.mockResolvedValue(ok([entry(1, 'Ayşe', 900), entry(2, 'Mehmet', 700), entry(3, 'Can', 500), entry(4, 'Ece', 300)]));
    render(<LeaderboardScreen />);
    expect(screen.getByText('Yükleniyor…')).toBeInTheDocument();
    await flush();

    expect(mocks.rpc).toHaveBeenCalledWith('get_leaderboard_rpc', { p_period: 'today', p_limit: 10 });
    expect(screen.getAllByTestId('leaderboard-row')).toHaveLength(4);
    expect(screen.getByText('Ayşe')).toBeInTheDocument();
    expect(screen.getByLabelText('1. sıra, Altın madalya')).toBeInTheDocument();
    expect(screen.getByLabelText('2. sıra, Gümüş madalya')).toBeInTheDocument();
    expect(screen.getByLabelText('3. sıra, Bronz madalya')).toBeInTheDocument();
    expect(screen.getByLabelText('4. sıra')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Bugün' })).toHaveAttribute('aria-selected', 'true');
  });

  it('sekme değişince dönem parametresi değişir', async () => {
    mocks.rpc.mockResolvedValue(ok([entry(1, 'Ayşe', 900)]));
    render(<LeaderboardScreen />);
    await flush();

    mocks.rpc.mockResolvedValue(ok([entry(1, 'Usta', 1500)], 'all'));
    fireEvent.click(screen.getByRole('tab', { name: 'Tüm zamanlar' }));
    await flush();

    expect(mocks.rpc).toHaveBeenLastCalledWith('get_leaderboard_rpc', { p_period: 'all', p_limit: 10 });
    expect(screen.getByText('Usta')).toBeInTheDocument();
    expect(screen.queryByText('Ayşe')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tüm zamanlar' })).toHaveAttribute('aria-selected', 'true');
  });

  it('10 saniyede bir yeniler ve unmount olunca durur', async () => {
    mocks.rpc.mockResolvedValue(ok([entry(1, 'Ayşe', 900)]));
    const { unmount } = render(<LeaderboardScreen />);
    await flush();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);

    mocks.rpc.mockResolvedValue(ok([entry(1, 'Yeni Lider', 1200)]));
    await act(async () => {
      vi.advanceTimersByTime(LEADERBOARD_REFRESH_MS);
    });
    await flush();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Yeni Lider')).toBeInTheDocument();

    unmount();
    vi.advanceTimersByTime(LEADERBOARD_REFRESH_MS * 3);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it('boş durumda bilgi mesajı gösterir', async () => {
    mocks.rpc.mockResolvedValue(ok([]));
    render(<LeaderboardScreen />);
    await flush();
    expect(screen.getByText(/Bugün henüz tamamlanan maç yok/)).toBeInTheDocument();
  });

  it('RPC hatasını gösterir', async () => {
    mocks.rpc.mockResolvedValue({ data: { success: false, error: 'Geçersiz dönem (today veya all)' }, error: null });
    render(<LeaderboardScreen />);
    await flush();
    expect(screen.getByRole('alert')).toHaveTextContent('Geçersiz dönem (today veya all)');
  });

  it('ağ hatasını gösterir', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
    render(<LeaderboardScreen />);
    await flush();
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to fetch');
  });

  it('Supabase yapılandırılmamışsa açıklama gösterir ve RPC çağırmaz', () => {
    mocks.configured = false;
    render(<LeaderboardScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Supabase bağlantısı gerekli/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('Ana menü butonu HOME ekranına döner ve hash i temizler', async () => {
    mocks.rpc.mockResolvedValue(ok([]));
    window.location.hash = '#/leaderboard';
    render(<LeaderboardScreen />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: /Ana menü/ }));
    expect(setScreen).toHaveBeenCalledWith('HOME');
    expect(window.location.hash).toBe('');
  });

  it('stant modunda 20 kayıt ister, katılım adresini gösterir ve geri butonu yoktur', async () => {
    mocks.rpc.mockResolvedValue(ok([entry(1, 'Ayşe', 900)]));
    render(<LeaderboardScreen standMode />);
    await flush();
    expect(mocks.rpc).toHaveBeenCalledWith('get_leaderboard_rpc', { p_period: 'today', p_limit: 20 });
    expect(screen.getByTestId('stand-join-info')).toHaveTextContent(`Katılmak için: ${window.location.origin}`);
    expect(screen.queryByRole('button', { name: /Ana menü/ })).not.toBeInTheDocument();
  });
});
