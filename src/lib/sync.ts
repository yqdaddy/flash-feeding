import type { Baby, CloudData, Diaper, Feeding, Sleep } from '../types';
import { supabase } from './supabase';

export async function fetchCloudData(userId: string): Promise<CloudData> {
  if (!supabase) return { babies: [], feedings: [], diapers: [], sleeps: [] };

  const [b, f, d, s] = await Promise.all([
    supabase.from('babies').select('*').eq('user_id', userId),
    supabase.from('feedings').select('*').eq('user_id', userId),
    supabase.from('diapers').select('*').eq('user_id', userId),
    supabase.from('sleeps').select('*').eq('user_id', userId),
  ]);

  // 任一表读取失败都视为整体失败，避免用空数据覆盖本地
  const failed = [b, f, d, s].find((r) => r.error);
  if (failed) {
    throw new Error(failed.error?.message ?? '云端读取失败');
  }

  return {
    babies: (b.data ?? []) as Baby[],
    feedings: (f.data ?? []) as Feeding[],
    diapers: (d.data ?? []) as Diaper[],
    sleeps: (s.data ?? []) as Sleep[],
  };
}

type TableName = 'babies' | 'feedings' | 'diapers' | 'sleeps';

// 参与内容比对的字段（不含 created_at：时间戳在库端格式与本地不同，且行创建后不会变化）
const COMPARE_FIELDS: Record<TableName, string[]> = {
  babies: ['name', 'gender', 'birth_date', 'avatar', 'color'],
  feedings: ['baby_id', 'type', 'amount_ml', 'fed_at'],
  diapers: ['baby_id', 'type', 'changed_at'],
  sleeps: ['baby_id', 'start_time', 'end_time', 'duration_min'],
};

const DATE_FIELDS = new Set(['fed_at', 'changed_at', 'start_time', 'end_time']);

function fingerprint(table: TableName, row: Record<string, unknown>): string {
  return COMPARE_FIELDS[table]
    .map((field) => {
      const v = row[field];
      if (DATE_FIELDS.has(field)) {
        if (v == null) return '';
        const t = new Date(String(v)).getTime();
        return Number.isNaN(t) ? String(v) : String(t);
      }
      return String(v ?? '');
    })
    .join('|');
}

// ===== 墓碑机制：防止已删除记录被同步"复活" =====

const tombstones = new Set<string>();

export function markDeletedLocally(ids: string[]): void {
  for (const id of ids) tombstones.add(id);
}

export async function pruneTombstones(cloud: CloudData): Promise<void> {
  if (!supabase || tombstones.size === 0) return;
  const groups: Array<[TableName, Array<{ id: string }>]> = [
    ['babies', cloud.babies],
    ['feedings', cloud.feedings],
    ['diapers', cloud.diapers],
    ['sleeps', cloud.sleeps],
  ];
  for (const [table, rows] of groups) {
    const gone = rows.filter((r) => tombstones.has(r.id)).map((r) => r.id);
    if (gone.length === 0) continue;
    const { error } = await supabase.from(table).delete().in('id', gone);
    if (error) console.error(`[cloud] prune ${table}:`, error.message);
  }
}

// ===== 上传逻辑 =====

function stripUserId(rows: unknown[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const copy = { ...(r as Record<string, unknown>) };
    delete copy.user_id;
    return copy;
  });
}

async function uploadChanged<T extends { id: string }>(
  table: TableName,
  localRows: T[],
  cloudRows: T[]
): Promise<void> {
  if (!supabase || localRows.length === 0) return;
  const cloudFp = new Map(
    cloudRows.map((r) => [r.id, fingerprint(table, r as unknown as Record<string, unknown>)])
  );
  const changed = localRows.filter((r) => {
    if (tombstones.has(r.id)) return false;
    const fp = fingerprint(table, r as unknown as Record<string, unknown>);
    return cloudFp.get(r.id) !== fp;
  });
  if (changed.length === 0) return;
  const { error } = await supabase.from(table).upsert(stripUserId(changed), { onConflict: 'id' });
  if (error) console.error(`[cloud] upload ${table}:`, error.message);
}

export async function uploadLocalData(local: CloudData, cloud: CloudData): Promise<void> {
  await uploadChanged('babies', local.babies, cloud.babies);
  await uploadChanged('feedings', local.feedings, cloud.feedings);
  await uploadChanged('diapers', local.diapers, cloud.diapers);
  await uploadChanged('sleeps', local.sleeps, cloud.sleeps);
}

// ===== 合并逻辑：云端优先，但保护同步期间本地又改的行 =====

function mergeTable<T extends { id: string }>(
  table: TableName,
  cloud: T[],
  start: T[],
  now: T[]
): T[] {
  const startFp = new Map(start.map((r) => [r.id, fingerprint(table, r as unknown as Record<string, unknown>)]));
  const cloudIds = new Set(cloud.map((r) => r.id));
  const nowById = new Map(now.map((r) => [r.id, r]));
  const out: T[] = [];

  for (const c of cloud) {
    if (tombstones.has(c.id)) continue;
    const n = nowById.get(c.id);
    if (n && startFp.get(c.id) !== fingerprint(table, n as unknown as Record<string, unknown>)) {
      // 同步期间本地又改了这行：保留本地版本，下次同步会上传
      out.push(n);
    } else {
      out.push(c);
    }
  }
  // 本地新增的行（云端没有）
  for (const n of now) {
    if (!cloudIds.has(n.id) && !tombstones.has(n.id)) out.push(n);
  }
  return out;
}

export function mergeCloudData(cloud: CloudData, start: CloudData, now: CloudData): CloudData {
  return {
    babies: mergeTable('babies', cloud.babies, start.babies, now.babies),
    feedings: mergeTable('feedings', cloud.feedings, start.feedings, now.feedings),
    diapers: mergeTable('diapers', cloud.diapers, start.diapers, now.diapers),
    sleeps: mergeTable('sleeps', cloud.sleeps, start.sleeps, now.sleeps),
  };
}