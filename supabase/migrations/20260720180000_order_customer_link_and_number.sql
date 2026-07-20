-- ชุดที่ 1: หยุดข้อมูลหาย + เลิกให้ยอดลูกค้าเพี้ยน
--
-- ปัญหาเดิม
--   1. เบอร์โทร/ที่อยู่ที่กรอกตอนสั่งซื้อ ไม่เคยถูกบันทึกลงออเดอร์ (คอลัมน์ว่างมาตลอด)
--   2. ออเดอร์ผูกกับลูกค้าด้วย customer_name ที่เป็น text ทำให้ลูกค้าเปลี่ยนชื่อแล้วขาดจากกัน
--   3. customers.total_orders / total_spent เก็บเป็นตัวเลขนิ่งที่บวกเพิ่มอย่างเดียว
--      ลบหรือแก้ออเดอร์แล้วไม่เคยลดลง → เพี้ยนสะสมถาวร

-- ── 1. ผูกออเดอร์กับลูกค้าด้วย id ────────────────────────────────────
alter table public.orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

create index if not exists orders_customer_id_idx on public.orders(customer_id);

-- backfill ของเดิมด้วยการจับคู่ชื่อ (เท่าที่จับได้)
update public.orders o
set customer_id = c.id
from public.customers c
where o.customer_id is null
  and o.customer_name is not null
  and lower(btrim(o.customer_name)) = lower(btrim(c.name));

-- ── 2. เลขที่บิล ────────────────────────────────────────────────────
create sequence if not exists public.order_number_seq;

update public.orders
set order_number = 'B'
  || to_char(created_at at time zone 'Asia/Bangkok', 'YYYYMMDD')
  || '-'
  || lpad(nextval('public.order_number_seq')::text, 4, '0')
where order_number is null;

create unique index if not exists orders_order_number_key on public.orders(order_number);

create or replace function public.set_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null then
    new.order_number := 'B'
      || to_char(coalesce(new.created_at, now()) at time zone 'Asia/Bangkok', 'YYYYMMDD')
      || '-'
      || lpad(nextval('public.order_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists orders_set_order_number on public.orders;
create trigger orders_set_order_number
  before insert on public.orders
  for each row execute function public.set_order_number();

-- ── 3. ยอดลูกค้าคำนวณสดจากออเดอร์จริง ───────────────────────────────
-- security_invoker ทำให้ view เคารพ RLS ของคนเรียก ไม่ใช่ของคนสร้าง view
create or replace view public.customer_order_stats
with (security_invoker = true) as
select
  c.id                                   as customer_id,
  count(o.id)                            as total_orders,
  coalesce(sum(o.total_amount), 0)::bigint as total_spent,
  coalesce(sum(o.total_fish), 0)::bigint  as total_fish,
  max(o.created_at)                      as last_order_at
from public.customers c
left join public.orders o on o.customer_id = c.id
group by c.id;

grant select on public.customer_order_stats to authenticated;
