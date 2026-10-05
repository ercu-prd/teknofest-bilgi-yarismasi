import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../../context/GameContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { AvatarSelector } from '../ui/AvatarSelector';
import { Users, PlusCircle, ArrowRight, Gamepad2, AlertCircle, Zap, Trophy, BarChart3, Loader2 } from 'lucide-react';
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
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center space-y-5 w-full max-w-md mx-auto py-2 px-1"
    >
      {/* Title & Badge Banner */}
      <div className="text-center space-y-3">
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-bold font-subheading box-glow-cyan"
        >
          <Gamepad2 className="w-4 h-4 text-cyan-400" />
          <span>TEKNOFEST ÜNİVERSİTE KULÜBÜ</span>
        </motion.div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase font-heading text-glow-cyan leading-none">
          TEKNOFEST <br />
          <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-purple-400 bg-clip-text text-transparent">
            BİLGİ YARIŞMASI
          </span>
        </h1>
        <p className="text-xs text-slate-400 font-medium">
          Milli Teknoloji Hamlesi 1v1 Gerçek Zamanlı Arena
        </p>
      </div>

      {/* Global Error Banner */}
      {activeError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full p-3 rounded-xl bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs font-bold flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{activeError}</span>
          </div>
          <button
            onClick={() => {
              setLocalErrorMsg('');
              clearError();
            }}
            className="text-rose-400 hover:text-white ml-2 text-sm"
          >
            ✕
          </button>
        </motion.div>
      )}

      {/* Main Profile Form Card */}
      <Card variant="cyan" glow className="w-full space-y-5">
        {/* Name Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-cyan-400 font-subheading flex items-center justify-between">
            <span>Oyuncu Adı</span>
            <span className="text-[10px] text-slate-500 lowercase">zorunlu</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={nameInput}
              onChange={handleNameChange}
              maxLength={APP_CONFIG.playerNameMaxLength}
              placeholder="Örn: TeknoPilot_34"
              className="w-full bg-slate-950/80 border border-slate-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-4 py-3 text-sm font-semibold text-white placeholder-slate-600 outline-none transition-all font-sans"
            />
            <span className="absolute right-3 top-3 text-lg select-none">
              {AVATAR_OPTIONS.find((a) => a.id === selectedAvatarId)?.icon || '🚀'}
            </span>
          </div>
        </div>

        {/* Avatar Selector */}
        <AvatarSelector selectedId={selectedAvatarId} onSelect={handleAvatarSelect} />

        {/* Primary Action Buttons */}
        <div className="space-y-3 pt-2">
          <Button
            variant="cyan"
            size="lg"
            fullWidth
            onClick={() => void handleQuickMatch()}
            disabled={isBusy}
            className="group"
          >
            <Zap className="w-5 h-5" />
            <span>HIZLI EŞLEŞ</span>
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="md" fullWidth onClick={handleCreateRoom} disabled={isBusy} className="group">
              {isBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PlusCircle className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
              )}
              <span>ODA KUR</span>
            </Button>
            <Button variant="outline" size="md" fullWidth onClick={() => setIsJoinModalOpen(true)} disabled={isBusy}>
              <Users className="w-4 h-4" />
              <span>ODAYA KATIL</span>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="purple"
              size="md"
              fullWidth
              onClick={() => {
                if (!requireName()) return;
                clearError();
                setScreen('TOURNAMENT');
              }}
            >
              <Trophy className="w-4 h-4" />
              <span>TURNUVA</span>
            </Button>
            <Button variant="ghost" size="md" fullWidth onClick={() => setScreen('LEADERBOARD')}>
              <BarChart3 className="w-4 h-4" />
              <span>LİDERLİK</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Info Card / Quick Specs */}
      <div className="grid grid-cols-3 gap-2 w-full text-center">
        <div className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm">
          <div className="text-cyan-400 text-xs font-bold font-subheading">MODE</div>
          <div className="text-slate-200 text-xs font-bold">1v1 Düello</div>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm">
          <div className="text-purple-400 text-xs font-bold font-subheading">SÜRE</div>
          <div className="text-slate-200 text-xs font-bold">{settings.matchSeconds} Saniye</div>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm">
          <div className="text-teal-400 text-xs font-bold font-subheading">SORU</div>
          <div className="text-slate-200 text-xs font-bold">{settings.questionCount} Soru</div>
        </div>
      </div>

      {/* Join Room Modal Drawer */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-sm cyber-card rounded-2xl p-6 border-cyan-500/50 space-y-4 box-glow-cyan"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold font-heading text-cyan-300 flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                ODAYA KATIL
              </h2>
              <button
                onClick={() => setIsJoinModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg px-2"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Arkadaşınızın oluşturduğu 6 haneli oda kodunu girin:
            </p>

            <div className="space-y-2">
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="off"
                aria-label="Oda kodu"
                placeholder="Örn: 849204"
                maxLength={6}
                className="w-full text-center tracking-widest text-xl font-bold font-heading uppercase bg-slate-950 border border-cyan-500/50 focus:border-cyan-400 rounded-xl py-3 text-cyan-300 outline-none placeholder-slate-600"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                fullWidth
                onClick={() => setIsJoinModalOpen(false)}
              >
                İPTAL
              </Button>
              <Button
                variant="cyan"
                fullWidth
                onClick={handleJoinRoomSubmit}
                disabled={isBusy}
              >
                <span>KATIL</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};
