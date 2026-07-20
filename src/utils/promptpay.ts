// สร้าง payload ของ QR พร้อมเพย์ตามมาตรฐาน EMVCo
//
// เป็นมาตรฐานเปิด สร้างในเครื่องได้เลย ไม่ต้องต่อ API ธนาคาร ไม่มีค่าใช้จ่าย
// ข้อความที่ได้เอาไป render เป็น QR แล้วลูกค้าสแกนจ่ายได้ทันที พร้อมยอดเงินที่ฝังไว้
//
// โครงสร้างเป็น TLV ซ้อนกัน: ID 2 หลัก + ความยาว 2 หลัก + ค่า

/** ต่อ TLV หนึ่งช่อง ความยาวต้องเป็นเลข 2 หลักเสมอ */
const tlv = (id: string, value: string) =>
  `${id}${String(value.length).padStart(2, '0')}${value}`;

/**
 * CRC-16/CCITT-FALSE — poly 0x1021, init 0xFFFF, ไม่กลับบิต
 * ค่าตรวจสอบมาตรฐาน: crc16('123456789') === '29B1'
 */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export type PromptPayTarget =
  | { kind: 'mobile'; value: string }
  | { kind: 'nationalId'; value: string }
  | { kind: 'ewallet'; value: string };

/**
 * เดาว่าเลขที่กรอกมาเป็นแบบไหน จากจำนวนหลักหลังตัดอักขระอื่นออก
 *   9-10 หลัก  → เบอร์มือถือ
 *   13 หลัก    → เลขบัตรประชาชน / นิติบุคคล
 *   15 หลัก    → e-Wallet
 */
export function detectTarget(raw: string): PromptPayTarget | undefined {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9 || digits.length === 10) return { kind: 'mobile', value: digits };
  if (digits.length === 13) return { kind: 'nationalId', value: digits };
  if (digits.length === 15) return { kind: 'ewallet', value: digits };
  return undefined;
}

/** เบอร์ไทยต้องแปลงเป็นรูปแบบสากล 13 หลัก: 0812345678 → 0066812345678 */
const formatMobile = (digits: string) => {
  const national = digits.replace(/^0/, '');
  return `00${`66${national}`.padStart(11, '0')}`;
};

export interface PromptPayOptions {
  /** เบอร์พร้อมเพย์ / เลขบัตรประชาชน / e-Wallet ของร้าน */
  id: string;
  /** ยอดเงิน ถ้าไม่ใส่จะได้ QR แบบให้ลูกค้ากรอกยอดเอง */
  amount?: number;
}

/**
 * คืนข้อความสำหรับเข้ารหัสเป็น QR
 * โยน error ถ้าเลขพร้อมเพย์ไม่เข้ารูปแบบใดเลย — ปล่อยผ่านแล้วลูกค้าจะสแกนไม่ได้
 */
export function buildPromptPayPayload({ id, amount }: PromptPayOptions): string {
  const target = detectTarget(id);
  if (!target) {
    throw new Error('เลขพร้อมเพย์ไม่ถูกต้อง (ต้องเป็นเบอร์มือถือ 10 หลัก, บัตรประชาชน 13 หลัก หรือ e-Wallet 15 หลัก)');
  }

  const accountValue =
    target.kind === 'mobile' ? tlv('01', formatMobile(target.value))
    : target.kind === 'nationalId' ? tlv('02', target.value)
    : tlv('03', target.value);

  const merchantAccount = tlv('29', `${tlv('00', 'A000000677010111')}${accountValue}`);

  const hasAmount = typeof amount === 'number' && amount > 0;

  const body =
    tlv('00', '01') +
    // 11 = QR ใช้ซ้ำได้ (ไม่ระบุยอด), 12 = ใช้ครั้งเดียว (ระบุยอด)
    tlv('01', hasAmount ? '12' : '11') +
    merchantAccount +
    tlv('53', '764') +      // สกุลเงินบาท
    (hasAmount ? tlv('54', amount.toFixed(2)) : '') +
    tlv('58', 'TH');

  // CRC คำนวณครอบ '6304' ที่ต่อท้ายไว้ด้วย
  const withCrcTag = `${body}6304`;
  return `${withCrcTag}${crc16(withCrcTag)}`;
}
