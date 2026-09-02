import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

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

  useEffect(() => {
    load();
  }, []);

  const acknowledge = async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
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
    <div className="border-destructive/30 bg-destructive/5 rounded-xl border p-4">
      <div className="mb-1 flex items-center gap-2">
        <AlertTriangle className="text-destructive size-4 shrink-0" />
        <p className="text-destructive text-sm font-medium">
          ลูกค้า {rows.length} รายไม่ได้รับข้อความแจ้งเตือน
        </p>
      </div>
      <p className="text-muted-foreground mb-3 text-xs">
        ส่วนใหญ่เกิดจากลูกค้ายังไม่ได้แอดไลน์ร้าน — รบกวนทักไปแจ้งเองครับ
      </p>

      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="bg-card flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5"
          >
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium">
                {r.orders?.order_number || 'ไม่ทราบบิล'}
                {r.orders?.customer_name && (
                  <span className="text-muted-foreground font-normal"> · {r.orders.customer_name}</span>
                )}
              </p>
              {r.orders?.customer_phone && (
                <p className="text-muted-foreground text-xs">📱 {r.orders.customer_phone}</p>
              )}
              <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{r.message}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              title="ติดต่อลูกค้าแล้ว ซ่อนรายการนี้"
              onClick={() => acknowledge(r.id)}
            >
              <X className="size-3.5" /> รับทราบ
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
