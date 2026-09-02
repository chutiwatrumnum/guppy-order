-- ลายนิ้วมือของไฟล์สลิป ไว้จับสลิปซ้ำ
--
-- ไม่ได้อ่านตัวเลขจากรูป — แค่เทียบว่าไฟล์เดียวกันเคยส่งมาแล้วหรือยัง
-- ตรงข้ามกับ OCR ตรงที่มันบอกได้แน่นอน ไม่ใช่การเดา และไม่มีทางถูกหลอกด้วยการแก้ตัวเลข
--
-- จับได้ 2 เคส
--   1. ลูกค้ากดส่งซ้ำเพราะไม่แน่ใจว่าติดไหม → บิลเดียวกันมีสลิปสองใบเหมือนกันเป๊ะ
--   2. เอาสลิปเก่ามาใช้ปิดบิลใหม่ → ไฟล์ตรงกับใบที่ร้านเคยยืนยันไปแล้ว
--
-- เคสที่ 2 คือของจริงที่ต้องเตือน — แต่ยังให้คนตัดสิน ไม่ปฏิเสธเอง
-- ลูกค้าอาจส่งรูปเดิมซ้ำด้วยความบริสุทธิ์ใจ ระบบไม่ควรกล่าวหาใครเอง

alter table public.payment_slips
  add column if not exists image_hash text;

create index if not exists payment_slips_image_hash_idx
  on public.payment_slips(image_hash) where image_hash is not null;

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

  -- path ต้องอยู่ใต้โฟลเดอร์ของ token นี้เท่านั้น
  prefix := 'p/' || p_token || '/';
  if p_path is null or left(p_path, length(prefix)) <> prefix then
    return jsonb_build_object('ok', false, 'reason', 'bad_path');
  end if;

  fname := substring(p_path from length(prefix) + 1);
  if fname = '' or position('/' in fname) > 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad_path');
  end if;

  -- sha-256 เป็นเลขฐานสิบหก 64 ตัว อย่างอื่นถือว่าไม่ได้ส่งมา
  hash := lower(nullif(btrim(coalesce(p_image_hash, '')), ''));
  if hash is not null and hash !~ '^[0-9a-f]{64}$' then
    hash := null;
  end if;

  -- ไฟล์เดิมของบิลเดิมที่ยังรอตรวจอยู่ = กดส่งซ้ำ ไม่ต้องเพิ่มแถว
  -- ตอบ ok ไปตามปกติ ลูกค้าไม่ต้องรู้ว่าระบบกันซ้ำให้
  if hash is not null and exists (
    select 1 from public.payment_slips
    where order_id = o.id and image_hash = hash and status = 'pending'
  ) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  -- กันกดรัว ๆ จนสลิปท่วมหน้าร้าน
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

  -- แจ้งในแชทให้เหมือนตอนส่งสลิปเข้าไลน์ เฉพาะใบแรกและคนที่ผูก LINE ไว้จริง
  if n_slips = 0 and owner_id ~ '^U[0-9a-f]{32}$' then
    insert into public.line_notifications (line_user_id, order_id, message)
    values (
      owner_id,
      o.id,
      '🧾 ได้รับสลิปแล้วครับ' || E'\n' ||
      'บิล ' || o.order_number ||
      ' ยอด ฿' || to_char(coalesce(o.total_amount, 0), 'FM999,999,999') || E'\n\n' ||
      'ทางร้านกำลังตรวจสอบ เมื่อยืนยันแล้วสถานะในใบสรุปจะเปลี่ยนเป็น "ชำระเงินแล้ว" ครับ 🙏'
    );
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ตัวเดิม 3 อาร์กิวเมนต์ต้องทิ้ง ไม่งั้นเรียกแบบเดิมจะกำกวมกับตัวใหม่ที่มี default
drop function if exists public.submit_order_slip(text, text, text);

revoke all on function public.submit_order_slip(text, text, text, text) from public;
grant execute on function public.submit_order_slip(text, text, text, text) to anon, authenticated;

-- ── บอกร้านว่าสลิปใบไหนเคยเห็นมาก่อน ────────────────────────────────
-- คืนเฉพาะ "เคยยืนยันไปแล้ว" กับ "รอตรวจอยู่ที่บิลอื่น" ซึ่งเป็นสองอย่างที่ต้องดูซ้ำ
-- ไม่คืนรูปหรือ path ออกไป บอกแค่ว่าไปโผล่ที่บิลไหน
create or replace function public.slip_duplicates(p_hashes text[])
returns table (
  image_hash   text,
  slip_id      uuid,
  status       text,
  order_number text,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select ps.image_hash, ps.id, ps.status, o.order_number, ps.created_at
  from public.payment_slips ps
  left join public.orders o on o.id = ps.order_id
  where ps.image_hash = any(p_hashes)
  order by ps.created_at;
$$;

revoke all on function public.slip_duplicates(text[]) from public;
grant execute on function public.slip_duplicates(text[]) to authenticated;
