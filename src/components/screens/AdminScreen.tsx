import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, BarChart3, ListChecks, LogOut, ShieldCheck } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { LogoSpinnerBlock } from '../ui/LogoSpinner';
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
      <div role="alert" className="flex items-start gap-3 p-4 rounded-xl bg-warning-soft text-warning text-sm">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <span>Yönetici paneli için Supabase bağlantısı gerekli. VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlayın.</span>
      </div>
    );
  } else if (phase === 'checking' || phase === 'verifying') {
    content = (
      <LogoSpinnerBlock
        label={phase === 'checking' ? 'Oturum kontrol ediliyor' : 'Yetki kontrol ediliyor'}
        hint={phase === 'checking' ? 'Oturum kontrol ediliyor…' : 'Yetki kontrol ediliyor…'}
      />
    );
  } else if (phase === 'login') {
    content = <AdminLogin onSubmit={handleLogin} error={loginError} onBack={goHome} />;
  } else if (phase === 'not-admin') {
    content = (
      <div className="space-y-4 text-center">
        <div role="alert" className="p-4 rounded-xl bg-danger-soft text-danger text-sm space-y-1">
          <p className="font-semibold">Bu hesap yönetici değil.</p>
          {email && <p className="text-xs text-ink-soft break-all">{email}</p>}
          {adminError && <p className="text-xs">{adminError}</p>}
        </div>
        <Button variant="danger" fullWidth onClick={() => void handleLogout()}>
          <LogOut className="w-4 h-4" /> Çıkış yap
        </Button>
      </div>
    );
  } else {
    content = (
      <div className="space-y-4">
        <div role="tablist" aria-label="Yönetici paneli" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-subtle">
          {TABS.map((t) => {
            const active = t.value === tab;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.value)}
                className={`flex items-center justify-center gap-2 h-11 rounded-lg px-3 text-sm font-medium transition-colors cursor-pointer ${
                  active ? 'bg-surface text-ink shadow-card' : 'text-ink-soft hover:text-ink'
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="w-full space-y-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
            <ShieldCheck className="w-6 h-6 text-brand shrink-0" aria-hidden="true" /> Yönetici paneli
          </h1>
          {phase === 'ready' && email && <p className="text-xs text-muted truncate mt-0.5">{email}</p>}
        </div>
        {phase === 'ready' && (
          <Button variant="ghost" onClick={() => void handleLogout()} aria-label="Çıkış yap" className="shrink-0">
            <LogOut className="w-4 h-4" /> Çıkış
          </Button>
        )}
      </div>
      {phase === 'ready' ? content : <Card>{content}</Card>}
    </motion.div>
  );
};

export default AdminScreen;
