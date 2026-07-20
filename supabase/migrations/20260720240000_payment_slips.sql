-- สลิปโอนเงินที่ลูกค้าส่งเข้าไลน์
--
-- จงใจไม่อ่านตัวเลขจากรูปเพื่อตัดสินใจแทนคน
-- สลิปเป็นแค่ไฟล์ภาพ แก้ยอดใน 30 วินาที ระบบที่เชื่อ OCR = ยืนยันสลิปปลอมให้อัตโนมัติ
-- ที่นี่จึงเก็บสลิปไว้ "รอคนยืนยัน" แล้วช่วยจับคู่บิลให้ เพื่อลดงานเหลือแค่กดปุ่มเดียว
--
-- ถ้าวันหนึ่งต่อ API ตรวจสลิปกับธนาคาร ค่อยเติมผลตรวจลงตารางนี้แล้วยืนยันอัตโนมัติได้
-- โครงสร้างรองรับไว้แล้ว

create table if not exists public.payment_slips (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid references public.orders(id) on delete set null,
  line_user_id  text not null,
  -- path ในบัคเก็ต storage ไม่ใช่ URL เต็ม จะได้ย้ายที่เก็บทีหลังได้
  image_path    text not null,
  status        text not null default 'pending'
                check (status in ('pending', 'confirmed', 'rejected')),
  -- เผื่ออนาคตถ้าต่อ API ตรวจสลิป เก็บผลไว้ตรงนี้
  verified_amount   integer,
  verified_ref      text,
  reviewed_by       text,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists payment_slips_status_idx  on public.payment_slips(status);
create index if not exists payment_slips_order_idx   on public.payment_slips(order_id);
create index if not exists payment_slips_user_idx    on public.payment_slips(line_user_id);

-- กันสลิปใบเดิมถูกใช้ปิดหลายบิล (จะมีผลเมื่อต่อ API ตรวจสลิปแล้วมี ref จริง)
create unique index if not exists payment_slips_verified_ref_key
  on public.payment_slips(verified_ref) where verified_ref is not null;

alter table public.payment_slips enable row level security;

-- บอทเขียนด้วย service_role (ข้าม RLS) — policy นี้ให้แอปฝั่งร้านที่ล็อกอินแล้วอ่าน/ยืนยัน
-- anon ไม่มี policy = เข้าไม่ได้ ตรงกับที่ล็อกทั้งระบบไว้
drop policy if exists payment_slips_authenticated_all on public.payment_slips;
create policy payment_slips_authenticated_all
  on public.payment_slips for all to authenticated
  using (true) with check (true);

-- ── หาบิลที่น่าจะเป็นเจ้าของสลิป ────────────────────────────────────
-- คืนบิลที่ยังไม่จ่ายครบของลูกค้ารายนี้ ใหม่สุดก่อน
-- ไม่ตัดสินใจแทน แค่เรียงให้คนเลือกง่าย
create or replace function public.pending_orders_for_line_user(p_line_user_id text)
returns table (
  id            uuid,
  order_number  text,
  total_amount  integer,
  paid_amount   integer,
  created_at    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.order_number, o.total_amount, o.paid_amount, o.created_at
  from public.orders o
  where o.line_user_id = p_line_user_id
    and o.payment_status <> 'paid'
    and o.status <> 'cancelled'
  order by o.created_at desc
  limit 10;
$$;

revoke all on function public.pending_orders_for_line_user(text) from public;
grant execute on function public.pending_orders_for_line_user(text) to authenticated, service_role;
