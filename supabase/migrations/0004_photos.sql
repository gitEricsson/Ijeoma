-- A picture per country (and optionally per stop), shown when you hover or
-- tap the trail. Either a file in the public "photos" bucket, a file in
-- /public/photos, or "/ig/<shortcode>" (our Instagram image proxy).
alter table countries add column if not exists photo_url text;
alter table stops add column if not exists photo_url text;

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

drop policy if exists "photos public read" on storage.objects;
create policy "photos public read" on storage.objects for select using (bucket_id = 'photos');
drop policy if exists "photos admin insert" on storage.objects;
create policy "photos admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.is_admin());
drop policy if exists "photos admin update" on storage.objects;
create policy "photos admin update" on storage.objects for update to authenticated using (bucket_id = 'photos' and public.is_admin());
drop policy if exists "photos admin delete" on storage.objects;
create policy "photos admin delete" on storage.objects for delete to authenticated using (bucket_id = 'photos' and public.is_admin());
