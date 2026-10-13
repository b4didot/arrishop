begin;
-- Keep the currently deployed single-photo editor working during the staged rollout.
create function public.sync_legacy_product_photo() returns trigger language plpgsql set search_path = public as $$
begin
  if new.image_path is not null and not (new.image_path = any(new.image_paths)) then
    if tg_op = 'INSERT' and cardinality(new.image_paths) = 0 then
      new.image_paths := array[new.image_path];
    elsif tg_op = 'UPDATE' and new.image_paths = old.image_paths and new.image_path is distinct from old.image_path then
      new.image_paths := array[new.image_path];
    end if;
  end if;
  return new;
end;
$$;
create trigger sync_legacy_product_photo before insert or update on public.products
for each row execute function public.sync_legacy_product_photo();
commit;
