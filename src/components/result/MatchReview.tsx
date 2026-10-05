import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, Lightbulb, MinusCircle, XCircle } from 'lucide-react';
import type { ReviewAnswer, ReviewQuestion } from '../../types/game';

interface MatchReviewProps {
  load: () => Promise<ReviewQuestion[] | null>;
  opponentName?: string;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

const AnswerMark: React.FC<{ answer: ReviewAnswer | null; who: string }> = ({ answer, who }) => {
  if (!answer) {
    return (
      <span className="inline-flex items-center gap-1 text-slate-500" title={`${who}: cevaplamadı`}>
        <MinusCircle className="w-3.5 h-3.5" /> {who}
      </span>
    );
  }
  return answer.is_correct ? (
    <span className="inline-flex items-center gap-1 text-emerald-400" title={`${who}: doğru (+${answer.points_awarded})`}>
      <CheckCircle2 className="w-3.5 h-3.5" /> {who} +{answer.points_awarded}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-rose-400" title={`${who}: yanlış (${OPTION_LABELS[answer.selected_option_index]})`}>
      <XCircle className="w-3.5 h-3.5" /> {who} ({OPTION_LABELS[answer.selected_option_index]})
    </span>
  );
};

/**
 * Per-question breakdown shown after the match: the correct option, both players'
 * picks and the explanation. Answers are only revealed by the server once the room
 * is in RESULT, so nothing here leaks during play.
 */
export const MatchReview: React.FC<MatchReviewProps> = ({ load, opponentName = 'Rakip' }) => {
  const [items, setItems] = useState<ReviewQuestion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void load().then((res) => {
      if (cancelled) return;
      if (res) setItems(res);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (failed) return null;

  return (
    <section className="w-full space-y-2" aria-label="Soru soru maç özeti">
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-subheading px-1">
        Soru Soru Özet
      </h2>
      {!items ? (
        <p className="text-xs text-slate-500 px-1">Özet yükleniyor…</p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((q, i) => {
            const isOpen = open === q.id;
            return (
              <li key={q.id} className="rounded-xl border border-slate-800 bg-slate-950/60">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : q.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-start gap-2 p-2.5 text-left cursor-pointer"
                >
                  <span className="text-[10px] font-bold text-cyan-400 font-heading mt-0.5 w-5 shrink-0">{i + 1}.</span>
                  <span className="flex-1 space-y-1">
                    <span className="block text-xs font-semibold text-slate-200 leading-snug">{q.question}</span>
                    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-bold font-subheading">
                      <AnswerMark answer={q.my_answer} who="Sen" />
                      <AnswerMark answer={q.opponent_answer} who={opponentName} />
                    </span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    <ul className="space-y-1">
                      {q.options.map((opt, idx) => (
                        <li
                          key={idx}
                          className={`text-xs px-2 py-1 rounded-lg border ${
                            idx === q.correct_index
                              ? 'border-emerald-500/60 bg-emerald-950/60 text-emerald-200 font-bold'
                              : idx === q.my_answer?.selected_option_index
                              ? 'border-rose-500/50 bg-rose-950/50 text-rose-200'
                              : 'border-slate-800 text-slate-400'
                          }`}
                        >
                          {OPTION_LABELS[idx]}) {opt}
                        </li>
                      ))}
                    </ul>
                    {q.explanation && (
                      <p className="flex gap-1.5 text-[11px] text-amber-200/90 leading-snug">
                        <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                        {q.explanation}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};
