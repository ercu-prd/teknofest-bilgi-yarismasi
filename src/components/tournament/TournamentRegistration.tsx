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
      <Card className="text-center space-y-4">
        <div className="space-y-1.5">
          <Badge variant="brand" size="sm">Kayıt açık</Badge>
          <h1 className="text-xl font-semibold text-ink break-words">{tournament.name}</h1>
        </div>
        <div>
          <span className="block text-xs text-muted">Turnuva kodu</span>
          <div
            data-testid="tournament-code"
            className="inline-block mt-1 font-display text-4xl font-semibold tabular tracking-[0.15em] text-brand bg-brand-soft px-5 py-2 rounded-xl"
          >
            {tournament.code}
          </div>
        </div>
        <div className="flex justify-center">
          <RoomQrCode url={link} size={160} />
        </div>
        <Button variant="secondary" onClick={() => void handleShare()} className="mx-auto">
          {shareResult === 'copied' || shareResult === 'shared' ? (
            <Check className="w-4 h-4 text-success" />
          ) : (
            <Share2 className="w-4 h-4" />
          )}
          Davet linkini paylaş
        </Button>
        {shareResult && (
          <p role="status" className="text-xs text-muted">
            {SHARE_LABEL[shareResult]}
          </p>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Users className="w-4 h-4 text-ink-soft" /> Kayıtlı oyuncular
          </h2>
          <span className="font-display text-lg font-semibold tabular text-ink-soft" data-testid="player-count">
            {players.length}/{tournament.size}
          </span>
        </div>
        {players.length === 0 ? (
          <p className="text-sm text-muted">Henüz kimse kayıt olmadı.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {players.map((p, i) => (
              <li
                key={`${p.name}-${i}`}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm border min-w-0 ${
                  p.is_me ? 'border-brand-line bg-brand-soft text-ink' : 'border-line bg-surface text-ink'
                }`}
              >
                <span className="text-base shrink-0" aria-hidden="true">{p.avatar}</span>
                <span className="truncate">
                  {p.name}
                  {p.is_me && <span className="text-brand font-medium"> (Sen)</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="w-full space-y-2.5">
        {tournament.is_organizer && (
          <>
            <Button variant="primary" size="lg" fullWidth disabled={missing > 0 || busy !== null} onClick={onStart}>
              {busy === 'start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Turnuvayı başlat
            </Button>
            {missing > 0 && (
              <p className="text-center text-sm text-muted">{missing} oyuncu daha bekleniyor</p>
            )}
          </>
        )}
        {!tournament.is_organizer && (
          <p className="text-center text-sm text-muted">Organizatörün turnuvayı başlatması bekleniyor…</p>
        )}
        {tournament.am_registered ? (
          <Button variant="ghost" fullWidth onClick={onLeave} disabled={busy !== null}>
            {busy === 'leave' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Ayrıl
          </Button>
        ) : (
          <Button variant={tournament.is_organizer ? 'secondary' : 'primary'} size="lg" fullWidth onClick={onJoin} disabled={busy !== null || missing === 0}>
            {busy === 'join' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Katıl
          </Button>
        )}
      </div>
    </div>
  );
};

export default TournamentRegistration;
