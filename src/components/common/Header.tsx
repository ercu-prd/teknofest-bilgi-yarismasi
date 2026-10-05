import React from 'react';
import { useGame } from '../../context/GameContext';
import { SoundToggle } from '../ui/SoundToggle';
import { Logo } from '../ui/Logo';
import type { ConnectionStatus } from '../../types/game';

const CONNECTION_META: Record<Exclude<ConnectionStatus, 'idle'>, { label: string; dot: string }> = {
  connecting: { label: 'Bağlanıyor', dot: 'bg-warning' },
  connected: { label: 'Canlı', dot: 'bg-success' },
  reconnecting: { label: 'Yeniden bağlanıyor', dot: 'bg-warning animate-pulse' },
  offline: { label: 'Çevrimdışı', dot: 'bg-danger' },
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
      className="inline-flex items-center gap-1.5 text-xs font-medium text-muted"
    >
      <span className={`inline-block w-2 h-2 rounded-full ${meta.dot}`} />
      <span className="hidden sm:inline">{meta.label}</span>
    </span>
  );
};

const SCREEN_TITLES: Record<string, string> = {
  VS: 'Eşleşme',
  QUIZ: 'Düello',
  RESULT: 'Sonuç',
  MATCHMAKING: 'Rakip Aranıyor',
  LEADERBOARD: 'Liderlik Tablosu',
  TOURNAMENT: 'Turnuva',
  ADMIN: 'Yönetim',
};

export const Header: React.FC = () => {
  const { currentScreen, roomCode, connectionStatus } = useGame();
  const title = currentScreen === 'LOBBY' ? `Oda #${roomCode}` : SCREEN_TITLES[currentScreen] ?? '';

  return (
    <header className="sticky top-0 z-40 w-full bg-surface/95 backdrop-blur border-b border-line">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo size={34} />
          <div className="min-w-0 leading-tight">
            <p className="font-display text-[15px] font-bold tracking-wide text-ink">OKÜ TEKNOFEST</p>
            <p className="truncate text-xs text-muted">{title || 'Bilgi Yarışması'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ConnectionIndicator status={connectionStatus} />
          <SoundToggle />
        </div>
      </div>
    </header>
  );
};
