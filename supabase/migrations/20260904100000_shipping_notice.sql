-- ข้อความ + รูปที่ส่งให้ลูกค้าตอนแจ้งเลขพัสดุ
--
-- เดิมร้านพิมพ์เองในไลน์ทุกครั้ง: ลิงก์เช็คเลขพัสดุ ขอรีวิว ลิงก์ TikTok
-- แล้วส่งรูปวิธีรับของกับวิธีเลี้ยงตามไปอีก 2 ใบ
-- ทำมือทุกบิลแปลว่าลืมได้ และคำก็เพี้ยนไปเรื่อย ๆ
--
-- เก็บเป็นการตั้งค่า ไม่ฝังในโค้ด — ลิงก์ TikTok กับคำขอรีวิวเป็นของที่เปลี่ยนบ่อย
-- ร้านต้องแก้เองได้โดยไม่ต้องรอ deploy

alter table public.settings
  add column if not exists shipping_message text;

-- URL รูปแนบ เรียงตามลำดับที่จะส่ง
alter table public.settings
  add column if not exists shipping_images text[] not null default '{}';

-- คิวแจ้งเตือนเดิมส่งได้แต่ข้อความ
alter table public.line_notifications
  add column if not exists images text[] not null default '{}';

-- ── ที่เก็บรูปประกาศ ────────────────────────────────────────────────
--
-- ต้อง public จริง ๆ ต่างจากบัคเก็ต slips ที่เป็น private
-- LINE ไปดึงรูปจาก originalContentUrl เองโดยไม่มี auth ใด ๆ
-- ถ้าใช้ signed URL รูปจะหมดอายุแล้วข้อความเก่าที่ลูกค้าเลื่อนกลับมาดูจะพัง
--
-- ในนี้มีแต่ภาพประกาศที่ร้านตั้งใจให้ทุกคนเห็นอยู่แล้ว ไม่มีข้อมูลส่วนตัว
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notices', 'notices', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png'];

-- อ่านได้ทุกคน (บัคเก็ต public แล้วก็จริง แต่ประกาศ policy ไว้ให้ชัด)
drop policy if exists "notices_public_read" on storage.objects;
create policy "notices_public_read"
  on storage.objects for select to public
  using (bucket_id = 'notices');

-- อัป/ลบได้เฉพาะร้านที่ล็อกอินแล้ว
drop policy if exists "notices_authenticated_write" on storage.objects;
create policy "notices_authenticated_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'notices');

drop policy if exists "notices_authenticated_delete" on storage.objects;
create policy "notices_authenticated_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'notices');
