-- ตรวจสอบอย่างเดียว (ไม่แก้ข้อมูล): ดูว่าบิลเก่ามีรายการที่ชื่อตรงกับ "อาหาร" กี่รายการ
-- ที่ควรถูกแปลงจากปลา -> อาหาร

do $$
declare
  r record;
  n_products int;
begin
  select count(*) into n_products from public.products where is_active;
  raise notice '=== รายการอาหารในระบบ (products) มี % รายการ ===', n_products;
  for r in select name, price from public.products where is_active order by name loop
    raise notice '   สินค้า: "%" (฿%)', r.name, r.price;
  end loop;

  raise notice '=== รายการในบิลเก่าที่ชื่อตรงกับอาหาร (ยังเป็นปลาอยู่) ===';
  for r in
    select item->>'breedName' as name, count(*) as cnt
    from public.orders o
    cross join lateral jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) item
    where (item->>'kind') is distinct from 'food'
      and lower(btrim(item->>'breedName')) in (
        select lower(btrim(name)) from public.products where is_active
      )
    group by 1 order by 2 desc
  loop
    raise notice '   "%" → พบ % รายการที่จะแปลงเป็นอาหาร', r.name, r.cnt;
  end loop;
end $$;
