import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../../context/GameContext';
import { serverNow } from '../../lib/serverClock';
import { playSound } from '../../lib/sound';

interface PlayerSideProps {
  avatar: string;
  name: string;
  label: string;
  isMe?: boolean;
}

const PlayerSide: React.FC<PlayerSideProps> = ({ avatar, name, label, isMe = false }) => (
  <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
    <div
      className={`flex h-20 w-20 items-center justify-center rounded-full bg-surface text-4xl ring-2 ${
        isMe ? 'ring-brand' : 'ring-line-strong'
      }`}
    >
      <span aria-hidden="true">{avatar}</span>
    </div>
    <div className="w-full min-w-0">
      <h3 className="truncate text-base font-semibold text-ink">{name}</h3>
      <p className={`text-xs ${isMe ? 'text-brand' : 'text-muted'}`}>{label}</p>
    </div>
  </div>
);

export const VsScreen: React.FC = () => {
  const { myPlayer, opponentPlayer, matchStartTime, setScreen, settings } = useGame();
  // Fallback deadline if the server start time hasn't arrived yet (fixed at mount, so it can't stall).
  const [fallbackStart] = useState<number>(() => serverNow() + settings.countdownSeconds * 1000);
  const startAt = matchStartTime ?? fallbackStart;
  const [countdown, setCountdown] = useState<number>(() => Math.max(0, Math.ceil((startAt - serverNow()) / 1000)));
  const switchedRef = useRef(false);
  const lastBeepRef = useRef<number | null>(null);

  useEffect(() => {
    if (lastBeepRef.current === countdown) return;
    lastBeepRef.current = countdown;
    playSound(countdown > 0 ? 'tick' : 'start');
  }, [countdown]);

  useEffect(() => {
    const update = () => {
      const remaining = Math.max(0, Math.ceil((startAt - serverNow()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0 && !switchedRef.current) {
        switchedRef.current = true;
        setScreen('QUIZ');
      }
    };
    const timer = setInterval(update, 200);
    update();
    return () => clearInterval(timer);
  }, [startAt, setScreen]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-10"
    >
      <div className="flex w-full items-center gap-3">
        <PlayerSide avatar={myPlayer.avatar} name={myPlayer.name} label="Sen" isMe />
        <span className="shrink-0 text-sm font-medium text-muted">vs</span>
        <PlayerSide
          avatar={opponentPlayer ? opponentPlayer.avatar : '👤'}
          name={opponentPlayer ? opponentPlayer.name : 'Rakip'}
          label="Rakip"
        />
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex h-24 items-center justify-center" aria-live="polite">
          <AnimatePresence mode="wait">
            {countdown > 0 ? (
              <motion.span
                key={countdown}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="font-display tabular text-7xl font-bold leading-none text-brand"
              >
                {countdown}
              </motion.span>
            ) : (
              <motion.span
                key="start"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18 }}
                className="text-2xl font-semibold text-ink"
              >
                Başlıyor
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <p className="text-sm text-muted">
          {settings.matchSeconds} saniye · {settings.questionCount} soru
        </p>
      </div>
    </motion.div>
  );
};
