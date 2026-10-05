import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QUESTION_BANK } from './questionBank';
import { MOCK_QUESTIONS, AVATAR_OPTIONS } from './mockQuestions';

/**
 * Parses the seed rows of the initial migration:
 * ('category','difficulty','question','["a","b","c","d"]',answer)
 */
const parseSeedQuestions = () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20261005000000_create_quiz_schema.sql'),
    'utf8'
  );
  const rowRe = /^\('([^']+)','(kolay|orta|zor)','((?:[^']|'')+)','(\[.*\])',(\d+)\),?$/gm;
  return [...sql.matchAll(rowRe)].map((m) => ({
    category: m[1],
    difficulty: m[2],
    question: m[3].replace(/''/g, "'"),
    options: JSON.parse(m[4].replace(/''/g, "'")) as string[],
    answer: Number(m[5]),
  }));
};

describe('Supabase seed soru bankası (sunucunun gerçekte kullandığı sorular)', () => {
  const seed = parseSeedQuestions();

  it('seed satırları parse edilebiliyor', () => {
    expect(seed.length).toBeGreaterThan(0);
  });

  it('her soruda 4 benzersiz şık ve 0-3 arası doğru cevap var', () => {
    for (const q of seed) {
      expect(q.options, q.question).toHaveLength(4);
      expect(new Set(q.options).size, q.question).toBe(4);
      expect(q.answer, q.question).toBeGreaterThanOrEqual(0);
      expect(q.answer, q.question).toBeLessThanOrEqual(3);
    }
  });

  it('soru metinleri benzersiz', () => {
    expect(new Set(seed.map((q) => q.question)).size).toBe(seed.length);
  });

  it('create_room_rpc için yeterli soru var (4 kolay, 4 orta, 2 zor)', () => {
    const count = (d: string) => seed.filter((q) => q.difficulty === d).length;
    expect(count('kolay')).toBeGreaterThanOrEqual(4);
    expect(count('orta')).toBeGreaterThanOrEqual(4);
    expect(count('zor')).toBeGreaterThanOrEqual(2);
  });
});

describe('İstemci soru bankası (QUESTION_BANK)', () => {
  it('id değerleri benzersiz', () => {
    const ids = QUESTION_BANK.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('her soruda 4 benzersiz şık ve geçerli correctIndex var', () => {
    for (const q of QUESTION_BANK) {
      expect(q.options, `#${q.id}`).toHaveLength(4);
      expect(new Set(q.options).size, `#${q.id}`).toBe(4);
      expect(q.correctIndex, `#${q.id}`).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex, `#${q.id}`).toBeLessThanOrEqual(3);
      expect(q.question.trim().length, `#${q.id}`).toBeGreaterThan(0);
    }
  });

  it('her kategoride en az 3 soru var', () => {
    for (const cat of ['Teknoloji', 'Bilim', 'Genel Kültür', 'Mantık']) {
      expect(QUESTION_BANK.filter((q) => q.category === cat).length, cat).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('Mock veriler', () => {
  it('MOCK_QUESTIONS geçerli', () => {
    for (const q of MOCK_QUESTIONS) {
      expect(q.options).toHaveLength(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThanOrEqual(3);
    }
  });

  it('avatar id ve ikonları benzersiz', () => {
    expect(new Set(AVATAR_OPTIONS.map((a) => a.id)).size).toBe(AVATAR_OPTIONS.length);
    expect(new Set(AVATAR_OPTIONS.map((a) => a.icon)).size).toBe(AVATAR_OPTIONS.length);
  });
});
