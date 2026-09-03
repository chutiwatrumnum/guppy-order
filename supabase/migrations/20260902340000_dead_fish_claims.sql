-- เคลมปลาตาย
--
-- ปลาตายระหว่างส่งแล้วร้านคืนเงินให้ ตอนนี้จ่ายคืนกันในแชทแล้วจบ
-- ไม่มีที่ไหนบันทึก เลยไม่รู้ว่าเดือนนี้ตายไปกี่ตัว คืนเงินไปเท่าไหร่
-- และกำไรที่หน้าสรุปก็สูงเกินจริงเพราะไม่เคยหักเงินที่คืนออก
--
-- หนึ่งแถว = ปลาหนึ่งสายพันธุ์ที่ตายในบิลหนึ่ง
-- ตายหลายพันธุ์ในบิลเดียวก็หลายแถว รวมยอดทีหลังได้ตรง
-- และแยกได้ว่าพันธุ์ไหนตายบ่อย ซึ่งเป็นสิ่งที่เอาไปแก้ที่ต้นทางได้จริง
-- (เปลี่ยนวิธีแพ็ค หรือเลิกสั่งพันธุ์นั้น)

create table if not exists public.claims (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  -- เก็บชื่อพันธุ์เป็นข้อความ ไม่อ้าง breeds
  -- ร้านลบ/แก้ชื่อพันธุ์ทีหลังได้ ประวัติเคลมต้องไม่เปลี่ยนตาม
  breed_name   text,
  dead_qty     integer not null check (dead_qty > 0),
  -- คืนเงินเท่าไหร่ — 0 ได้ กรณีส่งปลาชดเชยแทนเงิน
  refund_amount integer not null default 0 check (refund_amount >= 0),
  note         text,
  created_by   text,
  created_at   timestamptz not null default now()
);

create index if not exists claims_order_idx      on public.claims(order_id);
create index if not exists claims_created_at_idx on public.claims(created_at);

alter table public.claims enable row level security;

-- ร้านเท่านั้น ลูกค้าไม่ต้องเห็นตัวเลขนี้ (anon ไม่มี policy = เข้าไม่ได้)
drop policy if exists claims_authenticated_all on public.claims;
create policy claims_authenticated_all
  on public.claims for all to authenticated
  using (true) with check (true);
