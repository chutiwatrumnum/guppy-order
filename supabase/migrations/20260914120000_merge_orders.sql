-- รวมบิลของลูกค้าคนเดียวกันให้เหลือใบเดียว
--
-- ลูกค้าสั่งเพิ่มหลังออกบิลไปแล้ว ร้านได้บิลสองใบ ยอดสองก้อน ลิงก์สองอัน
-- ปุ่ม "รวมกล่อง" แค่ให้ใช้เลขพัสดุเดียวกัน ยังเก็บเงินสองรอบและคิดค่าส่งสองครั้งอยู่ดี
--
-- ทำในฟังก์ชันเดียว ไม่ไล่ยิงทีละคำสั่งจากหน้าเว็บ — ย้ายรายการ ย้ายเงิน ย้ายสลิป
-- และยกเลิกบิลเดิม ต้องสำเร็จพร้อมกันหรือไม่เกิดเลย ถ้าค้างครึ่งทาง
-- ลูกค้าจะโดนเก็บเงินซ้ำ หรือเงินที่จ่ายแล้วหายไปจากบัญชี
--
-- p_apply = false คืนตัวเลขที่จะได้โดยไม่แตะอะไร หน้าเว็บเอาไปโชว์ให้ร้านดูก่อนกดยืนยัน
-- ตัวเลขที่ร้านเห็นกับที่บันทึกจริงจึงมาจากสูตรเดียวกันเสมอ

create or replace function public.merge_orders(
  p_target  uuid,
  p_sources uuid[],
  p_apply   boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t          public.orders%rowtype;
  s          public.orders%rowtype;
  v_ids      uuid[];
  v_items    jsonb;
  v_numbers  text[] := array[]::text[];
  v_accounts uuid[];
  v_ship     integer;
  v_subtotal integer;
  v_total    integer;
  v_fish     integer;
  v_cost     integer;
  v_discount integer;
  v_paid     integer;
  v_paid_at  timestamptz;
  v_status   text;
  v_result   jsonb;
begin
  p_sources := array(select distinct x from unnest(p_sources) as x where x is not null);

  if p_target is null
     or coalesce(array_length(p_sources, 1), 0) = 0
     or p_target = any(p_sources) then
    return jsonb_build_object('ok', false, 'reason', 'bad_input');
  end if;

  v_ids := p_target || p_sources;

  -- ล็อกทุกใบก่อนอ่าน กันกดรวมพร้อมกันสองเครื่อง หรือสลิปถูกยืนยันแทรกเข้ามาระหว่างคำนวณ
  -- เรียงตาม id ให้ทุกคนล็อกลำดับเดียวกัน จะได้ไม่ติด deadlock
  perform 1 from public.orders where id = any(v_ids) order by id for update;

  select * into t from public.orders where id = p_target;
  if not found
     or (select count(*) from public.orders where id = any(p_sources)) <> array_length(p_sources, 1) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- รวมได้เฉพาะใบที่ยังรอส่ง ใบที่มีเลขพัสดุคือกล่องที่ออกไปแล้ว ใช้ "รวมกล่อง" แทน
  if exists (
    select 1 from public.orders
    where id = any(v_ids)
      and (status is distinct from 'pending' or nullif(btrim(tracking_number), '') is not null)
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_pending');
  end if;

  -- รวมได้เฉพาะบิลที่ออกภายใน 7 วันที่ผ่านมา (ร้านกำหนด)
  --
  -- รวมแล้วยอดขายของทุกใบไปอยู่วันของใบที่เหลือ บิลยิ่งเก่า ยอดยิ่งย้ายข้ามวันข้ามเดือนไปไกล
  -- เปลี่ยนเลขนี้เมื่อไหร่ ต้องแก้ MERGE_WINDOW_DAYS ในหน้าแอดมินให้ตรงกันด้วย
  if exists (
    select 1 from public.orders
    where id = any(v_ids) and created_at < now() - interval '7 days'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'too_old');
  end if;

  -- สลิปที่ยังรอตรวจ: ปุ่มยืนยันสลิปตั้งบิลเป็น "จ่ายแล้ว" ด้วยยอดทั้งบิล
  -- ถ้าย้ายสลิปของใบเล็กมาอยู่ใบรวมแล้วกดยืนยัน ใบรวมทั้งใบจะกลายเป็นจ่ายครบ
  if exists (
    select 1 from public.payment_slips
    where order_id = any(v_ids) and status = 'pending'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'pending_slips');
  end if;

  -- เงินเข้าคนละบัญชี รวมเป็นก้อนเดียวแล้วยอดแยกรายบัญชีในหน้าบัญชีจะผิด
  select array_agg(distinct payment_account_id) into v_accounts
  from public.orders
  where id = any(v_ids)
    and coalesce(paid_amount, 0) > 0
    and payment_account_id is not null;

  if coalesce(array_length(v_accounts, 1), 0) > 1 then
    return jsonb_build_object('ok', false, 'reason', 'different_accounts');
  end if;

  -- ── ตัวเลขของใบรวม ──
  --
  -- ยอดแต่ละใบ = ค่าปลา − ส่วนลด + ค่าส่ง ถอดค่าส่งออกทุกใบ แล้วบวกกลับครั้งเดียว
  -- ไม่คำนวณราคาปลาใหม่ในนี้ ของแถมกับส่วนลดรายตัวคิดไว้แล้วตอนออกบิล
  -- ถ้าเขียนสูตรเดียวกันซ้ำในฐานข้อมูล วันไหนสูตรหน้าเว็บเปลี่ยน สองที่จะเริ่มคิดไม่ตรงกัน
  --
  -- ค่าส่งเอาของใบที่ถูกที่สุด: ส่งกล่องเดียว และถ้าร้านเคยให้ฟรีค่าส่งกับใบไหนไว้ ใบรวมก็ยังฟรี
  -- ค่าส่งว่างนับเป็น 60 ตามที่หน้าเว็บตีความมาตลอด
  select
    min(coalesce(shipping_fee, 60)),
    sum(coalesce(total_amount, 0) - coalesce(shipping_fee, 60)),
    sum(coalesce(total_fish, 0)),
    sum(coalesce(total_cost, 0)),
    sum(coalesce(discount, 0)),
    sum(coalesce(paid_amount, 0)),
    -- เงินก้อนแรกเข้าเมื่อไหร่ ใช้วันนั้น
    min(paid_at) filter (where coalesce(paid_amount, 0) > 0)
  into v_ship, v_subtotal, v_fish, v_cost, v_discount, v_paid, v_paid_at
  from public.orders
  where id = any(v_ids);

  v_total := greatest(0, v_subtotal + v_ship);
  v_status := case
    when v_paid <= 0 then 'unpaid'
    when v_paid >= v_total then 'paid'
    else 'deposit'
  end;

  -- รายการของใบหลักขึ้นก่อน ตามด้วยใบที่รวมเข้ามาเรียงตามเวลาสั่ง
  v_items := coalesce(t.items, '[]'::jsonb);
  for s in select * from public.orders where id = any(p_sources) order by created_at loop
    v_items := v_items || coalesce(s.items, '[]'::jsonb);
    v_numbers := v_numbers || coalesce(s.order_number, s.id::text);
  end loop;

  v_result := jsonb_build_object(
    'ok',             true,
    'applied',        p_apply is true,
    'order_number',   t.order_number,
    'merged',         to_jsonb(v_numbers),
    'items',          jsonb_array_length(v_items),
    'total_fish',     v_fish,
    'shipping_fee',   v_ship,
    'discount',       v_discount,
    'total_amount',   v_total,
    'paid_amount',    v_paid,
    'payment_status', v_status,
    -- ลูกค้าจ่ายแยกมาแล้วทั้งสองใบ ค่าส่งที่ตัดออกไปกลายเป็นเงินเกิน ร้านต้องรู้ไว้คืน
    'overpaid',       greatest(0, v_paid - v_total)
  );

  -- ถามดูเฉย ๆ — ใช้ is not true ไม่ใช่ not เพราะถ้าส่ง null มา
  -- not p_apply จะเป็น null แล้ว if จะข้ามไปบันทึกจริงทั้งที่ไม่ได้สั่ง
  if p_apply is not true then
    return v_result;
  end if;

  -- ── บันทึก ──

  -- สลิปกับเคลมตามไปอยู่ใบรวม ปล่อยไว้กับใบเดิม วันหลังลบใบเดิมทิ้ง หลักฐานการโอนจะหายตาม (cascade)
  update public.payment_slips set order_id = p_target where order_id = any(p_sources);
  update public.claims        set order_id = p_target where order_id = any(p_sources);

  update public.orders
  set items              = v_items,
      total_amount       = v_total,
      total_fish         = v_fish,
      total_cost         = v_cost,
      discount           = v_discount,
      shipping_fee       = v_ship,
      paid_amount        = v_paid,
      payment_status     = v_status,
      paid_at            = case when v_paid > 0 then v_paid_at end,
      payment_account_id = coalesce(v_accounts[1], payment_account_id),
      note               = concat_ws(E'\n', nullif(btrim(note), ''),
                             'รวมบิล ' || array_to_string(v_numbers, ', ') || ' เข้ามาในบิลนี้แล้ว')
  where id = p_target;

  -- ช่องที่ใบหลักยังว่าง เติมจากใบที่รวมเข้ามา (ใบล่าสุดก่อน)
  -- เช่นร้านออกใบหลักโดยไม่มีที่อยู่ แต่ลูกค้ากรอกไว้ในอีกใบแล้ว จะได้ไม่ต้องทักขอใหม่
  update public.orders o
  set customer_id      = coalesce(o.customer_id, d.customer_id),
      customer_name    = coalesce(nullif(btrim(o.customer_name), ''), d.customer_name),
      customer_phone   = coalesce(nullif(btrim(o.customer_phone), ''), d.customer_phone),
      customer_address = coalesce(nullif(btrim(o.customer_address), ''), d.customer_address)
  from (
    select
      (array_agg(customer_id order by created_at desc)
         filter (where customer_id is not null))[1] as customer_id,
      (array_agg(customer_name order by created_at desc)
         filter (where nullif(btrim(customer_name), '') is not null))[1] as customer_name,
      (array_agg(customer_phone order by created_at desc)
         filter (where nullif(btrim(customer_phone), '') is not null))[1] as customer_phone,
      (array_agg(customer_address order by created_at desc)
         filter (where nullif(btrim(customer_address), '') is not null))[1] as customer_address
    from public.orders
    where id = any(p_sources)
  ) d
  where o.id = p_target;

  -- LINE ย้ายมาเป็นคู่ (ไอดีกับชื่อบัญชีต้องมาจากใบเดียวกัน) และเฉพาะตอนใบหลักยังไม่ผูก
  -- ลูกค้าจะได้แจ้งเตือนพัสดุของกล่องนี้ แม้เคยเปิดแต่ลิงก์ของอีกใบ
  update public.orders o
  set line_user_id      = d.line_user_id,
      line_display_name = d.line_display_name
  from (
    select line_user_id, line_display_name
    from public.orders
    where id = any(p_sources) and line_user_id is not null
    order by created_at desc
    limit 1
  ) d
  where o.id = p_target and o.line_user_id is null;

  -- ใบที่ถูกรวม: ยกเลิก และล้างตัวเลขทิ้ง
  --
  -- หน้าสรุปยอดบวกยอดทุกบิลในช่วง รวมบิลที่ยกเลิกด้วย ถ้าปล่อยตัวเลขไว้
  -- ยอดขาย ค่าส่ง และต้นทุนของใบนี้จะถูกนับซ้ำกับใบรวม
  -- หน้าบัญชีโหมดเงินสดนับจาก paid_at เงินจึงต้องย้ายออกจริง ไม่งั้นรายรับซ้ำ
  -- รายการปลาไม่ได้หาย อยู่ในใบรวมแล้ว หมายเหตุบอกลูกค้าที่เปิดลิงก์เก่าว่าไปอยู่ใบไหน
  --
  -- การติดตามพัสดุกับข้อความที่ค้างส่งของใบนี้ trigger orders_stop_tracking_on_cancel เก็บให้เอง
  update public.orders
  set status              = 'cancelled',
      items               = '[]'::jsonb,
      total_amount        = 0,
      total_fish          = 0,
      total_cost          = 0,
      discount            = 0,
      shipping_fee        = 0,
      actual_shipping_fee = null,
      paid_amount         = 0,
      payment_status      = 'unpaid',
      paid_at             = null,
      note                = concat_ws(E'\n', 'รวมเข้าบิล ' || coalesce(t.order_number, '') || ' แล้ว',
                              nullif(btrim(note), ''))
  where id = any(p_sources);

  return v_result;
end;
$$;

revoke all on function public.merge_orders(uuid, uuid[], boolean) from public;
-- ร้านเท่านั้น ลูกค้าเรียกเองไม่ได้
grant execute on function public.merge_orders(uuid, uuid[], boolean) to authenticated;
