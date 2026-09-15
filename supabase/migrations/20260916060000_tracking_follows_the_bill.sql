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
