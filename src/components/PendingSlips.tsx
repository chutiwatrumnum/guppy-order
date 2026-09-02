import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2, Receipt, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
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

// เหตุผลที่ปฏิเสธบ่อยสุด กดทีเดียวจบ ไม่ต้องพิมพ์ซ้ำทุกครั้ง
const REJECT_REASONS = ['ยอดไม่ตรง', 'ไม่ใช่สลิปโอนเงิน', 'รูปไม่ชัด', 'สลิปซ้ำ'];

/** สลิปใบอื่นที่ไฟล์ตรงกัน */
interface DupeRow {
  image_hash: string;
  slip_id: string;
  status: string;
  order_number: string | null;
  created_at: string;
}

interface Slip {
  id: string;
  order_id: string | null;
  line_user_id: string;
  image_path: string;
  image_hash: string | null;
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

export default function PendingSlips({
  onConfirmed,
  onChanged,
}: {
  /** ยืนยันแล้ว — บิลเปลี่ยนสถานะ ต้องโหลดรายการบิลใหม่ */
  onConfirmed?: () => void;
  /**
   * จำนวนสลิปที่รออยู่เปลี่ยน — ไว้อัปเดตตัวเลขบนแท็บ
   * ส่งจำนวนไปด้วยเลย ตัวเลขบนแท็บจะได้ตรงกับรายการที่เห็นเสมอ
   * เดิมแท็บนับเองตอนโหลดหน้าแล้วไม่อัปเดตอีก พอมีสลิปเข้ามาระหว่างนั้น
   * ตัวเลขกับหัวข้อในหน้าจะไม่ตรงกัน (badge 4 แต่รายการ 5)
   */
  onChanged?: (pendingCount: number) => void;
}) {
  const { user } = useAuth();
  const [slips, setSlips] = useState<Slip[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, PendingOrder[]>>({});
  const [dupes, setDupes] = useState<Record<string, DupeRow[]>>({});
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  // สลิปที่กำลังจะปฏิเสธ พร้อมเหตุผล
  const [rejecting, setRejecting] = useState<Slip | null>(null);
  const [presetNote, setPresetNote] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payment_slips')
      .select('id, order_id, line_user_id, image_path, image_hash, created_at, orders(order_number, total_amount, customer_name)')
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

    // ไฟล์ซ้ำ — เทียบลายนิ้วมือของไฟล์ ไม่ได้อ่านอะไรจากรูป
    // ที่ต้องรู้คือใบที่ "เคยยืนยันไปแล้ว" (เอาสลิปเก่ามาใช้ซ้ำ)
    // กับใบที่ "รอตรวจอยู่ที่บิลอื่น" ส่วนตัวมันเองไม่นับ
    const hashes = [...new Set(rows.map((s) => s.image_hash).filter(Boolean))] as string[];
    if (hashes.length > 0) {
      const { data: dupRows } = await supabase.rpc('slip_duplicates', { p_hashes: hashes });
      const map: Record<string, DupeRow[]> = {};
      for (const s of rows) {
        if (!s.image_hash) continue;
        const others = (dupRows || []).filter(
          (d: DupeRow) => d.image_hash === s.image_hash && d.slip_id !== s.id
        );
        if (others.length > 0) map[s.id] = others;
      }
      setDupes(map);
    } else {
      setDupes({});
    }

    onChanged?.(rows.length);

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
      .select('total_amount, order_number, public_token, line_user_id')
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
    //
    // สลิปที่อัปจากหน้าใบสรุปในเบราว์เซอร์ธรรมดาจะไม่มี LINE userId จริง
    // (เก็บเป็น web:<token> ไว้เพราะคอลัมน์เป็น not null) ยิง push ไปก็ล้มเงียบ ๆ
    // เอาของออเดอร์มาก่อน ถ้าไม่มีทั้งคู่ก็ไม่ต้องหยอดคิว แล้วบอกร้านตรง ๆ
    const isLineUser = (v: string | null | undefined) => !!v && /^U[0-9a-f]{32}$/.test(v);
    const notifyUserId = isLineUser(order.line_user_id)
      ? order.line_user_id
      : isLineUser(slip.line_user_id)
        ? slip.line_user_id
        : null;

    let notifyError = null;
    if (notifyUserId) {
      const summaryUrl = `https://liff.line.me/2010766267-xz9flUvC/o/${order.public_token}`;
      ({ error: notifyError } = await supabase.from('line_notifications').insert({
        line_user_id: notifyUserId,
        order_id: orderId,
        message:
          `✅ ยืนยันการชำระเงินแล้วครับ\n` +
          `บิล ${order.order_number} · ฿${Number(order.total_amount).toLocaleString()}\n\n` +
          `ทางร้านกำลังจัดเตรียมพัสดุ เมื่อจัดส่งจะแจ้งเลขพัสดุให้อีกครั้งครับ 🐟\n` +
          `ดูใบสรุป: ${summaryUrl}`,
      }));
    }

    setBusy(null);

    if (!notifyUserId) {
      toast.warning('ยืนยันรับเงินแล้ว — ลูกค้ายังไม่ได้เปิดใบสรุปในไลน์ ต้องแจ้งเอง');
    } else if (notifyError) {
      toast.warning('ยืนยันรับเงินแล้ว แต่ส่งแจ้งเตือนหาลูกค้าไม่สำเร็จ');
    } else {
      toast.success('ยืนยันรับเงินแล้ว — แจ้งลูกค้าในไลน์ให้อัตโนมัติ');
    }
    const remaining = slips.filter((s) => s.id !== slip.id);
    setSlips(remaining);
    onConfirmed?.();
    onChanged?.(remaining.length);
  };

  const reject = async () => {
    const slip = rejecting;
    if (!slip) return;

    const note = (rejectNote || presetNote).trim();
    setBusy(slip.id);
    await supabase
      .from('payment_slips')
      .update({
        status: 'rejected',
        review_note: note || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.username || null,
      })
      .eq('id', slip.id);

    // บอกลูกค้าด้วยว่าทำไมไม่ผ่าน ไม่งั้นจะส่งใบเดิมมาซ้ำ หรือหายไปแล้วบิลค้าง
    // ต้องมี LINE จริงถึงจะส่งได้ — อัปจากเบราว์เซอร์ธรรมดาจะเป็น web:<token>
    if (slip.order_id && /^U[0-9a-f]{32}$/.test(slip.line_user_id)) {
      const { data: order } = await supabase
        .from('orders')
        .select('order_number, public_token')
        .eq('id', slip.order_id)
        .single();

      if (order) {
        await supabase.from('line_notifications').insert({
          line_user_id: slip.line_user_id,
          order_id: slip.order_id,
          message:
            `⚠️ สลิปที่ส่งมายังตรวจสอบไม่ผ่านครับ\n` +
            `บิล ${order.order_number}\n\n` +
            (note ? `เหตุผล: ${note}\n\n` : '') +
            `รบกวนแนบสลิปใหม่อีกครั้งที่ลิงก์นี้ครับ 🙏\n` +
            `https://liff.line.me/2010766267-xz9flUvC/o/${order.public_token}`,
        });
      }
    }

    setBusy(null);
    setRejecting(null);
    setRejectNote('');
    setPresetNote('');
    const remaining = slips.filter((s) => s.id !== slip.id);
    setSlips(remaining);
    onChanged?.(remaining.length);
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
          description="สลิปที่ลูกค้าส่งเข้าไลน์หรือแนบจากหน้าใบสรุปจะมาโผล่ที่นี่"
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

                {/* ไฟล์นี้เคยเห็นมาก่อน — ไม่ปฏิเสธเอง แค่บอกให้ดูให้ดี
                    ลูกค้าอาจส่งซ้ำด้วยความบริสุทธิ์ใจ ระบบไม่ควรกล่าวหาใคร */}
                {dupes[slip.id]?.length > 0 && (
                  <div className="bg-warning/10 flex items-start gap-2 rounded-lg px-3 py-2">
                    <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0 text-xs">
                      <p className="text-warning font-medium">สลิปรูปนี้เคยส่งมาแล้ว</p>
                      {dupes[slip.id].map((d) => (
                        <p key={d.slip_id} className="text-warning/90">
                          {d.status === 'confirmed' ? 'ยืนยันไปแล้ว' : 'รอตรวจอยู่'}
                          {d.order_number ? ` · บิล ${d.order_number}` : ''}
                          {' · '}
                          {new Date(d.created_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {slip.order_id && slip.orders ? (
                  <div className="bg-primary/8 rounded-lg px-3 py-2">
                    <p className="text-primary text-xs font-medium">จับคู่กับบิล — ยอดที่ต้องได้รับ</p>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold">{slip.orders.order_number}</p>
                      {/* ตัวใหญ่ไว้กวาดตาเทียบกับยอดในรูปได้เร็ว ๆ */}
                      <p className="text-primary text-xl font-semibold tabular-nums">
                        ฿{Number(slip.orders.total_amount).toLocaleString()}
                      </p>
                    </div>
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
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRejecting(slip);
                      setPresetNote('');
                      setRejectNote('');
                    }}
                    disabled={busy === slip.id}
                  >
                    <X className="size-4" /> ปฏิเสธ
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ปฏิเสธพร้อมเหตุผล — ลูกค้าได้รู้ว่าต้องแก้อะไร ร้านเปิดย้อนดูทีหลังก็ยังจำได้ */}
      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ปฏิเสธสลิปนี้?</DialogTitle>
            <DialogDescription>
              บิลจะไม่ถูกปิด และระบบจะแจ้งเหตุผลให้ลูกค้าในไลน์พร้อมลิงก์ส่งใหม่
            </DialogDescription>
          </DialogHeader>

          {rejecting?.orders && (
            <div className="bg-muted/50 flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm">
              <span className="text-primary font-medium">{rejecting.orders.order_number}</span>
              <span className="font-semibold tabular-nums">
                ฿{Number(rejecting.orders.total_amount).toLocaleString()}
              </span>
            </div>
          )}

          <div className="space-y-3">
            {/* เหตุผลที่เจอบ่อย กดทีเดียวไม่ต้องพิมพ์ */}
            <div className="flex flex-wrap gap-2">
              {REJECT_REASONS.map((r) => (
                <Button
                  key={r}
                  type="button"
                  variant={presetNote === r ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setPresetNote(presetNote === r ? '' : r);
                    setRejectNote('');
                  }}
                >
                  {r}
                </Button>
              ))}
            </div>

            <Textarea
              value={rejectNote}
              onChange={(e) => {
                setRejectNote(e.target.value);
                if (e.target.value) setPresetNote('');
              }}
              placeholder="หรือพิมพ์เหตุผลเอง (ไม่ใส่ก็ได้)"
              rows={2}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejecting(null)} disabled={!!busy}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={reject} disabled={!!busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
              ปฏิเสธสลิป
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
