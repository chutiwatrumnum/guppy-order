-- บัญชีรับเงินหลายบัญชี
--
-- เดิมบัญชีรับเงินมีช่องเดียวอยู่ในตาราง settings ร้านที่มีหลายบัญชี
-- (คนละธนาคารเพื่อให้ลูกค้าโอนในธนาคารเดียวกัน หรือเปลี่ยนบัญชีใหม่)
-- ต้องมาแก้ทับของเดิมทุกครั้ง แล้วบิลเก่าก็เปลี่ยนตามไปด้วยทั้งหมด
--
-- แยกออกมาเป็นตารางของตัวเอง + ผูกบิลไว้กับบัญชีที่โชว์ตอนออกบิล
-- บิลเก่าจึงยังบอกได้ว่าตอนนั้นให้ลูกค้าโอนเข้าบัญชีไหน และนับยอดรายบัญชีได้

create table if not exists public.payment_accounts (
  id             uuid primary key default gen_random_uuid(),

  -- ชื่อเรียกของร้านเอง เช่น "กสิกร (หลัก)" — ไม่ใช่ชื่อบัญชีธนาคาร
  label          text,

  bank_name      text not null,
  account_number text,
  account_name   text,
  promptpay_id   text,

  -- บัญชีที่ใช้รับเงินอยู่ตอนนี้ บิลที่ออกใหม่จะโชว์บัญชีนี้
  is_active      boolean not null default false,

  -- เลิกใช้แล้วแต่ห้ามลบ บิลเก่ายังชี้มาหาอยู่
  archived       boolean not null default false,

  created_at     timestamptz not null default now()
);

-- ใช้รับเงินได้ทีละบัญชีเดียว ป้องกันสถานะกำกวมตั้งแต่ระดับฐานข้อมูล
create unique index if not exists payment_accounts_one_active
  on public.payment_accounts((is_active)) where is_active;

alter table public.payment_accounts enable row level security;

drop policy if exists payment_accounts_authenticated_all on public.payment_accounts;
create policy payment_accounts_authenticated_all
  on public.payment_accounts for all to authenticated
  using (true) with check (true);

-- ลูกค้าอ่านบัญชีผ่าน get_public_order (security definer) เท่านั้น
-- ไม่เปิด policy ให้ anon อ่านตารางตรง ๆ ไม่งั้นเลขบัญชีทุกใบหลุดให้ใครก็ได้ดึงไปทั้งชุด

-- บิลผูกกับบัญชีที่โชว์ตอนออกบิล
alter table public.orders add column if not exists payment_account_id uuid
  references public.payment_accounts(id) on delete set null;

create index if not exists orders_payment_account_idx on public.orders(payment_account_id);

-- ย้ายบัญชีเดิมจาก settings มาเป็นบัญชีแรก จะได้ใช้ต่อได้เลยไม่ต้องกรอกใหม่
insert into public.payment_accounts (label, bank_name, account_number, account_name, promptpay_id, is_active)
select
  coalesce(nullif(s.bank_name, ''), 'บัญชีร้าน'),
  coalesce(nullif(s.bank_name, ''), 'ไม่ระบุธนาคาร'),
  s.account_number,
  s.account_name,
  s.promptpay_id,
  true
from public.settings s
where not exists (select 1 from public.payment_accounts)
limit 1;

-- ใบสรุปฝั่งลูกค้าต้องโชว์บัญชีของบิลใบนั้น
--
-- ลำดับ: บัญชีที่ผูกกับบิล → บัญชีที่ใช้รับเงินอยู่ตอนนี้ → ค่าเดิมใน settings
-- บิลเก่าที่ยังไม่ผูกบัญชีจะเห็นบัญชีปัจจุบัน ซึ่งเหมือนพฤติกรรมเดิมทุกประการ
create or replace function public.get_public_order(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o           public.orders%rowtype;
  s           public.settings%rowtype;
  acct        public.payment_accounts%rowtype;
  safe_items  jsonb;
  slip_state  text;
  slip_note   text;
begin
  if p_token is null or length(p_token) < 16 then
    return null;
  end if;

  select * into o from public.orders where public_token = p_token;
  if not found then
    return null;
  end if;

  select * into s from public.settings limit 1;

  if o.payment_account_id is not null then
    select * into acct from public.payment_accounts where id = o.payment_account_id;
  end if;

  if acct.id is null then
    select * into acct from public.payment_accounts
    where is_active and not archived
    limit 1;
  end if;

  -- ตัด cost ทิ้งทีละรายการ ห้ามให้ต้นทุนหลุดออกไปกับใบสรุป
  select coalesce(jsonb_agg(item - 'cost'), '[]'::jsonb)
    into safe_items
    from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) as item;

  select ps.status, ps.review_note into slip_state, slip_note
  from public.payment_slips ps
  where ps.order_id = o.id
  order by ps.created_at desc
  limit 1;

  return jsonb_build_object(
    'order_number',          o.order_number,
    'created_at',            o.created_at,
    'items',                 safe_items,
    'total_amount',          o.total_amount,
    'total_fish',            o.total_fish,
    'shipping_fee',          o.shipping_fee,
    'discount',              o.discount,
    'status',                o.status,
    'payment_status',        o.payment_status,
    'paid_amount',           o.paid_amount,
    'tracking_number',       o.tracking_number,
    'customer_name',         o.customer_name,
    'customer_phone',        o.customer_phone,
    'customer_address',      o.customer_address,
    'note',                  o.note,
    'slip_status',           slip_state,
    'slip_note',             slip_note,
    'line_display_name',     o.line_display_name,
    'contact_from_customer', o.contact_from_customer,
    'payment', jsonb_build_object(
      'promptpay_id',   coalesce(acct.promptpay_id,   s.promptpay_id),
      'bank_name',      coalesce(acct.bank_name,      s.bank_name),
      'account_number', coalesce(acct.account_number, s.account_number),
      'account_name',   coalesce(acct.account_name,   s.account_name)
    )
  );
end;
$$;

revoke all on function public.get_public_order(text) from public;
grant execute on function public.get_public_order(text) to anon, authenticated;
