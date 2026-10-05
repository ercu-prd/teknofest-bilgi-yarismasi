import React from 'react';

type CardVariant = 'default' | 'muted' | 'brand';
/** @deprecated Eski neon tema isimleri; yeniden tasarım bitince kaldırılacak. */
type LegacyCardVariant = 'cyan' | 'purple';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: CardVariant | LegacyCardVariant;
  /** @deprecated etkisiz */
  glow?: boolean;
  padding?: 'none' | 'sm' | 'md';
  className?: string;
}

const variants: Record<CardVariant, string> = {
  default: 'bg-surface border border-line shadow-card',
  muted: 'bg-subtle border border-line',
  brand: 'bg-brand-soft border border-brand-line',
};

const paddings = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
};

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  glow: _glow,
  ...props
}) => (
  <div className={`rounded-2xl ${variants[variant === 'cyan' || variant === 'purple' ? 'default' : variant]} ${paddings[padding]} ${className}`} {...props}>
    {children}
  </div>
);
