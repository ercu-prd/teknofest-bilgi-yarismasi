export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch((err: unknown) => {
      console.warn('Service worker kaydedilemedi:', err);
    });
  } catch (err) {
    console.warn('Service worker kaydedilemedi:', err);
  }
}
