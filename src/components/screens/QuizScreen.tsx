import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../../context/GameContext';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Clock, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { serverNow } from '../../lib/serverClock';
import { APP_CONFIG } from '../../config/appConfig';

type QuestionState = 'IDLE' | 'SUBMITTING' | 'FEEDBACK';

export const QuizScreen: React.FC = () => {
  const {
    myPlayer,
    opponentPlayer,
    questions,
    currentQuestionIndex,
    matchStartTime,
    answerQuestion,
    advanceQuestionIndex,
    finishQuiz,
    settings,
  } = useGame();
  const matchSeconds = settings.matchSeconds;

  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (!matchStartTime) return matchSeconds;
    const elapsed = Math.floor((serverNow() - matchStartTime) / 1000);
    return Math.max(0, matchSeconds - elapsed);
  });
  const [questionState, setQuestionState] = useState<QuestionState>('IDLE');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [serverFeedback, setServerFeedback] = useState<{ isCorrect: boolean; correctIndex?: number } | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [hasFinishedAll, setHasFinishedAll] = useState<boolean>(
    () => questions.length > 0 && currentQuestionIndex >= questions.length
  );

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishDelayRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentQ = questions[currentQuestionIndex] || questions[0];

  // Global match timer calculated from the server start time, corrected for device clock skew
  useEffect(() => {
    const updateTimer = () => {
      if (!matchStartTime) {
        setTimeLeft(matchSeconds);
        return;
      }
      const elapsed = Math.floor((serverNow() - matchStartTime) / 1000);
      const remaining = Math.max(0, matchSeconds - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        finishQuiz();
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [matchStartTime, matchSeconds, finishQuiz]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (finishDelayRef.current) {
        clearTimeout(finishDelayRef.current);
      }
    };
  }, []);

  // If this player finished first, the opponent's final committed answer arrives via Realtime.
  // A short delay preserves the final-answer feedback animation on the other device.
  useEffect(() => {
    if (!hasFinishedAll || !opponentPlayer?.finishedAt || finishDelayRef.current) return;
    finishDelayRef.current = setTimeout(() => void finishQuiz(), 1250);
    return () => {
      if (finishDelayRef.current) clearTimeout(finishDelayRef.current);
      finishDelayRef.current = null;
    };
  }, [hasFinishedAll, opponentPlayer?.finishedAt, finishQuiz]);

  // Reset local state whenever currentQuestionIndex changes
  useEffect(() => {
    if (questions.length > 0 && currentQuestionIndex >= questions.length) {
      setHasFinishedAll(true);
      return;
    }
    setQuestionState('IDLE');
    setSelectedOption(null);
    setServerFeedback(null);
    setFeedbackError(null);
  }, [currentQuestionIndex, questions.length]);

  const handleSelectOption = async (idx: number) => {
    if (questionState !== 'IDLE' || hasFinishedAll) return;

    // 1. Enter SUBMITTING state (locks UI immediately)
    setQuestionState('SUBMITTING');
    setSelectedOption(idx);
    setFeedbackError(null);

    // 2. Submit answer via RPC
    const res = await answerQuestion(idx);

    // 3. Handle RPC failure: do NOT fake success or advance
    if (!res || !res.success) {
      setFeedbackError(res?.error || 'Cevap iletilemedi, lütfen tekrar deneyin.');
      setSelectedOption(null);
      setQuestionState('IDLE');
      return;
    }

    // 4. Submit succeeded: Enter FEEDBACK state
    const isCorrect = Boolean(res.isCorrect);
    const correctIdx = typeof res.correctIndex === 'number' ? res.correctIndex : currentQ?.correctIndex;

    setServerFeedback({
      isCorrect,
      correctIndex: correctIdx,
    });
    setQuestionState('FEEDBACK');

    // 5. Display feedback for at least 1200ms before advancing
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Clear local states FIRST before advancing
      setSelectedOption(null);
      setServerFeedback(null);
      setQuestionState('IDLE');

      if (currentQuestionIndex + 1 >= questions.length && questions.length > 0) {
        setHasFinishedAll(true);
        if (res.matchFinished) void finishQuiz();
      } else {
        advanceQuestionIndex();
      }
    }, APP_CONFIG.answerFeedbackMs);
  };

  const optionLabels = ['A', 'B', 'C', 'D'];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col justify-between space-y-4 w-full max-w-md mx-auto py-1 px-1"
    >
      {/* Live Match Scoreboard Bar */}
      <div className="grid grid-cols-3 gap-2 items-center bg-slate-950/90 border border-slate-800 rounded-2xl p-2.5 backdrop-blur-md shadow-xl">
        {/* My Player Score (Cyan - Left) */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-lg box-glow-cyan">
            {myPlayer.avatar}
          </div>
          <div className="overflow-hidden">
            <span className="text-[10px] font-bold text-slate-400 font-subheading block truncate">
              {myPlayer.name} (Sen)
            </span>
            <div className="text-sm font-extrabold font-heading text-cyan-300">
              {myPlayer.score} <span className="text-[9px] font-normal text-slate-400">Puan</span>
            </div>
          </div>
        </div>

        {/* Global Timer */}
        <div className="flex flex-col items-center justify-center border-x border-slate-800/80 px-1">
          <div className="flex items-center gap-1 text-amber-400">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            <span className="text-base font-black font-heading tracking-widest text-glow-purple">
              {timeLeft}s
            </span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
            KALAN SÜRE
          </span>
        </div>

        {/* Opponent Score (Purple - Right) */}
        <div className="flex items-center justify-end gap-2 text-right">
          <div className="overflow-hidden">
            <span className="text-[10px] font-bold text-slate-400 font-subheading block truncate">
              {opponentPlayer ? opponentPlayer.name : 'Rakip'}
            </span>
            <div className="text-sm font-extrabold font-heading text-purple-300">
              {opponentPlayer ? opponentPlayer.score : 0} <span className="text-[9px] font-normal text-slate-400">Puan</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-950 border border-purple-500/40 flex items-center justify-center text-lg box-glow-purple">
            {opponentPlayer ? opponentPlayer.avatar : '⚡'}
          </div>
        </div>
      </div>

      {/* Network Error Toast Notice */}
      {feedbackError && (
        <div className="p-2.5 rounded-xl bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs font-bold text-center">
          ⚠️ {feedbackError}
        </div>
      )}

      {hasFinishedAll ? (
        <Card variant="cyan" glow className="w-full text-center py-8 px-4 space-y-3 my-auto">
          <div className="w-14 h-14 rounded-full bg-cyan-950 border border-cyan-400/50 flex items-center justify-center mx-auto text-cyan-300 text-2xl animate-pulse box-glow-cyan">
            ✓
          </div>
          <h2 className="text-lg font-black uppercase font-heading text-white">
            TÜM SORULARI TAMAMLADIN!
          </h2>
          <p className="text-xs text-slate-300 font-medium">
            Rakibin soruları tamamlaması ve 90 saniyelik sürenin bitmesi bekleniyor...
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-amber-400 text-xs font-bold font-subheading">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>Kalan Maç Süresi: {timeLeft}s</span>
          </div>
        </Card>
      ) : (
        <>
          {/* Progress & Category Banner */}
          <div className="flex items-center justify-between px-1">
            <Badge variant="cyan" size="sm" icon={<Zap className="w-3 h-3 text-cyan-400" />}>
              {currentQ?.category || 'Genel'}
            </Badge>
            <span className="text-xs font-bold font-heading text-slate-400">
              SORU <span className="text-cyan-400">{currentQuestionIndex + 1}</span> / {questions.length}
            </span>
          </div>

          {/* Main Question Card */}
          <Card variant="cyan" glow className="w-full space-y-3 min-h-[140px] flex flex-col justify-center">
            <p className="text-base sm:text-lg font-bold text-white leading-snug font-sans">
              {currentQ?.question}
            </p>
          </Card>

          {/* Options Grid */}
          <div className="grid grid-cols-1 gap-2.5 w-full pt-1">
            {currentQ?.options.map((optionText, idx) => {
              const isSelected = selectedOption === idx;

              let isCorrectHighlight = false;
              let isWrongHighlight = false;

              if (questionState === 'FEEDBACK' && serverFeedback) {
                if (serverFeedback.isCorrect) {
                  if (isSelected) isCorrectHighlight = true;
                } else {
                  if (isSelected) isWrongHighlight = true;
                  if (typeof serverFeedback.correctIndex === 'number' && idx === serverFeedback.correctIndex) {
                    isCorrectHighlight = true;
                  }
                }
              }

              let optionStyle =
                "bg-slate-900/80 border-slate-800 text-slate-200 hover:bg-slate-800/80 hover:border-slate-700";

              if (questionState === 'FEEDBACK') {
                if (isCorrectHighlight) {
                  optionStyle = "bg-emerald-950/90 border-emerald-500 text-emerald-200 box-glow-cyan font-bold scale-[1.01]";
                } else if (isWrongHighlight) {
                  optionStyle = "bg-rose-950/90 border-rose-500 text-rose-200 box-glow-purple font-bold";
                } else {
                  optionStyle = "bg-slate-950/40 border-slate-900 text-slate-600 opacity-40";
                }
              } else if (questionState === 'SUBMITTING' && isSelected) {
                optionStyle = "bg-cyan-950 border-cyan-400 text-cyan-200 animate-pulse font-bold";
              }

              return (
                <motion.button
                  key={`${currentQ.id}_${idx}`}
                  whileTap={{ scale: questionState !== 'IDLE' ? 1 : 0.98 }}
                  onClick={() => handleSelectOption(idx)}
                  disabled={questionState !== 'IDLE'}
                  className={`relative flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-200 group ${optionStyle}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center font-heading text-xs font-bold text-cyan-400 group-hover:border-cyan-500">
                      {optionLabels[idx]}
                    </span>
                    <span className="text-sm font-semibold font-sans">{optionText}</span>
                  </div>

                  {questionState === 'FEEDBACK' && isCorrectHighlight && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </motion.div>
                  )}
                  {questionState === 'FEEDBACK' && isWrongHighlight && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <XCircle className="w-5 h-5 text-rose-400" />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </>
      )}
    </motion.div>
  );
};
