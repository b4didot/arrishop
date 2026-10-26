begin;
alter table public.orders add column archived_at timestamptz,
 add column delivery_date_override boolean not null default false;
create index orders_active_date on public.orders(created_at desc) where archived_at is null;
alter table public.payment_submissions drop constraint payment_submissions_decision_check;
alter table public.payment_submissions add constraint payment_submissions_decision_check
 check(decision in ('pending','confirmed','rejected','superseded'));

create table public.order_admin_events (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 action text not null check(action in ('status','delivery_date','archive')),
 reason text not null check(length(trim(reason)) between 1 and 1000),
 previous_status text, next_status text,
 previous_delivery_date date, next_delivery_date date,
 previous_archived_at timestamptz, next_archived_at timestamptz,
 created_at timestamptz not null default now()
);
create index admin_events_order on public.order_admin_events(order_id,created_at desc);
alter table public.order_admin_events enable row level security;
revoke all on public.order_admin_events from anon,authenticated;
grant select on public.order_admin_events to authenticated;
create policy admin_events_read on public.order_admin_events for select to authenticated using(public.is_admin());

-- Reopening an order must not revive deleted chat or restart its original retention clock.
create or replace function public.record_completion() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='completed' and old.status<>'completed' then new.completed_at:=coalesce(old.completed_at,now()); end if;
 return new;
end; $$;

create function public.admin_update_order(target_order uuid, expected_updated_at timestamptz, change_kind text,
 reason text, new_status text default null, new_delivery_date date default null, archive_order boolean default null)
returns void language plpgsql security definer set search_path='' as $$
declare purchase public.orders; explanation text:=trim(coalesce(reason,'')); changed public.orders;
begin
 if not public.is_admin() then raise exception 'Administrator access required.'; end if;
 if change_kind is null or change_kind not in ('status','delivery_date','archive') then raise exception 'Choose a valid order change.'; end if;
 if change_kind='archive' and explanation='' then explanation:=case when archive_order then 'Archived by administrator' else 'Restored by administrator' end; end if;
 if length(explanation) not between 1 and 1000 then raise exception 'Please give a reason, up to 1000 characters.'; end if;
 select * into purchase from public.orders where id=target_order for update;
 if not found then raise exception 'Order not found.'; end if;
 if expected_updated_at is null or purchase.updated_at is distinct from expected_updated_at then raise exception 'This order changed. Refresh it and try again.'; end if;
 perform pg_advisory_xact_lock(761025001);
 if change_kind='status' then
  if new_status is null or new_status not in ('pending_payment','verifying_payment','payment_rejected','payment_confirmed','processing','completed','cancelled') then raise exception 'Choose a valid order status.'; end if;
  if new_status=purchase.status then return; end if;
  -- Resolve pending review work explicitly; never invent a received payment amount.
  if new_status<>'verifying_payment' then
   update public.payment_submissions set
    decision=case when new_status='payment_rejected' then 'rejected' else 'superseded' end,
    rejection_reason=case when new_status='payment_rejected' then explanation else null end,
    amount_received_centavos=null,reviewed_by=auth.uid(),reviewed_at=now()
   where order_id=target_order and decision='pending';
  end if;
  update public.orders set status=new_status,
   slot_reserved_at=case when new_status in ('verifying_payment','payment_confirmed','processing','completed') then coalesce(slot_reserved_at,now()) else slot_reserved_at end
   where id=target_order returning * into changed;
  insert into public.order_status_history(order_id,previous_status,next_status,actor_id,reason)
   values(target_order,purchase.status,new_status,auth.uid(),'Administrator status override: '||explanation);
 elsif change_kind='delivery_date' then
  if new_delivery_date is null then raise exception 'Choose a delivery date.'; end if;
  if new_delivery_date=purchase.delivery_date and purchase.delivery_date_override then return; end if;
  update public.orders set delivery_date=new_delivery_date,delivery_date_override=true where id=target_order returning * into changed;
  insert into public.order_status_history(order_id,previous_status,next_status,actor_id,reason)
   values(target_order,purchase.status,purchase.status,auth.uid(),
    'Administrator delivery override: '||coalesce(purchase.delivery_date::text,'Not scheduled')||' to '||new_delivery_date::text||'. '||explanation);
 else
  if archive_order is null then raise exception 'Choose archive or restore.'; end if;
  if archive_order=(purchase.archived_at is not null) then return; end if;
  update public.orders set archived_at=case when archive_order then now() else null end where id=target_order returning * into changed;
 end if;
 insert into public.order_admin_events(order_id,actor_id,action,reason,previous_status,next_status,previous_delivery_date,next_delivery_date,previous_archived_at,next_archived_at)
 values(target_order,auth.uid(),change_kind,explanation,purchase.status,changed.status,purchase.delivery_date,changed.delivery_date,purchase.archived_at,changed.archived_at);
end; $$;
revoke all on function public.admin_update_order(uuid,timestamptz,text,text,text,date,boolean) from public,anon;
grant execute on function public.admin_update_order(uuid,timestamptz,text,text,text,date,boolean) to authenticated;

create or replace function public.reserve_receipt_slot() returns trigger language plpgsql security definer set search_path='' as $$
declare purchase public.orders;
begin
 select * into purchase from public.orders where id=new.order_id for update;
 if purchase.slot_reserved_at is null then
  if not purchase.delivery_date_override and (purchase.delivery_date is not null or (select enforce_delivery_dates from public.delivery_settings where id=1)) then
   perform public.check_delivery_day(purchase.delivery_date);
  end if;
  update public.orders set slot_reserved_at=now() where id=purchase.id;
 end if;
 return new;
end; $$;

create or replace function public.set_order_delivery(target_order uuid,chosen_date date) returns void language plpgsql security definer set search_path='' as $$
declare purchase public.orders;
begin
 select * into purchase from public.orders where id=target_order and (customer_id=auth.uid() or public.is_admin()) for update;
 if not found then raise exception 'Order not found.'; end if;
 if purchase.status in ('cancelled','completed') then raise exception 'This order cannot be rescheduled.'; end if;
 if purchase.slot_reserved_at is not null and not (public.is_admin() and purchase.delivery_date is null) then raise exception 'The delivery date is already reserved. Please contact the shop.'; end if;
 perform public.check_delivery_day(chosen_date);
 update public.orders set delivery_date=chosen_date,delivery_date_override=false where id=target_order;
end; $$;

-- Include admin allocations on otherwise unconfigured/closed dates in capacity summaries.
create or replace function public.delivery_availability() returns table(delivery_date date,capacity integer,reserved integer,available boolean)
language sql stable security definer set search_path='' as $$
 with dates as (
  select delivery_date from public.delivery_days
  union select delivery_date from public.orders where delivery_date is not null and slot_reserved_at is not null and status<>'cancelled'
 ), counts as (
  select delivery_date,count(*)::integer as used from public.orders where slot_reserved_at is not null and status<>'cancelled' group by delivery_date
 )
 select dates.delivery_date,coalesce(d.capacity,s.default_capacity),coalesce(c.used,0),
 coalesce(d.is_open,false) and dates.delivery_date>=(now() at time zone 'Asia/Manila')::date+s.lead_days and coalesce(c.used,0)<coalesce(d.capacity,s.default_capacity)
 from dates left join public.delivery_days d on d.delivery_date=dates.delivery_date left join counts c on c.delivery_date=dates.delivery_date
 cross join public.delivery_settings s where s.id=1;
$$;

-- Delivery-history entries mirror status but should not duplicate the delivery notification.
create or replace function public.notify_order_event() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid; actor uuid; event text; category text; next_state text; purchase public.orders;
begin
 if tg_table_name='order_messages' then
  target:=new.order_id;actor:=new.sender_id;event:='message:'||new.id;category:='message';
 elsif tg_table_name='order_status_history' then
  if new.previous_status is not distinct from new.next_status then return new; end if;
  target:=new.order_id;actor:=new.actor_id;event:='status:'||new.id;category:='order_update';next_state:=new.next_status;
 else
  if new.delivery_date is not distinct from old.delivery_date then return new; end if;
  target:=new.id;actor:=auth.uid();event:='delivery:'||gen_random_uuid();category:='order_update';
 end if;
 select * into purchase from public.orders where id=target;
 insert into public.order_notifications(recipient_id,order_id,event_key,kind,order_number,status)
 select recipient,target,event,category,purchase.order_number,next_state
 from (select purchase.customer_id as recipient union select user_id from public.admin_users) recipients
 where recipient is distinct from actor on conflict(recipient_id,event_key) do nothing;
 return new;
end; $$;
commit;
