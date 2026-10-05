import { act, render, screen } from '@testing-library/react';
import { VsScreen } from './VsScreen';
import type { Player } from '../../types/game';

const game = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../context/GameContext', () => ({ useGame: () => game.value }));

const player = (name: string, isHost: boolean): Player => ({
  id: name,
  name,
  avatar: '🚀',
  isHost,
  isReady: true,
  score: 0,
  correctAnswers: 0,
});

const setup = (matchStartTime: number | null) => {
  const setScreen = vi.fn();
  game.value = {
    myPlayer: player('Ben', true),
    opponentPlayer: player('Ayşe', false),
    matchStartTime,
    setScreen,
    settings: { matchSeconds: 90, questionCount: 10, countdownSeconds: 3 },
  };
  render(<VsScreen />);
  return { setScreen };
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('VsScreen', () => {
  it('iki oyuncunun adını gösterir', () => {
    setup(Date.now() + 3000);
    expect(screen.getByText('Ben')).toBeInTheDocument();
    expect(screen.getByText('Ayşe')).toBeInTheDocument();
  });

  it('sunucu başlangıç zamanına göre geri sayar ve QUIZ ekranına geçer', () => {
    const { setScreen } = setup(Date.now() + 3000);
    expect(screen.getByText('3')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2000));
    expect(setScreen).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1200));
    expect(setScreen).toHaveBeenCalledWith('QUIZ');
  });

  it('başlangıç zamanı geçmişse (yenileme sonrası) hemen QUIZ ekranına geçer', () => {
    const { setScreen } = setup(Date.now() - 10_000);
    expect(setScreen).toHaveBeenCalledWith('QUIZ');
  });

  // Regresyon: matchStartTime null iken sayaç eskiden 2'de takılıp kalıyordu.
  it('matchStartTime yokken de geri sayım biter ve QUIZ ekranına geçer', () => {
    const { setScreen } = setup(null);
    act(() => vi.advanceTimersByTime(5000));
    expect(setScreen).toHaveBeenCalledWith('QUIZ');
  });
});
