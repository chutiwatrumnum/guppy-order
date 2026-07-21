-- ตรวจสอบอย่างเดียว: สร้างบิลจำลอง → เรียก submit_order_contact → เช็คว่าลูกค้าถูกสร้างและผูก → ลบทิ้ง
-- ทั้งหมดในบล็อกเดียว ไม่ทิ้งข้อมูลขยะไว้ ล้มถ้าผลไม่ตรง

do $$
declare
  v_token   text := replace(gen_random_uuid()::text, '-', '');
  v_phone   text := '09' || lpad((floor(random() * 100000000))::text, 8, '0');
  v_order   uuid;
  v_cust    uuid;
  v_linked  uuid;
  v_result  jsonb;
begin
  insert into public.orders (items, total_amount, total_fish, public_token, status, payment_status)
  values ('[]'::jsonb, 100, 1, v_token, 'pending', 'unpaid')
  returning id into v_order;

  v_result := public.submit_order_contact(v_token, 'ทดสอบ ระบบ', v_phone, '1/1 ถ.ทดสอบ กรุงเทพ 10000');

  if not (v_result->>'ok')::boolean then
    raise exception 'submit ล้มเหลว: %', v_result;
  end if;

  select id into v_cust from public.customers
  where regexp_replace(phone, '\D', '', 'g') = v_phone;
  if v_cust is null then
    raise exception 'ล้มเหลว: ไม่ได้สร้างลูกค้าจากเบอร์ %', v_phone;
  end if;

  select customer_id into v_linked from public.orders where id = v_order;
  if v_linked is distinct from v_cust then
    raise exception 'ล้มเหลว: order.customer_id (%) ไม่ตรงกับลูกค้าที่สร้าง (%)', v_linked, v_cust;
  end if;

  raise notice '✅ ลูกค้าถูกสร้างและผูกกับบิลถูกต้อง (customer_id=%)', v_cust;

  -- เก็บกวาด
  delete from public.orders where id = v_order;
  delete from public.customers where id = v_cust;
  raise notice '   ลบข้อมูลทดสอบแล้ว';
end $$;
