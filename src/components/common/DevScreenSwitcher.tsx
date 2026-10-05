import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import type { ScreenType } from '../../types/game';
import { Sliders, Eye } from 'lucide-react';

export const DevScreenSwitcher: React.FC = () => {
  const { currentScreen, setScreen } = useGame();
  const [isOpen, setIsOpen] = useState(false);

  const screens: { id: ScreenType; label: string }[] = [
    { id: 'HOME', label: '1. Ana Ekran' },
    { id: 'LOBBY', label: '2. Lobi' },
    { id: 'VS', label: '3. VS Ekranı' },
    { id: 'QUIZ', label: '4. Yarışma' },
    { id: 'RESULT', label: '5. Sonuç' },
  ];

  return (
    <div className="fixed bottom-3 right-3 z-50">
      {isOpen ? (
        <div className="bg-slate-950/90 backdrop-blur-md border border-cyan-500/40 p-3 rounded-2xl shadow-2xl space-y-2 min-w-[180px]">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 font-subheading flex items-center gap-1">
              <Eye className="w-3 h-3" /> Ekran Önizleme
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {screens.map((sc) => (
              <button
                key={sc.id}
                onClick={() => {
                  setScreen(sc.id);
                  setIsOpen(false);
                }}
                className={`text-left px-3 py-1.5 rounded-lg text-xs font-bold font-subheading transition-all ${
                  currentScreen === sc.id
                    ? 'bg-cyan-500 text-black shadow-md'
                    : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-cyan-300'
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-900/90 border border-cyan-500/40 text-cyan-400 text-xs font-bold font-subheading shadow-lg hover:bg-cyan-950 hover:border-cyan-400 transition-all box-glow-cyan"
          title="Tüm ekranları önizle"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Ekran Değiştir</span>
        </button>
      )}
    </div>
  );
};
