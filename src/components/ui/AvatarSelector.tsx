import React from 'react';
import { AVATAR_OPTIONS } from '../../data/mockQuestions';

interface AvatarSelectorProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({
  selectedId,
  onSelect,
}) => {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 font-subheading">
        Profil Karakteri Seç
      </label>
      <div className="grid grid-cols-6 gap-2">
        {AVATAR_OPTIONS.map((avatar) => {
          const isSelected = selectedId === avatar.id;
          return (
            <button
              key={avatar.id}
              type="button"
              onClick={() => onSelect(avatar.id)}
              className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 aspect-square ${
                isSelected
                  ? 'bg-cyan-950/80 border-cyan-400 box-glow-cyan text-cyan-300 scale-105 z-10'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
              title={avatar.name}
            >
              <span className="text-2xl select-none">{avatar.icon}</span>
              {isSelected && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-ping" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
