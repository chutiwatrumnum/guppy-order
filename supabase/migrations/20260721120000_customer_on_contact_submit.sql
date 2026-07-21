-- สร้าง/ผูกลูกค้าตอนลูกค้ากรอกที่อยู่ในลิงก์
--
-- flow จริง: ตอนออกบิลรู้แค่ชื่อ TikTok/ไลน์ ยังไม่มีเบอร์
-- เบอร์+ที่อยู่มาทีหลังตอนลูกค้าจ่ายแล้วกรอกในใบสรุป ซึ่งเป็นข้อมูลที่ลูกค้ากรอกเอง
-- จุดนี้จึงเป็นที่ที่ควรบันทึกลูกค้า ไม่ใช่ตอนออกบิลที่มีแค่ชื่อเล่น
--
-- แทนที่ submit_order_contact เดิม: เพิ่มการ upsert ลูกค้าด้วยเบอร์ แล้วผูก order.customer_id
-- คงการตรวจ token / สถานะ / ความยาว เหมือนเดิมทุกอย่าง

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
  v_phone_norm  text;
  v_customer_id uuid;
begin
  if p_token is null or length(p_token) < 16 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token');
  end if;

  if length(coalesce(p_name, '')) > 200
     or length(coalesce(p_phone, '')) > 50
     or length(coalesce(p_address, '')) > 800 then
    return jsonb_build_object('ok', false, 'reason', 'too_long');
  end if;

  select * into o from public.orders where public_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if o.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'already_shipped');
  end if;

  v_phone_norm := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');

  -- upsert ลูกค้าด้วยเบอร์ (ต้องมีเบอร์อย่างน้อย 9 หลักถึงจะเชื่อถือได้ว่าเป็นตัวระบุตัวตน)
  if length(v_phone_norm) >= 9 then
    select id into v_customer_id
    from public.customers
    where regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone_norm
    limit 1;

    if v_customer_id is null then
      insert into public.customers (name, phone, address, line_user_id)
      values (
        nullif(btrim(p_name), ''),
        p_phone,
        nullif(btrim(p_address), ''),
        o.line_user_id
      )
      returning id into v_customer_id;
    else
      update public.customers
      set name         = coalesce(nullif(btrim(p_name), ''), name),
          address      = coalesce(nullif(btrim(p_address), ''), address),
          line_user_id = coalesce(o.line_user_id, line_user_id)
      where id = v_customer_id;
    end if;
  end if;

  update public.orders
  set customer_name    = coalesce(nullif(btrim(p_name), ''),    customer_name),
      customer_phone   = coalesce(nullif(btrim(p_phone), ''),   customer_phone),
      customer_address = coalesce(nullif(btrim(p_address), ''), customer_address),
      customer_id      = coalesce(v_customer_id, customer_id)
  where public_token = p_token;

  return jsonb_build_object('ok', true);
end;
$$;
