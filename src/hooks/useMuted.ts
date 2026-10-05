import { useCallback, useSyncExternalStore } from 'react';
import { isMuted, setMuted, subscribeMuted } from '../lib/sound';

const subscribe = (onChange: () => void) => subscribeMuted(() => onChange());

export function useMuted(): [boolean, () => void] {
  const muted = useSyncExternalStore(subscribe, isMuted, () => false);
  const toggle = useCallback(() => setMuted(!isMuted()), []);
  return [muted, toggle];
}
