/**
 * Estimates the offset between this device's clock and the database clock so
 * countdowns derived from server timestamps (rooms.started_at) stay correct
 * even when the device clock is several seconds off.
 */
let offsetMs = 0;

export const serverNow = (): number => Date.now() + offsetMs;
export const getClockOffset = (): number => offsetMs;
export const setClockOffset = (value: number): void => {
  offsetMs = Number.isFinite(value) ? value : 0;
};

/**
 * Takes a few samples and keeps the one with the smallest round trip, assuming
 * the server read its clock half-way through the request (NTP-style).
 */
export async function syncServerClock(
  fetchServerTime: () => Promise<string | null>,
  samples = 3
): Promise<number | null> {
  let best: { rtt: number; offset: number } | null = null;
  for (let i = 0; i < samples; i++) {
    const sentAt = Date.now();
    let serverTime: string | null = null;
    try {
      serverTime = await fetchServerTime();
    } catch {
      serverTime = null;
    }
    const receivedAt = Date.now();
    const serverMs = serverTime ? new Date(serverTime).getTime() : NaN;
    if (!Number.isFinite(serverMs)) continue;
    const rtt = receivedAt - sentAt;
    const offset = serverMs - (sentAt + rtt / 2);
    if (!best || rtt < best.rtt) best = { rtt, offset };
  }
  if (!best) return null;
  setClockOffset(best.offset);
  return best.offset;
}
