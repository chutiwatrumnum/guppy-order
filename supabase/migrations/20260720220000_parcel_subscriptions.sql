-- รายการติดตามพัสดุของบอท LINE
--
-- เดิมเก็บเป็นไฟล์ JSON ใน /tmp ของ Render ซึ่งเป็น ephemeral
-- deploy ใหม่ / คอนเทนเนอร์รีสตาร์ท / free tier หลับแล้วตื่น → ไฟล์หายหมด
-- ลูกค้าที่รอพัสดุอยู่จะหยุดได้รับแจ้งเตือนโดยไม่มีใครรู้ตัว เพราะบอทไม่ error
--
-- ย้ายมาเก็บที่นี่แล้วได้ผลพลอยได้: บอทกับแอปออเดอร์ใช้ฐานเดียวกัน
-- ทำให้ต่อไปกรอกเลขพัสดุในหน้าแอดมินแล้วบอทเห็นเองได้ ไม่ต้องมี API คั่นกลาง

create table if not exists public.parcel_subscriptions (
  tracking_number text primary key,
  line_user_id    text not null,
  last_status     text,
  -- ผูกกับออเดอร์ได้ถ้ารู้ (ใช้ในเฟสถัดไป ตอนนี้ปล่อยว่างได้)
  order_id        uuid references public.orders(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists parcel_subscriptions_line_user_id_idx
  on public.parcel_subscriptions(line_user_id);

create index if not exists parcel_subscriptions_order_id_idx
  on public.parcel_subscriptions(order_id);

alter table public.parcel_subscriptions enable row level security;

-- บอทต่อด้วย service_role ซึ่งข้าม RLS อยู่แล้ว
-- policy นี้มีไว้ให้แอปฝั่งร้าน (ที่ล็อกอินแล้ว) อ่าน/แก้ได้
-- anon ไม่มี policy = เข้าไม่ได้ ตรงกับที่ล็อกไว้ทั้งระบบ
drop policy if exists parcel_subscriptions_authenticated_all on public.parcel_subscriptions;
create policy parcel_subscriptions_authenticated_all
  on public.parcel_subscriptions
  for all to authenticated
  using (true) with check (true);

-- อัปเดต updated_at อัตโนมัติ ใช้ดูว่ารายการไหนค้างนานผิดปกติ
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists parcel_subscriptions_touch on public.parcel_subscriptions;
create trigger parcel_subscriptions_touch
  before update on public.parcel_subscriptions
  for each row execute function public.touch_updated_at();
