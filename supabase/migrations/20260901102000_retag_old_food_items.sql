-- แปลงรายการ "อาหารปลา" ในบิลเก่า จากปลา -> อาหาร (kind='food')
-- แล้วคำนวณ total_fish ใหม่ (ไม่นับอาหารเป็นตัวปลา)
--
-- กระทบเฉพาะบิลที่มีรายการชื่อ "อาหารปลา" ที่ยังไม่ใช่ food
-- idempotent: รันซ้ำไม่ทำอะไรเพิ่ม (ตัวที่เป็น food แล้วถูกข้าม)
-- ย้อนกลับได้: ตั้ง kind กลับเป็น fish ตามชื่อ

update public.orders o
set
  items = sub.new_items,
  total_fish = sub.new_fish
from (
  select
    o2.id,
    jsonb_agg(
      case
        when lower(btrim(elem->>'breedName')) = 'อาหารปลา' and (elem->>'kind') is distinct from 'food'
          then elem || '{"kind":"food"}'::jsonb
        else elem
      end
      order by idx
    ) as new_items,
    coalesce(sum(
      case
        when (case when lower(btrim(elem->>'breedName')) = 'อาหารปลา' then 'food'
                   else coalesce(elem->>'kind', 'fish') end) = 'food'
          then 0
        else (elem->>'quantity')::int
             * (case elem->>'type' when 'pair' then 2 when 'set' then 3 else 1 end)
      end
    ), 0)::int as new_fish
  from public.orders o2
  cross join lateral jsonb_array_elements(coalesce(o2.items, '[]'::jsonb)) with ordinality as t(elem, idx)
  where exists (
    select 1 from jsonb_array_elements(coalesce(o2.items, '[]'::jsonb)) e
    where lower(btrim(e->>'breedName')) = 'อาหารปลา'
      and (e->>'kind') is distinct from 'food'
  )
  group by o2.id
) sub
where o.id = sub.id;

do $$
declare n int;
begin
  select count(*) into n
  from public.orders o
  cross join lateral jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) item
  where lower(btrim(item->>'breedName')) = 'อาหารปลา' and item->>'kind' = 'food';
  raise notice '✅ ตอนนี้มีรายการ "อาหารปลา" ที่เป็น food แล้ว % รายการ', n;
end $$;
