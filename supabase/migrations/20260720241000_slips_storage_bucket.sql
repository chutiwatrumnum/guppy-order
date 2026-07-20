-- ที่เก็บรูปสลิป
--
-- ตั้งเป็น private (public = false) เพราะสลิปมีชื่อบัญชีและเลขบัญชีของลูกค้า
-- ถ้าเปิดสาธารณะ ใครเดา path ถูกก็เห็นข้อมูลการเงินคนอื่น
-- ฝั่งร้านเปิดดูผ่าน signed URL ที่หมดอายุเอง
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slips', 'slips', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- บอทอัปโหลดด้วย service_role ซึ่งข้าม RLS อยู่แล้ว
-- policy นี้ให้แอปฝั่งร้าน (ล็อกอินแล้ว) อ่านและลบได้
drop policy if exists "slips_authenticated_read" on storage.objects;
create policy "slips_authenticated_read"
  on storage.objects for select to authenticated
  using (bucket_id = 'slips');

drop policy if exists "slips_authenticated_delete" on storage.objects;
create policy "slips_authenticated_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'slips');
