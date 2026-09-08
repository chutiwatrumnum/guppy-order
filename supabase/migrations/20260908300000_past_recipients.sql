-- จำ "ผู้รับ" ทั้งชุด ไม่ใช่แค่ที่อยู่
--
-- get_past_addresses คืนเฉพาะที่อยู่ ซึ่งแก้ปัญหาได้ครึ่งเดียว
-- เคสจริงที่เจอ: บัญชี LINE เดียวมี 3 ชื่อ 2 เบอร์ 2 ที่อยู่
-- (เคน / น้องเคน / ขวัญจิต หยังหลัง) เพราะสั่งให้ตัวเองสลับกับสั่งให้ญาติ
--
-- ชื่อ เบอร์ ที่อยู่ เปลี่ยนพร้อมกันทั้งชุดเสมอ — ไม่มีใครอยากได้ที่อยู่แม่
-- คู่กับเบอร์ตัวเอง เลือกทีเดียวทั้งชุดจึงถูกกว่าให้เลือกทีละช่อง
--
-- ขอบเขตกว้างกว่าเดิม: customer_id เดียวกัน "หรือ" บัญชี LINE เดียวกัน
-- เพราะ submit_order_contact หา customer จากเบอร์ พอกรอกเบอร์ญาติจะกลายเป็น
-- customer คนละคนทันที แล้วชุดของญาติจะหายไปจากรายการถ้าดูแค่ customer_id
-- ส่วนบัญชี LINE คือคนสั่ง ซึ่งเป็นคนเดิมตลอด

drop function if exists public.get_past_addresses(text);

create or replace function public.get_past_recipients(p_token text)
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

  -- ไม่รู้ว่าเป็นใครทั้งสองทาง = ไม่มีอะไรให้เสนอ
  -- ห้ามตกไปใช้ชื่อหรือเบอร์ลอย ๆ คนละคนใช้ซ้ำกันได้
  if o.customer_id is null and o.line_user_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(r), '[]'::jsonb) into list
  from (
    select distinct on (btrim(customer_address))
      jsonb_build_object(
        'name',    nullif(btrim(coalesce(customer_name, '')), ''),
        'phone',   nullif(btrim(coalesce(customer_phone, '')), ''),
        'address', btrim(customer_address)
      ) as r,
      btrim(customer_address) as addr,
      max(created_at) over (partition by btrim(customer_address)) as latest
    from public.orders
    where btrim(coalesce(customer_address, '')) <> ''
      and (
        (o.customer_id  is not null and customer_id  = o.customer_id)
        or
        (o.line_user_id is not null and line_user_id = o.line_user_id)
      )
    -- ที่อยู่เดียวกันเอาใบล่าสุด ชื่อกับเบอร์จะได้เป็นเวอร์ชันที่ใหม่ที่สุด
    order by btrim(customer_address), created_at desc
  ) t
  where true
  limit 5;

  return list;
end;
$$;

revoke all on function public.get_past_recipients(text) from public;
grant execute on function public.get_past_recipients(text) to anon, authenticated;
