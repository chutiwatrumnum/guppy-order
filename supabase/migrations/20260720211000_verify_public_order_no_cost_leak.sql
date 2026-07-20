-- ตรวจสอบอย่างเดียว ไม่เปลี่ยนสคีมา
--
-- ใบสรุปที่ส่งให้ลูกค้าต้องไม่มีต้นทุนติดไปด้วย
-- items เก็บเป็น jsonb และแต่ละรายการมีคีย์ cost อยู่ ถ้าลืมตัดลูกค้าจะเห็นกำไรของร้าน
-- ถ้าเจอรั่ว ให้ล้มทั้ง migration ดีกว่าปล่อยผ่านแล้วเข้าใจว่าปลอดภัย

do $$
declare
  v_token   text;
  v_result  jsonb;
  v_item    jsonb;
  v_leaked  text[] := '{}';
  v_banned  text[] := array['total_cost', 'actual_shipping_fee', 'created_by', 'shop_id', 'customer_id'];
  v_key     text;
begin
  select public_token into v_token from public.orders limit 1;

  if v_token is null then
    raise notice 'ยังไม่มีออเดอร์ในระบบ ข้ามการตรวจ';
    return;
  end if;

  v_result := public.get_public_order(v_token);

  if v_result is null then
    raise exception 'ล้มเหลว: เรียกด้วย token จริงแล้วไม่ได้ข้อมูลกลับมา';
  end if;

  -- ฟิลด์ระดับบิลที่ห้ามหลุด
  foreach v_key in array v_banned loop
    if v_result ? v_key then
      v_leaked := v_leaked || v_key;
    end if;
  end loop;

  -- ต้นทุนรายรายการ
  for v_item in select * from jsonb_array_elements(v_result->'items') loop
    if v_item ? 'cost' then
      v_leaked := v_leaked || 'items[].cost';
    end if;
  end loop;

  if array_length(v_leaked, 1) > 0 then
    raise exception 'ล้มเหลว: ใบสรุปสาธารณะมีข้อมูลที่ไม่ควรหลุด → %', array_to_string(v_leaked, ', ');
  end if;

  raise notice '✅ ไม่มีต้นทุนหลุด — คีย์ที่ส่งออก: %',
    (select string_agg(k, ', ' order by k) from jsonb_object_keys(v_result) as k);
  raise notice '   จำนวนรายการในบิลที่ตรวจ: %', jsonb_array_length(v_result->'items');
end $$;
