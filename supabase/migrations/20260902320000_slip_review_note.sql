-- เหตุผลตอนปฏิเสธสลิป
--
-- เดิมปฏิเสธแล้วจบ ลูกค้าเห็นแค่ "ตรวจสอบไม่ผ่าน" ไม่รู้ว่าเพราะอะไร
-- ก็ส่งใบเดิมมาอีก หรือหายไปเลยแล้วบิลค้างอยู่อย่างนั้น
-- ฝั่งร้านเองเปิดดูย้อนหลังก็จำไม่ได้แล้วว่าทำไมถึงปฏิเสธ

alter table public.payment_slips
  add column if not exists review_note text;

-- ── ส่งเหตุผลไปให้หน้าใบสรุปแสดง ────────────────────────────────────
-- คืนเฉพาะสลิปใบล่าสุด และเฉพาะข้อความ ไม่ได้เปิดข้อมูลอะไรเพิ่ม
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
