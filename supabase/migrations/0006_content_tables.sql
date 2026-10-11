-- 0006_content_tables
-- Public content: settings, services, FAQs, portfolio, blog, reviews
-- (plan section 5.3-C).
-- Row Level Security is switched ON here. With no policies yet, the public API
-- can read and write nothing. Policies arrive in 0007.
--
-- Bilingual content uses paired columns (_en / _bn). English is required to
-- publish; Bangla is optional.
--
-- portfolio_items.project_id and reviews.client_id / project_id are plain
-- uuid columns for now. Their foreign keys are added in the Phase 3 migration
-- that creates the clients and projects tables.

-- ------------------------------------------------------------- site_settings
create table public.site_settings (
  key        text primary key,
  value      jsonb not null,
  is_public  boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function app.set_updated_at();

-- ------------------------------------------------------------------ services
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique
                   check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en          text not null,
  name_bn          text,
  summary_en       text,
  summary_bn       text,
  body_en          text,
  body_bn          text,
  icon             text,
  pricing_model    text not null default 'custom'
                   check (pricing_model in ('fixed', 'hourly', 'retainer', 'custom')),
  starting_from_usd numeric(12,2) check (starting_from_usd >= 0),
  sort_order       integer not null default 0,
  is_published     boolean not null default false,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint services_publish_needs_english check (
    not is_published
    or (nullif(btrim(summary_en), '') is not null
        and nullif(btrim(body_en), '') is not null)
  )
);

create trigger services_set_updated_at
  before update on public.services
  for each row execute function app.set_updated_at();

-- --------------------------------------------------------------------- faqs
-- service_id null = a general FAQ.
create table public.faqs (
  id           uuid primary key default gen_random_uuid(),
  service_id   uuid references public.services (id) on delete cascade,
  question_en  text not null,
  question_bn  text,
  answer_en    text not null,
  answer_bn    text,
  sort_order   integer not null default 0,
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index faqs_service_id_idx on public.faqs (service_id);

create trigger faqs_set_updated_at
  before update on public.faqs
  for each row execute function app.set_updated_at();

-- ----------------------------------------------------------- portfolio_items
create table public.portfolio_items (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique
                     check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_en           text not null,
  title_bn           text,
  summary_en         text,
  summary_bn         text,
  challenge_en       text,
  challenge_bn       text,
  solution_en        text,
  solution_bn        text,
  result_en          text,
  result_bn          text,
  cover_path         text,
  live_url           text,
  tech_stack         text[] not null default '{}',
  public_client_name text,
  client_consent     boolean not null default false,
  project_id         uuid,   -- internal link only; foreign key added in Phase 3
  completed_on       date,
  is_featured        boolean not null default false,
  is_published       boolean not null default false,
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- A case study can only go public if the client agreed.
  constraint portfolio_publish_needs_consent check (not is_published or client_consent),
  constraint portfolio_publish_needs_english check (
    not is_published or nullif(btrim(summary_en), '') is not null
  )
);

create trigger portfolio_items_set_updated_at
  before update on public.portfolio_items
  for each row execute function app.set_updated_at();

create table public.portfolio_services (
  portfolio_item_id uuid not null references public.portfolio_items (id) on delete cascade,
  service_id        uuid not null references public.services (id) on delete cascade,
  primary key (portfolio_item_id, service_id)
);

create index portfolio_services_service_id_idx on public.portfolio_services (service_id);

create table public.portfolio_media (
  id                uuid primary key default gen_random_uuid(),
  portfolio_item_id uuid not null references public.portfolio_items (id) on delete cascade,
  storage_path      text not null,
  alt_en            text,
  alt_bn            text,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now()
);

create index portfolio_media_item_idx on public.portfolio_media (portfolio_item_id);

-- --------------------------------------------------------------- blog_posts
create table public.blog_posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique
               check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_en     text,
  title_bn     text,
  excerpt_en   text,
  excerpt_bn   text,
  body_en      text,
  body_bn      text,
  cover_path   text,
  tags         text[] not null default '{}',
  author_id    uuid references public.profiles (id) on delete set null,
  status       text not null default 'draft'
               check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  seo          jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint blog_publish_needs_english check (
    status <> 'published'
    or (nullif(btrim(title_en), '') is not null
        and nullif(btrim(body_en), '') is not null)
  )
);

create index blog_posts_status_published_idx on public.blog_posts (status, published_at desc);

create trigger blog_posts_set_updated_at
  before update on public.blog_posts
  for each row execute function app.set_updated_at();

-- ------------------------------------------------------------------ reviews
create table public.reviews (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid,   -- foreign key added in Phase 3
  project_id     uuid,   -- foreign key added in Phase 3
  reviewer_name  text not null,
  reviewer_title text,
  rating         smallint not null check (rating between 1 and 5),
  body           text not null,
  locale         text not null default 'en' check (locale in ('en', 'bn')),
  source         text not null default 'manual'
                 check (source in ('portal', 'manual', 'fiverr', 'other')),
  source_url     text,
  status         text not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected')),
  moderated_by   uuid references auth.users (id) on delete set null,
  moderated_at   timestamptz,
  is_featured    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One portal review per project.
create unique index reviews_one_portal_review_per_project
  on public.reviews (project_id) where source = 'portal';

create index reviews_status_idx on public.reviews (status);

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function app.set_updated_at();

create trigger reviews_audit
  after insert or update or delete on public.reviews
  for each row execute function app.audit_row_change();

-- ------------------------------------------------------- Row Level Security
alter table public.site_settings     enable row level security;
alter table public.services          enable row level security;
alter table public.faqs              enable row level security;
alter table public.portfolio_items   enable row level security;
alter table public.portfolio_services enable row level security;
alter table public.portfolio_media   enable row level security;
alter table public.blog_posts        enable row level security;
alter table public.reviews           enable row level security;