import React from 'react';

export const LOGO_SRC = `${import.meta.env.BASE_URL}oku-teknofest-logo.jpg`;

interface LogoProps {
  size?: number;
  className?: string;
  /** Decorative by default; pass a label when the logo stands alone. */
  label?: string;
}

/** OKÜ TEKNOFEST Kulübü logosu, daire içinde (kulübün profil görseli formatı). */
export const Logo: React.FC<LogoProps> = ({ size = 40, className = '', label }) => (
  <img
    src={LOGO_SRC}
    width={size}
    height={size}
    alt={label ?? ''}
    aria-hidden={label ? undefined : true}
    draggable={false}
    className={`block shrink-0 rounded-full object-cover ring-1 ring-line bg-surface select-none ${className}`}
    style={{ width: size, height: size }}
  />
);
