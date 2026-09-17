import type { Baby } from '../types';
import { monthAge } from './datetime';

export const DISCLAIMER = '仅供参考，不替代医嘱';

export interface FeedingPlan {
  perFeedMin: number;
  perFeedMax: number;
  timesMin: number;
  timesMax: number;
  /** 建议喂养间隔下限（小时），0 表示此阶段不做间隔建议 */
  intervalMin: number;
  /** 建议喂养间隔上限（小时），0 表示此阶段不做间隔建议 */
  intervalMax: number;
  dailyMin: number;
  dailyMax: number;
  stageLabel: string;
  solidsFirst: boolean;
}

interface PlanEntry {
  maxMonth: number;
  perFeed: [number, number];
  times: [number, number];
  /** 建议喂养间隔（小时）区间 */
  interval: [number, number];
  label: string;
}

// 按月龄的喂养频率参考口径：
// 0-1 月每 2-3 小时一次（8-12 次/天）；1-2 月每 3-4 小时（6-8 次/天）；
// 3-5 月约 4 小时一次（5-6 次/天）；6 月后引入辅食，奶量逐步下降（4-5 次/天）
const PLANS: PlanEntry[] = [
  { maxMonth: 1, perFeed: [60, 90], times: [8, 12], interval: [2, 3], label: '0-1个月' },
  { maxMonth: 3, perFeed: [90, 120], times: [6, 8], interval: [3, 4], label: '1-2个月' },
  { maxMonth: 6, perFeed: [150, 200], times: [5, 6], interval: [4, 4], label: '3-5个月' },
];

export function getPlan(baby: Baby): FeedingPlan {
  const { months } = monthAge(baby.birth_date);
  if (months < 6) {
    const p = PLANS.find((x) => months < x.maxMonth) ?? PLANS[PLANS.length - 1];
    return {
      perFeedMin: p.perFeed[0],
      perFeedMax: p.perFeed[1],
      timesMin: p.times[0],
      timesMax: p.times[1],
      intervalMin: p.interval[0],
      intervalMax: p.interval[1],
      dailyMin: p.perFeed[0] * p.times[0],
      dailyMax: p.perFeed[1] * p.times[1],
      stageLabel: p.label,
      solidsFirst: false,
    };
  }
  return {
    perFeedMin: 0,
    perFeedMax: 0,
    timesMin: 4,
    timesMax: 5,
    intervalMin: 0,
    intervalMax: 0,
    dailyMin: 600,
    dailyMax: 800,
    stageLabel: '6个月以上',
    solidsFirst: true,
  };
}

/** 统计区的频率与间隔建议文案 */
export function getScheduleText(baby: Baby): string {
  const plan = getPlan(baby);
  if (plan.solidsFirst) {
    return `辅食为主，每天喂奶 ${plan.timesMin}-${plan.timesMax} 次左右`;
  }
  const intervalText =
    plan.intervalMin === plan.intervalMax
      ? `每 ${plan.intervalMin} 小时左右一次`
      : `每 ${plan.intervalMin}-${plan.intervalMax} 小时一次`;
  return `${plan.stageLabel}：建议每天喂 ${plan.timesMin}-${plan.timesMax} 次，${intervalText}`;
}

/**
 * 当次喂养距上次间隔明显偏短（小于建议间隔的一半）时，给出温和提示。
 * 返回 null 表示无需提示。
 */
export function shortGapHint(baby: Baby, prevFedAt: string | null, fedAt: string): string | null {
  if (!prevFedAt) return null;
  const plan = getPlan(baby);
  if (plan.intervalMin <= 0) return null;
  const gapMin = Math.round((new Date(fedAt).getTime() - new Date(prevFedAt).getTime()) / 60000);
  if (gapMin < 0) return null;
  if (gapMin >= (plan.intervalMin * 60) / 2) return null;
  return `距上次喂奶才 ${gapMin} 分钟，宝宝可能只是想安抚，按需喂养就好`;
}

export type AdviceLevel = 'empty' | 'low' | 'ok' | 'high';

export interface Advice {
  level: AdviceLevel;
  title: string;
  detail: string;
}

export function getFeedingAdvice(
  baby: Baby,
  todayTotalMl: number,
  todayCount: number,
  dayName = '今天'
): Advice {
  const plan = getPlan(baby);
  if (todayCount === 0) {
    return {
      level: 'empty',
      title: `${dayName}还没有喂奶记录`,
      detail: '记录第一顿奶后给你参考建议',
    };
  }
  if (plan.solidsFirst) {
    if (todayTotalMl < plan.dailyMin) {
      return {
        level: 'low',
        title: '奶量偏少',
        detail: `宝宝 6 月后以辅食为主，${dayName}奶量还差约 ${plan.dailyMin - todayTotalMl} ml 到 ${plan.dailyMin}-${plan.dailyMax} ml 推荐区间`,
      };
    }
    if (todayTotalMl > plan.dailyMax) {
      return {
        level: 'high',
        title: '奶量偏多',
        detail: `${dayName}奶量超出 ${plan.dailyMax} ml 推荐上限约 ${todayTotalMl - plan.dailyMax} ml，辅食为主即可`,
      };
    }
    return {
      level: 'ok',
      title: '奶量达标',
      detail: `在 ${plan.dailyMin}-${plan.dailyMax} ml 推荐区间内，继续保持`,
    };
  }
  if (todayTotalMl < plan.dailyMin) {
    return {
      level: 'low',
      title: '还差一点',
      detail: `${dayName}还差约 ${plan.dailyMin - todayTotalMl} ml 达到推荐量（${plan.stageLabel}：每日 ${plan.dailyMin}-${plan.dailyMax} ml）`,
    };
  }
  if (todayTotalMl > plan.dailyMax) {
    return {
      level: 'high',
      title: '略微偏多',
      detail: `比推荐上限多约 ${todayTotalMl - plan.dailyMax} ml，观察宝宝饱腹信号即可`,
    };
  }
  return {
    level: 'ok',
    title: '奶量达标',
    detail: '宝宝吃饱啦，继续保持',
  };
}

export function formatMl(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}L` : `${n}`;
}
