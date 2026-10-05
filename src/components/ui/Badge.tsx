import React from 'react';

export type BadgeVariant = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant | LegacyBadgeVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

/** @deprecated Eski neon tema isimleri; yeniden tasarım bitince kaldırılacak. */
type LegacyBadgeVariant = 'cyan' | 'purple' | 'amber' | 'emerald' | 'rose' | 'slate';
const LEGACY: Record<LegacyBadgeVariant, BadgeVariant> = {
  cyan: 'brand', purple: 'neutral', amber: 'warning', emerald: 'success', rose: 'danger', slate: 'neutral',
};

const styles: Record<BadgeVariant, string> = {
  neutral: 'bg-subtle text-ink-soft',
  brand: 'bg-brand-soft text-brand',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

const sizes = {
  sm: 'h-6 px-2 text-xs',
  md: 'h-7 px-2.5 text-[13px]',
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', size = 'md', icon, className = '' }) => (
  <span className={`inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap ${styles[variant in LEGACY ? LEGACY[variant as LegacyBadgeVariant] : (variant as BadgeVariant)]} ${sizes[size]} ${className}`}>
    {icon && <span className="inline-flex" aria-hidden="true">{icon}</span>}
    <span>{children}</span>
  </span>
);
