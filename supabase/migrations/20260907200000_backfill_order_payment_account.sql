-- เติมบัญชีรับเงินให้บิลเก่า
--
-- บิลที่ออกก่อนมีระบบหลายบัญชีไม่มี payment_account_id ทั้งหมดไปกองอยู่ใต้
-- "ไม่ระบุบัญชี" ในหน้าบัญชี ทั้งที่ความจริงเงินก้อนนั้นเข้าบัญชีเดียวที่ร้านมีตอนนั้น
-- (ตอนนั้นระบบเก็บบัญชีได้ช่องเดียวใน settings จึงไม่มีทางเข้าบัญชีอื่นได้เลย)
--
-- ⚠️ ตั้งต้นเป็น "บัญชีที่เก่าที่สุด" ซึ่งคือใบที่ย้ายมาจาก settings ตอนรัน
--    migration payment_accounts — เป็นบัญชีที่รับเงินก้อนนี้จริง
--    ไม่ใช่ "บัญชีที่ใช้อยู่ตอนนี้" เพราะถ้าสลับบัญชีไปแล้ว เงินเก่าจะไปโผล่ผิดบัญชี
--
--    อยากให้ไปลงบัญชีอื่นแทน เปลี่ยน target ข้างล่างเป็น
--      select id from public.payment_accounts where label = 'ชื่อบัญชีที่ต้องการ'
--
-- ข้อสมมติที่ต้องรู้: ถ้าที่ผ่านมาเคยให้ลูกค้าโอนเข้าหลายบัญชีโดยพิมพ์เลขบัญชีบอกเอง
-- นอกระบบ การเหมารวมแบบนี้จะไม่ตรงกับความจริง ให้แก้รายใบทีหลังในหน้าบิลแทน
--
-- รันซ้ำได้ ไม่ทับของที่ผูกไว้แล้ว (where payment_account_id is null)

with target as (
  select id
  from public.payment_accounts
  order by created_at asc
  limit 1
)
update public.orders o
set payment_account_id = (select id from target)
where o.payment_account_id is null
  and exists (select 1 from target);
