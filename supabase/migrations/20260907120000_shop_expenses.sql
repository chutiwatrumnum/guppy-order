-- รายจ่ายของร้าน
--
-- บิลบอกได้แค่รายรับกับต้นทุนของที่ขายไป แต่เงินที่ออกจากร้านจริง ๆ มีมากกว่านั้น
-- ค่าอาหารที่ซื้อเข้า ค่าไฟ ค่ากล่อง ค่าน้ำมันไปส่งของ ค่าซื้อพ่อแม่พันธุ์
-- ทั้งหมดนี้ยังไม่มีที่เก็บ "กำไร" ที่เห็นในหน้าบิลจึงเป็นกำไรขั้นต้นของสินค้า
-- ไม่ใช่กำไรจริงของร้าน และเอาไปทำงบหรือยื่นภาษีไม่ได้
--
-- หนึ่งแถว = จ่ายเงินหนึ่งครั้ง

create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),

  -- วันที่จ่ายจริง ไม่ใช่วันที่คีย์เข้าระบบ — เก็บใบเสร็จไว้ทั้งเดือนแล้วมาคีย์ทีเดียวได้
  -- เป็น date ไม่ใช่ timestamptz เพราะงบดูกันเป็นวัน ไม่ต้องแบกเรื่องโซนเวลา
  spent_on     date not null default current_date,

  -- หมวดเก็บเป็นข้อความ ไม่ทำเป็นตารางแยกหรือ enum
  -- ร้านอยากเพิ่ม/เปลี่ยนชื่อหมวดเองได้โดยไม่ต้อง migrate ฐานข้อมูล
  category     text not null,

  -- numeric ไม่ใช่ integer — ค่าไฟค่าน้ำมีสตางค์ ปัดทิ้งแล้วยอดไม่ตรงใบเสร็จ
  amount       numeric(12, 2) not null check (amount > 0),

  note         text,

  -- path รูปใบเสร็จใน storage — เผื่อไว้ให้ทำทีหลัง ยังไม่มีหน้าให้แนบ
  receipt_path text,

  created_by   text,
  created_at   timestamptz not null default now()
);

-- งบดูทีละช่วงวันเสมอ
create index if not exists expenses_spent_on_idx on public.expenses(spent_on desc);

alter table public.expenses enable row level security;

-- ร้านเท่านั้น ลูกค้าไม่ต้องเห็น (anon ไม่มี policy = เข้าไม่ได้)
drop policy if exists expenses_authenticated_all on public.expenses;
create policy expenses_authenticated_all
  on public.expenses for all to authenticated
  using (true) with check (true);
