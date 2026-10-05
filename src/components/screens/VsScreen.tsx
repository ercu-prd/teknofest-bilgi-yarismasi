import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../../context/GameContext';
import { Swords, Zap, Flame } from 'lucide-react';
import { serverNow } from '../../lib/serverClock';

export const VsScreen: React.FC = () => {
  const { myPlayer, opponentPlayer, matchStartTime, setScreen, settings } = useGame();
  // Fallback deadline if the server start time hasn't arrived yet (fixed at mount, so it can't stall).
  const [fallbackStart] = useState<number>(() => serverNow() + settings.countdownSeconds * 1000);
  const startAt = matchStartTime ?? fallbackStart;
  const [countdown, setCountdown] = useState<number>(() => Math.max(0, Math.ceil((startAt - serverNow()) / 1000)));
  const switchedRef = useRef(false);

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
      className="flex flex-col items-center justify-between min-h-[80vh] w-full max-w-md mx-auto py-4 px-2"
    >
      {/* Top Banner */}
      <div className="text-center space-y-1">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/80 border border-purple-500/40 text-purple-300 text-xs font-bold font-subheading box-glow-purple"
        >
          <Swords className="w-4 h-4 text-purple-400" />
          <span>ESPORTS DÜELLO KARŞILAŞMASI</span>
        </motion.div>
        <h2 className="text-2xl font-black uppercase font-heading text-white tracking-wider">
          ARENA KARŞILAŞMASI
        </h2>
      </div>

      {/* Main VS Showdown Stage */}
      <div className="relative w-full flex items-center justify-between py-8 my-auto">
        {/* Left Player (Cyan) - SEN */}
        <motion.div
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 120 }}
          className="flex flex-col items-center space-y-3 z-10 w-2/5 text-center"
        >
          <div className="relative">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-cyan-500 via-teal-500 to-blue-600 flex items-center justify-center text-5xl shadow-2xl box-glow-cyan border-2 border-cyan-300">
              {myPlayer.avatar}
            </div>
            <span className="absolute -bottom-2 px-3 py-0.5 rounded-full bg-cyan-950 border border-cyan-400 text-cyan-300 text-[10px] font-extrabold uppercase font-subheading">
              SEN
            </span>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white font-subheading truncate max-w-[130px]">
              {myPlayer.name}
            </h3>
            <span className="text-xs text-cyan-400 font-bold font-subheading flex items-center justify-center gap-1">
              <Flame className="w-3.5 h-3.5" /> {myPlayer.isHost ? 'Ev Sahibi' : 'Katılımcı'}
            </span>
          </div>
        </motion.div>

        {/* Center Animated VS Badge */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="flex flex-col items-center justify-center"
          >
            <div className="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-950 border-4 border-amber-400 text-amber-400 shadow-2xl box-glow-purple">
              <span className="text-2xl sm:text-3xl font-black font-heading tracking-widest text-glow-purple">
                VS
              </span>
            </div>
          </motion.div>
        </div>

        {/* Right Player (Purple) - RAKİP */}
        <motion.div
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 120 }}
          className="flex flex-col items-center space-y-3 z-10 w-2/5 text-center"
        >
          <div className="relative">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-700 flex items-center justify-center text-5xl shadow-2xl box-glow-purple border-2 border-purple-300">
              {opponentPlayer ? opponentPlayer.avatar : '⚡'}
            </div>
            <span className="absolute -bottom-2 px-3 py-0.5 rounded-full bg-purple-950 border border-purple-400 text-purple-300 text-[10px] font-extrabold uppercase font-subheading">
              RAKİP
            </span>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white font-subheading truncate max-w-[130px]">
              {opponentPlayer ? opponentPlayer.name : 'Rakip'}
            </h3>
            <span className="text-xs text-purple-400 font-bold font-subheading flex items-center justify-center gap-1">
              <Zap className="w-3.5 h-3.5" /> Rakip
            </span>
          </div>
        </motion.div>
      </div>

      {/* Countdown Display Area */}
      <div className="flex flex-col items-center space-y-3 w-full">
        <AnimatePresence mode="wait">
          {countdown > 0 ? (
            <motion.div
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="text-6xl font-black font-heading text-cyan-300 text-glow-cyan"
            >
              {countdown}
            </motion.div>
          ) : (
            <motion.div
              key="start"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.1, opacity: 1 }}
              className="text-2xl sm:text-3xl font-black uppercase font-heading bg-gradient-to-r from-amber-400 via-rose-500 to-cyan-400 bg-clip-text text-transparent"
            >
              DÜELLO BAŞLIYOR!
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-xs text-slate-400 font-medium font-subheading">
          {settings.matchSeconds} Saniye • {settings.questionCount} Soru • En Yüksek Skor Kazanır
        </p>
      </div>
    </motion.div>
  );
};
