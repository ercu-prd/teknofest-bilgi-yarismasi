import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { GameState, Player, Question, ScreenType } from '../types/game';
import { AVATAR_OPTIONS } from '../data/mockQuestions';
import { supabase, isSupabaseConfigured, ensureAnonymousSession } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface GameContextType extends GameState {
  setScreen: (screen: ScreenType) => void;
  createRoom: (name: string, avatarId: string) => Promise<void>;
  joinRoom: (code: string, name: string, avatarId: string) => Promise<void>;
  toggleReady: () => Promise<void>;
  startMatchSequence: () => void;
  answerQuestion: (
    optionIndex: number
  ) => Promise<{ success: boolean; isCorrect?: boolean; correctIndex?: number; pointsAdded?: number; matchFinished?: boolean; error?: string } | void>;
  advanceQuestionIndex: () => void;
  finishQuiz: () => Promise<void>;
  restartGame: () => Promise<void>;
  updatePlayerName: (name: string) => void;
  updatePlayerAvatar: (avatarId: string) => void;
  clearError: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const getOrInitMyPlayerId = (): string => {
  let pid = sessionStorage.getItem('teknofest_my_player_id');
  if (!pid) {
    pid = `usr_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    sessionStorage.setItem('teknofest_my_player_id', pid);
  }
  return pid;
};

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('HOME');
  const [roomCode, setRoomCode] = useState<string>('');
  const [myPlayerId, setMyPlayerId] = useState<string>(getOrInitMyPlayerId);
  const [player1, setPlayer1] = useState<Player>({
    id: '',
    name: 'Oyuncu 1',
    avatar: '🚀',
    isHost: true,
    isReady: false,
    score: 0,
    streak: 0,
    correctAnswers: 0,
  });
  const [player2, setPlayer2] = useState<Player | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [timeRemaining] = useState<number>(90);
  const [isGameActive, setIsGameActive] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [matchStartTime, setMatchStartTime] = useState<number | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [isDraw, setIsDraw] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeChannelRef = useRef<RealtimeChannel | null>(null);
  const shouldRestoreProgressRef = useRef(true);
  const finishInFlightRef = useRef(false);

  const clearError = () => setErrorMsg(null);

  const setScreen = (screen: ScreenType) => {
    setCurrentScreen(screen);
  };

  const updatePlayerName = (name: string) => {
    setPlayer1((prev) => ({ ...prev, name: name.trim() || 'TeknoOyuncu' }));
  };

  const updatePlayerAvatar = (avatarId: string) => {
    const found = AVATAR_OPTIONS.find((a) => a.id === avatarId);
    if (found) {
      setPlayer1((prev) => ({ ...prev, avatar: found.icon }));
    }
  };

  // Sign in anonymously on mount if Supabase is configured
  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase.auth.signInAnonymously().then(({ data }) => {
        if (data?.user?.id) {
          setMyPlayerId(data.user.id);
          sessionStorage.setItem('teknofest_my_player_id', data.user.id);
        }
      }).catch((err) => {
        console.warn('[Supabase AnonAuth Notice]', err);
      });
    }
  }, []);

  /**
   * Fetches room state and players from Supabase and syncs local state
   */
  const syncRoomFromSupabase = useCallback(async (code: string) => {
    if (!isSupabaseConfigured) return;

    try {
      const cleanCode = code.trim().toUpperCase();

      // Fetch Room
      const { data: roomRecord, error: roomErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', cleanCode)
        .maybeSingle();

      if (roomErr) {
        console.error('[Supabase SyncRoom Error]', roomErr);
        return;
      }

      if (roomRecord) {
        if (roomRecord.started_at) {
          setMatchStartTime(new Date(roomRecord.started_at).getTime());
        }

        if (roomRecord.match_questions && Array.isArray(roomRecord.match_questions) && roomRecord.match_questions.length > 0) {
          setQuestions(roomRecord.match_questions as Question[]);
        }

        setCurrentScreen((screen) => {
          if (roomRecord.status === 'VS' && screen !== 'VS' && screen !== 'QUIZ') return 'VS';
          if (roomRecord.status === 'QUIZ' && screen !== 'RESULT') return 'QUIZ';
          if (roomRecord.status === 'RESULT') return 'RESULT';
          if (roomRecord.status === 'LOBBY' && screen === 'RESULT') return 'LOBBY';
          return screen;
        });
        if (roomRecord.status === 'VS') setIsStarting(true);
      }

      // Fetch Players
      const { data: playersList, error: playersErr } = await supabase
        .from('room_players')
        .select('*')
        .eq('room_code', cleanCode)
        .order('created_at', { ascending: true });

      if (playersErr) {
        console.error('[Supabase SyncPlayers Error]', playersErr);
        return;
      }

      if (playersList && playersList.length > 0) {
        const hostPlayer = playersList.find((p) => p.is_host) || playersList[0];
        const guestPlayer = playersList.find((p) => !p.is_host) || (playersList.length > 1 ? playersList[1] : null);

        setPlayer1({
          id: hostPlayer.player_id,
          name: hostPlayer.name,
          avatar: hostPlayer.avatar,
          isHost: hostPlayer.is_host,
          isReady: hostPlayer.is_ready,
          score: hostPlayer.score || 0,
          streak: hostPlayer.streak || 0,
          correctAnswers: hostPlayer.correct_answers || 0,
          currentQuestionIndex: hostPlayer.current_question_index || 0,
          finishedAt: hostPlayer.finished_at || null,
        });

        if (guestPlayer) {
          setPlayer2({
            id: guestPlayer.player_id,
            name: guestPlayer.name,
            avatar: guestPlayer.avatar,
            isHost: guestPlayer.is_host,
            isReady: guestPlayer.is_ready,
            score: guestPlayer.score || 0,
            streak: guestPlayer.streak || 0,
            correctAnswers: guestPlayer.correct_answers || 0,
            currentQuestionIndex: guestPlayer.current_question_index || 0,
            finishedAt: guestPlayer.finished_at || null,
          });
        } else {
          setPlayer2(null);
        }

        const storedPlayerId = sessionStorage.getItem('teknofest_my_player_id');
        const mine = playersList.find(
          (p) => p.auth_user_id === myPlayerId || p.player_id === myPlayerId || p.player_id === storedPlayerId
        );
        if (shouldRestoreProgressRef.current && mine && typeof mine.current_question_index === 'number') {
          setCurrentQuestionIndex(mine.current_question_index);
          shouldRestoreProgressRef.current = false;
        }
      }
    } catch (err) {
      console.error('[syncRoomFromSupabase Exception]', err);
    }
  }, [myPlayerId]);

  /**
   * Subscribes to Supabase Realtime channel for room changes
   */
  const subscribeToRoom = (code: string) => {
    if (!isSupabaseConfigured) return;

    const cleanCode = code.trim().toUpperCase();

    if (activeChannelRef.current) {
      supabase.removeChannel(activeChannelRef.current);
    }

    const channel = supabase
      .channel(`room_${cleanCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_players', filter: `room_code=eq.${cleanCode}` },
        async () => {
          await syncRoomFromSupabase(cleanCode);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${cleanCode}` },
        async (payload: any) => {
          if (payload.new) {
            if (payload.new.started_at) {
              setMatchStartTime(new Date(payload.new.started_at).getTime());
            }
            const newStatus = payload.new.status;
            if (newStatus === 'VS') {
              setIsStarting(true);
              setCurrentScreen('VS');
            } else if (newStatus === 'QUIZ') {
              setCurrentScreen('QUIZ');
            } else if (newStatus === 'RESULT') {
              await syncRoomFromSupabase(cleanCode);
              setCurrentScreen('RESULT');
            } else if (newStatus === 'LOBBY') {
              await syncRoomFromSupabase(cleanCode);
              setIsStarting(false);
              setMatchStartTime(null);
              setCurrentQuestionIndex(0);
              setCurrentScreen('LOBBY');
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Supabase Realtime] Subscribed to room: ${cleanCode}`);
        }
      });

    activeChannelRef.current = channel;
  };

  /**
   * CREATE ROOM
   */
  const createRoom = async (name: string, avatarId: string) => {
    try {
      setErrorMsg(null);

      if (!isSupabaseConfigured) {
        setErrorMsg('Supabase veritabanı bağlantısı yapılandırılmamış! Lütfen VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY ortam değişkenlerini tanımlayın.');
        return;
      }

      // Ensure active auth session before calling RPC
      const authUserId = await ensureAnonymousSession();
      if (!authUserId) {
        setErrorMsg('Supabase oturumu açılamadı! İnternet bağlantınızı kontrol edin.');
        return;
      }

      const avatar = AVATAR_OPTIONS.find((a) => a.id === avatarId)?.icon || '🚀';
      const numericCode = Math.floor(100000 + Math.random() * 900000).toString();

      sessionStorage.setItem('teknofest_my_player_id', authUserId);
      sessionStorage.setItem('teknofest_room_code', numericCode);

      // Call secure RPC to create room and host player atomically
      const { data: createRes, error: createErr } = await supabase.rpc('create_room_rpc', {
        p_code: numericCode,
        p_name: name.trim() || 'EvSahibi_Oyuncu',
        p_avatar: avatar,
        p_match_questions: null,
        p_player_id: authUserId,
      });

      if (createErr) {
        console.error('[Supabase create_room_rpc Error]', createErr);
        setErrorMsg(`Oda oluşturma sunucu hatası (${createErr.code || 'ERR'}): ${createErr.message}`);
        return;
      }

      if (createRes && createRes.success === false) {
        setErrorMsg(createRes.error || 'Oda oluşturulamadı.');
        return;
      }

      const activeId = createRes?.player_id || authUserId;

      subscribeToRoom(numericCode);
      setMyPlayerId(activeId);
      setRoomCode(numericCode);
      await syncRoomFromSupabase(numericCode);

      setPlayer1({
        id: activeId,
        name: name.trim() || 'EvSahibi_Oyuncu',
        avatar,
        isHost: true,
        isReady: false,
        score: 0,
        streak: 0,
        correctAnswers: 0,
      });
      setPlayer2(null);
      setIsStarting(false);
      setMatchStartTime(null);
      setCurrentQuestionIndex(0);
      setCurrentScreen('LOBBY');
    } catch (err: any) {
      console.error('[createRoom Exception]', err);
      setErrorMsg(err.message || 'Oda oluşturulurken bir hata oluştu.');
    }
  };

  /**
   * JOIN ROOM
   */
  const joinRoom = async (code: string, name: string, avatarId: string) => {
    try {
      setErrorMsg(null);
      const cleanCode = code.trim();

      if (!isSupabaseConfigured) {
        setErrorMsg('Supabase veritabanı bağlantısı yapılandırılmamış! Lütfen VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY ortam değişkenlerini tanımlayın.');
        return;
      }

      if (!/^\d{6}$/.test(cleanCode)) {
        setErrorMsg('Geçersiz oda kodu! Lütfen 6 haneli sayısal oda kodunu girin (Örn: 849204).');
        return;
      }

      // Ensure active auth session before calling RPC
      const authUserId = await ensureAnonymousSession();
      if (!authUserId) {
        setErrorMsg('Supabase oturumu açılamadı! İnternet bağlantınızı kontrol edin.');
        return;
      }

      const avatar = AVATAR_OPTIONS.find((a) => a.id === avatarId)?.icon || '⚡';

      // Call Atomic Join RPC function
      const { data: joinRes, error: joinErr } = await supabase.rpc('join_room_atomic', {
        p_room_code: cleanCode,
        p_player_id: authUserId,
        p_name: name.trim() || 'Katılımcı',
        p_avatar: avatar,
      });

      if (joinErr) {
        console.error('[Supabase join_room_atomic RPC Error]', joinErr);
        setErrorMsg(`Odaya katılım sunucu hatası (${joinErr.code || 'ERR'}): ${joinErr.message}`);
        return;
      }

      if (joinRes && joinRes.success === false) {
        setErrorMsg(joinRes.error || `"${cleanCode}" kodlu odaya katılım başarısız.`);
        return;
      }

      const activeId = joinRes?.player_id || authUserId;

      sessionStorage.setItem('teknofest_my_player_id', activeId);
      sessionStorage.setItem('teknofest_room_code', cleanCode);

      setMyPlayerId(activeId);
      setRoomCode(cleanCode);
      subscribeToRoom(cleanCode);
      await syncRoomFromSupabase(cleanCode);

      setIsStarting(false);
      setMatchStartTime(null);
      setCurrentQuestionIndex(0);
      setCurrentScreen('LOBBY');
    } catch (err: any) {
      console.error('[joinRoom Exception]', err);
      setErrorMsg(err.message || 'Odaya katılırken beklenmeyen bir hata oluştu.');
    }
  };

  /**
   * TOGGLE READY
   */
  const toggleReady = async () => {
    try {
      if (!roomCode || !isSupabaseConfigured) return;

      const authUserId = await ensureAnonymousSession();
      const myId = authUserId || myPlayerId;

      const isHostMe = myId === player1.id;
      const currentReady = isHostMe ? player1.isReady : player2?.isReady || false;
      const newReadyState = !currentReady;

      // Optimistic local update
      if (isHostMe) {
        setPlayer1((prev) => ({ ...prev, isReady: newReadyState }));
      } else if (player2) {
        setPlayer2((prev) => (prev ? { ...prev, isReady: newReadyState } : null));
      }

      // RPC Call to update ready status and start match if both ready
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('set_player_ready_and_check_start', {
        p_room_code: roomCode,
        p_player_id: myId,
        p_ready_state: newReadyState,
      });

      if (rpcErr) {
        console.error('[Supabase RPC toggleReady Error]', rpcErr);
      } else if (rpcRes && rpcRes.match_started) {
        setIsStarting(true);
        setCurrentScreen('VS');
      }

      await syncRoomFromSupabase(roomCode);
    } catch (err) {
      console.error('[toggleReady Exception]', err);
    }
  };

  const startMatchSequence = () => {
    if (!player1.isReady || !player2 || !player2.isReady) {
      return;
    }
    if (isStarting) return;
    setIsStarting(true);
    setMatchStartTime(Date.now() + 3000);
    setCurrentScreen('VS');
  };

  /**
   * ANSWER QUESTION VIA SECURE SERVER RPC
   */
  const answerQuestion = async (
    optionIndex: number
  ): Promise<{ success: boolean; isCorrect?: boolean; correctIndex?: number; pointsAdded?: number; matchFinished?: boolean; error?: string }> => {
    const currentQ = questions[currentQuestionIndex];
    if (!currentQ) return { success: false, error: 'Soru bulunamadı' };

    const myId = myPlayerId;
    const isHostMe = myId === player1.id;
    let isCorrectResult = false;
    let pointsAddedResult = 0;
    let matchFinishedResult = false;
    let correctIndexResult: number | undefined = typeof currentQ.correctIndex === 'number' ? currentQ.correctIndex : undefined;

    if (isSupabaseConfigured && roomCode) {
      const authUserId = await ensureAnonymousSession();
      const activeId = authUserId || myId;

      // Call server-side answer verification RPC with 4 parameters
      const { data: answerRes, error: answerErr } = await supabase.rpc('submit_answer_rpc', {
        p_room_code: roomCode,
        p_player_id: activeId,
        p_question_id: currentQ.id,
        p_selected_option_index: optionIndex,
      });

      if (!answerErr && answerRes && answerRes.success) {
        isCorrectResult = Boolean(answerRes.is_correct);
        pointsAddedResult = answerRes.points_added || 0;
        matchFinishedResult = Boolean(answerRes.match_finished);
        if (typeof answerRes.correct_index === 'number') {
          correctIndexResult = answerRes.correct_index;
        }
        // Realtime may refresh scores, but local question navigation remains owned by this client.
      } else if (answerErr || (answerRes && !answerRes.success)) {
        const errMsg = answerErr?.message || answerRes?.error || 'Cevap iletilemedi';
        console.error('[submit_answer_rpc Error]', errMsg);
        return { success: false, error: errMsg };
      }
    } else {
      // Local evaluation fallback
      const isCorrect = typeof currentQ.correctIndex === 'number' ? optionIndex === currentQ.correctIndex : false;
      isCorrectResult = isCorrect;
      if (isHostMe) {
        setPlayer1((prev) => {
          const pointsAdded = isCorrect ? 100 : 0;
          pointsAddedResult = pointsAdded;
          return {
            ...prev,
            score: prev.score + pointsAdded,
            correctAnswers: isCorrect ? prev.correctAnswers + 1 : prev.correctAnswers,
          };
        });
      } else {
        setPlayer2((prev) => {
          if (!prev) return null;
          const pointsAdded = isCorrect ? 100 : 0;
          pointsAddedResult = pointsAdded;
          return {
            ...prev,
            score: prev.score + pointsAdded,
            correctAnswers: isCorrect ? prev.correctAnswers + 1 : prev.correctAnswers,
          };
        });
      }
    }

    return {
      success: true,
      isCorrect: isCorrectResult,
      correctIndex: correctIndexResult,
      pointsAdded: pointsAddedResult,
      matchFinished: matchFinishedResult,
    };
  };

  const advanceQuestionIndex = () => {
    setCurrentQuestionIndex((prev) => {
      if (prev + 1 < questions.length) {
        return prev + 1;
      }
      return prev;
    });
  };

  const finishQuiz = useCallback(async () => {
    if (finishInFlightRef.current) return;
    finishInFlightRef.current = true;
    setIsGameActive(false);
    setIsStarting(false);
    
    const p1Score = player1.score;
    const p2Score = player2 ? player2.score : 0;

    if (p1Score > p2Score) {
      setWinner(player1);
      setIsDraw(false);
    } else if (p2Score > p1Score && player2) {
      setWinner(player2);
      setIsDraw(false);
    } else {
      setWinner(null);
      setIsDraw(true);
    }

    if (isSupabaseConfigured && roomCode) {
      const { data, error } = await supabase.rpc('finish_room_rpc', { p_room_code: roomCode });
      if (error || !data?.success) {
        finishInFlightRef.current = false;
        setErrorMsg(error?.message || data?.error || 'Maç henüz tamamlanmadı.');
        return;
      }
      await syncRoomFromSupabase(roomCode);
    }
    setCurrentScreen('RESULT');
  }, [player1, player2, roomCode, syncRoomFromSupabase]);

  const restartGame = async () => {
    setPlayer1((prev) => ({
      ...prev,
      score: 0,
      streak: 0,
      correctAnswers: 0,
      isReady: false,
    }));
    if (player2) {
      setPlayer2((prev) => (prev ? {
        ...prev,
        score: 0,
        streak: 0,
        correctAnswers: 0,
        isReady: false,
      } : null));
    }

    if (isSupabaseConfigured && roomCode) {
      shouldRestoreProgressRef.current = true;
      const { data, error } = await supabase.rpc('restart_room_rpc', { p_room_code: roomCode });
      if (error || !data?.success) {
        setErrorMsg(error?.message || data?.error || 'Yeni maç başlatılamadı.');
        return;
      }
      await syncRoomFromSupabase(roomCode);
    }

    setIsStarting(false);
    finishInFlightRef.current = false;
    setMatchStartTime(null);
    setCurrentQuestionIndex(0);
    setCurrentScreen('LOBBY');
  };

  // Re-sync on page refresh if session storage exists
  useEffect(() => {
    const savedRoom = sessionStorage.getItem('teknofest_room_code');
    const savedMyId = sessionStorage.getItem('teknofest_my_player_id');

    if (savedRoom && savedMyId && isSupabaseConfigured) {
      setRoomCode(savedRoom);
      setMyPlayerId(savedMyId);
      supabase
        .from('rooms')
        .select('*')
        .eq('code', savedRoom)
        .maybeSingle()
        .then(({ data }) => {
          if (data && ['LOBBY', 'VS', 'QUIZ', 'RESULT'].includes(data.status)) {
            if (data.started_at) {
              setMatchStartTime(new Date(data.started_at).getTime());
            }
            syncRoomFromSupabase(savedRoom);
            subscribeToRoom(savedRoom);
          } else {
            sessionStorage.removeItem('teknofest_room_code');
            setRoomCode('');
          }
        });
    }
  }, []);

  useEffect(() => () => {
    if (activeChannelRef.current) supabase.removeChannel(activeChannelRef.current);
  }, []);

  const isMePlayer2 = Boolean(player2 && myPlayerId === player2.id);
  const myPlayer = isMePlayer2 ? (player2 as Player) : player1;
  const opponentPlayer = isMePlayer2 ? player1 : player2;

  useEffect(() => {
    if (currentScreen !== 'RESULT') return;
    if (player1.score > (player2?.score || 0)) {
      setWinner(player1); setIsDraw(false);
    } else if (player2 && player2.score > player1.score) {
      setWinner(player2); setIsDraw(false);
    } else {
      setWinner(null); setIsDraw(true);
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
        timeRemaining,
        isGameActive,
        isStarting,
        matchStartTime,
        winner,
        isDraw,
        errorMsg,
        setScreen,
        createRoom,
        joinRoom,
        toggleReady,
        startMatchSequence,
        answerQuestion,
        advanceQuestionIndex,
        finishQuiz,
        restartGame,
        updatePlayerName,
        updatePlayerAvatar,
        clearError,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
