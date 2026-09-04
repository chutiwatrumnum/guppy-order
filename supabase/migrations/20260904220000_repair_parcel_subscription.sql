-- ซ่อมการสมัครติดตามพัสดุที่หายไปเงียบ ๆ
--
-- เดิมแถวใน parcel_subscriptions ถูกสร้างที่เดียวคือตอนร้านกดบันทึกเลขพัสดุ
-- และต้องบังเอิญว่าตอนนั้นบิลผูกบัญชี LINE ไว้แล้วเท่านั้น ทำให้หลุดสามทาง:
--
--   1. ร้านกรอกเลขก่อนลูกค้าเปิดใบสรุป → โค้ดข้ามการสมัครไปเลย
--      พอลูกค้ามาเปิดทีหลัง ไม่มีอะไรย้อนไปสร้างแถวให้
--   2. ร้านกด "ปลดการผูก" (ซึ่งลบแถวทิ้ง) แล้วลูกค้าเปิดลิงก์ผูกใหม่
--      link_order_line_user ไม่เคยสร้างแถวคืน
--   3. tracking_number เป็น primary key — เอาเลขเดิมไปกรอกในบิลอื่น (เช่นบิลทดสอบ)
--      แล้ว upsert เขียนทับ line_user_id ทิ้ง คนที่รอพัสดุอยู่หลุดจากการติดตาม
--      โดยไม่มี error ให้ใครเห็น
--
-- ทั้งสามเคสอาการเหมือนกันหมด: ลูกค้ากด "พัสดุของฉัน" แล้วเจอ list_empty
-- ซึ่งอ่านแล้วเหมือนระบบยกเลิกการติดตามให้ ทั้งที่ลูกค้าไม่ได้ทำอะไรเลย

-- ── ตัวซิงก์กลาง ────────────────────────────────────────────────────
-- ใช้ออเดอร์เป็นแหล่งความจริง: บิลไหนมีทั้งเลขพัสดุและบัญชี LINE ต้องมีแถวติดตาม
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
-- ร้านเท่านั้น — anon ไม่ต้องเรียกเอง ทางนั้นวิ่งผ่าน trigger ที่รันสิทธิ์เจ้าของอยู่แล้ว
grant execute on function public.sync_parcel_subscription(uuid) to authenticated;

-- ── ผูกไว้กับตัวออเดอร์ ไม่ใช่กับหน้าจอใดหน้าจอหนึ่ง ────────────────
-- เลขพัสดุกับบัญชี LINE มาถึงคนละเวลาเสมอ และมาจากคนละหน้า
-- (ร้านกรอกเลขในหน้าแอดมิน / ลูกค้าผูกบัญชีตอนเปิดใบสรุป)
-- วางไว้ที่ตารางออเดอร์แล้วไม่ต้องสนใจว่าอันไหนมาก่อน
create or replace function public.orders_sync_parcel_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tracking_number is not null and new.line_user_id is not null then
    -- ล้มเหลวไม่ควรทำให้การบันทึกบิลพัง — ฟังก์ชันคืน jsonb ไม่ raise อยู่แล้ว
    perform public.sync_parcel_subscription(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists orders_sync_parcel_subscription on public.orders;
create trigger orders_sync_parcel_subscription
after insert or update of line_user_id, tracking_number on public.orders
for each row execute function public.orders_sync_parcel_subscription();

-- ── ซ่อมของที่หลุดไปแล้ว ────────────────────────────────────────────
-- เฉพาะบิลที่ยังส่งอยู่จริง ๆ (status = 'shipped') และไม่เกิน 30 วัน
--
-- ไม่กวาดทั้งตาราง: พัสดุที่ถึงมือไปแล้วถ้าถูกสมัครใหม่ last_status จะเป็น null
-- บอทรอบถัดไปจะเด้ง "จัดส่งสำเร็จ" ใส่ลูกค้าเก่าย้อนหลังเป็นสิบคน
do $$
declare
  r   record;
  res jsonb;
begin
  for r in
    select id, order_number
    from public.orders
    where status = 'shipped'
      and tracking_number is not null
      and line_user_id is not null
      and created_at > now() - interval '30 days'
    order by created_at
  loop
    res := public.sync_parcel_subscription(r.id);
    if coalesce((res->>'ok')::boolean, false) then
      if res->>'action' <> 'unchanged' then
        raise notice 'บิล %: %', r.order_number, res->>'action';
      end if;
    else
      raise notice 'บิล %: ข้าม (%) %', r.order_number, res->>'reason',
        coalesce(' — เลขไปอยู่กับบิล ' || (res->>'order_number'), '');
    end if;
  end loop;
end $$;
