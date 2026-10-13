begin;
alter table public.payment_submissions add column receipt_paths text[];
update public.payment_submissions set receipt_paths = array[receipt_path];
alter table public.payment_submissions alter column receipt_paths set not null;
alter table public.payment_submissions add constraint payment_receipt_photo_count check (
  cardinality(receipt_paths) between 1 and 2
  and receipt_paths[1] = receipt_path
  and array_position(receipt_paths, null) is null
  and (cardinality(receipt_paths) = 1 or receipt_paths[2] <> receipt_path)
);

create or replace function public.receipt_read_allowed(object_name text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.payment_submissions p join public.orders o on o.id = p.order_id
    where object_name = any(p.receipt_paths) and (o.customer_id = (select auth.uid()) or (select public.is_admin())));
$$;

create or replace function public.submit_receipt(target_order uuid, object_name text, second_object_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); purchase public.orders; paths text[]; previous_paths text[];
begin
  if caller is null then raise exception 'Please log in first.'; end if;
  if object_name is null or length(trim(object_name)) = 0 then raise exception 'Please upload at least one receipt photo.'; end if;
  if second_object_name is not null and (length(trim(second_object_name)) = 0 or second_object_name = object_name) then raise exception 'Choose two different receipt photos.'; end if;
  paths := case when second_object_name is null then array[object_name] else array[object_name, second_object_name] end;
  select * into purchase from public.orders where id = target_order and customer_id = caller for update;
  if not found then raise exception 'Order not found.'; end if;
  select receipt_paths into previous_paths from public.payment_submissions where order_id = target_order and receipt_path = object_name;
  if found then
    if previous_paths = paths then return; end if;
    raise exception 'This receipt was already submitted with different photos. Refresh the order.';
  end if;
  if purchase.status not in ('pending_payment','payment_rejected') then raise exception 'This order is not accepting another receipt right now.'; end if;
  if split_part(object_name, '/', 2) <> target_order::text or not public.receipt_upload_allowed(object_name) then raise exception 'Invalid receipt upload.'; end if;
  if second_object_name is not null and (split_part(second_object_name, '/', 2) <> target_order::text or not public.receipt_upload_allowed(second_object_name)) then raise exception 'Invalid receipt upload.'; end if;
  if exists(select 1 from unnest(paths) as receipt_file(path) where not exists(select 1 from storage.objects where bucket_id = 'receipts' and name = receipt_file.path)) then raise exception 'Please upload each receipt photo first.'; end if;
  insert into public.payment_submissions(order_id, receipt_path, receipt_paths) values (target_order, object_name, paths);
  update public.orders set status = 'verifying_payment' where id = target_order;
  insert into public.order_status_history(order_id, previous_status, next_status, actor_id) values (target_order, purchase.status, 'verifying_payment', caller);
end; $$;

-- Existing clients can still submit a single photo during rollout.
create or replace function public.submit_receipt(target_order uuid, object_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.submit_receipt(target_order, object_name, null);
end; $$;
revoke all on function public.submit_receipt(uuid, text, text) from public, anon, authenticated;
grant execute on function public.submit_receipt(uuid, text, text) to authenticated;
commit;
