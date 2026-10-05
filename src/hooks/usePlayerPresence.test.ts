import { isPlayerOnline } from './usePlayerPresence';

describe('isPlayerOnline', () => {
  const now = Date.parse('2026-10-05T12:00:00Z');
  it('yakın zamanda görülen oyuncu çevrimiçi', () => {
    expect(isPlayerOnline('2026-10-05T11:59:40Z', now)).toBe(true);
  });
  it('45 sn\'den uzun süredir sinyal yoksa çevrimdışı', () => {
    expect(isPlayerOnline('2026-10-05T11:58:00Z', now)).toBe(false);
  });
  it('bilinmeyen/bozuk değer çevrimiçi sayılır', () => {
    expect(isPlayerOnline(null, now)).toBe(true);
    expect(isPlayerOnline('bozuk', now)).toBe(true);
  });
});
