-- ให้ลูกค้าอัปโหลดสลิปจากหน้าใบสรุปได้เอง
--
-- เดิมมีทางเดียวคือส่งรูปเข้าไลน์ แล้วบอทเดาว่าเป็นของบิลไหน
-- ซึ่งเดาได้ก็ต่อเมื่อลูกค้ามีบิลค้างใบเดียว มากกว่านั้นร้านต้องมานั่งจับคู่เอง
-- อัปจากหน้านี้ "รู้" ว่าบิลไหนตั้งแต่แรก เพราะ token อยู่ใน URL อยู่แล้ว
--
-- ทางไลน์ยังใช้ได้เหมือนเดิม ทั้งสองทางลง payment_slips ตารางเดียวกัน
-- ร้านเปิดดูที่เดิมที่เดียว ไม่ต้องแยก
--
-- ขอบเขตความปลอดภัยยังเป็น token เหมือน RPC ตัวอื่นในไฟล์ public_order_link:
-- มี token = ถือลิงก์บิลนั้นอยู่ = ทำกับบิลนั้นได้

-- ── 1. ตัวช่วยสำหรับ storage policy ─────────────────────────────────
-- policy ของ storage.objects ถูกประเมินในสิทธิ์ของ role ที่ยิงคำสั่ง
-- ถ้าเขียน `select from orders` ตรง ๆ ใน policy จะโดน RLS ของ orders บล็อก
-- (anon ไม่มี policy บน orders = อ่านไม่เห็นอะไรเลย) แล้ว check จะ false เสมอ
-- จึงต้องห่อด้วย security definer
--
-- ฟังก์ชันนี้บอกได้แค่ "token นี้มีจริงและบิลยังไม่ส่ง" ไม่คืนข้อมูลบิล
-- ใช้เดาสุ่มไม่ได้ เพราะ token คือ uuid v4 ตัดขีด 32 ตัว
create or replace function public.is_open_order_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders
    where public_token = p_token
      and status = 'pending'
  );
$$;

revoke all on function public.is_open_order_token(text) from public;
grant execute on function public.is_open_order_token(text) to anon, authenticated;

-- ── 2. ให้ anon อัปไฟล์เข้าบัคเก็ต slips ได้ ────────────────────────
-- ให้เฉพาะ insert ไม่ให้ select/update/delete
-- ลูกค้าจึงอัปได้อย่างเดียว อ่านสลิปของคนอื่นไม่ได้ ลบของตัวเองก็ไม่ได้
--
-- บังคับ path เป็น p/<token>/<ไฟล์> — ต้องรู้ token ถึงจะเขียนลงได้
-- prefix "p" แยกของที่ลูกค้าอัปเองออกจากของบอท (บอทใช้ <lineUserId>/...)
--
-- ขนาดไฟล์กับชนิดไฟล์ไม่ต้องเช็คตรงนี้ บัคเก็ตบังคับไว้แล้ว
-- (5MB, jpeg/png/webp — ดู migration slips_storage_bucket)
drop policy if exists "slips_anon_insert_with_token" on storage.objects;
create policy "slips_anon_insert_with_token"
  on storage.objects for insert to anon
  with check (
    bucket_id = 'slips'
    and (storage.foldername(name))[1] = 'p'
    and public.is_open_order_token((storage.foldername(name))[2])
  );

-- ── 3. บันทึกสลิปเข้าตาราง ──────────────────────────────────────────
-- แยกจากขั้นอัปไฟล์ เพราะ anon แตะ payment_slips ตรง ๆ ไม่ได้และไม่ควรได้
create or replace function public.submit_order_slip(
  p_token        text,
  p_path         text,
  p_line_user_id text default null
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
  -- ไม่งั้นคนที่มี token ของตัวเองจะชี้ไปที่ไฟล์ของบิลอื่นแล้วเคลมเป็นของตัวเองได้
  -- เทียบด้วย string ไม่ใช้ regex เพราะ p_token มาจากผู้ใช้
  prefix := 'p/' || p_token || '/';
  if p_path is null or left(p_path, length(prefix)) <> prefix then
    return jsonb_build_object('ok', false, 'reason', 'bad_path');
  end if;

  fname := substring(p_path from length(prefix) + 1);
  if fname = '' or position('/' in fname) > 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad_path');
  end if;

  -- กันกดรัว ๆ จนสลิปท่วมหน้าร้าน คนถือ token เดียวยัดได้ไม่เกินนี้
  select count(*) into n_slips
  from public.payment_slips
  where order_id = o.id and status = 'pending';

  if n_slips >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'too_many');
  end if;

  -- line_user_id เป็น not null แต่ลูกค้าอาจเปิดใบสรุปในเบราว์เซอร์ธรรมดา
  -- ลำดับ: ที่ส่งมาจากหน้าเว็บ → ที่ผูกไว้กับบิล → ทำเครื่องหมายว่ามาจากเว็บ
  -- ไม่ปลอมเป็น userId มั่ว ๆ เพราะบอทเอาค่านี้ไป push จริง
  owner_id := nullif(btrim(coalesce(p_line_user_id, '')), '');
  if owner_id is not null and owner_id !~ '^U[0-9a-f]{32}$' then
    owner_id := null;
  end if;
  owner_id := coalesce(owner_id, o.line_user_id, 'web:' || p_token);

  insert into public.payment_slips (order_id, line_user_id, image_path)
  values (o.id, owner_id, p_path);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_order_slip(text, text, text) from public;
grant execute on function public.submit_order_slip(text, text, text) to anon, authenticated;

-- ── 4. บอกหน้าใบสรุปว่าส่งสลิปมาแล้วหรือยัง ─────────────────────────
-- เดิมลูกค้าส่งสลิปแล้วหน้ายังขึ้น "รอชำระเงิน" เหมือนไม่มีอะไรเกิดขึ้น
-- เลยทักมาถามซ้ำว่าโอนแล้วนะ — เพิ่ม slip_status ให้แสดงสถานะกลางได้
--
-- ที่เหลือเหมือน migration public_order_link ทุกประการ รวมถึงการตัด cost ทิ้ง
create or replace function public.get_public_order(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o           public.orders%rowtype;
  s           public.settings%rowtype;
  safe_items  jsonb;
  slip_state  text;
begin
  if p_token is null or length(p_token) < 16 then
    return null;
  end if;

  select * into o from public.orders where public_token = p_token;
  if not found then
    return null;
  end if;

  select * into s from public.settings limit 1;

  -- ตัด cost ทิ้งทีละรายการ ห้ามให้ต้นทุนหลุดออกไปกับใบสรุป
  select coalesce(jsonb_agg(item - 'cost'), '[]'::jsonb)
    into safe_items
    from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) as item;

  -- สลิปใบล่าสุดของบิลนี้ ไม่คืนรูปหรือ path ออกไป บอกแค่สถานะ
  select ps.status into slip_state
  from public.payment_slips ps
  where ps.order_id = o.id
  order by ps.created_at desc
  limit 1;

  return jsonb_build_object(
    'order_number',     o.order_number,
    'created_at',       o.created_at,
    'items',            safe_items,
    'total_amount',     o.total_amount,
    'total_fish',       o.total_fish,
    'shipping_fee',     o.shipping_fee,
    'discount',         o.discount,
    'status',           o.status,
    'payment_status',   o.payment_status,
    'paid_amount',      o.paid_amount,
    'tracking_number',  o.tracking_number,
    'customer_name',    o.customer_name,
    'customer_phone',   o.customer_phone,
    'customer_address', o.customer_address,
    'note',             o.note,
    'slip_status',      slip_state,
    'payment', jsonb_build_object(
      'promptpay_id',   s.promptpay_id,
      'bank_name',      s.bank_name,
      'account_number', s.account_number,
      'account_name',   s.account_name
    )
  );
end;
$$;

revoke all on function public.get_public_order(text) from public;
grant execute on function public.get_public_order(text) to anon, authenticated;
