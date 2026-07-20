// แยกข้อความที่อยู่ที่ลูกค้าพิมพ์มาในไลน์ ออกเป็น ชื่อ / เบอร์ / ที่อยู่
//
// ลูกค้าพิมพ์มาหลายแบบมาก บางคนใส่หัวข้อกำกับ บางคนพิมพ์รวดเดียว
// ตัวแยกนี้เดาให้ดีที่สุดแล้วให้คนตรวจอีกที ไม่ได้ตั้งใจให้ถูก 100% โดยไม่ต้องดู

export interface ParsedAddress {
  name?: string;
  phone?: string;
  address?: string;
}

// บรรทัดหัวข้อล้วน ๆ ที่ไม่มีข้อมูลจริง
const HEADER_RE =
  /^(ที่อยู่จัดส่ง|ที่อยู่ในการจัดส่ง|ที่อยู่ผู้รับ|ข้อมูลจัดส่ง|ข้อมูลผู้รับ|รายละเอียดการจัดส่ง|จัดส่ง)\s*[:：]?\s*$/i;

const NAME_RE  = /^(ชื่อผู้รับ|ชื่อ-สกุล|ชื่อ|ผู้รับ|name)\s*[:：]?\s*/i;
const PHONE_RE = /^(เบอร์โทรศัพท์|เบอร์โทร|เบอร์|โทรศัพท์|โทร|tel|phone)\s*\.?\s*[:：]?\s*/i;
const ADDR_RE  = /^(ที่อยู่|address|addr)\s*[:：]?\s*/i;

// เบอร์ไทย: ขึ้นต้น 0 ตามด้วยอีก 8-9 หลัก อนุญาตให้มีเว้นวรรค/ขีดคั่น
//
// ต้องไม่เริ่มกลางกลุ่มตัวเลข ไม่งั้น "10900 0812345678" (รหัสไปรษณีย์ติดเบอร์)
// จะถูกจับเป็น "0900 08123" กลายเป็นเบอร์ที่ไม่มีอยู่จริง
// ใช้ capture group แทน lookbehind เพราะ Safari เก่ายังไม่รองรับ lookbehind
// ถ้าใช้ lookbehind แล้วเปิดบน iOS รุ่นเก่า จะพังทั้งบันเดิลตั้งแต่โหลด
const PHONE_ANYWHERE = /(^|[^\d])(0\d(?:[\s-]?\d){7,8})(?!\d)/;

const cleanPhone = (raw: string) => raw.replace(/[^\d]/g, '');

// คืนเบอร์ที่เจอ (ยังไม่ล้างรูปแบบ) เพื่อเอาไปตัดออกจากข้อความต้นทางได้ตรง ๆ
const findPhone = (text: string): string | undefined => {
  const m = text.match(PHONE_ANYWHERE);
  return m ? m[2] : undefined;
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
      if (found) phone = cleanPhone(found);
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
      phone = cleanPhone(found);
      address = address.replace(found, '').trim();
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
