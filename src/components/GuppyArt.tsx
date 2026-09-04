import { useId, useMemo } from 'react';

import { cn } from '@/lib/utils';

// ปลาหางนกยูงวาดด้วย SVG — ใช้แทนรูปถ่ายที่ยังไม่มี
//
// ร้านยังไม่ได้ถ่ายรูปปลาทุกพันธุ์ และหน้าเว็บโชว์ปลาที่ไม่มีรูปเลยก็ขายไม่ได้
// แทนที่จะรอรูปครบค่อยเปิดเว็บ ก็วาดปลาให้เองจากชื่อพันธุ์ไปก่อน
//
// เงื่อนไขที่ทำให้มันไม่ดูเป็นของขัดตาเวลาแทนรูปจริง:
//   * พันธุ์เดิมต้องได้สีเดิมทุกครั้ง — สุ่มใหม่ทุกรอบเรนเดอร์คือปลาเปลี่ยนสีตอนเลื่อนจอ
//   * ชื่อพันธุ์ที่บอกสีอยู่แล้ว (Full Red, Blue Grass) ต้องได้สีตามชื่อ ไม่ใช่สีมั่ว
//   * พอมี image_url จริงเมื่อไหร่ ให้รูปจริงชนะทันที ตัวนี้เป็นแค่ตัวสำรอง

interface Palette {
  /** ลำตัว: เข้ม → อ่อน */
  body: [string, string];
  /** หาง: ไล่ 3 จุด ให้เห็นเหลือบแบบหางนกยูงจริง */
  tail: [string, string, string];
  /** จุด/ลายบนลำตัว */
  fleck: string;
}

// จานสีคัดไว้เอง ไม่ปล่อยให้ hash สุ่ม hue ทั้งวง
// สุ่มดิบ ๆ แล้วจะได้สีเขียวขี้ม้าหรือน้ำตาลโคลนปนมาด้วย ซึ่งไม่มีในปลาจริง
const PALETTES: Record<string, Palette> = {
  blue:    { body: ['#12397f', '#4f9ae8'], tail: ['#0e2f6e', '#2f7fd6', '#57c2f0'], fleck: '#cdeaff' },
  purple:  { body: ['#3d1878', '#8f56d4'], tail: ['#331269', '#7a3fc4', '#b478ee'], fleck: '#ecd9ff' },
  red:     { body: ['#7d0f18', '#e0402f'], tail: ['#6b0c15', '#c92a20', '#f2603f'], fleck: '#ffd9c9' },
  orange:  { body: ['#8f3508', '#f0842a'], tail: ['#7a2c05', '#dd6a16', '#ffa63d'], fleck: '#ffe3bb' },
  gold:    { body: ['#8a6205', '#e8bb3a'], tail: ['#7a5504', '#d3a11c', '#ffd95c'], fleck: '#fff2c4' },
  green:   { body: ['#0f5232', '#3bb87a'], tail: ['#0c4529', '#289a66', '#57d19a'], fleck: '#cdf5e2' },
  teal:    { body: ['#084a52', '#2ea3b0'], tail: ['#063e45', '#1f8f9d', '#4cc4d2'], fleck: '#c8f0f5' },
  magenta: { body: ['#750f4a', '#d94793'], tail: ['#630c3e', '#bf3579', '#f070ad'], fleck: '#ffd4e8' },
  koi:     { body: ['#d93b1c', '#fdfdfd'], tail: ['#c23517', '#ef6a3a', '#f9a882'], fleck: '#fff4ee' },
  tuxedo:  { body: ['#111827', '#5b6675'], tail: ['#0b1220', '#3b4553', '#8b95a3'], fleck: '#e2e8f0' },
  moscow:  { body: ['#14224a', '#4462a6'], tail: ['#101c3f', '#33528f', '#7594d0'], fleck: '#d3e0f7' },
};
// คำที่เจอในชื่อพันธุ์ → จานสี
// ไทยกับอังกฤษปนกันในชื่อจริงอยู่แล้ว จับทั้งสองภาษา
//
// ลำดับสำคัญ: คำที่ระบุ "ลาย" อย่าง koi/tuxedo มาก่อนคำสี เพราะมันกำหนดทั้งตัว
// แต่ albino ไม่อยู่ในลิสต์นี้ — มันเป็นตัวปรับ ไม่ใช่สี
// "Full Red Albino" คือปลาแดงที่ตาแดง ไม่ใช่ปลาสีครีม ถ้าเอา albino มาชนะคำว่า red
// ปลาที่ขายดีที่สุดของร้านจะกลายเป็นก้อนครีมจืด ๆ บนหน้าเว็บ
const KEYWORDS: Array<[RegExp, keyof typeof PALETTES]> = [
  [/koi|โคย|โคอิ/i, 'koi'],
  [/tuxedo|ทักซิโด|ทักซิโด้/i, 'tuxedo'],
  [/moscow|มอสโคว|มอสโก/i, 'moscow'],
  [/blue|บลู|ฟ้า|น้ำเงิน/i, 'blue'],
  [/purple|violet|ม่วง/i, 'purple'],
  [/red|แดง/i, 'red'],
  [/orange|ส้ม/i, 'orange'],
  [/gold|yellow|ทอง|เหลือง/i, 'gold'],
  [/green|เขียว/i, 'green'],
  [/turquoise|teal|cyan|เทอร์ควอยซ์/i, 'teal'],
  [/magenta|pink|ชมพู|บานเย็น/i, 'magenta'],
];

/** อัลบิโนคือ "ไม่มีเม็ดสีดำ" ไม่ใช่สีหนึ่ง — สีเดิมจางลงและตาเป็นสีแดง */
const ALBINO = /albino|อัลบิโน|เผือก/i;

const FALLBACK_ORDER = Object.keys(PALETTES) as Array<keyof typeof PALETTES>;

/** กลุ่มสีที่ลูกค้าใช้เรียกจริงเวลาถามหาปลา เรียงจากที่ร้านมีเยอะไปน้อยโดยประมาณ
 *
 *  ตัวกรองบนหน้าเว็บใช้ลิสต์นี้ ไม่ได้ตั้งกลุ่มสีขึ้นมาใหม่แยกต่างหาก —
 *  สีที่ใช้กรองกับสีที่วาดปลาจึงเป็นชุดเดียวกันเสมอ ไม่มีทางเพี้ยนออกจากกัน
 */
export const FAMILIES: Array<{ key: keyof typeof PALETTES; label: string }> = [
  { key: 'red', label: 'แดง' },
  { key: 'blue', label: 'ฟ้า' },
  { key: 'moscow', label: 'น้ำเงินเข้ม' },
  { key: 'koi', label: 'โคย ขาวแดง' },
  { key: 'gold', label: 'ทอง เหลือง' },
  { key: 'purple', label: 'ม่วง' },
  { key: 'magenta', label: 'ชมพู' },
  { key: 'green', label: 'เขียว' },
  { key: 'teal', label: 'เขียวน้ำทะเล' },
  { key: 'orange', label: 'ส้ม' },
  { key: 'tuxedo', label: 'ดำ ทักซิโด' },
];

/** สีจุดของชิปตัวกรอง — หยิบสีกลางของหาง ซึ่งเป็นสีที่ตาเห็นเด่นที่สุดในภาพ */
export function familyDot(key: keyof typeof PALETTES): string {
  return PALETTES[key].tail[1];
}

/** hash แบบ FNV-1a — สั้น เร็ว และให้ผลเดิมทุกเครื่อง */
function hashName(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** กลุ่มสีของพันธุ์นี้ — ทั้งภาพวาดและตัวกรองเรียกฟังก์ชันนี้ตัวเดียวกัน */
export function familyOf(name: string): keyof typeof PALETTES {
  // คำที่อยู่ท้ายชื่อชนะ ไม่ใช่คำแรกที่เจอ
  //
  // ชื่อสายพันธุ์เขียนแบบ "ขยาย + ตัวหลัก" คำที่บอกสีจริงมักอยู่ท้าย
  //   "Koi blue"    → ฟ้า  (ไม่ใช่โคยขาวแดง)
  //   "Albino koi"  → โคย
  //   "Blue Grass"  → ฟ้า
  // ถ้าเอาคำแรกที่ match ชนะ ปลาชื่อ "Koi blue" จะออกมาเป็นขาวแดงซึ่งผิดจากตัวจริง
  let best: { key: keyof typeof PALETTES; at: number } | null = null;
  for (const [pattern, key] of KEYWORDS) {
    const at = name.search(pattern);
    if (at >= 0 && (!best || at > best.at)) best = { key, at };
  }
  if (best) return best.key;

  // ชื่อที่ไม่บอกสี ก็ให้ hash เลือกให้ — ขอแค่พันธุ์เดิมได้สีเดิมทุกครั้ง
  return FALLBACK_ORDER[hashName(name) % FALLBACK_ORDER.length];
}

/** ทรงหางที่หางนกยูงมีจริง — เดลต้า/ม่าน, กลม, และใบพาย
 *
 *  ในกลุ่มสีเดียวกันร้านมีปลาห้าหกพันธุ์ ถ้าวาดทรงเดียวกันหมดแล้วต่างแค่สี
 *  ลูกค้าจะแยกไม่ออกว่าพันธุ์ไหนเป็นพันธุ์ไหน ซึ่งทำให้แคตตาล็อกไม่ทำงาน */
const TAILS = {
  veil: 'M110 53 C132 47 148 29 166 16 C184 4 193 13 189 34 C185 53 183 66 189 85 C193 106 184 115 166 104 C148 91 132 72 110 67 Z',
  round: 'M110 54 C130 46 150 34 170 32 C190 30 198 44 198 60 C198 76 190 90 170 88 C150 86 130 74 110 66 Z',
  spade: 'M110 54 C134 50 158 42 180 30 C193 23 197 34 194 54 C193 58 193 62 194 66 C197 86 193 97 180 90 C158 78 134 70 110 66 Z',
} as const;

const TAIL_KEYS = ['veil', 'round', 'spade'] as const;

/** ดัมโบ้ = ครีบอกใหญ่เหมือนหูช้าง เป็นลักษณะที่คนซื้อมองหาเป็นอย่างแรก */
const DUMBO = /dumbo|ดัมโบ|หูช้าง/i;

/** องศาเอียงของป้ายชื่อ ±1.4 องศา — ผูกกับชื่อ ป้ายใบเดิมจึงเอียงเท่าเดิมทุกครั้ง */
export function tagTiltOf(name: string): string {
  return `${((hashName(name) % 29) / 10 - 1.4).toFixed(2)}deg`;
}


/** ขยับเฉดและความอิ่มของสีหนึ่งค่า
 *
 *  ทำตอนสร้างสีแทนที่จะใส่ CSS filter ให้ทั้งตัวปลา เพราะหน้าแคตตาล็อกวาดปลา
 *  หกสิบกว่าตัวพร้อมกัน — filter หกสิบชั้นแปลว่าเบราว์เซอร์ต้องแรสเตอร์แยกทีละตัว
 *  ซึ่งเห็นผลชัดมากตอนกรองบนมือถือ อีกอย่างคือ filter จะไปโดนตาปลาด้วย
 *  ทั้งที่ตาไม่ควรเปลี่ยนสีตามพันธุ์
 */
function shift(hex: string, deg: number, satMul: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  let h = 0;
  let sat = 0;
  if (d) {
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }

  h = (h + deg + 360) % 360;
  sat = Math.min(1, Math.max(0, sat * satMul));

  const c = (1 - Math.abs(2 * l - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r2, g2, b2] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];

  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r2)}${to(g2)}${to(b2)}`;
}

interface GuppyArtProps {
  /** ชื่อสายพันธุ์ — เป็นทั้งตัวกำหนดสีและคำอธิบายภาพ */
  name: string;
  className?: string;
  /** ปลาตัวผู้หางใหญ่กว่าตัวเมียชัดเจน ใช้สลับทรงตอนโชว์คู่ */
  variant?: 'male' | 'female';
}

export default function GuppyArt({ name, className, variant = 'male' }: GuppyArtProps) {
  // id ของ gradient ต้องไม่ซ้ำกันในหน้าเดียว ไม่งั้นปลาทุกตัวไปดูดสีของตัวแรก
  const uid = useId().replace(/:/g, '');
  const seed = useMemo(() => hashName(name), [name]);
  const albino = useMemo(() => ALBINO.test(name), [name]);
  const dumbo = useMemo(() => DUMBO.test(name), [name]);

  // ทรงหางเลือกจาก hash — พันธุ์ในกลุ่มสีเดียวกันจะได้ไม่ออกมาเป็นปลาตัวเดียวกันซ้ำ ๆ
  // ต้องเป็น >>> ไม่ใช่ >> — hash เป็น uint32 ส่วน >> ตีความบิตบนสุดเป็นเครื่องหมาย
  // เลื่อนแล้วได้ค่าลบ ดัชนีหลุดอาเรย์ แล้วหางหายไปเงียบ ๆ โดยไม่มี error ให้เห็น
  const tailKey = TAIL_KEYS[(seed >>> 11) % TAIL_KEYS.length] ?? 'veil';

  // เพี้ยนเฉดทีละนิดรายพันธุ์ เพื่อให้ปลาในกลุ่มสีเดียวกันวางเรียงกันแล้วยังแยกออก
  //
  // แต่บางกลุ่มห้ามหมุนเฉด เพราะ "สี" คือตัวชื่อพันธุ์เอง — โคยต้องขาวแดง
  // ทักซิโดต้องดำเงิน หมุนไปแค่สิบองศาโคยก็กลายเป็นปลาสีชมพูซึ่งไม่มีอยู่จริง
  // กลุ่มพวกนี้ให้ต่างกันด้วยความอิ่มสีกับทรงหางแทน
  const family = useMemo(() => familyOf(name), [name]);
  const palette = useMemo(() => {
    const base = PALETTES[family];
    // บางกลุ่มห้ามหมุนเฉด เพราะ "สี" คือตัวชื่อพันธุ์เอง — โคยต้องขาวแดง
    // ทักซิโดต้องดำเงิน หมุนไปแค่สิบองศาโคยก็กลายเป็นปลาสีชมพูซึ่งไม่มีอยู่จริง
    // กลุ่มพวกนี้ให้ต่างกันด้วยความอิ่มสีกับทรงหางแทน
    const fixedHue = family === 'koi' || family === 'tuxedo';
    const deg = fixedHue ? 0 : ((seed >>> 17) % 23) - 11;
    const mul = 0.92 + ((seed >>> 21) % 17) / 100;

    return {
      body: base.body.map((c) => shift(c, deg, mul)) as [string, string],
      tail: base.tail.map((c) => shift(c, deg, mul)) as [string, string, string],
      fleck: base.fleck,
    };
  }, [family, seed]);

  const female = variant === 'female';
  // ตัวเมียหางเล็กและสั้นกว่าตัวผู้มาก ใช้ทรงเดียวไปเลย ไม่ต้องสุ่ม
  const tailPath = female
    ? 'M110 54 C130 50 144 40 157 32 C170 24 176 32 173 46 C170 57 169 63 173 76 C176 90 170 96 157 88 C144 80 130 70 110 66 Z'
    : TAILS[tailKey];
  // ตัวเมียสีจางกว่าตัวผู้จริง ๆ ในธรรมชาติ และหางเล็กกว่ามาก
  const opacity = female ? 0.72 : 1;

  return (
    <svg
      viewBox="-6 -5 213 130"
      role="img"
      aria-label={`ภาพประกอบปลาหางนกยูงพันธุ์ ${name}`}
      className={cn('h-full w-full', className)}
    >
      <defs>
        <linearGradient id={`body-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.body[1]} />
          <stop offset="100%" stopColor={palette.body[0]} />
        </linearGradient>
        {/* หางไล่ตามแนวนอน โคนเข้ม ปลายสว่าง เหมือนแสงลอดผ่านครีบบาง ๆ */}
        <linearGradient id={`tail-${uid}`} x1="0.1" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%" stopColor={palette.tail[0]} />
          <stop offset="45%" stopColor={palette.tail[1]} />
          <stop offset="100%" stopColor={palette.tail[2]} />
        </linearGradient>
        <linearGradient id={`fin-${uid}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={palette.tail[2]} />
          <stop offset="100%" stopColor={palette.tail[1]} />
        </linearGradient>
        <clipPath id={`tailclip-${uid}`}>
          <path d={tailPath} />
        </clipPath>
        {/* อัลบิโนไม่มีเม็ดสีดำ ทับด้วยฝ้าขาวบาง ๆ แทนที่จะทำจานสีซ้ำอีกชุด */}
        <linearGradient id={`albino-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.18" />
        </linearGradient>
      </defs>

      <g opacity={opacity}>
        {/* หางกับก้านหางต้องอยู่กลุ่มเดียวกัน จะได้กระดิกไปด้วยกันตอนชี้ค้าง
            แยกกลุ่มเมื่อไหร่ ก้านหางจะค้างอยู่กับที่แล้วหลุดออกจากแผ่นหางทันที */}
        <g className="guppy-tail">
          {/* หาง — วาดก่อนลำตัวเพื่อให้โคนหางถูกลำตัวทับ ดูต่อเนื่องเป็นตัวเดียว */}
          <path
            d={tailPath}
            fill={`url(#tail-${uid})`}
            stroke={palette.body[0]}
            strokeOpacity="0.3"
            strokeWidth="1.2"
          />
          {/* ก้านหาง — หางนกยูงจริงเห็นเส้นก้านแผ่ออก ไม่ใช่แผ่นสีทึบแผ่นเดียว
              ตัดด้วยรูปหางเอง เส้นชุดเดียวจึงใช้ได้กับหางทุกทรงโดยไม่ทะลุออกนอกแผ่น
              และเริ่มเส้นห่างจากโคนหาง ไม่งั้นเส้นขาวห้าเส้นทับกันเป็นคราบคาดคอปลา */}
          <g
            clipPath={`url(#tailclip-${uid})`}
            stroke="#ffffff"
            strokeOpacity="0.32"
            strokeWidth="1.3"
            fill="none"
            strokeLinecap="round"
          >
            {(female
              ? ['M124 53 C138 46 152 40 170 32', 'M124 56 C140 52 156 49 172 46', 'M124 60 C142 60 158 60 175 60', 'M124 64 C140 68 156 71 172 74', 'M124 67 C138 74 152 80 170 88']
              : ['M128 52 C148 40 168 26 188 12', 'M128 55 C150 46 172 38 194 30', 'M128 60 C152 58 172 58 198 59', 'M128 65 C150 74 172 82 194 90', 'M128 68 C148 78 168 94 188 108']
            ).map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </g>

        {/* ครีบหลัง — เตี้ยและลู่ไปทางหาง ถ้าตั้งสูงและชี้ขึ้นจะกลายเป็นครีบฉลาม */}
        <path
          d={
            female
              ? 'M72 45 C80 34 90 29 100 28 C102 37 98 46 92 52 C84 49 77 46 72 45 Z'
              : 'M66 44 C77 29 91 21 105 19 C107 32 100 47 92 54 C82 50 73 46 66 44 Z'
          }
          fill={`url(#fin-${uid})`}
          opacity="0.92"
        />

        {/* ครีบก้น */}
        <path
          d="M80 78 C86 89 97 95 107 93 C109 84 105 76 100 72 C92 76 86 77 80 78 Z"
          fill={`url(#fin-${uid})`}
          opacity="0.72"
        />

        {/* ลำตัว
            เส้นขอบบาง ๆ ไม่ได้ใส่เพื่อความสวยอย่างเดียว — ปลาสีอ่อนอย่างอัลบิโนหรือแพลตินัม
            วางบนพื้นน้ำสีอ่อนแล้วรูปทรงหายไปทั้งตัว เหลือแค่คราบจาง ๆ บนการ์ด */}
        <path
          d="M28 60 C32 46 46 38 64 38 C86 38 104 48 116 56 C104 72 86 82 64 82 C46 82 32 74 28 60 Z"
          fill={`url(#body-${uid})`}
          stroke={palette.body[0]}
          strokeOpacity="0.25"
          strokeWidth="1.2"
        />

        {/* ลายจุด — ตำแหน่งผูกกับ hash ปลาต่างพันธุ์จะไม่ลายเหมือนกันเป๊ะ */}
        <g fill={palette.fleck} opacity="0.5">
          <circle cx={62 + (seed % 12)} cy={52 + (seed % 7)} r="3.2" />
          <circle cx={80 + ((seed >>> 4) % 14)} cy={62 + ((seed >>> 3) % 9)} r="2.4" />
          <circle cx={72 + ((seed >>> 8) % 10)} cy={70 - ((seed >>> 5) % 6)} r="1.8" />
        </g>

        {/* ครีบอก — ชิ้นเล็กแต่ขาดไม่ได้ ไม่มีแล้วลำตัวดูเหมือนใบไม้
            พันธุ์ดัมโบ้ครีบอกใหญ่จนเป็นชื่อพันธุ์ ต้องวาดให้เห็นว่าใหญ่จริง */}
        <path
          d={
            dumbo
              ? 'M48 62 C46 82 60 96 80 93 C85 78 74 66 57 59 Z'
              : 'M50 66 C54 76 63 80 71 78 C69 71 61 65 53 63 Z'
          }
          fill={palette.body[1]}
          opacity={dumbo ? 0.72 : 0.5}
        />

        {albino && (
          // ทับทั้งตัวรวมหาง จึงต้องวาดหลังทุกชิ้นแต่ก่อนตา — ตาอัลบิโนต้องแดงชัด
          <g fill={`url(#albino-${uid})`}>
            <path d="M28 60 C32 46 46 38 64 38 C86 38 104 48 116 56 C104 72 86 82 64 82 C46 82 32 74 28 60 Z" />
            <path d={tailPath} />
          </g>
        )}

        {/* ตา — อัลบิโนตาแดง เป็นจุดที่คนเลี้ยงปลาดูเป็นอย่างแรกว่าใช่อัลบิโนจริงไหม */}
        <circle cx="41" cy="56" r="4" fill={albino ? '#d1332b' : '#0f172a'} />
        <circle cx="42.4" cy="54.6" r="1.4" fill="#ffffff" opacity="0.9" />
      </g>
    </svg>
  );
}
