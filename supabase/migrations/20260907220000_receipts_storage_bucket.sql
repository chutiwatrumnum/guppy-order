-- ที่เก็บรูปใบเสร็จรายจ่าย
--
-- ตาราง expenses มีคอลัมน์ receipt_path รออยู่แล้วตั้งแต่ทำหน้าบัญชี
-- ตัวเลขที่พิมพ์เองไม่ใช่หลักฐาน ถ้าจะเอาไปใช้ยื่นภาษีต้องมีรูปใบเสร็จคู่กัน
--
-- private เหมือนบัคเก็ต slips — ใบเสร็จมีข้อมูลการเงินของร้าน ไม่มีเหตุผลให้เปิดสาธารณะ
-- ฝั่งร้านเปิดดูผ่าน signed URL ที่หมดอายุเอง
--
-- file_size_limit 600KB เป็นด่านสุดท้ายกัน egress เหมือนบัคเก็ต breeds
-- ฝั่งเว็บย่อเหลือ ~150KB ก่อนอัปอยู่แล้ว (src/utils/image.ts)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 614400, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "receipts_authenticated_read" on storage.objects;
create policy "receipts_authenticated_read"
  on storage.objects for select to authenticated
  using (bucket_id = 'receipts');

drop policy if exists "receipts_authenticated_write" on storage.objects;
create policy "receipts_authenticated_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts');

drop policy if exists "receipts_authenticated_delete" on storage.objects;
create policy "receipts_authenticated_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'receipts');
