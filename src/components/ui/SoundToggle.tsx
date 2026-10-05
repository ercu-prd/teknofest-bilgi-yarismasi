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
      className={`inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors select-none cursor-pointer hover:bg-subtle ${
        muted ? 'text-muted' : 'text-ink-soft'
      } ${className}`}
    >
      <Icon className="w-5 h-5" aria-hidden="true" />
    </button>
  );
};
