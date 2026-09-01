-- สินค้าอื่นที่ไม่ใช่ปลา (อาหาร ฯลฯ)
--
-- แยกจากตาราง breeds เพราะไม่มีเพศ ไม่มีตัว/คู่/ชุด และไม่ควรถูกนับเป็น "จำนวนปลา"
-- ในออเดอร์ รายการอาหารเก็บใน items เดียวกับปลา แต่ติดธง kind='food' ให้แยกออกได้

create table if not exists public.products (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  price      integer not null default 0,
  cost       integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

-- เข้าถึงได้เฉพาะผู้ล็อกอิน ตรงกับที่ล็อกทั้งระบบไว้ (anon แตะไม่ได้)
drop policy if exists products_authenticated_all on public.products;
create policy products_authenticated_all
  on public.products for all to authenticated
  using (true) with check (true);
