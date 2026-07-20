-- เลขพร้อมเพย์ของร้าน ใช้สร้าง QR ที่ฝังยอดเงินไว้แล้ว
-- รับได้ทั้งเบอร์มือถือ 10 หลัก, เลขบัตรประชาชน 13 หลัก และ e-Wallet 15 หลัก
-- เก็บเป็น text เพราะต้องคงเลข 0 นำหน้าของเบอร์ไว้
alter table public.settings
  add column if not exists promptpay_id text;
