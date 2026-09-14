// หน้าทดสอบชั่วคราวสำหรับตรวจ FailedNotifications โดยไม่ต้องล็อกอิน — ลบทิ้งหลังตรวจเสร็จ
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/index.css';
import { supabase } from '@/lib/supabase';
import { Toaster } from '@/components/ui/sonner';
import FailedNotifications from '@/components/FailedNotifications';

const rows = [
  {
    id: 'ship',
    message:
      '🚚 จัดส่งแล้วครับ\nบิล B20260914-0001\nเลขพัสดุ JD000000001TH\n\n🔔 จะแจ้งให้ตอนไปรษณีย์รับเข้าระบบ ตอนออกไปนำจ่าย และตอนส่งถึง\nถ้านำจ่ายไม่สำเร็จหรือตีกลับ จะแจ้งทันทีเหมือนกันครับ\n\nบ้านหมีฝากรีวิว ติ/ชม หน้าช่องด้วยนะค้าบ\nhttps://vt.tiktok.com/example/',
    images: ['/icon-192.png', '/icon-512.png'],
    error: '429 - Too Many Requests',
    created_at: '2026-09-14T08:00:00Z',
    orders: { order_number: 'B20260914-0001', customer_name: 'ลูกค้าทดสอบ', customer_phone: '0800000000' },
  },
  {
    id: 'paid',
    message: '✅ ยืนยันการชำระเงินแล้วครับ\nบิล B20260914-0001 · ฿380\nทางร้านกำลังจัดเตรียมพัสดุ',
    images: [],
    error: '429 - Too Many Requests',
    created_at: '2026-09-14T07:00:00Z',
    orders: { order_number: 'B20260914-0001', customer_name: 'ลูกค้าทดสอบ', customer_phone: '0800000000' },
  },
  {
    id: 'old',
    message: '📦 พัสดุ JD000000002TH\nบิล B20260912-0002',
    images: null,
    error: '400 - Bad Request',
    created_at: '2026-09-12T07:00:00Z',
    orders: null,
  },
];

// แทนที่คำขอ Supabase ด้วยข้อมูลปลอม — ครอบคลุมแค่ที่คอมโพเนนต์นี้เรียก
const query = {
  select: () => query,
  eq: () => query,
  is: () => query,
  order: async () => ({ data: rows, error: null }),
  update: () => ({ eq: async () => ({ error: null }) }),
};
supabase.from = () => query;

// จดทุกข้อความที่คอมโพเนนต์สั่งคัดลอก แล้วส่งต่อให้ clipboard จริง
window.__copied = [];
const realClipboard = navigator.clipboard;
Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: async (text) => {
      let ok = true;
      try {
        await realClipboard?.writeText(text);
      } catch {
        ok = false;
      }
      window.__copied.push({ text, ok });
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <FailedNotifications />
    </div>
    <Toaster />
  </React.StrictMode>
);
