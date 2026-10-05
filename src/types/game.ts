import type { MatchSettings } from '../config/appConfig';

export type ScreenType =
  | 'HOME'
  | 'LOBBY'
  | 'VS'
  | 'QUIZ'
  | 'RESULT'
  | 'MATCHMAKING'
  | 'LEADERBOARD'
  | 'TOURNAMENT'
  | 'ADMIN';

/** Realtime link state as seen by this client. */
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  score: number;
  correctAnswers: number;
  currentQuestionIndex?: number;
  finishedAt?: string | null;
  lastSeenAt?: string | null;
  wantsRematch?: boolean;
}

export interface Question {
  id: number;
  category: string;
  difficulty?: string;
  question: string;
  options: string[];
  correctIndex?: number;
  explanation?: string;
}

export interface AnswerResult {
  success: boolean;
  isCorrect?: boolean;
  correctIndex?: number;
  pointsAdded?: number;
  matchFinished?: boolean;
  error?: string;
}

export interface ReviewAnswer {
  selected_option_index: number;
  is_correct: boolean;
  points_awarded: number;
}

export interface ReviewQuestion {
  id: number;
  category: string;
  difficulty: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  my_answer: ReviewAnswer | null;
  opponent_answer: ReviewAnswer | null;
}

export interface GameState {
  currentScreen: ScreenType;
  roomCode: string;
  myPlayerId: string;
  player1: Player;
  player2: Player | null;
  myPlayer: Player;
  opponentPlayer: Player | null;
  currentQuestionIndex: number;
  questions: Question[];
  isStarting: boolean;
  matchStartTime: number | null;
  winner: Player | null;
  isDraw: boolean;
  errorMsg: string | null;
  connectionStatus: ConnectionStatus;
  settings: MatchSettings;
  /** Set when the current room is a tournament match. */
  roomTournamentCode: string | null;
  /** Tournament the player is currently viewing / registered in. */
  activeTournamentCode: string | null;
  isBusy: boolean;
}
