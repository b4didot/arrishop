-- First register arrisnipshop@gmail.com in the app. Email confirmation is disabled.
-- Run this separately in the trusted Supabase SQL Editor; never expose this operation through public signup.
do $$
declare administrator uuid;
begin
  select id into administrator from auth.users where lower(email) = 'arrisnipshop@gmail.com';
  if administrator is null then raise exception 'Register arrisnipshop@gmail.com before running administrator setup.'; end if;
  insert into public.admin_users(user_id) values (administrator) on conflict do nothing;
end;
$$;
