export type Gender = 'male' | 'female';

export type AvatarKey = 'bear' | 'rabbit' | 'lion' | 'frog' | 'fox' | 'koala' | 'monkey' | 'penguin';

export interface Baby {
  id: string;
  user_id?: string;
  name: string;
  gender: Gender;
  birth_date: string;
  avatar: AvatarKey;
  color: string;
  created_at: string;
}

export type FeedingType = 'breast' | 'formula';

export interface Feeding {
  id: string;
  user_id?: string;
  baby_id: string;
  type: FeedingType;
  amount_ml: number;
  fed_at: string;
  created_at: string;
}

export type DiaperType = 'wet' | 'solid' | 'mixed';

export interface Diaper {
  id: string;
  user_id?: string;
  baby_id: string;
  type: DiaperType;
  changed_at: string;
  created_at: string;
}

export interface Sleep {
  id: string;
  user_id?: string;
  baby_id: string;
  start_time: string;
  end_time: string | null;
  duration_min: number | null;
  created_at: string;
}

export interface CloudData {
  babies: Baby[];
  feedings: Feeding[];
  diapers: Diaper[];
  sleeps: Sleep[];
}

export type RecordKind = 'feeding' | 'diaper' | 'sleep';