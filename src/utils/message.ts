import type { OrderItem, BankInfo } from '../types';

// Calculate item total after discount and free qty
export const calculateItemTotal = (item: OrderItem): number => {
  const paidQty = Math.max(0, item.quantity - (item.freeQty || 0));
  const subtotal = item.price * paidQty;
  const discount = item.discount || 0;
  return Math.max(0, subtotal - discount);
};

// Get gender label
export const getGenderLabel = (gender: 'male' | 'female' | 'mixed'): string => {
  switch (gender) {
    case 'male': return '♂️ ตัวผู้';
    case 'female': return '♀️ ตัวเมีย';
    default: return '';
  }
};

// ── ข้อความออเดอร์แบบเดียวใช้ทั้งแอป ──
// รวมมาจากเดิมที่หน้า Home เขียนเอง + generateOrderMessage/generateLineMessage
// ที่ทำงานซ้ำซ้อนและเพี้ยนกัน (เลขบัญชีหาย, ยอดไม่หักส่วนลดท้ายบิล)
export interface OrderMessageOptions {
  items: OrderItem[];
  totalFish: number;          // จำนวนปลาทั้งหมด (นับตัวจริง) — ผู้เรียกส่งมา
  shippingFee: number;        // ค่าจัดส่งที่คิดกับลูกค้า
  billDiscount?: number;      // ส่วนลดท้ายบิล
  bankInfo?: BankInfo | null; // ข้อมูลบัญชี (ถ้าไม่มีจะขึ้น "ไม่ระบุ")
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  note?: string;
  shortClosing?: boolean;     // true = ลูกค้ามีข้อมูลอยู่แล้ว ไม่ต้องขอชื่อ/ที่อยู่ซ้ำ
}

export const buildOrderMessage = (opts: OrderMessageOptions): string => {
  const {
    items, totalFish, shippingFee, billDiscount = 0, bankInfo,
    customerName, customerPhone, customerAddress, note, shortClosing,
  } = opts;

  if (items.length === 0) return '';

  const fishPaidTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const grandTotal = Math.max(0, fishPaidTotal - billDiscount + shippingFee);

  let text = `🐠 รายการสั่งซื้อปลาหางนกยูง\n`;

  // ข้อมูลลูกค้า (ถ้ามี)
  if (customerName) {
    text += `👤 ลูกค้า: ${customerName}`;
    if (customerPhone) text += ` (${customerPhone})`;
    text += `\n`;
    if (customerAddress) text += `📍 ที่อยู่: ${customerAddress}\n`;
    text += `----------------------------\n`;
  }

  // รายการ (ปลา + อาหาร) — อาหารแสดงเป็น "ชิ้น" ไม่มีเพศ
  items.forEach((item, index) => {
    const isFood = item.kind === 'food';
    const typeLabel = isFood ? 'ชิ้น' : (item.type === 'piece' ? 'ตัว' : item.type === 'pair' ? 'คู่' : 'set');
    const genderLabel = isFood ? '🍤' : (item.gender === 'male' ? '♂️' : item.gender === 'female' ? '♀️' : '⚥');
    const itemTotal = calculateItemTotal(item);
    const paidQty = item.quantity - (item.freeQty || 0);

    if (item.freeQty && item.freeQty >= item.quantity) {
      text += `${index + 1}. 🎁 ${item.breedName} ${genderLabel}: ${item.quantity} ${typeLabel} = แถมฟรีทั้งหมด\n`;
    } else if (item.freeQty && item.freeQty > 0) {
      text += `${index + 1}. ${item.breedName} ${genderLabel}: ${item.quantity} ${typeLabel} (ซื้อ ${paidQty} + แถม ${item.freeQty}) = ${itemTotal.toLocaleString()}.-\n`;
    } else {
      text += `${index + 1}. ${item.breedName} ${genderLabel}: ${item.quantity} ${typeLabel} = ${itemTotal.toLocaleString()}.-\n`;
    }
  });

  // สรุปยอด
  text += `----------------------------\n`;
  text += `📊 จำนวนปลาทั้งหมด: ${totalFish} ตัว\n`;
  text += `💰 ค่าปลา: ${fishPaidTotal.toLocaleString()} บาท\n`;
  if (billDiscount > 0) {
    text += `🎁 ส่วนลดท้ายบิล: -${billDiscount.toLocaleString()} บาท\n`;
  }
  text += `🚚 ค่าจัดส่ง: ${shippingFee.toLocaleString()} บาท\n`;
  text += `🔥 ยอดรวมทั้งสิ้น: ${grandTotal.toLocaleString()} บาท\n`;
  if (note) {
    text += `💬 หมายเหตุ: ${note}\n`;
  }

  // ช่องทางชำระเงิน
  text += `----------------------------\n`;
  text += `🏦 ช่องทางชำระเงิน\n`;
  text += `${bankInfo?.bank_name || 'ไม่ระบุธนาคาร'}\n`;
  text += `เลขบัญชี: ${bankInfo?.account_number || 'ไม่ระบุเลขบัญชี'}\n`;
  text += `ชื่อบัญชี: ${bankInfo?.account_name || 'ไม่ระบุชื่อ'}\n`;
  text += `----------------------------\n`;
  text += shortClosing
    ? `ชำระแล้วส่งสลิปได้เลยครับ 🙏✨`
    : `ชำระแล้วรบกวนส่งสลิปแจ้งชื่อที่อยู่ได้เลยครับ 🙏✨`;

  return text;
};

// ข้อความที่แนบไปกับลิงก์ใบสรุปในไลน์
// ให้ลูกค้าเห็นรายการปลาและที่มาของยอดในแชทเลย ไม่ต้องเปิดลิงก์ก็รู้ว่าสั่งอะไร ยอดมาจากไหน
export interface OrderLinkMessageOptions {
  orderNumber: string;
  items: OrderItem[];
  /** จำนวนปลาที่นับตัวจริง (อาหารไม่นับ) — ผู้เรียกส่งมา */
  totalFish: number;
  /** ค่าจัดส่งที่คิดกับบิลนี้ — 0 คือร้านยกให้ จะขึ้นว่า "ฟรี" */
  shippingFee: number;
  billDiscount?: number;
  /** ยอดรวมทั้งสิ้นของบิล — ใช้ค่าที่บันทึกไว้ตรง ๆ จะได้ตรงกับหน้าใบสรุปเสมอ */
  total: number;
  url: string;
}

export const buildOrderLinkMessage = ({
  orderNumber,
  items,
  totalFish,
  shippingFee,
  billDiscount = 0,
  total,
  url,
}: OrderLinkMessageOptions): string => {
  const lines = [`🐠 ใบสรุปออเดอร์ ${orderNumber}`, ''];

  items.forEach((item) => {
    const isFood = item.kind === 'food';
    const typeLabel = isFood ? 'ชิ้น' : (item.type === 'piece' ? 'ตัว' : item.type === 'pair' ? 'คู่' : 'ชุด');
    const genderLabel = isFood ? '' : (item.gender === 'male' ? '♂' : item.gender === 'female' ? '♀' : '');
    const free = item.freeQty ? ` (แถม ${item.freeQty})` : '';
    lines.push(`• ${isFood ? '🍤 ' : ''}${item.breedName}${genderLabel ? ' ' + genderLabel : ''} ${item.quantity} ${typeLabel}${free}`);
  });

  // สรุปยอดชุดเดียวกับข้อความเต็ม (buildOrderMessage) — คำและอิโมจิต้องตรงกัน
  // ลูกค้าที่เคยได้ข้อความแบบเก่าจะได้อ่านเจอที่เดิม
  const itemsTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

  lines.push('');
  lines.push(`📊 จำนวนปลาทั้งหมด: ${totalFish} ตัว`);
  lines.push(`💰 ค่าปลา: ${itemsTotal.toLocaleString()} บาท`);
  if (billDiscount > 0) {
    lines.push(`🎁 ส่วนลดท้ายบิล: -${billDiscount.toLocaleString()} บาท`);
  }
  lines.push(`🚚 ค่าจัดส่ง: ${shippingFee > 0 ? `${shippingFee.toLocaleString()} บาท` : 'ฟรี'}`);
  lines.push(`🔥 ยอดรวมทั้งสิ้น: ${total.toLocaleString()} บาท`);

  lines.push('');
  lines.push('ดูรายการ ชำระเงิน และแจ้งที่อยู่ได้ที่ลิงก์นี้ครับ 👇');
  lines.push(url);

  return lines.join('\n');
};

// ── ข้อความ "จัดส่งแล้ว" ตอนกรอกเลขพัสดุ ──
// ประกอบที่เดียว เพราะมีสองทางที่ต้องได้หน้าตาเดียวกัน: หน้าบิลหยอดคิวให้บอท push
// กับกล่อง "ไม่ได้รับข้อความแจ้งเตือน" ที่ร้านคัดลอกไปส่งเองในแชทตอน push ไม่ออก
// ซึ่งต้องอ่านเลขบิล/เลขพัสดุกลับจากข้อความที่ค้างอยู่ — หัวข้อความสองที่เพี้ยนกันเมื่อไหร่ อ่านไม่ออกทันที
const SHIPPING_TITLE = '🚚 จัดส่งแล้วครับ';
const SHIPPING_BILL = 'บิล ';
const SHIPPING_TRACKING = 'เลขพัสดุ ';

export interface ShippingNoticeOptions {
  orderNumber: string;
  tracking: string;
  /**
   * บอกลูกค้าว่าจะเด้งแจ้งเตือนอัตโนมัติ
   *
   * ใส่เฉพาะตอนบอทเป็นคนส่งและสมัครติดตามผ่าน — ข้อความที่ร้านต้องส่งเองแปลว่า push
   * ไม่ออกอยู่แล้ว (โควต้าหมด / ลูกค้าไม่ได้แอดร้าน) แจ้งเตือนต่อจากนี้ก็ไม่ถึงเหมือนกัน
   */
  promiseAlerts: boolean;
  /** ข้อความที่ร้านตั้งไว้ในหน้าตั้งค่า ต่อท้าย */
  extra?: string | null;
}

export const buildShippingNotice = ({
  orderNumber,
  tracking,
  promiseAlerts,
  extra,
}: ShippingNoticeOptions): string => {
  const blocks = [`${SHIPPING_TITLE}\n${SHIPPING_BILL}${orderNumber}\n${SHIPPING_TRACKING}${tracking}`];

  // บอกไปเลยว่าจะแจ้งกี่ครั้งและตอนไหน ที่เดียวจบ — ข้อความนี้ลูกค้าได้
  // ใบละครั้งตอนเริ่มรอของพอดี ซึ่งเป็นจังหวะที่สงสัยเรื่องนี้อยู่แล้ว
  // ของเดิมบอกแค่ "จะแจ้งความคืบหน้า" ซึ่งอ่านได้ว่าจะแจ้งทุกครั้งที่ขยับ
  // แล้วลูกค้าจะรอข้อความตอนของเข้าศูนย์คัดแยกที่ไม่มีวันมา
  if (promiseAlerts) {
    blocks.push(
      '🔔 จะแจ้งให้ตอนไปรษณีย์รับเข้าระบบ ตอนออกไปนำจ่าย และตอนส่งถึง\n' +
        'ถ้านำจ่ายไม่สำเร็จหรือตีกลับ จะแจ้งทันทีเหมือนกันครับ'
    );
  }

  const tail = (extra || '').trim();
  if (tail) blocks.push(tail);

  return blocks.join('\n\n');
};

// อ่านเลขบิลกับเลขพัสดุกลับจากข้อความจัดส่งที่ประกอบไว้แล้ว
// ข้อความแบบอื่น (ยืนยันชำระเงิน, การ์ดพัสดุจากปุ่มส่งซ้ำ ฯลฯ) คืน null
export const parseShippingNotice = (message: string): { orderNumber: string; tracking: string } | null => {
  const [title, bill, parcel] = message.split('\n');
  if (title !== SHIPPING_TITLE || !bill?.startsWith(SHIPPING_BILL) || !parcel?.startsWith(SHIPPING_TRACKING)) {
    return null;
  }
  return {
    orderNumber: bill.slice(SHIPPING_BILL.length),
    tracking: parcel.slice(SHIPPING_TRACKING.length),
  };
};
