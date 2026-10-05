import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { AlertCircle, ArrowLeft, Loader2, Swords, Trophy, WifiOff, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { LogoSpinnerBlock } from '../ui/LogoSpinner';
import { TournamentEntry } from '../tournament/TournamentEntry';
import { TournamentRegistration } from '../tournament/TournamentRegistration';
import { BracketView } from '../tournament/BracketView';
import { useTournamentPolling } from '../tournament/useTournamentPolling';
import { callTournamentRpc } from '../tournament/rpc';
import type { TournamentInfo } from '../tournament/types';

const ErrorBanner: React.FC<{ message: string; onClose?: () => void }> = ({ message, onClose }) => (
  <div
    role="alert"
    className="w-full pl-3 pr-1 py-1 min-h-11 rounded-xl bg-danger-soft border border-danger/20 text-danger text-sm flex items-center justify-between gap-2"
  >
    <span className="flex items-center gap-2 py-2">
      <AlertCircle className="w-4 h-4 shrink-0" />
      {message}
    </span>
    {onClose && (
      <button
        type="button"
        onClick={onClose}
        aria-label="Kapat"
        className="w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-danger/10 cursor-pointer"
      >
        <X className="w-4 h-4" />
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
        colors: ['#1f56a8', '#d3262d', '#ffffff'],
      });
    } catch {
      // Canvas kullanılamıyorsa konfeti atlanır.
    }
  }, []);

  return (
    <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.2 }} className="w-full">
      <Card variant="brand" className="w-full text-center">
        <div data-testid="champion-card" className="space-y-1.5">
          <Trophy className="w-8 h-8 mx-auto text-warning" aria-hidden="true" />
          <span className="block text-sm font-medium text-ink-soft">Şampiyon</span>
          <div className="text-5xl" aria-hidden="true">{champion.avatar}</div>
          <div className="text-xl font-semibold text-ink break-words">{champion.name}</div>
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
          <ArrowLeft className="w-4 h-4" /> Ana menü
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full">
        <LogoSpinnerBlock label="Turnuva yükleniyor" hint="Turnuva yükleniyor…" />
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
        <div className="w-full p-3 rounded-xl bg-warning-soft text-warning text-sm flex items-center gap-2">
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
            <Badge variant={tournament.status === 'FINISHED' ? 'success' : 'brand'} size="sm">
              {tournament.status === 'FINISHED' ? 'Tamamlandı' : 'Devam ediyor'}
            </Badge>
            <h1 className="text-xl font-semibold text-ink break-words">{tournament.name}</h1>
            <p className="text-xs text-muted">
              Kod <span className="tabular">{tournament.code}</span>
            </p>
          </div>

          {tournament.status === 'FINISHED' && tournament.champion && <ChampionCard champion={tournament.champion} />}

          {my_room_code && tournament.status === 'RUNNING' && (
            <Button variant="primary" size="lg" fullWidth onClick={() => void handleEnterMatch()} disabled={busy === 'enter'}>
              {busy === 'enter' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
              Maçına gir
            </Button>
          )}

          {me?.eliminated && tournament.status === 'RUNNING' && (
            <Card variant="muted" padding="sm" className="text-sm text-ink-soft text-center">
              Elendin — turnuvayı izlemeye devam edebilirsin
            </Card>
          )}

          <Card className="space-y-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Trophy className="w-4 h-4 text-ink-soft" /> Eleme ağacı
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="w-full space-y-4"
    >
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => openTournament(null)} className="-ml-2 h-11">
          <ArrowLeft className="w-4 h-4" /> Geri
        </Button>
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink-soft">
          <Trophy className="w-4 h-4 text-brand" /> Turnuva
        </span>
      </div>
      <TournamentView key={activeTournamentCode} code={activeTournamentCode} />
    </motion.div>
  );
};

export default TournamentScreen;
