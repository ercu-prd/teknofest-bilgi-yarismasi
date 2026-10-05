import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, Loader2, LogIn, PlusCircle, Trophy } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { callTournamentRpc } from './rpc';
import {
  TOURNAMENT_CODE_RE,
  TOURNAMENT_NAME_MAX,
  TOURNAMENT_NAME_MIN,
  TOURNAMENT_SIZES,
} from './types';

const NO_NAME_MSG = 'Önce ana menüden bir takma ad ve avatar seç.';

/** Turnuva oluşturma / kodla katılma görünümü (aktif turnuva yokken). */
export const TournamentEntry: React.FC = () => {
  const { player1, openTournament } = useGame();
  const [name, setName] = useState('');
  const [size, setSize] = useState<number>(TOURNAMENT_SIZES[0]);
  const [join, setJoin] = useState(true);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);

  const playerName = player1.name.trim();

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (trimmed.length < TOURNAMENT_NAME_MIN || trimmed.length > TOURNAMENT_NAME_MAX) {
      setError(`Turnuva adı ${TOURNAMENT_NAME_MIN}-${TOURNAMENT_NAME_MAX} karakter olmalı.`);
      return;
    }
    if (join && !playerName) {
      setError(NO_NAME_MSG);
      return;
    }
    setError('');
    setBusy('create');
    const res = await callTournamentRpc<{ code: string }>(
      'create_tournament_rpc',
      {
        p_name: trimmed,
        p_size: size,
        p_player_name: playerName,
        p_avatar: player1.avatar,
        p_join: join,
      },
      'Turnuva oluşturulamadı.'
    );
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    openTournament(String(res.data.code));
  };

  const handleJoin = async () => {
    const trimmed = code.trim();
    if (!TOURNAMENT_CODE_RE.test(trimmed)) {
      setError('Geçerli bir 6 haneli turnuva kodu girin.');
      return;
    }
    if (!playerName) {
      setError(NO_NAME_MSG);
      return;
    }
    setError('');
    setBusy('join');
    const res = await callTournamentRpc(
      'join_tournament_rpc',
      { p_code: trimmed, p_name: playerName, p_avatar: player1.avatar },
      'Turnuvaya katılınamadı.'
    );
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    openTournament(trimmed);
  };

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
          <ArrowLeft className="w-4 h-4" /> Ana Menü
        </button>
        <span className="flex items-center gap-1.5 text-xs font-bold font-subheading text-purple-300 uppercase">
          <Trophy className="w-4 h-4" /> Turnuva
        </span>
      </div>

      <div className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xl">
          {player1.avatar}
        </span>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-subheading">Oyuncu</div>
          <div className="text-sm font-bold text-white truncate">{playerName || 'Takma ad seçilmedi'}</div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="w-full p-3 rounded-xl bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs font-bold flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card variant="cyan" glow className="w-full space-y-4">
        <h2 className="text-sm font-black uppercase tracking-wider text-cyan-300 font-heading">Turnuva Oluştur</h2>

        <div className="space-y-1.5">
          <label
            htmlFor="tournament-name"
            className="block text-xs font-bold uppercase tracking-wider text-cyan-400 font-subheading"
          >
            Turnuva Adı
          </label>
          <input
            id="tournament-name"
            type="text"
            value={name}
            maxLength={TOURNAMENT_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn: Teknofest Kupası"
            className="w-full bg-slate-950/80 border border-slate-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-4 py-3 text-sm font-semibold text-white placeholder-slate-600 outline-none transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-bold uppercase tracking-wider text-cyan-400 font-subheading">
            Oyuncu Sayısı
          </span>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Oyuncu sayısı">
            {TOURNAMENT_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={size === s}
                onClick={() => setSize(s)}
                className={`py-2.5 rounded-xl border text-sm font-bold font-subheading transition-all cursor-pointer ${
                  size === s
                    ? 'border-cyan-400 bg-cyan-950/60 text-cyan-200 box-glow-cyan'
                    : 'border-slate-700 bg-slate-950/50 text-slate-400 hover:border-slate-500'
                }`}
              >
                {s} Oyuncu
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={join}
            onChange={(e) => setJoin(e.target.checked)}
            className="w-4 h-4 accent-cyan-400"
          />
          Ben de oynayacağım
        </label>

        <Button variant="cyan" fullWidth onClick={() => void handleCreate()} disabled={busy !== null}>
          {busy === 'create' ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5" />}
          Turnuva Oluştur
        </Button>
      </Card>

      <Card variant="purple" className="w-full space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-purple-300 font-heading">Kodla Katıl</h2>
        <input
          aria-label="Turnuva kodu"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="6 haneli kod"
          className="w-full bg-slate-950/80 border border-slate-700 focus:border-purple-400 focus:ring-1 focus:ring-purple-400 rounded-xl px-4 py-3 text-center text-xl font-black tracking-[0.4em] text-white placeholder-slate-600 placeholder:tracking-normal placeholder:text-sm outline-none transition-all"
        />
        <Button variant="purple" fullWidth onClick={() => void handleJoin()} disabled={busy !== null}>
          {busy === 'join' ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
          Turnuvaya Katıl
        </Button>
      </Card>
    </motion.div>
  );
};

export default TournamentEntry;
