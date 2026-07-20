/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** โดเมนที่ใช้สร้างลิงก์ใบสรุปให้ลูกค้า ตั้งตอน build ถ้าย้ายโดเมน */
  readonly VITE_PUBLIC_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
