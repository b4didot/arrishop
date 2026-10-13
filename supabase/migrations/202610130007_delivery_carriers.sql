begin;
alter table public.orders add column delivery_carrier text;
alter table public.orders add column shipping_fee_centavos integer not null default 0;
alter table public.orders add constraint order_delivery_charge check (
  (delivery_carrier is null and shipping_fee_centavos = 0)
  or (delivery_carrier = 'jnt' and shipping_fee_centavos = 9900)
  or (delivery_carrier = 'lalamove' and shipping_fee_centavos = 0)
);
alter table public.orders add constraint order_total_covers_shipping check (total_centavos >= shipping_fee_centavos);

create or replace function public.checkout(request_key uuid, selected_carrier text) returns uuid language plpgsql security definer set search_path = '' as $$
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
  if not exists(select 1 from public.payment_settings where id = 1 and qr_path is not null) then raise exception 'The shop is still setting up payments. Please try again later.'; end if;
  if not exists(select 1 from public.cart_items where customer_id = caller) then raise exception 'Your cart is empty.'; end if;
  perform p.id from public.products p join public.cart_items c on c.product_id = p.id where c.customer_id = caller order by p.id for share of p;
  if exists(select 1 from public.cart_items c join public.products p on p.id = c.product_id where c.customer_id = caller and (p.out_of_stock or p.archived_at is not null)) then raise exception 'An item in your cart is no longer available. Please remove it before checkout.'; end if;
  select sum(p.price_centavos::bigint * c.quantity) into total from public.cart_items c join public.products p on p.id = c.product_id where c.customer_id = caller;
  total := total + case when selected_carrier = 'jnt' then 9900 else 0 end;
  insert into public.orders(customer_id, checkout_key, total_centavos, customer_name, customer_phone, delivery_address, delivery_address_parts, delivery_carrier, shipping_fee_centavos)
    values (caller, request_key, total, customer.full_name, customer.phone, public.format_delivery_address(customer.delivery_address_parts), customer.delivery_address_parts, selected_carrier, case when selected_carrier = 'jnt' then 9900 else 0 end) returning id into order_id;
  insert into public.order_items(order_id, product_id, title, unit_price_centavos, quantity)
    select order_id, p.id, p.title, p.price_centavos, c.quantity from public.cart_items c join public.products p on p.id = c.product_id where c.customer_id = caller;
  insert into public.order_status_history(order_id, next_status, actor_id) values (order_id, 'pending_payment', caller);
  delete from public.cart_items where customer_id = caller;
  return order_id;
end; $$;


-- Keep old retries idempotent, but require a carrier for every new order.
create or replace function public.checkout(request_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); existing uuid;
begin
  if caller is null then raise exception 'Please log in first.'; end if;
  select id into existing from public.orders where customer_id = caller and checkout_key = request_key;
  if existing is not null then return existing; end if;
  raise exception 'Please refresh checkout and choose a delivery option.';
end;
$$;
revoke all on function public.checkout(uuid, text) from public, anon, authenticated;
grant execute on function public.checkout(uuid, text) to authenticated;
commit;
