-- ชุดที่ 2: สถานะออเดอร์ + การชำระเงิน
--
-- คอลัมน์ status / payment_status / payment_method ถูกสร้างไว้ตั้งแต่ migration เก่า
-- แต่ไม่เคยมีโค้ดเขียนหรืออ่านเลย ค่าที่มีอยู่จึงเป็น default ล้วน ๆ
-- ตรงนี้ใส่ข้อจำกัดให้ค่าที่รับได้ชัดเจน แล้วเพิ่มเลขพัสดุ

-- ค่าที่เป็นไปได้ให้ชัด กันข้อมูลขยะจากการพิมพ์มือ
alter table public.orders
  alter column status set default 'pending',
  alter column payment_status set default 'unpaid';

-- ข้อมูลเดิมเป็นค่า default ที่ไม่เคยถูกใช้จริง จึงไม่มีความหมายทางธุรกิจ
-- ตั้งให้ออเดอร์ที่บันทึกไว้ก่อนหน้านี้ = ขายจบแล้ว (จ่ายแล้ว + ส่งแล้ว)
-- เพราะถ้าตั้งเป็น unpaid หน้าแอดมินจะขึ้นยอดค้างชำระก้อนใหญ่ที่ไม่มีอยู่จริง
--
-- ถ้าความจริงไม่ใช่แบบนี้ แก้ทีหลังได้ด้วย:
--   update orders set payment_status = 'unpaid', paid_amount = 0 where created_at < '<วันที่>';
update public.orders
set status = case
      when status in ('pending', 'shipped', 'delivered', 'cancelled') then status
      else 'delivered'
    end,
    payment_status = case
      when payment_status in ('unpaid', 'deposit', 'paid') then payment_status
      else 'paid'
    end;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'shipped', 'delivered', 'cancelled'));

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('unpaid', 'deposit', 'paid'));

-- เลขพัสดุ + ยอดที่จ่ายมาแล้ว (สำหรับกรณีมัดจำ)
alter table public.orders
  add column if not exists tracking_number text,
  add column if not exists paid_amount integer not null default 0;

create index if not exists orders_payment_status_idx on public.orders(payment_status);
create index if not exists orders_status_idx on public.orders(status);

-- ออเดอร์เก่าถือว่าจ่ายครบและส่งแล้ว จึงตั้งยอดที่จ่ายให้เท่ายอดบิล
update public.orders set paid_amount = total_amount
where payment_status = 'paid' and paid_amount = 0;
