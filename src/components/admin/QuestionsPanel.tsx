import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Pencil, Plus, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CATEGORY_OPTIONS, categoryLabel } from '../../data/categories';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { QuestionForm } from './QuestionForm';
import { DIFFICULTY_OPTIONS, difficultyLabel, formatRate, type AdminQuestion } from './types';

export const SEARCH_DEBOUNCE_MS = 300;

const selectClass =
  'rounded-xl bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400';

const difficultyVariant = (d: string) => (d === 'kolay' ? 'emerald' : d === 'orta' ? 'amber' : 'rose') as
  | 'emerald'
  | 'amber'
  | 'rose';

type ListResult = { ok: true; questions: AdminQuestion[] } | { ok: false; error: string };

const fetchQuestions = async (search: string, category: string, difficulty: string): Promise<ListResult> => {
  try {
    const { data, error } = await supabase.rpc('admin_list_questions_rpc', {
      p_search: search || null,
      p_category: category || null,
      p_difficulty: difficulty || null,
    });
    const res = data as { success: boolean; questions?: AdminQuestion[]; error?: string } | null;
    if (error || !res?.success) {
      return { ok: false, error: error?.message || res?.error || 'Sorular alınamadı.' };
    }
    return { ok: true, questions: res.questions ?? [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Sorular alınamadı.' };
  }
};

export const QuestionsPanel: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminQuestion | 'new' | null>(null);
  const [pendingToggle, setPendingToggle] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const queryKey = JSON.stringify([search, category, difficulty, reloadKey]);
  const isLoading = loadedKey !== queryKey;

  useEffect(() => {
    let cancelled = false;
    fetchQuestions(search, category, difficulty).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setQuestions(result.questions);
        setError(null);
      } else {
        setError(result.error);
      }
      setLoadedKey(queryKey);
    });
    return () => {
      cancelled = true;
    };
  }, [search, category, difficulty, queryKey]);

  const toggleActive = async (q: AdminQuestion) => {
    setPendingToggle(q.id);
    setNotice(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_set_question_active_rpc', {
        p_id: q.id,
        p_active: !q.is_active,
      });
      const res = data as { success: boolean; error?: string } | null;
      if (rpcError || !res?.success) {
        setError(rpcError?.message || res?.error || 'Durum güncellenemedi.');
        return;
      }
      setError(null);
      setQuestions((list) => list.map((item) => (item.id === q.id ? { ...item, is_active: !q.is_active } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Durum güncellenemedi.');
    } finally {
      setPendingToggle(null);
    }
  };

  const handleSaved = (id: number) => {
    const wasNew = editing === 'new';
    setEditing(null);
    setNotice(wasNew ? `Soru eklendi (#${id}).` : `Soru güncellendi (#${id}).`);
    setReloadKey((k) => k + 1);
  };

  if (editing) {
    return (
      <QuestionForm
        key={editing === 'new' ? 'new' : editing.id}
        question={editing === 'new' ? null : editing}
        onSaved={handleSaved}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="search"
            placeholder="Soru ara…"
            aria-label="Soru ara"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-xl bg-slate-950/70 border border-slate-700 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>
        <div className="flex gap-2">
          <select
            aria-label="Kategori filtresi"
            className={`${selectClass} flex-1`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Tüm kategoriler</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Zorluk filtresi"
            className={`${selectClass} flex-1`}
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option value="">Tüm zorluklar</option>
            {DIFFICULTY_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <Button variant="purple" size="sm" fullWidth onClick={() => setEditing('new')}>
          <Plus className="w-4 h-4" /> Yeni Soru
        </Button>
      </div>

      {notice && (
        <div role="status" className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-sm">
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{questions.length} soru</span>
        {isLoading && (
          <span className="flex items-center gap-1 text-cyan-300">
            <Loader2 className="w-3 h-3 animate-spin" /> Yükleniyor…
          </span>
        )}
      </div>

      {!isLoading && questions.length === 0 && !error && (
        <p className="text-center text-sm text-slate-400 py-6">Filtrelere uyan soru bulunamadı.</p>
      )}

      <ul className="space-y-3">
        {questions.map((q) => (
          <li
            key={q.id}
            data-testid="admin-question"
            className={`rounded-xl border p-3 space-y-2 ${
              q.is_active ? 'border-slate-700 bg-slate-900/60' : 'border-slate-800 bg-slate-950/60 opacity-60'
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge size="sm" variant="cyan">
                {categoryLabel(q.category)}
              </Badge>
              <Badge size="sm" variant={difficultyVariant(q.difficulty)}>
                {difficultyLabel(q.difficulty)}
              </Badge>
              <span className="ml-auto text-[10px] text-slate-500">#{q.id}</span>
            </div>
            <p className="text-sm font-semibold text-white">{q.question}</p>
            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
              {q.options.map((opt, i) => {
                const correct = i === q.correct_index;
                return (
                  <li
                    key={i}
                    data-correct={correct || undefined}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1 border ${
                      correct
                        ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-200 font-bold'
                        : 'border-slate-800 text-slate-400'
                    }`}
                  >
                    {correct && <CheckCircle2 className="w-3 h-3 shrink-0" aria-label="Doğru cevap" />}
                    {opt}
                  </li>
                );
              })}
            </ol>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>{q.times_answered} cevap</span>
              <span>Doğru: {formatRate(q.correct_rate)}</span>
              <div className="ml-auto flex items-center gap-2">
                <span>{q.is_active ? 'Aktif' : 'Pasif'}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={q.is_active}
                  aria-label={`Soru #${q.id} aktif`}
                  disabled={pendingToggle === q.id}
                  onClick={() => void toggleActive(q)}
                  className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${
                    q.is_active ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                      q.is_active ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  setEditing(q);
                }}
                aria-label={`Soru #${q.id} düzenle`}
                className="p-1.5 rounded-lg border border-slate-700 text-cyan-300 hover:bg-cyan-500/10"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
