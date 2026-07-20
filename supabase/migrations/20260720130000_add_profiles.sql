-- Stage A: เตรียม Supabase Auth — ยังไม่กระทบการใช้งานเดิม
-- app_users เดิมยังอยู่ครบ ล็อกอินแบบเก่ายังทำงานได้ตามปกติ

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique,
  shop_name  text not null default '',
  role       text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- อ่านได้เฉพาะโปรไฟล์ของตัวเอง และห้ามแก้ role ของตัวเอง (ไม่มี policy insert/update ให้ client)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- สร้าง profile อัตโนมัติทุกครั้งที่มี auth user ใหม่
--
-- ลำดับการหาค่า: user metadata → ตาราง app_users เดิม (จับคู่ด้วย username) → ค่า default
-- ที่ต้องเผื่อ app_users ไว้เพราะฟอร์ม "Add user" ใน Dashboard ตั้ง metadata ไม่ได้
-- ถ้าไม่มีขั้นนี้ บัญชี admin เดิมจะกลายเป็น role 'user' ตอนย้ายระบบ
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username   text;
  v_shop_name  text;
  v_role       text;
begin
  v_username := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));

  -- app_users จะถูกลบทิ้งใน Stage C จึงต้องเช็คก่อนว่ายังมีตารางอยู่ไหม
  if to_regclass('public.app_users') is not null then
    execute 'select shop_name, role from public.app_users where username = $1 limit 1'
      into v_shop_name, v_role
      using v_username;
  end if;

  insert into public.profiles (id, username, shop_name, role)
  values (
    new.id,
    v_username,
    coalesce(new.raw_user_meta_data->>'shop_name', v_shop_name, ''),
    coalesce(new.raw_user_meta_data->>'role', v_role, 'user')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- backfill: บัญชีที่สร้างไว้ใน Dashboard ก่อน migration นี้
-- จับคู่กับ app_users เดิมด้วยส่วนหน้า @ ของอีเมล เพื่อยก shop_name/role ตามมาด้วย
insert into public.profiles (id, username, shop_name, role)
select
  u.id,
  lower(split_part(u.email, '@', 1)),
  coalesce(a.shop_name, ''),
  coalesce(a.role, 'user')
from auth.users u
left join public.app_users a
  on a.username = lower(split_part(u.email, '@', 1))
where u.email is not null
on conflict (id) do nothing;
