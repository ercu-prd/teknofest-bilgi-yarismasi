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

const inputClass =
  'w-full h-11 rounded-xl border border-line bg-surface px-3.5 text-base text-ink placeholder:text-muted outline-none focus:border-brand transition-colors';

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="w-full space-y-4"
    >
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => openTournament(null)} className="-ml-2 h-11">
          <ArrowLeft className="w-4 h-4" /> Ana menü
        </Button>
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink-soft">
          <Trophy className="w-4 h-4 text-brand" /> Turnuva
        </span>
      </div>

      <Card padding="sm" className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-brand-soft flex items-center justify-center text-xl shrink-0" aria-hidden="true">
          {player1.avatar}
        </span>
        <div className="min-w-0">
          <div className="text-xs text-muted">Oyuncu</div>
          <div className="text-[15px] font-semibold text-ink truncate">{playerName || 'Takma ad seçilmedi'}</div>
        </div>
      </Card>

      {error && (
        <div
          role="alert"
          className="w-full p-3 rounded-xl bg-danger-soft border border-danger/20 text-danger text-sm flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-ink">Turnuva oluştur</h2>

        <div className="space-y-1.5">
          <label htmlFor="tournament-name" className="block text-sm font-medium text-ink-soft">
            Turnuva adı
          </label>
          <input
            id="tournament-name"
            type="text"
            value={name}
            maxLength={TOURNAMENT_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn. Kulüp Kupası"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-ink-soft">Oyuncu sayısı</span>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-subtle" role="group" aria-label="Oyuncu sayısı">
            {TOURNAMENT_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={size === s}
                onClick={() => setSize(s)}
                className={`h-11 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  size === s ? 'bg-surface text-ink shadow-card' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {s} oyuncu
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 min-h-11 text-[15px] text-ink cursor-pointer select-none">
          <input
            type="checkbox"
            checked={join}
            onChange={(e) => setJoin(e.target.checked)}
            className="w-5 h-5 accent-brand"
          />
          Ben de oynayacağım
        </label>

        <Button variant="primary" fullWidth onClick={() => void handleCreate()} disabled={busy !== null}>
          {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
          Turnuva oluştur
        </Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Kodla katıl</h2>
        <input
          aria-label="Turnuva kodu"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="6 haneli kod"
          className="w-full h-12 rounded-xl border border-line bg-surface px-3.5 text-center font-display text-2xl font-semibold tabular tracking-[0.3em] text-ink placeholder:text-muted placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal outline-none focus:border-brand transition-colors"
        />
        <Button variant="secondary" fullWidth onClick={() => void handleJoin()} disabled={busy !== null}>
          {busy === 'join' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          Turnuvaya katıl
        </Button>
      </Card>
    </motion.div>
  );
};

export default TournamentEntry;
