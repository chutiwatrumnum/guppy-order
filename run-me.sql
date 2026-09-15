-- ═══════════════════════════════════════════════
-- SQL ที่ค้าง — วางทั้งก้อนใน Supabase SQL Editor
-- รันซ้ำได้ ไม่พังถ้าบางส่วนเคยรันไปแล้ว
-- ═══════════════════════════════════════════════

-- ── 20260908200000_orders_delivered_at.sql ──

-- เวลาที่พัสดุถึงมือลูกค้าจริง
--
-- ตอนนี้สถานะ "ถึงแล้ว" ร้านกดเองทุกใบ — ในฐานข้อมูลมี 248 ใบที่กดไปแล้ว
-- ทั้งที่บอทรู้อยู่แล้วว่าใบไหนนำจ่ายสำเร็จเมื่อไหร่ (isDelivered ที่ index.js)
-- แต่เอาไปใช้แค่หยุดติดตาม ไม่เคยเขียนกลับมาที่บิล
--
-- เก็บเวลาไว้ด้วย ไม่ใช่แค่เปลี่ยนสถานะ — คู่กับ paid_at ที่มีอยู่แล้ว
-- จะได้ตอบได้ว่าจ่ายเงินแล้วกี่วันของถึง ซึ่งเป็นตัวเลขที่ร้านปลาเป็นต้องรู้
-- (ยิ่งนาน ยิ่งเสี่ยงปลาตายระหว่างทาง)

alter table public.orders
  add column if not exists delivered_at timestamptz;

create index if not exists orders_delivered_at_idx on public.orders(delivered_at);

comment on column public.orders.delivered_at is
  'เวลาที่ไปรษณีย์แจ้งนำจ่ายสำเร็จ — บอทเป็นคนเขียน ไม่ใช่เวลาที่ร้านกดปุ่ม';

-- ไม่ backfill ใบเก่า
--
-- 248 ใบที่เป็น delivered อยู่แล้วมาจากการที่ร้านกดเอง ซึ่งกดตอนไหนก็ได้
-- หลังของถึงจริงเป็นวัน ๆ ก็ได้ เดาเวลาย้อนหลังจะได้ตัวเลขที่ดูน่าเชื่อแต่ผิด
-- ปล่อยว่างไว้ตรงไปตรงมากว่า แล้วนับสถิติจากใบใหม่ที่บอทเขียนเอง

-- ── 20260908280000_orders_shipped_at.sql ──

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

-- ── 20260908300000_past_recipients.sql ──

-- จำ "ผู้รับ" ทั้งชุด ไม่ใช่แค่ที่อยู่
--
-- get_past_addresses คืนเฉพาะที่อยู่ ซึ่งแก้ปัญหาได้ครึ่งเดียว
-- เคสจริงที่เจอ: บัญชี LINE เดียวมี 3 ชื่อ 2 เบอร์ 2 ที่อยู่
-- (เคน / น้องเคน / ขวัญจิต หยังหลัง) เพราะสั่งให้ตัวเองสลับกับสั่งให้ญาติ
--
-- ชื่อ เบอร์ ที่อยู่ เปลี่ยนพร้อมกันทั้งชุดเสมอ — ไม่มีใครอยากได้ที่อยู่แม่
-- คู่กับเบอร์ตัวเอง เลือกทีเดียวทั้งชุดจึงถูกกว่าให้เลือกทีละช่อง
--
-- ขอบเขตกว้างกว่าเดิม: customer_id เดียวกัน "หรือ" บัญชี LINE เดียวกัน
-- เพราะ submit_order_contact หา customer จากเบอร์ พอกรอกเบอร์ญาติจะกลายเป็น
-- customer คนละคนทันที แล้วชุดของญาติจะหายไปจากรายการถ้าดูแค่ customer_id
-- ส่วนบัญชี LINE คือคนสั่ง ซึ่งเป็นคนเดิมตลอด

drop function if exists public.get_past_addresses(text);

create or replace function public.get_past_recipients(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o    public.orders%rowtype;
  list jsonb;
begin
  if p_token is null or length(p_token) < 16 then
    return '[]'::jsonb;
  end if;

  select * into o from public.orders where public_token = p_token;
  if not found then
    return '[]'::jsonb;
  end if;

  -- ไม่รู้ว่าเป็นใครทั้งสองทาง = ไม่มีอะไรให้เสนอ
  -- ห้ามตกไปใช้ชื่อหรือเบอร์ลอย ๆ คนละคนใช้ซ้ำกันได้
  if o.customer_id is null and o.line_user_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(r), '[]'::jsonb) into list
  from (
    select distinct on (btrim(customer_address))
      jsonb_build_object(
        'name',    nullif(btrim(coalesce(customer_name, '')), ''),
        'phone',   nullif(btrim(coalesce(customer_phone, '')), ''),
        'address', btrim(customer_address)
      ) as r,
      btrim(customer_address) as addr,
      max(created_at) over (partition by btrim(customer_address)) as latest
    from public.orders
    where btrim(coalesce(customer_address, '')) <> ''
      and (
        (o.customer_id  is not null and customer_id  = o.customer_id)
        or
        (o.line_user_id is not null and line_user_id = o.line_user_id)
      )
    -- ที่อยู่เดียวกันเอาใบล่าสุด ชื่อกับเบอร์จะได้เป็นเวอร์ชันที่ใหม่ที่สุด
    order by btrim(customer_address), created_at desc
  ) t
  where true
  limit 5;

  return list;
end;
$$;

revoke all on function public.get_past_recipients(text) from public;
grant execute on function public.get_past_recipients(text) to anon, authenticated;

-- ── 20260914180000_shipping_manual_message.sql ──

-- ข้อความตอนร้านต้องคัดลอกข้อความจัดส่งไปส่งเองในแชท
--
-- ตอน push ไม่ออก (โควต้า LINE หมด / ลูกค้าไม่ได้แอดร้าน) ร้านคัดลอกข้อความจากกล่อง
-- "ไม่ได้รับข้อความแจ้งเตือน" ในหน้าบิลไปวางในแชทเอง บรรทัด 🔔 ที่สัญญาว่าจะเด้งแจ้งเตือน
-- อัตโนมัติใช้ไม่ได้ในจังหวะนั้น เพราะแจ้งเตือนต่อจากนี้ก็ส่งไม่ออกเหมือนกัน
-- ร้านอยากบอกลูกค้าตรง ๆ ว่าระบบติดตามพัสดุมีปัญหา ให้กดเช็คเองไปก่อน
--
-- แยกคอลัมน์จาก shipping_message เพราะข้อความปกติยังส่งอัตโนมัติทุกบิล
-- เขียนเรื่องระบบมีปัญหาไว้ในนั้น ลูกค้าที่ได้ข้อความปกติจะเห็นด้วย
alter table public.settings
  add column if not exists shipping_manual_message text;

comment on column public.settings.shipping_manual_message is
  'ใส่แทนบรรทัด 🔔 ตอนร้านคัดลอกข้อความจัดส่งไปส่งเองในแชท — ว่าง = ไม่มีอะไรมาแทน';

-- คำตั้งต้น ร้านแก้ต่อได้ในหน้าตั้งค่า > ข้อความตอนแจ้งเลขพัสดุ
update public.settings
set shipping_manual_message =
  E'⚠️ ช่วงนี้ระบบแจ้งเตือนสถานะพัสดุมีปัญหาครับ\nรบกวนกดปุ่ม "พัสดุของฉัน" ที่เมนูด้านล่างแชทนี้ เพื่อเช็คสถานะเองไปก่อนนะครับ\n(ถ้าไม่เห็นเมนู พิมพ์ว่า พัสดุของฉัน ส่งมาก็ได้ครับ)'
where shipping_manual_message is null;

-- ── 20260915180000_list_last_delivered.sql ──

-- "พัสดุของฉัน" ตอนไม่มีของที่กำลังเดินทาง แต่กล่องล่าสุดเพิ่งส่งถึง
--
-- ของที่ส่งถึงแล้วหลุดจากรายการติดตามทันที เดิมบอทตอบ list_empty ว่า
-- "พอร้านส่งของ ระบบจะขึ้นให้เองอัตโนมัติ" ลูกค้าที่เพิ่งได้ของเลยเข้าใจว่าร้านยังไม่ส่ง
-- ตอนโควต้า LINE เต็มยิ่งหนัก ข้อความ "นำจ่ายสำเร็จ" ส่งไม่ออก ลูกค้าไม่เคยรู้เลยว่าของถึงแล้ว
-- (15 ก.ย. 69 เป็นแบบนี้ 12 บิลในวันเดียว)
--
-- บอทใช้ข้อความนี้แทนเมื่อลูกค้ามีบิลที่ไปรษณีย์ส่งถึงภายใน 7 วัน
-- และส่งการ์ดของไปรษณีย์ (มีชื่อผู้รับ) นำหน้าข้อความนี้ไปด้วย
--
-- ไม่รัน SQL นี้บอทก็ตอบได้ ใช้ข้อความสำรองในโค้ดซึ่งเหมือนข้างล่างทุกตัวอักษร
-- รันแล้วร้านแก้คำได้ที่หน้าตั้งค่า > ตั้งค่าร้าน > บอทตอบในแชท

insert into public.message_templates (key, label, description, group_key, body, variables, required, sort_order) values
('list_last_delivered', 'กล่องล่าสุดส่งถึงแล้ว',
 'ตอบเมื่อกด "พัสดุของฉัน" แล้วไม่มีของที่กำลังเดินทาง แต่มีกล่องที่ส่งถึงภายใน 7 วัน — ส่งต่อจากการ์ดของไปรษณีย์',
 'chat',
 E'📭 ตอนนี้ไม่มีพัสดุที่กำลังเดินทางครับ\n\n✅ กล่องล่าสุด {{tracking}}\nนำจ่ายสำเร็จเมื่อ {{time}}',
 array['tracking','time','order_number'], array['time'], 85)
on conflict (key) do nothing;

-- ── 20260916060000_tracking_follows_the_bill.sql ──

-- การติดตามพัสดุต้องตามบิลให้ทัน — สองจุดที่หลุด
--
-- 1. บิลที่จบแล้วถูกสมัครติดตามใหม่ → ลูกค้าได้ "นำจ่ายสำเร็จ" ซ้ำ
--
--    หน้าใบสรุปเรียก link_order_line_user ทุกครั้งที่ลูกค้าเปิดในแอป LINE และฟังก์ชันนั้น
--    เขียน line_user_id ทับค่าเดิมเสมอแม้เป็นคนเดิม trigger orders_sync_parcel_subscription
--    จึงทำงานทุกครั้งที่เปิดหน้า ส่วน sync_parcel_subscription ไม่เคยดูสถานะบิล
--    กล่องที่ส่งถึงแล้ว (แถวถูกลบไปตอนนำจ่ายสำเร็จ) เลยได้แถวใหม่ที่ last_status ว่าง
--    รอบเช็คถัดไปบอทเห็นเป็นกล่องที่เพิ่งเจอครั้งแรก ส่งการ์ดซ้ำอีกใบ เสียโควต้าอีกข้อความ
--    ลูกค้ามักเปิดใบสรุปทันทีที่ได้ปลา จังหวะจึงตรงกันพอดี
--
-- 2. แก้เลขพัสดุในบิลแล้ว เลขเก่ายังถูกตามต่อ
--
--    ตัวซิงก์ดูแต่เลขใหม่ แถวของเลขเก่าไม่มีใครลบ ถ้าเลขเก่าคือเลขที่กรอกผิด ไปรษณีย์ก็ไม่มี
--    ข้อมูลให้ตลอดกาล แถวนั้นจึงอยู่ถาวร บอทยิงเช็คทุก 30 นาที และลูกค้ากด "พัสดุของฉัน"
--    ทีไรก็เจอการ์ด "ยังไม่มีข้อมูลจากไปรษณีย์" ของกล่องที่ไม่มีอยู่จริง
--    เคสจริง: B20260831-0414 แก้เป็น JD059571586TH ตั้งแต่ต้นเดือน แต่บอทยังตาม JD059571566TH
--
-- ⚠️ รันหลัง deploy บอทเวอร์ชันที่มีกฎ "สถานะเก่ากว่า 12 ชั่วโมงไม่แจ้งลูกค้า" แล้วเท่านั้น
--    ท้ายไฟล์นี้สมัครติดตามบิลเก่าที่หลุดไปให้ใหม่ ถ้าบอทยังเป็นเวอร์ชันเดิม มันจะเห็นเป็น
--    กล่องที่เพิ่งเจอครั้งแรก แล้วส่ง "นำจ่ายสำเร็จ" ย้อนหลังให้ลูกค้าที่รับของไปนานแล้ว

-- ── 1. บิลที่จบแล้วไม่ต้องติดตาม ────────────────────────────────────
-- เหมือนเดิมทั้งฟังก์ชัน เพิ่มแค่ด่านสถานะบิลด่านเดียว
create or replace function public.sync_parcel_subscription(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o        public.orders%rowtype;
  ex       public.parcel_subscriptions%rowtype;
  tracking text;
  other    text;
begin
  select * into o from public.orders where id = p_order_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- ถึงมือแล้วหรือยกเลิกไปแล้ว ไม่มีอะไรให้ตามต่อ
  -- (ร้านแก้เลขพัสดุในบิลที่ปิดไปแล้ว หน้าแอดมินตั้งสถานะกลับเป็น shipped มาพร้อมกันเสมอ)
  if o.status in ('delivered', 'cancelled') then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;

  tracking := nullif(btrim(coalesce(o.tracking_number, '')), '');
  if tracking is null then
    return jsonb_build_object('ok', false, 'reason', 'no_tracking');
  end if;

  -- ยังไม่รู้จักบัญชี LINE ของบิลนี้ ยังสมัครแทนใครไม่ได้
  -- ไม่ต้องทำอะไร เดี๋ยวลูกค้าเปิดใบสรุปแล้ว trigger ข้างล่างจะเรียกซ้ำเอง
  if o.line_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_line_user');
  end if;

  select * into ex from public.parcel_subscriptions where tracking_number = tracking;

  if not found then
    insert into public.parcel_subscriptions (tracking_number, line_user_id, order_id)
    values (tracking, o.line_user_id, o.id);
    return jsonb_build_object('ok', true, 'action', 'created');
  end if;

  -- เลขนี้ติดตามอยู่แล้วและเป็นของลูกค้าคนเดียวกัน
  -- (ส่งรวมกล่องเดียวสองบิลก็มาทางนี้ — ปล่อยให้บิลแรกถือการติดตามไว้คนเดียวพอ)
  -- ห้ามแตะ last_status เด็ดขาด ล้างเมื่อไหร่ลูกค้าโดนแจ้งสถานะที่เคยได้ไปแล้วซ้ำ
  if ex.line_user_id = o.line_user_id then
    if ex.order_id is null then
      -- แถวกำพร้าเพราะบิลเดิมถูกลบ — รับมาเป็นของบิลนี้
      update public.parcel_subscriptions
      set order_id = o.id
      where tracking_number = tracking;
      return jsonb_build_object('ok', true, 'action', 'reattached');
    end if;
    return jsonb_build_object(
      'ok', true,
      'action', case when ex.order_id = o.id then 'unchanged' else 'shared' end
    );
  end if;

  -- ถึงตรงนี้คือจะย้ายการติดตามไปให้บัญชี LINE คนอื่น ซึ่งเป็นท่าที่ทำลูกค้าหลุดมาแล้ว
  -- บิลอื่นที่ยังอยู่ถืออยู่ → ไม่แย่ง ตีกลับให้ร้านเห็นว่าเลขไปชนกับบิลไหน
  -- (เคสจริง: เอาเลขของลูกค้าไปกรอกในบิลทดสอบที่ผูกบัญชี LINE ของร้านเอง)
  if ex.order_id is not null and ex.order_id <> o.id then
    select order_number into other from public.orders where id = ex.order_id;
    return jsonb_build_object(
      'ok', false,
      'reason', 'taken_by_other_order',
      'order_number', other
    );
  end if;

  -- แถวกำพร้า หรือบิลนี้เองที่เพิ่งเปลี่ยนไปผูกกับบัญชี LINE ใหม่
  -- คนใหม่ยังไม่เคยเห็นสถานะไหนของพัสดุนี้ ล้างความจำบอทให้แจ้งสถานะปัจจุบันหนึ่งครั้ง
  update public.parcel_subscriptions
  set line_user_id = o.line_user_id,
      order_id     = o.id,
      last_status  = null
  where tracking_number = tracking;

  return jsonb_build_object('ok', true, 'action', 'moved');
end;
$$;

revoke all on function public.sync_parcel_subscription(uuid) from public;
grant execute on function public.sync_parcel_subscription(uuid) to authenticated;

-- ── 2. เปลี่ยนเลขพัสดุ → เก็บแถวของเลขเก่าก่อน แล้วค่อยซิงก์เลขใหม่ ──
create or replace function public.orders_sync_parcel_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_tracking text;
  mate_id      uuid;
begin
  if tg_op = 'UPDATE' then
    old_tracking := nullif(btrim(coalesce(old.tracking_number, '')), '');

    if old_tracking is not null
       and old_tracking is distinct from nullif(btrim(coalesce(new.tracking_number, '')), '') then

      -- บิลอื่นที่ยังไม่จบยังใช้เลขเก่าอยู่ = กล่องนั้นมีจริงและยังเดินทางอยู่ (แพ็ครวมกล่อง)
      -- ยกแถวให้ใบนั้นถือต่อ ไม่ใช่ลบทิ้ง ไม่งั้นลูกค้าของกล่องนั้นหลุดจากการติดตามไปด้วย
      select id into mate_id
      from public.orders
      where id <> new.id
        and nullif(btrim(coalesce(tracking_number, '')), '') = old_tracking
        and status not in ('delivered', 'cancelled')
      order by created_at
      limit 1;

      if mate_id is not null then
        update public.parcel_subscriptions
        set order_id = mate_id
        where tracking_number = old_tracking and order_id = new.id;
      else
        delete from public.parcel_subscriptions
        where tracking_number = old_tracking and order_id = new.id;
      end if;
    end if;
  end if;

  if new.tracking_number is not null and new.line_user_id is not null then
    -- ล้มเหลวไม่ควรทำให้การบันทึกบิลพัง — ฟังก์ชันคืน jsonb ไม่ raise อยู่แล้ว
    perform public.sync_parcel_subscription(new.id);
  end if;
  return null;
end;
$$;

-- ── 3. เก็บกวาดของที่หลุดไปแล้ว ──────────────────────────────────────

-- แถวที่เลขไม่ตรงกับบิลที่ถืออยู่ และไม่มีบิลที่ยังไม่จบใบไหนใช้เลขนั้นแล้ว
-- (ตอนเขียนมีแถวเดียว: JD059571566TH ของบิล B20260831-0414 ที่แก้เลขไปเป็น ...586)
delete from public.parcel_subscriptions s
using public.orders o
where s.order_id = o.id
  and s.tracking_number is distinct from nullif(btrim(coalesce(o.tracking_number, '')), '')
  and not exists (
    select 1 from public.orders m
    where nullif(btrim(coalesce(m.tracking_number, '')), '') = s.tracking_number
      and m.status not in ('delivered', 'cancelled')
  );

-- บิลที่ยังเป็น "ส่งแล้ว" แต่ไม่มีใครติดตามเลขของมัน
--
-- ส่วนใหญ่คือใบที่แพ็ครวมกล่องกับใบที่ปิดไปแล้ว — บอทเวอร์ชันเก่าปิดแค่ใบที่ถือแถว
-- ใบที่เหลือในกล่องเดียวกันเลยค้างเป็น "ส่งแล้ว" ตลอดไป
-- สมัครให้ใหม่ แล้วบอทจะไปอ่านจากไปรษณีย์เองว่าถึงเมื่อไหร่ และปิดบิลให้
do $$
declare
  r   record;
  res jsonb;
begin
  for r in
    select o.id, o.order_number
    from public.orders o
    where o.status = 'shipped'
      and nullif(btrim(coalesce(o.tracking_number, '')), '') is not null
      and o.line_user_id is not null
      and o.created_at > now() - interval '30 days'
      and not exists (
        select 1 from public.parcel_subscriptions s
        where s.tracking_number = nullif(btrim(coalesce(o.tracking_number, '')), '')
      )
    order by o.created_at
  loop
    res := public.sync_parcel_subscription(r.id);
    raise notice 'บิล %: %', r.order_number, coalesce(res->>'action', res->>'reason');
  end loop;
end $$;

