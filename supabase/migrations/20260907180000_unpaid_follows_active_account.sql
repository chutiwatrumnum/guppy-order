-- บิลที่ยังไม่จ่าย ต้องตามบัญชีที่ใช้รับเงินอยู่ตอนนี้
--
-- ของเดิมผูกบัญชีไว้ตั้งแต่ออกบิลแล้วล็อกตลอดไป ซึ่งผิดสำหรับบิลที่ยังไม่จ่าย —
-- ร้านสลับบัญชีเพราะจะเลิกใช้ของเดิม แต่ลูกค้าที่ถือลิงก์เก่าไว้ยังเห็นเลขเดิม
-- แล้วโอนเข้าบัญชีที่กำลังจะปิด เงินไปคนละที่กับที่ร้านตั้งใจ
--
-- กฎใหม่แยกตามว่าเงินโอนมาหรือยัง:
--   ยังไม่จ่าย  → โชว์บัญชีที่ใช้รับเงินอยู่ตอนนี้ (สลับแล้วเปลี่ยนตามทันทีทุกใบ)
--   จ่าย/มัดจำแล้ว → โชว์บัญชีที่ผูกไว้กับบิล (เงินเข้าที่นั่นจริง ห้ามเปลี่ยนย้อนหลัง
--                    ไม่งั้นยอดแยกรายบัญชีในหน้าบัญชีจะเพี้ยนทั้งเดือน)
--
-- ฝั่งแอปตราบัญชีลงบิลตอนกดยืนยันว่าได้รับเงิน ตัวเลขกับสิ่งที่ลูกค้าเห็นจึงตรงกัน

create or replace function public.get_public_order(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o           public.orders%rowtype;
  s           public.settings%rowtype;
  acct        public.payment_accounts%rowtype;
  safe_items  jsonb;
  slip_state  text;
  slip_note   text;
begin
  if p_token is null or length(p_token) < 16 then
    return null;
  end if;

  select * into o from public.orders where public_token = p_token;
  if not found then
    return null;
  end if;

  select * into s from public.settings limit 1;

  -- จ่ายมาแล้ว (เต็มหรือมัดจำ) = เงินเข้าบัญชีที่ผูกไว้ ยึดอันนั้น
  if coalesce(o.payment_status, 'unpaid') <> 'unpaid' and o.payment_account_id is not null then
    select * into acct from public.payment_accounts where id = o.payment_account_id;
  end if;

  -- ยังไม่จ่าย → บัญชีที่ใช้รับเงินอยู่ตอนนี้
  if acct.id is null then
    select * into acct from public.payment_accounts
    where is_active and not archived
    limit 1;
  end if;

  -- ไม่มีบัญชีที่ใช้อยู่เลย (เก็บเข้ากรุหมด) → ยังดีกว่าไม่โชว์อะไรให้ลูกค้า
  if acct.id is null and o.payment_account_id is not null then
    select * into acct from public.payment_accounts where id = o.payment_account_id;
  end if;

  -- ตัด cost ทิ้งทีละรายการ ห้ามให้ต้นทุนหลุดออกไปกับใบสรุป
  select coalesce(jsonb_agg(item - 'cost'), '[]'::jsonb)
    into safe_items
    from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) as item;

  select ps.status, ps.review_note into slip_state, slip_note
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
    'slip_note',             slip_note,
    'line_display_name',     o.line_display_name,
    'contact_from_customer', o.contact_from_customer,
    'payment', jsonb_build_object(
      'promptpay_id',   coalesce(acct.promptpay_id,   s.promptpay_id),
      'bank_name',      coalesce(acct.bank_name,      s.bank_name),
      'account_number', coalesce(acct.account_number, s.account_number),
      'account_name',   coalesce(acct.account_name,   s.account_name)
    )
  );
end;
$$;

revoke all on function public.get_public_order(text) from public;
grant execute on function public.get_public_order(text) to anon, authenticated;
