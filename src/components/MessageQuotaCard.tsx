import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// โควต้าข้อความ LINE และสวิตช์ที่คุมมัน
//
// เพดานคือ 300 ข้อความ/เดือน และร้านเคยใช้หมดจริงในเดือนกันยายน
// ตอนนั้นมี 14 ข้อความส่งไม่ออกโดยไม่มีอะไรเตือน ร้านรู้ตัวตอนลูกค้าทักถาม
//
// เอาตัวเลขมาวางไว้ข้างสวิตช์ที่ทำให้มันขึ้น จะได้เห็นผลของการเปิด/ปิดทันที
// ไม่ใช่ตัวเลขลอย ๆ ที่ต้องไปเดาเองว่าเกิดจากอะไร

// บอทถือ token ของ LINE อยู่ฝั่งเดียว หน้านี้ยิงตรงไปที่ LINE เองไม่ได้
const BOT_ORIGIN = 'https://line-tacking.onrender.com';

interface Quota {
  limit: number | null;
  used: number;
}

const TIERS = [
  { tier: 1, label: 'ไปรษณีย์รับฝาก', hint: 'ร้านเพิ่งแจ้งเลขไปเอง ลูกค้ารู้อยู่แล้ว' },
  { tier: 3, label: 'ออกไปนำจ่าย', hint: 'วันที่ของจะถึง ลูกค้าต้องอยู่รับ' },
  { tier: 4, label: 'นำจ่ายไม่สำเร็จ', hint: 'ต้องรู้ทันที ไม่งั้นของตีกลับ' },
  { tier: 5, label: 'ถึงมือแล้ว', hint: 'ปิดบิลให้เองด้วย' },
];

export default function MessageQuotaCard() {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [quotaFailed, setQuotaFailed] = useState(false);
  const [tiers, setTiers] = useState<number[]>([]);
  const [slipPush, setSlipPush] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('settings')
        .select('id, parcel_push_tiers, push_slip_received')
        .limit(1)
        .maybeSingle();

      if (data) {
        setSettingsId(data.id);
        setTiers(data.parcel_push_tiers || []);
        setSlipPush(!!data.push_slip_received);
      }
      setLoading(false);

      // บอทหลับอยู่ก็ได้ ตัวเลขโควต้าไม่ใช่ของที่ต้องมีถึงจะแก้สวิตช์ได้
      try {
        const res = await fetch(`${BOT_ORIGIN}/quota`);
        if (!res.ok) throw new Error(String(res.status));
        setQuota(await res.json());
      } catch {
        setQuotaFailed(true);
      }
    })();
  }, []);

  const save = async (patch: Record<string, unknown>) => {
    if (!settingsId) return;
    setSaving(true);
    const { error } = await supabase.from('settings').update(patch).eq('id', settingsId);
    setSaving(false);
    if (error) {
      toast.error('บันทึกไม่สำเร็จ');
      return false;
    }
    toast.success('บันทึกแล้ว', { description: 'บอทจะใช้ค่าใหม่ภายในไม่กี่นาที' });
    return true;
  };

  const toggleTier = async (tier: number) => {
    const next = tiers.includes(tier) ? tiers.filter((t) => t !== tier) : [...tiers, tier].sort();
    setTiers(next);
    if (!(await save({ parcel_push_tiers: next }))) setTiers(tiers);
  };

  const toggleSlip = async () => {
    const next = !slipPush;
    setSlipPush(next);
    if (!(await save({ push_slip_received: next }))) setSlipPush(!next);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  // คาดการณ์จากอัตราที่ใช้มาถึงตอนนี้ ไม่ใช่ค่าเฉลี่ยทั้งเดือน
  // เดือนที่ขายดีต้นเดือนจะได้เห็นสัญญาณตั้งแต่ยังแก้ทัน
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const perDay = quota ? quota.used / dayOfMonth : 0;
  const projected = Math.round(perDay * daysInMonth);
  const willRunOut = !!quota?.limit && projected > quota.limit;
  const runOutDay = quota?.limit && perDay > 0 ? Math.ceil(quota.limit / perDay) : null;
  const pct = quota?.limit ? Math.min(100, (quota.used / quota.limit) * 100) : 0;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2">
          <MessageSquare className="text-primary mt-0.5 size-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">โควต้าข้อความ LINE</p>
            <p className="text-muted-foreground text-sm">
              ข้อความที่ระบบส่งหาลูกค้าเอง — ที่แอดมินพิมพ์ในแชทไม่นับ
            </p>
          </div>
        </div>

        {quotaFailed ? (
          <p className="text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 text-xs">
            ดึงตัวเลขจากบอทไม่ได้ตอนนี้ — ตั้งค่าด้านล่างยังใช้ได้ตามปกติ
          </p>
        ) : quota ? (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold tabular-nums">
                {quota.used.toLocaleString()}
                <span className="text-muted-foreground text-base font-normal">
                  {' / '}
                  {quota.limit?.toLocaleString() ?? 'ไม่จำกัด'}
                </span>
              </span>
              <span className="text-muted-foreground text-xs">
                วันที่ {dayOfMonth} จาก {daysInMonth}
              </span>
            </div>

            {quota.limit && (
              <>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className={cn('h-full rounded-full', willRunOut ? 'bg-warning' : 'bg-primary')}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {willRunOut && (
                  <div className="text-warning flex items-start gap-1.5 text-xs">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      อัตรานี้จะหมดราววันที่ {runOutDay} — หลังจากนั้นลูกค้าจะไม่ได้รับข้อความ
                      จนขึ้นเดือนใหม่ ปิดบางอย่างด้านล่างช่วยได้
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}

        <Separator />

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">แจ้งเมื่อได้รับสลิป</p>
            <p className="text-muted-foreground text-xs">
              หน้าใบสรุปบอกลูกค้าอยู่แล้วตอนอัปโหลดเสร็จ ปิดไว้ประหยัดได้ประมาณ 1 ข้อความต่อบิล
            </p>
          </div>
          <Button
            variant={slipPush ? 'default' : 'outline'}
            size="sm"
            disabled={saving}
            onClick={toggleSlip}
          >
            {slipPush ? 'เปิดอยู่' : 'ปิดอยู่'}
          </Button>
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">ขั้นที่แจ้งสถานะพัสดุ</p>
            <p className="text-muted-foreground text-xs">
              ยิ่งเลือกมาก ยิ่งกินโควต้าต่อกล่องมาก — ขั้น "ระหว่างขนส่ง" ไม่มีให้เลือกเพราะ
              ไปรษณีย์สแกนหลายรอบต่อกล่อง
            </p>
          </div>
          <div className="grid gap-2">
            {TIERS.map((t) => {
              const on = tiers.includes(t.tier);
              return (
                <button
                  key={t.tier}
                  type="button"
                  disabled={saving}
                  onClick={() => toggleTier(t.tier)}
                  className={cn(
                    'flex items-start gap-2 rounded-lg border px-3 py-2 text-left',
                    on ? 'border-primary bg-primary/5' : 'bg-muted/30'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'
                    )}
                  >
                    {on ? '✓' : ''}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{t.label}</span>
                    <span className="text-muted-foreground block text-xs">{t.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
