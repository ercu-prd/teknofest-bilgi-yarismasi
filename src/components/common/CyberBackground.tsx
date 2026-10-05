import React from 'react';

export const CyberBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Grid Pattern */}
      <div className="absolute inset-0 cyber-grid-pattern opacity-30" />

      {/* Glow Orbs */}
      <div className="absolute top-[-10%] left-[10%] w-[350px] h-[350px] bg-cyan-500/10 rounded-full blur-[100px] animate-pulse-glow" />
      <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: '1.5s' }} />

      {/* Cyber Scanline Effect */}
      <div className="scanline" />
    </div>
  );
};
