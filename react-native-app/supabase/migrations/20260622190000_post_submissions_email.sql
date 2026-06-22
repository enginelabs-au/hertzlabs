-- Reply email for Make a Post outreach (required for sending offer codes).
alter table public.post_submissions
  add column if not exists email text;
