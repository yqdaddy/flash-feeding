export function nowISO(): string {
  return new Date().toISOString();
}

export function startOfDay(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function isSameDay(iso: string, day: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
}

export function isToday(iso: string): boolean {
  return isSameDay(iso, new Date());
}

export function formatClock(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min}分钟`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}小时` : `${h}小时${m}分`;
}

export function formatStopwatch(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function monthAge(birthDate: string): { months: number; days: number; label: string } {
  const b = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  const anchor = new Date(b.getFullYear(), b.getMonth() + months, b.getDate());
  if (anchor.getTime() > now.getTime()) {
    months -= 1;
  }
  const realAnchor = new Date(b.getFullYear(), b.getMonth() + months, b.getDate());
  let days = Math.floor((now.getTime() - realAnchor.getTime()) / 86400000);
  if (months < 0) {
    months = 0;
    days = Math.max(0, Math.floor((now.getTime() - b.getTime()) / 86400000));
  }
  const label = months < 1 ? `${days}天` : days === 0 ? `${months}个月` : `${months}个月${days}天`;
  return { months, days, label };
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60000);
}

export function lastNDays(n: number): Date[] {
  const out: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - i);
    out.push(d);
  }
  return out;
}

export function dayLabel(d: Date): string {
  const today = startOfDay(new Date());
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff === 2) return '前天';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function weekdayCN(d: Date): string {
  return WEEKDAYS[d.getDay()];
}

export function formatDateCN(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 用于 datetime-local 输入框的本地时间值（YYYY-MM-DDTHH:mm） */
export function toLocalInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}