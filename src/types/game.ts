export type ScreenType = 'HOME' | 'LOBBY' | 'VS' | 'QUIZ' | 'RESULT';

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isReady: boolean;
  score: number;
  streak: number;
  correctAnswers: number;
  currentQuestionIndex?: number;
  finishedAt?: string | null;
  avgTimeSeconds?: number;
}

export interface Question {
  id: number;
  category: string;
  question: string;
  options: string[];
  correctIndex?: number;
  explanation?: string;
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
  timeRemaining: number;
  isGameActive: boolean;
  isStarting: boolean;
  matchStartTime: number | null;
  winner: Player | null;
  isDraw: boolean;
  errorMsg: string | null;
}
