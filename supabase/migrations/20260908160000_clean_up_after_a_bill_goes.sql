-- ลบ/ยกเลิกบิลแล้ว ของที่ผูกกับบิลต้องหายตามไปด้วย
--
-- unlink_order_line_user ทำถูกอยู่แล้ว (ลบแถวติดตามให้) แต่อีกสองทางไม่ทำ:
--
--   ลบบิล    orders.delete() ตรง ๆ และ FK เป็น on delete set null ทั้งสามตาราง
--            แถวลูกจึงไม่หาย แค่ถูกตัดสายสัมพันธ์ทิ้ง กลายเป็นแถวกำพร้า
--   ยกเลิกบิล เปลี่ยนแค่คอลัมน์ status ไม่แตะอะไรเลย
--
-- ผลคือบอทยังวนเช็กพัสดุของบิลที่ไม่มีอยู่แล้วทุก 3 นาที แล้ว push หาลูกค้า
-- ตอนออกไปนำจ่ายและตอนส่งถึง — เปลืองโควต้าและลูกค้างงว่าบิลไหน
--
-- แถมยังชนกันได้อีก: tracking_number เป็น primary key ถ้าเอาเลขเดิมไปใส่บิลใหม่
-- sync_parcel_subscription จะเจอ taken_by_other_order ทั้งที่บิลเจ้าของเดิมถูกลบไปแล้ว
-- ซึ่งเป็นบั๊กตระกูลเดียวกับที่ 20260904220000_repair_parcel_subscription แก้ไปรอบหนึ่ง

-- ── 1. ลบบิล → แถวลูกหายตาม ─────────────────────────────────────────
--
-- ห้ามใช้วิธีไล่ลบแถวที่ order_id is null เพราะค่านั้นไม่ได้แปลว่ากำพร้าเสมอไป
-- ลูกค้าส่งเลขพัสดุจากที่อื่นเข้ามาให้บอทตามได้ (store.subscribe ไม่ใส่ order_id)
-- แถวพวกนั้นเกิดมาโดยไม่มีบิลตั้งแต่แรกและต้องอยู่ต่อ
--
-- cascade แยกสองเคสนี้ออกจากกันได้เอง: ลบเฉพาะแถวที่เคยมีบิลแล้วบิลหายไป
do $$
declare
  t text;
  c text;
begin
  foreach t in array array['parcel_subscriptions', 'payment_slips']
  loop
    select con.conname into c
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
    where con.conrelid = ('public.' || t)::regclass
      and con.contype = 'f'
      and att.attname = 'order_id';

    if c is not null then
      execute format('alter table public.%I drop constraint %I', t, c);
    end if;

    execute format(
      'alter table public.%I add constraint %I foreign key (order_id)
         references public.orders(id) on delete cascade',
      t, t || '_order_id_fkey'
    );
  end loop;
end $$;

-- line_notifications ไม่ cascade — เก็บเป็นบันทึกว่าเคยส่งอะไรออกไปแล้วบ้าง
-- ข้อความที่ส่งไปถึงลูกค้าแล้วลบบิลทีหลังก็ไม่ได้ทำให้ข้อความนั้นไม่เคยเกิดขึ้น

-- ── 2. ลบบิล → ข้อความที่ยังไม่ได้ส่ง ต้องไม่ถูกส่ง ─────────────────
--
-- บอทดึงคิวจาก status = 'pending' โดยไม่สนใจ order_id
-- ถ้าปล่อยไว้ ข้อความของบิลที่เพิ่งลบจะยังไหลออกไปในรอบถัดไป (cron ทุก 1 นาที)
create or replace function public.drop_pending_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ลบทิ้งไม่ใช่ mark failed — หน้าแอดมินมีแผงข้อความที่ส่งไม่สำเร็จไว้ให้กดส่งซ้ำ
  -- ข้อความของบิลที่ถูกลบไม่ควรมีปุ่มให้กดส่งซ้ำตั้งแต่แรก
  delete from public.line_notifications
  where order_id = old.id and status = 'pending';
  return old;
end;
$$;

drop trigger if exists orders_drop_pending_notifications on public.orders;
create trigger orders_drop_pending_notifications
  before delete on public.orders
  for each row execute function public.drop_pending_notifications();

-- ── 3. ยกเลิกบิล → หยุดตามพัสดุ ─────────────────────────────────────
--
-- ทำเป็น trigger ไม่ใช่แก้ที่ปุ่มในหน้าแอดมิน เพราะสถานะเปลี่ยนได้หลายทาง
-- (dropdown ในตาราง, แก้จาก SQL, โค้ดอนาคตที่ยังไม่มี) — ดักที่ตารางครอบได้หมด
create or replace function public.stop_tracking_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.parcel_subscriptions where order_id = new.id;

  delete from public.line_notifications
  where order_id = new.id and status = 'pending';

  return new;
end;
$$;

drop trigger if exists orders_stop_tracking_on_cancel on public.orders;
create trigger orders_stop_tracking_on_cancel
  after update of status on public.orders
  for each row
  when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function public.stop_tracking_on_cancel();

-- ── หมายเหตุ: แถวกำพร้าที่มีอยู่แล้ว ────────────────────────────────
--
-- ตอนเขียนมีอยู่ 1 แถว (JD059589627TH) จากบิลทดสอบที่ถูกลบไป
-- จงใจไม่เก็บกวาดในนี้ — พัสดุใบนั้นเป็นของจริงและกำลังเดินทางไปหาลูกค้าจริง
-- ที่ได้ข้อความ "จัดส่งแล้ว" ไปแล้ว การหยุดตามกลางทางจะทำให้เขาไม่ได้รู้ว่าของถึง
-- ปล่อยไว้ให้ unsubscribe ตัวเองตอนนำจ่ายสำเร็จตามปกติ
--
-- ถ้าอยากตัดทิ้งจริง ๆ: delete from parcel_subscriptions where tracking_number = '...'
