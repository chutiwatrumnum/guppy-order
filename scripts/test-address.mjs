// เทสตัวแยกที่อยู่ ด้วยข้อความจริงที่ลูกค้าส่งมาในไลน์
//
//   node scripts/test-address.mjs
//
// ทุกเคสในนี้มาจากแชทจริง (ปิดบังบางส่วนแล้ว) ไม่ใช่ตัวอย่างที่แต่งขึ้น
// เจอรูปแบบใหม่ที่แยกไม่ออก ให้เพิ่มเคสที่นี่ก่อนแก้ address.ts
// จะได้รู้ว่าแก้แล้วของเดิมยังผ่านอยู่ไหม

import { build } from 'esbuild';
import { readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';

const out = join(tmpdir(), `address-${Date.now()}.mjs`);
await build({
  entryPoints: ['src/utils/address.ts'],
  outfile: out,
  format: 'esm',
  logLevel: 'error',
});
const { parseThaiAddress } = await import(pathToFileURL(out).href);
unlinkSync(out);

const cases = [
  {
    label: 'มีหัวข้อกำกับครบ',
    input: [
      'ที่อยู่จัดส่ง',
      'ชื่อ คุณเบียร์',
      'โทร 081-652-1212',
      'ที่อยู่ มบ.พฤกษาเทพารักษ์-เมืองใหม่ 300/136 ซอย 10 ตำบลบางเพรียง อำเภอบางบ่อ จังหวัดสมุทรปราการ 10560',
    ].join('\n'),
    expect: {
      name: 'คุณเบียร์',
      phone: '0816521212',
      address: 'มบ.พฤกษาเทพารักษ์-เมืองใหม่ 300/136 ซอย 10 ตำบลบางเพรียง อำเภอบางบ่อ จังหวัดสมุทรปราการ 10560',
    },
  },
  {
    label: 'ไม่มีหัวข้อเลย',
    input: ['สมชาย ใจดี', '089-123-4567', '123/45 ม.5 ต.บางแก้ว อ.บางพลี จ.สมุทรปราการ 10540'].join('\n'),
    expect: { name: 'สมชาย ใจดี', phone: '0891234567', address: '123/45 ม.5 ต.บางแก้ว อ.บางพลี จ.สมุทรปราการ 10540' },
  },
  {
    label: 'รหัสไปรษณีย์ติดเบอร์ในบรรทัดเดียว',
    input: ['ชื่อ น.ส.มาลี', '99/1 ซอยลาดพร้าว 15 แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900 0812345678'].join('\n'),
    expect: { name: 'น.ส.มาลี', phone: '0812345678', address: '99/1 ซอยลาดพร้าว 15 แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900' },
  },
  {
    label: 'ป้ายกำกับแบบอื่น (ผู้รับ/เบอร์)',
    input: ['ผู้รับ: บอย', 'เบอร์: 0899998888', 'ที่อยู่: 5 หมู่ 3 ต.ท่าศาลา อ.เมือง จ.ลพบุรี 15000'].join('\n'),
    expect: { name: 'บอย', phone: '0899998888', address: '5 หมู่ 3 ต.ท่าศาลา อ.เมือง จ.ลพบุรี 15000' },
  },
  {
    label: 'ที่อยู่หลายบรรทัด',
    input: ['ชื่อ คุณเอ', 'โทร 0812223333', 'ที่อยู่ 88/9 ซอย 5', 'ต.บางรัก อ.เมือง', 'จ.ชลบุรี 20000'].join('\n'),
    expect: { name: 'คุณเอ', phone: '0812223333', address: '88/9 ซอย 5 ต.บางรัก อ.เมือง จ.ชลบุรี 20000' },
  },
  {
    label: 'ป้าย "โทร" อยู่กลางบรรทัด',
    input: ['นาย อภิรักษ์ ดวงแก้ว', '95/2 เทศบาล9 ต.สะเตง อ.เมือง', 'จ.ยะลา 95000 โทร 0824364256'].join('\n'),
    expect: { name: 'นาย อภิรักษ์ ดวงแก้ว', phone: '0824364256', address: '95/2 เทศบาล9 ต.สะเตง อ.เมือง จ.ยะลา 95000' },
  },
  {
    label: 'เบอร์บรรทัดแยก + ตัวเลขปนในชื่อถนน',
    input: ['สุทธิ กิตติวศิน', '57 ถ.22กรกฎาคม4', 'ป้อมปราบศัตรูพ่าย ป้อมปราบศัตรูพ่าย.', 'กทม. 10100', '0847047777'].join('\n'),
    expect: {
      name: 'สุทธิ กิตติวศิน',
      phone: '0847047777',
      address: '57 ถ.22กรกฎาคม4 ป้อมปราบศัตรูพ่าย ป้อมปราบศัตรูพ่าย. กทม. 10100',
    },
  },
];

let failed = 0;

for (const { label, input, expect } of cases) {
  const got = parseThaiAddress(input);
  const wrong = ['name', 'phone', 'address'].filter(k => (got[k] ?? '') !== (expect[k] ?? ''));

  if (wrong.length === 0) {
    console.log(`✅ ${label}`);
  } else {
    failed++;
    console.log(`❌ ${label}`);
    for (const k of wrong) {
      console.log(`     ${k}: ได้ ${JSON.stringify(got[k] ?? null)}`);
      console.log(`     ${' '.repeat(k.length)}  ควรเป็น ${JSON.stringify(expect[k] ?? null)}`);
    }
  }
}

console.log(`\n${cases.length - failed}/${cases.length} ผ่าน`);
process.exit(failed > 0 ? 1 : 0);
