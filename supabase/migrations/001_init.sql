-- ============================================================================
-- 闪电喂养记录器 — 数据库初始化迁移
-- 文件: 001_init.sql
-- 适用: Supabase (PostgreSQL 15+)
-- 执行: Supabase 控制台 → SQL Editor → 新建查询 → 粘贴本文件全文 → Run
--
-- 特性:
--   * 幂等：可重复执行不报错（表/索引用 IF NOT EXISTS，策略先 DROP 再建）
--   * RLS 全表启用：用户只能读写自己 user_id 的数据
--   * 中文注释，面向评审人可读
--
-- 表命名说明（契约单数 → 数据库复数，Supabase/PostgREST 惯例）:
--   Baby    → public.babies
--   Feeding → public.feedings
--   Diaper  → public.diapers
--   Sleep   → public.sleeps
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. 扩展
--    gen_random_uuid() 在 PG13+ 为内置函数（Supabase 默认可用），
--    这里显式装 pgcrypto 以兼容旧实例，IF NOT EXISTS 保证幂等。
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. 宝宝表（多胞胎支持：一个 user_id 可创建多条宝宝记录）
-- ----------------------------------------------------------------------------
create table if not exists public.babies (
  id         uuid primary key default gen_random_uuid(), -- 主键，自动生成
  user_id    uuid not null references auth.users (id) on delete cascade, -- 属主，级联删除
  name       text not null,                              -- 宝宝名字/昵称
  gender     text not null check (gender in ('male', 'female')), -- 性别，契约枚举
  birth_date date not null,                              -- 出生日期
  avatar     text not null,                              -- 头像（emoji 或图片 URL，前端负责生成）
  color      text not null,                              -- 主题色（多胞胎区分用）
  created_at timestamptz not null default now()          -- 创建时间
);

comment on table public.babies is '宝宝档案：一个用户（家庭）可添加多个宝宝，支持多胞胎';

-- ----------------------------------------------------------------------------
-- 2. 喂养记录表
-- ----------------------------------------------------------------------------
create table if not exists public.feedings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  baby_id    uuid not null references public.babies (id) on delete cascade, -- 删宝宝时连带删记录
  type       text not null check (type in ('breast', 'formula')), -- 母乳/配方奶
  amount_ml  integer not null check (amount_ml > 0),     -- 奶量(ml)，必须为正数
  fed_at     timestamptz not null,                       -- 喂养时间（用户可补录过去的时间）
  created_at timestamptz not null default now()
);

comment on table public.feedings is '喂养记录：按 baby_id 关联宝宝，按 fed_at 倒序查询';

-- ----------------------------------------------------------------------------
-- 3. 换尿布记录表
-- ----------------------------------------------------------------------------
create table if not exists public.diapers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  baby_id    uuid not null references public.babies (id) on delete cascade,
  type       text not null check (type in ('wet', 'solid', 'mixed')), -- 尿湿/便便/混合
  changed_at timestamptz not null,                       -- 更换时间
  created_at timestamptz not null default now()
);

comment on table public.diapers is '换尿布记录：按 baby_id 关联宝宝，按 changed_at 倒序查询';

-- ----------------------------------------------------------------------------
-- 4. 睡眠记录表
--    end_time 为 NULL 表示睡眠进行中（尚未结束）
--    duration_min 为 NULL 表示尚未结算；结束时由前端计算后写入
--    （契约明确标注这两列可空，其余列一律 NOT NULL）
-- ----------------------------------------------------------------------------
create table if not exists public.sleeps (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  baby_id      uuid not null references public.babies (id) on delete cascade,
  start_time   timestamptz not null,                     -- 入睡时间
  end_time     timestamptz null,                         -- 醒来时间（进行中为 NULL）
  duration_min integer null check (duration_min is null or duration_min > 0), -- 时长(分钟)
  created_at   timestamptz not null default now()
);

comment on table public.sleeps is '睡眠记录：进行中的睡眠 end_time/duration_min 为 NULL';

-- ============================================================================
-- 索引
--   * user_id   : RLS 过滤 + 按用户聚合查询
--   * baby_id+时间(DESC) : 核心查询路径——某宝宝的时间线按倒序分页
--     （btree 本身支持反向扫描，显式写 DESC 仅用于表达查询意图）
-- ============================================================================
create index if not exists idx_babies_user_id       on public.babies   (user_id);
create index if not exists idx_feedings_user_id     on public.feedings (user_id);
create index if not exists idx_feedings_baby_fed_at on public.feedings (baby_id, fed_at desc);
create index if not exists idx_diapers_user_id      on public.diapers  (user_id);
create index if not exists idx_diapers_baby_changed on public.diapers  (baby_id, changed_at desc);
create index if not exists idx_sleeps_user_id       on public.sleeps   (user_id);
create index if not exists idx_sleeps_baby_start    on public.sleeps   (baby_id, start_time desc);

-- ============================================================================
-- RLS（行级安全）—— 本项目的安全核心
--
-- 模型：每张表一条 FOR ALL 策略
--   USING (auth.uid() = user_id)      → 约束 SELECT / UPDATE / DELETE 的可见行
--   WITH CHECK (auth.uid() = user_id) → 约束 INSERT / UPDATE 写入的 user_id 必须是自己
--   TO authenticated                  → 仅登录用户可命中策略；匿名请求默认全部拒绝
--
-- 效果：即使 anon key 泄露，攻击者没有账号密码也读不到任何一行；
--      登录用户 A 无法读/写/篡改用户 B 的任何数据。
-- ============================================================================
alter table public.babies   enable row level security;
alter table public.feedings enable row level security;
alter table public.diapers  enable row level security;
alter table public.sleeps   enable row level security;

-- ---- babies：属主全权 ----
drop policy if exists "babies_owner_all" on public.babies;
create policy "babies_owner_all"
  on public.babies
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- feedings：属主全权 ----
drop policy if exists "feedings_owner_all" on public.feedings;
create policy "feedings_owner_all"
  on public.feedings
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- diapers：属主全权 ----
drop policy if exists "diapers_owner_all" on public.diapers;
create policy "diapers_owner_all"
  on public.diapers
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- sleeps：属主全权 ----
drop policy if exists "sleeps_owner_all" on public.sleeps;
create policy "sleeps_owner_all"
  on public.sleeps
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 关于 updated_at 触发器（任务标注"可选，简单为主"）：
-- 数据契约（冻结版）中没有 updated_at 字段。为保持与前端契约严格一致，
-- 本迁移不添加该字段和触发器。未来如需"最后修改时间"，
-- 请先同步更新前端契约，再新增迁移 002_xxx.sql，不要改动本文件。
-- ----------------------------------------------------------------------------
