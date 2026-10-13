-- Read-only verification; run with: supabase db query --linked --file supabase/verify-setup.sql
select jsonb_build_object(
  'tables', (select jsonb_agg(jsonb_build_object('name', tablename, 'rls_enabled', rowsecurity) order by tablename) from pg_tables where schemaname = 'public'),
  'buckets', (select jsonb_agg(jsonb_build_object('id', id, 'public', public, 'size_limit', file_size_limit) order by id) from storage.buckets where id in ('shop-images', 'receipts')),
  'migrations', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
  'admin_account_exists', exists(select 1 from auth.users where lower(email) = 'arrisnipshop@gmail.com'),
  'admin_email_confirmed', exists(select 1 from auth.users where lower(email) = 'arrisnipshop@gmail.com' and email_confirmed_at is not null),
  'admin_access_granted', exists(select 1 from public.admin_users a join auth.users u on u.id = a.user_id where lower(u.email) = 'arrisnipshop@gmail.com'),
  'public_policy_count', (select count(*) from pg_policies where schemaname = 'public'),
  'storage_policies', (select jsonb_agg(jsonb_build_object('name', policyname, 'operation', cmd) order by policyname) from pg_policies where schemaname = 'storage' and policyname in ('shop_image_read','shop_image_insert','shop_image_cleanup','receipt_insert','receipt_select'))
) as setup;
