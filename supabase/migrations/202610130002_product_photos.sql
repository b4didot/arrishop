begin;
alter table public.products add column image_paths text[] not null default '{}';
update public.products set image_paths = array[image_path] where image_path is not null;
alter table public.products add constraint product_photo_collection check (
  cardinality(image_paths) <= 3 and array_position(image_paths, null) is null
  and ((cardinality(image_paths) = 0 and image_path is null)
    or (cardinality(image_paths) > 0 and image_path is not null and image_path = any(image_paths)))
);
drop policy shop_image_cleanup on storage.objects;
create policy shop_image_cleanup on storage.objects for delete to authenticated using (
  bucket_id = 'shop-images' and (select public.is_admin())
  and not exists(select 1 from public.products where image_path = name or name = any(image_paths))
  and not exists(select 1 from public.payment_settings where qr_path = name)
);
commit;
