import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** İkon butonlarında görünür metin yok; erişilebilir ad zorunlu. */
  label: string;
  children: React.ReactNode;
  variant?: 'ghost' | 'secondary';
}

const variants = {
  ghost: 'text-ink-soft hover:bg-subtle hover:text-ink',
  secondary: 'border border-line bg-surface text-ink hover:border-line-strong hover:bg-subtle',
};

/** 44x44 px dokunma hedefli kare ikon butonu. */
export const IconButton: React.FC<IconButtonProps> = ({
  label,
  children,
  variant = 'ghost',
  className = '',
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    aria-label={label}
    title={label}
    className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    {...props}
  >
    {children}
  </button>
);
