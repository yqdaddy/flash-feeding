import type { Diaper, Feeding, Sleep } from '../types';
import { useDataStore } from '../stores/dataStore';

const BOM = '﻿';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(header: string[], rows: string[][]): string {
  return BOM + [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n');
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function exportAllData(): { feedings: number; diapers: number; sleeps: number } {
  const { babies, feedings, diapers, sleeps } = useDataStore.getState();
  const nameOf = (babyId: string): string => babies.find((b) => b.id === babyId)?.name ?? '未知';

  const feedingRows = [...feedings]
    .sort((a, b) => new Date(a.fed_at).getTime() - new Date(b.fed_at).getTime())
    .map((f: Feeding) => [
      nameOf(f.baby_id),
      f.type === 'breast' ? '母乳' : '配方奶',
      String(f.amount_ml),
      formatDateTime(f.fed_at),
    ]);

  const diaperRows = [...diapers]
    .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())
    .map((d: Diaper) => [
      nameOf(d.baby_id),
      d.type === 'wet' ? '尿尿' : d.type === 'solid' ? '便便' : '混合',
      formatDateTime(d.changed_at),
    ]);

  const sleepRows = [...sleeps]
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .map((s: Sleep) => {
      const duration =
        s.duration_min ??
        (s.end_time
          ? 0
          : Math.max(0, Math.round((Date.now() - new Date(s.start_time).getTime()) / 60000)));
      return [
        nameOf(s.baby_id),
        formatDateTime(s.start_time),
        s.end_time ? formatDateTime(s.end_time) : '进行中',
        String(duration),
      ];
    });

  const stamp = dateStamp();

  downloadCsv(
    `闪电喂养_喂奶记录_${stamp}.csv`,
    toCsv(['宝宝', '类型', '奶量(ml)', '喂奶时间'], feedingRows)
  );
  setTimeout(
    () =>
      downloadCsv(
        `闪电喂养_换尿布记录_${stamp}.csv`,
        toCsv(['宝宝', '类型', '更换时间'], diaperRows)
      ),
    400
  );
  setTimeout(
    () =>
      downloadCsv(
        `闪电喂养_睡眠记录_${stamp}.csv`,
        toCsv(['宝宝', '开始时间', '结束时间', '时长(分钟)'], sleepRows)
      ),
    800
  );

  return { feedings: feedingRows.length, diapers: diaperRows.length, sleeps: sleepRows.length };
}