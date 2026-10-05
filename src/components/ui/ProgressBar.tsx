import React from 'react';

type ProgressTone = 'brand' | 'success' | 'warning' | 'danger';

interface ProgressBarProps {
  value: number;
  max?: number;
  label: string;
  tone?: ProgressTone;
  className?: string;
}

const fills: Record<ProgressTone, string> = {
  brand: 'bg-brand',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

/** İnce, düz renkli ilerleme çubuğu (gradient yok). */
export const ProgressBar: React.FC<ProgressBarProps> = ({ value, max = 100, label, tone = 'brand', className = '' }) => {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.min(Math.max(value, 0), safeMax)}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-subtle ${className}`}
    >
      <div className={`h-full rounded-full transition-[width] duration-300 ${fills[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
};
