-- Add active flag so codes can be deactivated manually or automatically.
-- A code with active = false is rejected immediately by the edge function.

alter table public.promo_codes
  add column if not exists active boolean not null default true;

-- Auto-deactivate when use_count reaches max_uses on any UPDATE.
create or replace function public.auto_deactivate_promo()
returns trigger language plpgsql as $$
begin
  if new.max_uses is not null and new.use_count >= new.max_uses then
    new.active := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_deactivate_promo on public.promo_codes;
create trigger trg_auto_deactivate_promo
  before update on public.promo_codes
  for each row execute function public.auto_deactivate_promo();
