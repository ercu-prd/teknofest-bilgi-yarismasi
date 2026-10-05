import { act, fireEvent, render, screen } from '@testing-library/react';
import { MatchmakingScreen } from './MatchmakingScreen';

const game = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../context/GameContext', () => ({ useGame: () => game.value }));

const HINT = /Şu an kimse aramıyor olabilir/;

const setup = () => {
  const cancelQuickMatch = vi.fn().mockResolvedValue(undefined);
  game.value = {
    myPlayer: { id: 'me', name: 'Arda', avatar: '🤖', isHost: true, isReady: false, score: 0, correctAnswers: 0 },
    cancelQuickMatch,
  };
  render(<MatchmakingScreen />);
  return { cancelQuickMatch };
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('MatchmakingScreen', () => {
  it('oyuncunun adını, avatarını ve arama durumunu gösterir', () => {
    setup();
    expect(screen.getByText('Arda')).toBeInTheDocument();
    expect(screen.getByText('🤖')).toBeInTheDocument();
    expect(screen.getByText('Rakip aranıyor…')).toBeInTheDocument();
    expect(screen.getByTestId('matchmaking-elapsed')).toHaveTextContent('00:00');
  });

  it('geçen süreyi mm:ss olarak sayar', () => {
    setup();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByTestId('matchmaking-elapsed')).toHaveTextContent('00:05');
    act(() => vi.advanceTimersByTime(70_000));
    expect(screen.getByTestId('matchmaking-elapsed')).toHaveTextContent('01:15');
  });

  it('60 saniyeden sonra ipucu gösterir', () => {
    setup();
    act(() => vi.advanceTimersByTime(59_000));
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  it('İptal butonu cancelQuickMatch çağırır', async () => {
    const { cancelQuickMatch } = setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /İptal/ }));
    });
    expect(cancelQuickMatch).toHaveBeenCalledTimes(1);
  });
});
