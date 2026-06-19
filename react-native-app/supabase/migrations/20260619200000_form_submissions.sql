-- Submission tables for Make a Post and Practitioner Application flows.
-- Both are reviewed manually; status updated via Supabase dashboard or admin API.

create table public.post_submissions (
  id            uuid primary key default gen_random_uuid(),
  post_url      text not null,
  platform      text,
  description   text,
  rc_user_id    text,
  referral_code text,
  status        text not null default 'pending',  -- pending | approved | rejected
  created_at    timestamptz not null default now()
);

create table public.practitioner_applications (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  credentials text,
  practice    text,
  website     text,
  email       text not null,
  rc_user_id  text,
  status      text not null default 'pending',    -- pending | approved | rejected
  created_at  timestamptz not null default now()
);

-- Only the edge function (service role) reads/writes these
alter table public.post_submissions enable row level security;
alter table public.practitioner_applications enable row level security;

grant all on public.post_submissions to service_role;
grant all on public.practitioner_applications to service_role;
