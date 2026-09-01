-- ตรวจสอบอย่างเดียว: ชื่อรายการในบิลที่มีคำว่า "อาหาร" (คาดว่าเป็นอาหารที่ถูกเก็บเป็นปลา)
do $$
declare r record;
begin
  raise notice '=== ชื่อรายการที่มีคำว่า "อาหาร" ในบิลทั้งหมด ===';
  for r in
    select item->>'breedName' as name,
           (item->>'kind') as kind,
           count(*) as cnt
    from public.orders o
    cross join lateral jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) item
    where item->>'breedName' ilike '%อาหาร%' or item->>'breedName' ilike '%อาหา%'
    group by 1, 2 order by 3 desc
  loop
    raise notice '   "%" | kind=% | % รายการ', r.name, coalesce(r.kind, '(ปลา)'), r.cnt;
  end loop;

  raise notice '=== สายพันธุ์ (breeds) ที่ชื่อมีคำว่า "อาหาร" ===';
  for r in select name from public.breeds where name ilike '%อาหา%' loop
    raise notice '   breed: "%"', r.name;
  end loop;
end $$;
