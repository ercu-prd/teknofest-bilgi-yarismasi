import React from 'react';

interface CardProps {
  children: React.ReactNode;
  variant?: 'cyan' | 'purple' | 'default';
  className?: string;
  glow?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className = '',
  glow = false,
}) => {
  const borderColors = {
    default: 'border-slate-800/80 hover:border-slate-700',
    cyan: 'border-cyan-500/30 hover:border-cyan-500/60',
    purple: 'border-purple-500/30 hover:border-purple-500/60',
  };

  const glowStyles = {
    default: glow ? 'box-shadow: 0 0 20px rgba(0,0,0,0.5)' : '',
    cyan: glow ? 'box-glow-cyan' : '',
    purple: glow ? 'box-glow-purple' : '',
  };

  return (
    <div
      className={`cyber-card rounded-2xl p-6 transition-all duration-300 ${borderColors[variant]} ${glowStyles[variant]} ${className}`}
    >
      {/* Decorative Cyber Corner elements */}
      <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400/40 rounded-tl-xl pointer-events-none" />
      <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400/40 rounded-tr-xl pointer-events-none" />
      <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-purple-400/40 rounded-bl-xl pointer-events-none" />
      <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-purple-400/40 rounded-br-xl pointer-events-none" />
      
      {children}
    </div>
  );
};
