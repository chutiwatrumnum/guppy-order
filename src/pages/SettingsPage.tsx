import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CreditCard,
  Edit2,
  Fish,
  Loader2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Breed } from '@/types';
import Layout from './Layout';
import FoodProducts from '@/components/FoodProducts';
import ShippingNoticeCard from '@/components/ShippingNoticeCard';
import MessageTemplatesCard from '@/components/MessageTemplatesCard';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/page-loader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

const TYPES = ['piece', 'pair', 'set'] as const;
type ItemType = (typeof TYPES)[number];

const TYPE_LABEL: Record<ItemType, string> = { piece: 'ตัว', pair: 'คู่', set: 'ชุด' };

const num = (v: unknown) => Number(v) || 0;
const priceField = (t: ItemType) => `premium_price_${t}` as keyof Breed;
const costField = (t: ItemType) => `premium_cost_${t}` as keyof Breed;
const profitOf = (b: Breed, t: ItemType) => num(b[priceField(t)]) - num(b[costField(t)]);

/** ตัวเลขที่กดแล้วแก้ในที่เดิมได้ — Enter/คลิกออก = บันทึก, Esc = ยกเลิก */
function InlineNumber({
  value,
  onCommit,
  className,
  children,
}: {
  value: number;
  onCommit: (next: number) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          setEditing(false);
          onCommit(Number(draft) || 0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(String(value || ''));
            setEditing(false);
          }
        }}
        className="border-primary focus-visible:ring-ring/50 h-8 w-20 rounded-md border bg-card px-2 text-right text-sm outline-none focus-visible:ring-[3px]"
      />
    );
  }

  return (
    <button
      type="button"
      title="กดเพื่อแก้ไข"
      onClick={() => {
        setDraft(String(value || ''));
        setEditing(true);
      }}
      className={cn('hover:bg-primary/10 -mx-1 cursor-text rounded px-1 transition-colors', className)}
    >
      {children}
    </button>
  );
}

/** ราคาขาย / ต้นทุน / กำไร ของหนึ่งหน่วยขาย แก้ได้ทุกตัวเลข */
function PriceCell({
  breed,
  type,
  onCommit,
  align = 'end',
}: {
  breed: Breed;
  type: ItemType;
  onCommit: (field: keyof Breed, next: number) => void;
  align?: 'start' | 'end';
}) {
  const p = num(breed[priceField(type)]);
  const c = num(breed[costField(type)]);

  if (p === 0 && c === 0) {
    return (
      <InlineNumber
        value={0}
        onCommit={(n) => onCommit(priceField(type), n)}
        className="text-muted-foreground hover:text-primary"
      >
        —
      </InlineNumber>
    );
  }

  const profit = p - c;
  const margin = p > 0 ? Math.round((profit / p) * 100) : 0;
  const missingCost = p > 0 && c === 0;

  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 leading-tight tabular-nums',
        align === 'end' ? 'items-end' : 'items-start'
      )}
    >
      <InlineNumber value={p} onCommit={(n) => onCommit(priceField(type), n)} className="font-semibold">
        {p.toLocaleString()}
      </InlineNumber>
      <InlineNumber
        value={c}
        onCommit={(n) => onCommit(costField(type), n)}
        className={cn('text-xs', missingCost ? 'text-warning' : 'text-muted-foreground')}
      >
        ทุน {c.toLocaleString()}
      </InlineNumber>
      {missingCost ? (
        <Badge variant="warning" className="gap-1">
          <AlertTriangle className="size-2.5" /> ยังไม่ใส่ทุน
        </Badge>
      ) : (
        <span className={cn('text-xs font-medium', profit >= 0 ? 'text-success' : 'text-destructive')}>
          {profit >= 0 ? '+' : ''}
          {profit.toLocaleString()}
          <span className="text-muted-foreground font-normal"> ({margin}%)</span>
        </span>
      )}
    </div>
  );
}

export default function SettingsPage() {
  // State
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [bankInfo, setBankInfo] = useState<any>({
    id: null,
    bank_name: 'กสิกรไทย',
    account_number: '',
    account_name: '',
    promptpay_id: '',
    shipping_fee: 60,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isBreedModalOpen, setIsBreedModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [editingBreed, setEditingBreed] = useState<Breed | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'name',
    dir: 'asc',
  });

  // Load Data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: breedsData } = await supabase.from('breeds').select('*').order('name');
      setBreeds(breedsData || []);

      const { data: settingsData } = await supabase.from('settings').select('*').limit(1);

      if (settingsData && settingsData.length > 0) {
        setBankInfo(settingsData[0]);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('โหลดข้อมูลไม่สำเร็จ — ข้อมูลที่เห็นอาจไม่ครบ ลองรีเฟรชอีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const payload = {
        bank_name: bankInfo.bank_name,
        account_number: bankInfo.account_number,
        account_name: bankInfo.account_name,
        promptpay_id: bankInfo.promptpay_id || null,
        shipping_fee: Number(bankInfo.shipping_fee),
      };

      let error;
      if (bankInfo.id) {
        const { error: err } = await supabase.from('settings').update(payload).eq('id', bankInfo.id);
        error = err;
      } else {
        const { error: err } = await supabase.from('settings').insert([payload]);
        error = err;
      }

      if (error) throw error;
      toast.success('บันทึกการตั้งค่าสำเร็จแล้วครับ');
      fetchData();
      setIsBankModalOpen(false);
    } catch (err) {
      toast.error('ไม่สามารถบันทึกการตั้งค่าได้');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAddOrUpdateBreed = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const breedData = {
      name: formData.get('name') as string,
      premium_price_piece: Number(formData.get('premium_price_piece')) || 0,
      premium_price_pair: Number(formData.get('premium_price_pair')) || 0,
      premium_price_set: Number(formData.get('premium_price_set')) || 0,
      premium_cost_piece: Number(formData.get('premium_cost_piece')) || 0,
      premium_cost_pair: Number(formData.get('premium_cost_pair')) || 0,
      premium_cost_set: Number(formData.get('premium_cost_set')) || 0,
    };

    try {
      if (editingBreed) {
        await supabase.from('breeds').update(breedData).eq('id', editingBreed.id);
      } else {
        await supabase.from('breeds').insert([breedData]);
      }
      setEditingBreed(null);
      setIsBreedModalOpen(false);
      fetchData();
      (e.target as HTMLFormElement).reset();
      toast.success('บันทึกสายพันธุ์เรียบร้อย');
    } catch (err) {
      toast.error('บันทึกไม่สำเร็จ');
    }
  };

  const deleteBreed = async (id: string) => {
    if (!confirm('ยืนยันการลบสายพันธุ์นี้?')) return;
    try {
      await supabase.from('breeds').delete().eq('id', id);
      fetchData();
      toast.success('ลบข้อมูลแล้ว');
    } catch (err) {
      toast.error('ลบไม่สำเร็จ');
    }
  };

  // Toggle sort: click same column flips direction, new column starts ascending
  const handleSort = (key: string) => {
    setSortConfig((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  };

  // Save one inline cell to Supabase with optimistic UI update
  const commitCell = async (breed: Breed, field: keyof Breed, next: number) => {
    if (next === num(breed[field])) return; // no change
    setBreeds((prev) => prev.map((b) => (b.id === breed.id ? { ...b, [field]: next } : b)));
    const { error } = await supabase.from('breeds').update({ [field]: next }).eq('id', breed.id);
    if (error) {
      toast.error('บันทึกไม่สำเร็จ');
      fetchData();
    } else {
      toast.success('อัปเดตแล้ว');
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <PageLoader />
      </Layout>
    );
  }

  const filteredBreeds = breeds.filter((breed) =>
    breed.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort by name or by profit of a given item type
  const sortedBreeds = [...filteredBreeds].sort((a, b) => {
    let av: number | string;
    let bv: number | string;
    if (sortConfig.key === 'name') {
      av = a.name.toLowerCase();
      bv = b.name.toLowerCase();
    } else {
      av = profitOf(a, sortConfig.key as ItemType);
      bv = profitOf(b, sortConfig.key as ItemType);
    }
    if (av < bv) return sortConfig.dir === 'asc' ? -1 : 1;
    if (av > bv) return sortConfig.dir === 'asc' ? 1 : -1;
    return 0;
  });

  // Summary numbers
  const missingCostCount = filteredBreeds.filter((b) =>
    TYPES.some((t) => num(b[priceField(t)]) > 0 && num(b[costField(t)]) === 0)
  ).length;
  const pieceMargins = filteredBreeds
    .filter((b) => num(b.premium_price_piece) > 0)
    .map((b) => (profitOf(b, 'piece') / num(b.premium_price_piece)) * 100);
  const avgPieceMargin = pieceMargins.length
    ? Math.round(pieceMargins.reduce((s, m) => s + m, 0) / pieceMargins.length)
    : 0;

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: string }) => {
    const active = sortConfig.key === sortKey;
    return (
      <button
        onClick={() => handleSort(sortKey)}
        className={cn(
          'flex w-full items-center justify-end gap-1 transition-colors',
          active ? 'text-primary' : 'hover:text-foreground'
        )}
      >
        {label}
        {active ? (
          sortConfig.dir === 'asc' ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-30" />
        )}
      </button>
    );
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <PageHeader
          title="ตั้งค่า"
          description="ราคาสายพันธุ์ อาหาร และข้อมูลบัญชีร้าน"
          action={
            <>
              <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setIsBankModalOpen(true)}>
                <CreditCard className="size-4" /> บัญชี / ค่าส่ง
              </Button>
              <Button
                className="flex-1 sm:flex-none"
                onClick={() => {
                  setEditingBreed(null);
                  setIsBreedModalOpen(true);
                }}
              >
                <Plus className="size-4" /> เพิ่มสายพันธุ์
              </Button>
            </>
          }
        />

        <div className="bg-background/95 sticky top-header z-20 -mx-4 px-4 py-3 backdrop-blur-md">
          <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="ค้นหาสายพันธุ์…" />
        </div>

        {filteredBreeds.length === 0 ? (
          <Card>
            <EmptyState
              icon={Fish}
              title={searchTerm ? 'ไม่พบสายพันธุ์ที่ค้นหา' : 'ยังไม่มีสายพันธุ์'}
              description={searchTerm ? undefined : 'กดปุ่ม “เพิ่มสายพันธุ์” เพื่อเริ่มต้น'}
            />
          </Card>
        ) : (
          <Card className="gap-0 overflow-hidden py-0">
            {/* มือถือ: การ์ดต่อสายพันธุ์ — ตารางกว้างอ่านบนจอเล็กไม่ไหว */}
            <div className="divide-y md:hidden">
              {sortedBreeds.map((breed) => (
                <div key={breed.id} className="px-4 py-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate font-medium">{breed.name}</p>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="แก้ไข"
                        onClick={() => {
                          setEditingBreed(breed);
                          setIsBreedModalOpen(true);
                        }}
                      >
                        <Edit2 className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="ลบ"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => deleteBreed(breed.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {TYPES.map((t) => (
                      <div key={t} className="bg-muted/40 rounded-lg px-2.5 py-2">
                        <p className="text-muted-foreground mb-1 text-xs">{TYPE_LABEL[t]}</p>
                        <PriceCell
                          breed={breed}
                          type={t}
                          align="start"
                          onCommit={(field, next) => commitCell(breed, field, next)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* จอคอมพ์: ตารางเทียบราคาได้ทีเดียวหลายสายพันธุ์ */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[30%]">
                      <button
                        onClick={() => handleSort('name')}
                        className={cn(
                          'flex items-center gap-1 transition-colors',
                          sortConfig.key === 'name' ? 'text-primary' : 'hover:text-foreground'
                        )}
                      >
                        สายพันธุ์
                        {sortConfig.key === 'name' ? (
                          sortConfig.dir === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-30" />
                        )}
                      </button>
                    </TableHead>
                    {TYPES.map((t) => (
                      <TableHead key={t} className="text-right">
                        <SortHeader label={TYPE_LABEL[t]} sortKey={t} />
                      </TableHead>
                    ))}
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedBreeds.map((breed) => (
                    <TableRow key={breed.id}>
                      <TableCell className="font-medium whitespace-nowrap">{breed.name}</TableCell>
                      {TYPES.map((t) => (
                        <TableCell key={t}>
                          <PriceCell
                            breed={breed}
                            type={t}
                            onCommit={(field, next) => commitCell(breed, field, next)}
                          />
                        </TableCell>
                      ))}
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="แก้ไข"
                            onClick={() => {
                              setEditingBreed(breed);
                              setIsBreedModalOpen(true);
                            }}
                          >
                            <Edit2 className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="ลบ"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => deleteBreed(breed.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="bg-muted/40 text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-3 text-xs">
              <span>
                ทั้งหมด <span className="text-foreground font-medium">{filteredBreeds.length}</span>{' '}
                สายพันธุ์
              </span>
              <span>
                กำไรเฉลี่ย/ตัว <span className="text-success font-medium">{avgPieceMargin}%</span>
              </span>
              {missingCostCount > 0 && (
                <span className="text-warning flex items-center gap-1 font-medium">
                  <AlertTriangle className="size-3" /> ยังไม่ใส่ต้นทุน {missingCostCount} สายพันธุ์
                </span>
              )}
              <span className="w-full sm:ml-auto sm:w-auto">กดตัวเลขเพื่อแก้ไขได้เลย</span>
            </div>
          </Card>
        )}

        {/* ข้อความที่ส่งให้ลูกค้าตอนแจ้งเลขพัสดุ */}
        <ShippingNoticeCard settingsId={bankInfo.id} />

        {/* คำที่ระบบพูดกับลูกค้าทั้งหมด */}
        <MessageTemplatesCard />

        {/* อาหาร / สินค้าอื่นที่ไม่ใช่ปลา */}
        <FoodProducts />
      </div>

      {/* ── บัญชีธนาคาร / ค่าจัดส่ง ── */}
      <ResponsiveModal open={isBankModalOpen} onOpenChange={setIsBankModalOpen}>
        <ResponsiveModalContent className="sm:max-w-md">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>บัญชีร้าน & ค่าจัดส่ง</ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <ResponsiveModalBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bank-name">ธนาคาร</Label>
              <Input
                id="bank-name"
                value={bankInfo.bank_name}
                onChange={(e) => setBankInfo({ ...bankInfo, bank_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-acc">เลขบัญชี</Label>
              <Input
                id="bank-acc"
                inputMode="numeric"
                value={bankInfo.account_number}
                onChange={(e) => setBankInfo({ ...bankInfo, account_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-accname">ชื่อบัญชี</Label>
              <Input
                id="bank-accname"
                value={bankInfo.account_name}
                onChange={(e) => setBankInfo({ ...bankInfo, account_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promptpay">เลขพร้อมเพย์ (สำหรับสร้าง QR)</Label>
              <Input
                id="promptpay"
                inputMode="numeric"
                value={bankInfo.promptpay_id || ''}
                onChange={(e) => setBankInfo({ ...bankInfo, promptpay_id: e.target.value })}
                placeholder="เบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก"
              />
              <p className="text-muted-foreground text-xs">
                ใส่แล้วระบบจะสร้าง QR พร้อมยอดเงินให้อัตโนมัติในหน้าใบสรุปของลูกค้า
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping">ค่าจัดส่ง (บาท)</Label>
              <Input
                id="shipping"
                type="number"
                value={bankInfo.shipping_fee}
                onChange={(e) => setBankInfo({ ...bankInfo, shipping_fee: Number(e.target.value) })}
              />
            </div>
          </ResponsiveModalBody>

          <ResponsiveModalFooter className="flex gap-2">
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => setIsBankModalOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button size="lg" className="flex-1" onClick={saveSettings} disabled={isSavingSettings}>
              {isSavingSettings ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              บันทึก
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* ── เพิ่ม / แก้ไขสายพันธุ์ ── */}
      <ResponsiveModal
        open={isBreedModalOpen}
        onOpenChange={(open) => {
          setIsBreedModalOpen(open);
          if (!open) setEditingBreed(null);
        }}
      >
        <ResponsiveModalContent className="sm:max-w-lg">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>
              {editingBreed ? 'แก้ไขสายพันธุ์' : 'เพิ่มสายพันธุ์ใหม่'}
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <ResponsiveModalBody>
            <form id="breedForm" onSubmit={handleAddOrUpdateBreed} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="breed-name">ชื่อสายพันธุ์ *</Label>
                <Input
                  id="breed-name"
                  name="name"
                  defaultValue={editingBreed?.name}
                  required
                  placeholder="เช่น Full Gold"
                />
              </div>

              <div className="space-y-3">
                {TYPES.map((t) => (
                  <div key={t} className="rounded-lg border p-3">
                    <p className="mb-2 text-sm font-medium">
                      ราคาต่อ{TYPE_LABEL[t]}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`price-${t}`} className="text-muted-foreground text-xs">
                          ราคาขาย
                        </Label>
                        <Input
                          id={`price-${t}`}
                          name={`premium_price_${t}`}
                          type="number"
                          inputMode="numeric"
                          defaultValue={(editingBreed?.[priceField(t)] as number) || ''}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`cost-${t}`} className="text-muted-foreground text-xs">
                          ต้นทุน
                        </Label>
                        <Input
                          id={`cost-${t}`}
                          name={`premium_cost_${t}`}
                          type="number"
                          inputMode="numeric"
                          defaultValue={(editingBreed?.[costField(t)] as number) || ''}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </form>
          </ResponsiveModalBody>

          <ResponsiveModalFooter className="flex gap-2">
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => {
                setIsBreedModalOpen(false);
                setEditingBreed(null);
              }}
            >
              ยกเลิก
            </Button>
            <Button type="submit" form="breedForm" size="lg" className="flex-1">
              <Save className="size-4" />
              {editingBreed ? 'อัปเดต' : 'เพิ่มปลา'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </Layout>
  );
}
