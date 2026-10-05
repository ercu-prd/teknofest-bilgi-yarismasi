import { act, fireEvent, render, screen } from '@testing-library/react';
import { HomeScreen } from './HomeScreen';

const game = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../context/GameContext', () => ({ useGame: () => game.value }));

const setup = (overrides: Record<string, unknown> = {}) => {
  const fns = {
    updatePlayerName: vi.fn(),
    updatePlayerAvatar: vi.fn(),
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    startQuickMatch: vi.fn(),
    openTournament: vi.fn(),
    setScreen: vi.fn(),
    clearError: vi.fn(),
  };
  game.value = {
    player1: { name: 'Arda', avatar: '🚀' },
    settings: { matchSeconds: 75, questionCount: 8, countdownSeconds: 3 },
    isBusy: false,
    errorMsg: null,
    ...fns,
    ...overrides,
  };
  render(<HomeScreen />);
  return fns;
};

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('HomeScreen', () => {
  it('sunucu ayarlarındaki süre ve soru sayısını gösterir', () => {
    setup();
    expect(screen.getByText('75 saniye')).toBeInTheDocument();
    expect(screen.getByText('8 soru')).toBeInTheDocument();
  });

  it('hızlı eşleşmeyi seçili isim ve avatarla başlatır', async () => {
    const { startQuickMatch } = setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Hızlı eşleş' }));
    });
    expect(startQuickMatch).toHaveBeenCalledWith('Arda', 'pilot');
  });

  it('isim boşsa hızlı eşleşme başlamaz', async () => {
    const { startQuickMatch } = setup({ player1: { name: '', avatar: '🚀' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Hızlı eşleş' }));
    });
    expect(startQuickMatch).not.toHaveBeenCalled();
    expect(screen.getByText('Lütfen takma adınızı girin!')).toBeInTheDocument();
  });

  it('turnuva ve liderlik ekranlarına yönlendirir', () => {
    const { setScreen } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Turnuva' }));
    expect(setScreen).toHaveBeenCalledWith('TOURNAMENT');
    fireEvent.click(screen.getByRole('button', { name: 'Liderlik' }));
    expect(setScreen).toHaveBeenCalledWith('LEADERBOARD');
  });

  it('?room= linkiyle gelince katılma penceresi kod dolu açılır', async () => {
    window.history.replaceState(null, '', '/?room=654321');
    const { joinRoom } = setup();
    const input = screen.getByLabelText('Oda kodu') as HTMLInputElement;
    expect(input.value).toBe('654321');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Katıl' }));
    });
    expect(joinRoom).toHaveBeenCalledWith('654321', 'Arda', 'pilot');
    expect(window.location.search).toBe('');
  });

  it('?tournament= linkiyle gelince turnuvayı açar ve parametreyi temizler', () => {
    window.history.replaceState(null, '', '/?tournament=424242');
    const { openTournament } = setup();
    expect(openTournament).toHaveBeenCalledWith('424242');
    expect(window.location.search).toBe('');
  });

  it('oda kodu alanı yalnızca rakam kabul eder', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Odaya katıl' }));
    const input = screen.getByLabelText('Oda kodu') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12ab34-5678' } });
    expect(input.value).toBe('123456');
  });

  it('işlem sürerken oda butonları devre dışı', () => {
    setup({ isBusy: true });
    expect(screen.getByRole('button', { name: 'Oda kur' })).toBeDisabled();
  });
});
