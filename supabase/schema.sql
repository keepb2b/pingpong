-- ============================================================
-- AI広報 — 全スキーマ (Supabase SQL editor にそのまま貼り付け)
-- generated from supabase/migrations/*.sql
-- ============================================================


-- >>>>>>>>>>>> 0001_init.sql <<<<<<<<<<<<

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


-- >>>>>>>>>>>> 0002_pipeline.sql <<<<<<<<<<<<

-- ============================================================================
-- AI広報 — Content pipeline, analytics, reputation, crisis, billing
-- ============================================================================

-- ------------------------------------------------ 提案 / コンテンツ制作 ----
-- AIが「今日何を発信すべきか」を提案する単位
create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  strategy_id uuid references strategies(id) on delete set null,
  intake_item_id uuid references intake_items(id) on delete set null,
  theme text not null,
  reason text not null,
  goal pr_goal,
  audience text,
  channels channel_type[] not null default '{}',
  cta text,
  scheduled_for timestamptz,
  expected_effect text,
  cautions text,
  score int not null default 0,
  status text not null default 'proposed',
  decided_at timestamptz,
  decided_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists proposals_subject_idx on proposals(subject_id, status);

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  proposal_id uuid references proposals(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete set null,
  type content_type not null,
  title text not null,
  body text,
  summary text,
  keywords text[] not null default '{}',
  cta text,
  cta_url text,
  goal pr_goal,
  status content_status not null default 'draft',
  risk risk_level not null default 'none',
  version int not null default 1,
  model text,
  created_by ai_agent not null default 'writer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_subject_idx on content_items(subject_id, status);

-- 媒体別に最適化した派生コンテンツ
create table if not exists content_variants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  content_id uuid not null references content_items(id) on delete cascade,
  channel channel_type not null,
  body text not null,
  hashtags text[] not null default '{}',
  cta text,
  char_count int,
  asset_ids uuid[] not null default '{}',
  optimized_for text,
  ab_group text,
  created_at timestamptz not null default now()
);
create index if not exists variants_content_idx on content_variants(content_id);

-- AIクリエイターが生成したビジュアル
create table if not exists creatives (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  content_id uuid references content_items(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  kind text not null default 'sns_image',
  channel channel_type,
  width int,
  height int,
  prompt text,
  svg text,
  storage_path text,
  url text,
  palette jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

-- ------------------------------------------- ファクトチェック / リスク -----
create table if not exists risk_checks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  content_id uuid not null references content_items(id) on delete cascade,
  overall risk_level not null default 'none',
  passed boolean not null default false,
  findings jsonb not null default '[]'::jsonb,
  unverified_claims jsonb not null default '[]'::jsonb,
  blocked boolean not null default false,
  checked_by ai_agent not null default 'analyst',
  model text,
  created_at timestamptz not null default now()
);
create index if not exists risk_content_idx on risk_checks(content_id);

-- ------------------------------------------------------------ 承認 --------
create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  content_id uuid references content_items(id) on delete cascade,
  proposal_id uuid references proposals(id) on delete cascade,
  required_role member_role,
  action approval_action,
  comment text,
  acted_by uuid references auth.users(id),
  acted_via text not null default 'dashboard',
  acted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists approval_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  content_type content_type,
  channel channel_type,
  min_risk risk_level not null default 'none',
  required_roles member_role[] not null default '{approver}',
  auto_approve boolean not null default false,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------- 投稿 / 配信 ----
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  content_id uuid references content_items(id) on delete set null,
  variant_id uuid references content_variants(id) on delete set null,
  channel_id uuid references channels(id) on delete set null,
  channel channel_type not null,
  body text not null,
  asset_urls text[] not null default '{}',
  scheduled_for timestamptz,
  published_at timestamptz,
  external_id text,
  external_url text,
  status content_status not null default 'scheduled',
  error text,
  created_at timestamptz not null default now()
);
create index if not exists posts_schedule_idx on posts(status, scheduled_for);

-- --------------------------------------- 計測 (専用リンク → 売上まで) -----
create table if not exists tracking_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  content_id uuid references content_items(id) on delete cascade,
  post_id uuid references posts(id) on delete cascade,
  code text not null unique,
  target_url text not null,
  channel channel_type,
  utm jsonb not null default '{}'::jsonb,
  clicks int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists link_events (
  id bigserial primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  link_id uuid not null references tracking_links(id) on delete cascade,
  visitor_id text,
  referrer text,
  user_agent text,
  country text,
  created_at timestamptz not null default now()
);
create index if not exists link_events_link_idx on link_events(link_id, created_at);

create table if not exists conversions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  type conversion_type not null,
  visitor_id text,
  link_id uuid references tracking_links(id) on delete set null,
  content_id uuid references content_items(id) on delete set null,
  post_id uuid references posts(id) on delete set null,
  channel channel_type,
  amount numeric,
  currency text not null default 'JPY',
  meta jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists conversions_subject_idx on conversions(subject_id, occurred_at);
create index if not exists conversions_visitor_idx on conversions(visitor_id);

-- 顧客導線 (first / mid / last touch)
create table if not exists touchpoints (
  id bigserial primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  visitor_id text not null,
  content_id uuid references content_items(id) on delete set null,
  post_id uuid references posts(id) on delete set null,
  channel channel_type,
  position text not null default 'mid',
  occurred_at timestamptz not null default now()
);
create index if not exists touchpoints_visitor_idx on touchpoints(visitor_id, occurred_at);

-- 媒体側の指標 (リーチ/エンゲージメント/PV)
create table if not exists metrics_daily (
  id bigserial primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  post_id uuid references posts(id) on delete cascade,
  content_id uuid references content_items(id) on delete cascade,
  channel channel_type,
  day date not null,
  impressions int not null default 0,
  reach int not null default 0,
  engagements int not null default 0,
  clicks int not null default 0,
  pageviews int not null default 0,
  avg_time_sec int not null default 0,
  search_clicks int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists metrics_daily_idx on metrics_daily(subject_id, day, channel);

-- ------------------------------------------------------- AI広報スコア -----
create table if not exists pr_scores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  period text not null,
  total int not null default 0,
  foundation int not null default 0,
  consistency int not null default 0,
  quality int not null default 0,
  brand_fit int not null default 0,
  seo_aeo int not null default 0,
  sns_reach int not null default 0,
  funnel int not null default 0,
  cv_revenue int not null default 0,
  reputation int not null default 0,
  risk_mgmt int not null default 0,
  rationale jsonb not null default '{}'::jsonb,
  improvements jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (subject_id, period)
);

-- ---------------------------------------------------- 月次AI広報会議 ------
create table if not exists monthly_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  period text not null,
  activities jsonb not null default '[]'::jsonb,
  kpi_status jsonb not null default '[]'::jsonb,
  top_content jsonb not null default '[]'::jsonb,
  wins jsonb not null default '[]'::jsonb,
  losses jsonb not null default '[]'::jsonb,
  funnel_issues jsonb not null default '[]'::jsonb,
  market_changes jsonb not null default '[]'::jsonb,
  learnings jsonb not null default '[]'::jsonb,
  next_strategy jsonb not null default '{}'::jsonb,
  recommended_campaigns jsonb not null default '[]'::jsonb,
  needed_materials jsonb not null default '[]'::jsonb,
  expected_impact text,
  summary text,
  status text not null default 'draft',
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (subject_id, period)
);

-- ------------------------------------- コメント / 口コミ / 評判管理 -------
create table if not exists mentions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  source mention_source not null,
  external_id text,
  author text,
  body text not null,
  rating int,
  url text,
  sentiment sentiment not null default 'neutral',
  urgency int not null default 1,
  flare_risk risk_level not null default 'none',
  needs_human boolean not null default false,
  status text not null default 'new',
  reply_due_at timestamptz,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists mentions_subject_idx on mentions(subject_id, status);

create table if not exists mention_replies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  mention_id uuid not null references mentions(id) on delete cascade,
  draft text not null,
  approved boolean not null default false,
  sent_at timestamptz,
  acted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------ 危機広報 ----
create table if not exists crisis_incidents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  title text not null,
  category text not null default 'other',
  severity risk_level not null default 'high',
  status crisis_status not null default 'open',
  facts jsonb not null default '[]'::jsonb,
  statement text,
  apology text,
  qa jsonb not null default '[]'::jsonb,
  sns_policy text,
  notices jsonb not null default '{}'::jsonb,
  posts_paused boolean not null default true,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  resumed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists crisis_actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  incident_id uuid not null references crisis_incidents(id) on delete cascade,
  action text not null,
  detail text,
  actor text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------- メディアリレーション ---
create table if not exists media_outlets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  category text,
  region text,
  contact_name text,
  contact_email text,
  url text,
  fit_score int not null default 0,
  notes text,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists media_pitches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  outlet_id uuid references media_outlets(id) on delete set null,
  content_id uuid references content_items(id) on delete set null,
  subject_line text not null,
  body text not null,
  status text not null default 'draft',
  sent_at timestamptz,
  replied_at timestamptz,
  coverage_url text,
  created_at timestamptz not null default now()
);

-- --------------------------------------- 競合 / 市場 / トレンド監視 -------
create table if not exists market_signals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  kind text not null,
  title text not null,
  detail text,
  url text,
  importance int not null default 1,
  competitor_id uuid references competitors(id) on delete set null,
  notified boolean not null default false,
  acted boolean not null default false,
  detected_at timestamptz not null default now()
);
create index if not exists signals_subject_idx on market_signals(subject_id, detected_at);

-- --------------------------------------------------------- AI学習内容 -----
create table if not exists learnings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  category text not null default 'preference',
  statement text not null,
  evidence text,
  status learning_status not null default 'pending',
  weight numeric(4,3) not null default 0.5,
  corrected_to text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists learnings_subject_idx on learnings(subject_id, status);

-- ------------------------------------------------------ AI実行ログ --------
create table if not exists ai_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  agent ai_agent not null,
  task text not null,
  model text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  cost_usd numeric(10,6) not null default 0,
  duration_ms int not null default 0,
  ok boolean not null default true,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists ai_runs_org_idx on ai_runs(org_id, created_at);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text,
  link text,
  agent ai_agent,
  read_at timestamptz,
  sent_to_line boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_org_idx on notifications(org_id, created_at);

create table if not exists audit_logs (
  id bigserial primary key,
  org_id uuid references organizations(id) on delete cascade,
  actor uuid references auth.users(id),
  actor_kind text not null default 'user',
  action text not null,
  entity text,
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------- 課金 -------
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references organizations(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status plan_status not null default 'none',
  setup_fee_paid boolean not null default false,
  extra_subjects int not null default 0,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  stripe_event_id text unique,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------- updated_at -----
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','subjects','karte_sections','official_facts','kpis',
    'channels','content_items','subscriptions'
  ] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated on %1$s;
       create trigger trg_%1$s_updated before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end $$;


-- >>>>>>>>>>>> 0003_rls.sql <<<<<<<<<<<<

-- ============================================================================
-- AI広報 — RLS, helper functions, triggers, storage
-- ============================================================================

-- ------------------------------------------------------------ helpers -----
create or replace function public.is_org_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.org_id = target and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(target uuid, roles member_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.org_id = target and m.user_id = auth.uid() and m.role = any(roles)
  );
$$;

create or replace function public.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from memberships where user_id = auth.uid();
$$;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, member_role[]) to authenticated;
grant execute on function public.my_org_ids() to authenticated;

-- ---------------------------------------------- profile bootstrap ---------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------- generic org-scoped RLS policies ---
-- Every table carrying an org_id is readable/writable by members of that org.
do $$
declare
  t record;
begin
  for t in
    select c.relname as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'org_id'
      and a.attnum > 0 and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', t.tbl);
    execute format('drop policy if exists org_read on public.%I', t.tbl);
    execute format('drop policy if exists org_write on public.%I', t.tbl);
    execute format(
      'create policy org_read on public.%I for select to authenticated
         using (org_id is not null and public.is_org_member(org_id))', t.tbl);
    execute format(
      'create policy org_write on public.%I for all to authenticated
         using (org_id is not null and public.is_org_member(org_id))
         with check (org_id is not null and public.is_org_member(org_id))', t.tbl);
  end loop;
end $$;

-- ------------------------------------------------------ special tables ----
alter table organizations enable row level security;
drop policy if exists org_self_read on organizations;
create policy org_self_read on organizations for select to authenticated
  using (public.is_org_member(id));
drop policy if exists org_self_update on organizations;
create policy org_self_update on organizations for update to authenticated
  using (public.has_org_role(id, array['owner','admin']::member_role[]))
  with check (public.has_org_role(id, array['owner','admin']::member_role[]));
drop policy if exists org_insert on organizations;
create policy org_insert on organizations for insert to authenticated with check (true);

alter table profiles enable row level security;
drop policy if exists profile_self on profiles;
create policy profile_self on profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profile_org_read on profiles;
create policy profile_org_read on profiles for select to authenticated
  using (exists (
    select 1 from memberships m1
    join memberships m2 on m1.org_id = m2.org_id
    where m1.user_id = auth.uid() and m2.user_id = profiles.id
  ));

alter table memberships enable row level security;
drop policy if exists membership_read on memberships;
create policy membership_read on memberships for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(org_id));
drop policy if exists membership_manage on memberships;
create policy membership_manage on memberships for all to authenticated
  using (public.has_org_role(org_id, array['owner','admin']::member_role[]))
  with check (public.has_org_role(org_id, array['owner','admin']::member_role[]));
drop policy if exists membership_bootstrap on memberships;
create policy membership_bootstrap on memberships for insert to authenticated
  with check (user_id = auth.uid());

-- ------------------------------------------------------------- storage ----
insert into storage.buckets (id, name, public)
values ('pr-media', 'pr-media', true)
on conflict (id) do nothing;

drop policy if exists pr_media_read on storage.objects;
create policy pr_media_read on storage.objects for select
  using (bucket_id = 'pr-media');

drop policy if exists pr_media_write on storage.objects;
create policy pr_media_write on storage.objects for insert to authenticated
  with check (bucket_id = 'pr-media');

drop policy if exists pr_media_update on storage.objects;
create policy pr_media_update on storage.objects for update to authenticated
  using (bucket_id = 'pr-media');

-- ------------------------------------------- analytics helper functions ---
-- 顧客導線: 初回接触 / 中間 / 最終接触を集計して貢献度を返す
create or replace function public.attribution_summary(p_subject uuid, p_from timestamptz, p_to timestamptz)
returns table (
  content_id uuid,
  title text,
  first_touch int,
  mid_touch int,
  last_touch int,
  conversions int,
  revenue numeric
)
language sql
stable
security definer
set search_path = public
as $$
  -- 成果を出した訪問者を1人1行に畳んでから接触履歴と突き合わせる。
  -- (畳まずに join すると、接触 × 成果 の掛け算で件数が水増しされる)
  with conv as (
    select distinct on (c.visitor_id)
      c.visitor_id,
      coalesce(c.amount, 0) as amount
    from conversions c
    where c.subject_id = p_subject
      and c.occurred_at between p_from and p_to
      and c.visitor_id is not null
      and c.type in ('inquiry','booking','purchase','contract','doc_request','line_register')
    order by c.visitor_id, c.occurred_at desc
  ),
  tp as (
    select distinct t.visitor_id, t.content_id, t.position
    from touchpoints t
    join conv on conv.visitor_id = t.visitor_id
    where t.content_id is not null
  )
  select
    ci.id,
    ci.title,
    (count(*) filter (where tp.position = 'first'))::int,
    (count(*) filter (where tp.position = 'mid'))::int,
    (count(*) filter (where tp.position = 'last'))::int,
    (count(distinct tp.visitor_id))::int,
    -- 売上は「最後に行動を起こした接触」に帰属させ、二重計上を避ける
    coalesce(sum(conv.amount) filter (where tp.position = 'last'), 0)
  from tp
  join content_items ci on ci.id = tp.content_id
  join conv on conv.visitor_id = tp.visitor_id
  group by ci.id, ci.title
  order by 6 desc, 7 desc;
$$;

grant execute on function public.attribution_summary(uuid, timestamptz, timestamptz) to authenticated;

-- クリック数のアトミックな加算
create or replace function public.increment_link_click(p_code text)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update tracking_links set clicks = clicks + 1 where code = p_code;
$$;
grant execute on function public.increment_link_click(text) to anon, authenticated;


-- >>>>>>>>>>>> 0004_accounts_admin.sql <<<<<<<<<<<<

-- ============================================================================
-- AI広報 — アカウント情報 / 運営管理者 / アバター
-- ============================================================================

-- ------------------------------------------------------- プロフィール拡張 --
alter table profiles add column if not exists is_platform_admin boolean not null default false;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists company_name text;
alter table profiles add column if not exists department text;
alter table profiles add column if not exists job_title text;
alter table profiles add column if not exists bio text;
alter table profiles add column if not exists locale text not null default 'ja';
alter table profiles add column if not exists last_seen_at timestamptz;
alter table profiles add column if not exists updated_at timestamptz not null default now();

create index if not exists profiles_admin_idx on profiles(is_platform_admin) where is_platform_admin;

-- 運営管理者かどうか (RLSの再帰を避けるため security definer)
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_platform_admin from profiles p where p.id = auth.uid()),
    false
  );
$$;
grant execute on function public.is_platform_admin() to authenticated;

-- 運営管理者は全ユーザーを閲覧できる
drop policy if exists profile_platform_admin on profiles;
create policy profile_platform_admin on profiles for select to authenticated
  using (public.is_platform_admin());

-- 最終ログイン日時の記録
create or replace function public.touch_last_seen()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update profiles set last_seen_at = now() where id = auth.uid();
$$;
grant execute on function public.touch_last_seen() to authenticated;

-- --------------------------------------------------------- アバター保管 ----
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');

-- 自分のフォルダ (<uid>/...) にのみ書き込める
-- foldername() は環境によって空になるため split_part を使う
drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- 未認証でも登録時にアバターを上げられるようにする (サインアップ画面用)
-- 認証前は uid が無いため、一時フォルダ pending/ のみ許可する
drop policy if exists avatars_signup_write on storage.objects;
create policy avatars_signup_write on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = 'pending'
  );

-- --------------------------------------------- 運営管理者向けの横断ビュー --
-- 管理画面は service role 経由で読むが、SQLからも確認できるようにしておく
create or replace view public.admin_user_overview as
select
  p.id                                as user_id,
  p.email,
  p.display_name,
  p.avatar_url,
  p.company_name,
  p.phone,
  p.is_platform_admin,
  p.last_seen_at,
  p.created_at                        as registered_at,
  m.role                              as org_role,
  o.id                                as org_id,
  o.name                              as org_name,
  o.industry,
  o.onboarded_at,
  s.status                            as plan_status,
  s.setup_fee_paid,
  s.extra_subjects,
  s.current_period_end,
  (select count(*) from subjects sj where sj.org_id = o.id and sj.active) as subject_count,
  (select count(*) from content_items ci where ci.org_id = o.id)          as content_count,
  (select count(*) from posts po where po.org_id = o.id and po.status = 'published') as published_count,
  (select coalesce(sum(cv.amount), 0) from conversions cv where cv.org_id = o.id)    as revenue_total
from profiles p
left join memberships m on m.user_id = p.id
left join organizations o on o.id = m.org_id
left join subscriptions s on s.org_id = o.id;

-- ビューは呼び出し元の権限で評価される (security_invoker) ため、
-- 運営管理者以外は profiles のRLSにより自分の行しか見えない。
alter view public.admin_user_overview set (security_invoker = on);
grant select on public.admin_user_overview to authenticated;

-- --------------------------------------------------------- 決済履歴 -------
-- Stripe から取得した支払いを保持し、管理画面でリアルタイムに集計する
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete set null,
  stripe_payment_intent_id text unique,
  stripe_invoice_id text,
  stripe_customer_id text,
  amount bigint not null default 0,
  currency text not null default 'jpy',
  status text not null default 'succeeded',
  description text,
  receipt_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payments_org_idx on payments(org_id, paid_at);
create index if not exists payments_paid_idx on payments(paid_at);

alter table payments enable row level security;
drop policy if exists payments_org_read on payments;
create policy payments_org_read on payments for select to authenticated
  using (org_id is not null and public.is_org_member(org_id));
drop policy if exists payments_admin_read on payments;
create policy payments_admin_read on payments for select to authenticated
  using (public.is_platform_admin());

-- updated_at トリガー
drop trigger if exists trg_profiles_updated on profiles;
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- 確認メールなしで Auth ユーザーを確定する（SMTP 未設定対策）
create or replace function public.confirm_user_email(uid uuid)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  update auth.users
  set
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    confirmation_token = '',
    confirmation_sent_at = null
  where id = uid;
end;
$$;
revoke all on function public.confirm_user_email(uuid) from public, anon, authenticated;
grant execute on function public.confirm_user_email(uuid) to service_role;

