import { act, fireEvent, render, screen } from '@testing-library/react';
import { ResultScreen } from './ResultScreen';
import type { Player, ReviewQuestion } from '../../types/game';

const game = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../context/GameContext', () => ({ useGame: () => game.value }));
vi.mock('../../lib/sound', () => ({ playSound: vi.fn(), vibrate: vi.fn() }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

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

const REVIEW: ReviewQuestion[] = [
  {
    id: 1,
    category: 'bilim',
    difficulty: 'kolay',
    question: 'Suyun formülü?',
    options: ['CO2', 'H2O', 'O2', 'NaCl'],
    correct_index: 1,
    explanation: 'Su iki hidrojen ve bir oksijenden oluşur.',
    my_answer: { selected_option_index: 0, is_correct: false, points_awarded: 0 },
    opponent_answer: { selected_option_index: 1, is_correct: true, points_awarded: 140 },
  },
];

const setup = (overrides: Record<string, unknown> = {}) => {
  const fns = {
    requestRematch: vi.fn(),
    returnToLobby: vi.fn(),
    leaveRoom: vi.fn(),
    fetchMatchReview: vi.fn().mockResolvedValue(REVIEW),
  };
  const me = player('Ben', { score: 300, correctAnswers: 3 });
  const opp = player('Ayşe', { score: 200 });
  game.value = {
    myPlayer: me,
    opponentPlayer: opp,
    winner: me,
    isDraw: false,
    roomTournamentCode: null,
    settings: { matchSeconds: 90, questionCount: 10, countdownSeconds: 3 },
    errorMsg: null,
    ...fns,
    ...overrides,
  };
  render(<ResultScreen />);
  return fns;
};

describe('ResultScreen', () => {
  it('kazananı ve doğru sayısını ayarlardaki soru sayısıyla gösterir', async () => {
    setup();
    expect(screen.getByText('Kazandın')).toBeInTheDocument();
    expect(screen.getByText('3 / 10')).toBeInTheDocument();
    await screen.findByText('Suyun formülü?');
  });

  it('rövanş isteği gönderir', async () => {
    const { requestRematch } = setup();
    fireEvent.click(screen.getByText('Rövanş iste'));
    expect(requestRematch).toHaveBeenCalledWith(true);
    await screen.findByText('Suyun formülü?');
  });

  it('rakip rövanş istediyse kabul butonu gösterir', async () => {
    setup({ opponentPlayer: player('Ayşe', { wantsRematch: true }) });
    expect(screen.getByText(/Ayşe rövanş istiyor/)).toBeInTheDocument();
    expect(screen.getByText('Rövanşı kabul et')).toBeInTheDocument();
    await screen.findByText('Suyun formülü?');
  });

  it('istek gönderildiyse bekleme durumu ve geri çekme gösterir', async () => {
    const { requestRematch } = setup({ myPlayer: player('Ben', { wantsRematch: true }) });
    expect(screen.getByText(/Ayşe bekleniyor/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('İsteği geri çek'));
    expect(requestRematch).toHaveBeenCalledWith(false);
    await screen.findByText('Suyun formülü?');
  });

  it('rakip ayrıldıysa yeni rakip bekleme seçeneği sunar', async () => {
    const { returnToLobby } = setup({ opponentPlayer: null });
    expect(screen.getByText(/Rakibin odadan ayrıldı\./)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Yeni rakip bekle'));
    expect(returnToLobby).toHaveBeenCalled();
    await screen.findByText('Suyun formülü?');
  });

  it('turnuva maçında rövanş yerine turnuvaya dönüş sunar', async () => {
    const { leaveRoom } = setup({ roomTournamentCode: '424242' });
    expect(screen.queryByText('Rövanş iste')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Turnuvaya dön'));
    expect(leaveRoom).toHaveBeenCalled();
    await screen.findByText('Suyun formülü?');
  });

  it('maç incelemesinde açıklamayı ve doğru şıkkı gösterir', async () => {
    setup();
    const question = await screen.findByText('Suyun formülü?');
    fireEvent.click(question);
    expect(screen.getByText('Su iki hidrojen ve bir oksijenden oluşur.')).toBeInTheDocument();
    expect(screen.getByText('B) H2O').className).toMatch(/success/);
    expect(screen.getByText('A) CO2').className).toMatch(/danger/);
  });

  it('inceleme yüklenemezse bölüm gizlenir', async () => {
    setup({ fetchMatchReview: vi.fn().mockResolvedValue(null) });
    await act(async () => {});
    expect(screen.queryByText('Soru soru özet')).not.toBeInTheDocument();
  });

  it('ana menü butonu odadan çıkar', async () => {
    const { leaveRoom } = setup();
    fireEvent.click(screen.getByText('Ana menü'));
    expect(leaveRoom).toHaveBeenCalled();
    await screen.findByText('Suyun formülü?');
  });
});
