import React from 'react';
import { AVATAR_OPTIONS } from '../../data/avatars';

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
      <span className="block text-sm font-medium text-ink-soft" id="avatar-label">
        Avatar
      </span>
      <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-labelledby="avatar-label">
        {AVATAR_OPTIONS.map((avatar) => {
          const isSelected = selectedId === avatar.id;
          return (
            <button
              key={avatar.id}
              type="button"
              onClick={() => onSelect(avatar.id)}
              role="radio"
              aria-checked={isSelected}
              aria-label={avatar.name}
              className={`flex items-center justify-center aspect-square rounded-xl border transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-brand-soft border-brand ring-1 ring-brand'
                  : 'bg-surface border-line hover:border-line-strong'
              }`}
              title={avatar.name}
            >
              <span className="text-2xl select-none" aria-hidden="true">{avatar.icon}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
