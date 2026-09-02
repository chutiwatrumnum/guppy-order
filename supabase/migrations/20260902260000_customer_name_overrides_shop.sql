-- ชื่อที่ลูกค้ายืนยันเอง ทับชื่อที่ร้านใส่ในบิลใหม่
--
-- เคสจริง:
--   ลูกค้าซื้อครั้งแรก → กรอกชื่อ+ที่อยู่เองในใบสรุป → ระบบเก็บไว้
--   ร้านออกบิลใหม่ให้คนเดิม → ใส่ชื่ออื่นไป (ชื่อในแชท ชื่อเล่น สะกดผิด)
--   ลูกค้าเปิดใบสรุปใบใหม่ → ต้องเห็นชื่อจริงของตัวเอง ไม่ใช่ชื่อที่ร้านใส่
--
-- migration ก่อนหน้าเติมชื่อ "เฉพาะตอนช่องว่าง" ซึ่งไม่ช่วยอะไรเลยในเคสนี้
-- เพราะร้านใส่ชื่อไว้แล้ว ช่องไม่เคยว่าง
--
-- ชื่อที่ลูกค้ายืนยันแล้วจึงเขียนทับได้เลย ไม่ต้องสนว่าร้านใส่อะไรไว้
--
-- เบอร์กับที่อยู่ยังเป็นแบบ "เติมเฉพาะที่ว่าง" เหมือนเดิม — ร้านที่พิมพ์ที่อยู่
-- ลงบิลมักตั้งใจ (ลูกค้าบอกในแชทว่ารอบนี้ส่งที่อื่น) ทับทิ้งจะส่งผิดที่
-- ส่วนชื่อไม่มีเหตุผลแบบนั้น

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

  if o.status = 'pending' then
    -- เอาแถวที่มีที่อยู่ก่อน ไม่มีก็เอาแถวล่าสุด
    -- (ไม่บังคับว่าต้องมีที่อยู่แล้ว เพราะชื่ออย่างเดียวก็มีประโยชน์)
    select * into c
    from public.customers
    where line_user_id = p_line_user_id
    order by (address is not null) desc, created_at desc
    limit 1;

    if found then
      update public.orders
      set customer_name = case
                            -- ลูกค้ายืนยันชื่อไว้แล้ว → ทับชื่อที่ร้านใส่เลย
                            when c.name_from_customer and c.name is not null then c.name
                            -- ไม่งั้นก็แค่เติมตอนที่ยังว่าง
                            else coalesce(nullif(btrim(customer_name), ''), c.name)
                          end,
          contact_from_customer = contact_from_customer
                                    or (c.name_from_customer and c.name is not null),
          -- เบอร์/ที่อยู่เติมเฉพาะที่ว่าง ไม่ทับของที่ร้านตั้งใจใส่
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
