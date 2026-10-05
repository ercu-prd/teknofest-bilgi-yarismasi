import React, { useEffect, useState } from 'react';
import { AlertCircle, BookOpen, DoorOpen, Layers, Loader2, RefreshCw, Swords } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { LogoSpinnerBlock } from '../ui/LogoSpinner';
import { formatRate, type AdminStats } from './types';

const StatCard: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="rounded-2xl border border-line bg-surface shadow-card p-3" data-testid="stat-card">
    <div className="flex items-center gap-1.5 text-sm text-muted">
      <span className="text-ink-soft" aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </div>
    <div className="mt-1 font-display text-3xl font-semibold text-ink tabular">{value}</div>
  </div>
);

/** Doğru oranı çubuğu: %40 altı kırmızı, %70 altı turuncu, aksi yeşil. */
const rateColor = (pct: number) => (pct < 40 ? 'bg-danger' : pct < 70 ? 'bg-warning' : 'bg-success');

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
        <Button variant="secondary" onClick={reload} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Yenile
        </Button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-danger-soft text-danger text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!stats && isLoading && (
        <LogoSpinnerBlock label="İstatistikler yükleniyor" hint="Yükleniyor…" />
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Aktif soru" value={stats.active_questions} icon={<BookOpen className="w-4 h-4" />} />
            <StatCard label="Toplam soru" value={stats.total_questions} icon={<Layers className="w-4 h-4" />} />
            <StatCard label="Bugünkü oda" value={stats.rooms_today} icon={<DoorOpen className="w-4 h-4" />} />
            <StatCard label="Bugünkü maç" value={stats.matches_today} icon={<Swords className="w-4 h-4" />} />
          </div>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-ink">En çok yanlış yapılan sorular</h3>
            {stats.most_missed.length === 0 ? (
              <p className="text-sm text-muted">Henüz yeterli veri yok (en az 3 cevap gerekli).</p>
            ) : (
              <ol className="space-y-2">
                {stats.most_missed.map((q) => {
                  const pct = q.correct_rate === null ? 0 : Math.round(Number(q.correct_rate) * 100);
                  return (
                    <li key={q.id} data-testid="missed-question" className="rounded-2xl border border-line bg-surface shadow-card p-3 space-y-2">
                      <p className="text-[15px] text-ink">{q.question}</p>
                      <div
                        className="h-2 rounded-full bg-subtle overflow-hidden"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={pct}
                        aria-label={`Doğru oranı: ${q.question}`}
                      >
                        <div
                          className={`h-full rounded-full ${rateColor(pct)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted">
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
