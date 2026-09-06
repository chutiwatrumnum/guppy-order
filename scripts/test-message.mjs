// เทสข้อความที่ส่งให้ลูกค้าในไลน์
//
//   node scripts/test-message.mjs
//
// ข้อความนี้คือสิ่งเดียวที่ลูกค้าเห็นในแชทก่อนกดลิงก์ ตัวเลขเพี้ยนหรือบรรทัดหาย
// = ลูกค้าทักมาถามทีละคน จึงล็อกทั้งตัวเลขและหน้าตาบรรทัดไว้ที่นี่

import { build } from 'esbuild';
import { unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

const out = join(tmpdir(), `message-${Date.now()}.mjs`);
await build({ entryPoints: ['src/utils/message.ts'], outfile: out, format: 'esm', logLevel: 'error' });
const { buildOrderLinkMessage } = await import(pathToFileURL(out).href);
unlinkSync(out);

let failed = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${label}`);
  if (!ok) {
    console.log(`     ได้      ${JSON.stringify(got)}`);
    console.log(`     ต้องการ  ${JSON.stringify(want)}`);
  }
};
const has = (label, text, line) => check(label, text.includes(line), true);

// บิลตัวอย่าง: ปลา 2 ตัว 200 บาท ลดท้ายบิล 130 ค่าส่ง 80 → 150
const items = [{ id: '1', breedId: 'b1', breedName: 'Full Red Albino', type: 'pair', quantity: 1, price: 200, gender: 'mixed' }];
const msg = buildOrderLinkMessage({
  orderNumber: 'GP-260906-001',
  items,
  totalFish: 2,
  shippingFee: 80,
  billDiscount: 130,
  total: 150,
  url: 'https://liff.line.me/x/o/tok',
});

console.log('── สรุปยอดในข้อความ');
has('จำนวนปลาทั้งหมด', msg, '📊 จำนวนปลาทั้งหมด: 2 ตัว');
has('ค่าปลา', msg, '💰 ค่าปลา: 200 บาท');
has('ส่วนลดท้ายบิล', msg, '🎁 ส่วนลดท้ายบิล: -130 บาท');
has('ค่าจัดส่ง', msg, '🚚 ค่าจัดส่ง: 80 บาท');
has('ยอดรวมทั้งสิ้น', msg, '🔥 ยอดรวมทั้งสิ้น: 150 บาท');

console.log('\n── รายการและลิงก์ยังอยู่ครบ');
has('เลขบิลบนหัวข้อความ', msg, '🐠 ใบสรุปออเดอร์ GP-260906-001');
has('รายการปลา', msg, '• Full Red Albino 1 คู่');
has('ลิงก์ใบสรุป', msg, 'https://liff.line.me/x/o/tok');

console.log('\n── ไม่มีส่วนลดก็ไม่ต้องมีบรรทัดส่วนลด');
const noDiscount = buildOrderLinkMessage({
  orderNumber: 'GP-2', items, totalFish: 2, shippingFee: 80, total: 280, url: 'u',
});
check('ไม่มีบรรทัดส่วนลด', noDiscount.includes('ส่วนลดท้ายบิล'), false);

console.log('\n── ฟรีค่าส่ง');
const freeShip = buildOrderLinkMessage({
  orderNumber: 'GP-3', items, totalFish: 2, shippingFee: 0, total: 200, url: 'u',
});
has('ค่าส่ง 0 เขียนว่าฟรี', freeShip, '🚚 ค่าจัดส่ง: ฟรี');

console.log('\n── ของแถมกับอาหารในรายการ');
const mixed = buildOrderLinkMessage({
  orderNumber: 'GP-4',
  items: [
    { id: '1', breedId: 'b1', breedName: 'Koi', type: 'piece', quantity: 3, price: 100, gender: 'male', freeQty: 1 },
    { id: '2', breedId: 'p1', breedName: 'อาหารลูกปลา', type: 'piece', quantity: 1, price: 120, gender: 'mixed', kind: 'food' },
  ],
  totalFish: 3,
  shippingFee: 80,
  total: 400,
  url: 'u',
});
has('ปลาแถมขึ้นในรายการ', mixed, '• Koi ♂ 3 ตัว (แถม 1)');
has('อาหารแยกหน่วยเป็นชิ้น', mixed, '• 🍤 อาหารลูกปลา 1 ชิ้น');
has('ค่าปลาหักของแถมแล้ว', mixed, '💰 ค่าปลา: 320 บาท');

console.log(failed === 0 ? '\nผ่านทั้งหมด' : `\nไม่ผ่าน ${failed} ข้อ`);
process.exit(failed === 0 ? 0 : 1);
