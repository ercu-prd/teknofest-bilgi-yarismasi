import React, { useState } from 'react';
import { Check, Loader2, LogIn, LogOut, Play, Share2, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { RoomQrCode } from '../ui/RoomQrCode';
import { buildTournamentLink } from '../../lib/roomLink';
import { shareOrCopy, type ShareResult } from '../../lib/clipboard';
import type { TournamentData } from './types';

interface TournamentRegistrationProps {
  data: TournamentData;
  busy: 'join' | 'leave' | 'start' | null;
  onJoin: () => void;
  onLeave: () => void;
  onStart: () => void;
}

const SHARE_LABEL: Record<ShareResult, string> = {
  shared: 'Paylaşıldı',
  copied: 'Davet linki kopyalandı',
  failed: 'Paylaşılamadı',
};

export const TournamentRegistration: React.FC<TournamentRegistrationProps> = ({
  data,
  busy,
  onJoin,
  onLeave,
  onStart,
}) => {
  const { tournament, players } = data;
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const link = buildTournamentLink(tournament.code);
  const missing = Math.max(0, tournament.size - players.length);

  const handleShare = async () => {
    const result = await shareOrCopy({
      title: tournament.name,
      text: `"${tournament.name}" bilgi yarışması turnuvasına katıl! Kod: ${tournament.code}`,
      url: link,
    });
    setShareResult(result);
    setTimeout(() => setShareResult(null), 2500);
  };

  return (
    <div className="w-full space-y-4">
      <Card variant="cyan" glow className="w-full text-center space-y-3">
        <Badge variant="purple" size="sm">Kayıt Açık</Badge>
        <h1 className="text-xl font-black text-white font-heading break-words">{tournament.name}</h1>
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 font-subheading">
            Turnuva Kodu
          </span>
          <div
            data-testid="tournament-code"
            className="inline-block mt-1 text-4xl font-black font-heading tracking-widest text-cyan-300 text-glow-cyan bg-slate-950/80 px-6 py-2.5 rounded-xl border border-cyan-500/40"
          >
            {tournament.code}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void handleShare()} className="mx-auto">
          {shareResult === 'copied' || shareResult === 'shared' ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Share2 className="w-4 h-4" />
          )}
          Davet linkini paylaş
        </Button>
        {shareResult && (
          <p role="status" className="text-[11px] text-slate-400">
            {SHARE_LABEL[shareResult]}
          </p>
        )}
        <div className="flex justify-center">
          <RoomQrCode url={link} size={160} />
        </div>
      </Card>

      <Card className="w-full space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white font-subheading">
            <Users className="w-4 h-4 text-cyan-400" /> Kayıtlı Oyuncular
          </h2>
          <span className="text-sm font-black text-cyan-300 font-heading" data-testid="player-count">
            {players.length}/{tournament.size}
          </span>
        </div>
        {players.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Henüz kimse kayıt olmadı.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {players.map((p, i) => (
              <li
                key={`${p.name}-${i}`}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs border ${
                  p.is_me ? 'border-cyan-400/70 bg-cyan-950/40 text-white' : 'border-slate-800 bg-slate-950/50 text-slate-200'
                }`}
              >
                <span className="text-base">{p.avatar}</span>
                <span className="truncate font-subheading">
                  {p.name}
                  {p.is_me && <span className="text-cyan-300 font-bold"> (Sen)</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="w-full space-y-2.5">
        {tournament.is_organizer && (
          <>
            <Button variant="cyan" size="lg" fullWidth disabled={missing > 0 || busy !== null} onClick={onStart}>
              {busy === 'start' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              Turnuvayı Başlat
            </Button>
            {missing > 0 && (
              <p className="text-center text-xs text-amber-300 font-bold">{missing} oyuncu daha bekleniyor</p>
            )}
          </>
        )}
        {!tournament.is_organizer && (
          <p className="text-center text-xs text-slate-400">Organizatörün turnuvayı başlatması bekleniyor…</p>
        )}
        {tournament.am_registered ? (
          <Button variant="ghost" fullWidth onClick={onLeave} disabled={busy !== null}>
            {busy === 'leave' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Ayrıl
          </Button>
        ) : (
          <Button variant="purple" fullWidth onClick={onJoin} disabled={busy !== null || missing === 0}>
            {busy === 'join' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Katıl
          </Button>
        )}
      </div>
    </div>
  );
};

export default TournamentRegistration;
