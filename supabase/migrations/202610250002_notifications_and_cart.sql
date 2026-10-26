begin;
-- Historical undated orders receive the owner-requested placeholder; existing dates stay intact.
alter table public.orders disable trigger order_updated;
update public.orders set delivery_date=date '2026-10-01' where delivery_date is null;
alter table public.orders enable trigger order_updated;

create table public.order_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references auth.users(id) on delete cascade,
 order_id uuid not null references public.orders(id) on delete cascade,
 event_key text not null,
 kind text not null check(kind in ('order_update','message')),
 order_number text not null,
 status text,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(recipient_id,event_key)
);
create index notifications_recipient_date on public.order_notifications(recipient_id,created_at desc,id desc);
create index notifications_unread on public.order_notifications(recipient_id) where read_at is null;
alter table public.order_notifications enable row level security;
revoke all on public.order_notifications from anon,authenticated;
grant select on public.order_notifications to authenticated;
create policy notifications_owner on public.order_notifications for select to authenticated using(recipient_id=auth.uid());

create function public.notify_order_event() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid; actor uuid; event text; category text; next_state text; purchase public.orders;
begin
 if tg_table_name='order_messages' then
  target:=new.order_id; actor:=new.sender_id; event:='message:'||new.id; category:='message';
 elsif tg_table_name='order_status_history' then
  target:=new.order_id; actor:=new.actor_id; event:='status:'||new.id; category:='order_update'; next_state:=new.next_status;
 else
  if new.delivery_date is not distinct from old.delivery_date then return new; end if;
  target:=new.id; actor:=auth.uid(); event:='delivery:'||gen_random_uuid(); category:='order_update'; next_state:=new.status;
 end if;
 select * into purchase from public.orders where id=target;
 insert into public.order_notifications(recipient_id,order_id,event_key,kind,order_number,status)
 select recipient,target,event,category,purchase.order_number,next_state
 from (select purchase.customer_id as recipient union select user_id from public.admin_users) recipients
 where recipient is distinct from actor
 on conflict(recipient_id,event_key) do nothing;
 return new;
end; $$;
create trigger message_notification after insert on public.order_messages for each row execute function public.notify_order_event();
create trigger status_notification after insert on public.order_status_history for each row execute function public.notify_order_event();
create trigger delivery_notification after update of delivery_date on public.orders for each row execute function public.notify_order_event();

create function public.notification_inbox() returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); result jsonb;
begin
 if caller is null then raise exception 'Please log in first.'; end if;
 select jsonb_build_object(
 'unread_count',(select count(*) from public.order_notifications where recipient_id=caller and read_at is null),
 'items',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc,n.id desc) from (
  select id,order_id,kind,order_number,status,created_at,read_at from public.order_notifications
  where recipient_id=caller order by created_at desc,id desc limit 30
 ) n),'[]'::jsonb)) into result;
 return result;
end; $$;
create function public.read_order_notifications(target_notification uuid default null, through_time timestamptz default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Please log in first.'; end if;
 update public.order_notifications set read_at=now()
 where recipient_id=auth.uid() and read_at is null
 and case when target_notification is not null then id=target_notification
 else created_at<=least(coalesce(through_time,now()),now()) end;
end; $$;
revoke all on function public.notification_inbox(),public.read_order_notifications(uuid,timestamptz) from public,anon;
grant execute on function public.notification_inbox(),public.read_order_notifications(uuid,timestamptz) to authenticated;

-- Reuse the existing transactional cart validation and return the confirmed badge count.
create function public.change_cart_item(target_product uuid, desired_quantity integer, add_to_existing boolean default false)
returns integer language plpgsql security definer set search_path='' as $$
declare total integer;
begin
 perform public.set_cart_item(target_product,desired_quantity,add_to_existing);
 select coalesce(sum(quantity),0)::integer into total from public.cart_items where customer_id=auth.uid();
 return total;
end; $$;
create function public.viewer_context() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('admin',public.is_admin(),'cart_count',coalesce((select sum(quantity) from public.cart_items where customer_id=auth.uid()),0));
$$;
revoke all on function public.change_cart_item(uuid,integer,boolean),public.viewer_context() from public,anon;
grant execute on function public.change_cart_item(uuid,integer,boolean),public.viewer_context() to authenticated;
commit;
