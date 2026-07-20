-- ตรวจสอบอย่างเดียว ไม่เปลี่ยนสคีมาถาวร
--
-- สร้างตารางทดสอบขึ้นมาชั่วคราวเพื่อพิสูจน์ว่า default privileges ที่ revoke ไปแล้ว
-- มีผลจริงกับ "ตารางที่เกิดใหม่" แล้วลบทิ้งในบล็อกเดียวกัน
-- ถ้า anon ยังเข้าถึงได้ ให้ล้มทั้ง migration เพื่อไม่ให้ผ่านไปแบบเข้าใจผิดว่าปลอดภัยแล้ว

do $$
declare
  can_select boolean;
  can_insert boolean;
begin
  create table public._privilege_probe (id int);

  can_select := has_table_privilege('anon', 'public._privilege_probe', 'SELECT');
  can_insert := has_table_privilege('anon', 'public._privilege_probe', 'INSERT');

  drop table public._privilege_probe;

  raise notice 'ตารางที่สร้างใหม่ → anon SELECT=% / INSERT=%', can_select, can_insert;

  if can_select or can_insert then
    raise exception
      'ล้มเหลว: ตารางที่สร้างใหม่ยังเปิดให้ anon อยู่ (select=%, insert=%) — default privileges ยัง revoke ไม่ครบทุก role',
      can_select, can_insert;
  end if;

  raise notice '✅ ยืนยันแล้ว: ตารางที่สร้างหลังจากนี้ anon เข้าไม่ได้โดยอัตโนมัติ';
end $$;
