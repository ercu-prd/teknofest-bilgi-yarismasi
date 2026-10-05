import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, BarChart3, ListChecks, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { AdminLogin } from '../admin/AdminLogin';
import { QuestionsPanel } from '../admin/QuestionsPanel';
import { StatsPanel } from '../admin/StatsPanel';

type Phase = 'checking' | 'login' | 'verifying' | 'not-admin' | 'ready';
type Tab = 'questions' | 'stats';

const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: 'questions', label: 'Sorular', icon: <ListChecks className="w-4 h-4" /> },
  { value: 'stats', label: 'İstatistik', icon: <BarChart3 className="w-4 h-4" /> },
];

export const AdminScreen: React.FC = () => {
  const { setScreen } = useGame();
  const [phase, setPhase] = useState<Phase>('checking');
  const [tab, setTab] = useState<Tab>('questions');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const verifyAdmin = useCallback(async () => {
    setPhase('verifying');
    setAdminError(null);
    try {
      const { data, error } = await supabase.rpc('is_quiz_admin');
      if (error) setAdminError(error.message);
      setPhase(data === true ? 'ready' : 'not-admin');
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Yetki kontrolü başarısız.');
      setPhase('not-admin');
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        const user = data?.session?.user;
        if (user && user.is_anonymous === false) {
          setEmail(user.email ?? null);
          await verifyAdmin();
        } else {
          setPhase('login');
        }
      } catch {
        if (!cancelled) setPhase('login');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [verifyAdmin]);

  const handleLogin = async (loginEmail: string, password: string) => {
    setLoginError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      if (error || !data?.session) {
        setLoginError(`Giriş başarısız: ${error?.message || 'oturum açılamadı'}`);
        return;
      }
      setEmail(data.session.user?.email ?? loginEmail);
      await verifyAdmin();
    } catch (err) {
      setLoginError(`Giriş başarısız: ${err instanceof Error ? err.message : 'bilinmeyen hata'}`);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.hash = '';
      window.location.reload();
    }
  };

  const goHome = () => {
    if (window.location.hash.startsWith('#/admin')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setScreen('HOME');
  };

  let content: React.ReactNode;
  if (!isSupabaseConfigured) {
    content = (
      <div role="alert" className="flex items-start gap-3 p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-sm">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <span>Yönetici paneli için Supabase bağlantısı gerekli. VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlayın.</span>
      </div>
    );
  } else if (phase === 'checking' || phase === 'verifying') {
    content = (
      <div role="status" className="flex items-center justify-center gap-2 py-10 text-cyan-300 text-sm">
        <Loader2 className="w-5 h-5 animate-spin" />
        {phase === 'checking' ? 'Oturum kontrol ediliyor…' : 'Yetki kontrol ediliyor…'}
      </div>
    );
  } else if (phase === 'login') {
    content = <AdminLogin onSubmit={handleLogin} error={loginError} onBack={goHome} />;
  } else if (phase === 'not-admin') {
    content = (
      <div className="space-y-4 text-center">
        <div role="alert" className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-sm space-y-1">
          <p className="font-bold">Bu hesap yönetici değil.</p>
          {email && <p className="text-xs text-rose-300/80">{email}</p>}
          {adminError && <p className="text-xs">{adminError}</p>}
        </div>
        <Button variant="danger" fullWidth onClick={() => void handleLogout()}>
          <LogOut className="w-4 h-4" /> Çıkış Yap
        </Button>
      </div>
    );
  } else {
    content = (
      <div className="space-y-4">
        <div role="tablist" aria-label="Yönetici paneli" className="grid grid-cols-2 gap-2">
          {TABS.map((t) => {
            const active = t.value === tab;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.value)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-heading font-bold uppercase tracking-wider transition-colors ${
                  active
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>
        {tab === 'questions' ? <QuestionsPanel /> : <StatsPanel />}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md mx-auto py-2 px-1 space-y-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-black uppercase font-heading text-white text-glow-cyan">
          <ShieldCheck className="w-7 h-7 text-cyan-400" /> Yönetici Paneli
        </h1>
        {phase === 'ready' && (
          <Button variant="ghost" size="sm" onClick={() => void handleLogout()} aria-label="Çıkış yap">
            <LogOut className="w-4 h-4" /> Çıkış
          </Button>
        )}
      </div>
      {phase === 'ready' && email && <p className="text-xs text-slate-400 -mt-2">{email}</p>}
      <Card variant="cyan" className="relative p-4">
        {content}
      </Card>
    </motion.div>
  );
};

export default AdminScreen;
