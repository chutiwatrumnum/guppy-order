-- เก็บชื่อ LINE ของลูกค้าไว้กับออเดอร์
--
-- เดิมตอนผูกบัญชี LINE เก็บแค่ userId ซึ่งเป็นรหัสยาว ๆ อ่านไม่รู้เรื่อง
-- เวลาร้านจะปริ้นใบแปะกล่องแล้วลูกค้าไม่ได้กรอกชื่อ ก็ไม่เหลืออะไรให้เขียนหน้ากล่อง
-- ชื่อ LINE ได้มาฟรีอยู่แล้วตอน getProfile() แค่ก่อนหน้านี้ทิ้งไปเฉย ๆ
--
-- ไม่เอาชื่อ LINE ไปทับ customer_name เพราะคนละอย่างกัน:
-- ชื่อ LINE มักเป็นชื่อเล่นหรือมีอิโมจิ ใช้แปะหน้ากล่องตรง ๆ ไม่ได้
-- เก็บแยกไว้ให้ร้านเห็นว่า "ออเดอร์นี้คุยกับ LINE ชื่อนี้" แล้วตัดสินใจเอง

alter table public.orders
  add column if not exists line_display_name text;

-- เก็บที่ลูกค้าด้วย ออเดอร์ถัดไปของคนเดิมจะได้รู้จักชื่อตั้งแต่แรก
alter table public.customers
  add column if not exists line_display_name text;

-- ── รับชื่อเพิ่มตอนผูกบัญชี ─────────────────────────────────────────
-- ต้อง drop ตัวเดิมก่อน ไม่งั้นเรียกด้วย 2 อาร์กิวเมนต์จะกำกวมระหว่างสองตัว
-- พารามิเตอร์ใหม่มี default หน้าเว็บเวอร์ชันเก่าที่ยังส่งมาแค่ 2 ตัวจึงเรียกได้เหมือนเดิม
drop function if exists public.link_order_line_user(text, text);

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
  o        public.orders%rowtype;
  disp     text;
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

  -- ผูกกับลูกค้าด้วยถ้าออเดอร์นี้รู้ว่าเป็นใคร
  if o.customer_id is not null then
    update public.customers
    set line_user_id      = p_line_user_id,
        line_display_name = coalesce(disp, line_display_name)
    where id = o.customer_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.link_order_line_user(text, text, text) from public;
grant execute on function public.link_order_line_user(text, text, text) to anon, authenticated;

-- ── คืนชื่อ LINE ให้หน้าใบสรุปแสดงได้ ───────────────────────────────
-- เหมือน migration ก่อนหน้าทุกอย่าง เพิ่มแค่ line_display_name
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
    'order_number',      o.order_number,
    'created_at',        o.created_at,
    'items',             safe_items,
    'total_amount',      o.total_amount,
    'total_fish',        o.total_fish,
    'shipping_fee',      o.shipping_fee,
    'discount',          o.discount,
    'status',            o.status,
    'payment_status',    o.payment_status,
    'paid_amount',       o.paid_amount,
    'tracking_number',   o.tracking_number,
    'customer_name',     o.customer_name,
    'customer_phone',    o.customer_phone,
    'customer_address',  o.customer_address,
    'note',              o.note,
    'slip_status',       slip_state,
    'line_display_name', o.line_display_name,
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
