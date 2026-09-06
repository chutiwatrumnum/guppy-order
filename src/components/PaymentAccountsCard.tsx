import { useEffect, useState } from 'react';
import { Archive, Check, CreditCard, Loader2, Pencil, Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

// บัญชีรับเงินของร้าน
//
// มีได้หลายบัญชี แต่ "ใช้รับเงินอยู่" ได้ทีละบัญชีเดียว — บิลที่ออกใหม่จะโชว์บัญชีนั้น
// บิลเก่าผูกกับบัญชีที่โชว์ตอนออกบิลไว้แล้ว สลับบัญชีวันนี้ไม่ทำให้บิลเมื่อวานเปลี่ยนตาม

export interface PaymentAccount {
  id: string;
  label: string | null;
  bank_name: string;
  account_number: string | null;
  account_name: string | null;
  promptpay_id: string | null;
  is_active: boolean;
  archived: boolean;
}

const EMPTY = {
  label: '',
  bank_name: '',
  account_number: '',
  account_name: '',
  promptpay_id: '',
};

export default function PaymentAccountsCard() {
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });

  const load = async () => {
    const { data, error } = await supabase
      .from('payment_accounts')
      .select('*')
      .order('archived', { ascending: true })
      .order('created_at', { ascending: true });
    setLoading(false);

    if (error) {
      console.error('Load payment accounts error:', error);
      toast.error('โหลดบัญชีรับเงินไม่สำเร็จ');
      return;
    }
    setAccounts((data || []) as PaymentAccount[]);
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setModalOpen(true);
  };

  const openEdit = (account: PaymentAccount) => {
    setEditing(account);
    setForm({
      label: account.label || '',
      bank_name: account.bank_name || '',
      account_number: account.account_number || '',
      account_name: account.account_name || '',
      promptpay_id: account.promptpay_id || '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.bank_name.trim()) {
      toast.error('ใส่ชื่อธนาคารด้วยครับ');
      return;
    }
    if (!form.account_number.trim() && !form.promptpay_id.trim()) {
      // ไม่มีทั้งเลขบัญชีและพร้อมเพย์ = ลูกค้าโอนไม่ได้เลย บันทึกไปก็ไม่มีประโยชน์
      toast.error('ต้องมีเลขบัญชีหรือเลขพร้อมเพย์อย่างน้อยหนึ่งอย่าง');
      return;
    }

    setSaving(true);
    const payload = {
      label: form.label.trim() || null,
      bank_name: form.bank_name.trim(),
      account_number: form.account_number.trim() || null,
      account_name: form.account_name.trim() || null,
      promptpay_id: form.promptpay_id.trim() || null,
    };

    const { error } = editing
      ? await supabase.from('payment_accounts').update(payload).eq('id', editing.id)
      : await supabase
          .from('payment_accounts')
          // บัญชีแรกของร้านต้องใช้รับเงินได้เลย ไม่งั้นบิลใหม่ไม่มีบัญชีให้โชว์
          .insert({ ...payload, is_active: accounts.length === 0 });
    setSaving(false);

    if (error) {
      console.error('Save payment account error:', error);
      toast.error('บันทึกไม่สำเร็จ ลองใหม่อีกครั้งครับ');
      return;
    }

    setModalOpen(false);
    setEditing(null);
    load();
    toast.success(editing ? 'แก้ไขบัญชีแล้ว' : 'เพิ่มบัญชีแล้ว');
  };

  /** สลับบัญชีที่ใช้รับเงิน — ต้องปลดของเดิมก่อน ฐานข้อมูลกันไว้ให้ active ได้ทีละใบ */
  const setActive = async (account: PaymentAccount) => {
    setBusyId(account.id);
    const current = accounts.find((a) => a.is_active);

    if (current && current.id !== account.id) {
      const { error } = await supabase
        .from('payment_accounts')
        .update({ is_active: false })
        .eq('id', current.id);
      if (error) {
        setBusyId(null);
        toast.error('สลับบัญชีไม่สำเร็จ');
        return;
      }
    }

    const { error } = await supabase
      .from('payment_accounts')
      .update({ is_active: true, archived: false })
      .eq('id', account.id);
    setBusyId(null);

    if (error) {
      console.error('Set active account error:', error);
      // ปลดของเดิมไปแล้วแต่ตั้งอันใหม่ไม่ผ่าน = ตอนนี้ไม่มีบัญชีไหน active เลย
      // ต้องบอกให้ชัด ไม่งั้นบิลใบต่อไปจะโชว์บัญชีเก่าที่ผูกไว้แทน
      toast.error('สลับบัญชีไม่สำเร็จ ตอนนี้ยังไม่มีบัญชีที่ใช้รับเงิน กรุณากดเลือกใหม่');
      load();
      return;
    }

    load();
    toast.success(`ใช้ ${account.label || account.bank_name} รับเงินแล้ว`, {
      description: 'บิลที่ออกหลังจากนี้จะโชว์บัญชีนี้ บิลเก่าไม่เปลี่ยน',
    });
  };

  const toggleArchive = async (account: PaymentAccount) => {
    if (account.is_active) {
      toast.error('บัญชีที่ใช้รับเงินอยู่เก็บเข้ากรุไม่ได้ สลับไปบัญชีอื่นก่อนครับ');
      return;
    }

    setBusyId(account.id);
    const { error } = await supabase
      .from('payment_accounts')
      .update({ archived: !account.archived })
      .eq('id', account.id);
    setBusyId(null);

    if (error) {
      toast.error('ไม่สำเร็จ ลองใหม่อีกครั้งครับ');
      return;
    }
    load();
  };

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CreditCard className="text-primary size-4" />
            <span className="font-medium">บัญชีรับเงิน</span>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" /> เพิ่มบัญชี
          </Button>
        </div>

        <p className="text-muted-foreground text-xs leading-relaxed">
          บิลที่ออกใหม่จะโชว์บัญชีที่ติดป้าย "ใช้รับเงินอยู่" — บิลเก่าผูกกับบัญชีที่โชว์ตอนออกบิลไว้แล้ว
          สลับวันนี้ไม่ทำให้บิลเมื่อวานเปลี่ยนตาม
        </p>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            ยังไม่มีบัญชี — กดเพิ่มบัญชีเพื่อให้ลูกค้าโอนเงินได้
          </p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={cn(
                  'rounded-lg border px-3 py-2.5',
                  account.is_active && 'border-success/40 bg-success/5',
                  account.archived && 'opacity-60'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium">
                        {account.label || account.bank_name}
                      </span>
                      {account.is_active && <Badge variant="success">ใช้รับเงินอยู่</Badge>}
                      {account.archived && <Badge variant="muted">เก็บเข้ากรุ</Badge>}
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {account.bank_name}
                      {account.account_number ? ` · ${account.account_number}` : ''}
                      {account.account_name ? ` · ${account.account_name}` : ''}
                    </p>
                    {account.promptpay_id && (
                      <p className="text-muted-foreground text-xs">
                        พร้อมเพย์ {account.promptpay_id}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="แก้ไข"
                      onClick={() => openEdit(account)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={account.archived ? 'เอากลับมาใช้' : 'เก็บเข้ากรุ'}
                      disabled={busyId === account.id}
                      onClick={() => toggleArchive(account)}
                    >
                      {account.archived ? (
                        <RotateCcw className="size-4" />
                      ) : (
                        <Archive className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {!account.is_active && !account.archived && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    disabled={busyId === account.id}
                    onClick={() => setActive(account)}
                  >
                    {busyId === account.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    ใช้บัญชีนี้รับเงิน
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ResponsiveModal open={modalOpen} onOpenChange={setModalOpen}>
        <ResponsiveModalContent className="sm:max-w-md">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{editing ? 'แก้ไขบัญชี' : 'เพิ่มบัญชีรับเงิน'}</ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <ResponsiveModalBody className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pa-label">ชื่อเรียก</Label>
              <Input
                id="pa-label"
                placeholder="เช่น กสิกร (หลัก)"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
              <p className="text-muted-foreground text-xs">
                ไว้ให้ร้านดูเองในหน้าตั้งค่ากับหน้าบัญชี ลูกค้าไม่เห็นบรรทัดนี้
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pa-bank">ธนาคาร</Label>
              <Input
                id="pa-bank"
                placeholder="กสิกรไทย"
                value={form.bank_name}
                onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pa-number">เลขบัญชี</Label>
              <Input
                id="pa-number"
                inputMode="numeric"
                value={form.account_number}
                onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pa-name">ชื่อบัญชี</Label>
              <Input
                id="pa-name"
                value={form.account_name}
                onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pa-promptpay">เลขพร้อมเพย์ (สร้าง QR)</Label>
              <Input
                id="pa-promptpay"
                inputMode="numeric"
                placeholder="เบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก"
                value={form.promptpay_id}
                onChange={(e) => setForm((f) => ({ ...f, promptpay_id: e.target.value }))}
              />
              <p className="text-muted-foreground text-xs">
                ใส่แล้วใบสรุปของลูกค้าจะมี QR พร้อมยอดเงินให้สแกนจ่ายเลย
              </p>
            </div>
          </ResponsiveModalBody>

          <ResponsiveModalFooter>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" onClick={() => setModalOpen(false)}>
                ยกเลิก
              </Button>
              <Button size="lg" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </Button>
            </div>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </Card>
  );
}
