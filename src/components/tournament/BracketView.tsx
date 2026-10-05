import React from 'react';
import { Check } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { buildBracket, isLiveStatus, type MatchSide, type TournamentMatch } from './types';

interface BracketViewProps {
  size: number;
  rounds: number;
  matches: TournamentMatch[];
}

type SideResult = 'winner' | 'loser' | 'pending';

const SideRow: React.FC<{ side: MatchSide | null; result: SideResult }> = ({ side, result }) => {
  if (!side) {
    return (
      <div data-result="empty" className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted">
        <span className="w-6 h-6 rounded-full border border-dashed border-line-strong shrink-0" />
        Bekleniyor
      </div>
    );
  }
  const styles: Record<SideResult, string> = {
    winner: 'text-ink font-semibold',
    loser: 'text-muted',
    pending: 'text-ink',
  };
  return (
    <div data-result={result} className={`flex items-center gap-2 px-2.5 py-2 text-sm ${styles[result]}`}>
      <span className="w-6 h-6 rounded-full bg-subtle flex items-center justify-center text-sm shrink-0" aria-hidden="true">
        {side.avatar}
      </span>
      <span className="truncate flex-1">
        {side.name}
        {side.is_me && <span className="text-brand font-medium"> (Sen)</span>}
      </span>
      {result === 'winner' && <Check className="w-4 h-4 text-success shrink-0" aria-label="Kazanan" />}
    </div>
  );
};

const resultFor = (match: TournamentMatch, side: 'a' | 'b'): SideResult => {
  if (!match.winner_side) return 'pending';
  return match.winner_side === side ? 'winner' : 'loser';
};

const MatchCard: React.FC<{ match: TournamentMatch | null }> = ({ match }) => {
  if (!match) {
    return (
      <div
        data-testid="bracket-placeholder"
        className="rounded-xl border border-dashed border-line px-3 py-5 text-center text-xs text-muted"
      >
        Bekleniyor
      </div>
    );
  }
  const mine = Boolean(match.player_a?.is_me || match.player_b?.is_me);
  const live = isLiveStatus(match.room_status);
  return (
    <div
      data-testid="bracket-match"
      data-mine={mine ? 'true' : 'false'}
      className={`relative rounded-xl border bg-surface divide-y divide-line ${
        mine ? 'border-brand ring-1 ring-brand' : 'border-line'
      }`}
    >
      {live && (
        <div className="absolute -top-3 right-2">
          <Badge variant="accent" size="sm">
            Canlı
          </Badge>
        </div>
      )}
      <SideRow side={match.player_a} result={resultFor(match, 'a')} />
      <SideRow side={match.player_b} result={resultFor(match, 'b')} />
    </div>
  );
};

export const BracketView: React.FC<BracketViewProps> = ({ size, rounds, matches }) => {
  const columns = buildBracket(size, rounds, matches);
  return (
    <div className="w-full overflow-x-auto pb-2 pt-1" data-testid="bracket">
      <div className="flex gap-3 min-w-max">
        {columns.map((col) => (
          <section key={col.index} className="w-44 shrink-0 flex flex-col">
            <h3 className="text-sm font-semibold text-ink-soft mb-3">{col.title}</h3>
            <div className="flex flex-col justify-around flex-1 gap-4">
              {col.matches.map((m, i) => (
                <MatchCard key={m ? `${m.round}-${m.slot}` : `ph-${col.index}-${i}`} match={m} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default BracketView;
