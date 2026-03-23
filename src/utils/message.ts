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
  totalFishPrice: number,
  bankInfo: BankInfo,
  grandTotal: number
): string => {
  if (orderItems.length === 0) return '';
  
  let text = `🐠 รายการสั่งซื้อปลาหางนกยูง\n`;
  text += `----------------------------\n`;
  
  orderItems.forEach((item, index) => {
    const typeLabel = item.type === 'piece' ? 'ตัว' : item.type === 'pair' ? 'คู่' : 'set';
    const genderLabel = item.gender === 'male' ? '♂️' : item.gender === 'female' ? '♀️' : '⚥';
    const gradeLabel = item.grade === 'premium' ? ' 👑[งานคัดเกรด]' : '';
    const itemTotal = calculateItemTotal(item);
    const paidQty = item.quantity - (item.freeQty || 0);
    
    if (item.freeQty && item.freeQty >= item.quantity) {
      // All free
      text += `${index + 1}. 🎁 ${item.breedName}${gradeLabel} ${genderLabel}: ${item.quantity} ${typeLabel} = แถมฟรีทั้งหมด\n`;
    } else if (item.freeQty && item.freeQty > 0) {
      // Partial free
      text += `${index + 1}. ${item.breedName}${gradeLabel} ${genderLabel}: ${item.quantity} ${typeLabel} (ซื้อ ${paidQty} + แถม ${item.freeQty})`;
      if (item.discount && item.discount > 0) {
        text += ` (ลด ${item.discount} บาท)`;
      }
      text += ` = ${itemTotal.toLocaleString()}.-\n`;
    } else {
      // No free
      text += `${index + 1}. ${item.breedName}${gradeLabel} ${genderLabel}: ${item.quantity} ${typeLabel}`;
      if (item.discount && item.discount > 0) {
        text += ` (ลด ${item.discount} บาท)`;
      }
      text += ` = ${itemTotal.toLocaleString()}.-\n`;
    }
  });
  
  text += `----------------------------\n`;
  text += `📊 จำนวนปลาทั้งหมด: ${totalFishCount} ตัว\n`;
  text += `💰 ค่าปลา: ${totalFishPrice.toLocaleString()} บาท\n`;
  text += `🚚 ค่าจัดส่ง: ${bankInfo.shipping_fee.toLocaleString()} บาท\n`;
  text += `🔥 ยอดรวมทั้งสิ้น: ${grandTotal.toLocaleString()} บาท\n`;
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
  
  const itemsTotal = items.reduce((sum, item) => {
    const paidQty = item.quantity - (item.freeQty || 0);
    return sum + (item.price * paidQty) - (item.discount || 0);
  }, 0);
  
  const finalShippingFee = shippingFee || bankInfo?.shipping_fee || 60;
  const grandTotal = itemsTotal + finalShippingFee;
  
  let text = `🐠 รายการสั่งซื้อปลาหางนกยูง\n`;
  text += `----------------------------\n`;
  
  items.forEach((item, index) => {
    const typeLabel = item.type === 'piece' ? 'ตัว' : item.type === 'pair' ? 'คู่' : 'set';
    const genderLabel = item.gender === 'male' ? '♂️' : item.gender === 'female' ? '♀️' : '⚥';
    const gradeLabel = item.grade === 'premium' ? ' 👑[งานคัดเกรด]' : '';
    const paidQty = item.quantity - (item.freeQty || 0);
    const itemTotal = (item.price * paidQty) - (item.discount || 0);
    
    if (item.freeQty && item.freeQty >= item.quantity) {
      text += `${index + 1}. 🎁 ${item.breedName}${gradeLabel} ${genderLabel}: ${item.quantity} ${typeLabel} = แถมฟรีทั้งหมด\n`;
    } else if (item.freeQty && item.freeQty > 0) {
      text += `${index + 1}. ${item.breedName}${gradeLabel} ${genderLabel}: ${item.quantity} ${typeLabel} (ซื้อ ${paidQty} + แถม ${item.freeQty})`;
      if (item.discount && item.discount > 0) {
        text += ` (ลด ${item.discount} บาท)`;
      }
      text += ` = ${itemTotal.toLocaleString()}.-\n`;
    } else {
      text += `${index + 1}. ${item.breedName}${gradeLabel} ${genderLabel}: ${item.quantity} ${typeLabel}`;
      if (item.discount && item.discount > 0) {
        text += ` (ลด ${item.discount} บาท)`;
      }
      text += ` = ${itemTotal.toLocaleString()}.-\n`;
    }
  });
  
  text += `----------------------------\n`;
  text += `📊 จำนวนปลาทั้งหมด: ${totalFish} ตัว\n`;
  text += `💰 ค่าปลา: ${itemsTotal.toLocaleString()} บาท\n`;
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