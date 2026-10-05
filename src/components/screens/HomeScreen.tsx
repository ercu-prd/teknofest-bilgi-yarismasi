import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../../context/GameContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Logo } from '../ui/Logo';
import { AvatarSelector } from '../ui/AvatarSelector';
import { Users, Plus, ArrowRight, AlertCircle, Zap, Trophy, BarChart3, Loader2, X } from 'lucide-react';
import { AVATAR_OPTIONS } from '../../data/avatars';
import { APP_CONFIG } from '../../config/appConfig';
import {
  clearRoomCodeFromUrl,
  clearTournamentCodeFromUrl,
  readRoomCodeFromUrl,
  readTournamentCodeFromUrl,
} from '../../lib/roomLink';

export const HomeScreen: React.FC = () => {
  const {
    player1,
    updatePlayerName,
    updatePlayerAvatar,
    createRoom,
    joinRoom,
    startQuickMatch,
    openTournament,
    setScreen,
    settings,
    isBusy,
    errorMsg: globalErrorMsg,
    clearError,
  } = useGame();
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(
    AVATAR_OPTIONS.find((a) => a.icon === player1.avatar)?.id || 'pilot'
  );
  const [nameInput, setNameInput] = useState<string>(player1.name);
  // A QR / invite link (?room=123456) opens the join dialog pre-filled.
  const [linkedRoomCode] = useState<string | null>(() => readRoomCodeFromUrl());
  const [isJoinModalOpen, setIsJoinModalOpen] = useState<boolean>(Boolean(linkedRoomCode));
  const [joinCodeInput, setJoinCodeInput] = useState<string>(linkedRoomCode ?? '');
  const [localErrorMsg, setLocalErrorMsg] = useState<string>('');

  // A tournament invite link (?tournament=123456) jumps straight to that tournament.
  useEffect(() => {
    const tournamentCode = readTournamentCodeFromUrl();
    if (tournamentCode) {
      clearTournamentCodeFromUrl();
      openTournament(tournamentCode);
    }
    // Only on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requireName = (message = 'Lütfen takma adınızı girin!'): boolean => {
    if (nameInput.trim()) return true;
    setLocalErrorMsg(message);
    return false;
  };

  const handleQuickMatch = async () => {
    if (!requireName()) return;
    setLocalErrorMsg('');
    clearError();
    await startQuickMatch(nameInput, selectedAvatarId);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNameInput(val);
    updatePlayerName(val);
  };

  const handleAvatarSelect = (id: string) => {
    setSelectedAvatarId(id);
    updatePlayerAvatar(id);
  };

  const handleCreateRoom = async () => {
    if (!nameInput.trim()) {
      setLocalErrorMsg('Lütfen takma adınızı girin!');
      return;
    }
    setLocalErrorMsg('');
    clearError();
    await createRoom(nameInput, selectedAvatarId);
  };

  const handleJoinRoomSubmit = async () => {
    if (!nameInput.trim()) {
      setLocalErrorMsg('Lütfen önce bir takma ad girin!');
      setIsJoinModalOpen(false);
      return;
    }
    if (!joinCodeInput.trim() || !/^\d{6}$/.test(joinCodeInput.trim())) {
      setLocalErrorMsg('Geçerli bir oda kodu girin! (Örn: 849204)');
      return;
    }
    setLocalErrorMsg('');
    clearError();
    await joinRoom(joinCodeInput, nameInput, selectedAvatarId);
    clearRoomCodeFromUrl();
  };

  const activeError = globalErrorMsg || localErrorMsg;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex w-full flex-col gap-4"
    >
      {/* Kimlik */}
      <div className="flex flex-col items-center gap-2 pt-1 text-center">
        <Logo size={72} />
        <div className="space-y-1">
          <p className="font-display text-sm font-bold text-brand">OKÜ TEKNOFEST</p>
          <h1 className="text-2xl font-bold leading-tight">Bilgi Yarışması</h1>
          <p className="text-sm text-ink-soft">Arkadaşınla gerçek zamanlı, birebir bilgi düellosu</p>
        </div>
        <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-xs text-muted tabular">
          <span>1v1</span>
          <span aria-hidden="true">·</span>
          <span>{settings.questionCount} soru</span>
          <span aria-hidden="true">·</span>
          <span>{settings.matchSeconds} saniye</span>
        </p>
      </div>

      {/* Hata */}
      {activeError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger-soft py-1 pl-3 pr-1 text-sm text-danger"
        >
          <AlertCircle className="mt-2.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 py-2">{activeError}</span>
          <button
            type="button"
            aria-label="Hatayı kapat"
            onClick={() => {
              setLocalErrorMsg('');
              clearError();
            }}
            className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-danger/10"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Profil */}
      <Card className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="player-name" className="block text-sm font-medium text-ink-soft">
            Takma ad
          </label>
          <input
            id="player-name"
            type="text"
            value={nameInput}
            onChange={handleNameChange}
            maxLength={APP_CONFIG.playerNameMaxLength}
            placeholder="Örn: TeknoPilot_34"
            autoComplete="nickname"
            className="h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-base text-ink placeholder:text-muted outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </div>

        <AvatarSelector selectedId={selectedAvatarId} onSelect={handleAvatarSelect} />
      </Card>

      {/* Eylemler */}
      <div className="space-y-2">
        <Button variant="primary" size="lg" fullWidth onClick={() => void handleQuickMatch()} disabled={isBusy}>
          <Zap className="h-5 w-5" aria-hidden="true" />
          <span>Hızlı eşleş</span>
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" fullWidth onClick={handleCreateRoom} disabled={isBusy}>
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="h-4 w-4" aria-hidden="true" />
            )}
            <span>Oda kur</span>
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setIsJoinModalOpen(true)} disabled={isBusy}>
            <Users className="h-4 w-4" aria-hidden="true" />
            <span>Odaya katıl</span>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              if (!requireName()) return;
              clearError();
              setScreen('TOURNAMENT');
            }}
          >
            <Trophy className="h-4 w-4" aria-hidden="true" />
            <span>Turnuva</span>
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setScreen('LEADERBOARD')}>
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            <span>Liderlik</span>
          </Button>
        </div>
      </div>

      {/* Odaya katıl: mobilde alttan açılan pencere */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4">
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="join-room-title"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="safe-bottom w-full max-w-md space-y-4 rounded-t-2xl border border-line bg-surface px-4 pt-4 shadow-raised sm:rounded-2xl sm:pb-4"
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
            <div className="flex items-center justify-between gap-2">
              <h2 id="join-room-title" className="text-base font-semibold">
                Odaya katıl
              </h2>
              <button
                type="button"
                aria-label="Kapat"
                onClick={() => setIsJoinModalOpen(false)}
                className="-mr-2 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-ink"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <p className="text-sm text-ink-soft">Arkadaşının paylaştığı 6 haneli oda kodunu gir.</p>

            <input
              type="text"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="off"
              aria-label="Oda kodu"
              placeholder="000000"
              maxLength={6}
              className="h-16 w-full rounded-xl border border-line-strong bg-surface text-center font-display text-4xl font-bold tracking-[0.2em] text-ink tabular placeholder:text-line-strong outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
            />

            <div className="grid grid-cols-2 gap-2 pb-1">
              <Button variant="secondary" size="lg" fullWidth onClick={() => setIsJoinModalOpen(false)}>
                Vazgeç
              </Button>
              <Button variant="primary" size="lg" fullWidth onClick={handleJoinRoomSubmit} disabled={isBusy}>
                <span>Katıl</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};
