-- ซิงก์ role/shop_name จาก app_users เดิม เข้าตาราง profiles
--
-- trigger handle_new_user ทำให้อยู่แล้วตอนสร้าง auth user แต่จะจับคู่ได้ก็ต่อเมื่อ
-- ส่วนหน้า @ ของอีเมล ตรงกับ username เดิมเป๊ะ ๆ
-- ไฟล์นี้ไล่ซิงก์ซ้ำอีกรอบ (idempotent) แล้วรายงานผลออกมาทาง NOTICE

update public.profiles p
set
  role      = coalesce(a.role, p.role),
  shop_name = coalesce(nullif(a.shop_name, ''), nullif(p.shop_name, ''), '')
from public.app_users a
where a.username = p.username
  and (p.role is distinct from coalesce(a.role, p.role)
       or p.shop_name is distinct from coalesce(nullif(a.shop_name, ''), nullif(p.shop_name, ''), ''));

-- รายงานสถานะปัจจุบัน
do $$
declare
  r record;
  n_total int;
  n_admin int;
begin
  select count(*) into n_total from public.profiles;
  select count(*) into n_admin from public.profiles where role = 'admin';

  raise notice '=== profiles ทั้งหมด % รายการ (admin % คน) ===', n_total, n_admin;

  for r in
    select p.username, p.role, p.shop_name,
           (a.username is not null) as matched_legacy
    from public.profiles p
    left join public.app_users a on a.username = p.username
    order by p.username
  loop
    raise notice 'username=% | role=% | shop=% | จับคู่ app_users เดิม=%',
      r.username, r.role, coalesce(nullif(r.shop_name, ''), '(ว่าง)'), r.matched_legacy;
  end loop;

  -- บัญชีเดิมที่ยังไม่มี auth user คู่กัน = ยังล็อกอินระบบใหม่ไม่ได้
  for r in
    select a.username, a.role
    from public.app_users a
    left join public.profiles p on p.username = a.username
    where p.username is null
  loop
    raise notice '⚠️ app_users "%" (role=%) ยังไม่มีบัญชี Supabase Auth — จะล็อกอินระบบใหม่ไม่ได้',
      r.username, r.role;
  end loop;
end $$;
