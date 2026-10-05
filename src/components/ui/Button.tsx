import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: 'cyan' | 'purple' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  fullWidth?: boolean;
  glow?: boolean;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'cyan',
  size = 'md',
  children,
  fullWidth = false,
  glow = true,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = "relative inline-flex items-center justify-center font-heading font-bold uppercase tracking-wider transition-all duration-200 rounded-xl overflow-hidden disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.98]";

  const sizeStyles = {
    sm: "px-4 py-2 text-xs gap-2 min-h-[38px]",
    md: "px-6 py-3.5 text-sm gap-2.5 min-h-[48px]",
    lg: "px-8 py-4 text-base gap-3 min-h-[56px]",
  };

  const variantStyles = {
    cyan: `bg-gradient-to-r from-cyan-500 via-cyan-400 to-teal-400 text-black shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/40 hover:brightness-110 ${glow ? 'box-glow-cyan' : ''}`,
    purple: `bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white shadow-lg shadow-purple-600/20 hover:shadow-purple-500/40 hover:brightness-110 ${glow ? 'box-glow-purple' : ''}`,
    outline: "border-2 border-cyan-500/50 bg-cyan-950/20 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400 hover:text-cyan-300",
    ghost: "bg-slate-800/40 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50",
    danger: "bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-lg shadow-rose-600/20 hover:shadow-rose-500/40",
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled}
      {...props}
    >
      {/* Top reflection line */}
      <span className="absolute inset-x-0 top-0 h-[1px] bg-white/30" />
      
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </motion.button>
  );
};
