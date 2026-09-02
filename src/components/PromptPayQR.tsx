import { useEffect, useState } from 'react';
import { Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { buildPromptPayPayload } from '@/utils/promptpay';
import { Button } from '@/components/ui/button';

interface PromptPayQRProps {
  /** เลขพร้อมเพย์ของร้าน จากหน้าตั้งค่า */
  promptPayId?: string | null;
  amount: number;
  /** ใช้ตั้งชื่อไฟล์ตอนกดบันทึกรูป */
  reference?: string;
}

/** data: URL → File เพื่อส่งเข้า Web Share API */
function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(',');
  const mime = head.match(/:(.*?);/)?.[1] || 'image/png';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

export default function PromptPayQR({ promptPayId, amount, reference }: PromptPayQRProps) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [canShare, setCanShare] = useState(false);

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

  // <a download> ไม่ทำงานใน in-app browser ของ LINE ทั้ง iOS และ Android
  // (webview บล็อกการดาวน์โหลด และ iOS ไม่รองรับ download กับ data: URL อยู่แล้ว)
  // ปุ่มเดิมจึงกดแล้วไม่มีอะไรเกิดขึ้น — เช็คก่อนว่าแชร์ไฟล์ได้จริงค่อยโชว์ปุ่ม
  useEffect(() => {
    if (!dataUrl) {
      setCanShare(false);
      return;
    }
    try {
      const file = dataUrlToFile(dataUrl, 'qr.png');
      setCanShare(!!navigator.canShare?.({ files: [file] }));
    } catch {
      setCanShare(false);
    }
  }, [dataUrl]);

  const shareQr = async () => {
    try {
      const file = dataUrlToFile(dataUrl, `promptpay-${reference || Math.round(amount)}.png`);
      await navigator.share({ files: [file], title: `พร้อมเพย์ ฿${amount.toLocaleString()}` });
    } catch (err: any) {
      // ผู้ใช้กดยกเลิกเองไม่ใช่ error ที่ต้องบอก
      if (err?.name === 'AbortError') return;
      toast.error('บันทึกไม่สำเร็จ ลองกดค้างที่รูปเพื่อบันทึกแทนครับ');
    }
  };

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

      {canShare ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={shareQr}>
          <Share2 className="size-3.5" /> บันทึก / แชร์รูป QR
        </Button>
      ) : null}

      {/* วิธีที่ได้ผลทุกเครื่องจริง ๆ — บอกไว้เสมอ ไม่ใช่แค่ตอนไม่มีปุ่ม */}
      <p className="text-muted-foreground mt-3 text-center text-xs">
        หรือกดค้างที่รูปเพื่อบันทึกลงเครื่อง
      </p>
    </div>
  );
}
