// แยกข้อความที่อยู่ที่ลูกค้าพิมพ์มาในไลน์ ออกเป็น ชื่อ / เบอร์ / ที่อยู่
//
// ลูกค้าพิมพ์มาหลายแบบมาก บางคนใส่หัวข้อกำกับ บางคนพิมพ์รวดเดียว
// ตัวแยกนี้เดาให้ดีที่สุดแล้วให้คนตรวจอีกที ไม่ได้ตั้งใจให้ถูก 100% โดยไม่ต้องดู

export interface ParsedAddress {
  name?: string;
  phone?: string;
  address?: string;
}

// ── ตรวจที่อยู่ที่ลูกค้ากรอกเองในหน้าใบสรุป ─────────────────────────
//
// เดิมกรอกอะไรก็ผ่าน "นครปฐม" หรือ "James" ก็บันทึกได้
// ที่อยู่แบบนั้นส่งไปรษณีย์ไม่ได้ และกว่าจะรู้ก็ตอนจะแพ็คของแล้ว
// ต้องไล่ทักถามใหม่ทีละคน
//
// ตั้งใจให้หลวมไว้ก่อน — กันของที่ใช้ไม่ได้แน่ ๆ ไม่ใช่บังคับรูปแบบ
// ที่อยู่ไทยเขียนได้ร้อยแบบ ถ้าเข้มเกินจะไปบล็อกที่อยู่จริงของลูกค้า

/** ยาวขั้นต่ำที่พอจะเป็นที่อยู่จริงได้ — "9/9 ต.ก อ.ข ค 10000" ก็ 20 แล้ว */
const MIN_ADDRESS_LENGTH = 15;

/** รหัสไปรษณีย์ไทย 5 หลัก ขึ้นต้น 1-9 (ไม่มีจังหวัดไหนขึ้นต้นด้วย 0) */
const POSTCODE_RE = /(^|\D)[1-9]\d{4}(\D|$)/;

/**
 * เบอร์ไทยให้เหลือเลขล้วนขึ้นต้น 0 — คืน null ถ้าไม่เข้ารูปแบบ
 *
 * LINE ส่งเบอร์มาแบบ +66 บ่อย และลูกค้าก็พิมพ์ตกเลข 0 หน้าเป็นประจำ
 * (เคยเห็น "823233256" บันทึกลงไปแล้ว ซึ่งเอาไปกรอกฟอร์มส่งพัสดุไม่ได้)
 * รับทั้งมือถือ 10 หลักและเบอร์บ้าน 9 หลัก
 */
export function normalizeThaiPhone(raw: string): string | null {
  let d = (raw || '').replace(/[^\d]/g, '');
  if (!d) return null;

  // +66818… / 66818… → 0818…
  if (d.startsWith('66') && d.length >= 11) d = '0' + d.slice(2);
  // 818… (ตก 0 หน้า) → 0818…
  else if (d.length === 9 && d[0] !== '0') d = '0' + d;

  if (!/^0\d{8,9}$/.test(d)) return null;
  return d;
}

export interface ContactInput {
  name: string;
  phone: string;
  address: string;
}

/** คืนข้อความบอกสิ่งที่ต้องแก้ หรือ null ถ้าผ่าน */
export function validateShippingContact({ name, phone, address }: ContactInput): string | null {
  if (!name?.trim()) return 'กรุณากรอกชื่อผู้รับ';

  if (!phone?.trim()) return 'กรุณากรอกเบอร์โทรศัพท์';
  if (!normalizeThaiPhone(phone)) {
    return 'เบอร์โทรไม่ถูกต้อง กรอกเป็นเลข 10 หลัก เช่น 0812345678';
  }

  const addr = (address || '').trim();
  if (!addr) return 'กรุณากรอกที่อยู่';
  if (!POSTCODE_RE.test(addr)) {
    return 'ที่อยู่ยังไม่มีรหัสไปรษณีย์ รบกวนใส่เลข 5 หลักท้ายที่อยู่ด้วยครับ';
  }
  if (addr.length < MIN_ADDRESS_LENGTH) {
    return 'ที่อยู่สั้นเกินไป รบกวนใส่บ้านเลขที่ ตำบล อำเภอ จังหวัด ให้ครบครับ';
  }

  return null;
}

// บรรทัดหัวข้อล้วน ๆ ที่ไม่มีข้อมูลจริง
const HEADER_RE =
  /^(ที่อยู่จัดส่ง|ที่อยู่ในการจัดส่ง|ที่อยู่ผู้รับ|ข้อมูลจัดส่ง|ข้อมูลผู้รับ|รายละเอียดการจัดส่ง|จัดส่ง)\s*[:：]?\s*$/i;

const NAME_RE  = /^(ชื่อผู้รับ|ชื่อ-สกุล|ชื่อ|ผู้รับ|name)\s*[:：]?\s*/i;
const PHONE_RE = /^(เบอร์โทรศัพท์|เบอร์โทร|เบอร์|โทรศัพท์|โทร|tel|phone)\s*\.?\s*[:：]?\s*/i;
const ADDR_RE  = /^(ที่อยู่|address|addr)\s*[:：]?\s*/i;

// ป้ายกำกับเบอร์ที่โผล่กลางบรรทัดได้ เช่น "จ.ยะลา 95000 โทร 0824364256"
// ต้องจับมาด้วยเพื่อตัดทิ้งพร้อมตัวเลข ไม่งั้นคำว่า "โทร" จะค้างท้ายที่อยู่
const PHONE_LABEL_INLINE = '(?:เบอร์โทรศัพท์|เบอร์โทร|เบอร์|โทรศัพท์|โทร|tel|phone)\\s*\\.?\\s*[:：]?\\s*';

// เบอร์ไทย: ขึ้นต้น 0 ตามด้วยอีก 8-9 หลัก อนุญาตให้มีเว้นวรรค/ขีดคั่น
//
// (^|[^\d]) กันไม่ให้เริ่มกลางกลุ่มตัวเลข — "10900 0812345678" (รหัสไปรษณีย์ติดเบอร์)
// เคยถูกจับเป็น "0900 08123" ได้เบอร์ที่ไม่มีจริงและรหัสไปรษณีย์เพี้ยนไปด้วย
//
// ใช้ capture group แทน lookbehind เพราะ Safari เก่าไม่รองรับ lookbehind
// และจะ throw ตั้งแต่ตอน parse ทำให้ทั้งบันเดิลพังบน iOS รุ่นเก่า
const PHONE_ANYWHERE = new RegExp(
  `(^|[^\\d])(${PHONE_LABEL_INLINE})?(0\\d(?:[\\s-]?\\d){7,8})(?!\\d)`,
  'i'
);

const cleanPhone = (raw: string) => raw.replace(/[^\d]/g, '');

interface PhoneMatch {
  /** เลขล้วน ไว้เก็บลงฐานข้อมูล */
  digits: string;
  /** ข้อความที่ต้องตัดออกจากต้นทาง รวมป้ายกำกับถ้ามี */
  matched: string;
}

const findPhone = (text: string): PhoneMatch | undefined => {
  const m = text.match(PHONE_ANYWHERE);
  if (!m) return undefined;
  const [, , label = '', number] = m;
  return { digits: cleanPhone(number), matched: `${label}${number}` };
};

export function parseThaiAddress(raw: string): ParsedAddress {
  if (!raw?.trim()) return {};

  const lines = raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !HEADER_RE.test(l));

  let name: string | undefined;
  let phone: string | undefined;
  const addressParts: string[] = [];
  let seenAddressLabel = false;

  for (const line of lines) {
    if (NAME_RE.test(line)) {
      const value = line.replace(NAME_RE, '').trim();
      if (value) name = value;
      continue;
    }

    if (PHONE_RE.test(line)) {
      const found = findPhone(line.replace(PHONE_RE, '').trim());
      if (found) phone = found.digits;
      continue;
    }

    if (ADDR_RE.test(line)) {
      const value = line.replace(ADDR_RE, '').trim();
      seenAddressLabel = true;
      if (value) addressParts.push(value);
      continue;
    }

    // บรรทัดที่ไม่มีหัวข้อกำกับ
    // ถ้ายังไม่เจอทั้งชื่อและที่อยู่ ให้ถือว่าบรรทัดแรกคือชื่อ
    if (!name && !seenAddressLabel && addressParts.length === 0) {
      name = line;
    } else {
      addressParts.push(line);
    }
  }

  let address = addressParts.join(' ').trim();

  // เบอร์อาจปนอยู่ในก้อนที่อยู่ ถ้ายังไม่ได้เบอร์ให้ดึงออกมาแล้วตัดทิ้งจากที่อยู่
  if (!phone) {
    const found = findPhone(address) || findPhone(raw);
    if (found) {
      phone = found.digits;
      address = address.replace(found.matched, ' ').trim();
    }
  }

  // เก็บกวาดเครื่องหมายคั่นที่ค้างอยู่หัวท้าย
  address = address.replace(/\s{2,}/g, ' ').replace(/^[,\-–\s]+|[,\-–\s]+$/g, '');

  // ชื่อที่ดันไปคว้าเบอร์มาด้วย
  if (name && phone && cleanPhone(name) === phone) name = undefined;

  return {
    name: name || undefined,
    phone: phone || undefined,
    address: address || undefined,
  };
}
