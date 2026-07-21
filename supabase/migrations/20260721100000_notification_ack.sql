-- ให้ร้านกด "รับทราบ" notification ที่ส่งไม่ถึงได้
-- จะได้ไม่ค้างเตือนตลอด หลังจากร้านติดต่อลูกค้าเองแล้ว
alter table public.line_notifications
  add column if not exists acknowledged_at timestamptz;
