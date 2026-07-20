// จับ LINE userId ตอนลูกค้าเปิดใบสรุปผ่าน LIFF
//
// LIFF ID ไม่ใช่ความลับ — มันโผล่ใน URL ที่ลูกค้าเห็นอยู่แล้ว
// (ต่างจาก channel secret / access token ที่ห้ามอยู่ฝั่งเบราว์เซอร์)
export const LIFF_ID = '2010766267-xz9flUvC';

/** ลิงก์ที่เปิดใบสรุปข้างในแอป LINE — ใช้ลิงก์นี้เวลาส่งให้ลูกค้า */
export function getLiffOrderUrl(token: string): string {
  return `https://liff.line.me/${LIFF_ID}/o/${token}`;
}

/**
 * คืน LINE userId ถ้าเปิดอยู่ในแอป LINE ไม่งั้นคืน null
 *
 * ตั้งใจให้ "เงียบ" เมื่อเปิดนอก LINE — หน้าใบสรุปต้องใช้งานได้ตามปกติ
 * ถ้าลูกค้าเปิดในเบราว์เซอร์ธรรมดา แค่ไม่ได้ userId เท่านั้น ไม่ควรเด้ง login ใส่หน้าเขา
 */
export async function getLineUserId(): Promise<string | null> {
  try {
    // โหลดตอนใช้จริงเท่านั้น จะได้ไม่ถ่วงบันเดิลหลักของหน้าร้าน
    const liff = (await import('@line/liff')).default;

    await liff.init({ liffId: LIFF_ID });

    // เปิดนอกแอป LINE → ไม่ต้องบังคับให้ล็อกอิน
    if (!liff.isInClient()) return null;
    if (!liff.isLoggedIn()) return null;

    const profile = await liff.getProfile();
    return profile.userId || null;
  } catch (err) {
    // LIFF พังไม่ควรทำให้ใบสรุปเปิดไม่ได้ — บันทึกไว้เฉย ๆ แล้วไปต่อ
    console.warn('LIFF init failed:', err);
    return null;
  }
}
