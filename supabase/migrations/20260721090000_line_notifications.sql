-- คิวข้อความที่ต้อง push หาลูกค้าในไลน์
--
-- หน้าแอดมินเป็นเบราว์เซอร์ ส่ง LINE เองไม่ได้ — channel token ต้องอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น
-- (เหตุผลเดียวกับที่ล็อก anon ไว้ทั้งระบบ) แอดมินจึงแค่หยอดข้อความลงคิว
-- บอทที่ poll Supabase อยู่แล้วเป็นคนหยิบไปส่งด้วย token ของมัน
--
-- push นับโควต้า LINE — ใช้เฉพาะเหตุการณ์สำคัญ (ยืนยันเงิน) ไม่ใช่ทุกความเคลื่อนไหว
-- ที่ ~200 บิล/เดือน = ~200 push/เดือน ยังอยู่ในแผนฟรี

create table if not exists public.line_notifications (
  id            uuid primary key default gen_random_uuid(),
  line_user_id  text not null,
  message       text not null,
  order_id      uuid references public.orders(id) on delete set null,
  status        text not null default 'pending'
                check (status in ('pending', 'sent', 'failed')),
  error         text,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);

-- บอทดึงเฉพาะแถว pending เรียงเก่าสุดก่อน
create index if not exists line_notifications_pending_idx
  on public.line_notifications(created_at)
  where status = 'pending';

alter table public.line_notifications enable row level security;

-- แอดมิน (ล็อกอินแล้ว) หยอดคิวได้ / บอทอ่านแก้ด้วย service_role ที่ข้าม RLS
-- anon ไม่มี policy = แตะไม่ได้
drop policy if exists line_notifications_authenticated_all on public.line_notifications;
create policy line_notifications_authenticated_all
  on public.line_notifications for all to authenticated
  using (true) with check (true);
