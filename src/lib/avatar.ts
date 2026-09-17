import type { AvatarKey } from '../types';

export interface AvatarMeta {
  key: AvatarKey;
  emoji: string;
  label: string;
  color: string;
}

export const AVATARS: AvatarMeta[] = [
  { key: 'bear', emoji: '🐻', label: '小熊', color: '#4C8DE8' },
  { key: 'rabbit', emoji: '🐰', label: '小兔', color: '#E5729E' },
  { key: 'lion', emoji: '🦁', label: '小狮', color: '#E8A33D' },
  { key: 'frog', emoji: '🐸', label: '小蛙', color: '#58B368' },
  { key: 'fox', emoji: '🦊', label: '小狐', color: '#E0763F' },
  { key: 'koala', emoji: '🐨', label: '小考拉', color: '#7FA3C0' },
  { key: 'monkey', emoji: '🐵', label: '小猴', color: '#A97C50' },
  { key: 'penguin', emoji: '🐧', label: '小企鹅', color: '#5C9EAD' },
];

const AVATAR_MAP = new Map(AVATARS.map((a) => [a.key, a]));

export function getAvatarMeta(key: string): AvatarMeta {
  return AVATAR_MAP.get(key as AvatarKey) ?? AVATARS[0];
}

export function pickUnusedAvatar(usedKeys: string[]): AvatarMeta {
  const usedSet = new Set(usedKeys);
  const unused = AVATARS.find((a) => !usedSet.has(a.key));
  if (unused) return unused;
  // All used - cycle by count
  return AVATARS[usedKeys.length % AVATARS.length];
}