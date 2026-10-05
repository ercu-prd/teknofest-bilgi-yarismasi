export type Difficulty = 'kolay' | 'orta' | 'zor';

export const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'kolay', label: 'Kolay' },
  { value: 'orta', label: 'Orta' },
  { value: 'zor', label: 'Zor' },
];

export const difficultyLabel = (code: string): string =>
  DIFFICULTY_OPTIONS.find((d) => d.value === code)?.label ?? code;

export interface AdminQuestion {
  id: number;
  category: string;
  difficulty: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  is_active: boolean;
  times_answered: number;
  correct_rate: number | null;
}

export interface MissedQuestion {
  id: number;
  question: string;
  times_answered: number;
  correct_rate: number | null;
}

export interface AdminStats {
  active_questions: number;
  total_questions: number;
  rooms_today: number;
  matches_today: number;
  most_missed: MissedQuestion[];
}

export interface QuestionDraft {
  id: number | null;
  category: string;
  difficulty: string;
  question: string;
  options: string[];
  correctIndex: number | null;
  explanation: string;
}

/** Shape every admin RPC may answer with on failure. */
export interface RpcFailure {
  success: false;
  error?: string;
}

/** Formats a 0..1 ratio as a whole percentage; null/undefined -> em dash. */
export const formatRate = (rate: number | null | undefined): string =>
  rate === null || rate === undefined || Number.isNaN(Number(rate)) ? '—' : `%${Math.round(Number(rate) * 100)}`;
