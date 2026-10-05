import { fireEvent, render, screen } from '@testing-library/react';
import { SoundToggle } from './SoundToggle';
import { __resetSoundForTests, isMuted } from '../../lib/sound';

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

describe('SoundToggle', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    __resetSoundForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('tıklayınca sessize alır ve etiketi günceller', () => {
    render(<SoundToggle />);
    const button = screen.getByRole('button', { name: 'Sesi kapat' });
    fireEvent.click(button);
    expect(isMuted()).toBe(true);
    expect(screen.getByRole('button', { name: 'Sesi aç' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Sesi aç' }));
    expect(isMuted()).toBe(false);
    expect(screen.getByRole('button', { name: 'Sesi kapat' })).toBeInTheDocument();
  });
});
