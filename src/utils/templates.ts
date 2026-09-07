import { supabase } from '@/lib/supabase';

// ข้อความที่ส่งหาลูกค้า — ตัวเดียวกับที่บอทใช้ อยู่ในตาราง message_templates
//
// ฝั่งนี้ใช้เฉพาะข้อความที่หน้าแอดมินเป็นคนหยอดคิวเอง (ยืนยันเงิน / ปฏิเสธสลิป)
// ที่เหลือบอทเป็นคนส่งและอ่านตารางเดียวกันนี้

export interface MessageTemplate {
  key: string;
  label: string;
  description: string | null;
  group_key: string;
  body: string;
  variables: string[];
  required: string[];
  sort_order: number;
  enabled: boolean;
}

/** แทนค่า {{ชื่อ}} ในข้อความ */
export function fill(body: string, vars: Record<string, string | number | null | undefined>) {
  let out = body;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v == null ? '' : String(v));
  }
  return out;
}

/**
 * ดึงข้อความตาม key แล้วแทนค่า
 *
 * fallback ใช้ตอนหาไม่เจอ — กันเคสยังไม่ได้รัน migration หรือแถวถูกลบ
 * ปล่อยให้ส่งข้อความว่างออกไปหาลูกค้าแย่กว่าใช้คำเดิมที่ฝังไว้
 *
 * คืน null เมื่อร้านปิดข้อความนี้ไว้ในหน้าตั้งค่า ซึ่งต่างจากหาแถวไม่เจอ:
 * ปิดเอง = ตั้งใจไม่ส่ง ห้าม fallback ไปใช้คำที่ฝังไว้ ไม่งั้นสวิตช์ไม่มีผล
 */
export async function renderTemplate(
  key: string,
  vars: Record<string, string | number | null | undefined>,
  fallback: string
): Promise<string | null> {
  const { data } = await supabase
    .from('message_templates')
    .select('body, enabled')
    .eq('key', key)
    .maybeSingle();

  if (data && !data.enabled) return null;

  return fill(data?.body || fallback, vars);
}

/** ตัวแปรที่หายไปจากข้อความ ใช้เตือนตอนบันทึกในหน้าตั้งค่า */
export function missingRequired(body: string, required: string[]) {
  return required.filter((v) => !body.includes(`{{${v}}}`));
}
