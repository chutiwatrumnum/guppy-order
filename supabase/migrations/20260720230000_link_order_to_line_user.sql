-- ผูกออเดอร์กับบัญชี LINE ของลูกค้า
--
-- ลูกค้าเปิดใบสรุปผ่าน LIFF (ในแอป LINE) → หน้าเว็บได้ userId มา → บันทึกไว้ที่ออเดอร์
-- พอร้านกรอกเลขพัสดุ ระบบจะรู้ว่าต้องส่งอัปเดตไปหา LINE ไหน
-- ลูกค้าไม่ต้องส่งเลขพัสดุเข้าบอทเอง
--
-- userId ผูกกับ provider ไม่ใช่ channel — LINE Login channel กับ Messaging API channel
-- อยู่ provider "tacking-thaipost" เดียวกัน ค่าที่ได้จึงตรงกับที่บอทใช้ push

alter table public.orders
  add column if not exists line_user_id text;

create index if not exists orders_line_user_id_idx on public.orders(line_user_id);

-- เก็บไว้ที่ลูกค้าด้วย ออเดอร์ถัดไปของคนเดิมจะได้ไม่ต้องผูกใหม่
alter table public.customers
  add column if not exists line_user_id text;

-- ── RPC ให้หน้าใบสรุปเรียกได้โดยไม่ต้องล็อกอิน ─────────────────────
-- ยึด token เป็นขอบเขตความปลอดภัยเหมือน RPC ตัวอื่น: มี token = แก้บิลนั้นได้
create or replace function public.link_order_line_user(
  p_token        text,
  p_line_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders%rowtype;
begin
  if p_token is null or length(p_token) < 16 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token');
  end if;

  -- LINE userId มีรูปแบบตายตัว U ตามด้วยเลขฐานสิบหก 32 ตัว
  -- ตรวจไว้กันข้อมูลขยะที่จะทำให้ push ล้มเหลวเงียบ ๆ ทีหลัง
  if p_line_user_id !~ '^U[0-9a-f]{32}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_user_id');
  end if;

  select * into o from public.orders where public_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  update public.orders
  set line_user_id = p_line_user_id
  where public_token = p_token;

  -- ผูกกับลูกค้าด้วยถ้าออเดอร์นี้รู้ว่าเป็นใคร
  if o.customer_id is not null then
    update public.customers
    set line_user_id = p_line_user_id
    where id = o.customer_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.link_order_line_user(text, text) from public;
grant execute on function public.link_order_line_user(text, text) to anon, authenticated;
