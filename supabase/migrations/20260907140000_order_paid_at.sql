-- วันที่เงินเข้าจริง
--
-- ระบบรู้มาตลอดว่าบิลไหน "จ่ายแล้ว" แต่ไม่เคยรู้ว่าจ่าย *วันไหน*
-- ตราบใดที่ไม่มีวันที่ ก็ทำได้แค่งบตามวันที่ออกบิล ซึ่งไม่ตรงกับเงินที่เข้ากระเป๋าจริง
-- ในช่วงนั้น (บิลสิ้นเดือนที่ลูกค้าโอนเดือนถัดไป จะไปโผล่ผิดเดือนทั้งคู่)
--
-- เก็บเป็น timestamptz ไม่ใช่ date เพราะเวลาที่กดยืนยันคือหลักฐานที่ละเอียดที่สุดที่มี
-- ฝั่งแอปค่อยแปลงเป็นวันตามเวลาไทยตอนทำงบ

alter table public.orders add column if not exists paid_at timestamptz;

-- งบเกณฑ์เงินสดกรองด้วยคอลัมน์นี้ทุกครั้ง
create index if not exists orders_paid_at_idx on public.orders(paid_at);

-- เติมย้อนหลังเท่าที่มีหลักฐานจริงในระบบ: บิลที่ปิดด้วยสลิปที่ร้านกดยืนยันแล้ว
--
-- ⚠️ ค่าที่ได้คือ "เวลาที่ร้านกดยืนยันสลิป" ไม่ใช่ "เวลาที่เงินเข้าบัญชี"
--    ปกติห่างกันไม่กี่ชั่วโมง แต่บิลที่ยืนยันข้ามวันจะคาบเกี่ยวเดือนได้
--    บิลที่ปิดด้วยการกดสถานะเองในหน้าบิล ไม่มีหลักฐานเวลาเลย จึงปล่อยว่างไว้
--    ว่าง = "ไม่รู้ว่าเงินเข้าวันไหน" หน้าบัญชีจะนับแยกให้เห็น ไม่กลืนหายไปเฉย ๆ
update public.orders o
set paid_at = s.reviewed_at
from (
  select order_id, max(reviewed_at) as reviewed_at
  from public.payment_slips
  where status = 'confirmed'
    and reviewed_at is not null
    and order_id is not null
  group by order_id
) s
where o.id = s.order_id
  and o.paid_at is null
  and o.payment_status = 'paid';
