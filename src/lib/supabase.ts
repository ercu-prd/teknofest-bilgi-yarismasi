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
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * Ensures an active Supabase auth session (anonymous or authenticated) exists.
 * Awaits signInAnonymously if session is missing.
 */
export const ensureAnonymousSession = async (): Promise<string | null> => {
  if (!isSupabaseConfigured) return null;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user?.id) {
      return sessionData.session.user.id;
    }

    const { data: signInData, error: signInErr } = await supabase.auth.signInAnonymously();
    if (signInErr) {
      console.error('[Supabase AnonAuth Error]', signInErr);
      throw new Error(`Anonim Oturum Başarısız: ${signInErr.message}`);
    }

    if (!signInData?.user?.id) {
      throw new Error('Anonim oturum oluşturulamadı: Kullanıcı kimliği bulunamadı.');
    }

    return signInData.user.id;
  } catch (err: any) {
    console.error('[ensureAnonymousSession Exception]', err);
    throw err;
  }
};
