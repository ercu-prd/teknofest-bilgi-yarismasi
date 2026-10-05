/**
 * Web Audio API ile sentezlenen kısa efekt sesleri ve titreşim.
 * Ses dosyası kullanılmaz; AudioContext ilk kullanımda tembel oluşturulur.
 */

export type SoundKind = 'correct' | 'wrong' | 'tick' | 'start' | 'win' | 'lose';

const MUTED_KEY = 'teknofest_muted';

type Listener = (muted: boolean) => void;
const listeners = new Set<Listener>();

let mutedCache: boolean | null = null;

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  if (mutedCache === null) mutedCache = readMuted();
  return mutedCache;
}

export function setMuted(muted: boolean): void {
  const changed = isMuted() !== muted;
  mutedCache = muted;
  try {
    localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
  } catch {
    // Depolama kullanılamıyorsa tercih yalnızca bu oturumda geçerli olur.
  }
  if (changed) listeners.forEach((cb) => cb(muted));
}

export function subscribeMuted(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

type AudioCtor = typeof AudioContext;

let audioCtx: AudioContext | null = null;

/** Yalnızca testler için: önbellekteki durumu sıfırlar. */
export function __resetSoundForTests(): void {
  mutedCache = null;
  audioCtx = null;
  listeners.clear();
}

function getContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  if (typeof window === 'undefined') return null;
  const Ctor: AudioCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

interface Note {
  freq: number;
  /** Başlangıç, saniye (göreli). */
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** Bitişte varılacak frekans (glide). */
  to?: number;
}

const PATTERNS: Record<SoundKind, Note[]> = {
  correct: [
    { freq: 660, at: 0, dur: 0.09, type: 'triangle' },
    { freq: 990, at: 0.08, dur: 0.14, type: 'triangle' },
  ],
  wrong: [{ freq: 220, at: 0, dur: 0.28, type: 'sawtooth', gain: 0.12, to: 120 }],
  tick: [{ freq: 1200, at: 0, dur: 0.04, type: 'square', gain: 0.06 }],
  start: [
    { freq: 440, at: 0, dur: 0.1, type: 'square', gain: 0.1 },
    { freq: 660, at: 0.12, dur: 0.1, type: 'square', gain: 0.1 },
    { freq: 880, at: 0.24, dur: 0.2, type: 'square', gain: 0.1 },
  ],
  win: [
    { freq: 523.25, at: 0, dur: 0.12, type: 'triangle' },
    { freq: 659.25, at: 0.12, dur: 0.12, type: 'triangle' },
    { freq: 783.99, at: 0.24, dur: 0.12, type: 'triangle' },
    { freq: 1046.5, at: 0.36, dur: 0.35, type: 'triangle' },
  ],
  lose: [
    { freq: 392, at: 0, dur: 0.18, type: 'sine' },
    { freq: 329.63, at: 0.18, dur: 0.18, type: 'sine' },
    { freq: 261.63, at: 0.36, dur: 0.4, type: 'sine', to: 196 },
  ],
};

export function playSound(kind: SoundKind): void {
  if (isMuted()) return;
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const now = ctx.currentTime;
    for (const note of PATTERNS[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + note.at;
      const end = start + note.dur;
      const peak = note.gain ?? 0.15;
      osc.type = note.type ?? 'sine';
      osc.frequency.setValueAtTime(note.freq, start);
      if (note.to) osc.frequency.exponentialRampToValueAtTime(note.to, end);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  } catch {
    // Ses çalınamazsa sessizce geç.
  }
}

export function vibrate(pattern: number | number[]): void {
  if (isMuted()) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Desteklenmiyorsa yok say.
  }
}
