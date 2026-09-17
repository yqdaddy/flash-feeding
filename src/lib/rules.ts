import type { Baby } from '../types';
import { monthAge } from './datetime';

export const DISCLAIMER = '仅供参考，不替代医嘱';

export interface FeedingPlan {
  perFeedMin: number;
  perFeedMax: number;
  timesMin: number;
  timesMax: number;
  dailyMin: number;
  dailyMax: number;
  stageLabel: string;
  solidsFirst: boolean;
}

interface PlanEntry {
  maxMonth: number;
  perFeed: [number, number];
  times: [number, number];
  label: string;
}

const PLANS: PlanEntry[] = [
  { maxMonth: 1, perFeed: [60, 90], times: [8, 12], label: '0-1个月' },
  { maxMonth: 2, perFeed: [90, 120], times: [7, 9], label: '1-2个月' },
  { maxMonth: 4, perFeed: [120, 150], times: [6, 8], label: '2-4个月' },
  { maxMonth: 6, perFeed: [150, 200], times: [5, 6], label: '4-6个月' },
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
      dailyMin: p.perFeed[0] * p.times[0],
      dailyMax: p.perFeed[1] * p.times[1],
      stageLabel: p.label,
      solidsFirst: false,
    };
  }
  return {
    perFeedMin: 0,
    perFeedMax: 0,
    timesMin: 0,
    timesMax: 0,
    dailyMin: 600,
    dailyMax: 800,
    stageLabel: '6个月以上',
    solidsFirst: true,
  };
}

export type AdviceLevel = 'empty' | 'low' | 'ok' | 'high';

export interface Advice {
  level: AdviceLevel;
  title: string;
  detail: string;
}

export function getFeedingAdvice(baby: Baby, todayTotalMl: number, todayCount: number): Advice {
  const plan = getPlan(baby);
  if (todayCount === 0) {
    return {
      level: 'empty',
      title: '今天还没有喂奶记录',
      detail: '第一顿奶后给你参考建议',
    };
  }
  if (plan.solidsFirst) {
    if (todayTotalMl < plan.dailyMin) {
      return {
        level: 'low',
        title: '奶量偏少',
        detail: `宝宝 6 月后以辅食为主，今日奶量还差约 ${plan.dailyMin - todayTotalMl} ml 到 ${plan.dailyMin}-${plan.dailyMax} ml 推荐区间`,
      };
    }
    if (todayTotalMl > plan.dailyMax) {
      return {
        level: 'high',
        title: '奶量偏多',
        detail: `今日奶量超出 ${plan.dailyMax} ml 推荐上限约 ${todayTotalMl - plan.dailyMax} ml，辅食为主即可`,
      };
    }
    return {
      level: 'ok',
      title: '今日奶量达标',
      detail: `在 ${plan.dailyMin}-${plan.dailyMax} ml 推荐区间内，继续保持`,
    };
  }
  if (todayTotalMl < plan.dailyMin) {
    return {
      level: 'low',
      title: '还差一点',
      detail: `今天还差约 ${plan.dailyMin - todayTotalMl} ml 达到推荐量（${plan.stageLabel}：每日 ${plan.dailyMin}-${plan.dailyMax} ml）`,
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
    title: '今日奶量达标',
    detail: '宝宝今天吃饱啦，继续保持',
  };
}

export function formatMl(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}L` : `${n}`;
}