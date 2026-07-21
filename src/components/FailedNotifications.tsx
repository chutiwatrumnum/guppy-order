import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

// แจ้งเตือนที่ push หาลูกค้าไม่สำเร็จ — ส่วนใหญ่คือลูกค้ายังไม่ได้แอด OA
//
// ถ้าไม่โชว์ตรงนี้ ร้านจะไม่มีทางรู้ว่าลูกค้าไม่ได้รับข้อความ
// (คิดว่าแจ้งไปแล้ว ลูกค้าคิดว่าร้านเงียบ) — โชว์เพื่อให้ร้านทักไปเอง

interface FailedNotification {
  id: string;
  message: string;
  error: string | null;
  created_at: string;
  orders?: {
    order_number: string;
    customer_name: string | null;
    customer_phone: string | null;
  } | null;
}

export default function FailedNotifications() {
  const [rows, setRows] = useState<FailedNotification[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from('line_notifications')
      .select('id, message, error, created_at, orders(order_number, customer_name, customer_phone)')
      .eq('status', 'failed')
      .is('acknowledged_at', null)
      .order('created_at', { ascending: false });
    setRows((data || []) as unknown as FailedNotification[]);
  };

  useEffect(() => { load(); }, []);

  const acknowledge = async (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
    const { error } = await supabase
      .from('line_notifications')
      .update({ acknowledged_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.error('บันทึกไม่สำเร็จ');
      load();
    }
  };

  if (rows.length === 0) return null;

  return (
    <div className="mb-4 bg-red-50 border-2 border-red-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <p className="text-sm font-black text-red-700">
          ลูกค้า {rows.length} รายไม่ได้รับข้อความแจ้งเตือน
        </p>
      </div>
      <p className="text-[11px] text-red-500 mb-3">
        ส่วนใหญ่เกิดจากลูกค้ายังไม่ได้แอดไลน์ร้าน — รบกวนทักไปแจ้งเองครับ
      </p>

      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.id} className="bg-white border border-red-100 rounded-xl px-3 py-2 flex items-start justify-between gap-3">
            <div className="min-w-0 text-sm">
              <p className="font-black text-slate-800">
                {r.orders?.order_number || 'ไม่ทราบบิล'}
                {r.orders?.customer_name && <span className="font-bold text-slate-600"> · {r.orders.customer_name}</span>}
              </p>
              {r.orders?.customer_phone && (
                <p className="text-[12px] text-slate-500">📱 {r.orders.customer_phone}</p>
              )}
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{r.message}</p>
            </div>
            <button
              onClick={() => acknowledge(r.id)}
              className="shrink-0 h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 active:scale-95 transition-all"
              title="ติดต่อลูกค้าแล้ว ซ่อนรายการนี้"
            >
              <X className="h-3 w-3" /> รับทราบ
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
