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

// ข้อความสั้นที่แนบไปกับลิงก์ใบสรุปในไลน์
// ให้ลูกค้าเห็นรายการปลาในแชทเลย ไม่ต้องเปิดลิงก์ก็รู้ว่าสั่งอะไร
export const buildOrderLinkMessage = (
  orderNumber: string,
  items: OrderItem[],
  total: number,
  url: string
): string => {
  const lines = [`🐠 ใบสรุปออเดอร์ ${orderNumber}`, ''];

  items.forEach((item) => {
    const isFood = item.kind === 'food';
    const typeLabel = isFood ? 'ชิ้น' : (item.type === 'piece' ? 'ตัว' : item.type === 'pair' ? 'คู่' : 'ชุด');
    const genderLabel = isFood ? '' : (item.gender === 'male' ? '♂' : item.gender === 'female' ? '♀' : '');
    const free = item.freeQty ? ` (แถม ${item.freeQty})` : '';
    lines.push(`• ${isFood ? '🍤 ' : ''}${item.breedName}${genderLabel ? ' ' + genderLabel : ''} ${item.quantity} ${typeLabel}${free}`);
  });

  lines.push('');
  lines.push(`💰 ยอดรวม ฿${total.toLocaleString()}`);
  lines.push('');
  lines.push('ดูรายการ ชำระเงิน และแจ้งที่อยู่ได้ที่ลิงก์นี้ครับ 👇');
  lines.push(url);

  return lines.join('\n');
};
