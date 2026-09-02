import { useEffect, useState } from 'react';
import { Check, Loader2, Receipt, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  const { user } = useAuth();
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
    await Promise.all(
      rows.map(async (s) => {
        const { data: sig } = await supabase.storage.from('slips').createSignedUrl(s.image_path, 3600);
        if (sig?.signedUrl) signed[s.id] = sig.signedUrl;
      })
    );
    setUrls(signed);

    // สลิปที่ยังไม่รู้ว่าเป็นของบิลไหน ให้ดึงตัวเลือกมาให้ร้านเลือก
    const unmatched = rows.filter((s) => !s.order_id);
    const opts: Record<string, PendingOrder[]> = {};
    await Promise.all(
      unmatched.map(async (s) => {
        const { data: cand } = await supabase.rpc('pending_orders_for_line_user', {
          p_line_user_id: s.line_user_id,
        });
        opts[s.id] = (cand || []) as PendingOrder[];
      })
    );
    setOptions(opts);

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const confirmSlip = async (slip: Slip) => {
    const orderId = slip.order_id || picked[slip.id];
    if (!orderId) {
      toast.error('เลือกบิลก่อนครับ');
      return;
    }

    setBusy(slip.id);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('total_amount, order_number, public_token')
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
        reviewed_by: user?.username || null,
      })
      .eq('id', slip.id);

    if (slipError) {
      setBusy(null);
      toast.error('ปิดบิลแล้ว แต่บันทึกสลิปไม่สำเร็จ');
      return;
    }

    // หยอดคิวให้บอทแจ้งลูกค้าว่ายืนยันเงินแล้ว — ไม่ให้ลูกค้าต้องมากดดูเอง
    // ล้มเหลวตรงนี้ไม่ควรทำให้การปิดบิลพัง แค่เตือน
    const summaryUrl = `https://liff.line.me/2010766267-xz9flUvC/o/${order.public_token}`;
    const { error: notifyError } = await supabase.from('line_notifications').insert({
      line_user_id: slip.line_user_id,
      order_id: orderId,
      message:
        `✅ ยืนยันการชำระเงินแล้วครับ\n` +
        `บิล ${order.order_number} · ฿${Number(order.total_amount).toLocaleString()}\n\n` +
        `ทางร้านกำลังจัดเตรียมพัสดุ เมื่อจัดส่งจะแจ้งเลขพัสดุให้อีกครั้งครับ 🐟\n` +
        `ดูใบสรุป: ${summaryUrl}`,
    });

    setBusy(null);

    if (notifyError) {
      toast.warning('ยืนยันรับเงินแล้ว แต่ส่งแจ้งเตือนหาลูกค้าไม่สำเร็จ');
    } else {
      toast.success('ยืนยันรับเงินแล้ว — แจ้งลูกค้าในไลน์ให้อัตโนมัติ');
    }
    setSlips((prev) => prev.filter((s) => s.id !== slip.id));
    onConfirmed?.();
  };

  const reject = async (slip: Slip) => {
    if (!window.confirm('ปฏิเสธสลิปนี้? ลูกค้าจะไม่ถูกปิดบิล')) return;
    setBusy(slip.id);
    await supabase
      .from('payment_slips')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.username || null,
      })
      .eq('id', slip.id);
    setBusy(null);
    setSlips((prev) => prev.filter((s) => s.id !== slip.id));
    toast.success('ปฏิเสธสลิปแล้ว');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  if (slips.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Receipt}
          title="ไม่มีสลิปรอตรวจสอบ"
          description="สลิปที่ลูกค้าส่งเข้าไลน์จะมาโผล่ที่นี่"
          action={
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="size-3.5" /> โหลดใหม่
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">สลิปรอตรวจสอบ {slips.length} รายการ</p>
        <Button variant="ghost" size="sm" onClick={load}>
          <RefreshCw className="size-3.5" /> โหลดใหม่
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {slips.map((slip) => {
          const candidates = options[slip.id] || [];
          return (
            <Card key={slip.id} className="gap-0 py-0">
              <CardContent className="space-y-3 px-4 py-4">
                <p className="text-muted-foreground text-xs">
                  {new Date(slip.created_at).toLocaleString('th-TH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>

                {urls[slip.id] ? (
                  <a href={urls[slip.id]} target="_blank" rel="noreferrer" className="block">
                    <img
                      src={urls[slip.id]}
                      alt="สลิปโอนเงิน"
                      className="bg-muted/50 max-h-72 w-full rounded-lg border object-contain"
                    />
                  </a>
                ) : (
                  <div className="bg-muted/50 text-muted-foreground flex h-40 items-center justify-center rounded-lg text-xs">
                    โหลดรูปไม่ได้
                  </div>
                )}

                {slip.order_id && slip.orders ? (
                  <div className="bg-primary/8 rounded-lg px-3 py-2">
                    <p className="text-primary text-xs font-medium">จับคู่กับบิล</p>
                    <p className="text-sm font-semibold">
                      {slip.orders.order_number} · ฿{Number(slip.orders.total_amount).toLocaleString()}
                    </p>
                    {slip.orders.customer_name && (
                      <p className="text-muted-foreground text-xs">{slip.orders.customer_name}</p>
                    )}
                  </div>
                ) : candidates.length > 0 ? (
                  <Select
                    value={picked[slip.id] || undefined}
                    onValueChange={(v) => setPicked((p) => ({ ...p, [slip.id]: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="เลือกบิลที่ตรงกับสลิปนี้" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.order_number} · ฿{Number(o.total_amount).toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="bg-warning/10 text-warning rounded-lg px-3 py-2 text-xs">
                    ไม่พบบิลค้างชำระของลูกค้ารายนี้
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="success"
                    className="flex-1"
                    onClick={() => confirmSlip(slip)}
                    disabled={busy === slip.id || (!slip.order_id && !picked[slip.id])}
                  >
                    {busy === slip.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    ยืนยันรับเงิน
                  </Button>
                  <Button variant="outline" onClick={() => reject(slip)} disabled={busy === slip.id}>
                    <X className="size-4" /> ปฏิเสธ
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
