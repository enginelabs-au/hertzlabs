-- Allow service role (import script + edge functions) to manage the code pool.
grant select, insert, update on public.store_offer_code_pool to service_role;
