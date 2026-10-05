import React from 'react';
import { Logo } from './Logo';

interface LogoSpinnerProps {
  size?: number;
  label?: string;
  className?: string;
}

/**
 * Yükleniyor göstergesi: kulüp logosunun etrafında dönen ince bir yörünge çizgisi
 * (logodaki roketin çizdiği yay gibi). Tek renk, sade.
 */
export const LogoSpinner: React.FC<LogoSpinnerProps> = ({ size = 56, label = 'Yükleniyor', className = '' }) => {
  const stroke = Math.max(2, Math.round(size / 22));
  const ring = size + stroke * 4;
  const r = (ring - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <span role="status" aria-label={label} className={`relative inline-flex items-center justify-center ${className}`} style={{ width: ring, height: ring }}>
      <svg width={ring} height={ring} viewBox={`0 0 ${ring} ${ring}`} className="absolute inset-0 animate-spin-slow" aria-hidden="true">
        <circle cx={ring / 2} cy={ring / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        <circle
          cx={ring / 2}
          cy={ring / 2}
          r={r}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.28} ${circumference}`}
        />
      </svg>
      <Logo size={size} />
    </span>
  );
};

/** Tam ekran ortalanmış yükleniyor görünümü (ekran geçişleri, Suspense). */
export const LogoSpinnerBlock: React.FC<{ label?: string; hint?: string }> = ({ label = 'Yükleniyor', hint }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
    <LogoSpinner label={label} />
    {hint && <p className="text-sm text-muted">{hint}</p>}
  </div>
);
