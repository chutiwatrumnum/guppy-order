// บิลสองใบเป็นของลูกค้าคนเดียวกันไหม
//
// ใช้กับแถบ "ลูกค้าคนนี้มีอีก N บิลที่ยังไม่ถึงมือ" และตัวนับจำนวนลูกค้าในหน้าบิล
// จับคู่หลุด = แพ็คแยกกล่องทั้งที่ควรรวม · จับคู่เกิน = เอาของคนแปลกหน้ามาปนกล่อง

import { normalizeThaiPhone } from './address';
import type { SavedOrder } from '@/types';

type PersonFields = Pick<SavedOrder, 'id' | 'customerId' | 'customerPhone' | 'lineUserId'>;

const LINE_USER_ID = /^U[0-9a-f]{32}$/;

/**
 * กุญแจที่บอกได้ว่าบิลเป็นของใคร — บิลหนึ่งมีได้ถึงสามดอก
 *
 * แต่ละดอกเข้ามาคนละจังหวะ: ร้านเลือกลูกค้าหรือพิมพ์เบอร์ตอนออกบิล,
 * ลูกค้าเปิดลิงก์ในไลน์ (LINE), ลูกค้ากรอกที่อยู่เอง (customer_id + เบอร์)
 * บิลของคนเดียวกันจึงมักถือกุญแจคนละดอก ยึดดอกเดียวเมื่อไหร่ก็จับคู่หลุด
 */
export function personKeys(o: PersonFields): string[] {
  const keys: string[] = [];
  if (o.customerId) keys.push(`c:${o.customerId}`);

  // ร้านพิมพ์เบอร์เองได้ทุกรูปแบบ (ขีด เว้นวรรค +66 ตก 0) ส่วนที่ลูกค้ากรอกถูกจัดรูปมาแล้ว
  // ต้องทำให้เป็นรูปเดียวกันก่อนเทียบ และเบอร์ที่ไม่เข้ารูปแบบไม่เอามาใช้เลย
  // ไม่งั้นบิลที่พิมพ์ "-" ไว้ในช่องเบอร์จะกลายเป็นคนเดียวกันหมด
  const phone = o.customerPhone ? normalizeThaiPhone(o.customerPhone) : null;
  if (phone) keys.push(`p:${phone}`);

  // เฉพาะไอดี LINE จริง ค่าอื่นที่หลุดเข้ามาจะรวมคนแปลกหน้าเข้าด้วยกัน
  if (o.lineUserId && LINE_USER_ID.test(o.lineUserId)) keys.push(`l:${o.lineUserId}`);

  return keys;
}

/**
 * จัดบิลเป็นกลุ่มตามตัวคน — คืน map จาก id บิล → รหัสกลุ่ม
 *
 * กุญแจตรงกันดอกเดียวก็นับเป็นคนเดียวกัน และต่อกันเป็นทอด ๆ ได้:
 * บิล A มีแต่เบอร์ บิล B มีแต่ LINE บิล C มีทั้งสองอย่าง → ทั้งสามใบคือคนเดียวกัน
 *
 * บิลที่ไม่มีกุญแจเลยเป็นกลุ่มของตัวเอง — ไม่รู้ว่าเป็นใคร ก็ไม่เดาว่าซ้ำกับใคร
 */
export function groupByPerson(orders: PersonFields[]): Map<string, string> {
  const parent = new Map<string, string>();

  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(x, root);
    return root;
  };

  for (const o of orders) {
    const bill = `o:${o.id}`;
    if (!parent.has(bill)) parent.set(bill, bill);

    for (const key of personKeys(o)) {
      if (!parent.has(key)) parent.set(key, key);
      parent.set(find(key), find(bill));
    }
  }

  return new Map(orders.map((o): [string, string] => [o.id, find(`o:${o.id}`)]));
}
