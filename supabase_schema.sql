-- =====================================================
-- GUPPY ORDER SYSTEM - SUPABASE DATABASE SETUP
-- รัน SQL นี้ทั้งหมดใน Supabase SQL Editor
-- =====================================================

-- 1. ตาราง breeds (สายพันธุ์ปลา)
CREATE TABLE IF NOT EXISTS breeds (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price_piece integer NOT NULL DEFAULT 0,
  price_pair integer NOT NULL DEFAULT 0,
  price_set integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ตาราง settings (ตั้งค่าร้าน)
CREATE TABLE IF NOT EXISTS settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id text DEFAULT 'default',
  shop_name text DEFAULT 'Guppy Shop',
  shop_address text DEFAULT '',
  shop_phone text DEFAULT '',
  bank_name text DEFAULT 'กสิกรไทย',
  account_number text DEFAULT '',
  account_name text DEFAULT '',
  shipping_fee integer DEFAULT 60,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 3. ตาราง orders (ออเดอร์/บิลขาย)
CREATE TABLE IF NOT EXISTS orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id text DEFAULT 'default',
  items jsonb NOT NULL,              -- เก็บรายการสินค้าเป็น JSON
  total_amount integer NOT NULL,     -- ยอดรวมเงิน
  total_fish integer NOT NULL,       -- จำนวนปลารวม
  shipping_fee integer DEFAULT 0,    -- ค่าส่ง
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,  -- เชื่อมกับลูกค้า
  customer_name text,                -- ชื่อลูกค้า (สำรอง)
  customer_phone text,               -- เบอร์โทรลูกค้า (สำรอง)
  note text,                         -- หมายเหตุ (optional)
  created_by text,                   -- ใครสร้างออเดอร์
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. ตาราง users (ถ้าจะเก็บข้อมูลผู้ใช้ใน Supabase ด้วย)
CREATE TABLE IF NOT EXISTS shop_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,       -- เก็บ hashed password
  shop_name text NOT NULL,
  role text DEFAULT 'user',          -- admin หรือ user
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. ตาราง customers (ลูกค้าประจำ) 🆕
CREATE TABLE IF NOT EXISTS customers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id text DEFAULT 'default',
  name text NOT NULL,                -- ชื่อลูกค้า
  phone text,                        -- เบอร์โทร
  address text,                      -- ที่อยู่
  note text,                         -- หมายเหตุ
  points integer DEFAULT 0,          -- แต้มสะสม
  total_orders integer DEFAULT 0,    -- จำนวนออเดอร์ทั้งหมด
  total_spent integer DEFAULT 0,     -- ยอดซื้อสะสม
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 6. ตาราง stock (สต็อกปลา) 🆕
CREATE TABLE IF NOT EXISTS stock (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  breed_id uuid REFERENCES breeds(id) ON DELETE CASCADE NOT NULL,
  quantity_in integer DEFAULT 0,     -- จำนวนเข้า
  quantity_out integer DEFAULT 0,    -- จำนวนออก (ขาย)
  current_stock integer DEFAULT 0,   -- สต็อกคงเหลือ
  note text,                         -- หมายเหตุการปรับสต็อก
  created_by text,                   -- ใครทำรายการ
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE breeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;

-- สร้าง Policy ให้เข้าถึงได้ทั้งหมด (สำหรับ development)
-- ใน production ควรจำกัดสิทธิ์ตาม user

CREATE POLICY "Allow all on breeds" ON breeds
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on settings" ON settings
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on orders" ON orders
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on shop_users" ON shop_users
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on customers" ON customers
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on stock" ON stock
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- INSERT DEFAULT DATA
-- =====================================================

-- ใส่ข้อมูล settings เริ่มต้น
INSERT INTO settings (shop_id, bank_name, account_number, account_name, shipping_fee, shop_name)
VALUES ('default', 'กสิกรไทย', '', '', 60, 'Guppy Shop')
ON CONFLICT DO NOTHING;

-- ใส่ข้อมูลตัวอย่าง breeds
INSERT INTO breeds (name, price_piece, price_pair, price_set) VALUES
('Full Gold', 50, 90, 0),
('Big Ear Red Tail', 40, 80, 0),
('Metallic Red', 60, 110, 0)
ON CONFLICT DO NOTHING;

-- ใส่สต็อกเริ่มต้นให้แต่ละสายพันธุ์
INSERT INTO stock (breed_id, quantity_in, quantity_out, current_stock)
SELECT id, 100, 0, 100 FROM breeds
ON CONFLICT DO NOTHING;

-- =====================================================
-- INDEXES (เพิ่มความเร็วในการค้นหา)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_breeds_name ON breeds(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_stock_breed_id ON stock(breed_id);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function: อัปเดตยอดซื้อและแต้มลูกค้าเมื่อมีออเดอร์ใหม่
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE customers 
    SET 
      total_orders = total_orders + 1,
      total_spent = total_spent + NEW.total_amount,
      points = points + FLOOR(NEW.total_amount / 100), -- 1 แต้มต่อ 100 บาท
      updated_at = NOW()
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: เรียกฟังก์ชันเมื่อมีการเพิ่มออเดอร์
DROP TRIGGER IF EXISTS trigger_update_customer_stats ON orders;
CREATE TRIGGER trigger_update_customer_stats
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_stats();

-- Function: ลดสต็อกเมื่อมีการขาย
CREATE OR REPLACE FUNCTION reduce_stock_on_order()
RETURNS TRIGGER AS $$
DECLARE
  item_record RECORD;
  fish_count INTEGER;
BEGIN
  FOR item_record IN SELECT * FROM jsonb_to_recordset(NEW.items) AS x(breedId text, quantity integer, type text)
  LOOP
    -- คำนวณจำนวนปลาจริง (piece=1, pair=2)
    fish_count := CASE 
      WHEN item_record.type = 'pair' THEN item_record.quantity * 2
      ELSE item_record.quantity
    END;
    
    -- อัปเดตสต็อกล่าสุด
    UPDATE stock 
    SET 
      quantity_out = quantity_out + fish_count,
      current_stock = current_stock - fish_count,
      updated_at = NOW()
    WHERE breed_id = item_record.breedId::uuid;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: เรียกฟังก์ชันเมื่อมีการเพิ่มออเดอร์
DROP TRIGGER IF EXISTS trigger_reduce_stock ON orders;
CREATE TRIGGER trigger_reduce_stock
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION reduce_stock_on_order();

-- =====================================================
-- คำอธิบาย Fields
-- =====================================================
/*

TABLE: breeds
- id: uuid (primary key)
- name: ชื่อสายพันธุ์ (e.g., "Full Gold")
- price_piece: ราคาต่อตัว
- price_pair: ราคาต่อคู่
- price_set: ราคาต่อ set (ถ้ามี)
- created_at: เวลาสร้าง

TABLE: settings
- id: uuid (primary key)
- shop_id: รหัสร้าน (default: 'default')
- shop_name: ชื่อร้าน
- shop_address: ที่อยู่ร้าน
- shop_phone: เบอร์โทรร้าน
- bank_name: ชื่อธนาคาร
- account_number: เลขบัญชี
- account_name: ชื่อบัญชี
- shipping_fee: ค่าจัดส่ง

TABLE: orders
- id: uuid (primary key)
- shop_id: รหัสร้าน
- items: JSON array เก็บรายการสินค้า
- total_amount: ยอดเงินรวม
- total_fish: จำนวนปลารวม
- shipping_fee: ค่าส่ง
- customer_id: uuid เชื่อมกับ customers
- customer_name: ชื่อลูกค้า
- customer_phone: เบอร์โทรลูกค้า
- note: หมายเหตุ
- created_by: คนสร้างออเดอร์
- created_at: เวลาสร้าง

TABLE: customers (ลูกค้าประจำ) 🆕
- id: uuid (primary key)
- shop_id: รหัสร้าน
- name: ชื่อลูกค้า
- phone: เบอร์โทร
- address: ที่อยู่
- note: หมายเหตุ
- points: แต้มสะสม
- total_orders: จำนวนออเดอร์ทั้งหมด
- total_spent: ยอดซื้อสะสม

TABLE: stock (สต็อกปลา) 🆕
- id: uuid (primary key)
- breed_id: uuid เชื่อมกับ breeds
- quantity_in: จำนวนเข้า
- quantity_out: จำนวนออก (ขาย)
- current_stock: สต็อกคงเหลือ
- note: หมายเหตุ
- created_by: ใครทำรายการ
- created_at: เวลาทำรายการ

*/
