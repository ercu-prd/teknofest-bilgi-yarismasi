import React, { useState } from 'react';
import { AlertCircle, Check, Loader2, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CATEGORY_OPTIONS } from '../../data/categories';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { DIFFICULTY_OPTIONS, type AdminQuestion, type QuestionDraft } from './types';
import { draftFromQuestion, emptyDraft, QUESTION_MAX_LENGTH, validateDraft } from './questionValidation';

interface QuestionFormProps {
  /** Question to edit; null creates a new one. */
  question: AdminQuestion | null;
  onSaved: (id: number) => void;
  onCancel: () => void;
}

const inputClass =
  'w-full h-11 rounded-xl border border-line bg-surface px-3.5 text-base text-ink placeholder:text-muted outline-none focus:border-brand transition-colors';
const textareaClass =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-muted outline-none focus:border-brand transition-colors';
const labelClass = 'block text-sm font-medium text-ink-soft mb-1.5';
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export const QuestionForm: React.FC<QuestionFormProps> = ({ question, onSaved, onCancel }) => {
  const [draft, setDraft] = useState<QuestionDraft>(() => (question ? draftFromQuestion(question) : emptyDraft()));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const update = <K extends keyof QuestionDraft>(key: K, value: QuestionDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setOption = (index: number, value: string) =>
    setDraft((d) => ({ ...d, options: d.options.map((o, i) => (i === index ? value : o)) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_upsert_question_rpc', {
        p_id: draft.id,
        p_category: draft.category,
        p_difficulty: draft.difficulty,
        p_question: draft.question.trim(),
        p_options: draft.options.map((o) => o.trim()),
        p_correct_index: draft.correctIndex,
        p_explanation: draft.explanation.trim() || null,
      });
      const res = data as { success: boolean; id?: number; error?: string } | null;
      if (rpcError || !res?.success) {
        setError(rpcError?.message || res?.error || 'Soru kaydedilemedi.');
        return;
      }
      onSaved(res.id ?? draft.id ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Soru kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-label="Soru formu">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">
            {draft.id === null ? 'Yeni soru' : `Soruyu düzenle #${draft.id}`}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Formu kapat"
            className="-mr-2 w-11 h-11 inline-flex items-center justify-center rounded-xl text-ink-soft hover:bg-subtle hover:text-ink cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
          <div>
            <label htmlFor="qf-category" className={labelClass}>
              Kategori
            </label>
            <select
              id="qf-category"
              className={inputClass}
              value={draft.category}
              onChange={(e) => update('category', e.target.value)}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="qf-difficulty" className={labelClass}>
              Zorluk
            </label>
            <select
              id="qf-difficulty"
              className={inputClass}
              value={draft.difficulty}
              onChange={(e) => update('difficulty', e.target.value)}
            >
              {DIFFICULTY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="qf-question" className={labelClass}>
            Soru metni
          </label>
          <textarea
            id="qf-question"
            className={`${textareaClass} min-h-24`}
            value={draft.question}
            maxLength={QUESTION_MAX_LENGTH}
            onChange={(e) => update('question', e.target.value)}
          />
          <div className="mt-1 text-right text-xs text-muted tabular">
            {draft.question.trim().length}/{QUESTION_MAX_LENGTH}
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className={labelClass}>Şıklar (doğru olanı işaretleyin)</legend>
          {draft.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="qf-correct"
                className="accent-brand w-5 h-5 shrink-0 cursor-pointer"
                checked={draft.correctIndex === i}
                onChange={() => update('correctIndex', i)}
                aria-label={`Doğru şık ${OPTION_LETTERS[i]}`}
              />
              <span className="w-4 text-sm font-semibold text-ink-soft shrink-0">{OPTION_LETTERS[i]}</span>
              <input
                type="text"
                className={`${inputClass} ${draft.correctIndex === i ? 'border-success' : ''}`}
                value={opt}
                onChange={(e) => setOption(i, e.target.value)}
                aria-label={`Şık ${OPTION_LETTERS[i]}`}
              />
            </div>
          ))}
        </fieldset>

        <div>
          <label htmlFor="qf-explanation" className={labelClass}>
            Açıklama (opsiyonel)
          </label>
          <textarea
            id="qf-explanation"
            className={`${textareaClass} min-h-20`}
            value={draft.explanation}
            onChange={(e) => update('explanation', e.target.value)}
          />
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-danger-soft text-danger text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Vazgeç
          </Button>
          <Button type="submit" variant="primary" disabled={isSaving} className="flex-1">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : draft.id === null ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
            Kaydet
          </Button>
        </div>
      </form>
    </Card>
  );
};
