export const APP_CONFIG = {
  /**
   * TEKNOFEST Üniversite Kulübü Instagram Profili
   * Tek bir yapılandırma noktasından yönetilir.
   */
  instagramUrl: 'https://www.instagram.com/oku.teknofest/',
  clubName: 'OKÜ TEKNOFEST Kulübü',
  appName: 'OKÜ TEKNOFEST Bilgi Yarışması',
  universityName: 'Osmaniye Korkut Ata Üniversitesi',
  /** Defaults only: the server's public.quiz_settings() is authoritative and overrides these at runtime. */
  matchQuestionCount: 10,
  matchDurationSeconds: 90,
  countdownDurationSeconds: 3,
  /** Must match the server-side limit in public._validate_player_identity(). */
  playerNameMaxLength: 16,
  /** Client feedback delay after an answer; the server excludes this window from the next question's bonus. */
  answerFeedbackMs: 1200,
  heartbeatIntervalMs: 15_000,
  /** An opponent with no heartbeat for this long is shown as disconnected. */
  opponentOfflineAfterMs: 45_000,
  quickMatchPollMs: 2_000,
};

export interface MatchSettings {
  matchSeconds: number;
  questionCount: number;
  countdownSeconds: number;
}

export const DEFAULT_MATCH_SETTINGS: MatchSettings = {
  matchSeconds: APP_CONFIG.matchDurationSeconds,
  questionCount: APP_CONFIG.matchQuestionCount,
  countdownSeconds: APP_CONFIG.countdownDurationSeconds,
};
