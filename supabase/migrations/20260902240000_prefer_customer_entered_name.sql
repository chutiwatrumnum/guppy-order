-- ชื่อที่ลูกค้ากรอกเอง ต้องชนะชื่อที่ร้านกรอก
--
-- ร้านออกบิลตอนที่ยังรู้จักลูกค้าแค่ชื่อในแชท บางทีก็ใส่ชื่อคร่าว ๆ ไปก่อน
-- ("ลูกค้าติ๊กต็อก", ชื่อเล่น, สะกดผิด) ชื่อนั้นเอาไปจ่าหน้ากล่องไม่ได้
-- ชื่อที่เชื่อได้คือชื่อที่ลูกค้าพิมพ์เองในใบสรุป
--
-- ปัญหาคือดูจากค่าที่เก็บไว้ไม่ออกว่าใครเป็นคนกรอก — ทั้งหน้าขายของร้าน
-- และ submit_order_contact ต่างก็เขียน customers.name ได้ทั้งคู่
-- จึงต้องทำเครื่องหมายไว้ตอนเขียน
--
-- ใช้ตัดสิน 2 อย่าง:
--   1) ตอนเติมฟอร์มให้ลูกค้า — ถ้าชื่อในบิลมาจากร้าน อย่าเอาไปตั้งไว้ในช่อง
--      ลูกค้าจะได้ไม่กดผ่านชื่อมั่ว ๆ ไปโดยไม่ทันดู
--   2) ตอนเติมชื่อจากลูกค้าเก่า — เอาเฉพาะชื่อที่เจ้าตัวเคยยืนยันแล้ว

alter table public.orders
  add column if not exists contact_from_customer boolean not null default false;

alter table public.customers
  add column if not exists name_from_customer boolean not null default false;

-- ── ทำเครื่องหมายตอนลูกค้ากรอกเอง ───────────────────────────────────
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
  clean_name    text;
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

  clean_name := nullif(btrim(coalesce(p_name, '')), '');

  -- ── เบอร์โทร ──
  -- ให้เหลือเลขล้วนขึ้นต้น 0 เสมอ ร้านจะได้ก็อปไปกรอกฟอร์มส่งพัสดุได้เลย
  digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if digits <> '' then
    if left(digits, 2) = '66' and length(digits) >= 11 then
      digits := '0' || substring(digits from 3);
    elsif length(digits) = 9 and left(digits, 1) <> '0' then
      digits := '0' || digits;
    end if;

    if digits !~ '^0[0-9]{8,9}$' then
      return jsonb_build_object('ok', false, 'reason', 'bad_phone');
    end if;
    norm_ph := digits;
  end if;

  -- ── ที่อยู่ ──
  addr := btrim(coalesce(p_address, ''));
  if addr <> '' then
    if addr !~ '(^|[^0-9])[1-9][0-9]{4}([^0-9]|$)' then
      return jsonb_build_object('ok', false, 'reason', 'no_postcode');
    end if;
    if length(addr) < 15 then
      return jsonb_build_object('ok', false, 'reason', 'address_too_short');
    end if;
  end if;

  select * into o from public.orders where public_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if o.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'already_shipped');
  end if;

  -- ── หาว่าเป็นลูกค้าคนไหน: บิล → LINE → เบอร์ → สร้างใหม่ ──
  v_customer_id := o.customer_id;

  if v_customer_id is null and o.line_user_id is not null then
    select id into v_customer_id
    from public.customers
    where line_user_id = o.line_user_id
    order by created_at
    limit 1;
  end if;

  if v_customer_id is null and norm_ph is not null then
    select id into v_customer_id
    from public.customers
    where regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = norm_ph
    order by created_at
    limit 1;
  end if;

  if v_customer_id is not null then
    update public.customers
    set -- ชื่อจากลูกค้าเขียนทับได้เสมอ รวมถึงทับชื่อที่ร้านเคยใส่ไว้
        name               = coalesce(clean_name, name),
        name_from_customer = name_from_customer or (clean_name is not null),
        phone              = coalesce(norm_ph,              phone),
        address            = coalesce(nullif(addr, ''),     address),
        line_user_id       = coalesce(o.line_user_id,       line_user_id),
        line_display_name  = coalesce(o.line_display_name,  line_display_name)
    where id = v_customer_id;

  elsif norm_ph is not null or o.line_user_id is not null then
    insert into public.customers
      (name, name_from_customer, phone, address, line_user_id, line_display_name)
    values (
      clean_name,
      clean_name is not null,
      norm_ph,
      nullif(addr, ''),
      o.line_user_id,
      o.line_display_name
    )
    returning id into v_customer_id;
  end if;

  update public.orders
  set customer_name         = coalesce(clean_name,          customer_name),
      customer_phone        = coalesce(norm_ph,             customer_phone),
      customer_address      = coalesce(nullif(addr, ''),    customer_address),
      customer_id           = coalesce(v_customer_id,       customer_id),
      contact_from_customer = contact_from_customer or (clean_name is not null)
  where public_token = p_token;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_order_contact(text, text, text, text) from public;
grant execute on function public.submit_order_contact(text, text, text, text) to anon, authenticated;

-- ── เติมจากลูกค้าเก่า: เอาเฉพาะชื่อที่เจ้าตัวยืนยันแล้ว ──────────────
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

  if p_line_user_id !~ '^U[0-9a-f]{32}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_user_id');
  end if;

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
    select * into c
    from public.customers
    where line_user_id = p_line_user_id
      and address is not null
    order by created_at desc nulls last
    limit 1;

    if found then
      update public.orders
      set -- ชื่อเติมได้เฉพาะที่ลูกค้าเคยยืนยันเอง ชื่อที่ร้านเคยใส่ไว้ไม่เอามาต่อยอด
          customer_name         = case
                                    when c.name_from_customer
                                      then coalesce(nullif(btrim(customer_name), ''), c.name)
                                    else customer_name
                                  end,
          contact_from_customer = contact_from_customer
                                    or (c.name_from_customer
                                        and nullif(btrim(customer_name), '') is null
                                        and c.name is not null),
          customer_phone        = coalesce(nullif(btrim(customer_phone), ''),   c.phone),
          customer_address      = coalesce(nullif(btrim(customer_address), ''), c.address),
          customer_id           = coalesce(customer_id,                         c.id)
      where public_token = p_token;
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.link_order_line_user(text, text, text) from public;
grant execute on function public.link_order_line_user(text, text, text) to anon, authenticated;

-- ── บอกหน้าใบสรุปว่าชื่อในบิลมาจากลูกค้าหรือร้าน ────────────────────
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

  select ps.status into slip_state
  from public.payment_slips ps
  where ps.order_id = o.id
  order by ps.created_at desc
  limit 1;

  return jsonb_build_object(
    'order_number',          o.order_number,
    'created_at',            o.created_at,
    'items',                 safe_items,
    'total_amount',          o.total_amount,
    'total_fish',            o.total_fish,
    'shipping_fee',          o.shipping_fee,
    'discount',              o.discount,
    'status',                o.status,
    'payment_status',        o.payment_status,
    'paid_amount',           o.paid_amount,
    'tracking_number',       o.tracking_number,
    'customer_name',         o.customer_name,
    'customer_phone',        o.customer_phone,
    'customer_address',      o.customer_address,
    'note',                  o.note,
    'slip_status',           slip_state,
    'line_display_name',     o.line_display_name,
    'contact_from_customer', o.contact_from_customer,
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
