import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

/**
 * Helper to check if actual valid Supabase credentials are set
 */
export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  !import.meta.env.VITE_SUPABASE_URL.includes('placeholder')
);

/**
 * Supabase Client Instance
 * Configured with environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 * The session persists in localStorage so a page refresh keeps the same auth.uid(),
 * which is what room membership is keyed on.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/** Turns a Supabase Auth error into a message a player at the stand can act on. */
export const describeAuthError = (err: { status?: number; message?: string } | null | undefined): string => {
  const message = err?.message ?? '';
  if (err?.status === 429 || /rate limit|too many/i.test(message)) {
    return 'Çok fazla giriş denemesi yapıldı (aynı ağdan çok sayıda oyuncu). Lütfen bir dakika sonra tekrar deneyin.';
  }
  if (/anonymous.*disabled|signups not allowed/i.test(message)) {
    return 'Anonim giriş Supabase projesinde kapalı. Authentication > Providers > Anonymous Sign-ins ayarını açın.';
  }
  return `Anonim oturum başarısız: ${message || 'bilinmeyen hata'}`;
};

let inFlightSession: Promise<string | null> | null = null;

/**
 * Returns the current auth user id, creating an anonymous user ONLY when no
 * session exists. signInAnonymously() always creates a brand-new user, so
 * calling it unconditionally would change auth.uid() on every page load and
 * silently evict the player from their own room. Concurrent callers (e.g.
 * React StrictMode double effects) share a single in-flight request.
 */
export const ensureAnonymousSession = (): Promise<string | null> => {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  if (inFlightSession) return inFlightSession;

  inFlightSession = (async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const existing = sessionData?.session?.user?.id;
    if (existing) return existing;

    const { data: signInData, error: signInErr } = await supabase.auth.signInAnonymously();
    if (signInErr) {
      console.error('[Supabase AnonAuth Error]', signInErr);
      throw new Error(describeAuthError(signInErr));
    }
    if (!signInData?.user?.id) {
      throw new Error('Anonim oturum oluşturulamadı: Kullanıcı kimliği bulunamadı.');
    }
    return signInData.user.id;
  })().finally(() => {
    inFlightSession = null;
  });

  return inFlightSession;
};
