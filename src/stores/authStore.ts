import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { pseudoEmail, supabase } from '../lib/supabase';
import { useDataStore } from './dataStore';

export interface AuthUser {
  id: string;
  username: string;
}

interface AuthState {
  user: AuthUser | null;
  initializing: boolean;
  init: () => void;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<{ needsConfirm: boolean }>;
  logout: () => Promise<void>;
}

function toAuthUser(u: User | null): AuthUser | null {
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as { username?: string };
  const fallback = u.email ? u.email.split('@')[0] : '用户';
  return {
    id: u.id,
    username: typeof meta.username === 'string' && meta.username ? meta.username : fallback,
  };
}

export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return '用户名或密码不对，再试试？';
  if (m.includes('already registered')) return '这个用户名已被注册，直接登录试试';
  if (m.includes('password should be at least')) return '密码至少 6 位';
  if (m.includes('not confirmed')) return '账号还没验证：请先打开验证邮件里的链接';
  if (m.includes('rate limit')) return '操作太频繁了，休息一下再试';
  return message;
}

let inited = false;

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  initializing: supabase !== null,

  init: () => {
    if (!supabase) {
      set({ initializing: false });
      return;
    }
    if (inited) return;
    inited = true;

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        set({ user: toAuthUser(data.session?.user ?? null), initializing: false });
        if (data.session) void useDataStore.getState().afterLogin();
      })
      .catch(() => set({ initializing: false }));

    supabase.auth.onAuthStateChange((_event, session) => {
      const prev = get().user;
      const next = toAuthUser(session?.user ?? null);
      set({ user: next });
      if (next && !prev) void useDataStore.getState().afterLogin();
    });

    window.addEventListener('online', () => {
      if (get().user) void useDataStore.getState().afterLogin();
    });
  },

  login: async (username, password) => {
    if (!supabase) throw new Error('未配置云端服务，暂时只能游客模式');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: pseudoEmail(username),
      password,
    });
    if (error) throw new Error(friendlyAuthError(error.message));
    if (data.user) {
      set({ user: toAuthUser(data.user) });
      await useDataStore.getState().afterLogin();
    }
  },

  register: async (username, password) => {
    if (!supabase) throw new Error('未配置云端服务，暂时只能游客模式');
    const { data, error } = await supabase.auth.signUp({
      email: pseudoEmail(username),
      password,
      options: { data: { username } },
    });
    if (error) throw new Error(friendlyAuthError(error.message));
    if (data.session && data.user) {
      set({ user: toAuthUser(data.user) });
      await useDataStore.getState().afterLogin();
      return { needsConfirm: false };
    }
    return { needsConfirm: true };
  },

  logout: async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
    }
    set({ user: null });
  },
}));