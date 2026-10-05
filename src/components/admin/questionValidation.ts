import { CATEGORY_OPTIONS } from '../../data/categories';
import { DIFFICULTY_OPTIONS, type AdminQuestion, type QuestionDraft } from './types';

export const QUESTION_MIN_LENGTH = 5;
export const QUESTION_MAX_LENGTH = 300;

export const emptyDraft = (): QuestionDraft => ({
  id: null,
  category: CATEGORY_OPTIONS[0].value,
  difficulty: 'kolay',
  question: '',
  options: ['', '', '', ''],
  correctIndex: null,
  explanation: '',
});

export const draftFromQuestion = (q: AdminQuestion): QuestionDraft => ({
  id: q.id,
  category: q.category,
  difficulty: q.difficulty,
  question: q.question,
  options: [0, 1, 2, 3].map((i) => q.options[i] ?? ''),
  correctIndex: q.correct_index,
  explanation: q.explanation ?? '',
});

/** Mirrors admin_upsert_question_rpc's checks. Returns an error message or null when valid. */
export const validateDraft = (draft: QuestionDraft): string | null => {
  if (!CATEGORY_OPTIONS.some((c) => c.value === draft.category)) return 'Geçerli bir kategori seçin.';
  if (!DIFFICULTY_OPTIONS.some((d) => d.value === draft.difficulty)) return 'Geçerli bir zorluk seçin.';
  const question = draft.question.trim();
  if (question.length < QUESTION_MIN_LENGTH || question.length > QUESTION_MAX_LENGTH) {
    return `Soru metni ${QUESTION_MIN_LENGTH}-${QUESTION_MAX_LENGTH} karakter olmalı.`;
  }
  const options = draft.options.map((o) => o.trim());
  if (options.length !== 4 || options.some((o) => o === '')) return 'Dört şıkkın tamamı doldurulmalı.';
  if (new Set(options).size !== 4) return 'Şıklar birbirinden farklı olmalı.';
  if (draft.correctIndex === null || draft.correctIndex < 0 || draft.correctIndex > 3) {
    return 'Doğru şıkkı seçin.';
  }
  return null;
};
