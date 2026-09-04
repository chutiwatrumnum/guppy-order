// ย่อรูปในเบราว์เซอร์ก่อนอัปขึ้น Supabase
//
// ทำไมต้องย่อฝั่งนี้: แพลนฟรีของ Supabase ไม่มี Image Transformation
// (ต่อ ?width= ท้าย URL ได้เฉพาะแพลน Pro) แปลว่าไฟล์ที่อัปไปคือไฟล์ที่ลูกค้าโหลด
// ทุกครั้ง ย่อทีหลังไม่ได้ ต้องย่อตอนอัปเท่านั้น
//
// เลขที่ใช้: รูปกว้าง 1000px คุณภาพพอสำหรับการ์ดในกริดและป๊อปอัปบนมือถือ
// ที่ ~150KB ต่อรูป โควตา egress 5GB/เดือน = คนเปิดหน้าเว็บได้หลักหมื่นครั้ง
// ถ้าปล่อยรูปจากมือถือดิบ ๆ (3-5MB) ตัวเลขเดียวกันนี้เหลือหลักร้อย

/** ด้านที่ยาวที่สุดของรูปหลังย่อ */
const MAX_EDGE = 1000;

/** เพดานขนาดไฟล์ที่ยอมรับ — ลดคุณภาพลงเรื่อย ๆ จนกว่าจะผ่าน */
const MAX_BYTES = 150 * 1024;

/** ไล่จากคุณภาพดีสุดลงมา ใช้ตัวแรกที่ไฟล์ไม่เกินเพดาน */
const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.5];

export const PHOTO_MAX_EDGE = MAX_EDGE;
export const PHOTO_MAX_BYTES = MAX_BYTES;

/** ชนิดไฟล์ที่รับจากผู้ใช้ — HEIC จากไอโฟนเบราว์เซอร์ส่วนใหญ่ถอดรหัสไม่ได้
 *  แต่ iOS แปลงเป็น JPEG ให้เองตอนเลือกจากคลังรูป จึงไม่ต้องรับ HEIC ตรง ๆ */
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * ย่อรูปให้ด้านยาวไม่เกิน 1000px แล้วบีบเป็น WebP ให้ไม่เกิน ~150KB
 *
 * คืนไฟล์ใหม่เสมอ — ถึงรูปต้นทางจะเล็กอยู่แล้วก็ยังบีบซ้ำ เพราะรูปเล็กแต่
 * คุณภาพ 100 จาก Photoshop ก็ยังหนักเป็นเมกะไบต์ได้
 *
 * โยน Error พร้อมข้อความภาษาไทยที่เอาไปโชว์ผู้ใช้ได้เลยเมื่อถอดรหัสรูปไม่สำเร็จ
 */
export async function shrinkPhoto(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    // from-image = หมุนตาม EXIF ให้ด้วย ไม่งั้นรูปแนวตั้งจากมือถือจะนอนลง
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('เปิดไฟล์รูปนี้ไม่ได้ ลองถ่ายภาพหน้าจอแล้วเลือกใหม่อีกครั้งครับ');
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('เบราว์เซอร์นี้ย่อรูปไม่ได้ ลองใช้ Chrome หรือ Safari รุ่นใหม่ครับ');
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // เบราว์เซอร์ที่ไม่รู้จัก WebP จะคืน PNG มาแทนโดยไม่แจ้ง error — เช็กจาก type ที่ได้จริง
  const probe = await toBlob(canvas, 'image/webp', QUALITY_STEPS[0]);
  const mime = probe?.type === 'image/webp' ? 'image/webp' : 'image/jpeg';

  let out = mime === 'image/webp' ? probe : await toBlob(canvas, mime, QUALITY_STEPS[0]);

  for (let i = 1; i < QUALITY_STEPS.length && out && out.size > MAX_BYTES; i++) {
    out = await toBlob(canvas, mime, QUALITY_STEPS[i]);
  }

  if (!out) throw new Error('ย่อรูปไม่สำเร็จ ลองใหม่อีกครั้งครับ');

  const ext = mime === 'image/webp' ? 'webp' : 'jpg';
  return new File([out], `photo.${ext}`, { type: mime });
}

/** ดึง path ในบัคเก็ตออกจาก public URL เพื่อเอาไปสั่งลบ
 *  คืน null ถ้าลิงก์นั้นไม่ได้อยู่ในบัคเก็ตนี้ (เช่นลิงก์เก่าที่ชี้ไปเพจร้าน) */
export function storagePathFromUrl(url: string | null, bucket: string): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  return decodeURIComponent(url.slice(at + marker.length).split('?')[0]) || null;
}
