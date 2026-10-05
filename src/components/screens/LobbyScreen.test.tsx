import { act, fireEvent, render, screen } from '@testing-library/react';
import { LobbyScreen } from './LobbyScreen';
import type { Player } from '../../types/game';

const game = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const clip = vi.hoisted(() => ({ copyText: vi.fn(), shareOrCopy: vi.fn() }));
vi.mock('../../context/GameContext', () => ({ useGame: () => game.value }));
vi.mock('../../lib/clipboard', () => clip);
vi.mock('../ui/RoomQrCode', () => ({ RoomQrCode: ({ url }: { url: string }) => <img alt="qr" data-url={url} /> }));

const player = (id: string, extra: Partial<Player> = {}): Player => ({
  id,
  name: id,
  avatar: '🚀',
  isHost: false,
  isReady: false,
  score: 0,
  correctAnswers: 0,
  ...extra,
});

const setup = (overrides: Record<string, unknown> = {}) => {
  const fns = { toggleReady: vi.fn(), leaveRoom: vi.fn() };
  const host = player('host', { isHost: true, name: 'Ben' });
  const guest = player('guest', { name: 'Ayşe', lastSeenAt: new Date().toISOString() });
  game.value = {
    roomCode: '123456',
    myPlayerId: 'host',
    player1: host,
    player2: guest,
    opponentPlayer: guest,
    isStarting: false,
    roomTournamentCode: null,
    errorMsg: null,
    ...fns,
    ...overrides,
  };
  render(<LobbyScreen />);
  return fns;
};

beforeEach(() => {
  clip.copyText.mockResolvedValue(true);
  clip.shareOrCopy.mockResolvedValue('copied');
});

describe('LobbyScreen', () => {
  it('oda kodunu kopyalar (HTTPS dışında da çalışan yardımcı ile)', async () => {
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Kodu kopyala' }));
    });
    expect(clip.copyText).toHaveBeenCalledWith('123456');
  });

  it('davet linkini oda kodu parametresiyle paylaşır', async () => {
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Davet linki' }));
    });
    expect(clip.shareOrCopy).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('?room=123456') }));
    expect(screen.getByText('Davet linki kopyalandı')).toBeInTheDocument();
  });

  it('QR kodu açıp kapatır', () => {
    setup();
    expect(screen.queryByAltText('qr')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'QR göster' }));
    expect(screen.getByAltText('qr').getAttribute('data-url')).toContain('?room=123456');
    fireEvent.click(screen.getByRole('button', { name: 'QR gizle' }));
    expect(screen.queryByAltText('qr')).not.toBeInTheDocument();
  });

  it('rakibin sinyali uzun süredir gelmiyorsa uyarı gösterir', () => {
    const stale = player('guest', { name: 'Ayşe', lastSeenAt: new Date(Date.now() - 120_000).toISOString() });
    setup({ player2: stale, opponentPlayer: stale });
    expect(screen.getByText('Bağlantı koptu')).toBeInTheDocument();
  });

  it('rakip çevrimiçiyse uyarı yok', () => {
    setup();
    expect(screen.queryByText('Bağlantı koptu')).not.toBeInTheDocument();
  });

  it('ana menü butonu odadan çıkar', () => {
    const { leaveRoom } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Ana menü' }));
    expect(leaveRoom).toHaveBeenCalled();
  });

  it('turnuva maçında oda kodu yerine turnuva bilgisi gösterir', () => {
    setup({ roomTournamentCode: '424242' });
    expect(screen.getByText('Turnuva maçı')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Davet linki' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turnuvaya dön' })).toBeInTheDocument();
    expect(screen.getByText(/hükmen mağlup/)).toBeInTheDocument();
  });

  it('tek oyuncu varken hazır butonu devre dışı', () => {
    setup({ player2: null, opponentPlayer: null });
    expect(screen.getByRole('button', { name: 'Hazırım' })).toBeDisabled();
  });
});
