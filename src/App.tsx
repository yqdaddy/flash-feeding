import React, { useEffect, useReducer } from 'react';
import { HashRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuthStore } from './stores/authStore';
import { useDataStore, initAutoSync } from './stores/dataStore';
import { useToastStore, showToast } from './stores/toastStore';
import { isCloudConfigured } from './lib/supabase';
import { getAvatarMeta, pickUnusedAvatar } from './lib/avatar';
import {
  addDays,
  dayLabel,
  formatDateCN,
  formatDuration,
  isSameDate,
  monthAge,
  startOfDay,
  toLocalInputValue,
  weekdayCN,
} from './lib/datetime';
import { DISCLAIMER, getFeedingAdvice, getScheduleText } from './lib/rules';
import {
  buildTimeline,
  diaperCountOn,
  feedCountOn,
  lastNDays,
  milkByDay,
  milkTotalOn,
  sleepMinutesOn,
} from './lib/stats';
import { exportAllData } from './lib/export';
import type {
  Baby,
  Diaper,
  DiaperType,
  Feeding,
  FeedingType,
  Gender,
  RecordKind,
  Sleep,
} from './types';

// --- Pages ---
function HomePage() {
  const babies = useDataStore((s) => s.babies);
  const activeBabyId = useDataStore((s) => s.activeBabyId);
  const syncMode = useDataStore((s) => s.syncMode);
  const toggleSyncMode = useDataStore((s) => s.toggleSyncMode);
  const addFeeding = useDataStore((s) => s.addFeeding);
  const addDiaper = useDataStore((s) => s.addDiaper);
  const startSleep = useDataStore((s) => s.startSleep);
  const endSleep = useDataStore((s) => s.endSleep);
  const sleeps = useDataStore((s) => s.sleeps);
  const feedings = useDataStore((s) => s.feedings);
  const diapers = useDataStore((s) => s.diapers);
  const setActiveBaby = useDataStore((s) => s.setActiveBaby);
  const deleteRecord = useDataStore((s) => s.deleteRecord);

  const [sheet, setSheet] = React.useState<null | 'feeding' | 'diaper'>(null);
  const [showAddBaby, setShowAddBaby] = React.useState(false);
  const [viewDate, setViewDate] = React.useState(() => startOfDay());
  const [editing, setEditing] = React.useState<{ kind: RecordKind; id: string } | null>(null);
  const [showSleepDetail, setShowSleepDetail] = React.useState(false);
  const [, forceTick] = useReducer((x) => x + 1, 0);

  const activeBaby = babies.find((b) => b.id === activeBabyId);
  const targets = syncMode ? babies : activeBaby ? [activeBaby] : [];

  const ongoingSleep = sleeps.find(
    (s) => s.end_time === null && targets.some((t) => t.id === s.baby_id)
  );

  useEffect(() => {
    if (!ongoingSleep) return;
    const t = setInterval(forceTick, 1000);
    return () => clearInterval(t);
  }, [ongoingSleep]);

  const sleepElapsed = ongoingSleep
    ? Math.floor((Date.now() - new Date(ongoingSleep.start_time).getTime()) / 1000)
    : 0;

  const isViewingToday = isSameDate(viewDate, startOfDay());

  const goPrevDay = () => setViewDate((d) => addDays(d, -1));
  const goNextDay = () => {
    if (!isViewingToday) setViewDate((d) => addDays(d, 1));
  };
  const backToToday = () => setViewDate(startOfDay());

  const editingFeeding =
    editing && editing.kind === 'feeding'
      ? (feedings.find((f) => f.id === editing.id) ?? null)
      : null;
  const editingDiaper =
    editing && editing.kind === 'diaper'
      ? (diapers.find((d) => d.id === editing.id) ?? null)
      : null;
  const editingSleep =
    editing && editing.kind === 'sleep'
      ? (sleeps.find((s) => s.id === editing.id) ?? null)
      : null;

  const recentSleepCount = sleeps.filter(
    (s) => new Date(s.start_time).getTime() >= addDays(startOfDay(), -6).getTime()
  ).length;

  return (
    <div className="space-y-4">
      {/* Baby Switcher */}
      <BabySwitcher
        babies={babies}
        activeId={activeBabyId}
        onSelect={setActiveBaby}
        onAdd={() => setShowAddBaby(true)}
      />

      {/* Sync Mode Toggle */}
      {babies.length > 1 && (
        <div className="flex items-center justify-between rounded-xl bg-white p-3">
          <div>
            <div className="font-medium">同步记录模式</div>
            <div className="text-sm text-inksoft">一次操作，所有宝宝都记上</div>
          </div>
          <button
            onClick={toggleSyncMode}
            role="switch"
            aria-checked={syncMode}
            className={`relative h-7 w-12 rounded-full transition ${
              syncMode ? 'bg-brand' : 'bg-line'
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                syncMode ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      )}

      {/* Empty State Guide */}
      {babies.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center">
          <Icon icon="mdi:baby-face-outline" className="mx-auto mb-4 text-4xl text-creamdark" />
          <h2 className="mb-2 text-xl font-bold">还没有宝宝记录</h2>
          <p className="mb-4 text-inksoft">点击下方按钮添加第一个宝宝</p>
          <button
            onClick={() => setShowAddBaby(true)}
            className="rounded-2xl bg-brand px-8 py-4 text-lg font-medium text-white transition active:scale-95"
          >
            添加宝宝
          </button>
        </div>
      ) : (
        <>
          {/* Quick Actions */}
          <QuickActions
            ongoingSleep={!!ongoingSleep}
            sleepElapsed={sleepElapsed}
            onFeeding={() => setSheet('feeding')}
            onDiaper={() => setSheet('diaper')}
            onSleep={startSleep}
            onEndSleep={endSleep}
          />

          {/* Date Switcher */}
          <DateSwitcher
            day={viewDate}
            isToday={isViewingToday}
            onPrev={goPrevDay}
            onNext={goNextDay}
            onBackToday={backToToday}
          />

          {/* Today Stats */}
          <TodayStats day={viewDate} babies={babies} feedings={feedings} diapers={diapers} sleeps={sleeps} />

          {/* Sleep Detail Entry */}
          <button
            onClick={() => setShowSleepDetail(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-4 transition active:bg-creamdark"
          >
            <span className="flex items-center gap-2 text-base font-semibold">
              <Icon icon="mdi:moon-waning-crescent" className="text-xl text-[#33597F]" />
              睡眠详情
              {ongoingSleep && (
                <span className="rounded-full bg-[#EAF1F8] px-2 py-0.5 text-xs text-[#33597F]">睡眠中</span>
              )}
            </span>
            <span className="flex items-center gap-1 text-sm text-inksoft">
              近 7 天 {recentSleepCount} 段
              <Icon icon="mdi:chevron-right" className="text-lg" />
            </span>
          </button>

          {/* Timeline */}
          <Timeline
            day={viewDate}
            feedings={feedings}
            diapers={diapers}
            sleeps={sleeps}
            babies={babies}
            onEdit={(kind, id) => setEditing({ kind, id })}
            onDelete={deleteRecord}
          />
        </>
      )}

      {/* Sheets */}
      {sheet === 'feeding' && (
        <FeedingSheet babies={targets} onClose={() => setSheet(null)} onSave={addFeeding} />
      )}
      {sheet === 'diaper' && (
        <DiaperSheet babies={targets} onClose={() => setSheet(null)} onSave={addDiaper} />
      )}
      {showAddBaby && <BabyForm onClose={() => setShowAddBaby(false)} />}

      {/* Edit Sheets */}
      {editingFeeding && (
        <FeedingEditSheet record={editingFeeding} onClose={() => setEditing(null)} />
      )}
      {editingDiaper && (
        <DiaperEditSheet record={editingDiaper} onClose={() => setEditing(null)} />
      )}
      {editingSleep && (
        <SleepEditSheet record={editingSleep} onClose={() => setEditing(null)} />
      )}

      {/* Sleep Detail Sheet */}
      {showSleepDetail && <SleepDetailSheet onClose={() => setShowSleepDetail(false)} />}
    </div>
  );
}

// --- BabySwitcher ---
function BabySwitcher({
  babies,
  activeId,
  onSelect,
  onAdd,
}: {
  babies: Baby[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
      {babies.map((b) => {
        const meta = getAvatarMeta(b.avatar);
        const isActive = b.id === activeId;
        return (
          <button
            key={b.id}
            onClick={() => onSelect(b.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-base transition ${
              isActive ? 'ring-2 ring-offset-1' : 'bg-white border border-line'
            }`}
            style={{ borderColor: isActive ? b.color : undefined }}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
              style={{ backgroundColor: `${b.color}22` }}
            >
              <Icon icon={meta.icon} className="text-lg" />
            </span>
            <span className="font-medium">{b.name}</span>
          </button>
        );
      })}
      <button
        onClick={onAdd}
        className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-inksoft px-3 py-1.5 text-inksoft"
      >
        <Icon icon="mdi:plus" className="text-lg" />
        <span>{babies.length === 0 ? '添加宝宝' : '添加'}</span>
      </button>
    </div>
  );
}

// --- DateSwitcher ---
function DateSwitcher({
  day,
  isToday,
  onPrev,
  onNext,
  onBackToday,
}: {
  day: Date;
  isToday: boolean;
  onPrev: () => void;
  onNext: () => void;
  onBackToday: () => void;
}) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <div className="flex items-center justify-between">
        <button
          onClick={onPrev}
          aria-label="前一天"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-creamdark text-ink transition active:scale-95"
        >
          <Icon icon="mdi:chevron-left" className="text-2xl" />
        </button>
        <div className="text-center">
          <div className="text-lg font-bold tabular-nums">
            {formatDateCN(day)} <span className="text-sm font-normal text-inksoft">{weekdayCN(day)}</span>
          </div>
          {isToday ? (
            <div className="text-xs text-inksoft">今天</div>
          ) : (
            <div className="text-xs text-[#8A6414]">{dayLabel(day)}</div>
          )}
        </div>
        <button
          onClick={onNext}
          disabled={isToday}
          aria-label="后一天"
          className={`flex h-11 w-11 items-center justify-center rounded-full bg-creamdark text-ink transition active:scale-95 ${
            isToday ? 'cursor-not-allowed opacity-30' : ''
          }`}
        >
          <Icon icon="mdi:chevron-right" className="text-2xl" />
        </button>
      </div>
      {!isToday && (
        <button
          onClick={onBackToday}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-[#FBF3E1] py-3 text-base font-medium text-[#8A6414] transition active:scale-95"
        >
          <Icon icon="mdi:calendar-today" className="text-lg" />
          回到今天
        </button>
      )}
    </div>
  );
}

// --- QuickActions ---
function QuickActions({
  ongoingSleep,
  sleepElapsed,
  onFeeding,
  onDiaper,
  onSleep,
  onEndSleep,
}: {
  ongoingSleep: boolean;
  sleepElapsed: number;
  onFeeding: () => void;
  onDiaper: () => void;
  onSleep: () => void;
  onEndSleep: () => void;
}) {
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      <button
        onClick={onFeeding}
        className="flex h-24 flex-col items-center justify-center rounded-2xl bg-[#FFF1E4] text-[#B4541F] transition active:scale-95"
      >
        <Icon icon="mdi:baby-bottle-outline" className="text-3xl" />
        <span className="mt-1 text-base font-semibold">喂奶</span>
      </button>
      <button
        onClick={onDiaper}
        className="flex h-24 flex-col items-center justify-center rounded-2xl bg-[#EAF3EE] text-[#2F6B4F] transition active:scale-95"
      >
        <Icon icon="mdi:diaper-outline" className="text-3xl" />
        <span className="mt-1 text-base font-semibold">换尿布</span>
      </button>
      <button
        onClick={ongoingSleep ? onEndSleep : onSleep}
        className="flex h-24 flex-col items-center justify-center rounded-2xl bg-[#EAF1F8] text-[#33597F] transition active:scale-95"
      >
        {ongoingSleep ? (
          <Icon icon="mdi:timer-outline" className="text-3xl" />
        ) : (
          <Icon icon="mdi:moon-waning-crescent" className="text-3xl" />
        )}
        <span className="mt-1 text-base font-semibold">
          {ongoingSleep ? formatTime(sleepElapsed) : '睡觉'}
        </span>
        {ongoingSleep && <span className="text-xs">点击结束</span>}
      </button>
    </div>
  );
}

// --- TodayStats ---
function TodayStats({
  day,
  babies,
  feedings,
  diapers,
  sleeps,
}: {
  day: Date;
  babies: Baby[];
  feedings: Feeding[];
  diapers: Diaper[];
  sleeps: Sleep[];
}) {
  const isToday = isSameDate(day, startOfDay());
  const dayName = isToday ? '今天' : formatDateCN(day);

  const levelStyles: Record<string, string> = {
    empty: 'bg-[#F5F1EA] text-inksoft',
    low: 'bg-[#FBF3E1] text-[#8A6414]',
    ok: 'bg-[#E9F4EC] text-[#2F6B4F]',
    high: 'bg-[#FDEBDD] text-[#A24E22]',
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">{isToday ? '今日统计' : `${formatDateCN(day)}统计`}</h2>
      {babies.map((baby) => {
        const meta = getAvatarMeta(baby.avatar);
        const age = monthAge(baby.birth_date);
        const babyFeedings = feedings.filter((f) => f.baby_id === baby.id);
        const totalMl = milkTotalOn(babyFeedings, day);
        const count = feedCountOn(babyFeedings, day);
        const diaperCount = diaperCountOn(diapers.filter((x) => x.baby_id === baby.id), day);
        const sleepMins = sleepMinutesOn(sleeps.filter((x) => x.baby_id === baby.id), day);
        const advice = getFeedingAdvice(baby, totalMl, count, dayName);

        return (
          <div
            key={baby.id}
            className="rounded-2xl bg-white p-4"
            style={{ borderLeft: `6px solid ${baby.color}` }}
          >
            <div className="mb-3 flex items-center gap-2">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full text-xl"
                style={{ backgroundColor: `${baby.color}22` }}
              >
                <Icon icon={meta.icon} className="text-lg" />
              </span>
              <div>
                <div className="font-bold">{baby.name}</div>
                <div className="text-sm text-inksoft">{age.label}</div>
              </div>
            </div>
            <div className="mb-3 grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-xl font-bold">{totalMl}</div>
                <div className="text-xs text-inksoft">奶量ml</div>
              </div>
              <div>
                <div className="text-xl font-bold">{count}</div>
                <div className="text-xs text-inksoft">喂奶次</div>
              </div>
              <div>
                <div className="text-xl font-bold">{diaperCount}</div>
                <div className="text-xs text-inksoft">换尿布</div>
              </div>
              <div>
                <div className="text-xl font-bold">{sleepMins}</div>
                <div className="text-xs text-inksoft">睡眠分</div>
              </div>
            </div>
            <div className={`rounded-lg px-3 py-2 text-sm ${levelStyles[advice.level]}`}>
              <span className="font-medium">{advice.title}</span>
              <span className="ml-1">{advice.detail}</span>
            </div>
            <div className="mt-2 flex items-center gap-1 text-sm text-inksoft">
              <Icon icon="mdi:clock-outline" className="shrink-0 text-base" aria-hidden />
              <span>{getScheduleText(baby)}</span>
            </div>
            <div className="mt-1 text-xs text-inksoft">{DISCLAIMER}</div>
          </div>
        );
      })}
    </div>
  );
}

// --- Timeline ---
function Timeline({
  day,
  feedings,
  diapers,
  sleeps,
  babies,
  onEdit,
  onDelete,
}: {
  day: Date;
  feedings: Feeding[];
  diapers: Diaper[];
  sleeps: Sleep[];
  babies: Baby[];
  onEdit: (kind: RecordKind, id: string) => void;
  onDelete: (kind: RecordKind, id: string) => void;
}) {
  const isToday = isSameDate(day, startOfDay());
  const entries = buildTimeline(feedings, diapers, sleeps, day);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 text-center text-inksoft">
        {isToday ? (
          <>
            今天还没有记录，喂一顿吧 <Icon icon="mdi:baby-bottle-outline" className="inline text-lg" />
          </>
        ) : (
          '这一天还没有记录'
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-bold">{isToday ? '今日时间线' : `${formatDateCN(day)}时间线`}</h2>
      {entries.map((entry) => {
        const baby = babies.find((b) => b.id === entry.babyId);
        if (!baby) return null;
        const meta = getAvatarMeta(baby.avatar);
        const time = new Date(entry.at);
        const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;

        let icon: React.ReactNode;
        let text: string;
        if (entry.kind === 'feeding') {
          const f = entry.feeding;
          icon = f.type === 'breast' ? (
            <Icon icon="mdi:mother-heart" className="text-lg" />
          ) : (
            <Icon icon="mdi:baby-bottle-outline" className="text-lg" />
          );
          text = `${f.type === 'breast' ? '母乳' : '奶粉'} ${f.amount_ml}ml`;
        } else if (entry.kind === 'diaper') {
          const d = entry.diaper;
          icon = <Icon icon="mdi:baby-carriage-outline" className="text-lg" />;
          text = d.type === 'wet' ? '湿尿布' : d.type === 'solid' ? '便便' : '混合';
        } else {
          const s = entry.sleep;
          icon = <Icon icon="mdi:moon-waning-crescent" className="text-lg" />;
          if (s.end_time) {
            text = `睡了 ${s.duration_min ?? 0} 分钟`;
          } else {
            const elapsed = Math.floor((Date.now() - new Date(s.start_time).getTime()) / 60000);
            text = `睡觉中... ${Math.max(0, elapsed)}分钟`;
          }
        }

        return (
          <div
            key={`${entry.kind}-${entry.id}`}
            onClick={() => onEdit(entry.kind, entry.id)}
            className="flex cursor-pointer items-center gap-3 rounded-xl bg-white px-4 py-3 transition active:bg-creamdark"
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
              style={{ backgroundColor: `${baby.color}22` }}
            >
              <Icon icon={meta.icon} className="text-lg" />
            </span>
            <span className="text-lg">{icon}</span>
            <span className="flex-1 font-medium">{text}</span>
            <span className="text-sm text-inksoft tabular-nums">{timeStr}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('删除这条记录？')) {
                  void onDelete(entry.kind, entry.id);
                }
              }}
              className="-mr-1 flex h-9 w-9 items-center justify-center rounded-full text-inksoft hover:text-red-500"
              aria-label="删除"
            >
              <Icon icon="mdi:close" className="text-lg" />
            </button>
            <Icon icon="mdi:chevron-right" className="shrink-0 text-inksoft" aria-hidden />
          </div>
        );
      })}
    </div>
  );
}

// --- FeedingSheet ---
function FeedingSheet({
  babies,
  onClose,
  onSave,
}: {
  babies: Baby[];
  onClose: () => void;
  onSave: (type: FeedingType, amountMl: number, fedAt: string) => Promise<void>;
}) {
  const [type, setType] = React.useState<FeedingType>('formula');
  const [amount, setAmount] = React.useState<number | null>(null);
  const [custom, setCustom] = React.useState('');
  const [time, setTime] = React.useState(new Date());
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const QUICK = [30, 60, 90, 120];

  const handleSave = async () => {
    const ml = amount ?? parseInt(custom, 10);
    if (!ml || ml <= 0) {
      setError('请选择或输入奶量');
      return;
    }
    setSaving(true);
    await onSave(type, ml, time.toISOString());
    setSaving(false);
    onClose();
  };

  const adjustTime = (mins: number) => {
    setTime(new Date(time.getTime() + mins * 60000));
  };

  const formatTime = (d: Date) => {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <Sheet title="喂奶记录" onClose={onClose}>
      <div className="mb-4 text-sm text-inksoft">
        记录给：
        {babies.map((b) => {
          const m = getAvatarMeta(b.avatar);
          return (
            <span key={b.id} className="ml-2">
              <Icon icon={m.icon} className="text-lg" /> {b.name}
            </span>
          );
        })}
      </div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setType('breast')}
          className={`flex-1 rounded-xl py-3 text-base font-medium transition ${
            type === 'breast' ? 'bg-brand text-white' : 'bg-creamdark text-ink'
          }`}
        >
          <Icon icon="mdi:mother-heart" className="mr-1 inline text-lg" /> 母乳
        </button>
        <button
          onClick={() => setType('formula')}
          className={`flex-1 rounded-xl py-3 text-base font-medium transition ${
            type === 'formula' ? 'bg-brand text-white' : 'bg-creamdark text-ink'
          }`}
        >
          <Icon icon="mdi:baby-bottle-outline" className="mr-1 inline text-lg" /> 奶粉
        </button>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2">
        {QUICK.map((ml) => (
          <button
            key={ml}
            onClick={() => {
              setAmount(ml);
              setCustom('');
            }}
            className={`rounded-xl py-3 text-base font-medium transition ${
              amount === ml ? 'bg-brand text-white' : 'bg-creamdark text-ink'
            }`}
          >
            {ml}ml
          </button>
        ))}
      </div>

      <input
        type="number"
        inputMode="numeric"
        placeholder="自定义 (ml)"
        value={custom}
        onChange={(e) => {
          setCustom(e.target.value);
          setAmount(null);
        }}
        className="mb-3 w-full rounded-xl border border-line bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-brand"
      />

      <div className="mb-4 flex items-center justify-center gap-4">
        <button
          onClick={() => adjustTime(-15)}
          className="flex items-center gap-1 rounded-lg bg-creamdark px-3 py-2 text-sm"
        >
          <Icon icon="mdi:minus" className="inline" /> 15分
        </button>
        <div className="text-xl font-bold tabular-nums">{formatTime(time)}</div>
        <button
          onClick={() => adjustTime(15)}
          className="flex items-center gap-1 rounded-lg bg-creamdark px-3 py-2 text-sm"
        >
          <Icon icon="mdi:plus" className="inline" /> 15分
        </button>
      </div>

      {error && <div className="mb-2 text-center text-sm text-red-500">{error}</div>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-brand py-4 text-lg font-bold text-white transition active:scale-95 disabled:opacity-50"
      >
        {saving ? '保存中...' : '保存记录'}
      </button>
    </Sheet>
  );
}

// --- DiaperSheet ---
function DiaperSheet({
  babies,
  onClose,
  onSave,
}: {
  babies: Baby[];
  onClose: () => void;
  onSave: (type: DiaperType, changedAt: string) => Promise<void>;
}) {
  const [type, setType] = React.useState<DiaperType>('wet');
  const [time, setTime] = React.useState(new Date());
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(type, time.toISOString());
    setSaving(false);
    onClose();
  };

  const adjustTime = (mins: number) => {
    setTime(new Date(time.getTime() + mins * 60000));
  };

  const formatTime = (d: Date) => {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const options: Array<{ value: DiaperType; label: string; icon: React.ReactNode }> = [
    { value: 'wet', label: '湿湿', icon: <Icon icon="mdi:water-outline" className="text-2xl" /> },
    { value: 'solid', label: '便便', icon: <Icon icon="mdi:emoticon-poop-outline" className="text-2xl" /> },
    { value: 'mixed', label: '混合', icon: <Icon icon="mdi:blur" className="text-2xl" /> },
  ];

  return (
    <Sheet title="换尿布" onClose={onClose}>
      <div className="mb-4 text-sm text-inksoft">
        记录给：
        {babies.map((b) => {
          const m = getAvatarMeta(b.avatar);
          return (
            <span key={b.id} className="ml-2">
              <Icon icon={m.icon} className="text-lg" /> {b.name}
            </span>
          );
        })}
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setType(opt.value)}
            className={`flex h-20 flex-col items-center justify-center rounded-xl text-lg transition ${
              type === opt.value
                ? 'bg-brand text-white ring-2 ring-brand ring-offset-2'
                : 'bg-creamdark text-ink'
            }`}
          >
            {opt.icon}
            <span className="mt-1 font-medium">{opt.label}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-center gap-4">
        <button
          onClick={() => adjustTime(-15)}
          className="flex items-center gap-1 rounded-lg bg-creamdark px-3 py-2 text-sm"
        >
          <Icon icon="mdi:minus" className="inline" /> 15分
        </button>
        <div className="text-xl font-bold tabular-nums">{formatTime(time)}</div>
        <button
          onClick={() => adjustTime(15)}
          className="flex items-center gap-1 rounded-lg bg-creamdark px-3 py-2 text-sm"
        >
          <Icon icon="mdi:plus" className="inline" /> 15分
        </button>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-brand py-4 text-lg font-bold text-white transition active:scale-95 disabled:opacity-50"
      >
        {saving ? '保存中...' : '保存记录'}
      </button>
    </Sheet>
  );
}

// --- TimeEditor ---
function TimeEditor({ value, onChange }: { value: Date; onChange: (next: Date) => void }) {
  return (
    <div className="mb-4 space-y-2">
      <input
        type="datetime-local"
        value={toLocalInputValue(value)}
        onChange={(e) => {
          const next = new Date(e.target.value);
          if (!Number.isNaN(next.getTime())) onChange(next);
        }}
        className="w-full rounded-xl border border-line bg-white px-4 py-3 text-base tabular-nums outline-none focus:ring-2 focus:ring-brand"
      />
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => onChange(new Date(value.getTime() - 15 * 60000))}
          className="flex min-h-[44px] items-center gap-1 rounded-lg bg-creamdark px-4 text-sm"
        >
          <Icon icon="mdi:minus" className="inline" /> 15分
        </button>
        <button
          onClick={() => onChange(new Date(value.getTime() + 15 * 60000))}
          className="flex min-h-[44px] items-center gap-1 rounded-lg bg-creamdark px-4 text-sm"
        >
          <Icon icon="mdi:plus" className="inline" /> 15分
        </button>
      </div>
    </div>
  );
}

// --- FeedingEditSheet ---
function FeedingEditSheet({ record, onClose }: { record: Feeding; onClose: () => void }) {
  const updateFeeding = useDataStore((s) => s.updateFeeding);
  const [type, setType] = React.useState<FeedingType>(record.type);
  const [amount, setAmount] = React.useState<number | null>(null);
  const [custom, setCustom] = React.useState(String(record.amount_ml));
  const [time, setTime] = React.useState(() => new Date(record.fed_at));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const QUICK = [30, 60, 90, 120];

  const handleSave = async () => {
    const ml = amount ?? parseInt(custom, 10);
    if (!ml || ml <= 0) {
      setError('请选择或输入奶量');
      return;
    }
    setSaving(true);
    await updateFeeding(record.id, { type, amount_ml: ml, fed_at: time.toISOString() });
    setSaving(false);
    onClose();
  };

  return (
    <Sheet title="编辑喂奶记录" onClose={onClose}>
      <div className="mb-3 text-sm text-inksoft">修改这条记录，保存后自动同步</div>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setType('breast')}
          className={`flex-1 rounded-xl py-3 text-base font-medium transition ${
            type === 'breast' ? 'bg-brand text-white' : 'bg-creamdark text-ink'
          }`}
        >
          <Icon icon="mdi:mother-heart" className="mr-1 inline text-lg" /> 母乳
        </button>
        <button
          onClick={() => setType('formula')}
          className={`flex-1 rounded-xl py-3 text-base font-medium transition ${
            type === 'formula' ? 'bg-brand text-white' : 'bg-creamdark text-ink'
          }`}
        >
          <Icon icon="mdi:baby-bottle-outline" className="mr-1 inline text-lg" /> 奶粉
        </button>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2">
        {QUICK.map((ml) => (
          <button
            key={ml}
            onClick={() => {
              setAmount(ml);
              setCustom('');
            }}
            className={`rounded-xl py-3 text-base font-medium transition ${
              amount === ml ? 'bg-brand text-white' : 'bg-creamdark text-ink'
            }`}
          >
            {ml}ml
          </button>
        ))}
      </div>

      <input
        type="number"
        inputMode="numeric"
        placeholder="自定义 (ml)"
        value={custom}
        onChange={(e) => {
          setCustom(e.target.value);
          setAmount(null);
        }}
        className="mb-3 w-full rounded-xl border border-line bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-brand"
      />

      <TimeEditor value={time} onChange={setTime} />

      {error && <div className="mb-2 text-center text-sm text-red-500">{error}</div>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-brand py-4 text-lg font-bold text-white transition active:scale-95 disabled:opacity-50"
      >
        {saving ? '保存中...' : '保存修改'}
      </button>
    </Sheet>
  );
}

// --- DiaperEditSheet ---
function DiaperEditSheet({ record, onClose }: { record: Diaper; onClose: () => void }) {
  const updateDiaper = useDataStore((s) => s.updateDiaper);
  const [type, setType] = React.useState<DiaperType>(record.type);
  const [time, setTime] = React.useState(() => new Date(record.changed_at));
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    await updateDiaper(record.id, { type, changed_at: time.toISOString() });
    setSaving(false);
    onClose();
  };

  const options: Array<{ value: DiaperType; label: string; icon: React.ReactNode }> = [
    { value: 'wet', label: '湿湿', icon: <Icon icon="mdi:water-outline" className="text-2xl" /> },
    { value: 'solid', label: '便便', icon: <Icon icon="mdi:emoticon-poop-outline" className="text-2xl" /> },
    { value: 'mixed', label: '混合', icon: <Icon icon="mdi:blur" className="text-2xl" /> },
  ];

  return (
    <Sheet title="编辑换尿布" onClose={onClose}>
      <div className="mb-3 text-sm text-inksoft">修改这条记录，保存后自动同步</div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setType(opt.value)}
            className={`flex h-20 flex-col items-center justify-center rounded-xl text-lg transition ${
              type === opt.value
                ? 'bg-brand text-white ring-2 ring-brand ring-offset-2'
                : 'bg-creamdark text-ink'
            }`}
          >
            {opt.icon}
            <span className="mt-1 font-medium">{opt.label}</span>
          </button>
        ))}
      </div>

      <TimeEditor value={time} onChange={setTime} />

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-brand py-4 text-lg font-bold text-white transition active:scale-95 disabled:opacity-50"
      >
        {saving ? '保存中...' : '保存修改'}
      </button>
    </Sheet>
  );
}

// --- SleepEditSheet ---
function SleepEditSheet({ record, onClose }: { record: Sleep; onClose: () => void }) {
  const updateSleep = useDataStore((s) => s.updateSleep);
  const [start, setStart] = React.useState(() => new Date(record.start_time));
  const [endValue, setEndValue] = React.useState(record.end_time ? toLocalInputValue(new Date(record.end_time)) : '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const endDate = endValue ? new Date(endValue) : null;
  const endValid = endDate !== null && !Number.isNaN(endDate.getTime());
  const previewMin = endValid && endDate ? Math.round((endDate.getTime() - start.getTime()) / 60000) : 0;

  const handleSave = async () => {
    if (!endValue) {
      setSaving(true);
      await updateSleep(record.id, { start_time: start.toISOString(), end_time: null });
      setSaving(false);
      onClose();
      return;
    }
    if (!endValid || !endDate) {
      setError('结束时间格式不对，请重新选择');
      return;
    }
    if (endDate.getTime() <= start.getTime()) {
      setError('结束时间要晚于入睡时间');
      return;
    }
    setSaving(true);
    await updateSleep(record.id, { start_time: start.toISOString(), end_time: endDate.toISOString() });
    setSaving(false);
    onClose();
  };

  return (
    <Sheet title="编辑睡眠" onClose={onClose}>
      <div className="mb-3 text-sm text-inksoft">修改入睡和醒来时间，保存后自动同步</div>

      <div className="mb-1 text-sm font-medium">入睡时间</div>
      <TimeEditor value={start} onChange={setStart} />

      <label className="mb-1 block text-sm font-medium">结束时间</label>
      <input
        type="datetime-local"
        value={endValue}
        onChange={(e) => {
          setEndValue(e.target.value);
          setError('');
        }}
        className="mb-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-base tabular-nums outline-none focus:ring-2 focus:ring-brand"
      />
      {record.end_time === null && (
        <div className="mb-2 text-sm text-inksoft">宝宝还在睡，结束时间留空即保持进行中</div>
      )}
      {endValue && (
        <button onClick={() => setEndValue('')} className="mb-2 text-sm text-brand underline">
          清空结束时间（还在睡）
        </button>
      )}
      {endValid && previewMin > 0 && (
        <div className="mb-2 text-center text-sm text-inksoft">时长 {formatDuration(previewMin)}</div>
      )}
      {error && <div className="mb-2 text-center text-sm text-red-500">{error}</div>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-brand py-4 text-lg font-bold text-white transition active:scale-95 disabled:opacity-50"
      >
        {saving ? '保存中...' : '保存修改'}
      </button>
    </Sheet>
  );
}

// --- SleepDetailSheet ---
function SleepDetailSheet({ onClose }: { onClose: () => void }) {
  const babies = useDataStore((s) => s.babies);
  const sleeps = useDataStore((s) => s.sleeps);
  const [, forceTick] = useReducer((x) => x + 1, 0);
  const hasOngoing = sleeps.some((s) => s.end_time === null);

  useEffect(() => {
    if (!hasOngoing) return;
    const t = setInterval(forceTick, 15000);
    return () => clearInterval(t);
  }, [hasOngoing]);

  const weekStart = addDays(startOfDay(), -6);
  const recent = sleeps
    .filter((s) => new Date(s.start_time).getTime() >= weekStart.getTime() || s.end_time === null)
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  const byDay = new Map<string, Sleep[]>();
  for (const s of recent) {
    const d = new Date(s.start_time);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const list = byDay.get(key);
    if (list) list.push(s);
    else byDay.set(key, [s]);
  }

  return (
    <Sheet title="睡眠详情（近 7 天）" onClose={onClose}>
      {recent.length === 0 ? (
        <div className="py-8 text-center text-inksoft">最近 7 天还没有睡眠记录</div>
      ) : (
        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          {[...byDay.entries()].map(([key, list]) => {
            const [y, m, d] = key.split('-').map(Number);
            const day = new Date(y, m, d);
            return (
              <div key={key}>
                <div className="mb-2 text-sm font-bold text-inksoft">
                  {dayLabel(day)} {formatDateCN(day)}
                </div>
                <div className="space-y-2">
                  {list.map((s) => (
                    <SleepRow key={s.id} sleep={s} babies={babies} />
                  ))}
                </div>
              </div>
            );
          })}
          <div className="text-xs text-inksoft">共 {recent.length} 段睡眠记录</div>
        </div>
      )}
    </Sheet>
  );
}

function SleepRow({ sleep, babies }: { sleep: Sleep; babies: Baby[] }) {
  const baby = babies.find((b) => b.id === sleep.baby_id);
  const meta = baby ? getAvatarMeta(baby.avatar) : null;
  const startTime = new Date(sleep.start_time);
  const ongoing = sleep.end_time === null;
  const mins = ongoing
    ? Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 60000))
    : sleep.duration_min ?? 0;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-3 ${
        ongoing ? 'bg-[#EAF1F8]' : 'bg-creamdark'
      }`}
    >
      {baby && meta && (
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg"
          style={{ backgroundColor: `${baby.color}22` }}
        >
          <Icon icon={meta.icon} className="text-lg" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {baby && <span className="font-medium">{baby.name}</span>}
          {ongoing && (
            <span className="rounded-full bg-[#33597F] px-2 py-0.5 text-xs text-white">睡眠中</span>
          )}
        </div>
        <div className="text-sm text-inksoft tabular-nums">
          {String(startTime.getHours()).padStart(2, '0')}:{String(startTime.getMinutes()).padStart(2, '0')}{' '}
          至{' '}
          {ongoing
            ? '现在'
            : sleep.end_time
              ? `${String(new Date(sleep.end_time).getHours()).padStart(2, '0')}:${String(new Date(sleep.end_time).getMinutes()).padStart(2, '0')}`
              : ''}
        </div>
      </div>
      <div className={`shrink-0 text-base font-bold tabular-nums ${ongoing ? 'text-[#33597F]' : ''}`}>
        {formatDuration(mins)}
      </div>
    </div>
  );
}

// --- Sheet ---
function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-5 pb-8 animate-sheet-up">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-inksoft" aria-label="关闭">
            <Icon icon="mdi:close" className="text-lg" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// --- BabyForm ---
function BabyForm({ initial, onClose }: { initial?: Baby; onClose: () => void }) {
  const addBaby = useDataStore((s) => s.addBaby);
  const updateBaby = useDataStore((s) => s.updateBaby);
  const babies = useDataStore((s) => s.babies);

  const [name, setName] = React.useState(initial?.name ?? '');
  const [gender, setGender] = React.useState<Gender>(initial?.gender ?? 'male');
  const [birthDate, setBirthDate] = React.useState(initial?.birth_date ?? '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const isEdit = !!initial;

  const previewAvatar = initial
    ? getAvatarMeta(initial.avatar)
    : pickUnusedAvatar(babies.map((b) => b.avatar));

  const handleSave = async () => {
    if (!name.trim()) {
      setError('请输入宝宝昵称');
      return;
    }
    if (!birthDate) {
      setError('请选择出生日期');
      return;
    }
    setSaving(true);
    if (isEdit && initial) {
      await updateBaby(initial.id, { name, gender, birth_date: birthDate });
    } else {
      await addBaby({ name: name.trim(), gender, birth_date: birthDate });
    }
    setSaving(false);
    onClose();
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <Sheet title={isEdit ? '编辑宝宝' : '添加宝宝'} onClose={onClose}>
      {!isEdit && (
        <div className="mb-4 flex items-center justify-center gap-3">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full text-3xl"
            style={{ backgroundColor: `${previewAvatar.color}22` }}
          >
            <Icon icon={previewAvatar.icon} className="text-xl" />
          </span>
          <div>
            <div className="text-sm text-inksoft">系统为宝宝分配的形象</div>
            <div className="font-medium" style={{ color: previewAvatar.color }}>
              {previewAvatar.label}
            </div>
          </div>
        </div>
      )}

      <label className="mb-3 block">
        <span className="mb-1 block text-sm text-inksoft">昵称</span>
        <input
          type="text"
          maxLength={12}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="宝宝的小名"
          className="w-full rounded-xl border border-line bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-brand"
        />
      </label>

      <div className="mb-3">
        <span className="mb-1 block text-sm text-inksoft">性别</span>
        <div className="flex gap-2">
          <button
            onClick={() => setGender('male')}
            className={`flex-1 rounded-xl py-3 text-base font-medium transition ${
              gender === 'male' ? 'bg-brand text-white' : 'bg-creamdark text-ink'
            }`}
          >
            <Icon icon="mdi:baby-face-outline" className="mr-1 inline" /> 男宝
          </button>
          <button
            onClick={() => setGender('female')}
            className={`flex-1 rounded-xl py-3 text-base font-medium transition ${
              gender === 'female' ? 'bg-brand text-white' : 'bg-creamdark text-ink'
            }`}
          >
            <Icon icon="mdi:baby-face-outline" className="mr-1 inline" /> 女宝
          </button>
        </div>
      </div>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm text-inksoft">出生日期</span>
        <input
          type="date"
          max={today}
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="w-full rounded-xl border border-line bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-brand"
        />
      </label>

      {error && <div className="mb-2 text-center text-sm text-red-500">{error}</div>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-brand py-4 text-lg font-bold text-white transition active:scale-95 disabled:opacity-50"
      >
        {saving ? '保存中...' : '保存'}
      </button>
    </Sheet>
  );
}

// --- Compare Page ---
function ComparePage() {
  const babies = useDataStore((s) => s.babies);
  const feedings = useDataStore((s) => s.feedings);

  const [aId, setAId] = React.useState(babies[0]?.id ?? '');
  const [bId, setBId] = React.useState(babies[1]?.id ?? '');

  useEffect(() => {
    if (!aId && babies[0]) setAId(babies[0].id);
    if (!bId && babies[1]) setBId(babies[1].id);
  }, [babies, aId, bId]);

  if (babies.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Icon icon="mdi:baby-face-outline" className="text-4xl text-inksoft" />
        <p className="mt-4 text-lg text-inksoft">添加第二个宝宝后解锁对比功能</p>
      </div>
    );
  }

  const babyA = babies.find((b) => b.id === aId);
  const babyB = babies.find((b) => b.id === bId);

  if (!babyA || !babyB) return null;

  const metaA = getAvatarMeta(babyA.avatar);
  const metaB = getAvatarMeta(babyB.avatar);

  const now = new Date();
  const todayMl = (babyId: string) => {
    return feedings
      .filter((f) => {
        const d = new Date(f.fed_at);
        return (
          f.baby_id === babyId &&
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      })
      .reduce((s, f) => s + f.amount_ml, 0);
  };

  const mlA = todayMl(babyA.id);
  const mlB = todayMl(babyB.id);
  const maxMl = Math.max(1, mlA, mlB);

  const days = lastNDays(7);
  const seriesA = milkByDay(feedings, babyA.id, days);
  const seriesB = milkByDay(feedings, babyB.id, days);
  const maxSeries = Math.max(1, ...seriesA, ...seriesB);

  const diff = Math.abs(mlA - mlB);
  const minMl = Math.min(mlA, mlB) || 1;
  const pct = mlA === 0 && mlB === 0 ? 0 : Math.round((diff / minMl) * 100);
  const larger = mlA > mlB ? babyA : mlB > mlA ? babyB : null;
  const largerMeta = larger ? getAvatarMeta(larger.avatar) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">双宝对比</h1>

      <div className="flex gap-2">
        <select
          value={aId}
          onChange={(e) => setAId(e.target.value)}
          className="flex-1 rounded-xl border border-line bg-white px-3 py-2 text-base"
        >
          {babies.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <span className="flex items-center text-inksoft">VS</span>
        <select
          value={bId}
          onChange={(e) => setBId(e.target.value)}
          className="flex-1 rounded-xl border border-line bg-white px-3 py-2 text-base"
        >
          {babies.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl bg-white p-4">
        <h2 className="mb-3 font-bold">今日奶量</h2>
        <div className="space-y-3">
          {[
            { baby: babyA, meta: metaA, ml: mlA },
            { baby: babyB, meta: metaB, ml: mlB },
          ].map(({ baby, meta, ml }) => (
            <div key={baby.id} className="flex items-center gap-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg"
                style={{ backgroundColor: `${baby.color}22` }}
              >
                <Icon icon={meta.icon} className="text-lg" />
              </span>
              <div className="flex-1">
                <div className="mb-1 flex justify-between text-sm">
                  <span>{baby.name}</span>
                  <span className="font-bold">{ml} ml</span>
                </div>
                <div className="h-4 rounded-full bg-creamdark">
                  <div
                    className="h-full rounded-full transition"
                    style={{ width: `${(ml / maxMl) * 100}%`, backgroundColor: baby.color }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        {pct > 20 && largerMeta && (
          <div className="mt-3 rounded-lg bg-[#FBF3E1] px-3 py-2 text-sm text-[#8A6414]">
            {largerMeta.label}今天比另一宝多喝约 {pct}%，差距有点明显，留意一下
          </div>
        )}
        {pct > 0 && pct <= 20 && (
          <div className="mt-3 rounded-lg bg-[#E9F4EC] px-3 py-2 text-sm text-[#2F6B4F]">
            两个宝宝今天奶量接近，节奏很同步
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white p-4">
        <h2 className="mb-3 font-bold">近 7 天趋势</h2>
        <div className="mb-2 flex gap-4 text-sm">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded" style={{ backgroundColor: babyA.color }} />
            {babyA.name}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded" style={{ backgroundColor: babyB.color }} />
            {babyB.name}
          </span>
        </div>
        <svg viewBox="0 0 320 140" className="w-full" role="img" aria-label="近7天奶量趋势图">
          {days.map((d, i) => {
            const xBase = 10 + i * 44;
            const valA = seriesA[i];
            const valB = seriesB[i];
            const hA = Math.max(2, (valA / maxSeries) * 90);
            const hB = Math.max(2, (valB / maxSeries) * 90);
            const yA = 120 - hA;
            const yB = 120 - hB;
            return (
              <g key={i}>
                <title>
                  {dayLabel(d)}: {babyA.name} {valA}ml / {babyB.name} {valB}ml
                </title>
                <rect x={xBase} y={yA} width="12" height={hA} rx="2" fill={babyA.color} />
                <rect x={xBase + 16} y={yB} width="12" height={hB} rx="2" fill={babyB.color} />
                <text x={xBase + 14} y="134" textAnchor="middle" fontSize="10" fill="#7A6C5D">
                  {dayLabel(d)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// --- Manage Page ---
function ManagePage() {
  const babies = useDataStore((s) => s.babies);
  const deleteBaby = useDataStore((s) => s.deleteBaby);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const cloudOk = isCloudConfigured();

  const [editing, setEditing] = React.useState<Baby | null>(null);
  const [showAdd, setShowAdd] = React.useState(false);

  const handleExport = () => {
    const counts = exportAllData();
    showToast(
      `已导出：喂奶 ${counts.feedings} 条、换尿布 ${counts.diapers} 条、睡眠 ${counts.sleeps} 段`,
      '📦',
      '#2F6B4F'
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">宝宝管理</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white"
        >
          <Icon icon="mdi:plus" className="mr-1 inline" /> 添加宝宝
        </button>
      </div>

      <div className="space-y-2">
        {babies.map((baby) => {
          const meta = getAvatarMeta(baby.avatar);
          const age = monthAge(baby.birth_date);
          return (
            <div
              key={baby.id}
              className="flex items-center gap-3 rounded-xl bg-white p-3"
              style={{ borderLeft: `4px solid ${baby.color}` }}
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full text-xl"
                style={{ backgroundColor: `${baby.color}22` }}
              >
                <Icon icon={meta.icon} className="text-lg" />
              </span>
              <div className="flex-1">
                <div className="font-bold">{baby.name}</div>
                <div className="text-sm text-inksoft">
                  {baby.gender === 'male' ? '男宝' : '女宝'} · {age.label}
                </div>
              </div>
              <button
                onClick={() => setEditing(baby)}
                className="rounded-lg border border-line px-3 py-1.5 text-sm"
              >
                <Icon icon="mdi:pencil" className="mr-1 inline text-base" /> 编辑
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`确定删除「${baby.name}」吗？TA 的所有记录也会一起删除`)) {
                    void deleteBaby(baby.id);
                  }
                }}
                className="rounded-lg border border-line px-3 py-1.5 text-sm text-red-500"
              >
                <Icon icon="mdi:delete" className="mr-1 inline text-base" /> 删除
              </button>
            </div>
          );
        })}
      </div>

      {/* 数据导出 */}
      <div className="rounded-2xl bg-white p-4">
        <h2 className="mb-1 font-bold">数据导出</h2>
        <p className="mb-3 text-sm text-inksoft">
          导出喂奶、换尿布、睡眠记录，共 3 个 CSV 文件，可用 Excel 或表格软件打开
        </p>
        <button
          onClick={handleExport}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#E9F4EC] text-base font-medium text-[#2F6B4F] transition active:scale-95"
        >
          <Icon icon="mdi:download" className="text-xl" />
          导出数据（CSV）
        </button>
      </div>

      <div className="rounded-2xl bg-white p-4">
        <h2 className="mb-3 font-bold">账号与数据</h2>
        {!cloudOk && <div className="text-sm text-inksoft">未配置云端服务，数据保存在本机</div>}
        {cloudOk && user && (
          <div className="space-y-2">
            <div className="text-sm">
              已登录：<span className="font-medium">{user.username}</span>
            </div>
            <div className="text-sm text-inksoft">数据自动同步到云端</div>
            <button
              onClick={() => void logout()}
              className="rounded-lg border border-line px-4 py-2 text-sm"
            >
              退出登录
            </button>
          </div>
        )}
        {cloudOk && !user && (
          <div className="space-y-2">
            <div className="text-sm text-inksoft">游客模式：数据仅保存在本机</div>
            <Link
              to="/auth"
              className="inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
            >
              登录 / 注册
            </Link>
          </div>
        )}
      </div>

      {showAdd && <BabyForm onClose={() => setShowAdd(false)} />}
      {editing && <BabyForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// --- Auth Validation ---
type PasswordStrengthLevel = 'weak' | 'medium' | 'strong';

// 用户名：2-20 字符，中文/英文/数字/下划线，不能以数字开头
const USERNAME_REGEX = /^[一-龥a-zA-Z_][一-龥a-zA-Z0-9_]{1,19}$/;

function validateUsername(username: string): { valid: boolean; message: string } {
  if (!username) return { valid: false, message: '请输入用户名' };
  if ([...username].length < 2) return { valid: false, message: '用户名至少 2 个字符' };
  if ([...username].length > 20) return { valid: false, message: '用户名最多 20 个字符' };
  if (/^[0-9]/.test(username)) return { valid: false, message: '用户名不能以数字开头' };
  if (!USERNAME_REGEX.test(username)) return { valid: false, message: '只能使用中文、英文、数字、下划线' };
  return { valid: true, message: '' };
}

// 密码：6-20 位，必须含字母和数字
function validatePassword(password: string): {
  valid: boolean;
  message: string;
  strength: PasswordStrengthLevel;
} {
  if (!password) return { valid: false, message: '请输入密码', strength: 'weak' };
  if (password.length < 6) return { valid: false, message: '密码至少 6 位', strength: 'weak' };
  if (password.length > 20) return { valid: false, message: '密码最多 20 位', strength: 'weak' };

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!hasLetter) return { valid: false, message: '密码需包含字母', strength: 'weak' };
  if (!hasNumber) return { valid: false, message: '密码需包含数字', strength: 'weak' };

  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const isLong = password.length >= 10;
  const strength: PasswordStrengthLevel = hasSpecial || isLong ? 'strong' : 'medium';
  return { valid: true, message: '', strength };
}

const STRENGTH_LEVEL: Record<PasswordStrengthLevel, number> = { weak: 1, medium: 2, strong: 3 };

function PasswordStrength({ strength }: { strength: PasswordStrengthLevel }) {
  const config = {
    weak: { color: 'bg-red-500', text: '弱', textColor: 'text-red-500' },
    medium: { color: 'bg-orange-500', text: '中', textColor: 'text-orange-500' },
    strong: { color: 'bg-green-600', text: '强', textColor: 'text-green-600' },
  };
  const c = config[strength];

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-2 w-6 rounded-full transition-colors ${
              i <= STRENGTH_LEVEL[strength] ? c.color : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <span className={`text-sm ${c.textColor}`}>{c.text}</span>
    </div>
  );
}

// --- Auth Page ---
function AuthPage() {
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const cloudOk = isCloudConfigured();
  const navigate = useNavigate();

  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [usernameError, setUsernameError] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [needsConfirm, setNeedsConfirm] = React.useState(false);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const isRegister = mode === 'register';
  // 注册模式实时校验（用于输入框状态图标）
  const usernameCheck = isRegister && username ? validateUsername(username) : null;
  const passwordCheck = validatePassword(password);

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setUsernameError('');
    setPasswordError('');
    setError('');
    if (next === 'register') setNeedsConfirm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUsernameError('');
    setPasswordError('');

    if (isRegister) {
      const u = validateUsername(username);
      if (!u.valid) {
        setUsernameError(u.message);
        return;
      }
      const p = validatePassword(password);
      if (!p.valid) {
        setPasswordError(p.message);
        return;
      }
    } else {
      // 登录只查非空：老账号规则与现有格式校验交给服务端，避免老用户被新规则挡住
      if (!username) {
        setUsernameError('请输入用户名');
        return;
      }
      if (!password) {
        setPasswordError('请输入密码');
        return;
      }
    }

    setLoading(true);
    try {
      if (!isRegister) {
        await login(username, password);
        navigate('/');
      } else {
        const res = await register(username, password);
        if (res.needsConfirm) {
          setNeedsConfirm(true);
          setMode('login');
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  if (!cloudOk) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Icon icon="mdi:cloud-off-outline" className="text-4xl text-inksoft" />
        <h1 className="mt-4 text-xl font-bold">云端服务未配置</h1>
        <p className="mt-2 text-inksoft">暂时只能游客模式使用（数据保存在本机）</p>
        <Link to="/" className="mt-4 text-brand underline">
          返回首页
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="mb-6 text-center text-2xl font-bold">{isRegister ? '注册' : '登录'}</h1>

      <div className="mb-4 flex rounded-xl bg-creamdark p-1">
        <button
          onClick={() => switchMode('login')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            mode === 'login' ? 'bg-white shadow' : ''
          }`}
        >
          登录
        </button>
        <button
          onClick={() => switchMode('register')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            mode === 'register' ? 'bg-white shadow' : ''
          }`}
        >
          注册
        </button>
      </div>

      {needsConfirm && (
        <div className="mb-4 rounded-lg bg-[#E9F4EC] px-4 py-3 text-sm text-[#2F6B4F]">
          注册成功！请到邮箱点击确认链接后再登录
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <div className="relative">
            <input
              type="text"
              placeholder="用户名（支持中文）"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (usernameError) setUsernameError('');
              }}
              className={`h-14 w-full rounded-2xl border-2 bg-white px-4 pr-12 text-lg outline-none transition-colors ${
                usernameError
                  ? 'border-red-400 bg-red-50'
                  : usernameCheck?.valid
                    ? 'border-green-500'
                    : 'border-line focus:border-brand'
              }`}
            />
            {usernameCheck && (
              <Icon
                icon={usernameCheck.valid ? 'mdi:check' : 'mdi:close'}
                className={`absolute right-4 top-1/2 -translate-y-1/2 text-2xl ${
                  usernameCheck.valid ? 'text-green-600' : 'text-red-400'
                }`}
                aria-hidden
              />
            )}
          </div>
          {usernameError && (
            <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
              <Icon icon="mdi:alert-circle-outline" className="shrink-0 text-base" aria-hidden />
              {usernameError}
            </p>
          )}
        </div>

        <div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="密码（6-20 位，含字母和数字）"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError('');
              }}
              className={`h-14 w-full rounded-2xl border-2 bg-white px-4 pr-12 text-lg outline-none transition-colors ${
                passwordError ? 'border-red-400 bg-red-50' : 'border-line focus:border-brand'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-inksoft"
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
            >
              <Icon icon={showPassword ? 'mdi:eye-off-outline' : 'mdi:eye-outline'} className="text-xl" />
            </button>
          </div>
          {isRegister && password && <PasswordStrength strength={passwordCheck.strength} />}
          {passwordError && (
            <p className="mt-1 flex items-center gap-1 text-sm text-red-500">
              <Icon icon="mdi:alert-circle-outline" className="shrink-0 text-base" aria-hidden />
              {passwordError}
            </p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500">
            <Icon icon="mdi:alert-circle-outline" className="shrink-0 text-base" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-brand py-4 text-lg font-bold text-white transition active:scale-95 disabled:opacity-50"
        >
          {loading ? '处理中...' : isRegister ? '注册' : '登录'}
        </button>
      </form>

      <Link to="/" className="mt-4 block text-center text-sm text-inksoft underline">
        返回首页
      </Link>
    </div>
  );
}

// --- Onboarding Page ---
function OnboardingPage() {
  const babies = useDataStore((s) => s.babies);
  const navigate = useNavigate();

  useEffect(() => {
    if (babies.length > 0) navigate('/', { replace: true });
  }, [babies, navigate]);

  const handleSkip = () => {
    useDataStore.getState().skipOnboarding();
    navigate('/', { replace: true });
  };

  return (
    <div className="flex flex-col items-center py-8 text-center">
      <Icon icon="mdi:baby-bottle-outline" className="text-6xl text-brand" />
      <h1 className="mt-4 text-2xl font-bold">闪电喂养</h1>
      <p className="mt-2 text-inksoft">3 秒记一次，双胞胎也不乱</p>

      <div className="mt-6 w-full max-w-sm rounded-2xl bg-white p-4">
        <h2 className="mb-4 text-lg font-bold">添加第一个宝宝</h2>
        <BabyFormInline />
      </div>

      <Link to="/auth" className="mt-4 text-sm text-inksoft underline">
        已有账号？登录同步云端
      </Link>

      <button
        onClick={handleSkip}
        className="mt-2 flex items-center gap-1 rounded-xl px-6 py-3 text-base text-inksoft transition active:scale-95"
      >
        稍后再说
        <Icon icon="mdi:arrow-right" className="text-lg" />
      </button>
    </div>
  );
}

function BabyFormInline() {
  const addBaby = useDataStore((s) => s.addBaby);
  const babies = useDataStore((s) => s.babies);

  const [name, setName] = React.useState('');
  const [gender, setGender] = React.useState<Gender>('male');
  const [birthDate, setBirthDate] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const previewAvatar = pickUnusedAvatar(babies.map((b) => b.avatar));

  const handleSave = async () => {
    if (!name.trim()) {
      setError('请输入宝宝昵称');
      return;
    }
    if (!birthDate) {
      setError('请选择出生日期');
      return;
    }
    setSaving(true);
    await addBaby({ name: name.trim(), gender, birth_date: birthDate });
    setSaving(false);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
          style={{ backgroundColor: `${previewAvatar.color}22` }}
        >
          <Icon icon={previewAvatar.icon} className="text-xl" />
        </span>
        <span className="text-sm" style={{ color: previewAvatar.color }}>
          {previewAvatar.label}
        </span>
      </div>

      <input
        type="text"
        maxLength={12}
        placeholder="宝宝昵称"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-xl border border-line bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-brand"
      />

      <div className="flex gap-2">
        <button
          onClick={() => setGender('male')}
          className={`flex-1 rounded-xl py-3 text-base font-medium transition ${
            gender === 'male' ? 'bg-brand text-white' : 'bg-creamdark text-ink'
          }`}
        >
          <Icon icon="mdi:baby-face-outline" className="mr-1 inline" /> 男宝
        </button>
        <button
          onClick={() => setGender('female')}
          className={`flex-1 rounded-xl py-3 text-base font-medium transition ${
            gender === 'female' ? 'bg-brand text-white' : 'bg-creamdark text-ink'
          }`}
        >
          <Icon icon="mdi:baby-face-outline" className="mr-1 inline" /> 女宝
        </button>
      </div>

      <input
        type="date"
        max={today}
        value={birthDate}
        onChange={(e) => setBirthDate(e.target.value)}
        className="w-full rounded-xl border border-line bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-brand"
      />

      {error && <div className="text-sm text-red-500">{error}</div>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-brand py-4 text-lg font-bold text-white transition active:scale-95 disabled:opacity-50"
      >
        {saving ? '保存中...' : '开始记录'}
      </button>
    </div>
  );
}

// --- Layout ---
function Layout() {
  const babies = useDataStore((s) => s.babies);
  const onboardingSkipped = useDataStore((s) => s.onboardingSkipped);
  const user = useAuthStore((s) => s.user);
  const syncing = useDataStore((s) => s.syncing);

  if (babies.length === 0 && !onboardingSkipped) return <Navigate to="/welcome" replace />;

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2">
          <span className="text-lg font-bold"><Icon icon="mdi:baby-bottle-outline" className="mr-1 inline" /> 闪电喂养</span>
          {syncing ? (
            <span className="rounded-full bg-creamdark px-3 py-1 text-sm text-inksoft">同步中...</span>
          ) : user ? (
            <span className="rounded-full bg-[#E9F4EC] px-3 py-1 text-sm text-[#2F6B4F]">
              {user.username}
            </span>
          ) : (
            <Link
              to="/auth"
              className="rounded-full bg-[#FBF3E1] px-3 py-1 text-sm text-[#8A6414]"
            >
              游客模式 · 点此登录
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 pt-2">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-line bg-white/95 backdrop-blur safe-bottom">
        <div className="mx-auto flex max-w-md">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center py-3 text-sm ${isActive ? 'text-brand' : 'text-inksoft'}`
            }
          >
            <Icon icon="mdi:home-outline" className="text-xl" />
            <span>首页</span>
          </NavLink>
          <NavLink
            to="/compare"
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center py-3 text-sm ${isActive ? 'text-brand' : 'text-inksoft'}`
            }
          >
            <Icon icon="mdi:chart-bar" className="text-xl" />
            <span>对比</span>
          </NavLink>
          <NavLink
            to="/manage"
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center py-3 text-sm ${isActive ? 'text-brand' : 'text-inksoft'}`
            }
          >
            <Icon icon="mdi:baby-face-outline" className="text-xl" />
            <span>管理</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}

// --- Toast Host ---
function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="fixed top-3 inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 shadow-lg animate-toast-in"
          style={{ borderColor: t.color }}
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-base"
            style={{ backgroundColor: `${t.color}22` }}
          >
            {t.emoji}
          </span>
          <span className="font-medium text-ink">{t.text}</span>
        </div>
      ))}
    </div>
  );
}

// --- Splash ---
function Splash() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Icon icon="mdi:baby-bottle-outline" className="text-4xl text-brand" />
    </div>
  );
}

// --- Main App ---
export default function App() {
  const initializing = useAuthStore((s) => s.initializing);
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
    initAutoSync();
  }, [init]);

  if (initializing) return <Splash />;

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/manage" element={<ManagePage />} />
        </Route>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/welcome" element={<OnboardingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastHost />
    </HashRouter>
  );
}