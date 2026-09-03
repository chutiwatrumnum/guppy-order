import { useEffect, useMemo, useState } from 'react';
import { HeartCrack, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Separator } from '@/components/ui/separator';

// ปลาตายที่ร้านคืนเงินให้ลูกค้า
//
// เดิมจ่ายคืนกันในแชทแล้วจบ ไม่มีที่ไหนบันทึก จึงตอบไม่ได้ว่าเดือนนี้ตายกี่ตัว
// คืนเงินไปเท่าไหร่ และกำไรที่หน้าสรุปก็สูงเกินจริงเพราะไม่เคยหักออก

export interface Claim {
  id: string;
  order_id: string;
  breed_name: string | null;
  dead_qty: number;
  refund_amount: number;
  note: string | null;
  created_at: string;
  orders?: { order_number: string; customer_name: string | null; created_at: string } | null;
}

/**
 * ดึงเคลมในช่วงเวลาหนึ่ง — ใช้ร่วมกับหน้าสรุปยอดด้วย
 *
 * กรองด้วย "วันที่ของบิล" ไม่ใช่วันที่กดบันทึกเคลม
 *
 * เคลมมาทีหลังบิลเสมอโดยธรรมชาติของงาน ไม่ใช่เพราะร้านลืม —
 * ปลาถึงมือลูกค้าหลังส่งไปแล้วหลายวัน กว่าจะรู้ว่าตายก็ตอนนั้น
 * ยิ่งบิลปลายเดือนยิ่งเจอบ่อย เพราะกว่าปลาจะถึงก็ข้ามเดือนไปแล้ว
 *
 * ถ้ากรองด้วยวันที่บันทึก บิลเดือนสิงหาจะหายไปจากรายงานเดือนสิงหา
 * แล้วไปโผล่ในเดือนกันยาที่ไม่ได้ขายอะไรเกี่ยวกันเลย
 *
 * !inner ทำให้ตัวกรองบน orders มีผลกับ claims ด้วย ไม่งั้น PostgREST จะคืนทุกแถว
 */
export async function fetchClaims(from?: string, to?: string) {
  let q = supabase
    .from('claims')
    .select(
      'id, order_id, breed_name, dead_qty, refund_amount, note, created_at, orders!inner(order_number, customer_name, created_at)'
    )
    .order('created_at', { ascending: false });

  if (from) q = q.gte('orders.created_at', from);
  if (to) q = q.lte('orders.created_at', to);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as unknown as Claim[];
}

export default function ClaimsPanel({
  from,
  to,
  onChanged,
}: {
  from?: string;
  to?: string;
  /** ยอดเคลมเปลี่ยน — หน้าสรุปต้องคิดกำไรใหม่ */
  onChanged?: () => void;
}) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setClaims(await fetchClaims(from, to));
    } catch (err: any) {
      toast.error('โหลดรายการเคลมไม่สำเร็จ');
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [from, to]);

  const totals = useMemo(
    () => ({
      dead: claims.reduce((s, c) => s + c.dead_qty, 0),
      refund: claims.reduce((s, c) => s + c.refund_amount, 0),
      bills: new Set(claims.map((c) => c.order_id)).size,
    }),
    [claims]
  );

  // พันธุ์ที่ตายบ่อยสุด — เอาไปแก้ที่ต้นทางได้ (เปลี่ยนวิธีแพ็ค หรือเลิกสั่งพันธุ์นั้น)
  const byBreed = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of claims) {
      const k = c.breed_name?.trim() || 'ไม่ระบุพันธุ์';
      m[k] = (m[k] || 0) + c.dead_qty;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [claims]);

  const remove = async (claim: Claim) => {
    setBusy(claim.id);
    const { error } = await supabase.from('claims').delete().eq('id', claim.id);
    setBusy(null);
    if (error) {
      toast.error('ลบไม่สำเร็จ');
      return;
    }
    setClaims((prev) => prev.filter((c) => c.id !== claim.id));
    onChanged?.();
    toast.success('ลบรายการเคลมแล้ว');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={HeartCrack}
          title="ไม่มีเคลมในช่วงนี้"
          description="กดปุ่มเคลมในบิลเพื่อบันทึกปลาตายและเงินที่คืนให้ลูกค้า"
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* ยอดรวมของช่วงที่เลือกอยู่ */}
      <Card>
        <CardContent className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-muted-foreground text-xs">ปลาตาย</p>
            <p className="text-destructive text-2xl font-semibold tabular-nums">{totals.dead}</p>
            <p className="text-muted-foreground text-xs">ตัว</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">คืนเงิน</p>
            <p className="text-destructive text-2xl font-semibold tabular-nums">
              ฿{totals.refund.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">จำนวนบิล</p>
            <p className="text-2xl font-semibold tabular-nums">{totals.bills}</p>
            <p className="text-muted-foreground text-xs">บิล</p>
          </div>
        </CardContent>
      </Card>

      {byBreed.length > 1 && (
        <Card>
          <CardContent>
            <p className="text-muted-foreground mb-2 text-sm font-medium">ตายมากสุดตามสายพันธุ์</p>
            <div className="space-y-1.5">
              {byBreed.slice(0, 6).map(([name, qty]) => (
                <div key={name} className="flex items-center justify-between text-sm">
                  <span className="truncate">{name}</span>
                  <span className="text-destructive shrink-0 font-medium tabular-nums">{qty} ตัว</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {claims.map((c) => (
          <Card key={c.id} className="gap-0 py-0">
            <CardContent className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0 space-y-0.5 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-primary font-medium">{c.orders?.order_number || '—'}</span>
                  {c.orders?.customer_name && (
                    <span className="text-muted-foreground text-xs">{c.orders.customer_name}</span>
                  )}
                </div>
                <p>
                  {c.breed_name || 'ไม่ระบุพันธุ์'}{' '}
                  <span className="text-destructive font-medium">ตาย {c.dead_qty} ตัว</span>
                  {c.refund_amount > 0 && (
                    <span className="text-muted-foreground">
                      {' '}
                      · คืน ฿{c.refund_amount.toLocaleString()}
                    </span>
                  )}
                </p>
                {c.note && <p className="text-muted-foreground text-xs">{c.note}</p>}
                {/* วันที่ของบิล ไม่ใช่วันที่กดบันทึก — ช่วงเวลาที่กรองยึดวันบิล
                    ถ้าโชว์วันที่บันทึกจะดูขัดกับตัวกรองจนงงว่าทำไมรายการนี้อยู่ในช่วงนี้ */}
                <p className="text-muted-foreground text-xs">
                  บิลวันที่{' '}
                  {c.orders?.created_at
                    ? new Date(c.orders.created_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })
                    : '—'}
                  {' · บันทึกเคลม '}
                  {new Date(c.created_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => remove(c)}
                disabled={busy === c.id}
                aria-label="ลบรายการเคลม"
              >
                {busy === c.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />
      <p className="text-muted-foreground text-center text-xs">
        เงินที่คืนถูกหักออกจากกำไรในหน้าสรุปยอดแล้ว
      </p>
    </div>
  );
}
