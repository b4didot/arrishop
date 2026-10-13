begin;
alter table public.profiles add column delivery_address_parts jsonb not null default '{}';
alter table public.orders add column delivery_address_parts jsonb not null default '{}';

create function public.valid_delivery_address(parts jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(parts) = 'object'
    and jsonb_typeof(parts->'street_address') = 'string' and length(trim(parts->>'street_address')) between 1 and 300
    and jsonb_typeof(parts->'barangay') = 'string' and length(trim(parts->>'barangay')) between 1 and 100
    and jsonb_typeof(parts->'city') = 'string' and length(trim(parts->>'city')) between 1 and 100
    and jsonb_typeof(parts->'province') = 'string' and length(trim(parts->>'province')) between 1 and 100
    and jsonb_typeof(parts->'zip_code') = 'string' and (parts->>'zip_code') ~ '^[0-9]{4}$'
    and (not (parts ? 'subdivision') or (jsonb_typeof(parts->'subdivision') = 'string' and length(parts->>'subdivision') <= 200)), false);
$$;
alter table public.profiles add constraint profile_delivery_parts_valid check (delivery_address_parts = '{}'::jsonb or public.valid_delivery_address(delivery_address_parts));
alter table public.orders add constraint order_delivery_parts_valid check (delivery_address_parts = '{}'::jsonb or public.valid_delivery_address(delivery_address_parts));

create function public.format_delivery_address(parts jsonb) returns text
language sql immutable set search_path = '' as $$
  select concat_ws(', ', trim(parts->>'street_address'), nullif(trim(parts->>'subdivision'), ''), trim(parts->>'barangay'), trim(parts->>'city'), trim(parts->>'province'), parts->>'zip_code');
$$;
create function public.sync_delivery_address() returns trigger language plpgsql set search_path = '' as $$
begin
  if public.valid_delivery_address(new.delivery_address_parts) then
    new.delivery_address := public.format_delivery_address(new.delivery_address_parts);
  end if;
  return new;
end;
$$;
create trigger sync_profile_delivery_address before insert or update on public.profiles
for each row execute function public.sync_delivery_address();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, phone, delivery_address, delivery_address_parts) values (
    new.id, left(coalesce(new.raw_user_meta_data->>'full_name',''),120),
    left(coalesce(new.raw_user_meta_data->>'phone',''),30), left(coalesce(new.raw_user_meta_data->>'delivery_address',''),1000),
    coalesce(new.raw_user_meta_data->'delivery_address_parts', '{}'::jsonb)
  );
  return new;
end;
$$;

create or replace function public.checkout(request_key uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); existing uuid; order_id uuid; customer public.profiles; total bigint;
begin
  if caller is null then raise exception 'Please log in first.'; end if;
  if request_key is null then raise exception 'Please refresh checkout and try again.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(caller::text, 0));
  select id into existing from public.orders where customer_id = caller and checkout_key = request_key;
  if existing is not null then return existing; end if;
  select * into customer from public.profiles where id = caller for share;
  if not found or length(trim(customer.full_name)) = 0 or length(trim(customer.phone)) = 0 or not public.valid_delivery_address(customer.delivery_address_parts) then raise exception 'Please complete your name, phone, and all required delivery address fields in your account.'; end if;
  if not exists(select 1 from public.payment_settings where id = 1 and qr_path is not null) then raise exception 'The shop is still setting up payments. Please try again later.'; end if;
  if not exists(select 1 from public.cart_items where customer_id = caller) then raise exception 'Your cart is empty.'; end if;
  perform p.id from public.products p join public.cart_items c on c.product_id = p.id where c.customer_id = caller order by p.id for share of p;
  if exists(select 1 from public.cart_items c join public.products p on p.id = c.product_id where c.customer_id = caller and (p.out_of_stock or p.archived_at is not null)) then raise exception 'An item in your cart is no longer available. Please remove it before checkout.'; end if;
  select sum(p.price_centavos::bigint * c.quantity) into total from public.cart_items c join public.products p on p.id = c.product_id where c.customer_id = caller;
  insert into public.orders(customer_id, checkout_key, total_centavos, customer_name, customer_phone, delivery_address, delivery_address_parts)
    values (caller, request_key, total, customer.full_name, customer.phone, public.format_delivery_address(customer.delivery_address_parts), customer.delivery_address_parts) returning id into order_id;
  insert into public.order_items(order_id, product_id, title, unit_price_centavos, quantity)
    select order_id, p.id, p.title, p.price_centavos, c.quantity from public.cart_items c join public.products p on p.id = c.product_id where c.customer_id = caller;
  insert into public.order_status_history(order_id, next_status, actor_id) values (order_id, 'pending_payment', caller);
  delete from public.cart_items where customer_id = caller;
  return order_id;
end; $$;

commit;
