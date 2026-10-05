import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  AnswerResult,
  ConnectionStatus,
  GameState,
  Player,
  Question,
  ReviewQuestion,
  ScreenType,
} from '../types/game';
import { avatarIconFor } from '../data/avatars';
import { APP_CONFIG, DEFAULT_MATCH_SETTINGS, type MatchSettings } from '../config/appConfig';
import { supabase, isSupabaseConfigured, ensureAnonymousSession } from '../lib/supabase';
import { syncServerClock } from '../lib/serverClock';

interface GameContextType extends GameState {
  setScreen: (screen: ScreenType) => void;
  createRoom: (name: string, avatarId: string) => Promise<void>;
  joinRoom: (code: string, name: string, avatarId: string) => Promise<void>;
  /** Re-enters a room this user is already a member of (quick match / tournament). */
  enterRoom: (code: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  toggleReady: () => Promise<void>;
  answerQuestion: (optionIndex: number) => Promise<AnswerResult>;
  advanceQuestionIndex: () => void;
  finishQuiz: () => Promise<void>;
  requestRematch: (want?: boolean) => Promise<void>;
  /** After the opponent left: put this room back in LOBBY to wait for a new opponent. */
  returnToLobby: () => Promise<void>;
  fetchMatchReview: () => Promise<ReviewQuestion[] | null>;
  startQuickMatch: (name: string, avatarId: string) => Promise<void>;
  cancelQuickMatch: () => Promise<void>;
  openTournament: (code: string | null) => void;
  updatePlayerName: (name: string) => void;
  updatePlayerAvatar: (avatarId: string) => void;
  clearError: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const ROOM_STORAGE_KEY = 'teknofest_room_code';
const TOURNAMENT_STORAGE_KEY = 'teknofest_tournament_code';
const NOT_CONFIGURED_MSG =
  'Supabase veritabanı bağlantısı yapılandırılmamış! Lütfen VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY ortam değişkenlerini tanımlayın.';
const ROOM_SCREENS: ScreenType[] = ['LOBBY', 'VS', 'QUIZ', 'RESULT'];

const readStorage = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStorage = (key: string, value: string | null) => {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable (private mode); the session simply won't survive a refresh.
  }
};

const screenFromHash = (): ScreenType => {
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  if (hash.startsWith('#/admin')) return 'ADMIN';
  if (hash.startsWith('#/leaderboard')) return 'LEADERBOARD';
  return 'HOME';
};

const clampName = (name: string) => name.trim().slice(0, APP_CONFIG.playerNameMaxLength);

const EMPTY_PLAYER: Player = {
  id: '',
  name: 'Oyuncu 1',
  avatar: '🚀',
  isHost: true,
  isReady: false,
  score: 0,
  correctAnswers: 0,
};

type PlayerRow = {
  player_id: string;
  auth_user_id: string | null;
  name: string;
  avatar: string;
  is_host: boolean;
  is_ready: boolean;
  score: number | null;
  correct_answers: number | null;
  current_question_index: number | null;
  finished_at: string | null;
  last_seen_at?: string | null;
  wants_rematch?: boolean | null;
};

const mapPlayer = (row: PlayerRow): Player => ({
  id: row.player_id,
  name: row.name,
  avatar: row.avatar,
  isHost: row.is_host,
  isReady: row.is_ready,
  score: row.score || 0,
  correctAnswers: row.correct_answers || 0,
  currentQuestionIndex: row.current_question_index || 0,
  finishedAt: row.finished_at || null,
  lastSeenAt: row.last_seen_at || null,
  wantsRematch: Boolean(row.wants_rematch),
});

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(screenFromHash);
  const [roomCode, setRoomCode] = useState<string>('');
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [player1, setPlayer1] = useState<Player>(EMPTY_PLAYER);
  const [player2, setPlayer2] = useState<Player | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [matchStartTime, setMatchStartTime] = useState<number | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [isDraw, setIsDraw] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [settings, setSettings] = useState<MatchSettings>(DEFAULT_MATCH_SETTINGS);
  const [roomTournamentCode, setRoomTournamentCode] = useState<string | null>(null);
  const [activeTournamentCode, setActiveTournamentCode] = useState<string | null>(() =>
    readStorage(TOURNAMENT_STORAGE_KEY)
  );
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const activeChannelRef = useRef<RealtimeChannel | null>(null);
  const myIdRef = useRef<string>('');
  const roomCodeRef = useRef<string>('');
  const matchNoRef = useRef<number | null>(null);
  const finishInFlightRef = useRef(false);
  const needsResyncRef = useRef(false);
  const quickMatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quickMatchActiveRef = useRef(false);

  const clearError = () => setErrorMsg(null);
  const setScreen = (screen: ScreenType) => setCurrentScreen(screen);

  const updatePlayerName = (name: string) => {
    setPlayer1((prev) => ({ ...prev, name: clampName(name) || 'TeknoOyuncu' }));
  };

  const updatePlayerAvatar = (avatarId: string) => {
    setPlayer1((prev) => ({ ...prev, avatar: avatarIconFor(avatarId, prev.avatar) }));
  };

  const resetRoomState = useCallback(() => {
    if (activeChannelRef.current) {
      void supabase.removeChannel(activeChannelRef.current);
      activeChannelRef.current = null;
    }
    roomCodeRef.current = '';
    matchNoRef.current = null;
    finishInFlightRef.current = false;
    writeStorage(ROOM_STORAGE_KEY, null);
    setRoomCode('');
    setPlayer1((prev) => ({ ...EMPTY_PLAYER, name: prev.name, avatar: prev.avatar }));
    setPlayer2(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setIsStarting(false);
    setMatchStartTime(null);
    setWinner(null);
    setIsDraw(false);
    setRoomTournamentCode(null);
    setConnectionStatus('idle');
  }, []);

  /**
   * Fetches room state and players from Supabase and syncs local state.
   * The server is the source of truth for which screen the room is on.
   */
  const syncRoomFromSupabase = useCallback(
    async (code: string) => {
      if (!isSupabaseConfigured || !code) return;
      const cleanCode = code.trim().toUpperCase();

      try {
        const { data: roomRecord, error: roomErr } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', cleanCode)
          .maybeSingle();

        if (roomErr) {
          console.error('[Supabase SyncRoom Error]', roomErr);
          return;
        }
        // Stale response for a room we already left.
        if (roomCodeRef.current !== cleanCode) return;

        if (!roomRecord) {
          // Room deleted (e.g. cleaned up) or we are no longer a member.
          resetRoomState();
          setErrorMsg('Oda artık mevcut değil.');
          setCurrentScreen('HOME');
          return;
        }

        const { data: playersList, error: playersErr } = await supabase
          .from('room_players')
          .select('*')
          .eq('room_code', cleanCode)
          .order('created_at', { ascending: true });

        if (playersErr) {
          console.error('[Supabase SyncPlayers Error]', playersErr);
          return;
        }
        if (roomCodeRef.current !== cleanCode) return;

        setMatchStartTime(roomRecord.started_at ? new Date(roomRecord.started_at).getTime() : null);
        setRoomTournamentCode(roomRecord.tournament_code ?? null);
        if (Array.isArray(roomRecord.match_questions) && roomRecord.match_questions.length > 0) {
          setQuestions(roomRecord.match_questions as Question[]);
        }

        const rows = (playersList ?? []) as PlayerRow[];
        const hostRow = rows.find((p) => p.is_host) || rows[0];
        const guestRow = rows.find((p) => p !== hostRow) ?? null;
        if (hostRow) setPlayer1(mapPlayer(hostRow));
        setPlayer2(guestRow ? mapPlayer(guestRow) : null);

        // A new match (first sync, rematch, restart, or restore after refresh):
        // resume from the server-side question index. During a match the client
        // owns navigation so the 1.2s feedback animation isn't cut short.
        const matchNo = typeof roomRecord.match_no === 'number' ? roomRecord.match_no : 1;
        if (matchNoRef.current !== matchNo) {
          matchNoRef.current = matchNo;
          finishInFlightRef.current = false;
          const mine = rows.find((p) => p.auth_user_id === myIdRef.current || p.player_id === myIdRef.current);
          setCurrentQuestionIndex(mine?.current_question_index ?? 0);
        }

        const status = roomRecord.status as string;
        setIsStarting(status === 'VS');
        setCurrentScreen((screen) => {
          if (status === 'VS' || status === 'QUIZ') return screen === 'VS' || screen === 'QUIZ' ? screen : 'VS';
          if (status === 'RESULT') return 'RESULT';
          if (status === 'LOBBY' && ROOM_SCREENS.includes(screen)) return 'LOBBY';
          return screen;
        });
        if (status === 'LOBBY') {
          setCurrentQuestionIndex(0);
          finishInFlightRef.current = false;
        }
      } catch (err) {
        console.error('[syncRoomFromSupabase Exception]', err);
      }
    },
    [resetRoomState]
  );

  /**
   * Subscribes to Supabase Realtime channel for room changes and tracks link health.
   * Any event triggers a full resync; after a reconnect we also resync because
   * events fired while the socket was down (phone screen locked) are lost.
   */
  const subscribeToRoom = useCallback(
    (code: string) => {
      if (!isSupabaseConfigured) return;
      const cleanCode = code.trim().toUpperCase();

      if (activeChannelRef.current) {
        void supabase.removeChannel(activeChannelRef.current);
      }
      setConnectionStatus('connecting');

      const resync = () => void syncRoomFromSupabase(cleanCode);
      const channel = supabase
        .channel(`room_${cleanCode}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_code=eq.${cleanCode}` }, resync)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${cleanCode}` }, resync)
        .subscribe((status) => {
          if (activeChannelRef.current !== channel) return;
          if (status === 'SUBSCRIBED') {
            setConnectionStatus(navigator.onLine === false ? 'offline' : 'connected');
            if (needsResyncRef.current) {
              needsResyncRef.current = false;
              resync();
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            needsResyncRef.current = true;
            setConnectionStatus(navigator.onLine === false ? 'offline' : 'reconnecting');
          } else if (status === 'CLOSED') {
            needsResyncRef.current = true;
          }
        });

      activeChannelRef.current = channel;
    },
    [syncRoomFromSupabase]
  );

  /** Shared tail of create/join/enter: remember the room, subscribe, then pull state. */
  const attachToRoom = useCallback(
    async (code: string, authUserId: string) => {
      myIdRef.current = authUserId;
      roomCodeRef.current = code;
      matchNoRef.current = null;
      writeStorage(ROOM_STORAGE_KEY, code);
      setMyPlayerId(authUserId);
      setRoomCode(code);
      setWinner(null);
      setIsDraw(false);
      setCurrentScreen('LOBBY');
      subscribeToRoom(code);
      await syncRoomFromSupabase(code);
    },
    [subscribeToRoom, syncRoomFromSupabase]
  );

  const requireSession = async (): Promise<string | null> => {
    if (!isSupabaseConfigured) {
      setErrorMsg(NOT_CONFIGURED_MSG);
      return null;
    }
    try {
      const uid = await ensureAnonymousSession();
      if (!uid) setErrorMsg('Supabase oturumu açılamadı! İnternet bağlantınızı kontrol edin.');
      return uid;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Oturum açılamadı.');
      return null;
    }
  };

  /**
   * CREATE ROOM — the server generates a unique code (no client-side collision retry needed).
   */
  const createRoom = async (name: string, avatarId: string) => {
    setErrorMsg(null);
    setIsBusy(true);
    try {
      const authUserId = await requireSession();
      if (!authUserId) return;

      const cleanName = clampName(name) || 'EvSahibi';
      const avatar = avatarIconFor(avatarId);
      const { data: createRes, error: createErr } = await supabase.rpc('create_room_rpc', {
        p_code: null,
        p_name: cleanName,
        p_avatar: avatar,
        p_match_questions: null,
        p_player_id: authUserId,
      });

      if (createErr) {
        console.error('[Supabase create_room_rpc Error]', createErr);
        setErrorMsg(`Oda oluşturma sunucu hatası (${createErr.code || 'ERR'}): ${createErr.message}`);
        return;
      }
      if (!createRes?.success || !createRes.code) {
        setErrorMsg(createRes?.error || 'Oda oluşturulamadı.');
        return;
      }

      setPlayer1((prev) => ({ ...prev, name: cleanName, avatar }));
      await attachToRoom(String(createRes.code), createRes.player_id || authUserId);
    } catch (err) {
      console.error('[createRoom Exception]', err);
      setErrorMsg(err instanceof Error ? err.message : 'Oda oluşturulurken bir hata oluştu.');
    } finally {
      setIsBusy(false);
    }
  };

  /**
   * JOIN ROOM
   */
  const joinRoom = async (code: string, name: string, avatarId: string) => {
    setErrorMsg(null);
    const cleanCode = code.trim();
    if (!isSupabaseConfigured) {
      setErrorMsg(NOT_CONFIGURED_MSG);
      return;
    }
    if (!/^\d{6}$/.test(cleanCode)) {
      setErrorMsg('Geçersiz oda kodu! Lütfen 6 haneli sayısal oda kodunu girin (Örn: 849204).');
      return;
    }

    setIsBusy(true);
    try {
      const authUserId = await requireSession();
      if (!authUserId) return;

      const cleanName = clampName(name) || 'Katılımcı';
      const avatar = avatarIconFor(avatarId, '⚡');
      const { data: joinRes, error: joinErr } = await supabase.rpc('join_room_atomic', {
        p_room_code: cleanCode,
        p_player_id: authUserId,
        p_name: cleanName,
        p_avatar: avatar,
      });

      if (joinErr) {
        console.error('[Supabase join_room_atomic RPC Error]', joinErr);
        setErrorMsg(`Odaya katılım sunucu hatası (${joinErr.code || 'ERR'}): ${joinErr.message}`);
        return;
      }
      if (!joinRes?.success) {
        setErrorMsg(joinRes?.error || `"${cleanCode}" kodlu odaya katılım başarısız.`);
        return;
      }

      await attachToRoom(cleanCode, joinRes.player_id || authUserId);
    } catch (err) {
      console.error('[joinRoom Exception]', err);
      setErrorMsg(err instanceof Error ? err.message : 'Odaya katılırken beklenmeyen bir hata oluştu.');
    } finally {
      setIsBusy(false);
    }
  };

  const enterRoom = async (code: string): Promise<boolean> => {
    const authUserId = await requireSession();
    if (!authUserId) return false;
    // join_room_atomic returns success immediately for an existing member.
    const { data, error } = await supabase.rpc('join_room_atomic', {
      p_room_code: code,
      p_player_id: authUserId,
      p_name: clampName(player1.name) || 'Oyuncu',
      p_avatar: player1.avatar,
    });
    if (error || !data?.success) {
      setErrorMsg(error?.message || data?.error || 'Odaya girilemedi.');
      return false;
    }
    await attachToRoom(code, authUserId);
    return true;
  };

  /**
   * LEAVE ROOM — frees the seat server-side so the room isn't "full" forever,
   * drops the realtime subscription and forgets the room for refresh-restore.
   */
  const leaveRoom = async () => {
    const code = roomCodeRef.current;
    resetRoomState();
    setErrorMsg(null);
    setCurrentScreen(activeTournamentCode ? 'TOURNAMENT' : 'HOME');
    if (code && isSupabaseConfigured) {
      const { error } = await supabase.rpc('leave_room_rpc', { p_room_code: code });
      if (error) console.warn('[leave_room_rpc]', error);
    }
  };

  /**
   * TOGGLE READY
   */
  const toggleReady = async () => {
    if (!roomCode || !isSupabaseConfigured) return;
    try {
      const myId = myIdRef.current;
      const isHostMe = myId === player1.id;
      const newReadyState = !(isHostMe ? player1.isReady : player2?.isReady || false);

      // Optimistic local update
      if (isHostMe) setPlayer1((prev) => ({ ...prev, isReady: newReadyState }));
      else setPlayer2((prev) => (prev ? { ...prev, isReady: newReadyState } : null));

      const { data: rpcRes, error: rpcErr } = await supabase.rpc('set_player_ready_and_check_start', {
        p_room_code: roomCode,
        p_player_id: myId,
        p_ready_state: newReadyState,
      });

      if (rpcErr || rpcRes?.success === false) {
        console.error('[Supabase RPC toggleReady Error]', rpcErr || rpcRes?.error);
        setErrorMsg(rpcErr?.message || rpcRes?.error || 'Hazır durumu güncellenemedi.');
      } else if (rpcRes?.match_started) {
        setIsStarting(true);
        if (rpcRes.started_at) setMatchStartTime(new Date(rpcRes.started_at).getTime());
        setCurrentScreen('VS');
      }
      await syncRoomFromSupabase(roomCode);
    } catch (err) {
      console.error('[toggleReady Exception]', err);
    }
  };

  /**
   * ANSWER QUESTION VIA SECURE SERVER RPC (the server is the only scorer).
   */
  const answerQuestion = async (optionIndex: number): Promise<AnswerResult> => {
    const currentQ = questions[currentQuestionIndex];
    if (!currentQ) return { success: false, error: 'Soru bulunamadı' };
    if (!isSupabaseConfigured || !roomCode) return { success: false, error: 'Aktif oda yok' };

    const { data: answerRes, error: answerErr } = await supabase.rpc('submit_answer_rpc', {
      p_room_code: roomCode,
      p_player_id: myIdRef.current,
      p_question_id: currentQ.id,
      p_selected_option_index: optionIndex,
    });

    if (answerErr || !answerRes?.success) {
      const errMsg = answerErr?.message || answerRes?.error || 'Cevap iletilemedi';
      console.error('[submit_answer_rpc Error]', errMsg);
      return { success: false, error: errMsg };
    }

    return {
      success: true,
      isCorrect: Boolean(answerRes.is_correct),
      correctIndex: typeof answerRes.correct_index === 'number' ? answerRes.correct_index : undefined,
      pointsAdded: answerRes.points_added || 0,
      matchFinished: Boolean(answerRes.match_finished),
    };
  };

  const advanceQuestionIndex = () => {
    setCurrentQuestionIndex((prev) => (prev + 1 < questions.length ? prev + 1 : prev));
  };

  /**
   * Asks the server to close the match. "Not finished yet" is an expected answer
   * while the opponent is still playing or our clock is slightly ahead, so it is
   * retried silently by the caller's timer instead of surfacing as an error.
   */
  const finishQuiz = useCallback(async () => {
    const code = roomCodeRef.current;
    if (finishInFlightRef.current || !code || !isSupabaseConfigured) return;
    finishInFlightRef.current = true;

    const { data, error } = await supabase.rpc('finish_room_rpc', { p_room_code: code });
    if (error || !data?.success) {
      finishInFlightRef.current = false;
      const message = error?.message || data?.error || '';
      if (!/tamamlanmadı/i.test(message)) setErrorMsg(message || 'Maç bitirilemedi.');
      return;
    }
    await syncRoomFromSupabase(code);
  }, [syncRoomFromSupabase]);

  const requestRematch = async (want = true) => {
    if (!roomCode) return;
    const { data, error } = await supabase.rpc('request_rematch_rpc', { p_room_code: roomCode, p_want: want });
    if (error || !data?.success) {
      setErrorMsg(error?.message || data?.error || 'Rövanş isteği gönderilemedi.');
      return;
    }
    await syncRoomFromSupabase(roomCode);
  };

  const returnToLobby = async () => {
    if (!roomCode) return;
    const { data, error } = await supabase.rpc('restart_room_rpc', { p_room_code: roomCode });
    if (error || !data?.success) {
      setErrorMsg(error?.message || data?.error || 'Lobiye dönülemedi.');
      return;
    }
    await syncRoomFromSupabase(roomCode);
  };

  const fetchMatchReview = useCallback(async (): Promise<ReviewQuestion[] | null> => {
    const code = roomCodeRef.current;
    if (!code || !isSupabaseConfigured) return null;
    const { data, error } = await supabase.rpc('get_match_review_rpc', { p_room_code: code });
    if (error || !data?.success) return null;
    return (data.questions ?? []) as ReviewQuestion[];
  }, []);

  /**
   * QUICK MATCH — polls the matchmaking queue until the server pairs us with
   * someone, then enters the room it created for both players.
   */
  const stopQuickMatchPolling = () => {
    quickMatchActiveRef.current = false;
    if (quickMatchTimerRef.current) clearTimeout(quickMatchTimerRef.current);
    quickMatchTimerRef.current = null;
  };

  const startQuickMatch = async (name: string, avatarId: string) => {
    setErrorMsg(null);
    const authUserId = await requireSession();
    if (!authUserId) return;

    const cleanName = clampName(name) || 'TeknoOyuncu';
    const avatar = avatarIconFor(avatarId);
    setPlayer1((prev) => ({ ...prev, name: cleanName, avatar }));
    stopQuickMatchPolling();
    quickMatchActiveRef.current = true;
    setCurrentScreen('MATCHMAKING');

    const poll = async () => {
      if (!quickMatchActiveRef.current) return;
      const { data, error } = await supabase.rpc('quick_match_rpc', { p_name: cleanName, p_avatar: avatar });
      if (!quickMatchActiveRef.current) return;
      if (error || !data?.success) {
        stopQuickMatchPolling();
        setErrorMsg(error?.message || data?.error || 'Eşleşme başlatılamadı.');
        setCurrentScreen('HOME');
        return;
      }
      if (data.status === 'MATCHED' && data.room_code) {
        stopQuickMatchPolling();
        await attachToRoom(String(data.room_code), authUserId);
        return;
      }
      quickMatchTimerRef.current = setTimeout(() => void poll(), APP_CONFIG.quickMatchPollMs);
    };
    await poll();
  };

  const cancelQuickMatch = async () => {
    stopQuickMatchPolling();
    setCurrentScreen('HOME');
    if (isSupabaseConfigured) await supabase.rpc('cancel_quick_match_rpc');
  };

  const openTournament = (code: string | null) => {
    setActiveTournamentCode(code);
    writeStorage(TOURNAMENT_STORAGE_KEY, code);
    setCurrentScreen(code === null ? 'HOME' : 'TOURNAMENT');
  };

  // Mount: reuse (never replace) the auth session, align the clock with the server,
  // and restore the room this tab was in before a refresh.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    (async () => {
      let uid: string | null = null;
      try {
        uid = await ensureAnonymousSession();
      } catch (err) {
        if (!cancelled) setErrorMsg(err instanceof Error ? err.message : 'Oturum açılamadı.');
        return;
      }
      if (cancelled || !uid) return;
      myIdRef.current = uid;
      setMyPlayerId(uid);

      void syncServerClock(async () => {
        const { data } = await supabase.rpc('get_server_time_rpc');
        const s = data?.settings;
        if (s && !cancelled) {
          setSettings({
            matchSeconds: Number(s.match_seconds) || DEFAULT_MATCH_SETTINGS.matchSeconds,
            questionCount: Number(s.question_count) || DEFAULT_MATCH_SETTINGS.questionCount,
            countdownSeconds: Number(s.countdown_seconds) || DEFAULT_MATCH_SETTINGS.countdownSeconds,
          });
        }
        return data?.server_time ?? null;
      });

      const savedRoom = readStorage(ROOM_STORAGE_KEY);
      if (savedRoom) {
        roomCodeRef.current = savedRoom;
        setRoomCode(savedRoom);
        subscribeToRoom(savedRoom);
        await syncRoomFromSupabase(savedRoom);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Runs once per mount; the callbacks are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resync whenever the tab comes back to the foreground or the network returns:
  // realtime events sent while the phone was locked are not replayed.
  useEffect(() => {
    const resync = () => {
      const code = roomCodeRef.current;
      if (code && document.visibilityState === 'visible') void syncRoomFromSupabase(code);
    };
    const onOnline = () => {
      setConnectionStatus((s) => (s === 'offline' ? 'reconnecting' : s));
      resync();
    };
    const onOffline = () => setConnectionStatus((s) => (s === 'idle' ? s : 'offline'));

    document.addEventListener('visibilitychange', resync);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [syncRoomFromSupabase]);

  // Heartbeat so the opponent can see whether we're still connected.
  useEffect(() => {
    if (!roomCode || !isSupabaseConfigured) return;
    const beat = () => {
      if (document.visibilityState === 'visible') void supabase.rpc('heartbeat_rpc', { p_room_code: roomCode });
    };
    beat();
    const timer = setInterval(beat, APP_CONFIG.heartbeatIntervalMs);
    return () => clearInterval(timer);
  }, [roomCode]);

  // Keep the URL hash in sync for the standalone screens (admin / stand leaderboard).
  useEffect(() => {
    const onHash = () => {
      const target = screenFromHash();
      setCurrentScreen((screen) => (target !== 'HOME' ? target : screen === 'ADMIN' || screen === 'LEADERBOARD' ? 'HOME' : screen));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(
    () => () => {
      stopQuickMatchPolling();
      if (activeChannelRef.current) void supabase.removeChannel(activeChannelRef.current);
    },
    []
  );

  const isMePlayer2 = Boolean(player2 && myPlayerId === player2.id);
  const myPlayer = isMePlayer2 ? (player2 as Player) : player1;
  const opponentPlayer = isMePlayer2 ? player1 : player2;

  // Winner is derived from server-synced scores once the room reaches RESULT.
  useEffect(() => {
    if (currentScreen !== 'RESULT') return;
    if (!player2) {
      // Opponent left (forfeit): the remaining player wins.
      setWinner(player1.id ? player1 : null);
      setIsDraw(false);
    } else if (player1.score > player2.score) {
      setWinner(player1);
      setIsDraw(false);
    } else if (player2.score > player1.score) {
      setWinner(player2);
      setIsDraw(false);
    } else {
      setWinner(null);
      setIsDraw(true);
    }
  }, [currentScreen, player1, player2]);

  return (
    <GameContext.Provider
      value={{
        currentScreen,
        roomCode,
        myPlayerId,
        player1,
        player2,
        myPlayer,
        opponentPlayer,
        currentQuestionIndex,
        questions,
        isStarting,
        matchStartTime,
        winner,
        isDraw,
        errorMsg,
        connectionStatus,
        settings,
        roomTournamentCode,
        activeTournamentCode,
        isBusy,
        setScreen,
        createRoom,
        joinRoom,
        enterRoom,
        leaveRoom,
        toggleReady,
        answerQuestion,
        advanceQuestionIndex,
        finishQuiz,
        requestRematch,
        returnToLobby,
        fetchMatchReview,
        startQuickMatch,
        cancelQuickMatch,
        openTournament,
        updatePlayerName,
        updatePlayerAvatar,
        clearError,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
