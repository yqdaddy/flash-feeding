import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Baby, CloudData, Diaper, DiaperType, Feeding, FeedingType, Gender, Sleep } from '../types';
import { supabase } from '../lib/supabase';
import { fetchCloudData, uploadLocalData } from '../lib/sync';
import { getAvatarMeta, pickUnusedAvatar } from '../lib/avatar';
import { nowISO } from '../lib/datetime';
import { genId } from '../lib/utils';
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
  afterLogin: () => Promise<void>;
}

type AnyRow = Record<string, unknown> & { user_id?: string };

function getTargets(state: {
  babies: Baby[];
  activeBabyId: string | null;
  syncMode: boolean;
}): Baby[] {
  if (state.syncMode || !state.activeBabyId) return state.babies;
  return state.babies.filter((b) => b.id === state.activeBabyId);
}

async function cloudInsert(table: string, rows: AnyRow[]): Promise<void> {
  const user = useAuthStore.getState().user;
  const sb = supabase;
  if (!sb || !user || rows.length === 0) return;
  const payload = rows.map((r) => {
    const copy: Record<string, unknown> = { ...r };
    copy.user_id = user.id; // RLS 需要 user_id = auth.uid()
    return copy;
  });
  const { error } = await sb.from(table).insert(payload);
  if (error) console.error(`[cloud] ${table}:`, error.message);
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
        await cloudInsert('babies', [baby as unknown as AnyRow]);
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
          await sb
            .from('babies')
            .update({ name: baby.name, gender: baby.gender, birth_date: baby.birth_date })
            .eq('id', id);
        }
      },

      deleteBaby: async (id) => {
        const baby = get().babies.find((b) => b.id === id);
        const meta = baby ? getAvatarMeta(baby.avatar) : null;
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
          await Promise.all([
            sb.from('feedings').delete().eq('baby_id', id),
            sb.from('diapers').delete().eq('baby_id', id),
            sb.from('sleeps').delete().eq('baby_id', id),
            sb.from('babies').delete().eq('id', id),
          ]);
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
        await cloudInsert('feedings', rows as unknown as AnyRow[]);
        targets.forEach((b) => {
          const m = getAvatarMeta(b.avatar);
          showToast(`${m.label}喝了 ${amountMl}ml`, m.emoji, m.color);
        });
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
        await cloudInsert('diapers', rows as unknown as AnyRow[]);
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
        await cloudInsert('sleeps', rows as unknown as AnyRow[]);
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
          await Promise.all(
            ended.map((r) =>
              sb!.from('sleeps').update({ end_time: r.end_time, duration_min: r.duration_min }).eq('id', r.id)
            )
          );
        }
        ended.forEach((r) => {
          const b = targets.find((x) => x.id === r.baby_id);
          if (!b) return;
          const m = getAvatarMeta(b.avatar);
          showToast(`${m.label}睡了 ${r.duration_min}分钟`, m.emoji, m.color);
        });
      },

      deleteRecord: async (kind, id) => {
        if (kind === 'feeding') set((s) => ({ feedings: s.feedings.filter((r) => r.id !== id) }));
        else if (kind === 'diaper') set((s) => ({ diapers: s.diapers.filter((r) => r.id !== id) }));
        else set((s) => ({ sleeps: s.sleeps.filter((r) => r.id !== id) }));

        const table = kind === 'feeding' ? 'feedings' : kind === 'diaper' ? 'diapers' : 'sleeps';
        const user = useAuthStore.getState().user;
        const sb = supabase;
        if (sb && user) await sb.from(table).delete().eq('id', id);
      },

      afterLogin: async () => {
        const user = useAuthStore.getState().user;
        const sb = supabase;
        if (!sb || !user || get().syncing) return;
        set({ syncing: true });
        try {
          const local: CloudData = {
            babies: get().babies,
            feedings: get().feedings,
            diapers: get().diapers,
            sleeps: get().sleeps,
          };
          const cloudFirst = await fetchCloudData(user.id);
          await uploadLocalData(local, cloudFirst);
          const cloud = await fetchCloudData(user.id);
          const prevActive = get().activeBabyId;
          const active = cloud.babies.some((b) => b.id === prevActive)
            ? prevActive
            : cloud.babies[0]?.id ?? null;
          set({
            babies: cloud.babies,
            feedings: cloud.feedings,
            diapers: cloud.diapers,
            sleeps: cloud.sleeps,
            activeBabyId: active,
          });
          showToast('数据已同步到云端', '☁️', '#5C9EAD');
        } catch (err) {
          console.error('[sync] afterLogin failed', err);
          showToast('云端同步失败，稍后会重试', '⚠️', '#C98A2E');
        } finally {
          set({ syncing: false });
        }
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