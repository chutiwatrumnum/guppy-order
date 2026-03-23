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

// Generate LINE message for current order
export const generateLineMessage = (
  orderItems: OrderItem[],
  totalFishCount: number,
  totalFishPrice: number, // Note: this is the paid amount
  bankInfo: BankInfo,
  grandTotal: number
): string => {
  if (orderItems.length === 0) return '';
  
  let text = `🐠 รายการสั่งซื้อปลาหางนกยูง\n`;
  text += `----------------------------\n`;
  
  let totalFreeValue = 0;
  let rawSubtotal = 0;

  orderItems.forEach((item, index) => {
    const typeLabel = item.type === 'piece' ? 'ตัว' : item.type === 'pair' ? 'คู่' : 'set';
    const genderLabel = item.gender === 'male' ? '♂️' : item.gender === 'female' ? '♀️' : '⚥';
    const gradeLabel = item.grade === 'premium' ? ' 👑[งานคัดเกรด]' : '';
    
    // new logic
    const paidQty = Math.max(0, item.quantity - (item.freeQty || 0));
    const itemSubtotal = item.price * item.quantity; // value of all items
    const freeValue = (item.freeQty || 0) * item.price;
    const itemPaid = (item.price * paidQty) - (item.discount || 0);

    rawSubtotal += itemSubtotal;
    totalFreeValue += freeValue;
    
    if (item.freeQty && item.freeQty >= item.quantity) {
      text += `${index + 1}. 🎁 ${item.breedName}${gradeLabel} ${genderLabel}: ${item.quantity} ${typeLabel} = แถมฟรีทั้งหมด\n`;
    } else if (item.freeQty && item.freeQty > 0) {
      text += `${index + 1}. ${item.breedName}${gradeLabel} ${genderLabel}: ${item.quantity} ${typeLabel} (แถม ${item.freeQty} มูลค่า -${freeValue})`;
      if (item.discount && item.discount > 0) {
        text += ` (ลดเพิ่ม -${item.discount})`;
      }
      text += ` = ${itemPaid.toLocaleString()}.-\n`;
    } else {
      text += `${index + 1}. ${item.breedName}${gradeLabel} ${genderLabel}: ${item.quantity} ${typeLabel}`;
      if (item.discount && item.discount > 0) {
        text += ` (ลด -${item.discount} บาท)`;
      }
      text += ` = ${itemPaid.toLocaleString()}.-\n`;
    }
  });
  
  text += `----------------------------\n`;
  text += `📊 จำนวนปลาทั้งหมด: ${totalFishCount} ตัว\n`;
  text += `💰 มูลค่าปลารวม: ${rawSubtotal.toLocaleString()} บาท\n`;
  if (totalFreeValue > 0) {
    text += `🎁 ส่วนลดของแถม: -${totalFreeValue.toLocaleString()} บาท\n`;
  }
  text += `🚚 ค่าจัดส่ง: ${bankInfo.shipping_fee.toLocaleString()} บาท\n`;
  text += `----------------------------\n`;
  text += `🏦 ช่องทางชำระเงิน\n`;
  text += `${bankInfo.bank_name || 'ไม่ระบุธนาคาร'}\n`;
  text += `เลขบัญชี: ${bankInfo.account_number || 'ไม่ระบุเลขบัญชี'}\n`;
  text += `ชื่อบัญชี: ${bankInfo.account_name || 'ไม่ระบุชื่อ'}\n`;
  text += `----------------------------\n`;
  text += `ชำระแล้วรบกวนส่งสลิปแจ้งชื่อที่อยู่ได้เลยครับ 🙏✨`;
  
  return text;
};

// Generate order message (for saved orders)
export const generateOrderMessage = (
  items: OrderItem[],
  totalFish: number,
  totalAmount: number,
  customer?: string,
  note?: string,
  shippingFee?: number,
  bankInfo?: BankInfo
): string => {
  if (items.length === 0) return '';
  
  let itemsTotalPaid = 0;
  let totalFreeValue = 0;
  let rawSubtotal = 0;

  items.forEach((item) => {
    const paidQty = Math.max(0, item.quantity - (item.freeQty || 0));
    rawSubtotal += item.price * item.quantity;
    totalFreeValue += (item.freeQty || 0) * item.price;
    itemsTotalPaid += (item.price * paidQty) - (item.discount || 0);
  });
  
  const finalShippingFee = shippingFee || bankInfo?.shipping_fee || 60;
  const grandTotal = itemsTotalPaid + finalShippingFee;
  
  let text = `🐠 รายการสั่งซื้อปลาหางนกยูง\n`;
  text += `----------------------------\n`;
  
  items.forEach((item, index) => {
    const typeLabel = item.type === 'piece' ? 'ตัว' : item.type === 'pair' ? 'คู่' : 'set';
    const genderLabel = item.gender === 'male' ? '♂️' : item.gender === 'female' ? '♀️' : '⚥';
    const gradeLabel = item.grade === 'premium' ? ' 👑[งานคัดเกรด]' : '';
    const paidQty = Math.max(0, item.quantity - (item.freeQty || 0));
    const itemPaid = (item.price * paidQty) - (item.discount || 0);
    const freeValue = (item.freeQty || 0) * item.price;
    
    if (item.freeQty && item.freeQty >= item.quantity) {
      text += `${index + 1}. 🎁 ${item.breedName}${gradeLabel} ${genderLabel}: ${item.quantity} ${typeLabel} = แถมฟรีทั้งหมด\n`;
    } else if (item.freeQty && item.freeQty > 0) {
      text += `${index + 1}. ${item.breedName}${gradeLabel} ${genderLabel}: ${item.quantity} ${typeLabel} (แถม ${item.freeQty} มูลค่า -${freeValue})`;
      if (item.discount && item.discount > 0) {
        text += ` (ลดเพิ่ม -${item.discount})`;
      }
      text += ` = ${itemPaid.toLocaleString()}.-\n`;
    } else {
      text += `${index + 1}. ${item.breedName}${gradeLabel} ${genderLabel}: ${item.quantity} ${typeLabel}`;
      if (item.discount && item.discount > 0) {
        text += ` (ลด -${item.discount} บาท)`;
      }
      text += ` = ${itemPaid.toLocaleString()}.-\n`;
    }
  });
  
  text += `----------------------------\n`;
  text += `📊 จำนวนปลาทั้งหมด: ${totalFish} ตัว\n`;
  text += `💰 มูลค่าปลารวม: ${rawSubtotal.toLocaleString()} บาท\n`;
  if (totalFreeValue > 0) {
    text += `🎁 ส่วนลดของแถม: -${totalFreeValue.toLocaleString()} บาท\n`;
  }
  text += `🚚 ค่าจัดส่ง: ${finalShippingFee.toLocaleString()} บาท\n`;
  text += `🔥 ยอดรวมทั้งสิ้น: ${grandTotal.toLocaleString()} บาท\n`;
  
  if (customer) {
    text += `👤 ลูกค้า: ${customer}\n`;
  }
  if (note) {
    text += `💬 หมายเหตุ: ${note}\n`;
  }
  
  text += `----------------------------\n`;
  text += `🏦 ช่องทางชำระเงิน\n`;
  text += `${bankInfo?.bank_name || 'ไม่ระบุธนาคาร'}\n`;
  text += `เลขบัญชี: ${bankInfo?.account_number || 'ไม่ระบุเลขบัญชี'}\n`;
  text += `ชื่อบัญชี: ${bankInfo?.account_name || 'ไม่ระบุชื่อ'}\n`;
  text += `----------------------------\n`;
  text += `ชำระแล้วรบกวนส่งสลิปแจ้งชื่อที่อยู่ได้เลยครับ 🙏✨`;
  
  return text;
};

// Format date for display
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString('th-TH', { 
    dateStyle: 'medium', 
    timeStyle: 'short' 
  });
};