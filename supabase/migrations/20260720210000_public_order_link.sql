-- ใบสรุปออเดอร์แบบลิงก์ ให้ลูกค้าเปิดดูเองได้โดยไม่ต้องล็อกอิน
--
-- ข้อบังคับด้านความปลอดภัย
--   * ห้ามให้ anon แตะตาราง orders โดยตรง — เข้าได้ผ่านฟังก์ชันนี้เท่านั้น
--   * ฟังก์ชันคืน "บิลเดียว" ที่ token ตรงเป๊ะ ไม่มีทางไล่ดูบิลอื่น
--   * ต้องตัด cost ออกจาก items ไม่งั้นลูกค้าเห็นต้นทุนและกำไรของร้าน
--   * ไม่คืน total_cost / actual_shipping_fee / created_by / shop_id

-- ── 1. token ลับประจำบิล ────────────────────────────────────────────
-- ใช้ uuid v4 ตัดขีดออก = 32 ตัวอักษร เดาไม่ได้ในทางปฏิบัติ
-- ไม่ใช้ id ของบิลเพราะ id ถูกใช้อ้างอิงในระบบหลังบ้านอยู่แล้ว
alter table public.orders
  add column if not exists public_token text;

update public.orders
set public_token = replace(gen_random_uuid()::text, '-', '')
where public_token is null;

alter table public.orders
  alter column public_token set default replace(gen_random_uuid()::text, '-', ''),
  alter column public_token set not null;

create unique index if not exists orders_public_token_key on public.orders(public_token);

-- ── 2. อ่านบิลด้วย token ────────────────────────────────────────────
create or replace function public.get_public_order(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o          public.orders%rowtype;
  s          public.settings%rowtype;
  safe_items jsonb;
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
    'payment', jsonb_build_object(
      'promptpay_id',   s.promptpay_id,
      'bank_name',      s.bank_name,
      'account_number', s.account_number,
      'account_name',   s.account_name
    )
  );
end;
$$;

-- ── 3. ให้ลูกค้ากรอกที่อยู่เองได้ ───────────────────────────────────
-- แก้ได้เฉพาะตอนยังไม่ส่ง และแตะได้แค่ 3 ช่องนี้เท่านั้น
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
  o       public.orders%rowtype;
  n_rows  int;
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

  select * into o from public.orders where public_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if o.status <> 'pending' then
    -- ส่งของออกไปแล้ว แก้ที่อยู่ตอนนี้ไม่มีประโยชน์และทำให้เข้าใจผิด
    return jsonb_build_object('ok', false, 'reason', 'already_shipped');
  end if;

  update public.orders
  set customer_name    = coalesce(nullif(btrim(p_name), ''),    customer_name),
      customer_phone   = coalesce(nullif(btrim(p_phone), ''),   customer_phone),
      customer_address = coalesce(nullif(btrim(p_address), ''), customer_address)
  where public_token = p_token;

  get diagnostics n_rows = row_count;
  return jsonb_build_object('ok', n_rows > 0);
end;
$$;

-- ── 4. เปิดสิทธิ์เฉพาะสองฟังก์ชันนี้ ไม่ใช่ทั้งตาราง ──────────────────
-- postgres grant execute ให้ PUBLIC เป็นค่าเริ่มต้น จึงต้อง revoke ก่อนแล้วค่อยให้ทีละ role
revoke all on function public.get_public_order(text) from public;
revoke all on function public.submit_order_contact(text, text, text, text) from public;

grant execute on function public.get_public_order(text) to anon, authenticated;
grant execute on function public.submit_order_contact(text, text, text, text) to anon, authenticated;
