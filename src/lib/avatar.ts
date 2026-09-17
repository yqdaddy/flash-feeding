import type { AvatarKey } from '../types';

export interface AvatarMeta {
  key: AvatarKey;
  icon: string;  // iconify icon name for UI display
  emoji: string; // emoji for toast notifications (decorative, not interactive)
  label: string;
  color: string;
}

// 所有宝宝使用统一的图标，通过颜色和名称区分
export const AVATARS: AvatarMeta[] = [
  { key: 'bear', icon: 'mdi:baby-face-outline', emoji: '🐻', label: '小熊', color: '#4C8DE8' },
  { key: 'rabbit', icon: 'mdi:baby-face-outline', emoji: '🐰', label: '小兔', color: '#E5729E' },
  { key: 'lion', icon: 'mdi:baby-face-outline', emoji: '🦁', label: '小狮', color: '#E8A33D' },
  { key: 'frog', icon: 'mdi:baby-face-outline', emoji: '🐸', label: '小蛙', color: '#58B368' },
  { key: 'fox', icon: 'mdi:baby-face-outline', emoji: '🦊', label: '小狐', color: '#E0763F' },
  { key: 'koala', icon: 'mdi:baby-face-outline', emoji: '🐨', label: '小考拉', color: '#7FA3C0' },
  { key: 'monkey', icon: 'mdi:baby-face-outline', emoji: '🐵', label: '小猴', color: '#A97C50' },
  { key: 'penguin', icon: 'mdi:baby-face-outline', emoji: '🐧', label: '小企鹅', color: '#5C9EAD' },
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