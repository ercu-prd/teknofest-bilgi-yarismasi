import { __resetSoundForTests, isMuted, playSound, setMuted, subscribeMuted, vibrate } from './sound';

const param = () => ({
  setValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
});

const createOscillator = vi.fn(() => ({
  type: 'sine',
  frequency: param(),
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}));

const createGain = vi.fn(() => ({ gain: param(), connect: vi.fn() }));
const ctorSpy = vi.fn();

class FakeAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  createOscillator = createOscillator;
  createGain = createGain;
  resume = vi.fn().mockResolvedValue(undefined);
  constructor() {
    ctorSpy();
  }
}

// Node 25'in yerleşik localStorage'ı jsdom'unkini gölgeleyebildiği için bellek içi depo kullan.
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

let storage = new MemoryStorage();

const vibrateSpy = vi.fn(() => true);

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  __resetSoundForTests();
  createOscillator.mockClear();
  createGain.mockClear();
  ctorSpy.mockClear();
  vibrateSpy.mockClear();
  vi.stubGlobal('AudioContext', FakeAudioContext);
  Object.defineProperty(navigator, 'vibrate', { value: vibrateSpy, configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
});

describe('playSound', () => {
  it('AudioContext ilk kullanımda bir kez oluşturulur ve osilatör çalınır', () => {
    expect(ctorSpy).not.toHaveBeenCalled();
    playSound('correct');
    playSound('tick');
    expect(ctorSpy).toHaveBeenCalledTimes(1);
    expect(createOscillator).toHaveBeenCalled();
  });

  it('tüm ses türleri hatasız çalınır', () => {
    for (const kind of ['correct', 'wrong', 'tick', 'start', 'win', 'lose'] as const) {
      expect(() => playSound(kind)).not.toThrow();
    }
  });

  it('sessizdeyken ses çalmaz ve AudioContext oluşturmaz', () => {
    setMuted(true);
    playSound('win');
    expect(ctorSpy).not.toHaveBeenCalled();
    expect(createOscillator).not.toHaveBeenCalled();
  });

  it('AudioContext yoksa sessizce hiçbir şey yapmaz', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => playSound('start')).not.toThrow();
    expect(createOscillator).not.toHaveBeenCalled();
  });
});

describe('vibrate', () => {
  it('navigator.vibrate varsa çağırır', () => {
    vibrate([50, 30, 50]);
    expect(vibrateSpy).toHaveBeenCalledWith([50, 30, 50]);
  });

  it('sessizdeyken titreşim yapmaz', () => {
    setMuted(true);
    vibrate(100);
    expect(vibrateSpy).not.toHaveBeenCalled();
  });

  it('navigator.vibrate yoksa çökmez', () => {
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
    expect(() => vibrate(100)).not.toThrow();
  });
});

describe('sessize alma tercihi', () => {
  it('varsayılan olarak sessiz değildir', () => {
    expect(isMuted()).toBe(false);
  });

  it('tercih localStorage’da kalıcıdır', () => {
    setMuted(true);
    expect(storage.getItem('teknofest_muted')).toBe('1');
    __resetSoundForTests();
    expect(isMuted()).toBe(true);

    setMuted(false);
    __resetSoundForTests();
    expect(isMuted()).toBe(false);
  });

  it('dinleyiciler değişiklikte bilgilendirilir ve abonelikten çıkılabilir', () => {
    const cb = vi.fn();
    const unsubscribe = subscribeMuted(cb);
    setMuted(true);
    setMuted(true); // değişiklik yok
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(true);
    unsubscribe();
    setMuted(false);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('localStorage erişimi tamamen engelliyse de çökmez', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    try {
      expect(isMuted()).toBe(false);
      expect(() => setMuted(true)).not.toThrow();
      expect(isMuted()).toBe(true);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storage });
    }
  });

  it('localStorage throw ederse çökmez ve bellekte çalışmaya devam eder', () => {
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(isMuted()).toBe(false);
    expect(() => setMuted(true)).not.toThrow();
    expect(isMuted()).toBe(true);
    playSound('tick');
    expect(createOscillator).not.toHaveBeenCalled();
  });
});
