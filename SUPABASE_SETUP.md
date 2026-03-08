# Supabase Setup Guide for Guppy Order System 🐟

## ขั้นตอนที่ 1: สร้าง Project ใน Supabase

1. ไปที่ https://supabase.com
2. สมัคร/ล็อกอิน แล้วสร้าง New Project
3. ตั้งชื่อ project (เช่น `guppy-order`)
4. รอสักครู่ให้ project พร้อมใช้งาน

## ขั้นตอนที่ 2: รัน SQL สร้างตาราง

1. ใน Supabase Dashboard เลือก **SQL Editor**
2. คลิก **New query**
3. คัดลอกเนื้อหาทั้งหมดจากไฟล์ `supabase_schema.sql`
4. วางลงใน SQL Editor
5. กด **Run** หรือ `Ctrl+Enter`

✅ จะสร้างตารางทั้งหมด 4 ตาราง:
- `breeds` - สายพันธุ์ปลา
- `settings` - ตั้งค่าร้าน
- `orders` - ออเดอร์/บิลขาย
- `shop_users` - ผู้ใช้ (ถ้าต้องการ)

## ขั้นตอนที่ 3: ตั้งค่า Supabase URL และ Key

1. ใน Supabase Dashboard ไปที่ **Project Settings** → **API**
2. คัดลอกค่าเหล่านี้:
   - `Project URL` (เช่น `https://xxxxx.supabase.co`)
   - `anon public` key

3. แก้ไขไฟล์ `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://YOUR_PROJECT_ID.supabase.co'  // <-- ใส่ของคุณ
const supabaseKey = 'YOUR_ANON_KEY'                         // <-- ใส่ของคุณ

export const supabase = createClient(supabaseUrl, supabaseKey)
```

## ขั้นตอนที่ 4: ทดสอบ

1. รันโปรเจกต์: `npm run dev`
2. ลองเพิ่มสายพันธุ์ปลาใน Settings
3. ลองสร้างออเดอร์และกด "บันทึกออเดอร์"
4. ไปดูที่ Supabase → Table Editor → orders ควรเห็นข้อมูลที่บันทึก

## โครงสร้างข้อมูลที่บันทึก

### ตาราง orders (สำคัญ)

```json
{
  "id": "uuid",
  "shop_id": "default",
  "items": [
    {
      "id": "timestamp",
      "breedId": "uuid",
      "breedName": "Full Gold",
      "type": "piece|pair|set",
      "quantity": 4,
      "price": 50,
      "gender": "male|female|mixed",
      "discount": 0,
      "freeQty": 1
    }
  ],
  "total_amount": 200,
  "total_fish": 4,
  "shipping_fee": 60,
  "customer_name": "คุณสมชาย",
  "note": "ลูกค้าประจำ",
  "created_by": "admin",
  "created_at": "2026-02-22T13:00:00Z"
}
```

## การ Query ข้อมูลยอดขาย

ตัวอย่าง SQL สำหรับดูยอดขาย:

```sql
-- ยอดขายวันนี้
SELECT 
  COUNT(*) as order_count,
  SUM(total_amount) as total_sales,
  SUM(total_fish) as total_fish
FROM orders 
WHERE DATE(created_at) = CURRENT_DATE;

-- ยอดขายเดือนนี้
SELECT 
  DATE(created_at) as date,
  COUNT(*) as orders,
  SUM(total_amount) as sales
FROM orders 
WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- สายพันธุ์ขายดี
SELECT 
  jsonb_array_elements(items)->>'breedName' as breed,
  SUM((jsonb_array_elements(items)->>'quantity')::int) as total_qty
FROM orders
GROUP BY breed
ORDER BY total_qty DESC;
```

## หมายเหตุ

- ตอนนี้ใช้ RLS Policy "Allow all" สำหรับ development
- ใน production ควรแก้ไข policy ให้เหมาะสม
- ข้อมูล items เก็บเป็น JSONB เพื่อความยืดหยุ่น