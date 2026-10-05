import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../../context/GameContext';
import { copyText, shareOrCopy } from '../../lib/clipboard';
import { buildRoomLink } from '../../lib/roomLink';
import { usePlayerOnline } from '../../hooks/usePlayerPresence';
import { RoomQrCode } from '../ui/RoomQrCode';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { LogoSpinner } from '../ui/LogoSpinner';
import { Copy, Check, ArrowLeft, UserPlus, Share2, QrCode, WifiOff, Trophy } from 'lucide-react';
import type { Player } from '../../types/game';

interface PlayerRowProps {
  player: Player;
  role: string;
  isMe: boolean;
  disconnected: boolean;
}

const PlayerRow: React.FC<PlayerRowProps> = ({ player, role, isMe, disconnected }) => (
  <Card variant={isMe ? 'brand' : 'default'} padding="sm" className="flex items-center gap-3">
    <div
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl ${
        isMe ? 'bg-surface ring-1 ring-brand-line' : 'bg-subtle'
      }`}
      aria-hidden="true"
    >
      {player.avatar}
    </div>
    <div className="min-w-0 flex-1">
      <h3 className={`truncate text-[15px] font-semibold ${isMe ? 'text-brand' : 'text-ink'}`}>
        {player.name}
        {isMe ? ' (Sen)' : ''}
      </h3>
      <p className="text-xs text-muted">{role}</p>
    </div>
    <div className="flex shrink-0 flex-col items-end gap-1">
      {disconnected && (
        <span title="Son 45 saniyedir sinyal yok">
          <Badge variant="danger" size="sm" icon={<WifiOff className="h-3 w-3" />}>
            Bağlantı koptu
          </Badge>
        </span>
      )}
      {player.isReady ? (
        <Badge variant="success" size="sm" icon={<Check className="h-3.5 w-3.5" strokeWidth={2.5} />}>
          Hazır
        </Badge>
      ) : (
        <Badge variant="neutral" size="sm">
          Bekliyor
        </Badge>
      )}
    </div>
  </Card>
);

export const LobbyScreen: React.FC = () => {
  const {
    roomCode,
    myPlayerId,
    player1,
    player2,
    toggleReady,
    isStarting,
    leaveRoom,
    opponentPlayer,
    roomTournamentCode,
    errorMsg,
  } = useGame();
  const [showQr, setShowQr] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const opponentOnline = usePlayerOnline(opponentPlayer?.lastSeenAt);
  const roomLink = buildRoomLink(roomCode);

  const handleShare = async () => {
    const result = await shareOrCopy({
      title: 'OKÜ TEKNOFEST Bilgi Yarışması',
      text: `Benimle 1v1 bilgi düellosuna gel! Oda kodu: ${roomCode}`,
      url: roomLink,
    });
    if (result === 'copied') {
      setShareNote('Davet linki kopyalandı');
      setTimeout(() => setShareNote(null), 2500);
    }
  };

  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    // Works over plain HTTP too (LAN demos), where navigator.clipboard is undefined.
    if (await copyText(roomCode)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasTwoPlayers = Boolean(player1 && player1.id && player2 && player2.id);
  const isMePlayer1 = myPlayerId === player1.id;
  const myPlayerObj = isMePlayer1 ? player1 : player2;

  const bothReady = Boolean(player1.isReady && player2 && player2.isReady);
  const onlyOneReady = (player1.isReady && !player2?.isReady) || (!player1.isReady && player2?.isReady);

  const statusMessage = !hasTwoPlayers
    ? 'İkinci oyuncunun katılması bekleniyor.'
    : bothReady
      ? 'İkiniz de hazırsınız, maç başlıyor.'
      : onlyOneReady
        ? myPlayerObj?.isReady
          ? 'Rakibinin hazır olması bekleniyor.'
          : 'Rakibin hazır. Başlamak için "Hazırım"a bas.'
        : 'İkiniz de "Hazırım" deyince maç başlar.';
  const showStatusSpinner = !hasTwoPlayers || bothReady;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex w-full flex-col gap-4"
    >
      <div>
        <Button variant="ghost" className="-ml-2" onClick={() => void leaveRoom()}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>{roomTournamentCode ? 'Turnuvaya dön' : 'Ana menü'}</span>
        </Button>
      </div>

      {errorMsg && (
        <p role="alert" className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          {errorMsg}
        </p>
      )}

      {roomTournamentCode ? (
        <Card variant="muted" className="flex items-start gap-3">
          <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-base font-semibold">Turnuva maçı</h2>
            <p className="text-sm text-ink-soft">
              Eşleşmen hazır. Odadan ayrılırsan hükmen mağlup sayılırsın.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="space-y-3 text-center">
          <p className="text-sm font-medium text-ink-soft">Oda kodu</p>
          <div className="flex items-center justify-center gap-2">
            <span className="font-display text-5xl font-bold leading-none tracking-[0.08em] text-ink tabular">
              {roomCode}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              aria-label="Kodu kopyala"
              title="Kodu kopyala"
              className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-line text-ink-soft transition-colors hover:bg-subtle hover:text-ink"
            >
              {copied ? (
                <Check className="h-5 w-5 text-success" aria-hidden="true" />
              ) : (
                <Copy className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted">Rakibinin katılması için bu kodu paylaş.</p>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" fullWidth onClick={() => void handleShare()}>
              <Share2 className="h-4 w-4" aria-hidden="true" />
              <span>Davet linki</span>
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setShowQr((v) => !v)} aria-expanded={showQr}>
              <QrCode className="h-4 w-4" aria-hidden="true" />
              <span>{showQr ? 'QR gizle' : 'QR göster'}</span>
            </Button>
          </div>
          {shareNote && (
            <p role="status" className="text-xs font-medium text-success">
              {shareNote}
            </p>
          )}
          {showQr && (
            <div className="flex justify-center pt-1">
              <RoomQrCode url={roomLink} size={176} />
            </div>
          )}
        </Card>
      )}

      {/* Oyuncular */}
      <div className="space-y-2">
        <PlayerRow
          player={player1}
          role="Ev sahibi"
          isMe={isMePlayer1}
          disconnected={!isMePlayer1 && !opponentOnline}
        />
        {player2 && player2.id ? (
          <PlayerRow
            player={player2}
            role="Katılımcı"
            isMe={!isMePlayer1}
            disconnected={isMePlayer1 && !opponentOnline}
          />
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line-strong p-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-subtle text-muted">
              <UserPlus className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="text-[15px] font-medium text-muted">Rakip bekleniyor</span>
          </div>
        )}
      </div>

      <div className="flex min-h-6 items-center justify-center gap-2 text-center text-sm text-ink-soft">
        {showStatusSpinner && <LogoSpinner size={18} label={bothReady ? 'Maç başlıyor' : 'Bekleniyor'} />}
        <span>{statusMessage}</span>
      </div>

      <Button
        variant={myPlayerObj?.isReady ? 'secondary' : 'primary'}
        size="lg"
        fullWidth
        onClick={toggleReady}
        disabled={isStarting || !hasTwoPlayers}
      >
        {myPlayerObj?.isReady ? 'Hazır değilim' : 'Hazırım'}
      </Button>
    </motion.div>
  );
};
