/**
 * Oda / turnuva davet linkleri: `?room=123456` veya `?tournament=123456`.
 */

const CODE_RE = /^\d{6}$/;

function defaultOrigin(): string {
  return window.location.origin + window.location.pathname;
}

function buildLink(param: string, code: string, origin: string): string {
  const url = new URL(origin);
  url.search = '';
  url.hash = '';
  url.searchParams.set(param, code);
  return url.toString();
}

function readCode(param: string, search: string): string | null {
  const value = new URLSearchParams(search).get(param)?.trim();
  return value && CODE_RE.test(value) ? value : null;
}

function clearParam(param: string): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(param)) return;
    url.searchParams.delete(param);
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  } catch {
    // history kullanılamıyorsa yok say.
  }
}

export function buildRoomLink(code: string, origin: string = defaultOrigin()): string {
  return buildLink('room', code, origin);
}

export function readRoomCodeFromUrl(search: string = window.location.search): string | null {
  return readCode('room', search);
}

export function clearRoomCodeFromUrl(): void {
  clearParam('room');
}

export function buildTournamentLink(code: string, origin: string = defaultOrigin()): string {
  return buildLink('tournament', code, origin);
}

export function readTournamentCodeFromUrl(search: string = window.location.search): string | null {
  return readCode('tournament', search);
}

export function clearTournamentCodeFromUrl(): void {
  clearParam('tournament');
}
