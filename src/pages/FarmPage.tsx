import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowRight,
  Bell,
  Camera,
  Copy,
  Droplets,
  Fish,
  MessageCircle,
  Package,
  Receipt,
  ShieldCheck,
  Thermometer,
  Utensils,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { FARM, DOA_POLICY } from '@/config/farm';
import GuppyArt, { FAMILIES, familyDot, familyOf, tagTiltOf } from '@/components/GuppyArt';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

// หน้าโชว์ฟาร์มสำหรับลูกค้าใหม่ที่ยังไม่รู้จักร้าน
//
// คนละงานกับ /o/{token} ที่เป็นใบสรุปของลูกค้าที่สั่งไปแล้ว — หน้านี้ต้องตอบให้ได้ว่า
// "ร้านนี้โอนเงินไปแล้วจะได้ปลาจริงไหม" ซึ่งตอบด้วยคำโฆษณาไม่ขึ้น
// ตัวที่ตอบได้คือของที่ร้านมีอยู่แล้ว: ระบบเคลมปลาตาย เลขพัสดุอัตโนมัติ ใบสรุปออนไลน์
//
// ข้อมูลมาจาก RPC get_public_showcase ตัวเดียว ไม่แตะตารางตรง ๆ (anon ไม่มีสิทธิ์)

interface ShowcaseBreed {
  id: string;
  name: string;
  blurb: string | null;
  image_url: string | null;
  /** ตอนนี้สั่งได้ไหม — ไม่มีค่ามา (migration ยังไม่ push) ให้ถือว่ามีขาย
   *  ขึ้นว่าหมดทั้งร้านเพราะฟิลด์ยังไม่มี เสียหายกว่าขึ้นว่ามีขายเกินจริงหนึ่งรอบ */
  in_stock?: boolean;
  price_piece: number | null;
  price_pair: number | null;
  price_set: number | null;
}

interface ShowcaseStats {
  breeds: number;
  orders: number;
  fish: number;
  since: number | null;
}

// ใช้ตอน migration ยังไม่ถูก push ขึ้น production — หน้าเว็บจะได้ไม่ว่างเปล่า
// ระหว่างรอ และคนที่กำลังทำ design จะได้เห็นของจริงว่าเต็มแล้วหน้าตาเป็นยังไง
const SAMPLE_BREEDS: ShowcaseBreed[] = [
  { id: 's1', name: 'Full Red Albino', blurb: 'แดงทั้งตัวตั้งแต่เล็ก ตาแดงชัด', image_url: null, price_piece: 250, price_pair: 450, price_set: 1200 },
  { id: 's2', name: 'Blue Grass', blurb: 'ลายจุดกระจายบนหางฟ้า ยิ่งโตยิ่งชัด', image_url: null, price_piece: 200, price_pair: 380, price_set: 1000 },
  { id: 's3', name: 'Koi Red Ear', blurb: 'ตัวขาวหัวแดง หูแดง ลายไม่ซ้ำกันสักตัว', image_url: null, price_piece: 350, price_pair: 650, price_set: 1800 },
  { id: 's4', name: 'Full Gold', blurb: 'เหลืองทองทั้งตัว เด่นมากในตู้ไม้น้ำ', image_url: null, in_stock: false, price_piece: 220, price_pair: 400, price_set: null },
  { id: 's5', name: 'Moscow Blue', blurb: 'น้ำเงินเข้มเมทัลลิก ทรงใหญ่ เลี้ยงง่าย', image_url: null, price_piece: 300, price_pair: 550, price_set: 1500 },
  { id: 's6', name: 'Half Black Purple', blurb: 'ครึ่งตัวหลังดำ หางม่วงบานใหญ่', image_url: null, price_piece: 280, price_pair: 520, price_set: null },
  { id: 's7', name: 'Tuxedo Red Dumbo', blurb: 'หูช้างแดง ตัดกับลำตัวดำ', image_url: null, price_piece: 320, price_pair: 600, price_set: 1600 },
  { id: 's8', name: 'Green Lace', blurb: 'เขียวเหลือบ ลายลูกไม้ทั้งหาง', image_url: null, price_piece: 260, price_pair: 480, price_set: null },
  { id: 's9', name: 'Blue Topaz', blurb: 'ฟ้าใสทั้งตัว หางบานกลม', image_url: null, price_piece: 240, price_pair: 440, price_set: null },
  { id: 's10', name: 'Red Mosaic', blurb: 'ลายโมเสกแดงส้มเต็มหาง', image_url: null, price_piece: 270, price_pair: 500, price_set: 1400 },
  { id: 's11', name: 'Purple Moscow', blurb: 'ม่วงเข้มเหลือบ ทรงใหญ่แบบมอสโคว์', image_url: null, in_stock: false, price_piece: 380, price_pair: 700, price_set: 1900 },
  { id: 's12', name: 'Albino Full Gold', blurb: 'ทองอ่อนตาแดง หาง่ายยากในไซซ์ใหญ่', image_url: null, price_piece: 340, price_pair: 620, price_set: null },
];

const SAMPLE_STATS: ShowcaseStats = { breeds: 12, orders: 0, fish: 0, since: null };

/** ฝูงปลาฉากหลังฮีโร่ — ค่าคงที่ ไม่สุ่ม จะได้ไม่กระตุกใหม่ทุกครั้งที่ React เรนเดอร์
 *  ตัวใหญ่ = อยู่ใกล้ผิวน้ำ ชัดกว่าและว่ายเร็วกว่า ตัวเล็ก = ลึกลงไป เบลอและช้า
 *  ถ้าทุกตัวคมเท่ากันมันจะกลายเป็นสติกเกอร์แปะฉากหลัง ไม่ใช่ปลาที่อยู่คนละระยะ */
const SCHOOL = [
  { name: 'Blue Grass', top: '10%', size: 150, dur: 52, delay: -4, opacity: 0.32, blur: 0 },
  { name: 'Full Red Albino', top: '30%', size: 96, dur: 68, delay: -28, opacity: 0.22, blur: 1.5 },
  { name: 'Full Gold', top: '58%', size: 120, dur: 44, delay: -16, opacity: 0.26, blur: 0.8 },
  { name: 'Moscow Blue', top: '74%', size: 78, dur: 76, delay: -50, opacity: 0.18, blur: 2.5 },
  { name: 'Koi Red Ear', top: '42%', size: 64, dur: 60, delay: -38, opacity: 0.16, blur: 3 },
];

const GUARANTEES = [
  {
    icon: ShieldCheck,
    title: 'ปลาตายระหว่างส่ง เคลมได้',
    body: `แจ้งภายใน ${DOA_POLICY.windowHours} ชั่วโมงหลังรับพัสดุ พร้อม${DOA_POLICY.evidence} ทางร้านคืนเงินหรือส่งปลาชดเชยให้ ทุกเคสถูกบันทึกไว้ในระบบ ไม่ใช่คุยจบในแชทแล้วหาย`,
  },
  {
    icon: Bell,
    title: 'เลขพัสดุแจ้งอัตโนมัติทาง LINE',
    body: 'ไม่ต้องทักมาถามว่าของถึงไหน ระบบเช็คสถานะให้เองแล้วเด้งเข้าไลน์ทุกครั้งที่พัสดุขยับ จนถึงวันนำจ่าย',
  },
  {
    icon: Receipt,
    title: 'ใบสรุปออนไลน์ทุกบิล',
    body: 'เปิดลิงก์เดียวเห็นครบ — สั่งอะไรไปบ้าง ราคาเท่าไหร่ จ่ายแล้วหรือยัง เลขพัสดุอะไร แนบสลิปได้ในหน้าเดียวกัน',
  },
  {
    icon: Package,
    title: 'แพ็คถุงออกซิเจน ส่งพร้อมคู่มือ',
    body: 'ปลาลงถุงออกซิเจนในกล่องกันกระแทก และส่งวิธีรับปลากับวิธีเลี้ยงให้ทุกบิล ไม่ต้องมานั่งหาเอาเองว่าแกะกล่องยังไง',
  },
];

const ORDER_STEPS = [
  { title: 'ทักไลน์บอกพันธุ์ที่อยากได้', body: 'ไม่แน่ใจว่าเลี้ยงพันธุ์ไหนดี บอกขนาดตู้กับงบมา ทางร้านช่วยเลือกให้' },
  { title: 'รับใบสรุปเป็นลิงก์', body: 'ร้านสรุปรายการให้ กดลิงก์ดูได้ตลอด กรอกที่อยู่จัดส่งในหน้านั้นได้เลย' },
  { title: 'โอนแล้วแนบสลิปในใบสรุป', body: 'สแกน PromptPay จากในใบสรุป โอนเสร็จกดแนบสลิป ระบบรู้ทันทีว่าเป็นของบิลไหน' },
  { title: 'ร้านแพ็คส่ง แล้วตามให้อัตโนมัติ', body: `แพ็ควัน${FARM.shipDays} ส่งแล้วเลขพัสดุเด้งเข้าไลน์ พร้อมอัปเดตทุกสถานะจนของถึงมือ` },
];

const ACCLIMATION = [
  { icon: Thermometer, time: '0–30 นาที', title: 'ลอยถุงในตู้ ปิดไฟ', body: 'ยังไม่ต้องเปิดถุง ลอยไว้ให้อุณหภูมิในถุงเท่ากับน้ำในตู้ก่อน ปิดไฟตู้ไว้ด้วยจะได้ไม่ตกใจ' },
  { icon: Droplets, time: '30–70 นาที', title: 'เติมน้ำตู้เข้าถุงทีละน้อย', body: 'เปิดปากถุง ตักน้ำจากตู้ใส่เข้าไปครั้งละนิด ทุก 10 นาที ประมาณ 4 รอบ ให้ปลาค่อย ๆ ชินกับค่าน้ำใหม่' },
  { icon: Fish, time: 'ตอนปล่อย', title: 'ช้อนปลาลงตู้ อย่าเทน้ำในถุงลงไป', body: 'ใช้สวิงช้อนเฉพาะตัวปลา น้ำในถุงเป็นน้ำที่ปลาอยู่มาหลายชั่วโมงระหว่างขนส่ง ไม่ควรลงตู้' },
  { icon: Utensils, time: '12–24 ชม.', title: 'งดอาหารวันแรก', body: 'ปลาเพิ่งเดินทาง ยังเครียดอยู่ ให้อาหารตอนนี้มักเหลือแล้วน้ำเสีย วันรุ่งขึ้นค่อยเริ่มให้ทีละน้อย' },
  { icon: Camera, time: 'ถ้าเจอปัญหา', title: 'ถ่ายวิดีโอไว้ก่อนทักมา', body: `ถ่ายตั้งแต่ตอนแกะกล่องแบบไม่ตัดต่อ แล้วทักมาภายใน ${DOA_POLICY.windowHours} ชั่วโมง ทางร้านดูแลให้` },
];

const FAQ = [
  {
    q: 'สั่งขั้นต่ำเท่าไหร่ ส่งทั่วประเทศไหม',
    a: 'ส่งทั่วประเทศครับ ไม่มีขั้นต่ำเป็นจำนวนตัว แต่ค่าส่งคิดเท่ากันทั้งกล่อง สั่งหลายตัวในบิลเดียวจะคุ้มกว่าแยกสั่งหลายรอบ',
  },
  {
    q: 'ปลาที่ได้จะเหมือนในรูปไหม',
    a: 'ลายและเฉดสีของปลาแต่ละตัวไม่ซ้ำกันเป๊ะ ๆ อยู่แล้ว โดยเฉพาะพวกลายจุดอย่าง Grass หรือ Koi ทางร้านคัดตัวที่ลายสวยที่สุดในรุ่นนั้นให้ และขอดูตัวจริงก่อนโอนได้เสมอ',
  },
  {
    q: 'จ่ายเงินยังไง',
    a: 'โอนผ่าน PromptPay หรือเลขบัญชีที่อยู่ในใบสรุป โอนเสร็จแนบสลิปในหน้าใบสรุปได้เลย ระบบจับคู่กับบิลให้เอง ไม่ต้องรอร้านมานั่งไล่ดูว่าสลิปนี้ของใคร',
  },
  {
    q: 'ปลาตายระหว่างส่งทำยังไง',
    a: `ถ่ายวิดีโอตอนแกะกล่องแบบไม่ตัดต่อ แล้วแจ้งภายใน ${DOA_POLICY.windowHours} ชั่วโมงหลังรับพัสดุ ทางร้านคืนเงินตามจำนวนที่ตาย หรือส่งปลาชดเชยรอบหน้าให้ แล้วแต่จะเลือก`,
  },
  {
    q: 'ต้องมีตู้ใหญ่แค่ไหน เลี้ยงยากไหม',
    a: 'ปลาหางนกยูงเลี้ยงไม่ยาก ตู้ 12–24 นิ้วก็พอ ขอแค่มีระบบกรอง เปลี่ยนน้ำสัปดาห์ละครั้งประมาณ 30% และอย่าให้อาหารเยอะเกิน ที่ตายส่วนใหญ่มาจากอาหารเหลือจนน้ำเสีย ไม่ใช่ตัวปลาไม่แข็งแรง',
  },
  {
    q: 'อยากได้พันธุ์ที่ไม่มีในหน้านี้',
    a: 'ทักมาถามได้ครับ บางพันธุ์เพิ่งขายหมดรอบ หรือกำลังเพาะอยู่ยังไม่ได้ขนาดขาย ทางร้านจะบอกได้ว่าประมาณเมื่อไหร่มี',
  },
];

type PriceUnit = 'piece' | 'pair' | 'set';

const UNITS: Array<{ key: PriceUnit; label: string }> = [
  { key: 'piece', label: 'ตัว' },
  { key: 'pair', label: 'คู่' },
  { key: 'set', label: 'ชุด' },
];

type SortKey = 'name' | 'price-asc' | 'price-desc';

const SECTIONS = [
  { id: 'breeds', label: 'สายพันธุ์' },
  { id: 'trust', label: 'ทำไมต้องที่นี่' },
  { id: 'order', label: 'วิธีสั่ง' },
  { id: 'care', label: 'วิธีรับปลา' },
  { id: 'faq', label: 'คำถามที่พบบ่อย' },
];

function priceOf(breed: ShowcaseBreed, unit: PriceUnit): number | null {
  const value =
    unit === 'piece' ? breed.price_piece : unit === 'pair' ? breed.price_pair : breed.price_set;
  return value && value > 0 ? value : null;
}

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

/** หมดชั่วคราว — เทียบกับ false ตรง ๆ ไม่ใช่ !in_stock เพราะ undefined แปลว่า
 *  ฐานข้อมูลยังไม่มีคอลัมน์นี้ ไม่ได้แปลว่าปลาหมด */
const isSoldOut = (b: ShowcaseBreed) => b.in_stock === false;

/** เปลี่ยนหน้าจอแบบให้ของเก่าเลื่อนไปตำแหน่งใหม่ ไม่ใช่กระพริบแล้วเรียงใหม่
 *
 *  เบราว์เซอร์ที่ยังไม่รองรับ View Transitions หรือคนที่ปิดแอนิเมชันไว้ ให้อัปเดตตรง ๆ
 *  ผลลัพธ์เหมือนกันทุกประการ ต่างแค่ระหว่างทาง */
function withViewTransition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced || typeof doc.startViewTransition !== 'function') {
    update();
    return;
  }
  // flushSync บังคับให้ React อัปเดต DOM จบภายในคอลแบ็ก ไม่งั้นเบราว์เซอร์
  // ถ่ายภาพ "หลัง" ตั้งแต่ก่อน React แก้ DOM แล้วไม่มีอะไรขยับให้เห็น
  doc.startViewTransition(() => flushSync(update));
}

/** ค่อย ๆ โผล่ขึ้นตอนเลื่อนถึง — ทำครั้งเดียวแล้วเลิกดู ไม่ให้จาง ๆ วน ๆ ตอนเลื่อนกลับขึ้น */
function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'li' | 'section';
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const show = () => {
      el.classList.add('is-in');
      io.disconnect();
      clearTimeout(failsafe);
    };

    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && show(), {
      threshold: 0.08,
      rootMargin: '0px 0px -8% 0px',
    });
    io.observe(el);

    // กันหน้าขาว: เนื้อหาซ่อนอยู่จนกว่า observer จะยิง ถ้ามันไม่ยิงด้วยเหตุอะไรก็ตาม
    // (แท็บถูกเบราว์เซอร์หรี่การทำงาน, ส่วนขยายบางตัว) ลูกค้าจะเจอหน้าเปล่าทั้งหน้า
    const failsafe = setTimeout(show, 1500);

    return () => {
      io.disconnect();
      clearTimeout(failsafe);
    };
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={cn('reveal', className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

/** ขอบน้ำ — คั่นฉากด้วยผิวน้ำแทนเส้นตรง ให้หน้ารู้สึกเป็นตู้ปลาต่อกันทั้งหน้า */
function WaterEdge({ className, flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 1440 48"
      preserveAspectRatio="none"
      aria-hidden
      className={cn('block h-6 w-full sm:h-10', flip && 'rotate-180', className)}
    >
      <path
        d="M0 26 C 180 6 300 44 480 30 C 660 16 780 44 960 32 C 1140 20 1300 40 1440 24 L1440 48 L0 48 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** ป้ายหัวข้อของแต่ละส่วน
 *
 *  ตั้งใจไม่ใช้ทรง uppercase + letter-spacing กว้างแบบที่เห็นทั่วไป เพราะภาษาไทย
 *  ไม่มีตัวพิมพ์ใหญ่ และการกางตัวอักษรทำให้สระกับวรรณยุกต์หลุดออกจากพยัญชนะ
 *  ใช้ขีดสั้นนำหน้าคำแทน — บอกว่า "นี่คือป้ายกำกับ" ได้เหมือนกันโดยไม่ทำร้ายตัวหนังสือ
 */
function Eyebrow({ children, tone = 'light' }: { children: React.ReactNode; tone?: 'light' | 'dark' }) {
  return (
    <p
      className={cn(
        'flex items-center gap-2.5 text-[13px] font-medium',
        tone === 'dark' ? 'text-[var(--f-water-2)]' : 'text-[var(--f-coral)]'
      )}
    >
      <span
        aria-hidden
        className={cn('h-px w-6 shrink-0', tone === 'dark' ? 'bg-white/30' : 'bg-[var(--f-coral)]/45')}
      />
      {children}
    </p>
  );
}

/** ตู้ปลาหนึ่งใบ = สายพันธุ์หนึ่งพันธุ์
 *
 *  ป้ายชื่อเอียงคนละองศาโดยตั้งใจ ฟาร์มจริงแปะเทปเขียนชื่อข้างขวดเพาะทีละใบ
 *  ป้ายที่ตรงเป๊ะเท่ากันทุกใบคือสิ่งที่บอกว่านี่ไม่ใช่ของที่มีคนทำ */
function BreedTank({
  breed,
  unit,
  onOpen,
  transitionName,
}: {
  breed: ShowcaseBreed;
  unit: PriceUnit;
  onOpen: () => void;
  transitionName?: string;
}) {
  const price = priceOf(breed, unit);
  const unitLabel = UNITS.find((u) => u.key === unit)?.label;
  const soldOut = isSoldOut(breed);

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ viewTransitionName: transitionName }}
      className="tank group focus-visible:ring-[var(--f-water-2)]/80 block w-full cursor-pointer overflow-hidden rounded-[1.25rem] border border-[var(--f-line)] bg-white text-left shadow-[0_1px_2px_rgba(11,58,74,0.05)] transition-shadow duration-300 outline-none hover:shadow-[0_12px_28px_-12px_rgba(11,58,74,0.35)] focus-visible:ring-[3px]"
    >
      <div className="tank-water relative aspect-[5/4] overflow-hidden">
        <div className={cn('size-full', soldOut && 'opacity-75 saturate-[0.45]')}>
          {breed.image_url ? (
            <img
              src={breed.image_url}
              alt={`ปลาหางนกยูงพันธุ์ ${breed.name}`}
              loading="lazy"
              // ปล่อยให้เบราว์เซอร์เลื่อนโหลดเองตอนใกล้ถึง — กริดเต็ม ๆ 57 พันธุ์
              // ถ้าโหลดทุกใบพร้อมกันคือ egress ที่จ่ายไปโดยไม่มีใครได้ดู
              decoding="async"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="size-full p-3">
              <GuppyArt name={breed.name} />
            </div>
          )}
        </div>

        {/* คาดไว้ใต้รูป ไม่ใช่ทับกลางตัวปลา — คนที่กำลังเล็งพันธุ์นี้ยังต้องดูตัวปลาออก
            ถึงจะจำไว้ถามรอบหน้าได้ */}
        {soldOut && (
          <div className="absolute inset-x-0 bottom-0 bg-[var(--f-deep)]/78 py-1.5 text-center backdrop-blur-[1px]">
            <span className="farm-mono text-[11px] font-medium tracking-wide text-white">
              หมดชั่วคราว
            </span>
          </div>
        )}
        {/* แสงจากผิวน้ำด้านบน — ทำให้กล่องดูมีความลึก ไม่ใช่พื้นสีเรียบ */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.55), transparent)' }}
        />
      </div>

      <div className="p-3 sm:p-3.5">
        <div className="tank-tag rounded-md px-2.5 py-1.5" style={{ '--tilt': tagTiltOf(breed.name) } as React.CSSProperties}>
          <p className="farm-mono truncate text-[13px] leading-tight font-medium text-[var(--f-deep)]">
            {breed.name}
          </p>
        </div>

        {breed.blurb && (
          <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-[var(--f-mid)]">
            {breed.blurb}
          </p>
        )}

        <p className="farm-mono mt-2.5 text-[15px] font-semibold whitespace-nowrap text-[var(--f-deep)]">
          {price ? (
            <>
              {baht(price)}
              <span className="ml-1 text-[11px] font-normal text-[var(--f-soft)]">/{unitLabel}</span>
            </>
          ) : (
            <span className="text-[13px] font-normal text-[var(--f-soft)]">ทักมาถามราคา</span>
          )}
        </p>
      </div>
    </button>
  );
}

export default function FarmPage() {
  const [breeds, setBreeds] = useState<ShowcaseBreed[]>([]);
  const [stats, setStats] = useState<ShowcaseStats>(SAMPLE_STATS);
  const [loading, setLoading] = useState(true);
  // จริง = ยังไม่ได้ push migration ขึ้น production หน้าเว็บกำลังโชว์ของปลอมอยู่
  const [usingSample, setUsingSample] = useState(false);

  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<string | null>(null);
  const [unit, setUnit] = useState<PriceUnit>('piece');
  const [sort, setSort] = useState<SortKey>('name');
  const [picked, setPicked] = useState<ShowcaseBreed | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');

  const searchRef = useRef<HTMLDivElement>(null);
  const careRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.rpc('get_public_showcase');
      if (cancelled) return;

      const payload = data as { breeds?: ShowcaseBreed[]; stats?: ShowcaseStats } | null;

      if (error || !payload?.breeds?.length) {
        // ยังไม่มี RPC (migration ยังไม่ push) หรือยังไม่มีพันธุ์ไหนติ๊ก showcase ไว้
        if (error) console.warn('get_public_showcase ไม่สำเร็จ ใช้ข้อมูลตัวอย่างแทน:', error.message);
        setBreeds(SAMPLE_BREEDS);
        setStats(SAMPLE_STATS);
        setUsingSample(true);
      } else {
        setBreeds(payload.breeds);
        setStats(payload.stats ?? SAMPLE_STATS);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── เมนูบนรู้ว่าตอนนี้อ่านอยู่หัวข้อไหน ──────────────────────────
  // หน้ายาวมาก ถ้าเมนูไม่บอกตำแหน่ง คนเลื่อนไปสักพักจะไม่รู้แล้วว่าอยู่ตรงไหนของหน้า
  useEffect(() => {
    const sections = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => !!el
    );
    if (!sections.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      // นับเฉพาะแถบกลางจอ หัวข้อที่เพิ่งโผล่ที่ขอบล่างยังไม่ใช่หัวข้อที่กำลังอ่าน
      { rootMargin: '-45% 0px -45% 0px' }
    );
    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // ── เส้นเวลาในหัวข้อ "วิธีรับปลา" ยาวขึ้นตามที่อ่าน ──────────────
  useEffect(() => {
    const el = careRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.setProperty('--fill', '100%');
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const box = el.getBoundingClientRect();
      // วัดจากกึ่งกลางจอ — จุดที่สายตาอยู่จริงตอนอ่าน ไม่ใช่ขอบบน
      const progress = (window.innerHeight / 2 - box.top) / box.height;
      el.style.setProperty('--fill', `${Math.min(100, Math.max(0, progress * 100)).toFixed(1)}%`);
    };
    const onScroll = () => {
      // รวบหลายอีเวนต์ให้เหลือเฟรมละครั้ง สกรอลล์บนมือถือยิงถี่กว่าที่จอวาดทัน
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [loading]);

  // ── กด "/" เพื่อไปที่ช่องค้นหา ────────────────────────────────
  // คนที่ดูปลาหลายสิบพันธุ์บนคอมพ์จะค้นซ้ำหลายรอบ ไม่ควรต้องเลื่อนกลับขึ้นไปคลิกทุกครั้ง
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      e.preventDefault();
      searchRef.current?.querySelector('input')?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── กรอง / เรียง ─────────────────────────────────────────────
  const familyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of breeds) {
      const key = familyOf(b.name);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [breeds]);

  // โชว์เฉพาะกลุ่มสีที่ร้านมีปลาอยู่จริง ชิปที่กดแล้วว่างเปล่าคือชิปที่ไม่ควรมี
  const chips = useMemo(
    () => FAMILIES.filter((f) => (familyCounts.get(f.key) ?? 0) > 0),
    [familyCounts]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = breeds;

    if (family) list = list.filter((b) => familyOf(b.name) === family);
    if (onlyAvailable) list = list.filter((b) => !isSoldOut(b));
    if (q) {
      list = list.filter(
        (b) => b.name.toLowerCase().includes(q) || (b.blurb ?? '').toLowerCase().includes(q)
      );
    }

    const sorted = [...list];
    if (sort === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'th'));
    } else {
      // พันธุ์ที่ไม่ได้ตั้งราคาในหน่วยนี้ไว้ ให้ไปท้ายสุดเสมอ ไม่ว่าจะเรียงทางไหน
      const dir = sort === 'price-asc' ? 1 : -1;
      sorted.sort((a, b) => {
        const pa = priceOf(a, unit);
        const pb = priceOf(b, unit);
        if (pa === null) return pb === null ? 0 : 1;
        if (pb === null) return -1;
        return (pa - pb) * dir;
      });
    }

    // พันธุ์ที่หมดไปท้ายเสมอ ไม่ว่าจะเรียงแบบไหน — คนเปิดหน้านี้มาหาของที่ซื้อได้วันนี้
    // ให้ของที่สั่งไม่ได้นั่งอยู่แถวแรกคือทำให้เขาต้องคัดเอง
    const available = sorted.filter((b) => !isSoldOut(b));
    const soldOut = sorted.filter(isSoldOut);
    return [...available, ...soldOut];
  }, [breeds, query, family, sort, unit, onlyAvailable]);

  const availableCount = useMemo(() => breeds.filter((b) => !isSoldOut(b)).length, [breeds]);

  // "เริ่มต้นตัวละ" ต้องนับเฉพาะปลาที่สั่งได้จริง — โฆษณาราคาของพันธุ์ที่หมดไปแล้ว
  // คือเหตุผลที่ลูกค้าทักเข้ามาแล้วรู้สึกว่าโดนหลอก
  const cheapest = useMemo(() => {
    const prices = breeds
      .filter((b) => !isSoldOut(b))
      .map((b) => b.price_piece)
      .filter((p): p is number => !!p && p > 0);
    return prices.length ? Math.min(...prices) : null;
  }, [breeds]);

  const isFiltered = Boolean(query.trim() || family || onlyAvailable);

  const resetFilters = useCallback(() => {
    withViewTransition(() => {
      setQuery('');
      setFamily(null);
      setOnlyAvailable(false);
    });
  }, []);

  // ไม่มีลิงก์ไลน์ก็ให้ปุ่มพาไปหัวข้อติดต่อแทน ดีกว่าปุ่มที่กดแล้วไม่ไปไหน
  const contactHref = FARM.lineUrl || '#contact';
  const contactExternal = Boolean(FARM.lineUrl);
  const lineProps = contactExternal ? { target: '_blank', rel: 'noreferrer' } : {};

  return (
    <div className="farm min-h-[100dvh]">
      {/* ══ แถบบน ══════════════════════════════════════════════ */}
      <header className="pt-safe sticky top-0 z-40 border-b border-[var(--f-line)] bg-[var(--f-ground)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <a href="#top" className="flex min-w-0 items-center gap-2.5">
            <img
              src="/logo.png"
              alt=""
              aria-hidden
              width={40}
              height={40}
              className="size-10 shrink-0 rounded-full object-contain"
            />
            <span className="min-w-0">
              <span className="farm-display block truncate text-[15px] leading-tight">
                {FARM.name}
              </span>
              <span className="farm-mono block truncate text-[10px] leading-tight tracking-wider text-[var(--f-soft)] uppercase">
                {FARM.nameEn}
              </span>
            </span>
          </a>

          <nav className="hidden items-center gap-0.5 text-sm lg:flex">
            {SECTIONS.map((s) => {
              const active = activeSection === s.id;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'relative rounded-md px-3 py-1.5 transition-colors',
                    active
                      ? 'text-[var(--f-deep)]'
                      : 'text-[var(--f-mid)] hover:text-[var(--f-deep)]'
                  )}
                >
                  {s.label}
                  {/* จุดใต้เมนู แทนกรอบไฮไลต์ — บอกตำแหน่งได้เท่ากันแต่ไม่ตะโกน */}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute inset-x-0 -bottom-0.5 mx-auto h-1 w-1 rounded-full bg-[var(--f-coral)] transition-opacity',
                      active ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </a>
              );
            })}
          </nav>

          <Button asChild variant="line" size="sm" className="hidden shrink-0 sm:inline-flex">
            <a href={contactHref} {...lineProps}>
              <MessageCircle className="size-4" />
              ทักร้าน
            </a>
          </Button>
        </div>
      </header>

      {/* ══ ฮีโร่ ══════════════════════════════════════════════ */}
      <section id="top" className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(180deg, #f0fafd 0%, var(--f-water) 40%, var(--f-water-2) 100%)',
          }}
        />
        {/* ฝูงปลาว่ายผ่าน จาง ๆ พอให้รู้สึกว่ามีชีวิต แต่ไม่แย่งสายตาจากตัวหนังสือ */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          {SCHOOL.map((fish) => (
            <div
              key={fish.name}
              className="animate-fish-swim absolute left-0"
              style={{
                top: fish.top,
                width: fish.size,
                opacity: fish.opacity,
                filter: fish.blur ? `blur(${fish.blur}px)` : undefined,
                animationDuration: `${fish.dur}s`,
                animationDelay: `${fish.delay}s`,
              }}
            >
              {/* ปลาใน GuppyArt หันซ้าย พลิกให้หันไปทางที่ว่าย ไม่งั้นว่ายถอยหลัง */}
              <div className="-scale-x-100">
                <GuppyArt name={fish.name} />
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto max-w-6xl px-4 pt-14 pb-20 sm:pt-20 sm:pb-28">
          <div className="max-w-2xl">
            <div className="animate-farm-rise" style={{ animationDelay: '0.05s' }}>
              <Eyebrow>ฟาร์มปลาหางนกยูง · ส่งทั่วไทย</Eyebrow>
            </div>

            <h1
              className="farm-display animate-farm-rise mt-4 text-[2.25rem] leading-[1.24] text-[var(--f-deep)] sm:text-6xl"
              style={{ animationDelay: '0.15s' }}
            >
              คัดทีละตัว
              <br />
              แพ็คทีละกล่อง
              <span className="relative inline-block">
                <span className="relative z-10"> ส่งทั่วไทย</span>
                {/* เส้นใต้ที่ลากด้วยมือ ไม่ใช่ border — เส้นตรงเป๊ะบอกว่าเครื่องเป็นคนขีด */}
                <svg
                  aria-hidden
                  viewBox="0 0 240 14"
                  preserveAspectRatio="none"
                  className="farm-underline absolute -bottom-1 left-0 h-3 w-full text-[var(--f-coral)]"
                >
                  <path
                    d="M3 9 C 45 3, 88 12, 130 6 C 168 1, 205 9, 237 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    opacity="0.65"
                  />
                </svg>
              </span>
            </h1>

            <p
              className="animate-farm-rise mt-6 max-w-xl text-[15px] leading-relaxed text-[var(--f-mid)] sm:text-lg"
              style={{ animationDelay: '0.28s' }}
            >
              ปลาหางนกยูงเกรดพรีเมียมจาก {FARM.name} คัดเองทุกตัวก่อนลงถุง
              ส่งพร้อมเลขพัสดุที่ตามได้เอง และถ้าปลาตายระหว่างทาง เคลมได้จริง
            </p>

            <div
              className="animate-farm-rise mt-8 flex flex-wrap items-center gap-3"
              style={{ animationDelay: '0.4s' }}
            >
              <Button asChild size="lg" variant="line">
                <a href={contactHref} {...lineProps}>
                  <MessageCircle className="size-5" />
                  ทักไลน์สั่งปลา
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-[var(--f-deep)]/15 bg-white/70 text-[var(--f-deep)] hover:bg-white"
              >
                <a href="#breeds">
                  ดูสายพันธุ์ทั้งหมด
                  <ArrowRight className="size-4" />
                </a>
              </Button>
            </div>

            <ul
              className="animate-farm-rise mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--f-mid)]"
              style={{ animationDelay: '0.52s' }}
            >
              {[
                [ShieldCheck, 'ประกันปลาตายระหว่างส่ง'],
                [Bell, 'แจ้งเลขพัสดุอัตโนมัติ'],
                [Receipt, 'มีใบสรุปทุกบิล'],
              ].map(([Icon, label]) => {
                const I = Icon as typeof ShieldCheck;
                return (
                  <li key={label as string} className="inline-flex items-center gap-1.5">
                    <I className="size-4 text-[var(--f-coral)]" />
                    {label as string}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <WaterEdge className="-mb-px text-[var(--f-ground)]" />
      </section>

      {/* ══ สายพันธุ์ ══════════════════════════════════════════ */}
      <section id="breeds" className="scroll-mt-16">
        <div className="mx-auto max-w-6xl px-4 pt-12 sm:pt-16">
          <Reveal className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div>
              <Eyebrow>สายพันธุ์ทั้งหมด</Eyebrow>
              <h2 className="farm-display mt-3 text-3xl text-[var(--f-deep)] sm:text-[2.5rem]">
                เลือกตัวที่ถูกใจ แล้วบอกชื่อมาได้เลย
              </h2>
            </div>
            <p className="farm-mono text-sm text-[var(--f-mid)]">
              {loading ? '…' : `${breeds.length} สายพันธุ์`}
            </p>
          </Reveal>

          <Reveal delay={80}>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--f-mid)]">
              ราคาด้านล่างเป็นราคาปลาเกรดพรีเมียมที่คัดแล้ว
              {cheapest ? ` เริ่มต้นตัวละ ${baht(cheapest)}` : ''} ยังไม่รวมค่าส่ง
              กดที่ตู้ไหนก็ได้เพื่อดูราคาทุกแบบของพันธุ์นั้น
            </p>
          </Reveal>

          {usingSample && !loading && (
            <div className="mt-6 rounded-lg border border-[var(--f-tag-edge)] bg-[var(--f-tag)] px-4 py-3 text-sm text-[var(--f-deep)]">
              <strong className="font-medium">กำลังแสดงข้อมูลตัวอย่าง</strong> — ยังอ่านสายพันธุ์จริงจาก
              ฐานข้อมูลไม่ได้ รัน migration{' '}
              <code className="farm-mono text-xs">20260904200000_public_showcase</code> ก่อน
              หน้านี้จะดึงของจริงมาแสดงเอง
            </div>
          )}
        </div>

        {/* แถบกรองเกาะอยู่ใต้แถบบน — ปลาเป็นสิบ ๆ พันธุ์ ถ้าตัวกรองเลื่อนหายไปกับหัวข้อ
            ลูกค้าต้องเลื่อนกลับขึ้นไปทุกครั้งที่อยากเปลี่ยนสี */}
        <div
          className="sticky z-30 mt-6 border-y border-[var(--f-line)] bg-[var(--f-ground)]/92 backdrop-blur-md"
          style={{ top: 'calc(4rem + env(safe-area-inset-top))' }}
        >
          <div className="mx-auto max-w-6xl px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div ref={searchRef} className="lg:w-64 lg:shrink-0">
                <SearchInput
                  value={query}
                  onChange={(v) => withViewTransition(() => setQuery(v))}
                  placeholder="ค้นชื่อพันธุ์ — กด /"
                />
              </div>

              {/* ชิปสีเลื่อนแนวนอนบนมือถือ ไม่ตัดบรรทัดจนแถบสูงครึ่งจอ */}
              <div
                className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-1 lg:px-0"
                style={{
                  // จางที่ขอบขวาเพื่อบอกว่ายังมีชิปต่ออีก — ชิปที่ถูกตัดครึ่งพอดีขอบ
                  // ดูเหมือนจอเรนเดอร์พลาด ไม่ได้ดูเหมือนของที่เลื่อนได้
                  maskImage: 'linear-gradient(90deg, #000 0, #000 calc(100% - 2rem), transparent)',
                }}
              >
                <button
                  type="button"
                  onClick={() => withViewTransition(() => setFamily(null))}
                  aria-pressed={family === null}
                  className={cn(
                    'farm-mono shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors',
                    family === null
                      ? 'border-[var(--f-deep)] bg-[var(--f-deep)] text-white'
                      : 'border-[var(--f-line)] bg-white text-[var(--f-mid)] hover:border-[var(--f-soft)]'
                  )}
                >
                  ทั้งหมด
                </button>
                {chips.map((f) => {
                  const active = family === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => withViewTransition(() => setFamily(active ? null : f.key))}
                      aria-pressed={active}
                      className={cn(
                        'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors',
                        active
                          ? 'border-[var(--f-deep)] bg-[var(--f-deep)] text-white'
                          : 'border-[var(--f-line)] bg-white text-[var(--f-mid)] hover:border-[var(--f-soft)]'
                      )}
                    >
                      {/* จุดสีคือสีที่ใช้วาดปลาพันธุ์กลุ่มนั้นจริง ๆ ไม่ใช่สีที่เลือกมาให้สวย */}
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                        style={{ background: familyDot(f.key) }}
                      />
                      {f.label}
                      <span className={cn('farm-mono', active ? 'text-white/60' : 'text-[var(--f-soft)]')}>
                        {familyCounts.get(f.key)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {/* กรองเฉพาะที่สั่งได้ — ไม่เปิดค้างไว้ตั้งแต่แรกเพราะพันธุ์ที่หมดก็ยัง
                    มีค่าให้ดู ลูกค้าจำชื่อไว้ถามรอบหน้าได้ */}
                <button
                  type="button"
                  onClick={() => withViewTransition(() => setOnlyAvailable((v) => !v))}
                  aria-pressed={onlyAvailable}
                  className={cn(
                    'h-8 shrink-0 rounded-lg border px-2.5 text-xs font-medium transition-colors',
                    onlyAvailable
                      ? 'border-transparent bg-[var(--f-water-2)] text-[var(--f-deep)]'
                      : 'border-[var(--f-line)] bg-white text-[var(--f-soft)] hover:text-[var(--f-mid)]'
                  )}
                >
                  มีขายอยู่
                </button>

                {/* หน่วยราคา — ใช้ปุ่มสามอันแทน dropdown เพราะสลับบ่อยกว่าการเรียง */}
                <div
                  role="group"
                  aria-label="หน่วยราคา"
                  className="inline-flex rounded-lg border border-[var(--f-line)] bg-white p-0.5"
                >
                  {UNITS.map((u) => (
                    <button
                      key={u.key}
                      type="button"
                      onClick={() => setUnit(u.key)}
                      aria-pressed={unit === u.key}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                        unit === u.key
                          ? 'bg-[var(--f-water)] text-[var(--f-deep)]'
                          : 'text-[var(--f-soft)] hover:text-[var(--f-mid)]'
                      )}
                    >
                      /{u.label}
                    </button>
                  ))}
                </div>

                <label className="sr-only" htmlFor="farm-sort">
                  เรียงลำดับ
                </label>
                <select
                  id="farm-sort"
                  value={sort}
                  onChange={(e) => withViewTransition(() => setSort(e.target.value as SortKey))}
                  className="h-8 rounded-lg border border-[var(--f-line)] bg-white px-2 text-xs text-[var(--f-mid)] outline-none focus-visible:border-[var(--f-soft)]"
                >
                  <option value="name">เรียงตามชื่อ</option>
                  <option value="price-asc">ราคาน้อยไปมาก</option>
                  <option value="price-desc">ราคามากไปน้อย</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-16 sm:pb-24">
          <div className="flex h-8 items-center justify-between pt-4">
            <p className="farm-mono text-xs text-[var(--f-soft)]">
              {loading
                ? 'กำลังโหลด…'
                : isFiltered
                  ? `แสดง ${filtered.length} จาก ${breeds.length}`
                  : availableCount < breeds.length
                    ? `ทั้งหมด ${breeds.length} พันธุ์ · สั่งได้ตอนนี้ ${availableCount}`
                    : `ทั้งหมด ${breeds.length} พันธุ์`}
            </p>
            {isFiltered && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs text-[var(--f-mid)] underline-offset-4 hover:underline"
              >
                <X className="size-3.5" />
                ล้างตัวกรอง
              </button>
            )}
          </div>

          {loading ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-72 animate-pulse rounded-[1.25rem] bg-[var(--f-water)]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-[var(--f-line)] py-14 text-center">
              <Fish className="mx-auto size-9 text-[var(--f-soft)]" />
              <p className="mt-3 text-[var(--f-mid)]">ไม่มีพันธุ์ที่ตรงกับที่กรองไว้</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>
                ล้างตัวกรอง
              </Button>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {filtered.map((breed, i) => (
                <BreedTank
                  key={breed.id}
                  breed={breed}
                  unit={unit}
                  onOpen={() => setPicked(breed)}
                  // ตั้งชื่อให้เฉพาะการ์ดชุดแรก — ตอนกรองจาก 57 เหลือ 6 เบราว์เซอร์ต้อง
                  // ถ่ายภาพทุกชิ้นที่มีชื่อ ให้ครบทั้งกริดแล้วเครื่องช้า ๆ จะกระตุกตอนกรอง
                  transitionName={i < 24 ? `tank-${breed.id}` : undefined}
                />
              ))}
            </div>
          )}

          {/* ปลาไม่มีรูปถ่ายจริง — บอกไว้ตรง ๆ ดีกว่าให้ลูกค้าคิดว่ารูปนี้คือตัวที่จะได้ */}
          {!loading && filtered.some((b) => !b.image_url) && (
            <p className="mt-8 text-center text-xs text-[var(--f-soft)]">
              ภาพปลาบางพันธุ์เป็นภาพวาดประกอบสีตามสายพันธุ์ ไม่ใช่ภาพถ่ายตัวจริง —
              ขอดูรูปและวิดีโอตัวจริงก่อนโอนได้ทุกครั้ง
            </p>
          )}
        </div>
      </section>

      {/* ══ ความมั่นใจ ═════════════════════════════════════════
          หัวข้อค้างอยู่ทางซ้ายขณะที่รายการเลื่อนผ่านทางขวา
          จงใจไม่ทำเป็นกริดการ์ดสี่ใบเหมือนหัวข้ออื่น — คำถามนี้เป็นคำถามเดียว
          ที่ค้างอยู่ในหัวลูกค้าตลอดทั้งหน้า หัวข้อจึงควรค้างอยู่ตรงหน้าเขาด้วย */}
      <section id="trust" className="scroll-mt-16 bg-[var(--f-deep)] text-white">
        <div className="mx-auto max-w-6xl gap-12 px-4 py-16 sm:py-24 lg:flex lg:items-start">
          <Reveal className="lg:sticky lg:top-28 lg:w-[38%] lg:shrink-0">
            <Eyebrow tone="dark">ความมั่นใจ</Eyebrow>
            <h2 className="farm-display mt-3 text-3xl leading-snug sm:text-[2.5rem]">
              โอนไปแล้ว
              <br />
              จะได้อะไรกลับมา
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/65">
              คำถามนี้คือเหตุผลเดียวที่คนไม่กล้าซื้อปลาออนไลน์
              ทางร้านเลยทำระบบไว้ให้ตรวจสอบได้ทุกขั้น ไม่ต้องเชื่อคำพูดอย่างเดียว
            </p>
          </Reveal>

          <ul className="mt-10 flex-1 lg:mt-0">
            {GUARANTEES.map((item, i) => (
              <Reveal as="li" key={item.title} delay={i * 60}>
                <div
                  className={cn(
                    'flex gap-4 py-6 sm:gap-6',
                    i > 0 && 'border-t border-white/12'
                  )}
                >
                  <item.icon className="mt-0.5 size-6 shrink-0 text-[var(--f-water-2)]" />
                  <div>
                    <h3 className="text-lg font-medium">{item.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-white/60">{item.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ══ วิธีสั่ง ════════════════════════════════════════════
          ตรงนี้เป็นลำดับจริง ทำก่อนทำหลังสลับกันไม่ได้ เลขกำกับจึงมีความหมาย
          (ต่างจากหัวข้อความมั่นใจข้างบนที่สี่ข้ออ่านข้ามกันได้ ไม่ควรใส่เลข) */}
      <section id="order" className="scroll-mt-16">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <Reveal className="max-w-2xl">
            <Eyebrow>วิธีสั่ง</Eyebrow>
            <h2 className="farm-display mt-3 text-3xl text-[var(--f-deep)] sm:text-[2.5rem]">
              สี่ขั้น จบในไลน์
            </h2>
          </Reveal>

          <ol className="relative mt-12 grid gap-8 md:grid-cols-4 md:gap-6">
            {/* เส้นเชื่อมสี่ขั้น — เห็นว่ามันคือทางเดียวที่เดินต่อกัน ไม่ใช่สี่กล่องที่บังเอิญวางเรียงกัน */}
            <div
              aria-hidden
              className="absolute top-4 right-0 left-0 hidden h-px bg-[var(--f-line)] md:block"
            />
            {ORDER_STEPS.map((step, i) => (
              <Reveal as="li" key={step.title} delay={i * 90} className="relative">
                <span className="farm-mono relative z-10 block bg-[var(--f-ground)] pr-3 text-3xl leading-none font-semibold text-[var(--f-water-2)] md:inline-block">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-4 text-[17px] font-medium text-[var(--f-deep)]">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--f-mid)]">{step.body}</p>
              </Reveal>
            ))}
          </ol>

          <Reveal delay={200}>
            <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl border border-[var(--f-line)] bg-[var(--f-water)]/45 p-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[15px] leading-relaxed">
                <strong className="font-medium text-[var(--f-deep)]">ยังเลือกไม่ถูก?</strong>{' '}
                <span className="text-[var(--f-mid)]">
                  บอกขนาดตู้กับงบที่มี ทางร้านช่วยจัดชุดที่เลี้ยงรวมกันได้ให้
                </span>
              </p>
              <Button asChild variant="line" className="shrink-0">
                <a href={contactHref} {...lineProps}>
                  <MessageCircle className="size-4" />
                  ทักไปคุยกันก่อน
                </a>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ วิธีรับปลา ═════════════════════════════════════════ */}
      <section id="care" className="scroll-mt-16 border-y border-[var(--f-line)] bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
          <Reveal>
            <Eyebrow>วิธีรับปลา</Eyebrow>
            <h2 className="farm-display mt-3 text-3xl text-[var(--f-deep)] sm:text-[2.5rem]">
              พัสดุถึงแล้ว อย่าเพิ่งเทลงตู้
            </h2>
            <p className="mt-4 leading-relaxed text-[var(--f-mid)]">
              ปลาที่ตายหลังถึงบ้านส่วนใหญ่ไม่ได้ตายเพราะไม่แข็งแรง แต่เพราะเจอน้ำใหม่เร็วเกินไป
              ทำตามนี้ประมาณหนึ่งชั่วโมง แล้วปลาจะปรับตัวได้เอง
            </p>
          </Reveal>

          <ol
            ref={careRef}
            className="care-track relative mt-12 border-l-2 border-[var(--f-line)] pl-8 sm:pl-10"
          >
            {ACCLIMATION.map((step, i) => (
              <Reveal as="li" key={step.title} delay={i * 60} className="relative pb-10 last:pb-0">
                <span className="absolute top-1 -left-[2.55rem] flex size-8 items-center justify-center rounded-full border border-[var(--f-line)] bg-white text-[var(--f-mid)] sm:-left-[3.05rem]">
                  <step.icon className="size-4" />
                </span>
                <p className="farm-mono text-xs text-[var(--f-coral)]">{step.time}</p>
                <h3 className="mt-1.5 text-[17px] font-medium text-[var(--f-deep)]">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-[var(--f-mid)]">{step.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ══ คำถามที่พบบ่อย ═════════════════════════════════════ */}
      <section id="faq" className="scroll-mt-16">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
          <Reveal>
            <Eyebrow>คำถามที่พบบ่อย</Eyebrow>
            <h2 className="farm-display mt-3 text-3xl text-[var(--f-deep)] sm:text-[2.5rem]">
              เรื่องที่ลูกค้าถามมาบ่อยที่สุด
            </h2>
          </Reveal>

          <div className="mt-10">
            {FAQ.map((item, i) => (
              <Reveal key={item.q} delay={i * 40}>
                <details className="group border-t border-[var(--f-line)] last:border-b [&_summary]:list-none">
                  <summary className="flex cursor-pointer items-start justify-between gap-6 py-5">
                    <span className="farm-display text-[17px] leading-snug text-[var(--f-deep)] sm:text-xl">
                      {item.q}
                    </span>
                    <span className="mt-1 shrink-0 text-[var(--f-soft)] transition-transform duration-300 group-open:rotate-45">
                      <svg viewBox="0 0 16 16" className="size-5" aria-hidden>
                        <path
                          d="M8 3v10M3 8h10"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  </summary>
                  <p className="max-w-2xl pb-6 leading-relaxed text-[var(--f-mid)]">{item.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ ติดต่อ ═════════════════════════════════════════════ */}
      <section id="contact" className="scroll-mt-16 bg-[var(--f-deep)] text-white">
        <WaterEdge flip className="-mt-px rotate-180 text-[var(--f-ground)]" />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:py-20">
          <Reveal>
            <img
              src="/logo.png"
              alt=""
              aria-hidden
              width={80}
              height={80}
              className="mx-auto size-20 rounded-full bg-white/90 object-contain p-1"
            />
            <h2 className="farm-display mt-6 text-3xl sm:text-4xl">พร้อมจัดปลาให้แล้ว</h2>
            <p className="mt-4 leading-relaxed text-white/65">
              ตอบแชท {FARM.hours}
              <br className="sm:hidden" />
              <span className="hidden sm:inline"> · </span>
              แพ็คส่ง {FARM.shipDays}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {FARM.lineUrl ? (
                <Button asChild size="lg" variant="line">
                  <a href={FARM.lineUrl} target="_blank" rel="noreferrer">
                    <MessageCircle className="size-5" />
                    แอดไลน์ร้าน
                  </a>
                </Button>
              ) : (
                // ไม่มีลิงก์จริงก็ไม่ปั้นปุ่มปลอมขึ้นมา บอกไปตรง ๆ ว่ายังไม่ได้ใส่
                <p className="rounded-lg bg-white/10 px-4 py-3 text-sm text-white/70">
                  ยังไม่ได้ใส่ลิงก์ไลน์ร้าน — เพิ่มได้ที่{' '}
                  <code className="farm-mono text-xs">src/config/farm.ts</code>
                </p>
              )}
              {FARM.tiktokUrl && (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <a href={FARM.tiktokUrl} target="_blank" rel="noreferrer">
                    ดูไลฟ์ที่ TikTok
                  </a>
                </Button>
              )}
              {FARM.facebookUrl && (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <a href={FARM.facebookUrl} target="_blank" rel="noreferrer">
                    เพจเฟซบุ๊ก
                  </a>
                </Button>
              )}
            </div>
          </Reveal>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-white/45 sm:flex-row">
            <p>
              © {new Date().getFullYear() + 543} {FARM.name} · {FARM.tagline}
            </p>
            {stats.orders > 0 && (
              <p className="farm-mono">
                ส่งไปแล้ว {stats.orders.toLocaleString('th-TH')} บิล ·{' '}
                {stats.fish.toLocaleString('th-TH')} ตัว
              </p>
            )}
          </div>
        </div>
        {/* เว้นที่ให้ปุ่มลอยบนมือถือ ไม่งั้นมันทับบรรทัดท้ายสุด */}
        <div className="h-20 sm:hidden" />
      </section>

      {/* ══ ปุ่มลอยบนมือถือ ════════════════════════════════════ */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-[var(--f-line)] bg-[var(--f-ground)]/92 p-3 backdrop-blur-md sm:hidden">
        <Button asChild size="lg" variant="line" className="w-full">
          <a href={contactHref} {...lineProps}>
            <MessageCircle className="size-5" />
            ทักไลน์สั่งปลา
          </a>
        </Button>
      </div>

      {/* ══ รายละเอียดสายพันธุ์ ════════════════════════════════
          มือถือเด้งขึ้นจากขอบล่าง จอคอมพ์สไลด์เข้ามาจากขวา — ตัวเดียวกับที่ใช้ทั้งแอป */}
      <ResponsiveModal open={!!picked} onOpenChange={(v) => !v && setPicked(null)}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle className="farm-mono">{picked?.name}</ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <ResponsiveModalBody>
            {picked && (
              <>
                <div className="tank-water overflow-hidden rounded-2xl">
                  {picked.image_url ? (
                    <img
                      src={picked.image_url}
                      alt={`ปลาหางนกยูงพันธุ์ ${picked.name}`}
                      className="aspect-[5/3] w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-[5/3] w-full p-4">
                      <GuppyArt name={picked.name} />
                    </div>
                  )}
                </div>

                {isSoldOut(picked) && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--f-tag-edge)] bg-[var(--f-tag)] px-3.5 py-3">
                    <Bell className="mt-0.5 size-4 shrink-0 text-[var(--f-coral)]" />
                    <p className="text-sm leading-relaxed text-[var(--f-deep)]">
                      พันธุ์นี้หมดชั่วคราว ยังสั่งไม่ได้ตอนนี้ —
                      ทักไลน์ไว้ได้ ทางร้านจะบอกได้ว่ารอบหน้าประมาณเมื่อไหร่มี
                    </p>
                  </div>
                )}

                {picked.blurb && (
                  <p className="mt-4 leading-relaxed text-[var(--f-mid)]">{picked.blurb}</p>
                )}

                <div className="mt-5 overflow-hidden rounded-xl border border-[var(--f-line)]">
                  {UNITS.map((u, i) => {
                    const p = priceOf(picked, u.key);
                    return (
                      <div
                        key={u.key}
                        className={cn(
                          'flex items-center justify-between px-4 py-3',
                          i > 0 && 'border-t border-[var(--f-line)]'
                        )}
                      >
                        <span className="text-sm text-[var(--f-mid)]">
                          ราคาต่อ{u.label}
                          {u.key === 'set' && (
                            <span className="ml-1.5 text-xs text-[var(--f-soft)]">
                              (ผู้ 1 เมีย 2)
                            </span>
                          )}
                        </span>
                        <span className="farm-mono font-semibold text-[var(--f-deep)]">
                          {p ? baht(p) : <span className="text-sm font-normal text-[var(--f-soft)]">ทักมาถาม</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p className="mt-4 text-xs leading-relaxed text-[var(--f-soft)]">
                  ราคายังไม่รวมค่าส่ง · ลายและเฉดสีของแต่ละตัวไม่ซ้ำกันเป๊ะ
                  ขอดูวิดีโอตัวจริงก่อนโอนได้เสมอ
                </p>
              </>
            )}
          </ResponsiveModalBody>

          <ResponsiveModalFooter className="flex gap-2">
            <Button
              variant="outline"
              className="shrink-0"
              onClick={async () => {
                if (!picked) return;
                try {
                  await navigator.clipboard.writeText(picked.name);
                  toast.success('คัดลอกชื่อพันธุ์แล้ว');
                } catch {
                  // เบราว์เซอร์บางตัวบล็อกคลิปบอร์ดเมื่อไม่ได้เปิดผ่าน https
                  toast.error('คัดลอกไม่สำเร็จ กดค้างที่ชื่อเพื่อคัดลอกเองได้');
                }
              }}
            >
              <Copy className="size-4" />
              คัดลอกชื่อ
            </Button>
            <Button asChild variant="line" className="flex-1">
              <a href={contactHref} {...lineProps}>
                <MessageCircle className="size-4" />
                {picked && isSoldOut(picked) ? 'ทักไลน์ถามรอบหน้า' : 'ทักไลน์ถามพันธุ์นี้'}
              </a>
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}
