import { act, fireEvent, render, screen } from '@testing-library/react';
import { QuizScreen } from './QuizScreen';
import type { Player, Question } from '../../types/game';

const game = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../context/GameContext', () => ({ useGame: () => game.value }));

const player = (name: string, extra: Partial<Player> = {}): Player => ({
  id: name,
  name,
  avatar: '🚀',
  isHost: false,
  isReady: true,
  score: 0,
  correctAnswers: 0,
  ...extra,
});

const QUESTIONS: Question[] = [
  { id: 1, category: 'bilim', question: 'Suyun formülü?', options: ['CO2', 'H2O', 'O2', 'NaCl'] },
  { id: 2, category: 'genel', question: 'Başkent?', options: ['İzmir', 'Ankara', 'Bursa', 'Van'] },
];

const setup = (overrides: Record<string, unknown> = {}) => {
  const fns = {
    answerQuestion: vi.fn(),
    advanceQuestionIndex: vi.fn(),
    finishQuiz: vi.fn(),
  };
  game.value = {
    myPlayer: player('Ben', { score: 120 }),
    opponentPlayer: player('Rakip', { score: 80 }),
    questions: QUESTIONS,
    currentQuestionIndex: 0,
    matchStartTime: Date.now(),
    settings: { matchSeconds: 90, questionCount: 10, countdownSeconds: 3 },
    ...fns,
    ...overrides,
  };
  const utils = render(<QuizScreen />);
  return { ...fns, ...(game.value as typeof fns), ...utils };
};

const option = (text: string) => screen.getByText(text).closest('button')!;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('QuizScreen', () => {
  it('soruyu, şıkları, skorları ve süreyi gösterir', () => {
    setup();
    expect(screen.getByText('Suyun formülü?')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getByText('90s')).toBeInTheDocument();
    expect(screen.getByText(/Ben \(Sen\)/)).toBeInTheDocument();
  });

  it('kalan süre sunucu başlangıç zamanından hesaplanır', () => {
    setup({ matchStartTime: Date.now() - 30_000 });
    expect(screen.getByText('60s')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText('55s')).toBeInTheDocument();
  });

  it('doğru cevapta geri bildirim gösterir ve 1200ms sonra sonraki soruya geçer', async () => {
    const { answerQuestion, advanceQuestionIndex } = setup();
    answerQuestion.mockResolvedValue({ success: true, isCorrect: true, correctIndex: 1, pointsAdded: 150 });

    await act(async () => {
      fireEvent.click(option('H2O'));
    });
    expect(answerQuestion).toHaveBeenCalledWith(1);
    expect(option('CO2')).toBeDisabled();

    act(() => vi.advanceTimersByTime(1199));
    expect(advanceQuestionIndex).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(advanceQuestionIndex).toHaveBeenCalledTimes(1);
  });

  it('yanlış cevapta doğru şıkkı da işaretler', async () => {
    const { answerQuestion } = setup();
    answerQuestion.mockResolvedValue({ success: true, isCorrect: false, correctIndex: 1 });
    await act(async () => {
      fireEvent.click(option('CO2'));
    });
    expect(option('CO2').className).toMatch(/danger/);
    expect(option('H2O').className).toMatch(/success/);
  });

  it('gönderim sürerken ikinci tıklama yeni istek göndermez', async () => {
    const { answerQuestion } = setup();
    let resolve!: (v: unknown) => void;
    answerQuestion.mockReturnValue(new Promise((r) => (resolve = r)));

    for (const text of ['H2O', 'CO2', 'O2']) {
      await act(async () => {
        fireEvent.click(option(text));
      });
    }
    expect(answerQuestion).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ success: true, isCorrect: true, correctIndex: 1 }));
  });

  it('sunucu hatasında hata mesajı gösterir, soruda kalır ve tekrar denemeye izin verir', async () => {
    const { answerQuestion, advanceQuestionIndex } = setup();
    answerQuestion.mockResolvedValue({ success: false, error: 'Cevap iletilemedi' });

    await act(async () => {
      fireEvent.click(option('H2O'));
    });
    expect(screen.getByText(/Cevap iletilemedi/)).toBeInTheDocument();
    expect(option('H2O')).toBeEnabled();
    act(() => vi.advanceTimersByTime(2000));
    expect(advanceQuestionIndex).not.toHaveBeenCalled();
  });

  it('son soruyu da bitiren ikinci oyuncu maçı sonlandırır', async () => {
    const { answerQuestion, finishQuiz } = setup({ currentQuestionIndex: 1 });
    answerQuestion.mockResolvedValue({ success: true, isCorrect: true, correctIndex: 1, matchFinished: true });

    await act(async () => {
      fireEvent.click(option('Ankara'));
    });
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.getByText(/Tüm soruları tamamladın/)).toBeInTheDocument();
    expect(finishQuiz).toHaveBeenCalled();
  });

  it('rakip bitirmediyse son sorudan sonra bekleme ekranı gösterir, maçı bitirmez', async () => {
    const { answerQuestion, finishQuiz } = setup({ currentQuestionIndex: 1 });
    answerQuestion.mockResolvedValue({ success: true, isCorrect: false, correctIndex: 1, matchFinished: false });

    await act(async () => {
      fireEvent.click(option('Van'));
    });
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.getByText(/Rakibin soruları tamamlaması/)).toBeInTheDocument();
    expect(finishQuiz).not.toHaveBeenCalled();
  });

  it('süre dolunca finishQuiz çağrılır', () => {
    const { finishQuiz } = setup({ matchStartTime: Date.now() - 89_000 });
    expect(finishQuiz).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(finishQuiz).toHaveBeenCalled();
    expect(screen.getByText('0s')).toBeInTheDocument();
  });

  it('sayfa yenilenip tüm sorular bitmiş hâlde açılırsa bekleme ekranını gösterir', () => {
    setup({ currentQuestionIndex: 2 });
    expect(screen.getByText(/Tüm soruları tamamladın/)).toBeInTheDocument();
  });
});
