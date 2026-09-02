import { Loader2 } from 'lucide-react';

/** สถานะกำลังโหลดของทั้งหน้า */
export function PageLoader({ label = 'กำลังโหลดข้อมูล…' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <Loader2 className="text-primary size-8 animate-spin" />
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}
