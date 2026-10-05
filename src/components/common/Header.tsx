import React from 'react';
import { Zap, Sparkles } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { SoundToggle } from '../ui/SoundToggle';
import type { ConnectionStatus } from '../../types/game';

const CONNECTION_META: Record<Exclude<ConnectionStatus, 'idle'>, { label: string; dot: string }> = {
  connecting: { label: 'Bağlanıyor', dot: 'bg-amber-400 animate-pulse' },
  connected: { label: 'Canlı', dot: 'bg-emerald-400' },
  reconnecting: { label: 'Yeniden bağlanıyor', dot: 'bg-amber-400 animate-ping' },
  offline: { label: 'Çevrimdışı', dot: 'bg-rose-500' },
};

/** Realtime link health; only meaningful while in a room. */
export const ConnectionIndicator: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
  if (status === 'idle') return null;
  const meta = CONNECTION_META[status];
  return (
    <span
      role="status"
      aria-label={`Bağlantı: ${meta.label}`}
      title={meta.label}
      className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400"
    >
      <span className={`inline-block w-2 h-2 rounded-full ${meta.dot}`} />
      <span className="hidden sm:inline">{meta.label}</span>
    </span>
  );
};

export const Header: React.FC = () => {
  const { currentScreen, roomCode, connectionStatus } = useGame();

  const getScreenTitle = () => {
    switch (currentScreen) {
      case 'HOME':
        return 'Giriş Arenası';
      case 'LOBBY':
        return `Oda #${roomCode}`;
      case 'VS':
        return 'Eşleşme Showdown';
      case 'QUIZ':
        return 'Canlı 1v1 Düello';
      case 'RESULT':
        return 'Maç İstatistikleri';
      case 'MATCHMAKING':
        return 'Rakip Aranıyor';
      case 'LEADERBOARD':
        return 'Liderlik Tablosu';
      case 'TOURNAMENT':
        return 'Turnuva';
      case 'ADMIN':
        return 'Yönetim';
      default:
        return '';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#070a12]/80 border-b border-cyan-500/20 px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 box-glow-cyan text-black font-black font-heading text-lg">
            <Zap className="w-5 h-5 fill-current" />
            <span className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-300"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading text-xs tracking-widest text-cyan-400 font-extrabold uppercase">
                TEKNOFEST
              </span>
              <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase rounded bg-purple-900/80 text-purple-300 border border-purple-500/30">
                1V1
              </span>
            </div>
            <h1 className="text-sm font-bold text-slate-100 tracking-tight font-subheading leading-none">
              Bilgi Yarışması
            </h1>
          </div>
        </div>

        {/* Screen Indicator */}
        <div className="flex items-center gap-2">
          <ConnectionIndicator status={connectionStatus} />
          <SoundToggle />
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase font-subheading bg-slate-900/90 border border-slate-700/60 text-slate-300 flex items-center gap-1.5 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            {getScreenTitle()}
          </span>
        </div>
      </div>
    </header>
  );
};
