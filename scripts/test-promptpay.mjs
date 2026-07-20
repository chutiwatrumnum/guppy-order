// เทสตัวสร้าง payload QR พร้อมเพย์
//
//   node scripts/test-promptpay.mjs
//
// payload ผิด = ลูกค้าสแกนไม่ได้ หรือหนักกว่านั้นคือเงินเข้าผิดบัญชี
// จึงเช็ค 2 ชั้น: อัลกอริทึม CRC เทียบค่ามาตรฐาน และถอด TLV กลับมาดูทีละช่อง

import { build } from 'esbuild';
import { unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

const out = join(tmpdir(), `promptpay-${Date.now()}.mjs`);
await build({ entryPoints: ['src/utils/promptpay.ts'], outfile: out, format: 'esm', logLevel: 'error' });
const { buildPromptPayPayload, crc16, detectTarget } = await import(pathToFileURL(out).href);
unlinkSync(out);

let failed = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${label}`);
  if (!ok) {
    console.log(`     ได้      ${JSON.stringify(got)}`);
    console.log(`     ควรเป็น ${JSON.stringify(want)}`);
  }
};

/** ถอด TLV ชั้นเดียวเป็น map */
function decodeTlv(s) {
  const out = {};
  let i = 0;
  while (i < s.length) {
    const id = s.slice(i, i + 2);
    const len = parseInt(s.slice(i + 2, i + 4), 10);
    out[id] = s.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}

console.log('── CRC-16/CCITT-FALSE');
// ค่าตรวจสอบมาตรฐานของอัลกอริทึมนี้ ถ้าตรงแปลว่า poly/init/ทิศบิตถูกหมด
check("crc16('123456789') = 29B1", crc16('123456789'), '29B1');

console.log('\n── แยกประเภทเลขพร้อมเพย์');
check('เบอร์ 10 หลัก', detectTarget('081-234-5678')?.kind, 'mobile');
check('บัตรประชาชน 13 หลัก', detectTarget('1234567890123')?.kind, 'nationalId');
check('e-Wallet 15 หลัก', detectTarget('123456789012345')?.kind, 'ewallet');
check('หลักไม่เข้าพวก', detectTarget('12345'), undefined);

console.log('\n── โครงสร้าง payload (เบอร์ + ระบุยอด)');
const payload = buildPromptPayPayload({ id: '0899999999', amount: 100 });
const root = decodeTlv(payload.slice(0, -8)); // ตัด 6304xxxx ท้ายออกก่อนถอด

check('รูปแบบ payload', root['00'], '01');
check('ระบุยอด → ใช้ครั้งเดียว (12)', root['01'], '12');
check('สกุลเงินบาท', root['53'], '764');
check('ยอดเงิน 2 ตำแหน่ง', root['54'], '100.00');
check('รหัสประเทศ', root['58'], 'TH');

const merchant = decodeTlv(root['29']);
check('AID พร้อมเพย์', merchant['00'], 'A000000677010111');
check('เบอร์แปลงเป็นสากล 13 หลัก', merchant['01'], '0066899999999');

console.log('\n── CRC ต่อท้าย');
const bodyWithTag = payload.slice(0, -4);
check('4 ตัวท้ายคือ CRC ของทั้งสาย', payload.slice(-4), crc16(bodyWithTag));
check("ปิดท้ายด้วยแท็ก 6304", payload.slice(-8, -4), '6304');

console.log('\n── ไม่ระบุยอด (QR ใช้ซ้ำ)');
const noAmount = decodeTlv(buildPromptPayPayload({ id: '0899999999' }).slice(0, -8));
check('ไม่ระบุยอด → ใช้ซ้ำได้ (11)', noAmount['01'], '11');
check('ไม่มีช่องยอดเงิน', noAmount['54'], undefined);

console.log('\n── ยอดที่มีเศษสตางค์');
const withSatang = decodeTlv(buildPromptPayPayload({ id: '0899999999', amount: 230.5 }).slice(0, -8));
check('230.5 → 230.50', withSatang['54'], '230.50');

console.log('\n── เลขไม่ถูกต้องต้องโยน error');
let threw = false;
try { buildPromptPayPayload({ id: '123', amount: 10 }); } catch { threw = true; }
check('เลขสั้นเกินไป', threw, true);

console.log(`\n${failed === 0 ? 'ผ่านทั้งหมด' : `ไม่ผ่าน ${failed} ข้อ`}`);
process.exit(failed > 0 ? 1 : 0);
