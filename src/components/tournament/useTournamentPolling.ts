import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { TournamentData } from './types';

export const TOURNAMENT_POLL_MS = 3000;

interface PollState {
  data: TournamentData | null;
  /** Geçici hata (bağlantı vb.) — polling devam eder. */
  error: string | null;
  /** Kalıcı hata ({success:false}) — polling durur. */
  fatalError: string | null;
}

const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

/**
 * get_tournament_rpc'yi 3 sn'de bir çağırır. Sekme gizliyken atlar,
 * unmount'ta durur ve kalıcı hatada ({success:false}) polling'i keser.
 */
export function useTournamentPolling(code: string) {
  const [state, setState] = useState<PollState>({ data: null, error: null, fatalError: null });
  const activeRef = useRef(true);
  const stoppedRef = useRef(false);
  const inFlightRef = useRef(false);

  const load = useCallback(
    async (force = false) => {
      if (!activeRef.current || stoppedRef.current || inFlightRef.current) return;
      if (!force && isHidden()) return;
      inFlightRef.current = true;
      try {
        const { data, error } = await supabase.rpc('get_tournament_rpc', { p_code: code });
        if (!activeRef.current) return;
        if (error) {
          setState((prev) => ({ ...prev, error: error.message || 'Turnuva bilgisi alınamadı.' }));
          return;
        }
        if (!data?.success) {
          stoppedRef.current = true;
          setState((prev) => ({ ...prev, fatalError: data?.error || 'Turnuva bulunamadı' }));
          return;
        }
        setState({
          data: {
            tournament: data.tournament,
            players: data.players ?? [],
            matches: data.matches ?? [],
            my_room_code: data.my_room_code ?? null,
          },
          error: null,
          fatalError: null,
        });
      } catch (err) {
        if (activeRef.current) {
          setState((prev) => ({
            ...prev,
            error: err instanceof Error ? err.message : 'Turnuva bilgisi alınamadı.',
          }));
        }
      } finally {
        inFlightRef.current = false;
      }
    },
    [code]
  );

  useEffect(() => {
    activeRef.current = true;
    stoppedRef.current = false;
    // İlk yükleme bir sonraki tick'te: effect içinde senkron setState olmasın.
    const first = setTimeout(() => void load(true), 0);
    const id = setInterval(() => void load(), TOURNAMENT_POLL_MS);
    const onVisibility = () => {
      if (!isHidden()) void load();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      activeRef.current = false;
      clearTimeout(first);
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { ...state, refresh };
}
