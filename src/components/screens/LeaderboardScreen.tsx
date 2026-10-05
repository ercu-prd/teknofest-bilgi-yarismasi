import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, Loader2, Medal, QrCode, RefreshCw, Trophy } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

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
  { value: 'all', label: 'Tüm Zamanlar' },
];

const MEDAL_STYLES: Record<number, { row: string; rank: string; label: string }> = {
  1: {
    row: 'border-amber-400/60 bg-gradient-to-r from-amber-500/20 to-amber-900/10 shadow-lg shadow-amber-500/10',
    rank: 'bg-amber-400 text-black',
    label: 'Altın madalya',
  },
  2: {
    row: 'border-slate-300/50 bg-gradient-to-r from-slate-300/15 to-slate-800/10',
    rank: 'bg-slate-300 text-black',
    label: 'Gümüş madalya',
  },
  3: {
    row: 'border-orange-500/50 bg-gradient-to-r from-orange-600/20 to-orange-950/10',
    rank: 'bg-orange-500 text-black',
    label: 'Bronz madalya',
  },
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
        title: 'text-5xl lg:text-6xl',
        row: 'px-6 py-4 gap-6',
        rank: 'w-14 h-14 text-2xl',
        avatar: 'text-4xl',
        name: 'text-3xl',
        score: 'text-4xl',
        meta: 'text-lg',
      }
    : {
        title: 'text-3xl',
        row: 'px-4 py-3 gap-3',
        rank: 'w-9 h-9 text-sm',
        avatar: 'text-2xl',
        name: 'text-base',
        score: 'text-xl',
        meta: 'text-xs',
      };

  let body: React.ReactNode;
  if (!isSupabaseConfigured) {
    body = (
      <div role="alert" className="flex items-start gap-3 p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-sm">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <span>
          Liderlik tablosu için Supabase bağlantısı gerekli. VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY ortam
          değişkenlerini tanımlayın.
        </span>
      </div>
    );
  } else if (isLoading && entries === null) {
    body = (
      <div className="flex items-center justify-center gap-3 py-12 text-cyan-300" role="status">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className={standMode ? 'text-2xl' : 'text-sm'}>Yükleniyor…</span>
      </div>
    );
  } else if (error && entries === null) {
    body = (
      <div role="alert" className="flex flex-col items-center gap-3 p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-sm text-center">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={retry}>
          <RefreshCw className="w-4 h-4" /> Tekrar Dene
        </Button>
      </div>
    );
  } else if (!entries || entries.length === 0) {
    body = (
      <div className={`text-center py-12 text-slate-400 ${standMode ? 'text-2xl' : 'text-sm'}`}>
        <Trophy className={`mx-auto mb-3 text-slate-600 ${standMode ? 'w-16 h-16' : 'w-10 h-10'}`} />
        {period === 'today'
          ? 'Bugün henüz tamamlanan maç yok. İlk sen ol!'
          : 'Henüz liderlik tablosunda kayıt yok.'}
      </div>
    );
  } else {
    body = (
      <>
        {error && (
          <p role="alert" className="text-xs text-rose-300 mb-2 text-center">
            Güncelleme başarısız: {error}
          </p>
        )}
        <ol className={`space-y-2 ${standMode ? 'grid grid-cols-1 xl:grid-cols-2 gap-x-6 space-y-0 gap-y-3' : ''}`}>
          {entries.map((entry) => {
            const medal = MEDAL_STYLES[entry.rank];
            return (
              <motion.li
                key={`${entry.rank}-${entry.name}-${entry.created_at}`}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                data-testid="leaderboard-row"
                className={`flex items-center rounded-xl border ${sizes.row} ${
                  medal ? medal.row : 'border-slate-800 bg-slate-900/50'
                }`}
              >
                <span
                  className={`flex items-center justify-center rounded-full font-heading font-black shrink-0 ${sizes.rank} ${
                    medal ? medal.rank : 'bg-slate-800 text-slate-300'
                  }`}
                  aria-label={medal ? `${entry.rank}. sıra, ${medal.label}` : `${entry.rank}. sıra`}
                >
                  {medal && entry.rank === 1 ? <Medal className="w-1/2 h-1/2" /> : entry.rank}
                </span>
                <span className={sizes.avatar} aria-hidden="true">
                  {entry.avatar}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-white truncate ${sizes.name}`}>{entry.name}</div>
                  <div className={`text-slate-400 ${sizes.meta}`}>{entry.correct_answers} doğru</div>
                </div>
                <span className={`font-heading font-black text-cyan-300 tabular-nums ${sizes.score}`}>
                  {entry.score}
                </span>
              </motion.li>
            );
          })}
        </ol>
      </>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className={
        standMode
          ? 'relative w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6'
          : 'w-full max-w-md mx-auto py-2 px-1 space-y-5'
      }
    >
      {standMode && (
        <div
          data-testid="stand-join-info"
          className="absolute top-4 right-4 sm:right-8 flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/80 border border-cyan-500/40 text-cyan-200 text-lg sm:text-xl font-bold"
        >
          <QrCode className="w-6 h-6 text-cyan-400" />
          <span>Katılmak için: {joinUrl}</span>
        </div>
      )}

      <div className={`text-center space-y-2 ${standMode ? 'pt-14' : ''}`}>
        <h1 className={`font-black tracking-tight text-white uppercase font-heading text-glow-cyan ${sizes.title}`}>
          <Trophy className={`inline-block mr-2 text-amber-400 align-middle ${standMode ? 'w-14 h-14' : 'w-8 h-8'}`} />
          Liderlik Tablosu
        </h1>
      </div>

      <div role="tablist" aria-label="Dönem" className="flex justify-center gap-2">
        {PERIOD_TABS.map((tab) => {
          const active = tab.value === period;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => changePeriod(tab.value)}
              className={`rounded-xl font-heading font-bold uppercase tracking-wider border transition-colors ${
                standMode ? 'px-8 py-3 text-xl' : 'px-4 py-2 text-xs'
              } ${
                active
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 box-glow-cyan'
                  : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <Card variant="cyan" className={`relative ${standMode ? 'p-8' : 'p-4'}`}>
        {body}
      </Card>

      {!standMode && (
        <Button variant="ghost" fullWidth onClick={goHome}>
          <ArrowLeft className="w-4 h-4" /> Ana Menü
        </Button>
      )}
    </motion.div>
  );
};

export default LeaderboardScreen;
