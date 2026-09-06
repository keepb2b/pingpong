-- ============================================================================
-- AI広報 (AI Koho) — Core schema
-- Run this in the Supabase SQL editor (or `npm run db:push` with DATABASE_URL).
-- ============================================================================
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------- enums ----
do $$ begin
  create type member_role as enum ('owner','admin','editor','legal','brand','approver','viewer');
exception when duplicate_object then null; end $$;
do $$ begin
  create type subject_type as enum ('company','service','product','brand','store','person');
exception when duplicate_object then null; end $$;
do $$ begin
  create type pr_goal as enum ('awareness','traffic','inquiry','booking_purchase','recruiting','seo_aeo','brand','media','reputation');
exception when duplicate_object then null; end $$;
do $$ begin
  create type channel_type as enum ('x','instagram','facebook','gbp','wordpress','line','email','press','site');
exception when duplicate_object then null; end $$;
do $$ begin
  create type content_type as enum ('seo_article','news','case_study','faq','sns_post','gbp_post','press_release','media_pitch','lp_improvement','recruiting','headline','email');
exception when duplicate_object then null; end $$;
do $$ begin
  create type content_status as enum ('draft','fact_check','pending_approval','approved','scheduled','published','rejected','on_hold','failed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type approval_action as enum ('approve','revise','hold','reject','comment');
exception when duplicate_object then null; end $$;
do $$ begin
  create type fact_status as enum ('confirmed','planned','hypothesis');
exception when duplicate_object then null; end $$;
do $$ begin
  create type fact_visibility as enum ('public','internal');
exception when duplicate_object then null; end $$;
do $$ begin
  create type risk_level as enum ('none','low','medium','high','critical');
exception when duplicate_object then null; end $$;
do $$ begin
  create type dialogue_frequency as enum ('daily','five_per_week','three_per_week','weekly','custom_days','on_demand','paused');
exception when duplicate_object then null; end $$;
do $$ begin
  create type post_frequency_mode as enum ('ai_auto','daily','weekly_n','monthly_n','on_demand','never');
exception when duplicate_object then null; end $$;
do $$ begin
  create type learning_status as enum ('pending','confirmed','corrected','once_only','long_term','forgotten');
exception when duplicate_object then null; end $$;
do $$ begin
  create type mention_source as enum ('x','instagram','facebook','google_review','line','email','web');
exception when duplicate_object then null; end $$;
do $$ begin
  create type sentiment as enum ('positive','neutral','negative');
exception when duplicate_object then null; end $$;
do $$ begin
  create type crisis_status as enum ('open','containing','resolved','closed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type ai_agent as enum ('secretary','strategist','writer','marketer','analyst','creator');
exception when duplicate_object then null; end $$;
do $$ begin
  create type intake_kind as enum ('event','achievement','new_service','customer_voice','photo','document','number','other');
exception when duplicate_object then null; end $$;
do $$ begin
  create type plan_status as enum ('trialing','active','past_due','canceled','incomplete','unpaid','none');
exception when duplicate_object then null; end $$;
do $$ begin
  create type conversion_type as enum ('view','read','cta_click','line_register','call','inquiry','doc_request','signup','booking','purchase','meeting','contract','visit','coupon');
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------- tenancy ---
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  industry text,
  website text,
  timezone text not null default 'Asia/Tokyo',
  locale text not null default 'ja',
  onboarding_step int not null default 0,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  line_user_id text unique,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null default 'editor',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index if not exists memberships_user_idx on memberships(user_id);

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role member_role not null default 'editor',
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------ 広報対象 subjects ---
create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  type subject_type not null default 'company',
  description text,
  website text,
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subjects_org_idx on subjects(org_id);

-- ------------------------------------------------------- AI広報カルテ ------
create table if not exists karte_sections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  key text not null,
  label text not null,
  content text,
  data jsonb not null default '{}'::jsonb,
  confidence numeric(4,3) not null default 0.5,
  source text not null default 'user',
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, key)
);
create index if not exists karte_org_idx on karte_sections(org_id);

create table if not exists brand_voice (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null unique references subjects(id) on delete cascade,
  persona text,
  tone text[] not null default '{}',
  first_person text,
  sentence_ending text,
  preferred_words text[] not null default '{}',
  banned_words text[] not null default '{}',
  banned_expressions text[] not null default '{}',
  emoji_policy text not null default 'minimal',
  reading_level text not null default 'business',
  sample_text text,
  updated_at timestamptz not null default now()
);

create table if not exists personas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  name text not null,
  segment text,
  age_range text,
  role text,
  pains text[] not null default '{}',
  gains text[] not null default '{}',
  channels channel_type[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists competitors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  name text not null,
  website text,
  positioning text,
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  watch_urls text[] not null default '{}',
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

-- --------------------------------------------- 公式事実データベース --------
create table if not exists official_facts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  category text not null,
  key text not null,
  value text not null,
  numeric_value numeric,
  unit text,
  status fact_status not null default 'confirmed',
  visibility fact_visibility not null default 'public',
  source text,
  source_url text,
  published_on date,
  verified_at timestamptz,
  expires_at timestamptz,
  approved_by uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists facts_subject_idx on official_facts(subject_id, category);
create index if not exists facts_key_trgm on official_facts using gin (key gin_trgm_ops);

-- ---------------------------------------------------- 目標 / KPI / 戦略 ----
create table if not exists pr_objectives (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  goal pr_goal not null,
  priority int not null default 1,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists kpis (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  name text not null,
  metric text not null,
  target_value numeric not null default 0,
  current_value numeric not null default 0,
  unit text,
  period text not null default 'month',
  period_start date,
  period_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists strategies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  period text not null,
  title text not null,
  summary text,
  goals jsonb not null default '[]'::jsonb,
  themes jsonb not null default '[]'::jsonb,
  channel_plan jsonb not null default '{}'::jsonb,
  calendar jsonb not null default '[]'::jsonb,
  kpi_plan jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  created_by ai_agent not null default 'strategist',
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  strategy_id uuid references strategies(id) on delete set null,
  name text not null,
  hypothesis text,
  goal pr_goal,
  starts_on date,
  ends_on date,
  status text not null default 'planned',
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------- 媒体 / 頻度 / 連携 ------
create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  type channel_type not null,
  handle text,
  display_name text,
  connected boolean not null default false,
  credentials jsonb not null default '{}'::jsonb,
  frequency_mode post_frequency_mode not null default 'ai_auto',
  frequency_count int,
  preferred_days int[] not null default '{}',
  preferred_hours int[] not null default '{}',
  auto_publish boolean not null default false,
  auto_publish_max_risk risk_level not null default 'low',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, type)
);

create table if not exists dialogue_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null unique references subjects(id) on delete cascade,
  frequency dialogue_frequency not null default 'daily',
  custom_days int[] not null default '{}',
  send_hour int not null default 9,
  max_questions_per_session int not null default 5,
  paused_until date,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------- LINE 対話 / AI取材 / 素材 -----
create table if not exists line_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  line_user_id text not null unique,
  display_name text,
  picture_url text,
  user_id uuid references auth.users(id) on delete set null,
  active_subject_id uuid references subjects(id) on delete set null,
  linked_at timestamptz not null default now()
);

create table if not exists link_codes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  code text not null unique,
  created_by uuid references auth.users(id),
  used_by_line_user_id text,
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '3 days'),
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  line_user_id text,
  channel text not null default 'line',
  topic text,
  state jsonb not null default '{}'::jsonb,
  pending_question text,
  question_index int not null default 0,
  status text not null default 'open',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists conversations_line_idx on conversations(line_user_id, status);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null,
  agent ai_agent,
  content text,
  attachments jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on messages(conversation_id, created_at);

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  kind text not null default 'image',
  storage_path text,
  url text,
  mime_type text,
  width int,
  height int,
  bytes bigint,
  caption text,
  alt_text text,
  tags text[] not null default '{}',
  rights_cleared boolean not null default false,
  source text not null default 'line',
  created_at timestamptz not null default now()
);

create table if not exists intake_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  kind intake_kind not null default 'event',
  title text not null,
  raw_text text,
  structured jsonb not null default '{}'::jsonb,
  asset_ids uuid[] not null default '{}',
  newsworthiness int not null default 0,
  disclosable boolean not null default true,
  used_count int not null default 0,
  status text not null default 'new',
  occurred_on date,
  created_at timestamptz not null default now()
);
create index if not exists intake_subject_idx on intake_items(subject_id, status);
