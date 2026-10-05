import React from 'react';

type Variant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
/** @deprecated Eski neon tema isimleri; yeniden tasarım bitince kaldırılacak. */
type LegacyVariant = 'cyan' | 'purple' | 'outline';
const LEGACY: Record<LegacyVariant, Variant> = { cyan: 'primary', purple: 'secondary', outline: 'secondary' };
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant | LegacyVariant;
  size?: Size;
  children: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
}

const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-colors duration-150 select-none ' +
  'disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px cursor-pointer';

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-4 text-[15px]',
  lg: 'h-12 px-5 text-base',
};

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover',
  secondary: 'bg-surface text-ink border border-line hover:border-line-strong hover:bg-subtle',
  accent: 'bg-accent text-white hover:bg-accent-hover',
  ghost: 'bg-transparent text-ink-soft hover:bg-subtle hover:text-ink',
  danger: 'bg-surface text-danger border border-danger/30 hover:bg-danger-soft',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  fullWidth = false,
  className = '',
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={`${base} ${sizes[size]} ${variants[variant in LEGACY ? LEGACY[variant as LegacyVariant] : (variant as Variant)]} ${fullWidth ? 'w-full' : ''} ${className}`}
    {...props}
  >
    {children}
  </button>
);
