-- เวลาที่ร้านส่งของออกไป
--
-- ตอนนี้มี paid_at (จ่ายเงิน) กับ delivered_at (ถึงมือ) แต่ขาดตรงกลาง
-- ทำให้ตอบไม่ได้ว่า "ใบนี้ส่งไปกี่วันแล้วยังไม่ถึง" ซึ่งเป็นคำถามเดียว
-- ที่สำคัญจริงกับปลาเป็น — ยิ่งค้างนานยิ่งเสี่ยงตายกลางทาง
--
-- ตั้งตอนคีย์เลขพัสดุ ซึ่งเป็นจังหวะที่ของออกจากร้านจริง
-- ไม่ใช่ตอนกดเปลี่ยนสถานะเป็น "ส่งแล้ว" ด้วยมือ (กดตอนไหนก็ได้)

alter table public.orders
  add column if not exists shipped_at timestamptz;

create index if not exists orders_shipped_at_idx on public.orders(shipped_at);

comment on column public.orders.shipped_at is
  'เวลาที่คีย์เลขพัสดุ = ของออกจากร้าน คู่กับ paid_at และ delivered_at';

-- ไม่ backfill ใบเก่าด้วยเหตุผลเดียวกับ delivered_at
-- created_at คือตอนออกบิล ซึ่งห่างจากตอนส่งจริงเป็นวัน ๆ ได้
-- เอามาใช้แทนจะได้ "จำนวนวันขนส่ง" ที่ดูน่าเชื่อแต่ผิด
