import React from 'react';

type AvatarTone = 'me' | 'opponent' | 'neutral';

interface AvatarProps {
  emoji: string;
  size?: number;
  tone?: AvatarTone;
  className?: string;
}

const tones: Record<AvatarTone, string> = {
  me: 'border-brand bg-brand-soft',
  opponent: 'border-line-strong bg-subtle',
  neutral: 'border-line bg-subtle',
};

/** Oyuncu avatarı: emoji, daire içinde. Sen = marka mavisi halka, rakip = nötr. */
export const Avatar: React.FC<AvatarProps> = ({ emoji, size = 40, tone = 'neutral', className = '' }) => (
  <span
    aria-hidden="true"
    className={`inline-flex shrink-0 select-none items-center justify-center rounded-full border-2 ${tones[tone]} ${className}`}
    style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
  >
    {emoji}
  </span>
);
