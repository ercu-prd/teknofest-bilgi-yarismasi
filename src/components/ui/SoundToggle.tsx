import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useMuted } from '../../hooks/useMuted';

interface SoundToggleProps {
  className?: string;
}

export const SoundToggle: React.FC<SoundToggleProps> = ({ className = '' }) => {
  const [muted, toggle] = useMuted();
  const Icon = muted ? VolumeX : Volume2;
  const label = muted ? 'Sesi aç' : 'Sesi kapat';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={muted}
      title={label}
      className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border transition-all duration-200 active:scale-95 select-none ${
        muted
          ? 'border-slate-700/60 bg-slate-800/40 text-slate-500 hover:text-slate-300 hover:border-slate-600'
          : 'border-cyan-500/40 bg-cyan-950/30 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
      } ${className}`}
    >
      <Icon className="w-5 h-5" aria-hidden="true" />
    </button>
  );
};
