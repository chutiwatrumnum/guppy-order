-- Add bill-level discount field to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount integer DEFAULT 0;
