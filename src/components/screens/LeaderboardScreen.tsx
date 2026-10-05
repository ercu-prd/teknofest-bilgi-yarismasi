import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, QrCode, RefreshCw, Trophy } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Logo } from '../ui/Logo';
import { LogoSpinnerBlock } from '../ui/LogoSpinner';

export type LeaderboardPeriod = 'today' | 'all';

export interface LeaderboardEntry {
  rank: number;
  name: string;
  avatar: string;
  score: number;
  correct_answers: number;
  created_at: string;
}

interface LeaderboardResponse {
  success: boolean;
  period?: LeaderboardPeriod;
  entries?: LeaderboardEntry[];
  error?: string;
}

export const LEADERBOARD_REFRESH_MS = 10_000;

const PERIOD_TABS: { value: LeaderboardPeriod; label: string }[] = [
  { value: 'today', label: 'Bugün' },
  { value: 'all', label: 'Tüm zamanlar' },
];

/** İlk üç sıra: 1. dolu marka dairesi, 2-3 açık marka dairesi. Etiketler ekran okuyucu içindir. */
const TOP_RANKS: Record<number, { rank: string; label: string }> = {
  1: { rank: 'bg-brand text-white', label: 'Altın madalya' },
  2: { rank: 'bg-brand-soft text-brand', label: 'Gümüş madalya' },
  3: { rank: 'bg-brand-soft text-brand', label: 'Bronz madalya' },
};

type FetchResult = { ok: true; entries: LeaderboardEntry[] } | { ok: false; error: string };

const fetchLeaderboard = async (period: LeaderboardPeriod, limit: number): Promise<FetchResult> => {
  try {
    const { data, error } = await supabase.rpc('get_leaderboard_rpc', { p_period: period, p_limit: limit });
    const res = data as LeaderboardResponse | null;
    if (error || !res?.success) {
      return { ok: false, error: error?.message || res?.error || 'Liderlik tablosu alınamadı.' };
    }
    return { ok: true, entries: res.entries ?? [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Liderlik tablosu alınamadı.' };
  }
};

export const LeaderboardScreen: React.FC<{ standMode?: boolean }> = ({ standMode = false }) => {
  const { setScreen } = useGame();
  const [period, setPeriod] = useState<LeaderboardPeriod>('today');
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(isSupabaseConfigured);
  const [retryKey, setRetryKey] = useState(0);
  const limit = standMode ? 20 : 10;

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let cancelled = false;
    const run = () =>
      fetchLeaderboard(period, limit).then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setEntries(result.entries);
          setError(null);
        } else {
          setError(result.error);
        }
        setIsLoading(false);
      });
    void run();
    const timer = setInterval(() => void run(), LEADERBOARD_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [period, limit, retryKey]);

  const retry = () => {
    setIsLoading(true);
    setRetryKey((k) => k + 1);
  };

  const changePeriod = (next: LeaderboardPeriod) => {
    if (next === period) return;
    setEntries(null);
    setError(null);
    setIsLoading(true);
    setPeriod(next);
  };

  const goHome = () => {
    if (window.location.hash.startsWith('#/leaderboard')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setScreen('HOME');
  };

  const joinUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const sizes = standMode
    ? {
        row: 'px-5 py-4 gap-4 lg:px-6 lg:gap-5',
        rank: 'w-12 h-12 text-xl lg:w-14 lg:h-14 lg:text-2xl',
        avatar: 'text-3xl lg:text-4xl',
        name: 'text-xl lg:text-3xl',
        score: 'text-3xl lg:text-5xl',
        meta: 'text-base lg:text-lg',
        message: 'text-xl lg:text-2xl',
      }
    : {
        row: 'px-2 py-2.5 gap-3',
        rank: 'w-8 h-8 text-sm',
        avatar: 'text-2xl',
        name: 'text-[15px]',
        score: 'text-2xl',
        meta: 'text-xs',
        message: 'text-sm',
      };

  let body: React.ReactNode;
  if (!isSupabaseConfigured) {
    body = (
      <div role="alert" className="flex items-start gap-3 p-4 rounded-xl bg-warning-soft text-warning text-sm">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <span>
          Liderlik tablosu için Supabase bağlantısı gerekli. VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY ortam
          değişkenlerini tanımlayın.
        </span>
      </div>
    );
  } else if (isLoading && entries === null) {
    body = <LogoSpinnerBlock label="Liderlik tablosu yükleniyor" hint="Yükleniyor…" />;
  } else if (error && entries === null) {
    body = (
      <div role="alert" className="flex flex-col items-center gap-3 p-4 rounded-xl bg-danger-soft text-danger text-sm text-center">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
        <Button variant="secondary" onClick={retry}>
          <RefreshCw className="w-4 h-4" /> Tekrar dene
        </Button>
      </div>
    );
  } else if (!entries || entries.length === 0) {
    body = (
      <div className={`text-center py-12 text-muted ${sizes.message}`}>
        <Trophy className={`mx-auto mb-3 text-line-strong ${standMode ? 'w-14 h-14' : 'w-10 h-10'}`} aria-hidden="true" />
        {period === 'today'
          ? 'Bugün henüz tamamlanan maç yok. İlk sen ol!'
          : 'Henüz liderlik tablosunda kayıt yok.'}
      </div>
    );
  } else {
    body = (
      <>
        {error && (
          <p role="alert" className="text-xs text-danger mb-2 text-center">
            Güncelleme başarısız: {error}
          </p>
        )}
        <ol className={standMode ? 'grid grid-cols-1 lg:grid-cols-2 gap-3' : 'divide-y divide-line'}>
          {entries.map((entry) => {
            const top = TOP_RANKS[entry.rank];
            return (
              <motion.li
                key={`${entry.rank}-${entry.name}-${entry.created_at}`}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18 }}
                data-testid="leaderboard-row"
                className={`flex items-center ${sizes.row} ${
                  standMode ? 'rounded-2xl bg-surface border border-line shadow-card' : ''
                }`}
              >
                <span
                  className={`flex items-center justify-center rounded-full font-display font-semibold tabular shrink-0 ${sizes.rank} ${
                    top ? top.rank : 'bg-subtle text-ink-soft'
                  }`}
                  aria-label={top ? `${entry.rank}. sıra, ${top.label}` : `${entry.rank}. sıra`}
                >
                  {entry.rank}
                </span>
                <span className={`shrink-0 ${sizes.avatar}`} aria-hidden="true">
                  {entry.avatar}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-ink truncate ${sizes.name}`}>{entry.name}</div>
                  <div className={`text-muted ${sizes.meta}`}>{entry.correct_answers} doğru</div>
                </div>
                <span className={`font-display font-semibold text-ink tabular shrink-0 ${sizes.score}`}>{entry.score}</span>
              </motion.li>
            );
          })}
        </ol>
      </>
    );
  }

  const tabs = (
    <div
      role="tablist"
      aria-label="Dönem"
      className={`grid grid-cols-2 gap-1 p-1 rounded-xl bg-subtle ${standMode ? 'w-full max-w-md mx-auto' : ''}`}
    >
      {PERIOD_TABS.map((tab) => {
        const active = tab.value === period;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => changePeriod(tab.value)}
            className={`rounded-lg font-medium transition-colors cursor-pointer ${standMode ? 'h-12 text-lg' : 'h-11 text-sm'} ${
              active ? 'bg-surface text-ink shadow-card' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  if (standMode) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full space-y-6 py-2"
      >
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <Logo size={64} />
            <div className="min-w-0">
              <p className="text-lg lg:text-xl font-semibold text-ink-soft">OKÜ TEKNOFEST Bilgi Yarışması</p>
              <h1 className="text-3xl lg:text-5xl font-bold text-ink">Liderlik tablosu</h1>
            </div>
          </div>
          <div
            data-testid="stand-join-info"
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface border border-line shadow-card text-lg lg:text-xl font-medium text-ink min-w-0"
          >
            <QrCode className="w-6 h-6 text-brand shrink-0" aria-hidden="true" />
            <span className="break-all">Katılmak için: {joinUrl}</span>
          </div>
        </header>

        {tabs}

        <div>{body}</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="w-full space-y-4"
    >
      <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
        <Trophy className="w-6 h-6 text-brand" aria-hidden="true" />
        Liderlik tablosu
      </h1>

      {tabs}

      <Card padding="sm">{body}</Card>

      <Button variant="ghost" fullWidth onClick={goHome}>
        <ArrowLeft className="w-4 h-4" /> Ana menü
      </Button>
    </motion.div>
  );
};

export default LeaderboardScreen;
