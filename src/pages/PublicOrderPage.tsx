import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bell, Check, Copy, Fish, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import PromptPayQR from '@/components/PromptPayQR';
import { getLineUserId } from '@/utils/liff';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

// หน้านี้เปิดได้โดยไม่ต้องล็อกอิน — ทุกอย่างผ่าน RPC ที่รับ token เท่านั้น
// ห้ามเรียกตารางตรง ๆ ในไฟล์นี้ anon ไม่มีสิทธิ์อยู่แล้วและไม่ควรมี

interface PublicOrder {
  order_number: string;
  created_at: string;
  items: Array<{
    breedName: string;
    type: 'piece' | 'pair' | 'set';
    quantity: number;
    price: number;
    gender?: string;
    discount?: number;
    freeQty?: number;
    kind?: 'fish' | 'food';
  }>;
  total_amount: number;
  total_fish: number;
  shipping_fee: number;
  discount: number;
  status: string;
  payment_status: string;
  tracking_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  note?: string | null;
  payment: {
    promptpay_id?: string | null;
    bank_name?: string | null;
    account_number?: string | null;
    account_name?: string | null;
  };
}

type BadgeVariant = React.ComponentProps<typeof Badge>['variant'];

const TYPE_LABEL: Record<string, string> = { piece: 'ตัว', pair: 'คู่', set: 'ชุด' };
const GENDER_LABEL: Record<string, string> = { male: '♂', female: '♀', mixed: '⚥' };

const PAYMENT_TEXT: Record<string, { text: string; variant: BadgeVariant }> = {
  unpaid: { text: 'รอชำระเงิน', variant: 'warning' },
  deposit: { text: 'ชำระมัดจำแล้ว', variant: 'soft' },
  paid: { text: 'ชำระเงินแล้ว', variant: 'success' },
};

const STATUS_TEXT: Record<string, { text: string; variant: BadgeVariant }> = {
  pending: { text: 'กำลังเตรียมของ', variant: 'muted' },
  shipped: { text: 'จัดส่งแล้ว', variant: 'soft' },
  delivered: { text: 'ส่งถึงแล้ว', variant: 'success' },
  cancelled: { text: 'ยกเลิก', variant: 'danger' },
};

export default function PublicOrderPage() {
  const { token } = useParams<{ token: string }>();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [linkedToLine, setLinkedToLine] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    let active = true;

    (async () => {
      const { data, error } = await supabase.rpc('get_public_order', { p_token: token });
      if (!active) return;

      if (error || !data) {
        setOrder(null);
        setLoading(false);
        return;
      }

      const o = data as PublicOrder;
      setOrder(o);
      setName(o.customer_name || '');
      setPhone(o.customer_phone || '');
      setAddress(o.customer_address || '');
      setLoading(false);

      // ถ้าเปิดในแอป LINE ให้ผูกบัญชีกับออเดอร์เงียบ ๆ
      // ลูกค้าจะได้รับอัปเดตพัสดุอัตโนมัติโดยไม่ต้องทำอะไรเพิ่ม
      // เปิดในเบราว์เซอร์ธรรมดาก็ข้ามไป หน้ายังใช้งานได้ครบ
      const lineUserId = await getLineUserId();
      if (!active || !lineUserId) return;

      const { data: linked } = await supabase.rpc('link_order_line_user', {
        p_token: token,
        p_line_user_id: lineUserId,
      });
      if (active && linked?.ok) setLinkedToLine(true);
    })();

    return () => {
      active = false;
    };
  }, [token]);

  const submitContact = async () => {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      toast.error('กรุณากรอกชื่อ เบอร์โทร และที่อยู่ให้ครบ');
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.rpc('submit_order_contact', {
      p_token: token,
      p_name: name,
      p_phone: phone,
      p_address: address,
    });
    setSaving(false);

    if (error || !data?.ok) {
      const reason = data?.reason;
      toast.error(
        reason === 'already_shipped'
          ? 'ออเดอร์นี้จัดส่งแล้ว ไม่สามารถแก้ที่อยู่ได้'
          : reason === 'too_long'
            ? 'ข้อมูลยาวเกินกำหนด'
            : 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง'
      );
      return;
    }

    setSaved(true);
    toast.success('บันทึกที่อยู่เรียบร้อยแล้ว ขอบคุณครับ');
  };

  const copyAccountNumber = async () => {
    const acc = order?.payment.account_number;
    if (!acc) return;
    try {
      await navigator.clipboard.writeText(acc.replace(/[-\s]/g, ''));
      setCopiedAccount(true);
      toast.success('คัดลอกเลขบัญชีแล้ว');
      setTimeout(() => setCopiedAccount(false), 2000);
    } catch {
      toast.error('คัดลอกไม่สำเร็จ');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="text-primary size-8 animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
        <Fish className="text-muted-foreground mb-4 size-12" />
        <h1 className="text-lg font-semibold">ไม่พบใบสรุปนี้</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          ลิงก์อาจไม่ถูกต้อง กรุณาสอบถามทางร้านอีกครั้ง
        </p>
      </div>
    );
  }

  const canEditAddress = order.status === 'pending';
  const payment = PAYMENT_TEXT[order.payment_status] || PAYMENT_TEXT.unpaid;
  const status = STATUS_TEXT[order.status] || STATUS_TEXT.pending;

  return (
    <div className="min-h-[100dvh] px-4 pt-safe pb-10">
      <div className="mx-auto max-w-md space-y-3 py-5">
        {/* หัวใบสรุป */}
        <Card>
          <CardContent className="text-center">
            <div className="bg-primary text-primary-foreground mx-auto mb-3 flex size-11 items-center justify-center rounded-xl">
              <Fish className="size-6" />
            </div>
            <h1 className="text-lg font-semibold">ใบสรุปรายการสั่งซื้อ</h1>
            <p className="text-primary mt-0.5 text-sm font-medium">{order.order_number}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {new Date(order.created_at).toLocaleString('th-TH', {
                dateStyle: 'long',
                timeStyle: 'short',
              })}
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <Badge variant={payment.variant}>{payment.text}</Badge>
              <Badge variant={status.variant}>{status.text}</Badge>
            </div>
            {order.tracking_number && (
              <p className="mt-3 text-sm font-medium">📦 เลขพัสดุ {order.tracking_number}</p>
            )}
          </CardContent>
        </Card>

        {/* รายการ */}
        <Card>
          <CardContent>
            <p className="text-muted-foreground mb-3 text-sm font-medium">รายการ</p>
            <div className="space-y-2.5">
              {order.items?.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="leading-snug font-medium">
                      {item.kind === 'food' ? '🍤 ' : ''}
                      {item.breedName}{' '}
                      {item.kind !== 'food' && item.gender ? GENDER_LABEL[item.gender] : ''}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {item.quantity} {item.kind === 'food' ? 'ชิ้น' : TYPE_LABEL[item.type] || item.type}
                      {item.freeQty ? ` (แถม ${item.freeQty})` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">
                    ฿
                    {(
                      item.price * Math.max(0, item.quantity - (item.freeQty || 0)) -
                      (item.discount || 0)
                    ).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="space-y-1.5 text-sm">
              <div className="text-muted-foreground flex justify-between">
                <span>จำนวนปลา</span>
                <span className="text-foreground font-medium">{order.total_fish} ตัว</span>
              </div>
              <div className="text-muted-foreground flex justify-between">
                <span>ค่าจัดส่ง</span>
                <span className="text-foreground font-medium tabular-nums">
                  ฿{(order.shipping_fee || 0).toLocaleString()}
                </span>
              </div>
              {order.discount > 0 && (
                <div className="text-warning flex justify-between">
                  <span>ส่วนลด</span>
                  <span className="font-medium tabular-nums">-฿{order.discount.toLocaleString()}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex items-center justify-between">
                <span className="font-medium">ยอดรวม</span>
                <span className="text-primary text-2xl font-semibold tabular-nums">
                  ฿{(order.total_amount || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ชำระเงิน */}
        {order.payment_status !== 'paid' && (
          <Card>
            <CardContent>
              <p className="text-muted-foreground mb-3 text-sm font-medium">ชำระเงิน</p>

              <PromptPayQR
                promptPayId={order.payment.promptpay_id}
                amount={order.total_amount || 0}
                reference={order.order_number}
              />

              {order.payment.account_number && (
                <>
                  <Separator className="my-4" />
                  <div className="text-center text-sm">
                    <p className="text-muted-foreground text-xs">หรือโอนเข้าบัญชี</p>
                    <p className="mt-1 font-medium">{order.payment.bank_name}</p>
                    <Button variant="ghost" className="mt-1 h-auto py-1.5" onClick={copyAccountNumber}>
                      <span className="text-lg font-semibold tracking-wide tabular-nums">
                        {order.payment.account_number}
                      </span>
                      {copiedAccount ? (
                        <Check className="text-success size-4" />
                      ) : (
                        <Copy className="text-muted-foreground size-4" />
                      )}
                    </Button>
                    <p className="text-muted-foreground">{order.payment.account_name}</p>
                  </div>
                </>
              )}

              <p className="text-muted-foreground mt-4 text-center text-xs">
                ชำระแล้วรบกวนส่งสลิปในไลน์ได้เลยครับ 🙏
              </p>
            </CardContent>
          </Card>
        )}

        {/* ที่อยู่จัดส่ง */}
        <Card>
          <CardContent>
            <p className="text-muted-foreground mb-3 text-sm font-medium">ที่อยู่จัดส่ง</p>

            {!canEditAddress ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium">{order.customer_name || '-'}</p>
                <p className="text-muted-foreground">{order.customer_phone || '-'}</p>
                <p className="text-muted-foreground leading-relaxed">{order.customer_address || '-'}</p>
                <p className="text-muted-foreground pt-2 text-xs">
                  ออเดอร์จัดส่งแล้ว ไม่สามารถแก้ไขที่อยู่ได้
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="p-name">ชื่อผู้รับ</Label>
                  <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-phone">เบอร์โทรศัพท์</Label>
                  <Input
                    id="p-phone"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-address">ที่อยู่</Label>
                  <Textarea
                    id="p-address"
                    rows={4}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
                  />
                </div>
                <Button size="lg" className="w-full" onClick={submitContact} disabled={saving}>
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : saved ? (
                    <>
                      <Check className="size-4" /> บันทึกแล้ว
                    </>
                  ) : (
                    <>
                      <Send className="size-4" /> ส่งที่อยู่ให้ร้าน
                    </>
                  )}
                </Button>
                {saved && (
                  <p className="text-success text-center text-xs font-medium">
                    ร้านได้รับที่อยู่แล้ว แก้ไขเพิ่มได้จนกว่าจะจัดส่ง
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {linkedToLine && (
          <div className="bg-success/10 flex items-start gap-2 rounded-xl px-4 py-3">
            <Bell className="text-success mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-success text-sm font-medium">เชื่อมบัญชี LINE แล้ว</p>
              <p className="text-success/80 text-xs">
                เมื่อร้านจัดส่ง ระบบจะแจ้งสถานะพัสดุให้อัตโนมัติ
              </p>
            </div>
          </div>
        )}

        {order.note && (
          <Card>
            <CardContent>
              <p className="text-muted-foreground mb-2 text-sm font-medium">หมายเหตุ</p>
              <p className="text-sm">{order.note}</p>
            </CardContent>
          </Card>
        )}

        <p className="text-muted-foreground/60 py-4 text-center text-xs">GuppyReal</p>
      </div>
    </div>
  );
}
