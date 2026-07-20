-- เลิกขายเกรดปกติ: เหลือราคาเดียว (premium_*)
-- 1) breed ไหนที่ยังไม่มีราคาคัดเกรด ให้ยกราคา/ต้นทุนเกรดปกติขึ้นมาเป็นราคาหลัก
--    (กันไม่ให้สายพันธุ์เหล่านั้นกลายเป็นราคา 0 หลัง drop คอลัมน์)
UPDATE breeds SET premium_price_piece = price_piece WHERE COALESCE(premium_price_piece, 0) = 0;
UPDATE breeds SET premium_price_pair  = price_pair  WHERE COALESCE(premium_price_pair, 0) = 0;
UPDATE breeds SET premium_price_set   = price_set   WHERE COALESCE(premium_price_set, 0) = 0;
UPDATE breeds SET premium_cost_piece  = cost_piece  WHERE COALESCE(premium_cost_piece, 0) = 0;
UPDATE breeds SET premium_cost_pair   = cost_pair   WHERE COALESCE(premium_cost_pair, 0) = 0;
UPDATE breeds SET premium_cost_set    = cost_set    WHERE COALESCE(premium_cost_set, 0) = 0;

-- 2) ตั้ง default/NOT NULL ให้ราคาหลัก
UPDATE breeds SET premium_price_piece = 0 WHERE premium_price_piece IS NULL;
UPDATE breeds SET premium_price_pair  = 0 WHERE premium_price_pair IS NULL;
ALTER TABLE breeds ALTER COLUMN premium_price_piece SET DEFAULT 0;
ALTER TABLE breeds ALTER COLUMN premium_price_pair  SET DEFAULT 0;
ALTER TABLE breeds ALTER COLUMN premium_price_piece SET NOT NULL;
ALTER TABLE breeds ALTER COLUMN premium_price_pair  SET NOT NULL;

-- 3) ลบคอลัมน์เกรดปกติทิ้ง
ALTER TABLE breeds
  DROP COLUMN IF EXISTS price_piece,
  DROP COLUMN IF EXISTS price_pair,
  DROP COLUMN IF EXISTS price_set,
  DROP COLUMN IF EXISTS cost_piece,
  DROP COLUMN IF EXISTS cost_pair,
  DROP COLUMN IF EXISTS cost_set;
