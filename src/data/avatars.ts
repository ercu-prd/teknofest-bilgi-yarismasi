/**
 * Selectable player avatars. The icon set must stay identical to the whitelist
 * enforced server-side in public._validate_player_identity().
 */
export const AVATAR_OPTIONS = [
  { id: 'pilot', name: 'Jet Pilotu', icon: '🚀' },
  { id: 'cyber', name: 'Cyber Yetkili', icon: '⚡' },
  { id: 'ai', name: 'AI Mimarı', icon: '🤖' },
  { id: 'hacker', name: 'Siber Uzman', icon: '🛡️' },
  { id: 'space', name: 'Astronavt', icon: '👨‍🚀' },
  { id: 'engineer', name: 'Tekno Mühendis', icon: '⚙️' },
] as const;

export type AvatarId = (typeof AVATAR_OPTIONS)[number]['id'];

export const avatarIconFor = (id: string, fallback: string = AVATAR_OPTIONS[0].icon): string =>
  AVATAR_OPTIONS.find((a) => a.id === id)?.icon ?? fallback;

export const avatarIdFor = (icon: string): string =>
  AVATAR_OPTIONS.find((a) => a.icon === icon)?.id ?? AVATAR_OPTIONS[0].id;
