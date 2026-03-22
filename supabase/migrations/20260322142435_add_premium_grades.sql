ALTER TABLE breeds ADD COLUMN IF NOT EXISTS premium_price_piece integer;
ALTER TABLE breeds ADD COLUMN IF NOT EXISTS premium_price_pair integer;
ALTER TABLE breeds ADD COLUMN IF NOT EXISTS premium_price_set integer;
ALTER TABLE breeds ADD COLUMN IF NOT EXISTS premium_cost_piece integer;
ALTER TABLE breeds ADD COLUMN IF NOT EXISTS premium_cost_pair integer;
ALTER TABLE breeds ADD COLUMN IF NOT EXISTS premium_cost_set integer;
