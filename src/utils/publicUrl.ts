// สร้างลิงก์ใบสรุปที่ส่งให้ลูกค้า
//
// ห้ามใช้ window.location.origin ตรง ๆ เพราะถ้าคีย์ออเดอร์จาก dev server
// ลิงก์จะกลายเป็น http://localhost:3000/o/... ซึ่งลูกค้าเปิดไม่ได้
// และจะไม่มีใครรู้ตัวจนกว่าลูกค้าจะทัก

/** โดเมนจริงที่ deploy อยู่ ใช้เป็นค่าสำรองเมื่อรันบนเครื่องตัวเอง */
const PRODUCTION_ORIGIN = 'https://ecommerce-guppy.web.app';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];

export function getPublicBaseUrl(): string {
  // ตั้ง VITE_PUBLIC_BASE_URL ตอน build ได้ถ้าย้ายโดเมน
  const configured = import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined;
  if (configured?.trim()) return configured.trim().replace(/\/+$/, '');

  if (typeof window === 'undefined') return PRODUCTION_ORIGIN;

  // รันบนเครื่องตัวเอง → ลิงก์ต้องชี้ไปโดเมนจริง ไม่ใช่ localhost
  if (LOCAL_HOSTS.includes(window.location.hostname)) return PRODUCTION_ORIGIN;

  // deploy ที่โดเมนอื่น (เช่นย้ายไปโดเมนตัวเอง) ให้ใช้ตามที่เปิดอยู่
  return window.location.origin.replace(/\/+$/, '');
}

export function getPublicOrderUrl(token: string): string {
  return `${getPublicBaseUrl()}/o/${token}`;
}
