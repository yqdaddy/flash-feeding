import type { Diaper, Feeding, Sleep } from '../types';
import { isSameDay, startOfDay } from './datetime';

export function milkTotalOn(feedings: Feeding[], day: Date): number {
  return feedings.filter((f) => isSameDay(f.fed_at, day)).reduce((s, f) => s + f.amount_ml, 0);
}

export function feedCountOn(feedings: Feeding[], day: Date): number {
  return feedings.filter((f) => isSameDay(f.fed_at, day)).length;
}

export function diaperCountOn(diapers: Diaper[], day: Date): number {
  return diapers.filter((d) => isSameDay(d.changed_at, day)).length;
}

export function sleepMinutesOn(sleeps: Sleep[], day: Date): number {
  return sleeps
    .filter((s) => isSameDay(s.start_time, day))
    .reduce((sum, s) => {
      if (s.duration_min != null) return sum + s.duration_min;
      const elapsed = Math.floor((Date.now() - new Date(s.start_time).getTime()) / 60000);
      return sum + Math.max(0, elapsed);
    }, 0);
}

export type TimelineEntry =
  | { kind: 'feeding'; id: string; babyId: string; at: string; feeding: Feeding }
  | { kind: 'diaper'; id: string; babyId: string; at: string; diaper: Diaper }
  | { kind: 'sleep'; id: string; babyId: string; at: string; sleep: Sleep };

export function buildTimeline(
  feedings: Feeding[],
  diapers: Diaper[],
  sleeps: Sleep[],
  day: Date
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const f of feedings) {
    if (isSameDay(f.fed_at, day)) {
      entries.push({ kind: 'feeding', id: f.id, babyId: f.baby_id, at: f.fed_at, feeding: f });
    }
  }
  for (const d of diapers) {
    if (isSameDay(d.changed_at, day)) {
      entries.push({ kind: 'diaper', id: d.id, babyId: d.baby_id, at: d.changed_at, diaper: d });
    }
  }
  for (const s of sleeps) {
    if (isSameDay(s.start_time, day)) {
      entries.push({ kind: 'sleep', id: s.id, babyId: s.baby_id, at: s.start_time, sleep: s });
    }
  }

  entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return entries;
}

export function todayFeedingsForBaby(feedings: Feeding[], babyId: string): Feeding[] {
  const today = startOfDay();
  return feedings.filter((f) => f.baby_id === babyId && isSameDay(f.fed_at, today));
}

export function todayDiapersForBaby(diapers: Diaper[], babyId: string): Diaper[] {
  const today = startOfDay();
  return diapers.filter((d) => d.baby_id === babyId && isSameDay(d.changed_at, today));
}

export function todaySleepsForBaby(sleeps: Sleep[], babyId: string): Sleep[] {
  const today = startOfDay();
  return sleeps.filter((s) => s.baby_id === babyId && isSameDay(s.start_time, today));
}

export function milkByDay(feedings: Feeding[], babyId: string, days: Date[]): number[] {
  const babyFeedings = feedings.filter((f) => f.baby_id === babyId);
  return days.map((d) => milkTotalOn(babyFeedings, d));
}

export { lastNDays, dayLabel } from './datetime';