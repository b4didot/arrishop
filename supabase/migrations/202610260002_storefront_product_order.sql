begin;
create sequence public.product_display_order_seq as bigint;
alter table public.products add column display_order bigint;
-- Keep the current newest-first lineup and commerce timestamps during backfill.
alter table public.products disable trigger product_updated;
with ranked as (
 select id,row_number() over(order by created_at desc,id) as position from public.products
)
update public.products p set display_order=r.position from ranked r where p.id=r.id;
alter table public.products enable trigger product_updated;
select setval('public.product_display_order_seq',coalesce(max(display_order),1),count(*)>0) from public.products;
alter table public.products alter column display_order set default nextval('public.product_display_order_seq'),
 alter column display_order set not null,
 add constraint product_display_order_positive check(display_order>0);
alter sequence public.product_display_order_seq owned by public.products.display_order;
revoke all on sequence public.product_display_order_seq from public,anon,authenticated;
grant usage on sequence public.product_display_order_seq to authenticated;
create index products_display_order on public.products(display_order,created_at desc,id) where archived_at is null;

create function public.move_storefront_product(target_product uuid,move_direction text,expected_neighbor uuid)
returns void language plpgsql security definer set search_path='' as $$
declare lineup uuid[]; position integer; neighbor uuid; target_position bigint; neighbor_position bigint;
begin
 if not public.is_admin() then raise exception 'Administrator access required.'; end if;
 if move_direction is null or move_direction not in ('up','down') then raise exception 'Choose up or down.'; end if;
 -- Serialize these short moves with product edits/archive changes as well as other moves.
 lock table public.products in share row exclusive mode;
 select array_agg(id order by display_order,created_at desc,id) into lineup from public.products where archived_at is null;
 position:=array_position(lineup,target_product);
 if position is null then raise exception 'This product is no longer on the storefront. Refresh and try again.'; end if;
 neighbor:=lineup[position+case when move_direction='up' then -1 else 1 end];
 if neighbor is null or neighbor is distinct from expected_neighbor then raise exception 'Product order changed. Refresh and try again.'; end if;
 select display_order into target_position from public.products where id=target_product;
 select display_order into neighbor_position from public.products where id=neighbor;
 update public.products set display_order=case when id=target_product then neighbor_position else target_position end
 where id in (target_product,neighbor);
end; $$;
revoke all on function public.move_storefront_product(uuid,text,uuid) from public,anon;
grant execute on function public.move_storefront_product(uuid,text,uuid) to authenticated;
commit;
