begin;
-- Delivery availability is explicit: dates stay closed until opened by an administrator.
create table public.delivery_settings (
 id integer primary key default 1 check (id=1),
 lead_days integer not null default 2 check (lead_days between 0 and 365),
 default_capacity integer not null default 10 check (default_capacity between 1 and 10000),
 enforce_delivery_dates boolean not null default false
);
insert into public.delivery_settings(id) values(1);
create table public.delivery_days (
 delivery_date date primary key,
 is_open boolean not null default true,
 capacity integer not null check (capacity between 1 and 10000)
);
alter table public.orders add column delivery_date date,
 add column slot_reserved_at timestamptz, add column completed_at timestamptz;
-- Preserve historical update times while backfilling the new columns.
alter table public.orders disable trigger order_updated;
update public.orders o set slot_reserved_at=(select min(submitted_at) from public.payment_submissions where order_id=o.id);
update public.orders o set completed_at=coalesce(
 (select max(created_at) from public.order_status_history where order_id=o.id and next_status='completed'), updated_at)
 where status='completed';
alter table public.orders enable trigger order_updated;
create index orders_delivery_reserved on public.orders(delivery_date) where slot_reserved_at is not null and status<>'cancelled';
alter table public.products add column item_count integer not null default 1 check (item_count between 1 and 10000);
alter table public.order_items add column item_count integer not null default 1 check (item_count between 1 and 10000),
 add column report_count integer check (report_count between 0 and 10000000);
create function public.snapshot_item_count() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select item_count into new.item_count from public.products where id=new.product_id;
 return new;
end; $$;
create trigger order_item_count before insert on public.order_items for each row execute function public.snapshot_item_count();
create function public.record_completion() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='completed' and old.status<>'completed' then new.completed_at:=now(); end if;
 return new;
end; $$;
create trigger order_completed before update on public.orders for each row execute function public.record_completion();

alter table public.delivery_settings enable row level security;
alter table public.delivery_days enable row level security;
revoke all on public.delivery_settings, public.delivery_days from anon, authenticated;
grant select on public.delivery_settings, public.delivery_days to authenticated;
grant update on public.delivery_settings to authenticated;
grant insert, update on public.delivery_days to authenticated;
create policy delivery_settings_read on public.delivery_settings for select to authenticated using(true);
create policy delivery_settings_write on public.delivery_settings for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy delivery_days_read on public.delivery_days for select to authenticated using(true);
create policy delivery_days_insert on public.delivery_days for insert to authenticated with check(public.is_admin());
create policy delivery_days_update on public.delivery_days for update to authenticated using(public.is_admin()) with check(public.is_admin());
create function public.guard_delivery_settings() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(761025001);
 if tg_table_name='delivery_days' then
  if tg_op='UPDATE' and new.delivery_date<>old.delivery_date then raise exception 'Update dates individually.'; end if;
  if new.capacity < (select count(*) from public.orders where delivery_date=new.delivery_date and slot_reserved_at is not null and status<>'cancelled') then
   raise exception 'Capacity cannot be lower than the number of reserved orders.';
  end if;
 end if;
 return new;
end; $$;
create trigger delivery_days_guard before insert or update on public.delivery_days for each row execute function public.guard_delivery_settings();
create trigger delivery_settings_guard before update on public.delivery_settings for each row execute function public.guard_delivery_settings();
create function public.check_delivery_day(chosen date) returns void language plpgsql security definer set search_path='' as $$
declare maximum integer;
begin
 perform pg_advisory_xact_lock(761025001);
 if chosen is null or chosen < (now() at time zone 'Asia/Manila')::date + (select lead_days from public.delivery_settings where id=1) then
  raise exception 'Please choose an available delivery date that meets the minimum lead time.';
 end if;
 select capacity into maximum from public.delivery_days where delivery_date=chosen and is_open;
 if not found then raise exception 'This delivery date is closed. Please choose another date.'; end if;
 if (select count(*) from public.orders where delivery_date=chosen and slot_reserved_at is not null and status<>'cancelled') >= maximum then
  raise exception 'This delivery date is full. Please choose another date before paying.';
 end if;
end; $$;
revoke all on function public.check_delivery_day(date) from public, anon, authenticated;
create function public.delivery_availability() returns table(delivery_date date, capacity integer, reserved integer, available boolean)
language sql stable security definer set search_path='' as $$
 select d.delivery_date,d.capacity,
 (select count(*)::integer from public.orders o where o.delivery_date=d.delivery_date and o.slot_reserved_at is not null and o.status<>'cancelled'),
 d.is_open and d.delivery_date >= (now() at time zone 'Asia/Manila')::date + s.lead_days
 and d.capacity > (select count(*) from public.orders o where o.delivery_date=d.delivery_date and o.slot_reserved_at is not null and o.status<>'cancelled')
 from public.delivery_days d cross join public.delivery_settings s where s.id=1;
$$;
revoke all on function public.delivery_availability() from public, anon;
grant execute on function public.delivery_availability() to authenticated;
create function public.set_order_delivery(target_order uuid, chosen_date date) returns void language plpgsql security definer set search_path='' as $$
declare purchase public.orders;
begin
 select * into purchase from public.orders where id=target_order and (customer_id=auth.uid() or public.is_admin()) for update;
 if not found then raise exception 'Order not found.'; end if;
 if purchase.status in ('cancelled','completed') then raise exception 'This order cannot be rescheduled.'; end if;
 if purchase.slot_reserved_at is not null and not (public.is_admin() and purchase.delivery_date is null) then
  raise exception 'The delivery date is already reserved. Please contact the shop.';
 end if;
 perform public.check_delivery_day(chosen_date);
 update public.orders set delivery_date=chosen_date where id=target_order;
end; $$;
revoke all on function public.set_order_delivery(uuid,date) from public, anon;
grant execute on function public.set_order_delivery(uuid,date) to authenticated;
create function public.reserve_receipt_slot() returns trigger language plpgsql security definer set search_path='' as $$
declare purchase public.orders;
begin
 select * into purchase from public.orders where id=new.order_id for update;
 if purchase.slot_reserved_at is null then
  if purchase.delivery_date is not null or (select enforce_delivery_dates from public.delivery_settings where id=1) then
   perform public.check_delivery_day(purchase.delivery_date);
  end if;
  update public.orders set slot_reserved_at=now() where id=purchase.id;
 end if;
 return new;
end; $$;
create trigger payment_reserves_slot before insert on public.payment_submissions for each row execute function public.reserve_receipt_slot();

create function public.set_report_count(target_item uuid, desired_count integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Administrator access required.'; end if;
 if desired_count is not null and (desired_count<0 or desired_count>10000000) then raise exception 'Enter a count from 0 to 10000000.'; end if;
 update public.order_items set report_count=desired_count where id=target_item;
 if not found then raise exception 'Order item not found.'; end if;
end; $$;
revoke all on function public.set_report_count(uuid,integer) from public, anon;
grant execute on function public.set_report_count(uuid,integer) to authenticated;

create table public.order_reviews (
 id uuid primary key,
 order_id uuid not null unique references public.orders(id),
 customer_id uuid not null references auth.users(id),
 overall text not null default '' check(length(overall)<=5000),
 item_reviews jsonb not null default '{}' check(jsonb_typeof(item_reviews)='object'),
 photo_paths text[] not null default '{}' check(cardinality(photo_paths)<=5 and array_position(photo_paths,null) is null),
 created_at timestamptz not null default now()
);
create table public.order_messages (
 id uuid primary key,
 order_id uuid not null references public.orders(id),
 sender_id uuid not null references auth.users(id),
 sender_is_admin boolean not null,
 body text not null default '' check(length(body)<=3000),
 photo_paths text[] not null default '{}' check(cardinality(photo_paths)<=3 and array_position(photo_paths,null) is null),
 created_at timestamptz not null default now(),
 check(length(trim(body))>0 or cardinality(photo_paths)>0)
);
create index messages_order on public.order_messages(order_id,created_at,id);
create function public.order_chat_access(target uuid, writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.orders o where o.id=target and (o.customer_id=auth.uid() or public.is_admin())
 and (o.completed_at is null or o.completed_at + case when public.is_admin() and not writing then interval '70 days' else interval '10 days' end > now()));
$$;
revoke all on function public.order_chat_access(uuid,boolean) from public, anon;
grant execute on function public.order_chat_access(uuid,boolean) to authenticated;
alter table public.order_reviews enable row level security;
alter table public.order_messages enable row level security;
revoke all on public.order_reviews,public.order_messages from anon,authenticated;
grant select on public.order_reviews,public.order_messages to authenticated;
create policy private_reviews on public.order_reviews for select to authenticated using(customer_id=auth.uid() or public.is_admin());
create policy order_chat_read on public.order_messages for select to authenticated using(public.order_chat_access(order_id,false));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('order-media','order-media',false,5242880,array['image/jpeg','image/png','image/webp']);
-- Used by both Storage policies and the finalization RPC. Filenames are immutable.
create function public.order_media_upload_allowed(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select split_part(object_name,'/',1)=auth.uid()::text
 and object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(message|review)/[0-9a-f-]{36}-[1-5][.](jpg|png|webp)$'
 and exists(select 1 from public.orders o where o.id::text=split_part(object_name,'/',2)
 and case split_part(object_name,'/',3)
 when 'message' then public.order_chat_access(o.id,true)
 when 'review' then o.customer_id=auth.uid() and o.status='completed' and not exists(select 1 from public.order_reviews r where r.order_id=o.id)
 else false end);
$$;
create function public.order_media_read_allowed(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.order_messages m where object_name=any(m.photo_paths) and public.order_chat_access(m.order_id,false))
 or exists(select 1 from public.order_reviews r where object_name=any(r.photo_paths) and (r.customer_id=auth.uid() or public.is_admin()))
 or public.order_media_upload_allowed(object_name);
$$;
revoke all on function public.order_media_upload_allowed(text),public.order_media_read_allowed(text) from public,anon;
grant execute on function public.order_media_upload_allowed(text),public.order_media_read_allowed(text) to authenticated;
create policy order_media_insert on storage.objects for insert to authenticated with check(bucket_id='order-media' and public.order_media_upload_allowed(name));
create policy order_media_read on storage.objects for select to authenticated using(bucket_id='order-media' and public.order_media_read_allowed(name));

create function public.submit_order_content(target_order uuid, entry_id uuid, content_kind text, content text, item_comments jsonb, photos text[])
returns void language plpgsql security definer set search_path='' as $$
declare purchase public.orders; path text; previous public.order_messages; review public.order_reviews; pair record;
begin
 if auth.uid() is null then raise exception 'Please log in first.'; end if;
 select * into purchase from public.orders where id=target_order and (customer_id=auth.uid() or public.is_admin()) for update;
 if not found then raise exception 'Order not found.'; end if;
 if entry_id is null or content is null or photos is null or array_position(photos,null) is not null then raise exception 'Invalid submission.'; end if;
 if content_kind='message' then
  if not public.order_chat_access(target_order,true) then raise exception 'This conversation is archived.'; end if;
  select * into previous from public.order_messages where id=entry_id;
  if found then
   if previous.order_id=target_order and previous.sender_id=auth.uid() and previous.body=content and previous.photo_paths=photos then return; end if;
   raise exception 'Please refresh this conversation before sending again.';
  end if;
  if length(content)>3000 or cardinality(photos)>3 or (length(trim(content))=0 and cardinality(photos)=0) then raise exception 'Add a message or up to three photos.'; end if;
 elsif content_kind='review' then
  if purchase.customer_id<>auth.uid() or purchase.status<>'completed' then raise exception 'Only the customer can review a completed order.'; end if;
  select * into review from public.order_reviews where order_id=target_order;
  if found then
   if review.id=entry_id and review.overall=content and review.item_reviews=item_comments and review.photo_paths=photos then return; end if;
   raise exception 'This order already has a review.';
  end if;
  if length(content)>5000 or cardinality(photos)>5 or item_comments is null or jsonb_typeof(item_comments)<>'object' then raise exception 'Invalid review.'; end if;
  for pair in select * from jsonb_each(item_comments) loop
   if jsonb_typeof(pair.value)<>'string' or length(pair.value #>> '{}')>3000 or not exists(select 1 from public.order_items where order_id=target_order and product_id::text=pair.key) then raise exception 'Please review only products in this order.'; end if;
  end loop;
 else raise exception 'Invalid submission type.';
 end if;
 if cardinality(photos)<>(select count(distinct p) from unnest(photos) p) then raise exception 'Choose different photos.'; end if;
 foreach path in array photos loop
  if path !~ ('^'||auth.uid()::text||'/'||target_order::text||'/'||content_kind||'/'||entry_id::text||'-[1-5][.](jpg|png|webp)$')
  or not public.order_media_upload_allowed(path)
  or not exists(select 1 from storage.objects where bucket_id='order-media' and name=path) then raise exception 'Please upload each photo first.'; end if;
 end loop;
 if content_kind='message' then
  insert into public.order_messages(id,order_id,sender_id,sender_is_admin,body,photo_paths)
  values(entry_id,target_order,auth.uid(),public.is_admin(),content,photos);
 else
  insert into public.order_reviews(id,order_id,customer_id,overall,item_reviews,photo_paths)
  values(entry_id,target_order,auth.uid(),content,item_comments,photos);
 end if;
end; $$;
revoke all on function public.submit_order_content(uuid,uuid,text,text,jsonb,text[]) from public,anon;
grant execute on function public.submit_order_content(uuid,uuid,text,text,jsonb,text[]) to authenticated;

-- The maintenance endpoint removes Storage objects via the Storage API, then calls this
-- restricted function. Never delete storage.objects metadata directly.
create function public.purge_expired_order_messages() returns integer language plpgsql security definer set search_path='' as $$
declare removed integer;
begin
 delete from public.order_messages m using public.orders o where m.order_id=o.id and o.completed_at<=now()-interval '70 days'
 and not exists(select 1 from unnest(m.photo_paths) p join storage.objects s on s.name=p and s.bucket_id='order-media');
 get diagnostics removed=row_count;
 return removed;
end; $$;
revoke all on function public.purge_expired_order_messages() from public,anon,authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  grant execute on function public.purge_expired_order_messages() to service_role;
  grant select on public.orders,public.order_messages to service_role;
 end if;
end $$;

create or replace function public.checkout(request_key uuid, selected_carrier text, chosen_date date) returns uuid language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); existing uuid; order_id uuid; customer public.profiles; total bigint;
begin
  if caller is null then raise exception 'Please log in first.'; end if;
  if request_key is null then raise exception 'Please refresh checkout and try again.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text, 0));
  select id into existing from public.orders where customer_id = caller and checkout_key = request_key;
  if existing is not null then return existing; end if;
  if selected_carrier is null or selected_carrier not in ('jnt', 'lalamove') then raise exception 'Please choose J&T or Lalamove for delivery.'; end if;
  select * into customer from public.profiles where id = caller for share;
  if not found or length(trim(customer.full_name)) = 0 or length(trim(customer.phone)) = 0 or not public.valid_delivery_address(customer.delivery_address_parts) then raise exception 'Please complete your name, phone, and all required delivery address fields in your account.'; end if;
  perform public.check_delivery_day(chosen_date);
  if not exists(select 1 from public.payment_settings where id = 1 and qr_path is not null) then raise exception 'The shop is still setting up payments. Please try again later.'; end if;
  if not exists(select 1 from public.cart_items where customer_id = caller) then raise exception 'Your cart is empty.'; end if;
  perform p.id from public.products p join public.cart_items c on c.product_id = p.id where c.customer_id = caller order by p.id for share of p;
  if exists(select 1 from public.cart_items c join public.products p on p.id = c.product_id where c.customer_id = caller and (p.out_of_stock or p.archived_at is not null)) then raise exception 'An item in your cart is no longer available. Please remove it before checkout.'; end if;
  select sum(p.price_centavos::bigint * c.quantity) into total from public.cart_items c join public.products p on p.id = c.product_id where c.customer_id = caller;
  total := total + case when selected_carrier = 'jnt' then 9900 else 0 end;
  insert into public.orders(customer_id, checkout_key, total_centavos, customer_name, customer_social_name, customer_phone, delivery_address, delivery_address_parts, delivery_carrier, shipping_fee_centavos, delivery_date)
    values (caller, request_key, total, customer.full_name, customer.social_name, customer.phone, public.format_delivery_address(customer.delivery_address_parts), customer.delivery_address_parts, selected_carrier, case when selected_carrier = 'jnt' then 9900 else 0 end, chosen_date) returning id into order_id;
  insert into public.order_items(order_id, product_id, title, unit_price_centavos, quantity)
    select order_id, p.id, p.title, p.price_centavos, c.quantity from public.cart_items c join public.products p on p.id = c.product_id where c.customer_id = caller;
  insert into public.order_status_history(order_id, next_status, actor_id) values (order_id, 'pending_payment', caller);
  delete from public.cart_items where customer_id = caller;
  return order_id;
end; $$;
revoke all on function public.checkout(uuid,text,date) from public,anon;
grant execute on function public.checkout(uuid,text,date) to authenticated;
-- Keep the deployed checkout working until the matching UI is released.
alter function public.checkout(uuid,text) rename to checkout_before_calendar;
revoke all on function public.checkout_before_calendar(uuid,text) from public,anon,authenticated;
create function public.checkout(request_key uuid, selected_carrier text) returns uuid language plpgsql security definer set search_path='' as $$
declare existing uuid;
begin
 if auth.uid() is null then raise exception 'Please log in first.'; end if;
 select id into existing from public.orders where customer_id=auth.uid() and checkout_key=request_key;
 if existing is not null then return existing; end if;
 if not (select enforce_delivery_dates from public.delivery_settings where id=1) then
  return public.checkout_before_calendar(request_key,selected_carrier);
 end if;
 raise exception 'Please refresh checkout and choose a delivery date.';
end; $$;
revoke all on function public.checkout(uuid,text) from public,anon;
grant execute on function public.checkout(uuid,text) to authenticated;

create function public.expired_order_chat_photos() returns table(object_name text)
language sql stable security definer set search_path='' as $$
 select s.name from storage.objects s join public.orders o on o.id::text=split_part(s.name,'/',2)
 where s.bucket_id='order-media' and split_part(s.name,'/',3)='message'
 and o.completed_at<=now()-interval '70 days'
 order by s.name limit 100;
$$;
revoke all on function public.expired_order_chat_photos() from public,anon,authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then
  grant execute on function public.expired_order_chat_photos() to service_role;
 end if;
end $$;
commit;
