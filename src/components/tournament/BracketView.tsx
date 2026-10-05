import React from 'react';
import { Trophy, Radio } from 'lucide-react';
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
      <div
        data-result="empty"
        className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-950/40 text-[11px] italic text-slate-500"
      >
        <span className="w-6 h-6 rounded-md border border-dashed border-slate-700 shrink-0" />
        Bekleniyor
      </div>
    );
  }
  const styles: Record<SideResult, string> = {
    winner: 'bg-emerald-950/60 border border-emerald-500/50 text-white font-bold',
    loser: 'opacity-40 text-slate-400 border border-transparent',
    pending: 'bg-slate-950/50 text-slate-200 border border-transparent',
  };
  return (
    <div
      data-result={result}
      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all ${styles[result]}`}
    >
      <span className="w-6 h-6 rounded-md bg-slate-800/80 flex items-center justify-center text-sm shrink-0">
        {side.avatar}
      </span>
      <span className="truncate flex-1 font-subheading">
        {side.name}
        {side.is_me && <span className="text-cyan-300 font-bold"> (Sen)</span>}
      </span>
      {result === 'winner' && <Trophy className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-label="Kazanan" />}
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
        className="rounded-xl border border-dashed border-slate-800 bg-slate-950/30 p-3 text-center text-[11px] italic text-slate-500"
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
      className={`relative rounded-xl border p-1.5 space-y-1 bg-slate-900/70 ${
        mine ? 'border-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.35)]' : 'border-slate-800'
      }`}
    >
      {live && (
        <div className="absolute -top-2.5 right-2">
          <Badge variant="rose" size="sm" icon={<Radio className="w-3 h-3 animate-pulse" />}>
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
    <div className="w-full overflow-x-auto pb-2 -mx-1 px-1" data-testid="bracket">
      <div className="flex gap-3 min-w-max">
        {columns.map((col) => (
          <section key={col.index} className="w-44 shrink-0 flex flex-col">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-purple-300 font-subheading text-center mb-3">
              {col.title}
            </h3>
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
