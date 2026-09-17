import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Baby, CloudData, Diaper, DiaperType, Feeding, FeedingType, Gender, Sleep } from '../types';
import { supabase } from '../lib/supabase';
import {
  fetchCloudData,
  uploadLocalData,
  mergeCloudData,
  pruneTombstones,
  markDeletedLocally,
} from '../lib/sync';
import { getAvatarMeta, pickUnusedAvatar } from '../lib/avatar';
import { nowISO } from '../lib/datetime';
import { genId } from '../lib/utils';
import { shortGapHint } from '../lib/rules';
import { useAuthStore } from './authStore';
import { showToast } from './toastStore';

export interface BabyInput {
  name: string;
  gender: Gender;
  birth_date: string;
}

interface DataState {
  babies: Baby[];
  feedings: Feeding[];
  diapers: Diaper[];
  sleeps: Sleep[];
  activeBabyId: string | null;
  syncMode: boolean;
  syncing: boolean;
  onboardingSkipped: boolean;
  skipOnboarding: () => void;
  addBaby: (input: BabyInput) => Promise<Baby>;
  updateBaby: (id: string, patch: Partial<BabyInput>) => Promise<void>;
  deleteBaby: (id: string) => Promise<void>;
  setActiveBaby: (id: string) => void;
  toggleSyncMode: () => void;
  addFeeding: (type: FeedingType, amountMl: number, fedAt: string) => Promise<void>;
  addDiaper: (type: DiaperType, changedAt: string) => Promise<void>;
  startSleep: () => Promise<void>;
  endSleep: () => Promise<void>;
  deleteRecord: (kind: 'feeding' | 'diaper' | 'sleep', id: string) => Promise<void>;
  updateFeeding: (id: string, patch: Partial<Pick<Feeding, 'type' | 'amount_ml' | 'fed_at'>>) => Promise<void>;
  updateDiaper: (id: string, patch: Partial<Pick<Diaper, 'type' | 'changed_at'>>) => Promise<void>;
  updateSleep: (id: string, patch: Partial<Pick<Sleep, 'start_time' | 'end_time'>>) => Promise<void>;
  afterLogin: () => Promise<void>;
  syncNow: () => Promise<void>;
}

type AnyRow = Record<string, unknown> & { user_id?: string };

// ===== 自动同步调度 =====

const AUTO_SYNC_DELAY_MS = 3000;
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncRetryQueued = false;
let autoSyncInited = false;

function scheduleAutoSync(): void {
  if (!supabase || !useAuthStore.getState().user) return;
  if (syncTimer !== null) return;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void useDataStore.getState().syncNow();
  }, AUTO_SYNC_DELAY_MS);
}

export function initAutoSync(): void {
  if (autoSyncInited || typeof window === 'undefined') return;
  autoSyncInited = true;
  const syncWhenVisible = () => {
    if (document.visibilityState === 'visible') {
      void useDataStore.getState().syncNow();
    }
  };
  document.addEventListener('visibilitychange', syncWhenVisible);
  window.addEventListener('focus', syncWhenVisible);
  window.setInterval(() => void useDataStore.getState().syncNow(), AUTO_SYNC_INTERVAL_MS);
}

// ===== 核心同步流程 =====

async function runSync(announce: boolean): Promise<void> {
  const st = useDataStore.getState();
  const user = useAuthStore.getState().user;
  if (!supabase || !user) return;
  if (st.syncing) {
    if (!announce) syncRetryQueued = true;
    return;
  }
  useDataStore.setState({ syncing: true });
  const startSnapshot: CloudData = {
    babies: st.babies,
    feedings: st.feedings,
    diapers: st.diapers,
    sleeps: st.sleeps,
  };
  try {
    const cloudFirst = await fetchCloudData(user.id);
    await uploadLocalData(startSnapshot, cloudFirst);
    const cloud = await fetchCloudData(user.id);
    await pruneTombstones(cloud);
    const merged = mergeCloudData(cloud, startSnapshot, useDataStore.getState());
    const prevActive = useDataStore.getState().activeBabyId;
    const active = merged.babies.some((b) => b.id === prevActive)
      ? prevActive
      : merged.babies[0]?.id ?? null;
    useDataStore.setState({
      babies: merged.babies,
      feedings: merged.feedings,
      diapers: merged.diapers,
      sleeps: merged.sleeps,
      activeBabyId: active,
    });
    if (announce) showToast('数据已同步到云端', '☁️', '#5C9EAD');
  } catch (err) {
    console.error('[sync] failed', err);
    if (announce) showToast('云端同步失败，稍后会重试', '⚠️', '#C98A2E');
  } finally {
    useDataStore.setState({ syncing: false });
    if (syncRetryQueued) {
      syncRetryQueued = false;
      scheduleAutoSync();
    }
  }
}

// ===== 云端写入辅助 =====

async function cloudInsert(table: string, rows: AnyRow[]): Promise<boolean> {
  const user = useAuthStore.getState().user;
  const sb = supabase;
  if (!sb || !user || rows.length === 0) return true; // 游客模式无需同步
  const payload = rows.map((r) => {
    const copy: Record<string, unknown> = { ...r };
    copy.user_id = user.id;
    return copy;
  });
  const { error } = await sb.from(table).insert(payload);
  if (error) {
    console.error(`[cloud] ${table}:`, error.message);
    return false;
  }
  return true;
}

// ===== 目标宝宝计算 =====

function getTargets(state: {
  babies: Baby[];
  activeBabyId: string | null;
  syncMode: boolean;
}): Baby[] {
  if (state.syncMode || !state.activeBabyId) return state.babies;
  return state.babies.filter((b) => b.id === state.activeBabyId);
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      babies: [],
      feedings: [],
      diapers: [],
      sleeps: [],
      activeBabyId: null,
      syncMode: false,
      syncing: false,
      onboardingSkipped: false,

      skipOnboarding: () => set({ onboardingSkipped: true }),

      addBaby: async (input) => {
        const avatarMeta = pickUnusedAvatar(get().babies.map((b) => b.avatar));
        const baby: Baby = {
          id: genId(),
          name: input.name.trim(),
          gender: input.gender,
          birth_date: input.birth_date,
          avatar: avatarMeta.key,
          color: avatarMeta.color,
          created_at: nowISO(),
        };
        set((s) => ({ babies: [...s.babies, baby], activeBabyId: s.activeBabyId ?? baby.id }));
        const ok = await cloudInsert('babies', [baby as unknown as AnyRow]);
        if (!ok) scheduleAutoSync();
        showToast(`${avatarMeta.label}加入了家庭`, avatarMeta.emoji, avatarMeta.color);
        return baby;
      },

      updateBaby: async (id, patch) => {
        set((s) => ({
          babies: s.babies.map((b) =>
            b.id === id
              ? { ...b, ...patch, name: patch.name ? patch.name.trim() : b.name }
              : b
          ),
        }));
        const baby = get().babies.find((b) => b.id === id);
        const user = useAuthStore.getState().user;
        const sb = supabase;
        if (sb && user && baby) {
          const { error } = await sb
            .from('babies')
            .update({ name: baby.name, gender: baby.gender, birth_date: baby.birth_date })
            .eq('id', id);
          if (error) {
            console.error('[cloud] babies update:', error.message);
            scheduleAutoSync();
          }
        }
      },

      deleteBaby: async (id) => {
        const baby = get().babies.find((b) => b.id === id);
        const meta = baby ? getAvatarMeta(baby.avatar) : null;
        // 墓碑：标记宝宝及其所有记录
        const doomedIds = [
          id,
          ...get().feedings.filter((r) => r.baby_id === id).map((r) => r.id),
          ...get().diapers.filter((r) => r.baby_id === id).map((r) => r.id),
          ...get().sleeps.filter((r) => r.baby_id === id).map((r) => r.id),
        ];
        markDeletedLocally(doomedIds);
        set((s) => ({
          babies: s.babies.filter((b) => b.id !== id),
          feedings: s.feedings.filter((r) => r.baby_id !== id),
          diapers: s.diapers.filter((r) => r.baby_id !== id),
          sleeps: s.sleeps.filter((r) => r.baby_id !== id),
          activeBabyId:
            s.activeBabyId === id
              ? (s.babies.filter((b) => b.id !== id)[0]?.id ?? null)
              : s.activeBabyId,
        }));
        const user = useAuthStore.getState().user;
        const sb = supabase;
        if (sb && user) {
          const results = await Promise.all([
            sb.from('feedings').delete().eq('baby_id', id),
            sb.from('diapers').delete().eq('baby_id', id),
            sb.from('sleeps').delete().eq('baby_id', id),
            sb.from('babies').delete().eq('id', id),
          ]);
          if (results.some((r) => r.error)) {
            console.error('[cloud] deleteBaby:', results.find((r) => r.error)?.error?.message);
            scheduleAutoSync();
          }
        }
        if (meta) showToast(`已删除 ${meta.label}`, '👋', meta.color);
      },

      setActiveBaby: (id) => set({ activeBabyId: id }),

      toggleSyncMode: () => set((s) => ({ syncMode: !s.syncMode })),

      addFeeding: async (type, amountMl, fedAt) => {
        const targets = getTargets(get());
        if (targets.length === 0) {
          showToast('请先添加宝宝', '⚠️', '#C98A2E');
          return;
        }
        const rows: Feeding[] = targets.map((b) => ({
          id: genId(),
          baby_id: b.id,
          type,
          amount_ml: amountMl,
          fed_at: fedAt,
          created_at: nowISO(),
        }));
        set((s) => ({ feedings: [...s.feedings, ...rows] }));
        const ok = await cloudInsert('feedings', rows as unknown as AnyRow[]);
        if (!ok) scheduleAutoSync();
        targets.forEach((b) => {
          const m = getAvatarMeta(b.avatar);
          showToast(`${m.label}喝了 ${amountMl}ml`, m.emoji, m.color);
        });
        // 间隔提示（温和、不阻断）
        const fedMs = new Date(fedAt).getTime();
        for (const b of targets) {
          const prev = get()
            .feedings.filter((f) => f.baby_id === b.id && new Date(f.fed_at).getTime() < fedMs)
            .sort((x, y) => new Date(y.fed_at).getTime() - new Date(x.fed_at).getTime())[0];
          const hint = shortGapHint(b, prev ? prev.fed_at : null, fedAt);
          if (hint) {
            showToast(hint, '⏰', '#C98A2E');
            break;
          }
        }
      },

      addDiaper: async (type, changedAt) => {
        const targets = getTargets(get());
        if (targets.length === 0) {
          showToast('请先添加宝宝', '⚠️', '#C98A2E');
          return;
        }
        const rows: Diaper[] = targets.map((b) => ({
          id: genId(),
          baby_id: b.id,
          type,
          changed_at: changedAt,
          created_at: nowISO(),
        }));
        set((s) => ({ diapers: [...s.diapers, ...rows] }));
        const ok = await cloudInsert('diapers', rows as unknown as AnyRow[]);
        if (!ok) scheduleAutoSync();
        const typeText = type === 'wet' ? '尿尿了' : type === 'solid' ? '便便了' : '尿尿+便便';
        targets.forEach((b) => {
          const m = getAvatarMeta(b.avatar);
          showToast(`${m.label}${typeText}`, m.emoji, m.color);
        });
      },

      startSleep: async () => {
        const targets = getTargets(get());
        if (targets.length === 0) {
          showToast('请先添加宝宝', '⚠️', '#C98A2E');
          return;
        }
        const { sleeps } = get();
        const toStart = targets.filter(
          (b) => !sleeps.some((s) => s.baby_id === b.id && s.end_time === null)
        );
        if (toStart.length === 0) {
          showToast('宝宝已经在睡觉啦', '😴', '#7FA3C0');
          return;
        }
        const rows: Sleep[] = toStart.map((b) => ({
          id: genId(),
          baby_id: b.id,
          start_time: nowISO(),
          end_time: null,
          duration_min: null,
          created_at: nowISO(),
        }));
        set((s) => ({ sleeps: [...s.sleeps, ...rows] }));
        const ok = await cloudInsert('sleeps', rows as unknown as AnyRow[]);
        if (!ok) scheduleAutoSync();
        toStart.forEach((b) => {
          const m = getAvatarMeta(b.avatar);
          showToast(`${m.label}开始睡觉啦`, m.emoji, m.color);
        });
      },

      endSleep: async () => {
        const targets = getTargets(get());
        const ended: Sleep[] = [];
        const endAt = nowISO();
        for (const b of targets) {
          const ongoing = get().sleeps.find((s) => s.baby_id === b.id && s.end_time === null);
          if (!ongoing) continue;
          const durationMin = Math.max(
            1,
            Math.round((Date.now() - new Date(ongoing.start_time).getTime()) / 60000)
          );
          ended.push({ ...ongoing, end_time: endAt, duration_min: durationMin });
        }
        if (ended.length === 0) {
          showToast('没有正在进行的睡眠', '😴', '#7FA3C0');
          return;
        }
        set((s) => ({
          sleeps: s.sleeps.map((x) => ended.find((e) => e.id === x.id) ?? x),
        }));
        const user = useAuthStore.getState().user;
        const sb = supabase;
        if (sb && user) {
          const results = await Promise.all(
            ended.map((r) =>
              sb!.from('sleeps').update({ end_time: r.end_time, duration_min: r.duration_min }).eq('id', r.id)
            )
          );
          if (results.some((r) => r.error)) {
            console.error('[cloud] endSleep:', results.find((r) => r.error)?.error?.message);
            scheduleAutoSync();
          }
        }
        ended.forEach((r) => {
          const b = targets.find((x) => x.id === r.baby_id);
          if (!b) return;
          const m = getAvatarMeta(b.avatar);
          showToast(`${m.label}睡了 ${r.duration_min}分钟`, m.emoji, m.color);
        });
      },

      deleteRecord: async (kind, id) => {
        markDeletedLocally([id]);
        if (kind === 'feeding') set((s) => ({ feedings: s.feedings.filter((r) => r.id !== id) }));
        else if (kind === 'diaper') set((s) => ({ diapers: s.diapers.filter((r) => r.id !== id) }));
        else set((s) => ({ sleeps: s.sleeps.filter((r) => r.id !== id) }));

        const table = kind === 'feeding' ? 'feedings' : kind === 'diaper' ? 'diapers' : 'sleeps';
        const user = useAuthStore.getState().user;
        const sb = supabase;
        if (sb && user) {
          const { error } = await sb.from(table).delete().eq('id', id);
          if (error) {
            console.error(`[cloud] ${table} delete:`, error.message);
            scheduleAutoSync();
          }
        }
      },

      updateFeeding: async (id, patch) => {
        const cur = get().feedings.find((f) => f.id === id);
        if (!cur) return;
        const updated: Feeding = { ...cur, ...patch };
        set((s) => ({ feedings: s.feedings.map((f) => (f.id === id ? updated : f)) }));
        const user = useAuthStore.getState().user;
        const sb = supabase;
        let ok = true;
        if (sb && user) {
          const { error } = await sb
            .from('feedings')
            .update({ type: updated.type, amount_ml: updated.amount_ml, fed_at: updated.fed_at })
            .eq('id', id);
          if (error) {
            console.error('[cloud] feedings update:', error.message);
            ok = false;
          }
        }
        if (!ok) scheduleAutoSync();
        const baby = get().babies.find((b) => b.id === updated.baby_id);
        if (baby) {
          const m = getAvatarMeta(baby.avatar);
          showToast(`已更新 ${m.label} 的喂奶记录`, m.emoji, m.color);
        }
      },

      updateDiaper: async (id, patch) => {
        const cur = get().diapers.find((d) => d.id === id);
        if (!cur) return;
        const updated: Diaper = { ...cur, ...patch };
        set((s) => ({ diapers: s.diapers.map((d) => (d.id === id ? updated : d)) }));
        const user = useAuthStore.getState().user;
        const sb = supabase;
        let ok = true;
        if (sb && user) {
          const { error } = await sb
            .from('diapers')
            .update({ type: updated.type, changed_at: updated.changed_at })
            .eq('id', id);
          if (error) {
            console.error('[cloud] diapers update:', error.message);
            ok = false;
          }
        }
        if (!ok) scheduleAutoSync();
        const baby = get().babies.find((b) => b.id === updated.baby_id);
        if (baby) {
          const m = getAvatarMeta(baby.avatar);
          showToast(`已更新 ${m.label} 的换尿布记录`, m.emoji, m.color);
        }
      },

      updateSleep: async (id, patch) => {
        const cur = get().sleeps.find((s) => s.id === id);
        if (!cur) return;
        const startTime = patch.start_time ?? cur.start_time;
        const endTime = patch.end_time !== undefined ? patch.end_time : cur.end_time;
        let duration: number | null = null;
        if (endTime) {
          duration = Math.max(1, Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000));
        }
        const updated: Sleep = { ...cur, start_time: startTime, end_time: endTime, duration_min: duration };
        set((s) => ({ sleeps: s.sleeps.map((x) => (x.id === id ? updated : x)) }));
        const user = useAuthStore.getState().user;
        const sb = supabase;
        let ok = true;
        if (sb && user) {
          const { error } = await sb
            .from('sleeps')
            .update({ start_time: startTime, end_time: endTime, duration_min: duration })
            .eq('id', id);
          if (error) {
            console.error('[cloud] sleeps update:', error.message);
            ok = false;
          }
        }
        if (!ok) scheduleAutoSync();
        const baby = get().babies.find((b) => b.id === updated.baby_id);
        if (baby) {
          const m = getAvatarMeta(baby.avatar);
          showToast(`已更新 ${m.label} 的睡眠记录`, m.emoji, m.color);
        }
      },

      afterLogin: async () => {
        await runSync(true);
      },

      syncNow: async () => {
        await runSync(false);
      },
    }),
    {
      name: 'flash-feeding-data',
      version: 1,
      partialize: (s) => ({
        babies: s.babies,
        feedings: s.feedings,
        diapers: s.diapers,
        sleeps: s.sleeps,
        activeBabyId: s.activeBabyId,
        syncMode: s.syncMode,
        onboardingSkipped: s.onboardingSkipped,
      }),
    }
  )
);