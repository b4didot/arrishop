-- gen_random_bytes is not on this project's function search path.
-- gen_random_uuid is built into PostgreSQL and gives independent random values.
create or replace function private.enqueue_daily_synthetic_signup() returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  config private.synthetic_auth_config;
  synthetic_email text := 'synthetic-' || to_char(now() at time zone 'Asia/Manila', 'YYYYMMDD') || '@arrie.store';
  request_id bigint;
begin
  select * into config from private.synthetic_auth_config where id = 1;
  if not found then raise exception 'Synthetic Auth check is not configured'; end if;
  if exists(select 1 from auth.users where email = synthetic_email) then return null; end if;
  select net.http_post(
    url := rtrim(config.supabase_url, '/') || '/auth/v1/signup',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', config.publishable_key),
    body := jsonb_build_object(
      'email', synthetic_email,
      'password', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
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
