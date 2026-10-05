import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { LogoSpinner } from '../ui/LogoSpinner';

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex w-full flex-col items-center gap-6 pt-8"
    >
      <LogoSpinner size={96} label="Rakip aranıyor" />

      <div className="space-y-1 text-center">
        <h2 className="text-xl font-semibold">Rakip aranıyor…</h2>
        <p
          className="font-display text-4xl font-bold text-ink tabular"
          data-testid="matchmaking-elapsed"
          aria-label="Geçen süre"
        >
          {formatElapsed(elapsed)}
        </p>
      </div>

      <div className="flex max-w-full items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-lg">
          {myPlayer.avatar}
        </span>
        <span className="truncate text-sm font-medium text-ink">{myPlayer.name}</span>
      </div>

      {elapsed >= MATCHMAKING_HINT_AFTER_SECONDS && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full"
        >
          <Card variant="muted" padding="sm">
            <p role="status" className="flex items-start gap-2 text-sm text-ink-soft">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              Şu an kimse aramıyor olabilir; bir arkadaşına oda kodu göndermeyi dene.
            </p>
          </Card>
        </motion.div>
      )}

      <Button variant="secondary" size="lg" fullWidth onClick={() => void handleCancel()} disabled={cancelling}>
        İptal
      </Button>
    </motion.div>
  );
};

export default MatchmakingScreen;
