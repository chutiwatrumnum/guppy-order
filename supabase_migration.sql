-- =====================================================
-- MIGRATION: อัพเกรดจากตาราง orders แบบง่าย → แบบครบ
-- เก็บข้อมูลเดิมทั้งหมด + เพิ่มฟีเจอร์ใหม่
-- =====================================================

-- =====================================================
-- 1. อัพเกรดตาราง orders ที่มีอยู่
-- =====================================================

-- เพิ่มคอลัมน์ที่ขาด
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS customer_address text,
  ADD COLUMN IF NOT EXISTS subtotal integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_total integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_items integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_free_qty integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- สร้างเลขบิลให้กับข้อมูลเก่าที่ไม่มี
UPDATE orders 
SET order_number = 'B' || TO_CHAR(created_at::date, 'YYYYMMDD') || '-' || LPAD(id::text, 3, '0')
WHERE order_number IS NULL;

-- =====================================================
-- 2. สร้างตารางใหม่
-- =====================================================

-- ตาราง order_items (รายการในออเดอร์)
CREATE TABLE IF NOT EXISTS order_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  breed_id uuid,
  breed_name text NOT NULL,
  type text NOT NULL DEFAULT 'piece',
  quantity integer NOT NULL DEFAULT 1,
  price_per_unit integer NOT NULL DEFAULT 0,
  gender text DEFAULT 'mixed',
  discount integer DEFAULT 0,
  free_qty integer DEFAULT 0,
  subtotal integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- ตาราง customers (ลูกค้าประจำ)
CREATE TABLE IF NOT EXISTS customers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  phone text,
  address text,
  email text,
  line_id text,
  total_orders integer DEFAULT 0,
  total_spent integer DEFAULT 0,
  points integer DEFAULT 0,
  note text,
  is_vip boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- ตาราง breeds (สายพันธุ์) - ถ้ายังไม่มี
CREATE TABLE IF NOT EXISTS breeds (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price_piece integer NOT NULL DEFAULT 0,
  price_pair integer NOT NULL DEFAULT 0,
  price_set integer DEFAULT 0,
  cost_price integer DEFAULT 0,
  description text,
  image_url text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- ตาราง stock (สต็อกปลา)
CREATE TABLE IF NOT EXISTS stock (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  breed_id uuid REFERENCES breeds(id) ON DELETE CASCADE,
  quantity_in integer DEFAULT 0,
  quantity_out integer DEFAULT 0,
  quantity_free integer DEFAULT 0,
  current_stock integer DEFAULT 0,
  min_stock integer DEFAULT 5,
  max_stock integer DEFAULT 100,
  last_updated timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_by text
);

-- ตาราง stock_transactions (ประวัติการเคลื่อนไหวสต็อก)
CREATE TABLE IF NOT EXISTS stock_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  breed_id uuid REFERENCES breeds(id),
  breed_name text,
  type text NOT NULL,
  quantity integer NOT NULL,
  before_qty integer,
  after_qty integer,
  reason text,
  order_id uuid REFERENCES orders(id),
  created_by text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- ตาราง shop_users (ผู้ใช้งาน)
CREATE TABLE IF NOT EXISTS shop_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name text,
  role text DEFAULT 'user',
  shop_id text DEFAULT 'default',
  is_active boolean DEFAULT true,
  last_login timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ตาราง settings (ตั้งค่าร้าน)
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

-- =====================================================
-- 3. Migrate ข้อมูลเก่า → order_items
-- =====================================================

-- สร้าง order_items จาก orders.items ที่มีอยู่
INSERT INTO order_items (
  order_id, breed_id, breed_name, type, quantity, price_per_unit, 
  gender, discount, free_qty, subtotal, total, created_at
)
SELECT 
  o.id as order_id,
  (item->>'breedId')::uuid as breed_id,
  item->>'breedName' as breed_name,
  COALESCE(item->>'type', 'piece') as type,
  COALESCE((item->>'quantity')::int, 1) as quantity,
  COALESCE((item->>'price')::int, 0) as price_per_unit,
  COALESCE(item->>'gender', 'mixed') as gender,
  COALESCE((item->>'discount')::int, 0) as discount,
  COALESCE((item->>'freeQty')::int, 0) as free_qty,
  COALESCE((item->>'price')::int, 0) * COALESCE((item->>'quantity')::int, 1) as subtotal,
  (COALESCE((item->>'price')::int, 0) * (COALESCE((item->>'quantity')::int, 1) - COALESCE((item->>'freeQty')::int, 0))) - COALESCE((item->>'discount')::int, 0) as total,
  o.created_at
FROM orders o,
LATERAL jsonb_array_elements(o.items) as item
WHERE o.items IS NOT NULL AND jsonb_array_length(o.items) > 0;

-- =====================================================
-- 4. อัพเดตค่าสรุปใน orders
-- =====================================================

UPDATE orders o
SET 
  total_items = (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id),
  subtotal = (SELECT SUM(subtotal) FROM order_items oi WHERE oi.order_id = o.id),
  discount_total = (SELECT SUM(discount) FROM order_items oi WHERE oi.order_id = o.id),
  total_free_qty = (SELECT SUM(free_qty) FROM order_items oi WHERE oi.order_id = o.id),
  total_amount = COALESCE((
    SELECT SUM(total) FROM order_items oi WHERE oi.order_id = o.id
  ), 0) + COALESCE(shipping_fee, 0);

-- =====================================================
-- 5. สร้าง Index
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_breed_id ON order_items(breed_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_stock_breed_id ON stock(breed_id);

-- =====================================================
-- 6. RLS Policies
-- =====================================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE breeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on order_items" ON order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on breeds" ON breeds FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on stock" ON stock FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on stock_transactions" ON stock_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on shop_users" ON shop_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on settings" ON settings FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 7. Functions & Triggers
-- =====================================================

-- Function สร้างเลขบิลอัตโนมัติ
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  date_part text;
  sequence_num integer;
  new_number text;
BEGIN
  IF NEW.order_number IS NULL THEN
    date_part := TO_CHAR(NOW(), 'YYYYMMDD');
    
    SELECT COUNT(*) + 1 INTO sequence_num
    FROM orders
    WHERE order_number LIKE 'B' || date_part || '-%';
    
    new_number := 'B' || date_part || '-' || LPAD(sequence_num::text, 3, '0');
    NEW.order_number := new_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger สร้างเลขบิล
DROP TRIGGER IF EXISTS trigger_generate_order_number ON orders;
CREATE TRIGGER trigger_generate_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_order_number();

-- Function อัพเดต updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_breeds_updated_at BEFORE UPDATE ON breeds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. Views สำหรับรายงาน
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
-- 9. ใส่ข้อมูลเริ่มต้น
-- =====================================================

-- Settings เริ่มต้น
INSERT INTO settings (shop_id, shop_name, bank_name, shipping_fee)
VALUES ('default', 'Guppy Shop', 'กสิกรไทย', 60)
ON CONFLICT DO NOTHING;

-- สายพันธุ์ตัวอย่าง (ถ้ายังไม่มี)
INSERT INTO breeds (name, price_piece, price_pair, description) VALUES
('Full Gold', 50, 90, 'ปลาทองล้วน สีสวย'),
('Big Ear Red Tail', 40, 80, 'หูใหญ่ หางแดง'),
('Metallic Red', 60, 110, 'สีแดงเมทัลลิก'),
('Blue Grass', 55, 100, 'สีน้ำเงิน ลายหญ้า'),
('Dumbo Ear', 70, 130, 'หูช้างใหญ่พิเศษ')
ON CONFLICT DO NOTHING;

-- สร้างสต็อกเริ่มต้น
INSERT INTO stock (breed_id, current_stock, min_stock)
SELECT id, 0, 5 FROM breeds b
WHERE NOT EXISTS (SELECT 1 FROM stock s WHERE s.breed_id = b.id)
ON CONFLICT DO NOTHING;

-- =====================================================
-- ✅ MIGRATION COMPLETE!
-- =====================================================

-- ตรวจสอบผลลัพธ์
SELECT 
  'orders' as table_name, COUNT(*) as count FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL
SELECT 'breeds', COUNT(*) FROM breeds
UNION ALL
SELECT 'customers', COUNT(*) FROM customers;