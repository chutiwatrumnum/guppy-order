-- ═══════════════════════════════════════════════
-- SQL ที่ค้าง — วางทั้งก้อนใน Supabase SQL Editor
-- รันซ้ำได้ ไม่พังถ้าบางส่วนเคยรันไปแล้ว
-- ═══════════════════════════════════════════════

-- ── 20260908200000_orders_delivered_at.sql ──

-- เวลาที่พัสดุถึงมือลูกค้าจริง
--
-- ตอนนี้สถานะ "ถึงแล้ว" ร้านกดเองทุกใบ — ในฐานข้อมูลมี 248 ใบที่กดไปแล้ว
-- ทั้งที่บอทรู้อยู่แล้วว่าใบไหนนำจ่ายสำเร็จเมื่อไหร่ (isDelivered ที่ index.js)
-- แต่เอาไปใช้แค่หยุดติดตาม ไม่เคยเขียนกลับมาที่บิล
--
-- เก็บเวลาไว้ด้วย ไม่ใช่แค่เปลี่ยนสถานะ — คู่กับ paid_at ที่มีอยู่แล้ว
-- จะได้ตอบได้ว่าจ่ายเงินแล้วกี่วันของถึง ซึ่งเป็นตัวเลขที่ร้านปลาเป็นต้องรู้
-- (ยิ่งนาน ยิ่งเสี่ยงปลาตายระหว่างทาง)

alter table public.orders
  add column if not exists delivered_at timestamptz;

create index if not exists orders_delivered_at_idx on public.orders(delivered_at);

comment on column public.orders.delivered_at is
  'เวลาที่ไปรษณีย์แจ้งนำจ่ายสำเร็จ — บอทเป็นคนเขียน ไม่ใช่เวลาที่ร้านกดปุ่ม';

-- ไม่ backfill ใบเก่า
--
-- 248 ใบที่เป็น delivered อยู่แล้วมาจากการที่ร้านกดเอง ซึ่งกดตอนไหนก็ได้
-- หลังของถึงจริงเป็นวัน ๆ ก็ได้ เดาเวลาย้อนหลังจะได้ตัวเลขที่ดูน่าเชื่อแต่ผิด
-- ปล่อยว่างไว้ตรงไปตรงมากว่า แล้วนับสถิติจากใบใหม่ที่บอทเขียนเอง

-- ── 20260908280000_orders_shipped_at.sql ──

-- เวลาที่ร้านส่งของออกไป
--
-- ตอนนี้มี paid_at (จ่ายเงิน) กับ delivered_at (ถึงมือ) แต่ขาดตรงกลาง
-- ทำให้ตอบไม่ได้ว่า "ใบนี้ส่งไปกี่วันแล้วยังไม่ถึง" ซึ่งเป็นคำถามเดียว
-- ที่สำคัญจริงกับปลาเป็น — ยิ่งค้างนานยิ่งเสี่ยงตายกลางทาง
--
-- ตั้งตอนคีย์เลขพัสดุ ซึ่งเป็นจังหวะที่ของออกจากร้านจริง
-- ไม่ใช่ตอนกดเปลี่ยนสถานะเป็น "ส่งแล้ว" ด้วยมือ (กดตอนไหนก็ได้)

alter table public.orders
  add column if not exists shipped_at timestamptz;

create index if not exists orders_shipped_at_idx on public.orders(shipped_at);

comment on column public.orders.shipped_at is
  'เวลาที่คีย์เลขพัสดุ = ของออกจากร้าน คู่กับ paid_at และ delivered_at';

-- ไม่ backfill ใบเก่าด้วยเหตุผลเดียวกับ delivered_at
-- created_at คือตอนออกบิล ซึ่งห่างจากตอนส่งจริงเป็นวัน ๆ ได้
-- เอามาใช้แทนจะได้ "จำนวนวันขนส่ง" ที่ดูน่าเชื่อแต่ผิด

-- ── 20260908300000_past_recipients.sql ──

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

