-- 0008_estimator_wizard_tables
-- Price estimator and service-finder wizard (plan section 5.3-D).
-- Row Level Security is switched ON here. With no policies yet, the public API
-- can read and write nothing. Policies and the clone/activate functions come
-- in 0009.
--
-- estimates.lead_id and estimates.session_id are plain uuid columns for now.
-- Their foreign keys are added when the leads and chat_sessions tables exist.
--
-- Old estimator versions are never deleted (rows that point at a service or a
-- version use ON DELETE RESTRICT), so past estimates stay explainable.

-- ------------------------------------------------------- estimator_versions
create table public.estimator_versions (
  id                uuid primary key default gen_random_uuid(),
  version           integer not null unique check (version > 0),
  status            text not null default 'draft'
                    check (status in ('draft', 'active', 'archived')),
  usd_to_bdt        numeric(10,4) not null check (usd_to_bdt > 0),
  bdt_multiplier    numeric(6,3)  not null default 1.0 check (bdt_multiplier > 0),
  rounding_step_usd integer       not null default 50 check (rounding_step_usd > 0),
  activated_at      timestamptz,
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint estimator_active_has_activated_at
    check (status <> 'active' or activated_at is not null)
);

-- Only one version can be active at a time.
create unique index estimator_versions_one_active
  on public.estimator_versions (status) where status = 'active';

create trigger estimator_versions_set_updated_at
  before update on public.estimator_versions
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------- estimator_service_rates
-- Base price range (USD) and delivery time for each service in a version.
create table public.estimator_service_rates (
  id         uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.estimator_versions (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  base_min   numeric(12,2) not null check (base_min >= 0),
  base_max   numeric(12,2) not null,
  weeks_min  integer       not null check (weeks_min >= 0),
  weeks_max  integer       not null,
  unique (version_id, service_id),
  constraint rates_price_range check (base_max >= base_min),
  constraint rates_weeks_range check (weeks_max >= weeks_min)
);

create index estimator_service_rates_service_idx
  on public.estimator_service_rates (service_id);

-- ------------------------------------------------------- estimator_factors
-- Things that change the price: complexity, urgency, add-ons, integrations,
-- and monthly support. service_id null = applies to every service.
create table public.estimator_factors (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references public.estimator_versions (id) on delete cascade,
  kind          text not null
                check (kind in ('complexity', 'urgency', 'addon', 'integration', 'support')),
  key           text not null,
  label_en      text not null,
  label_bn      text,
  service_id    uuid references public.services (id) on delete restrict,
  multiplier    numeric(6,3)  not null default 1 check (multiplier > 0),
  add_min       numeric(12,2) not null default 0 check (add_min >= 0),
  add_max       numeric(12,2) not null default 0,
  add_weeks_min integer       not null default 0 check (add_weeks_min >= 0),
  add_weeks_max integer       not null default 0,
  monthly_min   numeric(12,2) not null default 0 check (monthly_min >= 0),
  monthly_max   numeric(12,2) not null default 0,
  sort_order    integer       not null default 0,
  created_at    timestamptz   not null default now(),
  constraint factors_add_range    check (add_max >= add_min),
  constraint factors_weeks_range  check (add_weeks_max >= add_weeks_min),
  constraint factors_monthly_range check (monthly_max >= monthly_min),
  -- Support is a recurring monthly cost, not part of the project price.
  constraint factors_support_is_monthly check (
    kind <> 'support'
    or (add_min = 0 and add_max = 0 and add_weeks_min = 0 and add_weeks_max = 0)
  ),
  constraint factors_monthly_only_for_support check (
    kind = 'support' or (monthly_min = 0 and monthly_max = 0)
  )
);

-- One key per kind within a version (and per service, when it is service-specific).
create unique index estimator_factors_unique_key
  on public.estimator_factors (
    version_id, kind, key,
    coalesce(service_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- ---------------------------------------------------------------- estimates
-- Every estimate shown to anyone is saved, so "where did this number come from?"
-- can always be answered. Rows are never edited, so there is no updated_at.
create table public.estimates (
  id                      uuid primary key default gen_random_uuid(),
  version_id              uuid not null references public.estimator_versions (id) on delete restrict,
  service_id              uuid not null references public.services (id) on delete restrict,
  session_id              uuid,   -- foreign key added with chat_sessions (Phase 2)
  lead_id                 uuid,   -- foreign key added with leads (Phase 1.8)
  inputs                  jsonb not null default '{}'::jsonb,
  min_usd                 numeric(12,2) not null check (min_usd >= 0),
  max_usd                 numeric(12,2) not null,
  min_bdt                 numeric(14,2) not null check (min_bdt >= 0),
  max_bdt                 numeric(14,2) not null,
  weeks_min               integer not null check (weeks_min >= 0),
  weeks_max               integer not null,
  support_monthly_min_usd numeric(12,2) not null default 0 check (support_monthly_min_usd >= 0),
  support_monthly_max_usd numeric(12,2) not null default 0,
  created_at              timestamptz not null default now(),
  constraint estimates_usd_range     check (max_usd >= min_usd),
  constraint estimates_bdt_range     check (max_bdt >= min_bdt),
  constraint estimates_weeks_range   check (weeks_max >= weeks_min),
  constraint estimates_support_range check (support_monthly_max_usd >= support_monthly_min_usd)
);

create index estimates_service_idx on public.estimates (service_id);
create index estimates_lead_idx    on public.estimates (lead_id) where lead_id is not null;

-- ----------------------------------------------------------------- wizard
create table public.wizard_questions (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  text_en    text not null,
  text_bn    text,
  kind       text not null default 'single' check (kind in ('single', 'multi')),
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger wizard_questions_set_updated_at
  before update on public.wizard_questions
  for each row execute function app.set_updated_at();

create table public.wizard_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.wizard_questions (id) on delete cascade,
  label_en    text not null,
  label_bn    text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index wizard_options_question_idx on public.wizard_options (question_id);

-- Points each answer gives to each service. The wizard adds them up per
-- service and shows the top 3. No AI involved.
create table public.wizard_option_scores (
  option_id  uuid not null references public.wizard_options (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  weight     integer not null,
  primary key (option_id, service_id)
);

create index wizard_option_scores_service_idx on public.wizard_option_scores (service_id);

-- ------------------------------------------------------- Row Level Security
alter table public.estimator_versions      enable row level security;
alter table public.estimator_service_rates enable row level security;
alter table public.estimator_factors       enable row level security;
alter table public.estimates               enable row level security;
alter table public.wizard_questions        enable row level security;
alter table public.wizard_options          enable row level security;
alter table public.wizard_option_scores    enable row level security;