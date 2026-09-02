-- คำนวณ total_fish ใหม่จาก items ให้ทุกบิล (ไม่นับอาหารเป็นตัวปลา)
--
-- ทำไมต้องซ่อม: หน้าแก้ไขบิลคำนวณจำนวนปลาโดยไม่กรอง kind='food' ออก
-- บิลที่มีอาหารแล้วถูกกดแก้ไขจึงถูกบันทึก total_fish พองขึ้นตามจำนวนอาหาร
-- (เช่น ปลา 2 คู่ + 3 ตัว + อาหาร 4 ชิ้น ถูกบันทึกเป็น 11 ตัว แทนที่จะเป็น 7)
--
-- กระทบเฉพาะแถวที่ค่าไม่ตรงกับที่คำนวณได้จริง — แถวที่ถูกอยู่แล้วไม่ถูกแตะ
-- idempotent: รันซ้ำได้ ครั้งที่สองจะไม่มีแถวไหนเปลี่ยน
-- ปลอดภัย: total_fish เป็นค่าที่คำนวณจาก items ได้เสมอ ไม่ใช่ข้อมูลต้นทาง
--           ถ้าผลไม่ถูกใจ รัน migration นี้ซ้ำได้โดยไม่เสียอะไร
--
-- อยากดูก่อนว่าจะกระทบบิลไหนบ้าง ให้รันเฉพาะ SELECT นี้ก่อน:
--
--   select o.order_number, o.total_fish as ของเดิม, r.fish as ที่ถูกต้อง
--   from public.orders o
--   join lateral (
--     select coalesce((
--       select sum(coalesce((elem->>'quantity')::numeric, 0)
--                   * (case elem->>'type' when 'pair' then 2 when 'set' then 3 else 1 end))
--       from jsonb_array_elements(o.items) elem
--       where coalesce(elem->>'kind', 'fish') <> 'food'
--     ), 0)::int as fish
--   ) r on true
--   where jsonb_typeof(o.items) = 'array' and o.total_fish is distinct from r.fish;

with recomputed as (
  select
    o.id,
    coalesce((
      select sum(
        coalesce((elem->>'quantity')::numeric, 0)
        * (case elem->>'type' when 'pair' then 2 when 'set' then 3 else 1 end)
      )
      from jsonb_array_elements(o.items) elem
      -- ไม่ระบุ kind = ปลา (ข้อมูลเก่าก่อนมีอาหารในระบบ)
      where coalesce(elem->>'kind', 'fish') <> 'food'
    ), 0)::int as fish
  from public.orders o
  -- ข้ามแถวที่ items ไม่ใช่ array (null / ข้อมูลเพี้ยน) แทนที่จะให้ทั้ง migration ล้ม
  where jsonb_typeof(o.items) = 'array'
)
update public.orders o
set total_fish = r.fish
from recomputed r
where o.id = r.id
  and o.total_fish is distinct from r.fish;

do $$
declare
  remaining int;
  skipped int;
begin
  select count(*) into remaining
  from public.orders o
  join lateral (
    select coalesce((
      select sum(
        coalesce((elem->>'quantity')::numeric, 0)
        * (case elem->>'type' when 'pair' then 2 when 'set' then 3 else 1 end)
      )
      from jsonb_array_elements(o.items) elem
      where coalesce(elem->>'kind', 'fish') <> 'food'
    ), 0)::int as fish
  ) r on true
  where jsonb_typeof(o.items) = 'array'
    and o.total_fish is distinct from r.fish;

  select count(*) into skipped
  from public.orders o
  where jsonb_typeof(o.items) is distinct from 'array';

  if remaining = 0 then
    raise notice '✅ total_fish ตรงกับรายการในบิลทุกใบแล้ว';
  else
    raise warning '⚠️ ยังเหลือบิลที่ไม่ตรงอีก % ใบ — ตรวจด้วย SELECT ที่อยู่ในหัวไฟล์', remaining;
  end if;

  if skipped > 0 then
    raise notice 'ℹ️ ข้ามไป % ใบ เพราะคอลัมน์ items ไม่ใช่ array', skipped;
  end if;
end $$;
