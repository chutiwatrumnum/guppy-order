-- บิลผูกกับบัญชี LINE ได้บัญชีเดียว คนแรกที่เปิดเป็นเจ้าของ
--
-- เดิมใครเปิดลิงก์ทีหลังก็เขียนทับ line_user_id ของบิลได้ ลิงก์ถูกส่งต่อในไลน์
-- หรือแค่ร้านเปิดเองเพื่อเช็ค บิลก็ย้ายไปผูกกับคนนั้นทันที
--
-- line_user_id ของบิลเป็นตัวกำหนดว่าใครได้รับ:
--   * แจ้งเตือนสถานะพัสดุ (parcel_subscriptions)
--   * แจ้งยืนยันรับเงิน
--   * แจ้งรับสลิป
-- และยังถูกเขียนกลับไปที่ customers.line_user_id ด้วย
-- คนที่สองมาเปิดจึงไม่ใช่แค่เห็นบิล แต่ยึดการแจ้งเตือนทั้งหมดไปจากลูกค้าตัวจริง
-- แถมเรคคอร์ดลูกค้าคนแรกยังถูกเปลี่ยนบัญชี LINE ไปเงียบ ๆ
--
-- ตอนนี้บัญชีที่ไม่ตรงกับที่ผูกไว้จะยังเปิดดูใบสรุปได้ (มี token ก็ดูได้อยู่แล้ว)
-- แต่ไม่ย้ายการผูก ไม่แตะข้อมูลลูกค้า และไม่ได้รับแจ้งเตือนอะไร
--
-- ถ้าผูกผิดคน ร้านกดปลดได้ที่หน้าบิล (unlink_order_line_user)

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

  -- ผูกไว้กับคนอื่นแล้ว — ดูได้ แต่ไม่ยึดไป
  if o.line_user_id is not null and o.line_user_id <> p_line_user_id then
    return jsonb_build_object('ok', false, 'reason', 'linked_to_other');
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

-- ── ปลดการผูก สำหรับตอนที่ผูกผิดคน ──────────────────────────────────
-- เคสที่เจอบ่อยสุดคือร้านเปิดลิงก์เองเพื่อเช็คก่อนส่งให้ลูกค้า
-- ล้างการสมัครแจ้งเตือนพัสดุของบิลนั้นด้วย ไม่งั้นคนที่ผูกผิดยังได้ข่าวต่อ
create or replace function public.unlink_order_line_user(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_rows int;
begin
  delete from public.parcel_subscriptions where order_id = p_order_id;

  update public.orders
  set line_user_id      = null,
      line_display_name = null
  where id = p_order_id;

  -- อ่านหลัง update เท่านั้น ไม่งั้นจะได้ผลของ delete ข้างบนแทน
  get diagnostics n_rows = row_count;
  return jsonb_build_object('ok', n_rows > 0);
end;
$$;

revoke all on function public.unlink_order_line_user(uuid) from public;
-- ร้านเท่านั้น ไม่ให้ anon แตะ
grant execute on function public.unlink_order_line_user(uuid) to authenticated;
