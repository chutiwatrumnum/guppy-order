// เทสตัวตรวจที่อยู่ก่อนบันทึก
//
//   node scripts/test-address-validation.mjs
//
// เคสที่ "ควรผ่าน" มาจากที่อยู่จริงของลูกค้า เคสที่ "ควรไม่ผ่าน" มาจากของที่
// เคยหลุดเข้าฐานข้อมูลไปแล้วจริง ๆ ("นครปฐม", "James")
//
// กฎตรงนี้ตั้งใจให้หลวม — เข้มเกินไปจะไปบล็อกที่อยู่จริง
// เจอที่อยู่จริงที่ถูกบล็อก ให้เพิ่มเคสที่นี่ก่อนแก้ address.ts

import { build } from 'esbuild';
import { unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

const out = join(tmpdir(), `addr-validate-${Date.now()}.mjs`);
await build({
  entryPoints: ['src/utils/address.ts'],
  outfile: out,
  format: 'esm',
  logLevel: 'error',
});
const { validateShippingContact, normalizeThaiPhone } = await import(pathToFileURL(out).href);
unlinkSync(out);

const OK_NAME = 'สมชาย ใจดี';
const OK_PHONE = '0812345678';
const OK_ADDR = '123/45 ม.5 ต.บางแก้ว อ.บางพลี จ.สมุทรปราการ 10540';

const contactCases = [
  // ── ควรผ่าน ──
  { label: 'ที่อยู่เต็มรูปแบบ', input: { name: OK_NAME, phone: OK_PHONE, address: OK_ADDR }, pass: true },
  {
    label: 'ที่อยู่สั้นแต่ครบองค์ประกอบ',
    input: { name: OK_NAME, phone: OK_PHONE, address: '9/9 ต.ก อ.ข ค 10000' },
    pass: true,
  },
  {
    label: 'รหัสไปรษณีย์อยู่กลางข้อความ',
    input: { name: OK_NAME, phone: OK_PHONE, address: 'อยุธยา 13000 บ้านเลขที่ 1 หมู่ 2 ต.สามเรือน' },
    pass: true,
  },
  { label: 'เบอร์มีขีดคั่น', input: { name: OK_NAME, phone: '081-234-5678', address: OK_ADDR }, pass: true },
  { label: 'เบอร์ +66', input: { name: OK_NAME, phone: '+66812345678', address: OK_ADDR }, pass: true },
  { label: 'เบอร์ตกเลข 0 หน้า', input: { name: OK_NAME, phone: '823233256', address: OK_ADDR }, pass: true },
  { label: 'เบอร์บ้าน 9 หลัก', input: { name: OK_NAME, phone: '021234567', address: OK_ADDR }, pass: true },

  // ── ควรไม่ผ่าน ── (เคยหลุดเข้าฐานข้อมูลมาแล้วทั้งคู่)
  { label: 'ที่อยู่เป็นชื่อจังหวัดเฉย ๆ', input: { name: OK_NAME, phone: OK_PHONE, address: 'นครปฐม' }, pass: false },
  { label: 'ที่อยู่เป็นชื่อคน', input: { name: OK_NAME, phone: OK_PHONE, address: 'James' }, pass: false },
  {
    label: 'ครบทุกอย่างแต่ไม่มีรหัสไปรษณีย์',
    input: { name: OK_NAME, phone: OK_PHONE, address: '123/45 ม.5 ต.บางแก้ว อ.บางพลี จ.สมุทรปราการ' },
    pass: false,
  },
  {
    label: 'รหัสไปรษณีย์ขึ้นต้นด้วย 0',
    input: { name: OK_NAME, phone: OK_PHONE, address: '123/45 ต.ก อ.ข จ.ค 01234' },
    pass: false,
  },
  { label: 'ไม่กรอกชื่อ', input: { name: '  ', phone: OK_PHONE, address: OK_ADDR }, pass: false },
  { label: 'ไม่กรอกเบอร์', input: { name: OK_NAME, phone: '', address: OK_ADDR }, pass: false },
  { label: 'เบอร์สั้นเกิน', input: { name: OK_NAME, phone: '0812345', address: OK_ADDR }, pass: false },
  { label: 'เบอร์เป็นตัวอักษร', input: { name: OK_NAME, phone: 'ไม่มี', address: OK_ADDR }, pass: false },
  { label: 'ไม่กรอกที่อยู่', input: { name: OK_NAME, phone: OK_PHONE, address: '' }, pass: false },
];

const phoneCases = [
  { input: '0812345678', expect: '0812345678' },
  { input: '081-234-5678', expect: '0812345678' },
  { input: '+66812345678', expect: '0812345678' },
  { input: '66812345678', expect: '0812345678' },
  { input: '823233256', expect: '0823233256' },
  { input: '021234567', expect: '021234567' },
  { input: '12345', expect: null },
  { input: '', expect: null },
  { input: 'ไม่มีเบอร์', expect: null },
];

let failed = 0;

console.log('── ตรวจที่อยู่ ──');
for (const { label, input, pass } of contactCases) {
  const problem = validateShippingContact(input);
  const got = problem === null;
  if (got === pass) {
    console.log(`✅ ${label}${problem ? `  → "${problem}"` : ''}`);
  } else {
    failed++;
    console.log(`❌ ${label}`);
    console.log(`     ควร${pass ? 'ผ่าน' : 'ไม่ผ่าน'} แต่${got ? 'ผ่าน' : `ไม่ผ่าน: "${problem}"`}`);
  }
}

console.log('\n── ทำเบอร์ให้เป็นมาตรฐาน ──');
for (const { input, expect } of phoneCases) {
  const got = normalizeThaiPhone(input);
  if (got === expect) {
    console.log(`✅ ${JSON.stringify(input)} → ${JSON.stringify(got)}`);
  } else {
    failed++;
    console.log(`❌ ${JSON.stringify(input)} → ได้ ${JSON.stringify(got)} ควรเป็น ${JSON.stringify(expect)}`);
  }
}

const total = contactCases.length + phoneCases.length;
console.log(`\n${total - failed}/${total} ผ่าน`);
process.exit(failed > 0 ? 1 : 0);
