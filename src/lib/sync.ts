import type { Baby, CloudData, Diaper, Feeding, Sleep } from '../types';
import { supabase } from './supabase';

export async function fetchCloudData(userId: string): Promise<CloudData> {
  const empty: CloudData = { babies: [], feedings: [], diapers: [], sleeps: [] };
  if (!supabase) return empty;

  const [b, f, d, s] = await Promise.all([
    supabase.from('babies').select('*').eq('user_id', userId),
    supabase.from('feedings').select('*').eq('user_id', userId),
    supabase.from('diapers').select('*').eq('user_id', userId),
    supabase.from('sleeps').select('*').eq('user_id', userId),
  ]);

  for (const r of [b, f, d, s]) {
    if (r.error) console.error('[cloud] fetch:', r.error.message);
  }

  return {
    babies: (b.data ?? []) as Baby[],
    feedings: (f.data ?? []) as Feeding[],
    diapers: (d.data ?? []) as Diaper[],
    sleeps: (s.data ?? []) as Sleep[],
  };
}

function stripUserId(rows: unknown[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const copy = { ...(r as Record<string, unknown>) };
    delete copy.user_id;
    return copy;
  });
}

async function uploadNew(
  table: string,
  rows: unknown[],
  cloudRows: unknown[],
  keyOf: (r: Record<string, unknown>) => string
): Promise<void> {
  if (!supabase || rows.length === 0) return;
  const cloudList = cloudRows as Record<string, unknown>[];
  const rowList = rows as Record<string, unknown>[];
  const seen = new Set(cloudList.map(keyOf));
  const fresh = rowList.filter((r) => !seen.has(keyOf(r)));
  if (fresh.length === 0) return;
  const { error } = await supabase.from(table).upsert(stripUserId(fresh), {
    onConflict: 'id',
    ignoreDuplicates: true,
  });
  if (error) console.error(`[cloud] upload ${table}:`, error.message);
}

export async function uploadLocalData(local: CloudData, cloud: CloudData): Promise<void> {
  await uploadNew('babies', local.babies, cloud.babies, (b) => b.created_at as string);
  await uploadNew('feedings', local.feedings, cloud.feedings, (r) => `${r.baby_id as string}|${r.created_at as string}`);
  await uploadNew('diapers', local.diapers, cloud.diapers, (r) => `${r.baby_id as string}|${r.created_at as string}`);
  await uploadNew('sleeps', local.sleeps, cloud.sleeps, (r) => `${r.baby_id as string}|${r.created_at as string}`);
}