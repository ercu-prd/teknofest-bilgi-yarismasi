import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Radar, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

/** Bu süreden sonra "kimse aramıyor olabilir" ipucu gösterilir. */
export const MATCHMAKING_HINT_AFTER_SECONDS = 60;

const formatElapsed = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/**
 * Hızlı eşleşme bekleme ekranı. Polling GameContext'te yürür; eşleşince
 * context otomatik olarak LOBBY ekranına geçer.
 */
export const MatchmakingScreen: React.FC = () => {
  const { myPlayer, cancelQuickMatch } = useGame();
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const handleCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      await cancelQuickMatch();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="flex flex-col items-center justify-center space-y-6 w-full max-w-md mx-auto py-4 px-1"
    >
      <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-bold font-subheading box-glow-cyan">
        <Radar className="w-4 h-4 text-cyan-400" /> HIZLI EŞLEŞME
      </span>

      {/* Radar / pulse */}
      <div className="relative w-56 h-56 flex items-center justify-center" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-full border-2 border-cyan-400/60"
            initial={{ scale: 0.35, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          />
        ))}
        <div className="absolute inset-6 rounded-full border border-slate-700/60" />
        <div className="absolute inset-14 rounded-full border border-slate-700/40" />
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: 'conic-gradient(from 0deg, rgba(34,211,238,0.35), transparent 25%)' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-4xl shadow-lg box-glow-cyan">
          {myPlayer.avatar}
        </div>
      </div>

      <div className="text-center space-y-1.5">
        <h2 className="text-sm font-bold text-white font-subheading truncate max-w-[18rem]">{myPlayer.name}</h2>
        <p className="text-lg font-black uppercase tracking-wider text-cyan-300 font-heading text-glow-cyan">
          Rakip aranıyor…
        </p>
        <p
          className="text-3xl font-black font-heading tabular-nums text-white"
          data-testid="matchmaking-elapsed"
          aria-label="Geçen süre"
        >
          {formatElapsed(elapsed)}
        </p>
      </div>

      {elapsed >= MATCHMAKING_HINT_AFTER_SECONDS && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <Card variant="purple" className="w-full p-4!">
            <p role="status" className="flex items-start gap-2 text-xs text-slate-300 font-medium">
              <Lightbulb className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              Şu an kimse aramıyor olabilir; bir arkadaşına oda kodu göndermeyi dene.
            </p>
          </Card>
        </motion.div>
      )}

      <Button variant="ghost" fullWidth onClick={() => void handleCancel()} disabled={cancelling}>
        <X className="w-4 h-4" /> İptal
      </Button>
    </motion.div>
  );
};

export default MatchmakingScreen;
