-- หาลูกค้าด้วย LINE ก่อน แล้วค่อยเบอร์
--
-- เดิมหาด้วยเบอร์อย่างเดียว เบอร์เขียนคนละรูปแบบเมื่อไหร่ก็สร้างแถวใหม่ทันที
-- ในฐานข้อมูลจริงเคยมี "Chutiwat Rumnum" สองแถว LINE id เดียวกันเป๊ะ
-- ต่างกันแค่เบอร์ตกเลข 0 (823233256 กับ 0823233256)
--
-- ลำดับใหม่: LINE id → เบอร์ → สร้างใหม่
--
-- ลำดับนี้ทำให้ "รวมร่าง" ได้ด้วย: ลูกค้าเก่าที่มีแต่เบอร์ พอเปิดลิงก์ในไลน์ครั้งแรก
-- จะหา LINE ไม่เจอ แล้วตกไปเจอแถวเดิมด้วยเบอร์ จากนั้นเติม line_user_id ให้แถวนั้น
-- ไม่แตกเป็นสองแถวเหมือนก่อน
--
-- ข้อจำกัดที่ยังอยู่: customers มีช่องที่อยู่ช่องเดียว ลูกค้าที่ส่งหลายที่อยู่
-- จะถูกทับด้วยอันล่าสุดเสมอ ไม่ว่าจะยึดกุญแจไหน — หน้าใบสรุปจึงโชว์ที่อยู่เต็ม
-- พร้อมปุ่มแก้ไขไว้ ให้ลูกค้าเห็นก่อนกดส่งสลิปทุกครั้ง

create or replace function public.submit_order_contact(
  p_token   text,
  p_name    text,
  p_phone   text,
  p_address text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o             public.orders%rowtype;
  addr          text;
  digits        text;
  norm_ph       text;
  v_customer_id uuid;
begin
  if p_token is null or length(p_token) < 16 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token');
  end if;

  -- กันสแปมยัดข้อความยาว ๆ
  if length(coalesce(p_name, '')) > 200
     or length(coalesce(p_phone, '')) > 50
     or length(coalesce(p_address, '')) > 800 then
    return jsonb_build_object('ok', false, 'reason', 'too_long');
  end if;

  -- ── เบอร์โทร ──
  -- ให้เหลือเลขล้วนขึ้นต้น 0 เสมอ ร้านจะได้ก็อปไปกรอกฟอร์มส่งพัสดุได้เลย
  -- LINE ส่ง +66 มาบ่อย และลูกค้าพิมพ์ตกเลข 0 หน้าเป็นประจำ
  digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if digits <> '' then
    if left(digits, 2) = '66' and length(digits) >= 11 then
      digits := '0' || substring(digits from 3);
    elsif length(digits) = 9 and left(digits, 1) <> '0' then
      digits := '0' || digits;
    end if;

    -- มือถือ 10 หลัก / เบอร์บ้าน 9 หลัก
    if digits !~ '^0[0-9]{8,9}$' then
      return jsonb_build_object('ok', false, 'reason', 'bad_phone');
    end if;
    norm_ph := digits;
  end if;

  -- ── ที่อยู่ ──
  addr := btrim(coalesce(p_address, ''));
  if addr <> '' then
    -- รหัสไปรษณีย์ 5 หลักขึ้นต้น 1-9 (ไม่มีจังหวัดไหนขึ้นต้นด้วย 0)
    if addr !~ '(^|[^0-9])[1-9][0-9]{4}([^0-9]|$)' then
      return jsonb_build_object('ok', false, 'reason', 'no_postcode');
    end if;
    -- "9/9 ต.ก อ.ข ค 10000" ก็ 20 ตัวแล้ว สั้นกว่านี้ไม่น่าใช่ที่อยู่จริง
    if length(addr) < 15 then
      return jsonb_build_object('ok', false, 'reason', 'address_too_short');
    end if;
  end if;

  select * into o from public.orders where public_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if o.status <> 'pending' then
    -- ส่งของออกไปแล้ว แก้ที่อยู่ตอนนี้ไม่มีประโยชน์และทำให้เข้าใจผิด
    return jsonb_build_object('ok', false, 'reason', 'already_shipped');
  end if;

  -- ── หาว่าเป็นลูกค้าคนไหน ──
  -- 1) บิลนี้ผูกลูกค้าไว้แล้ว (ร้านเลือกตอนออกบิล) เชื่อตามนั้น
  v_customer_id := o.customer_id;

  -- 2) LINE id — เสถียรกว่าเบอร์ ไม่มีปัญหาเรื่องรูปแบบการเขียน
  if v_customer_id is null and o.line_user_id is not null then
    select id into v_customer_id
    from public.customers
    where line_user_id = o.line_user_id
    order by created_at
    limit 1;
  end if;

  -- 3) เบอร์ — ครอบคลุมลูกค้าที่ไม่เคยเปิดลิงก์ในไลน์
  if v_customer_id is null and norm_ph is not null then
    select id into v_customer_id
    from public.customers
    where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = norm_ph
    order by created_at
    limit 1;
  end if;

  if v_customer_id is not null then
    update public.customers
    set name              = coalesce(nullif(btrim(p_name), ''), name),
        phone             = coalesce(norm_ph,                  phone),
        address           = coalesce(nullif(addr, ''),         address),
        line_user_id      = coalesce(o.line_user_id,           line_user_id),
        line_display_name = coalesce(o.line_display_name,      line_display_name)
    where id = v_customer_id;

  -- 4) ไม่เจอเลย — สร้างใหม่ แต่ต้องมีอย่างน้อยเบอร์หรือ LINE ไว้อ้างอิงครั้งหน้า
  elsif norm_ph is not null or o.line_user_id is not null then
    insert into public.customers (name, phone, address, line_user_id, line_display_name)
    values (
      nullif(btrim(p_name), ''),
      norm_ph,
      nullif(addr, ''),
      o.line_user_id,
      o.line_display_name
    )
    returning id into v_customer_id;
  end if;

  update public.orders
  set customer_name    = coalesce(nullif(btrim(p_name), ''), customer_name),
      customer_phone   = coalesce(norm_ph,                   customer_phone),
      customer_address = coalesce(nullif(addr, ''),          customer_address),
      customer_id      = coalesce(v_customer_id,             customer_id)
  where public_token = p_token;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_order_contact(text, text, text, text) from public;
grant execute on function public.submit_order_contact(text, text, text, text) to anon, authenticated;
