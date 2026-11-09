-- ลดจำนวนข้อความที่กินโควต้า LINE
--
-- เพดานคือ 300 ข้อความ/เดือน พฤศจิกายนใช้ไป 102 ใน 9 วัน (11.3/วัน)
-- ที่อัตรานี้หมดราววันที่ 26 แล้วอีก 4 วันสุดท้ายลูกค้าจะไม่ได้รับอะไรเลย
-- เดือนกันยายนเกิดขึ้นมาแล้วจริง มี 14 ข้อความตกหล่นช่วงวันที่ 14-16
--
-- ตัดสองอย่างที่ลูกค้าเสียน้อยที่สุด แล้วทำเป็นสวิตช์ให้ร้านเปิดคืนได้เอง
-- ไม่ฝังการตัดสินใจไว้ในโค้ด เพราะพอยอดขายเปลี่ยนความคุ้มก็เปลี่ยนตาม

begin;

-- ── 1. "ได้รับสลิปแล้ว" ปิดไว้ก่อน ──────────────────────────────────
--
-- ลูกค้าเพิ่งเห็นข้อความเดียวกันบนหน้าใบสรุปตอนอัปโหลดเสร็จพอดี
-- ส่งซ้ำเข้าแชทอีกใบจึงได้ประโยชน์น้อยที่สุดในบรรดาข้อความทั้งหมด
-- และผลลัพธ์จริง (ยืนยันการชำระเงิน) ยังส่งเหมือนเดิม ลูกค้าไม่ได้ขาดข้อมูล
alter table public.settings
  add column if not exists push_slip_received boolean not null default false;

comment on column public.settings.push_slip_received is
  'ส่งข้อความ "ได้รับสลิปแล้ว" เข้าแชทไหม — ปิดไว้เพื่อประหยัดโควต้า หน้าใบสรุปบอกอยู่แล้ว';

-- ── 2. ไม่ต้องแจ้งตอนไปรษณีย์รับฝาก ─────────────────────────────────
--
-- ร้านเพิ่งส่งข้อความแจ้งเลขพัสดุไปเองไม่กี่ชั่วโมงก่อนหน้า
-- ลูกค้ารู้อยู่แล้วว่าของออกจากร้านไปแล้ว ขั้นนี้จึงไม่ได้บอกอะไรใหม่
-- เหลือ 3xx (ออกไปนำจ่าย) 4xx (นำจ่ายไม่สำเร็จ) 5xx (ถึงมือแล้ว) ซึ่งเป็นขั้นที่ต้องรู้จริง
update public.settings set parcel_push_tiers = array[3, 4, 5];

-- ── 3. ให้ฟังก์ชันอ่านสวิตช์ ────────────────────────────────────────
-- ต่อยอดจากสำเนาล่าสุด (20260904120000) เปลี่ยนแค่เงื่อนไขการแจ้ง
create or replace function public.submit_order_slip(
  p_token        text,
  p_path         text,
  p_line_user_id text default null,
  p_image_hash   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o        public.orders%rowtype;
  prefix   text;
  fname    text;
  n_slips  int;
  owner_id text;
  hash     text;
  msg      text;
  notify_slip boolean;
begin
  if p_token is null or length(p_token) < 16 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token');
  end if;

  select * into o from public.orders where public_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if o.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'already_shipped');
  end if;

  prefix := 'p/' || p_token || '/';
  if p_path is null or left(p_path, length(prefix)) <> prefix then
    return jsonb_build_object('ok', false, 'reason', 'bad_path');
  end if;

  fname := substring(p_path from length(prefix) + 1);
  if fname = '' or position('/' in fname) > 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad_path');
  end if;

  hash := lower(nullif(btrim(coalesce(p_image_hash, '')), ''));
  if hash is not null and hash !~ '^[0-9a-f]{64}$' then
    hash := null;
  end if;

  -- ไฟล์เดิมของบิลเดิมที่ยังรอตรวจอยู่ = กดส่งซ้ำ ไม่ต้องเพิ่มแถว
  if hash is not null and exists (
    select 1 from public.payment_slips
    where order_id = o.id and image_hash = hash and status = 'pending'
  ) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  select count(*) into n_slips
  from public.payment_slips
  where order_id = o.id and status = 'pending';

  if n_slips >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'too_many');
  end if;

  owner_id := nullif(btrim(coalesce(p_line_user_id, '')), '');
  if owner_id is not null and owner_id !~ '^U[0-9a-f]{32}$' then
    owner_id := null;
  end if;
  owner_id := coalesce(owner_id, o.line_user_id, 'web:' || p_token);

  insert into public.payment_slips (order_id, line_user_id, image_path, image_hash)
  values (o.id, owner_id, p_path, hash);

  select coalesce(push_slip_received, false) into notify_slip from public.settings limit 1;

  if notify_slip and n_slips = 0 and owner_id ~ '^U[0-9a-f]{32}$' then
    msg := public.render_template('slip_received', jsonb_build_object(
      'order_number', o.order_number,
      'total', to_char(coalesce(o.total_amount, 0), 'FM999,999,999')
    ));

    if msg is not null then
      insert into public.line_notifications (line_user_id, order_id, message)
      values (owner_id, o.id, msg);
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_order_slip(text, text, text, text) from public;
grant execute on function public.submit_order_slip(text, text, text, text) to anon, authenticated;

commit;
