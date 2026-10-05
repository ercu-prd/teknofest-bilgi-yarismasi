import { AVATAR_OPTIONS, avatarIconFor, avatarIdFor } from './avatars';

describe('avatars', () => {
  it('id ve ikonlar benzersiz', () => {
    expect(new Set(AVATAR_OPTIONS.map((a) => a.id)).size).toBe(AVATAR_OPTIONS.length);
    expect(new Set(AVATAR_OPTIONS.map((a) => a.icon)).size).toBe(AVATAR_OPTIONS.length);
  });

  it('ikon listesi sunucudaki beyaz listeyle aynı (_validate_player_identity)', () => {
    expect(AVATAR_OPTIONS.map((a) => a.icon)).toEqual(['🚀', '⚡', '🤖', '🛡️', '👨‍🚀', '⚙️']);
  });

  it('id <-> ikon dönüşümleri ve bilinmeyen değer yedeği', () => {
    expect(avatarIconFor('ai')).toBe('🤖');
    expect(avatarIconFor('yok', '⚡')).toBe('⚡');
    expect(avatarIdFor('⚙️')).toBe('engineer');
    expect(avatarIdFor('🐸')).toBe('pilot');
  });
});
