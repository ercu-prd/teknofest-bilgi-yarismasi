import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useGame } from '../../context/GameContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Trophy, RefreshCw, Home, ExternalLink, Hourglass, Swords, UserX } from 'lucide-react';
import { APP_CONFIG } from '../../config/appConfig';
import { MatchReview } from '../result/MatchReview';
import { playSound, vibrate } from '../../lib/sound';

const InstagramIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

/** Kulüp logosunun renkleri. */
const CONFETTI_COLORS = ['#1f56a8', '#d3262d', '#ffffff', '#0f1e3a'];

interface ScoreColumnProps {
  avatar: string;
  name: string;
  score: number;
  isMe?: boolean;
  isWinner?: boolean;
}

const ScoreColumn: React.FC<ScoreColumnProps> = ({ avatar, name, score, isMe = false, isWinner = false }) => (
  <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
    <span
      className={`flex h-14 w-14 items-center justify-center rounded-full text-3xl ${
        isMe ? 'bg-brand-soft ring-2 ring-brand' : 'bg-subtle ring-1 ring-line-strong'
      }`}
      aria-hidden="true"
    >
      {avatar}
    </span>
    <span className="flex w-full min-w-0 items-center justify-center gap-1 text-sm font-medium text-ink">
      <span className="truncate">{name}</span>
      {isWinner && <Trophy className="h-4 w-4 shrink-0 text-warning" aria-label="Kazanan" />}
    </span>
    <span className={`text-xs ${isMe ? 'text-brand' : 'text-muted'}`}>{isMe ? 'Sen' : 'Rakip'}</span>
    <div className={`font-display tabular text-2xl font-bold leading-none ${isMe ? 'text-brand' : 'text-ink'}`}>
      {score} <span className="font-sans text-xs font-normal text-muted">puan</span>
    </div>
  </div>
);

export const ResultScreen: React.FC = () => {
  const {
    myPlayer,
    opponentPlayer,
    winner,
    isDraw,
    returnToLobby,
    leaveRoom,
    requestRematch,
    fetchMatchReview,
    roomTournamentCode,
    settings,
    errorMsg,
  } = useGame();

  const isMyVictory = winner?.id === myPlayer.id;
  const isOpponentVictory = Boolean(opponentPlayer && winner && winner.id === opponentPlayer.id);
  const opponentLeft = !opponentPlayer;
  const iWantRematch = Boolean(myPlayer.wantsRematch);
  const opponentWantsRematch = Boolean(opponentPlayer?.wantsRematch);

  useEffect(() => {
    playSound(isMyVictory ? 'win' : isDraw ? 'start' : 'lose');
    vibrate(isMyVictory ? [80, 40, 80, 40, 160] : 120);
  }, [isMyVictory, isDraw]);

  useEffect(() => {
    if (isMyVictory || isDraw) {
      try {
        confetti({
          particleCount: 85,
          spread: 75,
          origin: { y: 0.6 },
          colors: CONFETTI_COLORS,
        });
      } catch {
        // Fallback if canvas confetti blocked
      }
    }
  }, [isMyVictory, isDraw]);

  const handleInstagramClick = () => {
    if (APP_CONFIG.instagramUrl) {
      window.open(APP_CONFIG.instagramUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const title = isDraw ? 'Berabere' : isMyVictory ? 'Kazandın' : 'Kaybettin';
  const subtitle =
    opponentLeft && !isDraw
      ? 'Rakibin maçtan ayrıldı, galibiyet senin.'
      : isDraw
        ? 'Skorlar eşit.'
        : isMyVictory
          ? `İyi oyundu, ${myPlayer.name}.`
          : `Kazanan: ${winner ? winner.name : 'Rakip'}. Bir dahaki sefere.`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex w-full flex-col gap-4"
    >
      {/* Sonuç başlığı */}
      <div className="space-y-1 pt-1 text-center">
        <h1 className={`text-3xl font-bold ${isMyVictory ? 'text-brand' : 'text-ink'}`}>{title}</h1>
        <p className="text-sm text-ink-soft">{subtitle}</p>
      </div>

      {/* Skorlar */}
      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <ScoreColumn avatar={myPlayer.avatar} name={myPlayer.name} score={myPlayer.score} isMe isWinner={isMyVictory} />
          <ScoreColumn
            avatar={opponentPlayer ? opponentPlayer.avatar : '👤'}
            name={opponentPlayer ? opponentPlayer.name : 'Rakip'}
            score={opponentPlayer ? opponentPlayer.score : 0}
            isWinner={isOpponentVictory}
          />
        </div>
        <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
          <span className="text-ink-soft">Doğru cevap</span>
          <span className="tabular font-semibold text-ink">
            {myPlayer.correctAnswers} / {settings.questionCount}
          </span>
        </div>
      </Card>

      <MatchReview load={fetchMatchReview} opponentName={opponentPlayer?.name ?? 'Rakip'} />

      {/* Instagram */}
      <Card variant="muted" className="space-y-3">
        <p className="text-sm font-medium text-ink">OKÜ TEKNOFEST Kulübü'nü Instagram'da takip et</p>
        <Button variant="secondary" fullWidth onClick={handleInstagramClick}>
          <InstagramIcon className="h-4 w-4" />
          <span>Instagram'da aç</span>
          <ExternalLink className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
        </Button>
      </Card>

      {/* Eylemler */}
      <div className="w-full space-y-2.5 pt-1">
        {errorMsg && (
          <p role="alert" className="rounded-xl bg-danger-soft p-3 text-center text-sm text-danger">
            {errorMsg}
          </p>
        )}

        {roomTournamentCode ? (
          <Button variant="primary" size="lg" fullWidth onClick={() => void leaveRoom()}>
            <Trophy className="h-5 w-5" aria-hidden="true" />
            <span>Turnuvaya dön</span>
          </Button>
        ) : opponentLeft ? (
          <>
            <p className="flex items-center justify-center gap-1.5 text-sm text-ink-soft">
              <UserX className="h-4 w-4" aria-hidden="true" /> Rakibin odadan ayrıldı.
            </p>
            <Button variant="primary" size="lg" fullWidth onClick={() => void returnToLobby()}>
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
              <span>Yeni rakip bekle</span>
            </Button>
          </>
        ) : iWantRematch ? (
          <>
            <div className="flex items-center justify-center gap-2 rounded-xl border border-brand-line bg-brand-soft p-3 text-sm text-ink">
              <Hourglass className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              <span>Rövanş isteği gönderildi, {opponentPlayer?.name} bekleniyor…</span>
            </div>
            <Button variant="secondary" size="md" fullWidth onClick={() => void requestRematch(false)}>
              İsteği geri çek
            </Button>
          </>
        ) : (
          <>
            {opponentWantsRematch && (
              <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-ink">
                <Swords className="h-4 w-4 text-brand" aria-hidden="true" /> {opponentPlayer?.name} rövanş istiyor.
              </p>
            )}
            <Button variant="primary" size="lg" fullWidth onClick={() => void requestRematch(true)}>
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
              <span>{opponentWantsRematch ? 'Rövanşı kabul et' : 'Rövanş iste'}</span>
            </Button>
          </>
        )}

        <Button variant="ghost" size="lg" fullWidth onClick={() => void leaveRoom()}>
          <Home className="h-5 w-5" aria-hidden="true" />
          <span>Ana menü</span>
        </Button>
      </div>
    </motion.div>
  );
};
