-- A public Auth signup at 12:00 Asia/Manila, with age-based cleanup.
-- The publishable key is configured separately in private.synthetic_auth_config.
begin;

create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.synthetic_auth_config (
  id integer primary key default 1 check (id = 1),
  supabase_url text not null,
  publishable_key text not null
);
revoke all on private.synthetic_auth_config from public, anon, authenticated;

create function private.enqueue_daily_synthetic_signup() returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  config private.synthetic_auth_config;
  synthetic_email text := 'synthetic-' || to_char(now() at time zone 'Asia/Manila', 'YYYYMMDD') || '@arrie.store';
  request_id bigint;
begin
  select * into config from private.synthetic_auth_config where id = 1;
  if not found then raise exception 'Synthetic Auth check is not configured'; end if;
  -- A retry must not create a second account on the same day.
  if exists(select 1 from auth.users where email = synthetic_email) then return null; end if;
  select net.http_post(
    url := rtrim(config.supabase_url, '/') || '/auth/v1/signup',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', config.publishable_key),
    body := jsonb_build_object(
      'email', synthetic_email,
      'password', encode(gen_random_bytes(32), 'hex'),
      'data', jsonb_build_object(
        'arrie_synthetic', 'daily-auth-check',
        'full_name', 'Automated check',
        'phone', '00000000000',
        'delivery_address_parts', jsonb_build_object(
          'street_address', 'Automated test account - no delivery',
          'subdivision', '', 'barangay', 'Test Only', 'city', 'Test Only',
          'province', 'Test Only', 'zip_code', '0000'
        )
      )
    ),
    timeout_milliseconds := 10000
  ) into request_id;
  return request_id;
end;
$$;

create function private.delete_expired_synthetic_users() returns integer
language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
  -- Every filter is required: never touch a customer or either shop administrator.
  delete from auth.users u
  where u.email ~ '^synthetic-[0-9]{8}@arrie[.]store$'
    and u.raw_user_meta_data->>'arrie_synthetic' = 'daily-auth-check'
    and u.created_at <= now() - interval '2 minutes'
    and not exists(select 1 from public.orders o where o.customer_id = u.id);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function private.enqueue_daily_synthetic_signup(), private.delete_expired_synthetic_users() from public, anon, authenticated;

select cron.schedule('arrie-daily-synthetic-signup', '0 4 * * *', 'select private.enqueue_daily_synthetic_signup()');
select cron.schedule('arrie-expired-synthetic-cleanup', '30 seconds', 'select private.delete_expired_synthetic_users()');
commit;
