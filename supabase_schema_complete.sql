-- =====================================================
-- GUPPY ORDER SYSTEM - DATABASE SCHEMA (COMPLETE)
-- รัน SQL นี้ทั้งหมดใน Supabase SQL Editor
-- =====================================================

-- 1. ตาราง breeds (สายพันธุ์ปลา)
CREATE TABLE IF NOT EXISTS breeds (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price_piece integer NOT NULL DEFAULT 0,
  price_pair integer NOT NULL DEFAULT 0,
  price_set integer DEFAULT 0,
  cost_price integer DEFAULT 0,           -- ต้นทุน (optional)
  description text,                       -- รายละเอียด
  image_url text,                         -- รูปภาพ (optional)
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 2. ตาราง settings (ตั้งค่าร้าน)
CREATE TABLE IF NOT EXISTS settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id text DEFAULT 'default',
  shop_name text DEFAULT 'Guppy Shop',
  bank_name text DEFAULT 'กสิกรไทย',
  account_number text DEFAULT '',
  account_name text DEFAULT '',
  shipping_fee integer DEFAULT 60,
  logo_url text,
  address text,
  phone text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 3. ตาราง orders (ออเดอร์/บิลขาย) - แบบละเอียด
CREATE TABLE IF NOT EXISTS orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number text UNIQUE,               -- เลขบิล (e.g., B20250222-001)
  shop_id text DEFAULT 'default',
  
  -- ข้อมูลลูกค้า
  customer_name text,
  customer_phone text,
  customer_address text,
  
  -- รายการสินค้า (JSON Array)
  items jsonb NOT NULL DEFAULT '[]',
  
  -- ยอดเงิน
  subtotal integer NOT NULL DEFAULT 0,    -- ยอดรวมก่อนส่วนลด
  discount_total integer DEFAULT 0,       -- ส่วนลดรวม
  shipping_fee integer DEFAULT 0,         -- ค่าส่ง
  total_amount integer NOT NULL DEFAULT 0, -- ยอดสุทธิ
  
  -- จำนวน
  total_items integer DEFAULT 0,          -- จำนวนรายการ
  total_fish integer DEFAULT 0,           -- จำนวนปลารวม
  total_free_qty integer DEFAULT 0,       -- จำนวนแถม
  
  -- สถานะ
  status text DEFAULT 'completed',        -- completed, cancelled, refunded
  payment_status text DEFAULT 'pending',  -- pending, paid, cancelled
  payment_method text,                    -- cash, transfer, credit
  
  -- หมายเหตุ
  note text,
  admin_note text,                        -- หมายเหตุสำหรับ admin
  
  -- ข้อมูลการสร้าง
  created_by text,
  created_by_name text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 4. ตาราง order_items (รายการในออเดอร์ - แยกเก็บเพื่อง่ายต่อการ query)
CREATE TABLE IF NOT EXISTS order_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  breed_id uuid REFERENCES breeds(id),
  breed_name text NOT NULL,
  
  type text NOT NULL,                     -- piece, pair, set
  quantity integer NOT NULL DEFAULT 1,
  price_per_unit integer NOT NULL,
  
  gender text DEFAULT 'mixed',            -- male, female, mixed
  discount integer DEFAULT 0,             -- ส่วนลดบาท
  free_qty integer DEFAULT 0,             -- จำนวนแถม
  
  subtotal integer NOT NULL,              -- ราคารวม
  total integer NOT NULL,                 -- ราคาสุทธิ (หลังหักส่วนลด/แถม)
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 5. ตาราง customers (ลูกค้าประจำ)
CREATE TABLE IF NOT EXISTS customers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  phone text,
  address text,
  email text,
  line_id text,
  
  total_orders integer DEFAULT 0,
  total_spent integer DEFAULT 0,
  points integer DEFAULT 0,               -- แต้มสะสม
  
  note text,
  is_vip boolean DEFAULT false,
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 6. ตาราง stock (สต็อกปลา)
CREATE TABLE IF NOT EXISTS stock (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  breed_id uuid REFERENCES breeds(id) ON DELETE CASCADE,
  
  quantity_in integer DEFAULT 0,          -- รับเข้า
  quantity_out integer DEFAULT 0,         -- ขายออก
  quantity_free integer DEFAULT 0,        -- แถม
  current_stock integer DEFAULT 0,        -- คงเหลือ
  
  min_stock integer DEFAULT 5,            -- จุดสั่งซื้อ (เตือน)
  max_stock integer DEFAULT 100,          -- จำนวนสูงสุด
  
  last_updated timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_by text
);

-- 7. ตาราง stock_transactions (ประวัติการเคลื่อนไหวสต็อก)
CREATE TABLE IF NOT EXISTS stock_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  breed_id uuid REFERENCES breeds(id),
  breed_name text,
  
  type text NOT NULL,                     -- in, out, free, adjust
  quantity integer NOT NULL,
  before_qty integer,
  after_qty integer,
  
  reason text,                            -- สาเหตุ
  order_id uuid REFERENCES orders(id),    -- เชื่อมกับออเดอร์ (ถ้ามี)
  
  created_by text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 8. ตาราง shop_users (ผู้ใช้งาน)
CREATE TABLE IF NOT EXISTS shop_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name text,
  
  role text DEFAULT 'user',               -- admin, manager, user
  shop_id text DEFAULT 'default',
  
  is_active boolean DEFAULT true,
  last_login timestamp with time zone,
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- INDEXES (เพิ่มความเร็ว)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_breed_id ON order_items(breed_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_stock_breed_id ON stock(breed_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE breeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_users ENABLE ROW LEVEL SECURITY;

-- Policy สำหรับ development (เปิดให้เข้าถึงทั้งหมด)
CREATE POLICY "Allow all on breeds" ON breeds FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on settings" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on order_items" ON order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on stock" ON stock FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on stock_transactions" ON stock_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on shop_users" ON shop_users FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function สร้างเลขบิลอัตโนมัติ
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  date_part text;
  sequence_num integer;
  new_number text;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM orders
  WHERE order_number LIKE 'B' || date_part || '-%';
  
  new_number := 'B' || date_part || '-' || LPAD(sequence_num::text, 3, '0');
  NEW.order_number := new_number;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger สร้างเลขบิลก่อน insert
CREATE TRIGGER trigger_generate_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION generate_order_number();

-- Function อัพเดต updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers สำหรับ updated_at
CREATE TRIGGER update_breeds_updated_at BEFORE UPDATE ON breeds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INSERT DEFAULT DATA
-- =====================================================

-- Settings เริ่มต้น
INSERT INTO settings (shop_id, shop_name, bank_name, account_number, account_name, shipping_fee)
VALUES ('default', 'Guppy Shop', 'กสิกรไทย', '', '', 60)
ON CONFLICT DO NOTHING;

-- สายพันธุ์ตัวอย่าง
INSERT INTO breeds (name, price_piece, price_pair, price_set, description) VALUES
('Full Gold', 50, 90, 0, 'ปลาทองล้วน สีสวย'),
('Big Ear Red Tail', 40, 80, 0, 'หูใหญ่ หางแดง'),
('Metallic Red', 60, 110, 0, 'สีแดงเมทัลลิก'),
('Blue Grass', 55, 100, 0, 'สีน้ำเงิน ลายหญ้า'),
('Dumbo Ear', 70, 130, 0, 'หูช้างใหญ่พิเศษ')
ON CONFLICT DO NOTHING;

-- สร้างสต็อกเริ่มต้นสำหรับสายพันธุ์
INSERT INTO stock (breed_id, current_stock, min_stock)
SELECT id, 0, 5 FROM breeds
ON CONFLICT DO NOTHING;

-- Admin user (password: admin123 - ต้องเปลี่ยนใน production)
-- ใช้ bcrypt hash
INSERT INTO shop_users (username, password_hash, display_name, role)
VALUES ('admin', '$2a$10$YourHashedPasswordHere', 'Admin', 'admin')
ON CONFLICT DO NOTHING;

-- =====================================================
-- VIEWS (สำหรับรายงาน)
-- =====================================================

-- View ยอดขายรายวัน
CREATE OR REPLACE VIEW daily_sales AS
SELECT 
  DATE(created_at) as sale_date,
  COUNT(*) as order_count,
  SUM(total_amount) as total_sales,
  SUM(total_fish) as total_fish,
  SUM(shipping_fee) as total_shipping
FROM orders
WHERE status = 'completed'
GROUP BY DATE(created_at)
ORDER BY sale_date DESC;

-- View ยอดขายตามสายพันธุ์
CREATE OR REPLACE VIEW breed_sales AS
SELECT 
  oi.breed_id,
  oi.breed_name,
  SUM(oi.quantity) as total_qty,
  SUM(oi.total) as total_sales,
  COUNT(DISTINCT oi.order_id) as order_count
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
WHERE o.status = 'completed'
GROUP BY oi.breed_id, oi.breed_name
ORDER BY total_sales DESC;

-- View สต็อกปัจจุบัน
CREATE OR REPLACE VIEW current_stock_view AS
SELECT 
  b.id,
  b.name,
  b.price_piece,
  b.price_pair,
  COALESCE(s.current_stock, 0) as current_stock,
  COALESCE(s.min_stock, 5) as min_stock,
  CASE 
    WHEN COALESCE(s.current_stock, 0) <= COALESCE(s.min_stock, 5) THEN 'low'
    WHEN COALESCE(s.current_stock, 0) <= COALESCE(s.min_stock, 5) * 2 THEN 'medium'
    ELSE 'good'
  END as stock_status
FROM breeds b
LEFT JOIN stock s ON b.id = s.breed_id
WHERE b.is_active = true;

-- =====================================================
-- COMPLETE!
-- =====================================================