import { useEffect, useState } from 'react';
import { Loader2, Check, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

// สลิปที่ลูกค้าส่งเข้าไลน์ รอร้านยืนยัน
//
// ตั้งใจให้ "คน" เป็นคนตัดสิน — ระบบแค่เอาสลิปมาวางคู่กับบิลที่น่าจะใช่
// ถ้าให้เครื่องอ่านยอดจากรูปแล้วปิดบิลเอง จะกลายเป็นระบบที่ยืนยันสลิปปลอมให้อัตโนมัติ

interface Slip {
  id: string;
  order_id: string | null;
  line_user_id: string;
  image_path: string;
  created_at: string;
  orders?: {
    order_number: string;
    total_amount: number;
    customer_name: string | null;
  } | null;
}

interface PendingOrder {
  id: string;
  order_number: string;
  total_amount: number;
}

export default function PendingSlips({ onConfirmed }: { onConfirmed?: () => void }) {
  const [slips, setSlips] = useState<Slip[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, PendingOrder[]>>({});
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payment_slips')
      .select('id, order_id, line_user_id, image_path, created_at, orders(order_number, total_amount, customer_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('โหลดสลิปไม่สำเร็จ');
      setLoading(false);
      return;
    }

    const rows = (data || []) as unknown as Slip[];
    setSlips(rows);

    // บัคเก็ตเป็น private จึงต้องขอ signed URL ที่หมดอายุเอง
    const signed: Record<string, string> = {};
    await Promise.all(rows.map(async (s) => {
      const { data: sig } = await supabase.storage.from('slips').createSignedUrl(s.image_path, 3600);
      if (sig?.signedUrl) signed[s.id] = sig.signedUrl;
    }));
    setUrls(signed);

    // สลิปที่ยังไม่รู้ว่าเป็นของบิลไหน ให้ดึงตัวเลือกมาให้ร้านเลือก
    const unmatched = rows.filter(s => !s.order_id);
    const opts: Record<string, PendingOrder[]> = {};
    await Promise.all(unmatched.map(async (s) => {
      const { data: cand } = await supabase.rpc('pending_orders_for_line_user', { p_line_user_id: s.line_user_id });
      opts[s.id] = (cand || []) as PendingOrder[];
    }));
    setOptions(opts);

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const confirmSlip = async (slip: Slip) => {
    const orderId = slip.order_id || picked[slip.id];
    if (!orderId) {
      toast.error('เลือกบิลก่อนครับ');
      return;
    }

    setBusy(slip.id);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      setBusy(null);
      toast.error('ไม่พบบิลนี้');
      return;
    }

    const { error: payError } = await supabase
      .from('orders')
      .update({ payment_status: 'paid', paid_amount: order.total_amount })
      .eq('id', orderId);

    if (payError) {
      setBusy(null);
      toast.error('อัปเดตสถานะไม่สำเร็จ');
      return;
    }

    const { error: slipError } = await supabase
      .from('payment_slips')
      .update({
        status: 'confirmed',
        order_id: orderId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', slip.id);

    setBusy(null);

    if (slipError) {
      toast.error('ปิดบิลแล้ว แต่บันทึกสลิปไม่สำเร็จ');
      return;
    }

    toast.success('ยืนยันรับเงินแล้ว');
    setSlips(prev => prev.filter(s => s.id !== slip.id));
    onConfirmed?.();
  };

  const reject = async (slip: Slip) => {
    if (!window.confirm('ปฏิเสธสลิปนี้? ลูกค้าจะไม่ถูกปิดบิล')) return;
    setBusy(slip.id);
    await supabase
      .from('payment_slips')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', slip.id);
    setBusy(null);
    setSlips(prev => prev.filter(s => s.id !== slip.id));
    toast.success('ปฏิเสธสลิปแล้ว');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    );
  }

  if (slips.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-slate-400">ไม่มีสลิปรอตรวจสอบ</p>
        <button onClick={load} className="mt-3 text-xs font-bold text-blue-600 inline-flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3" /> โหลดใหม่
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-black text-slate-700">🧾 สลิปรอตรวจสอบ {slips.length} รายการ</p>
        <button onClick={load} className="text-xs font-bold text-slate-500 inline-flex items-center gap-1.5 hover:text-blue-600">
          <RefreshCw className="h-3 w-3" /> โหลดใหม่
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {slips.map(slip => {
          const candidates = options[slip.id] || [];
          return (
            <div key={slip.id} className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-[11px] text-slate-400 mb-2">
                {new Date(slip.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>

              {urls[slip.id] ? (
                <a href={urls[slip.id]} target="_blank" rel="noreferrer">
                  <img
                    src={urls[slip.id]}
                    alt="สลิปโอนเงิน"
                    className="w-full max-h-72 object-contain bg-slate-50 rounded-xl border border-slate-100"
                  />
                </a>
              ) : (
                <div className="h-40 bg-slate-50 rounded-xl flex items-center justify-center text-xs text-slate-400">
                  โหลดรูปไม่ได้
                </div>
              )}

              <div className="mt-3">
                {slip.order_id && slip.orders ? (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                    <p className="text-[11px] text-blue-500 font-bold">จับคู่กับบิล</p>
                    <p className="text-sm font-black text-slate-800">
                      {slip.orders.order_number} · ฿{Number(slip.orders.total_amount).toLocaleString()}
                    </p>
                    {slip.orders.customer_name && (
                      <p className="text-[11px] text-slate-500">{slip.orders.customer_name}</p>
                    )}
                  </div>
                ) : candidates.length > 0 ? (
                  <select
                    value={picked[slip.id] || ''}
                    onChange={(e) => setPicked(p => ({ ...p, [slip.id]: e.target.value }))}
                    className="w-full h-10 bg-white border border-amber-300 rounded-xl px-3 text-sm font-bold text-slate-700 outline-none focus:border-amber-500"
                  >
                    <option value="">เลือกบิลที่ตรงกับสลิปนี้</option>
                    {candidates.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.order_number} · ฿{Number(o.total_amount).toLocaleString()}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    ไม่พบบิลค้างชำระของลูกค้ารายนี้
                  </p>
                )}
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => confirmSlip(slip)}
                  disabled={busy === slip.id || (!slip.order_id && !picked[slip.id])}
                  className="flex-1 h-10 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  {busy === slip.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  ยืนยันรับเงิน
                </button>
                <button
                  onClick={() => reject(slip)}
                  disabled={busy === slip.id}
                  className="h-10 px-4 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <X className="h-3.5 w-3.5" /> ปฏิเสธ
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
