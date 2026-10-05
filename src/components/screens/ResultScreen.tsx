import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useGame } from '../../context/GameContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Trophy, RefreshCw, Home, ExternalLink, Sparkles } from 'lucide-react';
import { APP_CONFIG } from '../../config/appConfig';

const InstagramIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
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
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

export const ResultScreen: React.FC = () => {
  const { myPlayer, opponentPlayer, winner, isDraw, returnToLobby, leaveRoom } = useGame();

  const isMyVictory = winner?.id === myPlayer.id;

  useEffect(() => {
    if (isMyVictory || isDraw) {
      try {
        confetti({
          particleCount: 85,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#00f0ff', '#a855f7', '#ec4899', '#eab308'],
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-between space-y-4 w-full max-w-md mx-auto py-2 px-1"
    >
      {/* Victory Header Banner */}
      <div className="text-center space-y-2">
        <motion.div
          initial={{ y: -10 }}
          animate={{ y: 0 }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-bold font-subheading box-glow-cyan"
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>MAÇ TAMAMLANDI</span>
        </motion.div>

        <h1 className="text-3xl font-black uppercase font-heading tracking-tight text-white">
          {isDraw ? (
            <span className="text-amber-400 text-glow-cyan">BERABERE!</span>
          ) : isMyVictory ? (
            <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent text-glow-cyan">
              ZAFER SENİN!
            </span>
          ) : (
            <span className="text-purple-400 text-glow-purple">
              MAÇ KAYBEDİLDİ
            </span>
          )}
        </h1>
        <p className="text-xs text-slate-400 font-medium">
          {isDraw
            ? 'Mükemmel kapışma! Skorlar eşit.'
            : isMyVictory
            ? `Tebrikler ${myPlayer.name}, harika bir performans gösterdin!`
            : `Kazanan: ${winner ? winner.name : 'Rakip'}. Bir dahaki sefere!`}
        </p>
      </div>

      {/* Head to Head Score Showdown Box */}
      <Card variant={isMyVictory ? 'cyan' : 'purple'} glow className="w-full space-y-4">
        <div className="grid grid-cols-2 gap-4 items-center border-b border-slate-800 pb-4">
          {/* My Player Summary (Left) */}
          <div className="flex flex-col items-center text-center space-y-1.5">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-3xl shadow-lg box-glow-cyan">
                {myPlayer.avatar}
              </div>
              {isMyVictory && (
                <span className="absolute -top-2 -right-2 p-1 bg-amber-400 text-black rounded-full shadow-lg animate-bounce">
                  <Trophy className="w-4 h-4" />
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-white font-subheading truncate max-w-[100px]">
              {myPlayer.name} (Sen)
            </span>
            <div className="text-2xl font-black font-heading text-cyan-300">
              {myPlayer.score} <span className="text-[10px] font-normal text-slate-400">Puan</span>
            </div>
          </div>

          {/* Opponent Summary (Right) */}
          <div className="flex flex-col items-center text-center space-y-1.5 border-l border-slate-800 pl-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-3xl shadow-lg box-glow-purple">
                {opponentPlayer ? opponentPlayer.avatar : '⚡'}
              </div>
              {winner?.id === opponentPlayer?.id && (
                <span className="absolute -top-2 -right-2 p-1 bg-amber-400 text-black rounded-full shadow-lg animate-bounce">
                  <Trophy className="w-4 h-4" />
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-white font-subheading truncate max-w-[100px]">
              {opponentPlayer ? opponentPlayer.name : 'Rakip'}
            </span>
            <div className="text-2xl font-black font-heading text-purple-300">
              {opponentPlayer ? opponentPlayer.score : 0} <span className="text-[10px] font-normal text-slate-400">Puan</span>
            </div>
          </div>
        </div>

        {/* Detailed Stats Grid */}
        <div className="grid grid-cols-2 gap-2 text-center pt-1">
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase font-subheading block">
              DOĞRU CEVAP
            </span>
            <span className="text-sm font-extrabold text-emerald-400 font-heading">
              {myPlayer.correctAnswers} / 10
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase font-subheading block">
              DOĞRULANMIŞ PUAN
            </span>
            <span className="text-sm font-extrabold text-cyan-400 font-heading">
              {myPlayer.score} Puan
            </span>
          </div>
        </div>
      </Card>

      {/* Animated Instagram Follow Section (Visible to both Winner & Loser) */}
      <motion.div
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="w-full relative overflow-hidden rounded-2xl p-4 bg-gradient-to-r from-purple-950/90 via-pink-950/80 to-amber-950/90 border border-pink-500/40 shadow-xl box-glow-purple text-center space-y-3"
      >
        <div className="flex items-center justify-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-md">
            <InstagramIcon className="w-5 h-5" />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-pink-400 font-subheading block flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> TEKNOFEST TOPLULUĞU
            </span>
            <h3 className="text-xs font-bold text-white font-subheading leading-tight">
              Gelişmelerden & Etkinliklerden Haberdar Ol!
            </h3>
          </div>
        </div>

        <button
          onClick={handleInstagramClick}
          className="w-full relative inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-heading font-extrabold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 shadow-lg hover:brightness-110 active:scale-[0.98] transition-all duration-200 cursor-pointer"
        >
          <InstagramIcon className="w-4 h-4" />
          <span>TEKNOFEST OKÜ'yü Instagram'da Takip Et</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-80" />
        </button>
      </motion.div>

      {/* Action Buttons */}
      <div className="w-full space-y-2.5 pt-1">
        <Button
          variant="cyan"
          size="lg"
          fullWidth
          onClick={() => void returnToLobby()}
        >
          <RefreshCw className="w-5 h-5" />
          <span>TEKRAR OYNA</span>
        </Button>

        <Button
          variant="ghost"
          size="lg"
          fullWidth
          onClick={() => void leaveRoom()}
        >
          <Home className="w-5 h-5" />
          <span>ANA MENÜYE DÖN</span>
        </Button>
      </div>
    </motion.div>
  );
};
