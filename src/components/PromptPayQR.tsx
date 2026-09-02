import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

import { buildPromptPayPayload } from '@/utils/promptpay';
import { Button } from '@/components/ui/button';

interface PromptPayQRProps {
  /** เลขพร้อมเพย์ของร้าน จากหน้าตั้งค่า */
  promptPayId?: string | null;
  amount: number;
  /** ใช้ตั้งชื่อไฟล์ตอนกดบันทึกรูป */
  reference?: string;
}

export default function PromptPayQR({ promptPayId, amount, reference }: PromptPayQRProps) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    if (!promptPayId?.trim() || amount <= 0) {
      setDataUrl('');
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    (async () => {
      try {
        const payload = buildPromptPayPayload({ id: promptPayId, amount });
        // โหลดไลบรารี QR ตอนใช้จริงเท่านั้น จะได้ไม่ถ่วงบันเดิลหลัก
        const QRCode = (await import('qrcode')).default;
        const url = await QRCode.toDataURL(payload, {
          width: 512,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#0f172a', light: '#ffffff' },
        });
        if (active) setDataUrl(url);
      } catch (err: any) {
        if (active) setError(err?.message || 'สร้าง QR ไม่สำเร็จ');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [promptPayId, amount]);

  if (!promptPayId?.trim()) {
    return (
      <div className="bg-muted/40 rounded-lg border border-dashed p-4 text-center">
        <p className="text-sm font-medium">ยังไม่ได้ตั้งเลขพร้อมเพย์</p>
        <p className="text-muted-foreground mt-1 text-xs">
          ตั้งได้ที่ หน้าตั้งค่า → บัญชี / ค่าส่ง → เลขพร้อมเพย์
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/8 rounded-lg p-4 text-center">
        <p className="text-destructive text-sm font-medium">{error}</p>
      </div>
    );
  }

  if (loading || !dataUrl) {
    return (
      <div className="flex items-center justify-center rounded-lg border p-8">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  const fileName = `promptpay-${reference || Math.round(amount)}.png`;

  return (
    <div className="flex flex-col items-center rounded-lg border p-4">
      <p className="text-primary text-sm font-medium">สแกนจ่าย ฿{amount.toLocaleString()}</p>

      <img
        src={dataUrl}
        alt={`QR พร้อมเพย์ ${amount} บาท`}
        className="my-3 size-48 max-w-full"
      />

      <p className="text-muted-foreground text-center text-xs leading-relaxed">
        ยอดเงินฝังอยู่ใน QR แล้ว
        <br />
        ลูกค้าไม่ต้องพิมพ์ยอดเอง
      </p>

      <Button asChild variant="outline" size="sm" className="mt-3">
        <a href={dataUrl} download={fileName}>
          <Download className="size-3.5" /> บันทึกรูป QR
        </a>
      </Button>
    </div>
  );
}
