import { useEffect, useState } from 'react';
import { APP_CONFIG } from '../config/appConfig';
import { serverNow } from '../lib/serverClock';

/**
 * True while the given player's last heartbeat is recent. Re-evaluates every few
 * seconds because "staleness" changes with time even when no new data arrives.
 * Unknown (no heartbeat yet) counts as online so a fresh join doesn't flash offline.
 */
export function isPlayerOnline(lastSeenAt: string | null | undefined, now: number = serverNow()): boolean {
  if (!lastSeenAt) return true;
  const seen = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(seen)) return true;
  return now - seen < APP_CONFIG.opponentOfflineAfterMs;
}

export function usePlayerOnline(lastSeenAt: string | null | undefined): boolean {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), 5000);
    return () => clearInterval(timer);
  }, []);
  return isPlayerOnline(lastSeenAt, now);
}
