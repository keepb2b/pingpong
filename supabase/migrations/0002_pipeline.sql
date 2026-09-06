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
