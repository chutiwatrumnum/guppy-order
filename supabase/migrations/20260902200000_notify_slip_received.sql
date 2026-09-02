-- แจ้งในไลน์ด้วยเมื่อลูกค้าอัปสลิปจากหน้าใบสรุป
--
-- ส่งสลิปในแชทจะได้ข้อความยืนยันกลับทันที เพราะบอทตอบ replyMessage ได้ฟรี
-- แต่อัปจากหน้า LIFF ไม่มี webhook event ให้ตอบ ลูกค้าเลยเห็นแค่บนหน้าเว็บ
-- พอปิดหน้าไปก็ไม่เหลือหลักฐานในแชท ซึ่งเป็นที่ที่คนย้อนกลับมาดู
--
-- หน้าเว็บ push เองไม่ได้ (channel token อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น)
-- จึงหยอดลงคิว line_notifications ให้บอทหยิบไปส่ง เหมือนที่หน้าแอดมินทำ
--
-- push นับโควต้า LINE ตารางคิวจึงเขียนเตือนไว้ว่าให้ใช้เฉพาะเหตุการณ์สำคัญ
-- ตัวเลขจริง 30 วันล่าสุด: 73 บิล แต่คิวนี้ส่งไปแค่ 6 ข้อความ
-- (ประมาณการเดิมในตารางคิวคือ ~200/เดือน ซึ่งสูงกว่าของจริงมาก)
-- เพิ่มอันนี้เข้าไปก็ยังห่างเพดานแผนฟรีอยู่มาก
--
-- ส่งเฉพาะสลิปใบแรกของบิล อัปซ้ำไม่ยิงเพิ่ม

create or replace function public.submit_order_slip(
  p_token        text,
  p_path         text,
  p_line_user_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o        public.orders%rowtype;
  prefix   text;
  fname    text;
  n_slips  int;
  owner_id text;
begin
  if p_token is null or length(p_token) < 16 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token');
  end if;

  select * into o from public.orders where public_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if o.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'already_shipped');
  end if;

  -- path ต้องอยู่ใต้โฟลเดอร์ของ token นี้เท่านั้น
  -- ไม่งั้นคนที่มี token ของตัวเองจะชี้ไปที่ไฟล์ของบิลอื่นแล้วเคลมเป็นของตัวเองได้
  -- เทียบด้วย string ไม่ใช้ regex เพราะ p_token มาจากผู้ใช้
  prefix := 'p/' || p_token || '/';
  if p_path is null or left(p_path, length(prefix)) <> prefix then
    return jsonb_build_object('ok', false, 'reason', 'bad_path');
  end if;

  fname := substring(p_path from length(prefix) + 1);
  if fname = '' or position('/' in fname) > 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad_path');
  end if;

  -- กันกดรัว ๆ จนสลิปท่วมหน้าร้าน คนถือ token เดียวยัดได้ไม่เกินนี้
  select count(*) into n_slips
  from public.payment_slips
  where order_id = o.id and status = 'pending';

  if n_slips >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'too_many');
  end if;

  -- line_user_id เป็น not null แต่ลูกค้าอาจเปิดใบสรุปในเบราว์เซอร์ธรรมดา
  -- ลำดับ: ที่ส่งมาจากหน้าเว็บ → ที่ผูกไว้กับบิล → ทำเครื่องหมายว่ามาจากเว็บ
  -- ไม่ปลอมเป็น userId มั่ว ๆ เพราะบอทเอาค่านี้ไป push จริง
  owner_id := nullif(btrim(coalesce(p_line_user_id, '')), '');
  if owner_id is not null and owner_id !~ '^U[0-9a-f]{32}$' then
    owner_id := null;
  end if;
  owner_id := coalesce(owner_id, o.line_user_id, 'web:' || p_token);

  insert into public.payment_slips (order_id, line_user_id, image_path)
  values (o.id, owner_id, p_path);

  -- แจ้งในแชทให้เหมือนตอนส่งสลิปเข้าไลน์
  -- เฉพาะใบแรก และเฉพาะคนที่ผูกบัญชี LINE ไว้จริง
  -- (owner_id ที่ขึ้นต้น web: คือเปิดในเบราว์เซอร์ ไม่มีใครให้ push หา)
  if n_slips = 0 and owner_id ~ '^U[0-9a-f]{32}$' then
    insert into public.line_notifications (line_user_id, order_id, message)
    values (
      owner_id,
      o.id,
      '🧾 ได้รับสลิปแล้วครับ' || E'\n' ||
      'บิล ' || o.order_number ||
      ' ยอด ฿' || to_char(coalesce(o.total_amount, 0), 'FM999,999,999') || E'\n\n' ||
      'ทางร้านกำลังตรวจสอบ เมื่อยืนยันแล้วสถานะในใบสรุปจะเปลี่ยนเป็น "ชำระเงินแล้ว" ครับ 🙏'
    );
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_order_slip(text, text, text) from public;
grant execute on function public.submit_order_slip(text, text, text) to anon, authenticated;
