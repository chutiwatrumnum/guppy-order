import { cn } from '@/lib/utils';

// หมีลอยน้ำระหว่างรอโหลด
//
// จอนี้คนขายเจอวันละหลายสิบครั้ง จังหวะเลยต้องช้าและนิ่ง
// ถ้าเด้งแรงหรือหมุนเร็ว อีกสองวันก็เริ่มรำคาญ
//
// ใช้โลโก้ร้านถ้ามี ไม่มีก็ถอยไปใช้ไอคอนแอปซึ่งมีอยู่แล้วแน่ ๆ
// (วางไฟล์ที่ public/logo.png แล้วมันจะสลับมาใช้เอง ไม่ต้องแก้โค้ด)
const LOGO = '/logo.png';
const LOGO_FALLBACK = '/icon-192.png';

// ตำแหน่งฟองอากาศตายตัว ไม่สุ่ม จะได้ไม่กระโดดไปมาทุกครั้งที่ re-render
const BUBBLES = [
  { left: '16%', size: 6, delay: '0s' },
  { left: '29%', size: 4, delay: '0.9s' },
  { left: '71%', size: 5, delay: '0.45s' },
  { left: '85%', size: 3, delay: '1.6s' },
];

/** สถานะกำลังโหลดของทั้งหน้า */
export function PageLoader({
  label = 'กำลังโหลดข้อมูล…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn('flex min-h-[60vh] flex-col items-center justify-center gap-4', className)}
      role="status"
      aria-live="polite"
    >
      <div className="relative flex h-28 w-32 flex-col items-center justify-end gap-2.5 pb-2">
        {/* ฟองอากาศลอยขึ้นจากข้างหลัง */}
        {BUBBLES.map((b, i) => (
          <span
            key={i}
            aria-hidden
            className="bg-primary/40 animate-bubble-rise absolute bottom-10 rounded-full"
            style={{ left: b.left, width: b.size, height: b.size, animationDelay: b.delay }}
          />
        ))}

        <img
          src={LOGO}
          alt=""
          aria-hidden
          width={80}
          height={80}
          className="animate-bear-float relative size-20 rounded-2xl object-contain drop-shadow-sm"
          onError={(e) => {
            // ยังไม่ได้วางโลโก้ร้าน — ใช้ไอคอนแอปแทน
            // เช็ก dataset กัน onError วนซ้ำถ้าไอคอนสำรองก็โหลดไม่ขึ้น
            const img = e.currentTarget;
            if (img.dataset.fallback) return;
            img.dataset.fallback = '1';
            img.src = LOGO_FALLBACK;
          }}
        />

        {/* เงาอยู่ใต้รูปจริง ๆ ไม่ทับกัน — หดตอนลอยขึ้น ให้รู้สึกว่าลอย ไม่ใช่เลื่อนขึ้นลง */}
        <span
          aria-hidden
          className="bg-foreground/70 animate-bear-shadow h-1.5 w-14 shrink-0 rounded-full blur-[3px]"
        />
      </div>

      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}
