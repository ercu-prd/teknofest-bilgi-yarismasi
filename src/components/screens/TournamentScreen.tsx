import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { AlertCircle, ArrowLeft, Crown, Loader2, Swords, Trophy, WifiOff } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { TournamentEntry } from '../tournament/TournamentEntry';
import { TournamentRegistration } from '../tournament/TournamentRegistration';
import { BracketView } from '../tournament/BracketView';
import { useTournamentPolling } from '../tournament/useTournamentPolling';
import { callTournamentRpc } from '../tournament/rpc';
import type { TournamentInfo } from '../tournament/types';

const ErrorBanner: React.FC<{ message: string; onClose?: () => void }> = ({ message, onClose }) => (
  <div
    role="alert"
    className="w-full p-3 rounded-xl bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs font-bold flex items-center justify-between gap-2"
  >
    <span className="flex items-center gap-2">
      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
      {message}
    </span>
    {onClose && (
      <button type="button" onClick={onClose} aria-label="Kapat" className="text-rose-400 hover:text-white text-sm">
        ✕
      </button>
    )}
  </div>
);

const ChampionCard: React.FC<{ champion: NonNullable<TournamentInfo['champion']> }> = ({ champion }) => {
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    try {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.4 },
        colors: ['#00f0ff', '#a855f7', '#eab308', '#ffffff'],
      });
    } catch {
      // Canvas kullanılamıyorsa konfeti atlanır.
    }
  }, []);

  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full">
      <Card variant="purple" glow className="w-full text-center space-y-2">
        <div data-testid="champion-card" className="space-y-2">
          <Crown className="w-10 h-10 mx-auto text-amber-300 drop-shadow-[0_0_12px_rgba(252,211,77,0.6)]" />
          <span className="block text-[11px] font-bold uppercase tracking-widest text-amber-300 font-subheading">
            Şampiyon
          </span>
          <div className="text-5xl">{champion.avatar}</div>
          <div className="text-xl font-black text-white font-heading break-words">{champion.name}</div>
        </div>
      </Card>
    </motion.div>
  );
};

const TournamentView: React.FC<{ code: string }> = ({ code }) => {
  const { openTournament, enterRoom, player1, errorMsg, clearError } = useGame();
  const { data, error, fatalError, refresh } = useTournamentPolling(code);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState<'join' | 'leave' | 'start' | 'enter' | null>(null);

  const goHome = () => openTournament(null);

  if (fatalError) {
    return (
      <div className="w-full space-y-4 text-center">
        <ErrorBanner message={fatalError} />
        <Button variant="ghost" fullWidth onClick={goHome}>
          <ArrowLeft className="w-4 h-4" /> Ana Menü
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full py-16 flex flex-col items-center gap-3 text-slate-400 text-sm">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        Turnuva yükleniyor…
        {error && <ErrorBanner message={error} />}
      </div>
    );
  }

  const runAction = async (kind: 'join' | 'leave' | 'start', fn: string, params: Record<string, unknown>, fallback: string) => {
    setActionError('');
    setBusy(kind);
    const res = await callTournamentRpc(fn, params, fallback);
    setBusy(null);
    if (!res.ok) {
      setActionError(res.error);
      return false;
    }
    return true;
  };

  const handleJoin = async () => {
    const name = player1.name.trim();
    if (!name) {
      setActionError('Önce ana menüden bir takma ad ve avatar seç.');
      return;
    }
    if (await runAction('join', 'join_tournament_rpc', { p_code: code, p_name: name, p_avatar: player1.avatar }, 'Turnuvaya katılınamadı.')) {
      void refresh();
    }
  };

  const handleLeave = async () => {
    if (await runAction('leave', 'leave_tournament_rpc', { p_code: code }, 'Turnuvadan ayrılınamadı.')) {
      openTournament(null);
    }
  };

  const handleStart = async () => {
    if (await runAction('start', 'start_tournament_rpc', { p_code: code }, 'Turnuva başlatılamadı.')) {
      void refresh();
    }
  };

  const handleEnterMatch = async () => {
    if (!data.my_room_code) return;
    clearError();
    setBusy('enter');
    await enterRoom(data.my_room_code);
    setBusy(null);
  };

  const { tournament, players, matches, my_room_code } = data;
  const me = players.find((p) => p.is_me);
  const shownError = actionError || errorMsg;

  return (
    <div className="w-full space-y-4">
      {shownError && (
        <ErrorBanner
          message={shownError}
          onClose={() => {
            setActionError('');
            clearError();
          }}
        />
      )}
      {error && (
        <div className="w-full p-2.5 rounded-xl bg-amber-950/70 border border-amber-500/40 text-amber-200 text-[11px] font-bold flex items-center gap-2">
          <WifiOff className="w-4 h-4 shrink-0" /> Bağlantı sorunu, yeniden deneniyor…
        </div>
      )}

      {tournament.status === 'REGISTRATION' ? (
        <TournamentRegistration
          data={data}
          busy={busy === 'enter' ? null : busy}
          onJoin={() => void handleJoin()}
          onLeave={() => void handleLeave()}
          onStart={() => void handleStart()}
        />
      ) : (
        <>
          <div className="text-center space-y-1.5">
            <Badge variant={tournament.status === 'FINISHED' ? 'amber' : 'emerald'} size="sm">
              {tournament.status === 'FINISHED' ? 'Tamamlandı' : 'Devam Ediyor'}
            </Badge>
            <h1 className="text-xl font-black text-white font-heading break-words">{tournament.name}</h1>
            <p className="text-[11px] text-slate-500 font-subheading tracking-widest">KOD {tournament.code}</p>
          </div>

          {tournament.status === 'FINISHED' && tournament.champion && <ChampionCard champion={tournament.champion} />}

          {my_room_code && tournament.status === 'RUNNING' && (
            <motion.div animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
              <Button variant="cyan" size="lg" fullWidth onClick={() => void handleEnterMatch()} disabled={busy === 'enter'}>
                {busy === 'enter' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Swords className="w-5 h-5" />}
                Maçına Gir
              </Button>
            </motion.div>
          )}

          {me?.eliminated && tournament.status === 'RUNNING' && (
            <div className="w-full p-3 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-300 text-xs font-bold text-center">
              Elendin — turnuvayı izlemeye devam edebilirsin
            </div>
          )}

          <Card className="w-full space-y-3 p-4!">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white font-subheading">
              <Trophy className="w-4 h-4 text-purple-300" /> Eleme Ağacı
            </h2>
            <BracketView size={tournament.size} rounds={tournament.rounds} matches={matches} />
          </Card>
        </>
      )}
    </div>
  );
};

export const TournamentScreen: React.FC = () => {
  const { activeTournamentCode, openTournament } = useGame();

  if (!activeTournamentCode) return <TournamentEntry />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center space-y-4 w-full max-w-md mx-auto py-2 px-1"
    >
      <div className="flex items-center justify-between w-full">
        <button
          type="button"
          onClick={() => openTournament(null)}
          className="flex items-center gap-1.5 text-xs font-bold font-subheading text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Geri
        </button>
        <span className="flex items-center gap-1.5 text-xs font-bold font-subheading text-purple-300 uppercase">
          <Trophy className="w-4 h-4" /> Turnuva
        </span>
      </div>
      <TournamentView key={activeTournamentCode} code={activeTournamentCode} />
    </motion.div>
  );
};

export default TournamentScreen;
