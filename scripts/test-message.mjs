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
const { buildOrderLinkMessage, buildShippingNotice, parseShippingNotice } = await import(pathToFileURL(out).href);
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

console.log('\n── ข้อความจัดส่ง (บอท push)');
const pushed = buildShippingNotice({
  orderNumber: 'B20260914-0514',
  tracking: 'JD059556938TH',
  promiseAlerts: true,
  extra: '  บ้านหมีฝากรีวิวด้วยนะค้าบ\n',
});
check(
  'หน้าตาเท่าเดิมทุกบรรทัด',
  pushed,
  '🚚 จัดส่งแล้วครับ\nบิล B20260914-0514\nเลขพัสดุ JD059556938TH\n\n' +
    '🔔 จะแจ้งให้ตอนไปรษณีย์รับเข้าระบบ ตอนออกไปนำจ่าย และตอนส่งถึง\nถ้านำจ่ายไม่สำเร็จหรือตีกลับ จะแจ้งทันทีเหมือนกันครับ\n\n' +
    'บ้านหมีฝากรีวิวด้วยนะค้าบ'
);
check(
  'สมัครติดตามไม่ผ่าน: ไม่สัญญาว่าจะแจ้ง และไม่มีบรรทัดว่างห้อยท้าย',
  buildShippingNotice({ orderNumber: 'B1', tracking: 'JD000000001TH', promiseAlerts: false, extra: '   ' }),
  '🚚 จัดส่งแล้วครับ\nบิล B1\nเลขพัสดุ JD000000001TH'
);

console.log('\n── ข้อความจัดส่งที่ร้านคัดลอกไปส่งเอง');
check(
  'อ่านเลขบิล/เลขพัสดุกลับได้',
  JSON.stringify(parseShippingNotice(pushed)),
  JSON.stringify({ orderNumber: 'B20260914-0514', tracking: 'JD059556938TH' })
);
const manual = buildShippingNotice({
  ...parseShippingNotice(pushed),
  promiseAlerts: false,
  extra: '📦 กดปุ่ม "พัสดุของฉัน"',
});
check('ตัดบรรทัดสัญญาแจ้งเตือนอัตโนมัติ', manual.includes('🔔'), false);
has('ใช้คำล่าสุดจากหน้าตั้งค่า', manual, '📦 กดปุ่ม "พัสดุของฉัน"');
check('ไม่เอาคำเก่าที่ค้างในคิวมาด้วย', manual.includes('บ้านหมีฝากรีวิวด้วยนะค้าบ'), false);
check('ข้อความยืนยันชำระเงินไม่ใช่ข้อความจัดส่ง', parseShippingNotice('✅ ยืนยันการชำระเงินแล้วครับ\nบิล B1 · ฿380'), null);
check('การ์ดพัสดุจากปุ่มส่งซ้ำไม่ใช่ข้อความจัดส่ง', parseShippingNotice('📦 พัสดุ JD000000001TH\nบิล B1'), null);

console.log('\n── ข้อความตอนต้องส่งเอง');
check(
  'อยู่ตรงที่บรรทัด 🔔 เคยอยู่ คั่นก่อนข้อความปกติ',
  buildShippingNotice({
    ...parseShippingNotice(pushed),
    promiseAlerts: false,
    manualNote: '⚠️ ระบบแจ้งเตือนมีปัญหา กดเช็คเองไปก่อนนะครับ\n',
    extra: 'บ้านหมีฝากรีวิวด้วยนะค้าบ',
  }),
  '🚚 จัดส่งแล้วครับ\nบิล B20260914-0514\nเลขพัสดุ JD059556938TH\n\n' +
    '⚠️ ระบบแจ้งเตือนมีปัญหา กดเช็คเองไปก่อนนะครับ\n\n' +
    'บ้านหมีฝากรีวิวด้วยนะค้าบ'
);
check(
  'บอทส่งเองยังสัญญาแจ้งเตือนตามเดิม ไม่เอาข้อความตอนส่งเองมาปน',
  buildShippingNotice({ orderNumber: 'B1', tracking: 'JD000000001TH', promiseAlerts: true, manualNote: '⚠️ มีปัญหา' }).includes('⚠️'),
  false
);
check(
  'ช่องว่างก็ไม่มีบรรทัดว่างเกินมา',
  buildShippingNotice({ orderNumber: 'B1', tracking: 'JD000000001TH', promiseAlerts: false, manualNote: '  ', extra: 'ท้าย' }),
  '🚚 จัดส่งแล้วครับ\nบิล B1\nเลขพัสดุ JD000000001TH\n\nท้าย'
);

console.log(failed === 0 ? '\nผ่านทั้งหมด' : `\nไม่ผ่าน ${failed} ข้อ`);
process.exit(failed === 0 ? 0 : 1);
