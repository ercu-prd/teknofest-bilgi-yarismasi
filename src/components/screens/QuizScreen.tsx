import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../../context/GameContext';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { LogoSpinner } from '../ui/LogoSpinner';
import { AlertCircle, CheckCircle2, XCircle, WifiOff } from 'lucide-react';
import { playSound, vibrate } from '../../lib/sound';
import { usePlayerOnline } from '../../hooks/usePlayerPresence';
import { categoryLabel } from '../../data/categories';
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
  const opponentOnline = usePlayerOnline(opponentPlayer?.lastSeenAt);
  const opponentProgress = opponentPlayer
    ? opponentPlayer.finishedAt
      ? questions.length
      : Math.min(opponentPlayer.currentQuestionIndex ?? 0, questions.length)
    : 0;

  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (!matchStartTime) return matchSeconds;
    const elapsed = Math.floor((serverNow() - matchStartTime) / 1000);
    return Math.max(0, matchSeconds - elapsed);
  });
  const [questionState, setQuestionState] = useState<QuestionState>('IDLE');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [serverFeedback, setServerFeedback] = useState<{ isCorrect: boolean; correctIndex?: number } | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [finishedLocally, setHasFinishedAll] = useState<boolean>(false);
  // Also true after a refresh that restores a player who already answered everything.
  const hasFinishedAll = finishedLocally || (questions.length > 0 && currentQuestionIndex >= questions.length);

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

  // Audible warning during the last five seconds.
  useEffect(() => {
    if (timeLeft > 0 && timeLeft <= 5) playSound('tick');
  }, [timeLeft]);

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
    playSound(isCorrect ? 'correct' : 'wrong');
    vibrate(isCorrect ? 40 : [60, 40, 60]);
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
  const total = questions.length;
  const answeredCount = hasFinishedAll ? total : Math.min(currentQuestionIndex, total);
  const progressPct = total > 0 ? Math.round((answeredCount / total) * 100) : 0;
  const isCritical = timeLeft <= 10;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex w-full flex-col gap-4"
    >
      {/* Skor çubuğu */}
      <div className="space-y-2">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-2xl border border-line bg-surface p-3 shadow-card">
          {/* Sen */}
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-lg ring-2 ring-brand"
              aria-hidden="true"
            >
              {myPlayer.avatar}
            </span>
            <div className="min-w-0">
              <span className="block truncate text-xs text-ink-soft">{myPlayer.name} (Sen)</span>
              <span className="font-display tabular text-lg font-bold leading-tight text-brand">{myPlayer.score}</span>
            </div>
          </div>

          {/* Süre */}
          <div className="flex flex-col items-center px-1" aria-label="Kalan süre">
            <span
              className={`font-display tabular text-3xl font-bold leading-none ${isCritical ? 'text-accent' : 'text-ink'}`}
            >
              {timeLeft}s
            </span>
            <span className="mt-0.5 text-[11px] text-muted">kalan</span>
          </div>

          {/* Rakip */}
          <div className="flex min-w-0 items-center justify-end gap-2 text-right">
            <div className="min-w-0">
              <span className="block truncate text-xs text-ink-soft">{opponentPlayer ? opponentPlayer.name : 'Rakip'}</span>
              <span className="font-display tabular text-lg font-bold leading-tight text-ink">
                {opponentPlayer ? opponentPlayer.score : 0}
              </span>
              <div
                className="flex items-center justify-end gap-1 text-[11px] text-muted"
                aria-label={`Rakip ilerlemesi: ${opponentProgress} / ${questions.length}`}
              >
                {!opponentOnline && <WifiOff className="h-3 w-3 text-danger" aria-label="Rakibin bağlantısı koptu" />}
                <span className="tabular">{opponentProgress}/{questions.length}</span>
              </div>
            </div>
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-subtle text-lg ring-1 ring-line-strong"
              aria-hidden="true"
            >
              {opponentPlayer ? opponentPlayer.avatar : '👤'}
            </span>
          </div>
        </div>

        {/* Kendi ilerlemen */}
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-subtle"
          role="progressbar"
          aria-label="İlerlemen"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answeredCount}
        >
          <div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Ağ hatası */}
      {feedbackError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{feedbackError}</span>
        </div>
      )}

      {hasFinishedAll ? (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <LogoSpinner size={48} label="Rakip bekleniyor" />
          <h2 className="text-lg font-semibold text-ink">Tüm soruları tamamladın</h2>
          <p className="text-sm text-ink-soft">Rakibin soruları tamamlaması ya da sürenin dolması bekleniyor.</p>
          <Badge variant="neutral">
            <span className="tabular">Kalan süre: {timeLeft}s</span>
          </Badge>
        </Card>
      ) : (
        <>
          {/* Soru numarası + kategori */}
          <div className="flex items-center justify-between gap-2">
            <span className="tabular text-sm font-medium text-ink-soft">
              Soru {currentQuestionIndex + 1} / {questions.length}
            </span>
            <Badge variant="neutral" size="sm">
              {categoryLabel(currentQ?.category || 'genel')}
            </Badge>
          </div>

          {/* Soru kartı */}
          <Card className="flex min-h-30 flex-col justify-center">
            <p className="text-lg font-semibold leading-snug text-ink">{currentQ?.question}</p>
          </Card>

          {/* Şıklar */}
          <div className="flex w-full flex-col gap-2.5">
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

              let optionStyle = 'bg-surface border-line text-ink hover:border-line-strong hover:bg-subtle';
              let letterStyle = 'bg-subtle text-ink-soft';

              if (questionState === 'FEEDBACK') {
                if (isCorrectHighlight) {
                  optionStyle = 'bg-success-soft border-success text-ink font-semibold';
                  letterStyle = 'bg-success text-white';
                } else if (isWrongHighlight) {
                  optionStyle = 'bg-danger-soft border-danger text-ink font-semibold';
                  letterStyle = 'bg-danger text-white';
                } else {
                  optionStyle = 'bg-surface border-line text-muted opacity-60';
                }
              } else if (questionState === 'SUBMITTING' && isSelected) {
                optionStyle = 'bg-brand-soft border-brand text-ink font-semibold';
                letterStyle = 'bg-brand text-white';
              }

              return (
                <button
                  type="button"
                  key={`${currentQ.id}_${idx}`}
                  onClick={() => handleSelectOption(idx)}
                  disabled={questionState !== 'IDLE'}
                  className={`flex min-h-13 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-150 enabled:cursor-pointer enabled:active:bg-subtle disabled:cursor-default ${optionStyle}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold transition-colors duration-150 ${letterStyle}`}
                  >
                    {optionLabels[idx]}
                  </span>
                  <span className="min-w-0 flex-1 break-words text-[15px]">{optionText}</span>

                  {questionState === 'FEEDBACK' && isCorrectHighlight && (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-label="Doğru cevap" />
                  )}
                  {questionState === 'FEEDBACK' && isWrongHighlight && (
                    <XCircle className="h-5 w-5 shrink-0 text-danger" aria-label="Yanlış cevap" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </motion.div>
  );
};
