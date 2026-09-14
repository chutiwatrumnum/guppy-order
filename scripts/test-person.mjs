// เทสการจับคู่ "ลูกค้าคนเดียวกัน" ข้ามบิล
//
//   node scripts/test-person.mjs
//
// แถบ "ลูกค้าคนนี้มีอีก N บิลที่ยังไม่ถึงมือ" บนหน้าบิลพึ่งตัวนี้ตัวเดียว
// จับคู่หลุด = แพ็คแยกกล่องทั้งที่ควรรวม · จับคู่เกิน = เอาของคนแปลกหน้ามาปนกล่อง

import { build } from 'esbuild';
import { unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

// bundle เพราะ person.ts ดึงตัวจัดรูปเบอร์มาจาก address.ts
const out = join(tmpdir(), `person-${Date.now()}.mjs`);
await build({ entryPoints: ['src/utils/person.ts'], bundle: true, outfile: out, format: 'esm', logLevel: 'error' });
const { groupByPerson } = await import(pathToFileURL(out).href);
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

const samePerson = (bills, a, b) => {
  const group = groupByPerson(bills);
  return group.get(a) === group.get(b);
};

const LINE_A = 'U' + 'a'.repeat(32);
const LINE_B = 'U' + 'b'.repeat(32);

console.log('── คนเดียวกัน');
check(
  'customer_id เดียวกัน',
  samePerson([{ id: '1', customerId: 'c1' }, { id: '2', customerId: 'c1' }], '1', '2'),
  true
);
check(
  'ร้านพิมพ์เบอร์เองโดยไม่เลือกลูกค้า กับใบที่ลูกค้ากรอกเองจนมี customer_id',
  samePerson(
    [
      { id: '1', customerPhone: '082-323-3256' },
      { id: '2', customerId: 'c1', customerPhone: '0823233256' },
    ],
    '1',
    '2'
  ),
  true
);
check(
  'เบอร์ตก 0 กับเบอร์ +66 คือเบอร์เดียวกัน',
  samePerson([{ id: '1', customerPhone: '823233256' }, { id: '2', customerPhone: '+66 82 323 3256' }], '1', '2'),
  true
);
check(
  'LINE เดียวกัน แม้ใบแรกยังไม่มีเบอร์หรือ customer_id',
  samePerson([{ id: '1', lineUserId: LINE_A }, { id: '2', lineUserId: LINE_A, customerId: 'c9' }], '1', '2'),
  true
);
check(
  'ต่อกันเป็นทอด — ใบที่มีแต่เบอร์ กับใบที่มีแต่ LINE เชื่อมกันผ่านใบที่มีทั้งคู่',
  samePerson(
    [
      { id: '1', customerPhone: '0823233256' },
      { id: '2', lineUserId: LINE_A },
      { id: '3', customerPhone: '0823233256', lineUserId: LINE_A },
    ],
    '1',
    '2'
  ),
  true
);
check(
  'ลำดับบิลไม่มีผล — ใบที่มาเชื่อมอยู่ก่อนก็ได้ผลเดียวกัน',
  samePerson(
    [
      { id: '3', customerPhone: '0823233256', lineUserId: LINE_A },
      { id: '1', customerPhone: '0823233256' },
      { id: '2', lineUserId: LINE_A },
    ],
    '1',
    '2'
  ),
  true
);
check(
  'สองกลุ่มที่แยกกันอยู่ ถูกรวมทีหลังด้วยใบที่มาเชื่อม',
  samePerson(
    [
      { id: '1', customerPhone: '0823233256' },
      { id: '2', lineUserId: LINE_A },
      { id: '3', customerId: 'c1', lineUserId: LINE_A },
      { id: '4', customerId: 'c1', customerPhone: '0823233256' },
    ],
    '1',
    '2'
  ),
  true
);

console.log('\n── คนละคน');
check(
  'บิลที่ไม่มีกุญแจเลย ไม่ถูกรวมกับใคร',
  samePerson(
    [
      { id: '1', customerId: null, customerPhone: null, lineUserId: null },
      { id: '2' },
    ],
    '1',
    '2'
  ),
  false
);
check(
  'ช่องเบอร์ที่พิมพ์ "-" ไว้ ไม่ทำให้บิลรวมกัน',
  samePerson([{ id: '1', customerPhone: '-' }, { id: '2', customerPhone: '-' }], '1', '2'),
  false
);
check(
  'ค่าในช่อง LINE ที่ไม่ใช่ไอดีจริง ไม่ใช้จับคู่',
  samePerson([{ id: '1', lineUserId: 'guest' }, { id: '2', lineUserId: 'guest' }], '1', '2'),
  false
);
check(
  'คนละเบอร์ คนละ LINE',
  samePerson(
    [
      { id: '1', customerPhone: '0823233256', lineUserId: LINE_A },
      { id: '2', customerPhone: '0899999999', lineUserId: LINE_B },
    ],
    '1',
    '2'
  ),
  false
);

console.log('\n── ทุกบิลต้องได้กลุ่ม (หน้าบิลนับจำนวนลูกค้าจากตรงนี้)');
const groups = groupByPerson([{ id: '1' }, { id: '2', customerId: 'c1' }, { id: '3', customerId: 'c1' }]);
check('ได้ครบทุกใบ', groups.size, 3);
check('นับได้ 2 คน — ใบไม่มีกุญแจเป็นหนึ่งคน อีกสองใบคนเดียวกัน', new Set(groups.values()).size, 2);

console.log(failed === 0 ? '\nผ่านทั้งหมด' : `\nไม่ผ่าน ${failed} ข้อ`);
process.exit(failed === 0 ? 0 : 1);
