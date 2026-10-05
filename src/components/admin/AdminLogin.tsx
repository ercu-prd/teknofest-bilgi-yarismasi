import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, Loader2, LogIn } from 'lucide-react';
import { Button } from '../ui/Button';

interface AdminLoginProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  error: string | null;
  onBack?: () => void;
}

const inputClass =
  'w-full h-11 rounded-xl border border-line bg-surface px-3.5 text-base text-ink placeholder:text-muted outline-none focus:border-brand transition-colors';
const labelClass = 'block text-sm font-medium text-ink-soft mb-1.5';

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSubmit, error, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setLocalError('E-posta ve şifre gerekli.');
      return;
    }
    setLocalError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(email.trim(), password);
    } finally {
      setIsSubmitting(false);
    }
  };

  const shownError = localError || error;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-label="Yönetici girişi">
      <div className="flex items-start gap-2 p-3 rounded-xl bg-warning-soft text-warning text-sm">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Yönetici girişi bu tarayıcıdaki oyuncu oturumunu değiştirir.</span>
      </div>
      <div>
        <label htmlFor="admin-email" className={labelClass}>
          E-posta
        </label>
        <input
          id="admin-email"
          type="email"
          autoComplete="username"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="admin-password" className={labelClass}>
          Şifre
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {shownError && (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-danger-soft text-danger text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{shownError}</span>
        </div>
      )}
      <Button type="submit" fullWidth disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
        Giriş yap
      </Button>
      {onBack && (
        <Button type="button" variant="ghost" fullWidth onClick={onBack}>
          Ana menü
        </Button>
      )}
    </form>
  );
};
