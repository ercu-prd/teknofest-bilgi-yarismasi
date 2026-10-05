import { QUESTION_BANK } from '../data/questionBank';
import type { QuestionItem } from '../data/questionBank';
import type { Question } from '../types/game';

/**
 * Pseudo-random number generator (Mulberry32) initialized with a string seed.
 * Ensures identical random sequence for both players in the same room.
 */
function createSeededRandom(seedStr: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }
  return function () {
    let t = (h += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle using a seeded random function
 */
function seededShuffle<T>(array: T[], rng: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generates a deterministic set of 10 questions for a room code.
 * Ensures:
 * 1. Both players get exact same 10 questions.
 * 2. Questions are in the exact same order.
 * 3. Options are in the exact same shuffled order for each question.
 * 4. Page refresh preserves the exact same questions for that room code.
 */
export function generateMatchQuestions(roomCode: string, count: number = 10): Question[] {
  const rng = createSeededRandom(roomCode.toLowerCase());

  // 1. Group questions by category to ensure balanced mix
  const categories = ['Teknoloji', 'Bilim', 'Genel Kültür', 'Mantık'] as const;
  const categorized: Record<string, QuestionItem[]> = {
    Teknoloji: [],
    Bilim: [],
    'Genel Kültür': [],
    Mantık: [],
  };

  QUESTION_BANK.forEach((q) => {
    if (categorized[q.category]) {
      categorized[q.category].push(q);
    }
  });

  // 2. Pick balanced questions from each category using seeded RNG
  const selectedPool: QuestionItem[] = [];
  
  // Pick ~2-3 from each category
  categories.forEach((cat) => {
    const shuffledCat = seededShuffle(categorized[cat], rng);
    selectedPool.push(...shuffledCat.slice(0, 3));
  });

  // If we need more to reach count (10), fill from remaining shuffled bank
  const remaining = QUESTION_BANK.filter((q) => !selectedPool.some((sp) => sp.id === q.id));
  const shuffledRemaining = seededShuffle(remaining, rng);
  
  const finalSet = seededShuffle(
    [...selectedPool, ...shuffledRemaining].slice(0, count),
    rng
  );

  // 3. Process each question to shuffle options deterministically and recalculate correctIndex
  return finalSet.map((q) => {
    // Create option objects with initial index
    const optionPairs = q.options.map((opt, idx) => ({ text: opt, isCorrect: idx === q.correctIndex }));
    const shuffledOptions = seededShuffle(optionPairs, rng);
    
    const newCorrectIndex = shuffledOptions.findIndex((opt) => opt.isCorrect);

    return {
      id: q.id,
      category: q.category,
      question: q.question,
      options: shuffledOptions.map((opt) => opt.text),
      correctIndex: newCorrectIndex,
      explanation: q.explanation,
    };
  });
}
