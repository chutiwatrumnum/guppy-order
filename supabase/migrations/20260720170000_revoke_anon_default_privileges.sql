-- ปิดรูที่จะกลับมาเงียบ ๆ ในอนาคต
--
-- migration ก่อนหน้า (lock_down_rls) revoke สิทธิ์ anon ออกจาก "ตารางที่มีอยู่ ณ ตอนนั้น" เท่านั้น
-- แต่ Supabase ตั้ง default privileges ไว้ให้ grant กับ anon อัตโนมัติ
-- ตารางไหนที่สร้างหลังจากนี้จึงจะเปิดให้คนไม่ล็อกอินอีกโดยไม่มีใครรู้ตัว

alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

-- ครอบ default privileges ที่ตั้งไว้ในนามบทบาทอื่นด้วย (ตารางที่ postgres/supabase_admin เป็นคนสร้าง)
alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;

-- กันพลาดอีกชั้น: revoke ตารางที่มีอยู่ตอนนี้ซ้ำ เผื่อมีตารางเกิดใหม่ระหว่าง migration สองตัวนี้
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

-- anon ยังต้องเห็น schema เพื่อให้ endpoint auth ทำงาน (ล็อกอินไม่ผ่าน public tables อยู่แล้ว)
grant usage on schema public to anon;
