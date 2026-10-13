-- Run once in the Supabase SQL Editor on the new shop project.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (length(full_name) <= 120),
  phone text not null default '' check (length(phone) <= 30),
  delivery_address text not null default '' check (length(delivery_address) <= 1000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.admin_users (user_id uuid primary key references auth.users(id) on delete cascade);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 120),
  description text not null default '' check (length(description) <= 2000),
  price_centavos integer not null check (price_centavos between 0 and 100000000),
  image_path text, out_of_stock boolean not null default false, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cart_items (
  customer_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity between 1 and 99),
  created_at timestamptz not null default now(), primary key (customer_id, product_id)
);
create sequence public.order_number_seq;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null default ('ARRI-' || lpad(nextval('public.order_number_seq')::text, 8, '0')),
  customer_id uuid not null references auth.users(id), checkout_key uuid not null,
  status text not null default 'pending_payment' check (status in ('pending_payment','verifying_payment','payment_rejected','payment_confirmed','processing','completed','cancelled')),
  total_centavos bigint not null check (total_centavos between 0 and 1000000000000),
  customer_name text not null, customer_phone text not null, delivery_address text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(customer_id, checkout_key)
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
  product_id uuid not null references public.products(id), title text not null,
  unit_price_centavos integer not null check (unit_price_centavos >= 0), quantity integer not null check (quantity between 1 and 99)
);
create table public.payment_submissions (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id), receipt_path text unique not null,
  submitted_at timestamptz not null default now(), decision text not null default 'pending' check (decision in ('pending','confirmed','rejected')),
  reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
  amount_received_centavos bigint check (amount_received_centavos between 0 and 1000000000000), rejection_reason text,
  check (decision <> 'rejected' or length(trim(rejection_reason)) > 0 and rejection_reason is not null),
  check (decision <> 'confirmed' or amount_received_centavos is not null),
  check ((decision = 'pending' and reviewed_by is null and reviewed_at is null) or (decision <> 'pending' and reviewed_by is not null and reviewed_at is not null))
);
create unique index one_pending_payment_per_order on public.payment_submissions(order_id) where decision = 'pending';
create table public.order_admin_details (
  order_id uuid primary key references public.orders(id), notes text not null default '' check (length(notes) <= 5000), updated_at timestamptz not null default now()
);
create table public.order_status_history (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
  previous_status text, next_status text not null, actor_id uuid not null references auth.users(id), reason text, created_at timestamptz not null default now()
);
create table public.payment_settings (
  id integer primary key default 1 check (id = 1), qr_path text,
  instructions text not null default 'Scan the QR code using your payment app. Pay the exact order total, then upload a clear screenshot of your receipt. We will check your payment before preparing your order.' check (length(instructions) between 1 and 2000),
  updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
insert into public.payment_settings(id) values (1);
create index orders_customer_date on public.orders(customer_id, created_at desc);
create index orders_status_date on public.orders(status, created_at desc);
create index order_items_order on public.order_items(order_id);
create index submissions_order on public.payment_submissions(order_id, submitted_at desc);
create index history_order on public.order_status_history(order_id, created_at desc);

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;
create trigger profile_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger product_updated before update on public.products for each row execute function public.touch_updated_at();
create trigger order_updated before update on public.orders for each row execute function public.touch_updated_at();
create trigger notes_updated before update on public.order_admin_details for each row execute function public.touch_updated_at();
create trigger settings_updated before update on public.payment_settings for each row execute function public.touch_updated_at();

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, phone, delivery_address) values (
    new.id, left(coalesce(new.raw_user_meta_data->>'full_name',''),120),
    left(coalesce(new.raw_user_meta_data->>'phone',''),30), left(coalesce(new.raw_user_meta_data->>'delivery_address',''),1000)
  );
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- Also support accounts created before this migration.
insert into public.profiles(id, full_name) select id, left(coalesce(raw_user_meta_data->>'full_name',''),120) from auth.users on conflict do nothing;

create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.admin_users where user_id = (select auth.uid()));
$$;
create function public.owns_order(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.orders where id = target and customer_id = (select auth.uid()));
$$;
create function public.has_cart_product(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.cart_items where product_id = target and customer_id = (select auth.uid()));
$$;

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.order_admin_details enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payment_settings enable row level security;

-- Revoke Supabase's default broad grants. Only transactional RPCs can mutate commerce records.
revoke all on public.profiles, public.admin_users, public.products, public.cart_items, public.orders, public.order_items, public.payment_submissions, public.order_admin_details, public.order_status_history, public.payment_settings from anon, authenticated;
grant select on public.products, public.payment_settings to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.products, public.order_admin_details to authenticated;
grant update on public.payment_settings to authenticated;
grant select on public.cart_items, public.orders, public.order_items, public.payment_submissions, public.order_status_history to authenticated;

create policy profile_read on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profile_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy product_read on public.products for select to anon, authenticated using (archived_at is null or (select public.is_admin()) or public.has_cart_product(id));
create policy product_insert on public.products for insert to authenticated with check ((select public.is_admin()));
create policy product_update on public.products for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy cart_read on public.cart_items for select to authenticated using (customer_id = (select auth.uid()));
create policy orders_read on public.orders for select to authenticated using (customer_id = (select auth.uid()) or (select public.is_admin()));
create policy items_read on public.order_items for select to authenticated using (public.owns_order(order_id) or (select public.is_admin()));
create policy submissions_read on public.payment_submissions for select to authenticated using (public.owns_order(order_id) or (select public.is_admin()));
create policy history_read on public.order_status_history for select to authenticated using (public.owns_order(order_id) or (select public.is_admin()));
create policy notes_read on public.order_admin_details for select to authenticated using ((select public.is_admin()));
create policy notes_insert on public.order_admin_details for insert to authenticated with check ((select public.is_admin()));
create policy notes_update on public.order_admin_details for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy settings_read on public.payment_settings for select to anon, authenticated using (true);
create policy settings_update on public.payment_settings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()) and updated_by = (select auth.uid()));

create function public.set_cart_item(target_product uuid, desired_quantity integer, add_to_existing boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); current_quantity integer; product public.products;
begin
  if caller is null then raise exception 'Please log in first.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text, 0));
  if desired_quantity is null or desired_quantity < 0 or desired_quantity > 99 then raise exception 'Choose a quantity from 1 to 99.'; end if;
  if desired_quantity = 0 then delete from public.cart_items where customer_id = caller and product_id = target_product; return; end if;
  select * into product from public.products where id = target_product for share;
  if not found or product.out_of_stock or product.archived_at is not null then raise exception 'This product is no longer available.'; end if;
  select quantity into current_quantity from public.cart_items where customer_id = caller and product_id = target_product;
  if add_to_existing then desired_quantity := desired_quantity + coalesce(current_quantity, 0); end if;
  if desired_quantity > 99 then raise exception 'You can add up to 99 of each product.'; end if;
  if current_quantity is null and (select count(*) from public.cart_items where customer_id = caller) >= 100 then raise exception 'Your cart can hold up to 100 different products.'; end if;
  insert into public.cart_items(customer_id, product_id, quantity) values (caller, target_product, desired_quantity)
  on conflict(customer_id, product_id) do update set quantity = excluded.quantity;
end; $$;

create function public.checkout(request_key uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); existing uuid; order_id uuid; customer public.profiles; total bigint;
begin
  if caller is null then raise exception 'Please log in first.'; end if;
  if request_key is null then raise exception 'Please refresh checkout and try again.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text, 0));
  select id into existing from public.orders where customer_id = caller and checkout_key = request_key;
  if existing is not null then return existing; end if;
  select * into customer from public.profiles where id = caller for share;
  if not found or length(trim(customer.full_name)) = 0 or length(trim(customer.phone)) = 0 or length(trim(customer.delivery_address)) = 0 then raise exception 'Please complete your name, phone, and delivery address in your account.'; end if;
  if not exists(select 1 from public.payment_settings where id = 1 and qr_path is not null) then raise exception 'The shop is still setting up payments. Please try again later.'; end if;
  if not exists(select 1 from public.cart_items where customer_id = caller) then raise exception 'Your cart is empty.'; end if;
  perform p.id from public.products p join public.cart_items c on c.product_id = p.id where c.customer_id = caller order by p.id for share of p;
  if exists(select 1 from public.cart_items c join public.products p on p.id = c.product_id where c.customer_id = caller and (p.out_of_stock or p.archived_at is not null)) then raise exception 'An item in your cart is no longer available. Please remove it before checkout.'; end if;
  select sum(p.price_centavos::bigint * c.quantity) into total from public.cart_items c join public.products p on p.id = c.product_id where c.customer_id = caller;
  insert into public.orders(customer_id, checkout_key, total_centavos, customer_name, customer_phone, delivery_address)
    values (caller, request_key, total, customer.full_name, customer.phone, customer.delivery_address) returning id into order_id;
  insert into public.order_items(order_id, product_id, title, unit_price_centavos, quantity)
    select order_id, p.id, p.title, p.price_centavos, c.quantity from public.cart_items c join public.products p on p.id = c.product_id where c.customer_id = caller;
  insert into public.order_status_history(order_id, next_status, actor_id) values (order_id, 'pending_payment', caller);
  delete from public.cart_items where customer_id = caller;
  return order_id;
end; $$;

create function public.receipt_upload_allowed(object_name text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.orders where customer_id = (select auth.uid())
    and id::text = split_part(object_name, '/', 2) and split_part(object_name, '/', 1) = auth.uid()::text
    and status in ('pending_payment', 'payment_rejected') and array_length(string_to_array(object_name, '/'), 1) = 3);
$$;
create function public.receipt_read_allowed(object_name text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.payment_submissions p join public.orders o on o.id = p.order_id
    where p.receipt_path = object_name and (o.customer_id = (select auth.uid()) or (select public.is_admin())));
$$;
create function public.submit_receipt(target_order uuid, object_name text) returns void language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); purchase public.orders;
begin
  if caller is null then raise exception 'Please log in first.'; end if;
  select * into purchase from public.orders where id = target_order and customer_id = caller for update;
  if not found then raise exception 'Order not found.'; end if;
  -- A retry for the same finalized object is safe, even after a review.
  if exists(select 1 from public.payment_submissions where order_id = target_order and receipt_path = object_name) then return; end if;
  if purchase.status not in ('pending_payment','payment_rejected') then raise exception 'This order is not accepting another receipt right now.'; end if;
  if split_part(object_name, '/', 2) <> target_order::text or not public.receipt_upload_allowed(object_name) then raise exception 'Invalid receipt upload.'; end if;
  if not exists(select 1 from storage.objects where bucket_id = 'receipts' and name = object_name) then raise exception 'Please upload your receipt first.'; end if;
  insert into public.payment_submissions(order_id, receipt_path) values (target_order, object_name);
  update public.orders set status = 'verifying_payment' where id = target_order;
  insert into public.order_status_history(order_id, previous_status, next_status, actor_id) values (target_order, purchase.status, 'verifying_payment', caller);
end; $$;

create function public.review_payment(target_order uuid, target_submission uuid, approve boolean, received_centavos bigint default null, reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare purchase public.orders; submission public.payment_submissions; new_status text;
begin
  if not public.is_admin() then raise exception 'Administrator access required.'; end if;
  if approve is null then raise exception 'Choose confirm or reject.'; end if;
  select * into purchase from public.orders where id = target_order for update;
  if not found or purchase.status <> 'verifying_payment' then raise exception 'This order is not awaiting payment verification.'; end if;
  select * into submission from public.payment_submissions where id = target_submission and order_id = target_order and decision = 'pending' for update;
  if not found then raise exception 'This receipt has already been reviewed. Refresh the order.'; end if;
  if approve and (received_centavos is null or received_centavos < purchase.total_centavos or received_centavos > 1000000000000) then raise exception 'Enter the amount actually received. It must cover the order total.'; end if;
  if not approve and (reason is null or length(trim(reason)) = 0 or length(reason) > 1000) then raise exception 'Please give a rejection reason, up to 1000 characters.'; end if;
  new_status := case when approve then 'payment_confirmed' else 'payment_rejected' end;
  update public.payment_submissions set decision = case when approve then 'confirmed' else 'rejected' end,
    amount_received_centavos = case when approve then received_centavos else null end,
    rejection_reason = case when approve then null else trim(reason) end, reviewed_by = auth.uid(), reviewed_at = now() where id = target_submission;
  update public.orders set status = new_status where id = target_order;
  insert into public.order_status_history(order_id, previous_status, next_status, actor_id, reason)
    values (target_order, purchase.status, new_status, auth.uid(), case when approve then null else trim(reason) end);
end; $$;

create function public.advance_order(target_order uuid, next_status text, reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare purchase public.orders;
begin
  if not public.is_admin() then raise exception 'Administrator access required.'; end if;
  select * into purchase from public.orders where id = target_order for update;
  if not found then raise exception 'Order not found.'; end if;
  if next_status is null or not (
    (purchase.status = 'payment_confirmed' and next_status = 'processing') or
    (purchase.status = 'processing' and next_status = 'completed') or
    (purchase.status not in ('completed','cancelled','verifying_payment') and next_status = 'cancelled')
  ) then raise exception 'This status change is not allowed. Review any pending receipt before cancelling.'; end if;
  if next_status = 'cancelled' and (reason is null or length(trim(reason)) = 0 or length(reason) > 1000) then raise exception 'Please give a cancellation reason, up to 1000 characters.'; end if;
  update public.orders set status = next_status where id = target_order;
  insert into public.order_status_history(order_id, previous_status, next_status, actor_id, reason)
    values (target_order, purchase.status, next_status, auth.uid(), case when next_status = 'cancelled' then trim(reason) else null end);
end; $$;

-- Explicitly restrict execution, including trigger functions and helpers.
revoke all on function public.touch_updated_at(), public.handle_new_user(), public.is_admin(), public.owns_order(uuid), public.has_cart_product(uuid), public.set_cart_item(uuid,integer,boolean), public.checkout(uuid), public.receipt_upload_allowed(text), public.receipt_read_allowed(text), public.submit_receipt(uuid,text), public.review_payment(uuid,uuid,boolean,bigint,text), public.advance_order(uuid,text,text) from public, anon, authenticated;
grant execute on function public.is_admin(), public.has_cart_product(uuid) to anon, authenticated;
grant execute on function public.owns_order(uuid), public.set_cart_item(uuid,integer,boolean), public.checkout(uuid), public.receipt_upload_allowed(text), public.receipt_read_allowed(text), public.submit_receipt(uuid,text), public.review_payment(uuid,uuid,boolean,bigint,text), public.advance_order(uuid,text,text) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('shop-images', 'shop-images', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('receipts', 'receipts', false, 5242880, array['image/jpeg','image/png','image/webp']);
create policy shop_image_read on storage.objects for select to anon, authenticated using (bucket_id = 'shop-images');
create policy shop_image_insert on storage.objects for insert to authenticated with check (bucket_id = 'shop-images' and (select public.is_admin()));
create policy shop_image_cleanup on storage.objects for delete to authenticated using (bucket_id = 'shop-images' and (select public.is_admin())
  and not exists(select 1 from public.products where image_path = name) and not exists(select 1 from public.payment_settings where qr_path = name));
create policy receipt_insert on storage.objects for insert to authenticated with check (bucket_id = 'receipts' and public.receipt_upload_allowed(name));
create policy receipt_select on storage.objects for select to authenticated using (bucket_id = 'receipts' and (public.receipt_read_allowed(name) or public.receipt_upload_allowed(name)));
-- No update/delete policy: evidence cannot be overwritten or removed, including during finalization.
commit;
