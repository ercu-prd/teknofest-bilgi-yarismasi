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
      <span className="inline-flex min-w-0 items-center gap-1 text-muted" title={`${who}: cevaplamadı`}>
        <MinusCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{who}</span>
        <span className="sr-only">: cevaplamadı</span>
      </span>
    );
  }
  return answer.is_correct ? (
    <span className="inline-flex min-w-0 items-center gap-1 text-success" title={`${who}: doğru (+${answer.points_awarded})`}>
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{who}</span>
      <span className="tabular">+{answer.points_awarded}</span>
    </span>
  ) : (
    <span
      className="inline-flex min-w-0 items-center gap-1 text-danger"
      title={`${who}: yanlış (${OPTION_LABELS[answer.selected_option_index]})`}
    >
      <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{who}</span>
      <span>({OPTION_LABELS[answer.selected_option_index]})</span>
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
      <h2 className="text-base font-semibold text-ink">Soru soru özet</h2>
      {!items ? (
        <p className="text-sm text-muted">Özet yükleniyor…</p>
      ) : (
        <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {items.map((q, i) => {
            const isOpen = open === q.id;
            return (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : q.id)}
                  aria-expanded={isOpen}
                  className="flex min-h-11 w-full cursor-pointer items-start gap-3 px-3 py-3 text-left hover:bg-subtle"
                >
                  <span className="tabular mt-px w-5 shrink-0 text-sm font-semibold text-muted">{i + 1}.</span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block text-sm font-medium leading-snug text-ink">{q.question}</span>
                    <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs font-medium">
                      <AnswerMark answer={q.my_answer} who="Sen" />
                      <AnswerMark answer={q.opponent_answer} who={opponentName} />
                    </span>
                  </span>
                  <ChevronDown
                    className={`mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                {isOpen && (
                  <div className="space-y-2.5 px-3 pb-3 pl-11">
                    <ul className="space-y-1.5">
                      {q.options.map((opt, idx) => (
                        <li
                          key={idx}
                          className={`rounded-lg border px-2.5 py-1.5 text-sm ${
                            idx === q.correct_index
                              ? 'border-success/40 bg-success-soft font-medium text-success'
                              : idx === q.my_answer?.selected_option_index
                                ? 'border-danger/40 bg-danger-soft text-danger'
                                : 'border-line text-ink-soft'
                          }`}
                        >
                          {OPTION_LABELS[idx]}) {opt}
                        </li>
                      ))}
                    </ul>
                    {q.explanation && (
                      <p className="flex gap-1.5 text-sm leading-snug text-ink-soft">
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                        <span>{q.explanation}</span>
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
