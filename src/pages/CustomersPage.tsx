import { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, MapPin, Phone, Save } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import Layout from './Layout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchInput } from '@/components/ui/search-input';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/page-loader';
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  created_at: string;
  // คำนวณสดจาก view customer_order_stats ไม่ใช่คอลัมน์ในตาราง customers
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
}

type CustomerSortKey = 'name' | 'total_spent' | 'total_orders' | 'last_order_at';

const SORT_OPTIONS: { key: CustomerSortKey; label: string }[] = [
  { key: 'total_spent', label: 'ยอดซื้อ' },
  { key: 'total_orders', label: 'จำนวนออเดอร์' },
  { key: 'last_order_at', label: 'ซื้อล่าสุด' },
  { key: 'name', label: 'ชื่อ' },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<CustomerSortKey>('total_spent');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const [{ data, error }, { data: stats, error: statsError }] = await Promise.all([
        supabase.from('customers').select('*').order('name'),
        supabase.from('customer_order_stats').select('*'),
      ]);

      if (error) throw error;
      if (statsError) throw statsError;

      const byCustomer = new Map((stats || []).map((s: any) => [s.customer_id, s]));

      setCustomers(
        (data || []).map((c: any) => {
          const s = byCustomer.get(c.id);
          return {
            ...c,
            total_orders: Number(s?.total_orders ?? 0),
            total_spent: Number(s?.total_spent ?? 0),
            last_order_at: s?.last_order_at ?? null,
          };
        })
      );
    } catch (err) {
      console.error('Fetch customers error:', err);
      toast.error('โหลดข้อมูลลูกค้าไม่สำเร็จ ลองรีเฟรชอีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        address: customer.address || '',
      });
    } else {
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', address: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', address: '' });
  };

  const saveCustomer = async () => {
    if (!formData.name.trim()) {
      toast.error('กรุณากรอกชื่อลูกค้า');
      return;
    }

    if (!formData.phone.trim()) {
      toast.error('กรุณากรอกเบอร์โทรศัพท์');
      return;
    }

    setSaving(true);
    try {
      if (editingCustomer) {
        // Update existing
        const { error } = await supabase
          .from('customers')
          .update({
            name: formData.name,
            phone: formData.phone || null,
            address: formData.address || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCustomer.id);

        if (error) throw error;
        toast.success('แก้ไขลูกค้าสำเร็จ');
      } else {
        // Create new
        const { error } = await supabase.from('customers').insert({
          name: formData.name,
          phone: formData.phone || null,
          address: formData.address || null,
        });

        if (error) throw error;
        toast.success('เพิ่มลูกค้าสำเร็จ');
      }

      closeModal();
      fetchCustomers();
    } catch (err) {
      console.error('Save customer error:', err);
      toast.error('ไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  const deleteCustomer = async (id: string) => {
    if (!confirm('ต้องการลบลูกค้านี้ใช่หรือไม่?')) return;

    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);

      if (error) throw error;
      toast.success('ลบลูกค้าสำเร็จ');
      fetchCustomers();
    } catch (err) {
      console.error('Delete customer error:', err);
      toast.error('ลบไม่สำเร็จ');
    }
  };

  const searched = searchTerm.trim()
    ? customers.filter(
        (c) =>
          c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone?.includes(searchTerm)
      )
    : customers;

  // Sort: name ascending (A→Z), everything else descending (most first)
  const filteredCustomers = [...searched].sort((a, b) => {
    if (sortKey === 'name') return (a.name || '').localeCompare(b.name || '', 'th');
    if (sortKey === 'last_order_at') {
      return new Date(b.last_order_at || 0).getTime() - new Date(a.last_order_at || 0).getTime();
    }
    return (b[sortKey] || 0) - (a[sortKey] || 0);
  });

  // Summary across the searched set
  const totalRevenue = searched.reduce((sum, c) => sum + (c.total_spent || 0), 0);
  const activeCount = searched.filter((c) => (c.total_orders || 0) > 0).length;

  if (loading) {
    return (
      <Layout>
        <PageLoader />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-4">
        <PageHeader
          title="ลูกค้า"
          description="จัดการข้อมูลลูกค้าประจำของร้าน"
          action={
            <Button className="w-full sm:w-auto" onClick={() => openModal()}>
              <Plus className="size-4" /> เพิ่มลูกค้า
            </Button>
          }
        />

        <div className="bg-background/95 sticky top-header z-20 -mx-4 space-y-2 px-4 py-3 backdrop-blur-md">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="ค้นหาชื่อหรือเบอร์โทร…"
          />
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
            <span className="text-muted-foreground self-center pr-1 text-xs whitespace-nowrap">
              เรียงตาม
            </span>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortKey(opt.key)}
                className={cn(
                  'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors',
                  sortKey === opt.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground hover:bg-accent'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span>
            พบ <span className="text-foreground font-medium">{filteredCustomers.length}</span> รายการ
          </span>
          <span>ซื้อแล้ว {activeCount} คน</span>
          <span className="text-success font-medium">รวมยอดซื้อ ฿{totalRevenue.toLocaleString()}</span>
        </div>

        {filteredCustomers.length === 0 ? (
          <Card>
            <EmptyState
              icon={Users}
              title={searchTerm ? 'ไม่พบลูกค้าที่ค้นหา' : 'ยังไม่มีลูกค้า'}
              description={searchTerm ? 'ลองค้นด้วยเบอร์โทรแทน' : 'กดปุ่มเพิ่มลูกค้าเพื่อเริ่มต้น'}
            />
          </Card>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {filteredCustomers.map((customer) => (
              <Card key={customer.id} className="gap-0 py-0">
                <CardContent className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 truncate font-medium">{customer.name}</h3>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="แก้ไข"
                        onClick={() => openModal(customer)}
                      >
                        <Edit2 className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="ลบ"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => deleteCustomer(customer.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="text-muted-foreground mt-1.5 space-y-1 text-sm">
                    {customer.phone && (
                      <a
                        href={`tel:${customer.phone.replace(/[^\d+]/g, '')}`}
                        className="hover:text-primary flex w-fit items-center gap-1.5 hover:underline"
                      >
                        <Phone className="size-3.5 shrink-0" />
                        {customer.phone}
                      </a>
                    )}
                    {customer.address && (
                      <p className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" />
                        <span className="line-clamp-2">{customer.address}</span>
                      </p>
                    )}
                  </div>

                  <div className="text-muted-foreground mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2.5 text-xs">
                    <span>{customer.total_orders || 0} ออเดอร์</span>
                    <span className="text-foreground font-medium">
                      ฿{(customer.total_spent || 0).toLocaleString()}
                    </span>
                    {customer.last_order_at && (
                      <span>
                        ล่าสุด {new Date(customer.last_order_at).toLocaleDateString('th-TH')}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ResponsiveModal open={isModalOpen} onOpenChange={(open) => (open ? null : closeModal())}>
        <ResponsiveModalContent className="sm:max-w-md">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>
              {editingCustomer ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้าใหม่'}
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <ResponsiveModalBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="c-name">ชื่อลูกค้า *</Label>
              <Input
                id="c-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="กรอกชื่อลูกค้า"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="c-phone">เบอร์โทร *</Label>
              <Input
                id="c-phone"
                type="tel"
                inputMode="numeric"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value.replace(/[^\d]/g, '') })
                }
                placeholder="กรอกเบอร์โทร"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="c-address">ที่อยู่</Label>
              <Textarea
                id="c-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="กรอกที่อยู่"
                rows={3}
              />
            </div>
          </ResponsiveModalBody>

          <ResponsiveModalFooter className="flex gap-2">
            <Button variant="outline" size="lg" className="flex-1" onClick={closeModal}>
              ยกเลิก
            </Button>
            <Button size="lg" className="flex-1" onClick={saveCustomer} disabled={saving}>
              <Save className="size-4" />
              {editingCustomer ? 'บันทึก' : 'เพิ่มลูกค้า'}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </Layout>
  );
}
