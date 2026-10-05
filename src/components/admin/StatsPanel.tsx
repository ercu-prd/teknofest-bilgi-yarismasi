import React, { useEffect, useState } from 'react';
import { AlertCircle, BookOpen, DoorOpen, Layers, Loader2, RefreshCw, Swords } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { formatRate, type AdminStats } from './types';

const StatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; accent: string }> = ({
  label,
  value,
  icon,
  accent,
}) => (
  <div className={`rounded-xl border p-3 bg-slate-900/60 ${accent}`} data-testid="stat-card">
    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
      {icon}
      <span>{label}</span>
    </div>
    <div className="mt-1 text-3xl font-heading font-black text-white tabular-nums">{value}</div>
  </div>
);

type StatsResult = { ok: true; stats: AdminStats } | { ok: false; error: string };

const fetchStats = async (): Promise<StatsResult> => {
  try {
    const { data, error } = await supabase.rpc('admin_stats_rpc');
    const res = data as ({ success: boolean; error?: string } & Partial<AdminStats>) | null;
    if (error || !res?.success) {
      return { ok: false, error: error?.message || res?.error || 'İstatistikler alınamadı.' };
    }
    return {
      ok: true,
      stats: {
        active_questions: res.active_questions ?? 0,
        total_questions: res.total_questions ?? 0,
        rooms_today: res.rooms_today ?? 0,
        matches_today: res.matches_today ?? 0,
        most_missed: res.most_missed ?? [],
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'İstatistikler alınamadı.' };
  }
};

export const StatsPanel: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchStats().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setStats(result.stats);
        setError(null);
      } else {
        setError(result.error);
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = () => {
    setIsLoading(true);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={reload} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Yenile
        </Button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!stats && isLoading && (
        <div role="status" className="flex items-center justify-center gap-2 py-8 text-cyan-300 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" /> Yükleniyor…
        </div>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Aktif soru" value={stats.active_questions} icon={<BookOpen className="w-3.5 h-3.5" />} accent="border-cyan-500/30" />
            <StatCard label="Toplam soru" value={stats.total_questions} icon={<Layers className="w-3.5 h-3.5" />} accent="border-purple-500/30" />
            <StatCard label="Bugünkü oda" value={stats.rooms_today} icon={<DoorOpen className="w-3.5 h-3.5" />} accent="border-amber-500/30" />
            <StatCard label="Bugünkü maç" value={stats.matches_today} icon={<Swords className="w-3.5 h-3.5" />} accent="border-emerald-500/30" />
          </div>

          <section className="space-y-2">
            <h3 className="font-heading font-bold uppercase text-sm text-white">En çok yanlış yapılan sorular</h3>
            {stats.most_missed.length === 0 ? (
              <p className="text-sm text-slate-400">Henüz yeterli veri yok (en az 3 cevap gerekli).</p>
            ) : (
              <ol className="space-y-2">
                {stats.most_missed.map((q) => {
                  const pct = q.correct_rate === null ? 0 : Math.round(Number(q.correct_rate) * 100);
                  return (
                    <li key={q.id} data-testid="missed-question" className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1.5">
                      <p className="text-sm text-white">{q.question}</p>
                      <div
                        className="h-2 rounded-full bg-slate-800 overflow-hidden"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={pct}
                        aria-label={`Doğru oranı: ${q.question}`}
                      >
                        <div
                          className="h-full bg-gradient-to-r from-rose-500 to-amber-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>{q.times_answered} cevap</span>
                        <span>Doğru: {formatRate(q.correct_rate)}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
};
