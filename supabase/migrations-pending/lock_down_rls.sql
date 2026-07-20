-- Stage C: ปิดรู — รันหลังจาก Stage B (โค้ด Supabase Auth) deploy และทดสอบล็อกอินผ่านแล้วเท่านั้น
--
-- ⚠️ ไฟล์นี้จงใจอยู่นอกโฟลเดอร์ migrations/ เพื่อไม่ให้ `supabase db push` หยิบไปรันโดยไม่ตั้งใจ
--    เมื่อพร้อมแล้วให้ย้ายเข้า supabase/migrations/ พร้อมตั้งชื่อแบบมี timestamp
--    เช่น  mv supabase/migrations-pending/lock_down_rls.sql \
--            supabase/migrations/20260721090000_lock_down_rls.sql
--
-- ก่อนรัน ตรวจให้แน่ใจว่า:
--   [ ] สร้าง auth users ครบทุกคนใน Dashboard แล้ว
--   [ ] deploy โค้ดที่ใช้ supabase.auth แล้ว
--   [ ] ล็อกอินด้วยบัญชีจริงผ่านแล้วอย่างน้อย 1 บัญชี (โดยเฉพาะบัญชี admin)

-- ── 0. ด่านกันพลาด: ถ้ายังไม่มี profile ที่เป็น admin ให้หยุดทั้ง migration ──
--     (กันกรณีลืมสร้าง auth user แล้วปิดรูจนเข้าหน้าแอดมินไม่ได้อีกเลย)
do $$
declare n_admin int;
begin
  select count(*) into n_admin from public.profiles where role = 'admin';
  if n_admin = 0 then
    raise exception
      'ยกเลิก: ยังไม่มี profile ที่ role = admin เลย — สร้าง auth user และตรวจ role ให้เรียบร้อยก่อนรัน migration นี้';
  end if;
end $$;

-- ── 1. ทิ้ง policy เดิมที่เปิดให้ทุกคน ────────────────────────────────
drop policy if exists "Allow all" on public.orders;
drop policy if exists "Allow all" on public.order_items;
drop policy if exists "Allow all" on public.customers;

-- ── 2. เปิด RLS ให้ตารางที่ยังไม่ได้เปิด ───────────────────────────────
alter table public.breeds   enable row level security;
alter table public.settings enable row level security;

-- ── 3. เฉพาะผู้ที่ล็อกอินแล้วเท่านั้นที่เข้าถึงได้ (anon ไม่ได้อะไรเลย) ──
do $$
declare t text;
begin
  foreach t in array array['orders', 'order_items', 'customers', 'breeds', 'settings']
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t
    );
  end loop;
end $$;

-- ── 4. ตัดสิทธิ์ anon ออกจากทุกตาราง ────────────────────────────────
revoke all on all tables in schema public from anon;
grant usage on schema public to anon;

-- ── 5. ทิ้งตารางรหัสผ่าน plaintext ─────────────────────────────────
-- ⚠️ ถาวร กู้ไม่ได้ — ควร export เก็บไว้ก่อนถ้ายังไม่มั่นใจ
drop table if exists public.app_users;
