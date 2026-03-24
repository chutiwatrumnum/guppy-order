-- Add note column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS note text;
