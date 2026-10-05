/**
 * Turnuva RPC dönüş tipleri ve eleme ağacı yardımcıları.
 */

export type TournamentStatus = 'REGISTRATION' | 'RUNNING' | 'FINISHED';

export interface TournamentInfo {
  code: string;
  name: string;
  size: number;
  status: TournamentStatus;
  rounds: number;
  is_organizer: boolean;
  am_registered: boolean;
  champion: { name: string; avatar: string } | null;
}

export interface TournamentPlayer {
  name: string;
  avatar: string;
  is_me: boolean;
  eliminated: boolean;
}

export interface MatchSide {
  name: string;
  avatar: string;
  is_me: boolean;
}

export interface TournamentMatch {
  round: number;
  slot: number;
  room_code: string | null;
  room_status: string | null;
  player_a: MatchSide | null;
  player_b: MatchSide | null;
  winner_side: 'a' | 'b' | null;
}

export interface TournamentData {
  tournament: TournamentInfo;
  players: TournamentPlayer[];
  matches: TournamentMatch[];
  my_room_code: string | null;
}

export const TOURNAMENT_CODE_RE = /^\d{6}$/;
export const TOURNAMENT_NAME_MIN = 3;
export const TOURNAMENT_NAME_MAX = 40;
export const TOURNAMENT_SIZES = [4, 8] as const;

/** Round başlığı: son round Final, sondan bir önceki Yarı Final, ondan önceki Çeyrek Final. */
export function roundTitle(roundIndex: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Yarı Final';
  if (fromEnd === 2) return 'Çeyrek Final';
  return `${roundIndex + 1}. Tur`;
}

export const isLiveStatus = (status: string | null | undefined): boolean =>
  status === 'VS' || status === 'QUIZ';

export interface BracketColumn {
  index: number;
  title: string;
  /** Henüz oluşmamış maçlar için null (yer tutucu). */
  matches: (TournamentMatch | null)[];
}

/**
 * Maçları round sütunlarına yerleştirir (sunucuda round 1, slot 0 tabanlı;
 * round r slot s kazananı round r+1 slot s/2'ye geçer). Eksik maçlar yer tutucu olarak döner.
 */
export function buildBracket(size: number, rounds: number, matches: TournamentMatch[]): BracketColumn[] {
  const total = Math.max(1, rounds || Math.round(Math.log2(Math.max(2, size))));

  const columns: BracketColumn[] = [];
  for (let i = 0; i < total; i++) {
    const count = Math.max(1, Math.floor(size / 2 ** (i + 1)));
    const cells: (TournamentMatch | null)[] = Array.from({ length: count }, () => null);
    for (const m of matches) {
      if (m.round - 1 !== i) continue;
      if (m.slot >= 0 && m.slot < count) cells[m.slot] = m;
    }
    columns.push({ index: i, title: roundTitle(i, total), matches: cells });
  }
  return columns;
}
