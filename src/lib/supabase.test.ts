const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth }),
}));

const loadModule = async () => {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
  return import('./supabase');
};

afterEach(() => {
  vi.unstubAllEnvs();
  auth.getSession.mockReset();
  auth.signInAnonymously.mockReset();
});

describe('ensureAnonymousSession', () => {
  // Regresyon: eskiden her açılışta signInAnonymously() çağrılıyor, auth.uid() değişiyor
  // ve oyuncu sayfa yenileyince kendi odasından düşüyordu.
  it('mevcut oturum varsa yeni anonim kullanıcı OLUŞTURMAZ', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'existing-user' } } } });
    const { ensureAnonymousSession } = await loadModule();

    await expect(ensureAnonymousSession()).resolves.toBe('existing-user');
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('oturum yoksa bir kez anonim giriş yapar', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.signInAnonymously.mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
    const { ensureAnonymousSession } = await loadModule();

    await expect(ensureAnonymousSession()).resolves.toBe('new-user');
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('eşzamanlı çağrılar tek bir giriş isteğini paylaşır (StrictMode çift efekt)', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.signInAnonymously.mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null });
    const { ensureAnonymousSession } = await loadModule();

    const ids = await Promise.all([ensureAnonymousSession(), ensureAnonymousSession(), ensureAnonymousSession()]);
    expect(ids).toEqual(['new-user', 'new-user', 'new-user']);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('hız limiti (429) hatasını anlaşılır mesaja çevirir', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.signInAnonymously.mockResolvedValue({
      data: { user: null },
      error: { status: 429, message: 'Request rate limit reached' },
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ensureAnonymousSession } = await loadModule();

    await expect(ensureAnonymousSession()).rejects.toThrow(/Çok fazla giriş denemesi/);
  });

  it('başarısız denemeden sonra yeniden denenebilir', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.signInAnonymously
      .mockResolvedValueOnce({ data: { user: null }, error: { message: 'network' } })
      .mockResolvedValueOnce({ data: { user: { id: 'second-try' } }, error: null });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ensureAnonymousSession } = await loadModule();

    await expect(ensureAnonymousSession()).rejects.toThrow();
    await expect(ensureAnonymousSession()).resolves.toBe('second-try');
  });
});

describe('describeAuthError', () => {
  it('anonim girişin kapalı olduğunu açıklar', async () => {
    const { describeAuthError } = await loadModule();
    expect(describeAuthError({ message: 'Anonymous sign-ins are disabled' })).toMatch(/Anonymous Sign-ins/);
  });
});
