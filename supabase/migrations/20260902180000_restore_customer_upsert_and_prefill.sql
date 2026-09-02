-- 1) แก้ของที่พังไปกับ migration ตรวจที่อยู่
-- 2) ลูกค้าเก่าไม่ต้องพิมพ์ที่อยู่ซ้ำ
--
-- migration 20260902160000 เขียนทับ submit_order_contact โดยอ้างอิงเวอร์ชันจาก
-- public_order_link ซึ่งเก่ากว่าของจริงไปหนึ่งรุ่น ผลคือส่วนที่ upsert ลูกค้า
-- (เพิ่มใน customer_on_contact_submit) หายไปทั้งก้อน
--
-- ที่หายไปคือ: สร้าง/อัปเดตแถวใน customers, ผูก orders.customer_id
-- อาการที่เห็นคือ ฐานลูกค้าหยุดโต ทั้งที่ลูกค้ากรอกที่อยู่เข้ามาปกติ
-- ไฟล์นี้เอากลับมา แล้วคงการตรวจที่อยู่/เบอร์ที่เพิ่งใส่ไปไว้ครบ

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

  -- ── บันทึกลูกค้า (ส่วนที่หายไปแล้วเอากลับมา) ──
  -- flow จริง: ตอนออกบิลรู้แค่ชื่อ TikTok/ไลน์ ยังไม่มีเบอร์
  -- เบอร์+ที่อยู่มาทีหลังตอนลูกค้ากรอกในใบสรุป จุดนี้จึงเป็นที่ที่ควรบันทึกลูกค้า
  -- ใช้เบอร์เป็นตัวระบุตัวตน เพราะเป็นสิ่งเดียวที่ลูกค้ากรอกเองและไม่ซ้ำกัน
  if norm_ph is not null then
    select id into v_customer_id
    from public.customers
    where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = norm_ph
    limit 1;

    if v_customer_id is null then
      insert into public.customers (name, phone, address, line_user_id, line_display_name)
      values (
        nullif(btrim(p_name), ''),
        norm_ph,
        nullif(addr, ''),
        o.line_user_id,
        o.line_display_name
      )
      returning id into v_customer_id;
    else
      update public.customers
      set name              = coalesce(nullif(btrim(p_name), ''), name),
          address           = coalesce(nullif(addr, ''),          address),
          line_user_id      = coalesce(o.line_user_id,            line_user_id),
          line_display_name = coalesce(o.line_display_name,       line_display_name)
      where id = v_customer_id;
    end if;
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

-- ── ลูกค้าเก่าไม่ต้องพิมพ์ที่อยู่ซ้ำ ─────────────────────────────────
--
-- ร้านออกบิลก่อนลูกค้าเปิดลิงก์ ตอนนั้นยังไม่รู้ว่าเป็นใครถ้าไม่ได้กดเลือกลูกค้าเก่า
-- บิลจึงมักไม่มีที่อยู่ แล้วลูกค้าต้องพิมพ์ใหม่ทุกรอบทั้งที่เคยให้ไปแล้ว
--
-- ตอนผูกบัญชี LINE เรารู้แล้วว่าเป็นใคร ถ้าเคยมีที่อยู่เก็บไว้ก็เติมให้เลย
-- เติมเฉพาะช่องที่ยัง "ว่าง" เท่านั้น ไม่ทับของที่ร้านกรอกไว้เอง
--
-- ข้อแลกเปลี่ยน: คนที่ถือ token ของบิลหนึ่ง ถ้าใส่ userId ของคนอื่นเข้ามา
-- จะดึงที่อยู่คนนั้นขึ้นมาบนบิลตัวเองได้ — ต้องรู้ทั้ง token (สุ่ม 32 ตัว
-- ที่ส่งให้เจ้าของบิลคนเดียว) และ LINE userId ของเป้าหมาย ซึ่งไม่มีที่ไหนเปิดเผย
-- ประเมินแล้วรับได้เทียบกับที่ลูกค้าไม่ต้องพิมพ์ที่อยู่ซ้ำทุกครั้ง
create or replace function public.link_order_line_user(
  p_token        text,
  p_line_user_id text,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o     public.orders%rowtype;
  c     public.customers%rowtype;
  disp  text;
begin
  if p_token is null or length(p_token) < 16 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token');
  end if;

  -- LINE userId มีรูปแบบตายตัว U ตามด้วยเลขฐานสิบหก 32 ตัว
  -- ตรวจไว้กันข้อมูลขยะที่จะทำให้ push ล้มเหลวเงียบ ๆ ทีหลัง
  if p_line_user_id !~ '^U[0-9a-f]{32}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_user_id');
  end if;

  -- ชื่อมาจากฝั่งเบราว์เซอร์ ตัดความยาวกันสแปม ว่างก็ถือว่าไม่ได้ส่งมา
  disp := nullif(btrim(coalesce(p_display_name, '')), '');
  if length(disp) > 200 then
    disp := left(disp, 200);
  end if;

  select * into o from public.orders where public_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  update public.orders
  set line_user_id      = p_line_user_id,
      -- coalesce ไว้ ชื่อที่เคยเก็บได้จะไม่หายเพราะการเรียกครั้งหลังไม่ส่งชื่อมา
      line_display_name = coalesce(disp, line_display_name)
  where public_token = p_token;

  if o.customer_id is not null then
    update public.customers
    set line_user_id      = p_line_user_id,
        line_display_name = coalesce(disp, line_display_name)
    where id = o.customer_id;
  end if;

  -- เติมข้อมูลติดต่อจากครั้งก่อน เฉพาะบิลที่ยังแก้ที่อยู่ได้และช่องยังว่าง
  if o.status = 'pending' then
    -- customers ไม่มี updated_at เรียงด้วย created_at แทน
    -- ปกติหนึ่ง LINE ต่อหนึ่งแถวอยู่แล้ว การเรียงจึงมีผลแค่กรณีข้อมูลซ้ำ
    select * into c
    from public.customers
    where line_user_id = p_line_user_id
      and address is not null
    order by created_at desc nulls last
    limit 1;

    if found then
      update public.orders
      set customer_name    = coalesce(nullif(btrim(customer_name), ''),    c.name),
          customer_phone   = coalesce(nullif(btrim(customer_phone), ''),   c.phone),
          customer_address = coalesce(nullif(btrim(customer_address), ''), c.address),
          customer_id      = coalesce(customer_id,                         c.id)
      where public_token = p_token;
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.link_order_line_user(text, text, text) from public;
grant execute on function public.link_order_line_user(text, text, text) to anon, authenticated;
