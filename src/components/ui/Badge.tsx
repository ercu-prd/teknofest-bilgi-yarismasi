import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'cyan' | 'purple' | 'amber' | 'emerald' | 'rose' | 'slate';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'cyan',
  size = 'md',
  icon,
  className = '',
}) => {
  const styles = {
    cyan: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40 shadow-cyan-500/10',
    purple: 'bg-purple-950/60 text-purple-300 border-purple-500/40 shadow-purple-500/10',
    amber: 'bg-amber-950/60 text-amber-300 border-amber-500/40 shadow-amber-500/10',
    emerald: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10',
    rose: 'bg-rose-950/60 text-rose-300 border-rose-500/40 shadow-rose-500/10',
    slate: 'bg-slate-800/60 text-slate-300 border-slate-700/40',
  };

  const sizeStyles = {
    sm: 'px-2.5 py-0.5 text-xs font-semibold tracking-wide',
    md: 'px-3 py-1 text-xs font-bold tracking-wider',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 uppercase font-subheading rounded-full border shadow-sm backdrop-blur-md ${styles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {icon && <span className="inline-block">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
