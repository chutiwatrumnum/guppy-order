ALTER TABLE breeds ADD COLUMN IF NOT EXISTS cost_piece integer DEFAULT 0;
ALTER TABLE breeds ADD COLUMN IF NOT EXISTS cost_pair integer DEFAULT 0;
ALTER TABLE breeds ADD COLUMN IF NOT EXISTS cost_set integer DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_cost integer DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS actual_shipping_fee integer DEFAULT 0;

-- Sync existing actual_shipping_fee with shipping_fee
UPDATE orders SET actual_shipping_fee = shipping_fee WHERE actual_shipping_fee = 0;
