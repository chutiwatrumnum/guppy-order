import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, X } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

// แจ้งเตือนที่ push หาลูกค้าไม่สำเร็จ — ลูกค้ายังไม่ได้แอด OA หรือโควต้าข้อความ LINE เดือนนั้นหมด
//
// ถ้าไม่โชว์ตรงนี้ ร้านจะไม่มีทางรู้ว่าลูกค้าไม่ได้รับข้อความ
// (คิดว่าแจ้งไปแล้ว ลูกค้าคิดว่าร้านเงียบ) — โชว์เพื่อให้ร้านทักไปเอง

interface FailedNotification {
  id: string;
  message: string;
  images: string[] | null;
  error: string | null;
  created_at: string;
  orders?: {
    order_number: string;
    customer_name: string | null;
    customer_phone: string | null;
  } | null;
}

// บอทเก็บ err.message ของ @line/bot-sdk ไว้ ซึ่งมีแค่ "429 - Too Many Requests"
// คำว่า "monthly limit" อยู่ใน body ที่บอทไม่ได้เก็บ — ดักไว้เผื่อวันหน้าเก็บ
// 429 อีกแบบคือ rate limit แต่ push รับได้หลักพันครั้งต่อวินาที ร้านขนาดนี้ไม่มีทางชน
function isQuotaError(error: string | null) {
  return !!error && /\b429\b|monthly limit/i.test(error);
}

export default function FailedNotifications() {
  const [rows, setRows] = useState<FailedNotification[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('line_notifications')
      .select('id, message, images, error, created_at, orders(order_number, customer_name, customer_phone)')
      .eq('status', 'failed')
      .is('acknowledged_at', null)
      .order('created_at', { ascending: false });
    setRows((data || []) as unknown as FailedNotification[]);
  };

  useEffect(() => {
    load();
  }, []);

  // ส่งเองในแชทแทนบอท — ข้อความที่แอดมินพิมพ์ในแชท OA ไม่นับโควต้า
  //
  // คัดลอกข้อความเต็มพร้อมขึ้นบรรทัดตามที่ลูกค้าจะได้เห็น
  // ไม่ใช่ตัวย่อสองบรรทัดในการ์ด ซึ่งยุบทุกบรรทัดรวมกัน
  const copyMessage = async (row: FailedNotification) => {
    try {
      await navigator.clipboard.writeText(row.message);
      setCopiedId(row.id);
      toast.success('คัดลอกแล้ว', { description: 'วางในแชทลูกค้า ส่งแล้วค่อยกดรับทราบ' });
      setTimeout(() => setCopiedId((id) => (id === row.id ? null : id)), 2000);
    } catch {
      toast.error('คัดลอกไม่สำเร็จ');
    }
  };

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

  // สาเหตุบอกว่าต้องทักทางไหน: โควต้าหมดยังวางในแชท LINE ได้
  // แต่ลูกค้าที่ไม่ได้แอดร้าน แชทก็ส่งไม่ถึงเหมือนกัน
  const quotaFull = rows.some((r) => isQuotaError(r.error));

  return (
    <div className="border-destructive/30 bg-destructive/5 rounded-xl border p-4">
      <div className="mb-1 flex items-center gap-2">
        <AlertTriangle className="text-destructive size-4 shrink-0" />
        <p className="text-destructive text-sm font-medium">
          ลูกค้า {rows.length} รายไม่ได้รับข้อความแจ้งเตือน
        </p>
      </div>
      <p className="text-muted-foreground mb-3 text-xs">
        {quotaFull
          ? 'โควต้าข้อความ LINE เดือนนี้เต็ม ระบบเลยส่งให้ไม่ได้ — กดคัดลอกแล้ววางในแชทลูกค้าได้เลย พิมพ์ในแชทไม่นับโควต้าครับ'
          : 'ส่วนใหญ่เกิดจากลูกค้ายังไม่ได้แอดไลน์ร้าน — กดคัดลอกแล้วทักไปแจ้งเองครับ'}
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
              {/* รูปคัดลอกไปพร้อมข้อความไม่ได้ — เตือนไว้ ไม่งั้นลูกค้าได้แต่ตัวหนังสือ */}
              {r.images?.length ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  📎 มีรูปแนบ {r.images.length} รูป ต้องส่งแยก:
                  {r.images.map((url, i) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary ml-1.5 underline-offset-2 hover:underline"
                    >
                      รูป {i + 1}
                    </a>
                  ))}
                </p>
              ) : null}
            </div>

            {/* มือถือเรียงบนล่าง — วางเคียงกันจะเบียดข้อความเหลือนิดเดียว */}
            <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
              <Button
                variant="outline"
                size="sm"
                title="คัดลอกข้อความไปวางในแชทลูกค้า"
                onClick={() => copyMessage(r)}
              >
                {copiedId === r.id ? (
                  <Check className="text-success size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                คัดลอก
              </Button>
              <Button
                variant="outline"
                size="sm"
                title="ติดต่อลูกค้าแล้ว ซ่อนรายการนี้"
                onClick={() => acknowledge(r.id)}
              >
                <X className="size-3.5" /> รับทราบ
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
