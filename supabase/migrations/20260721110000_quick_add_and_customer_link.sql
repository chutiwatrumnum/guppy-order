-- ปลาขายบ่อยล่าสุด สำหรับแถว quick-add + จับคู่ลูกค้าด้วยเบอร์
--
-- 1) หาสายพันธุ์ที่ขายในช่วงหลัง เรียงตามความถี่ เพื่อปักบนสุดหน้าขาย
--    ลด "หาสายพันธุ์ในลิสต์ 57 ตัว" ที่เป็นคอขวดตอนออกบิลจากรูปที่ลูกค้าแคปมา
create or replace function public.top_recent_breeds(p_days int default 14, p_limit int default 8)
returns table (breed_id uuid, order_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (item->>'breedId')::uuid as breed_id,
    count(*)                 as order_count
  from public.orders o
  cross join lateral jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) as item
  where o.created_at >= now() - make_interval(days => p_days)
    and o.status <> 'cancelled'
    and item->>'breedId' is not null
  group by 1
  order by order_count desc, max(o.created_at) desc
  limit p_limit;
$$;

revoke all on function public.top_recent_breeds(int, int) from public;
grant execute on function public.top_recent_breeds(int, int) to authenticated;

-- 2) จับคู่ลูกค้าด้วยเบอร์ (normalize เอาเฉพาะตัวเลข)
--    เบอร์นี้เคยสั่ง → คืน id/ชื่อ/ที่อยู่ เดิม ให้ auto-fill
--    ไม่สร้างให้ตรงนี้ การสร้างทำฝั่งแอปตอนบันทึกเพื่อคุมค่าว่าง
create or replace function public.find_customer_by_phone(p_phone text)
returns table (id uuid, name text, phone text, address text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.phone, c.address
  from public.customers c
  where regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
    and regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') <> ''
  limit 1;
$$;

revoke all on function public.find_customer_by_phone(text) from public;
grant execute on function public.find_customer_by_phone(text) to authenticated;
