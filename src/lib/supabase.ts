import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  typeof url === 'string' && url.length > 0 && typeof anonKey === 'string' && anonKey.length > 0
    ? createClient(url, anonKey)
    : null;

// 将用户名映射为 Supabase 可接受的虚拟邮箱。
// 纯 ASCII 用户名保持原样（老账号登录不受影响）；
// 含中文等非 ASCII 字符时做确定性转义，保证同一用户名始终映射到同一邮箱。
export const pseudoEmail = (username: string): string => {
  const lower = username.toLowerCase();
  const local = /^[a-z0-9._-]+$/.test(lower) ? lower : `u_${encodeURIComponent(lower)}`;
  return `${local}@users.feeding.local`;
};

export const isCloudConfigured = (): boolean => supabase !== null;