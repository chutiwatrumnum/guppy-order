import { useEffect, useState } from 'react';
import { Loader2, Download } from 'lucide-react';
import { buildPromptPayPayload } from '../utils/promptpay';

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

    return () => { active = false; };
  }, [promptPayId, amount]);

  if (!promptPayId?.trim()) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
        <p className="text-xs font-bold text-slate-500">ยังไม่ได้ตั้งเลขพร้อมเพย์</p>
        <p className="text-[10px] text-slate-400 mt-1">ตั้งได้ที่ หน้าตั้งค่า → Bank → เลขพร้อมเพย์</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
        <p className="text-xs font-bold text-red-600">{error}</p>
      </div>
    );
  }

  if (loading || !dataUrl) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    );
  }

  const fileName = `promptpay-${reference || Math.round(amount)}.png`;

  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-4 flex flex-col items-center">
      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3">
        สแกนจ่าย ฿{amount.toLocaleString()}
      </p>

      <img src={dataUrl} alt={`QR พร้อมเพย์ ${amount} บาท`} className="w-48 h-48" />

      <p className="text-[10px] text-slate-400 mt-2 text-center leading-relaxed">
        ยอดเงินฝังอยู่ใน QR แล้ว<br />ลูกค้าไม่ต้องพิมพ์ยอดเอง
      </p>

      <a
        href={dataUrl}
        download={fileName}
        className="mt-3 h-10 px-4 bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2"
      >
        <Download className="h-3.5 w-3.5" /> บันทึกรูป QR
      </a>
    </div>
  );
}
