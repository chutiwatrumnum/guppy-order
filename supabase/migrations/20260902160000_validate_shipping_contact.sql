-- บังคับให้ที่อยู่ที่ลูกค้ากรอกเองพอส่งของได้จริง
--
-- เดิมรับทุกอย่าง — "นครปฐม" หรือ "James" ก็บันทึกผ่าน แล้วขึ้นว่า
-- "ร้านได้รับที่อยู่แล้ว" ทั้งที่เอาไปส่งไปรษณีย์ไม่ได้
-- กว่าจะรู้ก็ตอนจะแพ็คของ ต้องไล่ทักถามลูกค้าใหม่ทีละคน
--
-- ตรวจซ้ำที่นี่ด้วยแม้หน้าเว็บจะตรวจแล้ว เพราะ RPC คือขอบเขตจริง
-- หน้าเว็บเป็นแค่ฝั่งเบราว์เซอร์ ยิงข้ามได้
--
-- ตั้งใจให้หลวม กันของที่ใช้ไม่ได้แน่ ๆ ไม่ได้บังคับรูปแบบ
-- ที่อยู่ไทยเขียนได้ร้อยแบบ เข้มเกินไปจะไปบล็อกที่อยู่จริงของลูกค้า

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
  o        public.orders%rowtype;
  n_rows   int;
  addr     text;
  digits   text;
  norm_ph  text;
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

  update public.orders
  set customer_name    = coalesce(nullif(btrim(p_name), ''), customer_name),
      customer_phone   = coalesce(norm_ph,                   customer_phone),
      customer_address = coalesce(nullif(addr, ''),          customer_address)
  where public_token = p_token;

  get diagnostics n_rows = row_count;
  return jsonb_build_object('ok', n_rows > 0);
end;
$$;

revoke all on function public.submit_order_contact(text, text, text, text) from public;
grant execute on function public.submit_order_contact(text, text, text, text) to anon, authenticated;
