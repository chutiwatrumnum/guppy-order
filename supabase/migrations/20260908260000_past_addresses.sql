-- ที่อยู่ที่ลูกค้าคนนี้เคยใช้ ให้กดเลือกแทนพิมพ์ใหม่ทุกครั้ง
--
-- เคสจริง: ลูกค้าสั่งให้ตัวเองบิลหนึ่ง สั่งให้แม่อีกบิลด้วยไลน์เดิม
-- ระบบระบุตัวลูกค้าด้วยเบอร์ (submit_order_contact) พอใช้เบอร์เดิมทั้งสองบิล
-- customers.address จึงถูกเขียนทับไปมา แล้วรอบหน้าเติมที่อยู่ผิดคนให้
-- ลูกค้าต้องพิมพ์แก้กลับเองทุกครั้ง
--
-- บิลเก่าไม่เคยเสีย — orders.customer_address เก็บสำเนาของใครของมันไว้แล้ว
-- ที่อยู่ที่เคยใช้จึงมีครบอยู่ในนั้น ไม่ต้องสร้างตารางสมุดที่อยู่ใหม่
--
-- ผลพลอยได้: กดเลือกได้ที่อยู่เดิมเป๊ะ ไม่เพี้ยนจากการพิมพ์ใหม่
-- (ในข้อมูลจริงมีลูกค้าที่มีที่อยู่เดียวกันสองเวอร์ชัน ต่างกันแค่การเว้นวรรค)

create or replace function public.get_past_addresses(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  o    public.orders%rowtype;
  list jsonb;
begin
  if p_token is null or length(p_token) < 16 then
    return '[]'::jsonb;
  end if;

  select * into o from public.orders where public_token = p_token;
  if not found then
    return '[]'::jsonb;
  end if;

  -- ไม่รู้ว่าเป็นลูกค้าคนไหน = ไม่มีอะไรให้เสนอ
  -- ห้ามตกไปใช้เบอร์หรือชื่อแทน คนละคนใช้ชื่อซ้ำกันได้
  if o.customer_id is null then
    return '[]'::jsonb;
  end if;

  -- คืนเฉพาะที่อยู่ของ customer เดียวกันเท่านั้น
  -- token ใบนี้เห็นที่อยู่ของบิลตัวเองอยู่แล้ว การเห็นที่อยู่เก่าของตัวเอง
  -- จึงไม่ได้เปิดอะไรใหม่ แต่ต้องไม่ข้ามไปบิลของคนอื่นเด็ดขาด
  select coalesce(jsonb_agg(a order by a), '[]'::jsonb)
    into list
  from (
    select distinct btrim(customer_address) as a
    from public.orders
    where customer_id = o.customer_id
      and btrim(coalesce(customer_address, '')) <> ''
    limit 5
  ) t;

  return list;
end;
$$;

revoke all on function public.get_past_addresses(text) from public;
grant execute on function public.get_past_addresses(text) to anon, authenticated;
