import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bell,
  BellOff,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  Edit2,
  HeartCrack,
  Loader2,
  MapPinOff,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { buildOrderMessage, buildOrderLinkMessage, calculateItemTotal } from '@/utils/message';
import { getLiffOrderUrl } from '@/utils/liff';
import { getPublicOrderUrl } from '@/utils/publicUrl';
import type { OrderItem, SavedOrder, Breed, OrderStatus, PaymentStatus } from '@/types';
import Layout from './Layout';
import PendingSlips from '@/components/PendingSlips';
import ClaimsPanel, { fetchClaims } from '@/components/ClaimsPanel';
import FailedNotifications from '@/components/FailedNotifications';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { SearchInput } from '@/components/ui/search-input';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/page-loader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

type BadgeVariant = React.ComponentProps<typeof Badge>['variant'];

/**
 * จำนวนปลาจริงในบิล — คู่นับ 2 ชุดนับ 3 และ "ไม่นับอาหาร"
 *
 * คำนวณสดจากรายการแทนการอ่านคอลัมน์ total_fish เพราะบิลที่เคยผ่านหน้าแก้ไข
 * ก่อนแก้บั๊กนี้ ถูกบันทึกจำนวนปลารวมอาหารไปด้วย ตัวเลขในฐานข้อมูลจึงเชื่อไม่ได้
 */
const fishCountOf = (items: OrderItem[] = []) =>
  items.reduce((sum, item) => {
    if (item.kind === 'food') return sum;
    return sum + item.quantity * (item.type === 'piece' ? 1 : item.type === 'pair' ? 2 : 3);
  }, 0);

const STATUS_META: Record<OrderStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: '📦 รอส่ง', variant: 'warning' },
  shipped: { label: '🚚 ส่งแล้ว', variant: 'soft' },
  delivered: { label: '✅ ถึงแล้ว', variant: 'success' },
  cancelled: { label: '✖ ยกเลิก', variant: 'muted' },
};

const PAYMENT_META: Record<PaymentStatus, { label: string; variant: BadgeVariant }> = {
  unpaid: { label: '⏳ ยังไม่จ่าย', variant: 'danger' },
  deposit: { label: '💵 มัดจำ', variant: 'warning' },
  paid: { label: '💰 จ่ายแล้ว', variant: 'success' },
};

const PERIODS = [
  { key: 'today', label: 'วันนี้' },
  { key: 'week', label: '7 วัน' },
  { key: 'month', label: 'เดือนนี้' },
  { key: 'year', label: 'ปีนี้' },
  { key: 'custom', label: 'เลือกวัน' },
] as const;

const PAYMENT_FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'unpaid', label: '⏳ ยังไม่จ่าย' },
  { key: 'deposit', label: '💵 มัดจำ' },
  { key: 'paid', label: '💰 จ่ายแล้ว' },
] as const;

/** ตัวเลขสรุปหนึ่งช่องบนหน้าแดชบอร์ด */
function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'primary' | 'success' | 'warning' | 'destructive';
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="px-3.5 py-3">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          className={cn(
            'mt-1 text-xl font-semibold tabular-nums sm:text-2xl',
            accent === 'primary' && 'text-primary',
            accent === 'success' && 'text-success',
            accent === 'warning' && 'text-warning',
            accent === 'destructive' && 'text-destructive'
          )}
        >
          {value}
        </p>
        {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  // State
  const [allOrders, setAllOrders] = useState<SavedOrder[]>([]);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [bankInfo, setBankInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adminView, setAdminView] = useState<'orders' | 'dashboard' | 'slips'>('orders');
  const [reportPeriod, setReportPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>(
    'today'
  );
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentStatus>('all');
  // สลิปที่ยืนยันแล้ว แมปด้วย order_id เพื่อโชว์ปุ่มดูสลิปในบิล
  const [orderSlips, setOrderSlips] = useState<
    Record<string, { image_path: string; reviewed_by: string | null; reviewed_at: string | null }>
  >({});
  const [slipModalUrl, setSlipModalUrl] = useState<string | null>(null);
  // จำนวนสลิปที่รอกดยืนยัน ไว้ขึ้นตัวเลขบนแท็บ
  // นับแยกจาก PendingSlips เพราะ Radix ถอดคอมโพเนนต์ในแท็บที่ไม่ได้เปิดออกจาก DOM
  // ถ้าไปพึ่งค่าจากในนั้น ตัวเลขจะไม่ขึ้นเลยจนกว่าจะกดเข้าแท็บสลิปก่อน — ซึ่งกลับหัวกลับหาง
  const [pendingSlipCount, setPendingSlipCount] = useState(0);
  const [copiedAddressId, setCopiedAddressId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [missingAddressOnly, setMissingAddressOnly] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<SavedOrder | null>(null);
  const [orderToUnlink, setOrderToUnlink] = useState<SavedOrder | null>(null);
  // ปุ่มส่งเลขพัสดุซ้ำของบิลไหนกำลังทำงานอยู่
  const [resendingId, setResendingId] = useState<string | null>(null);
  // เวลาที่เพิ่งส่งข้อความ "จัดส่งแล้ว" ของแต่ละบิล
  //
  // กดปุ่ม "ส่งซ้ำ" ตอนที่เพิ่งพิมพ์เลขในช่องข้าง ๆ จะเกิด blur → บันทึก+ส่ง ก่อนหนึ่งที
  // แล้วคลิกค่อยมาถึง = ลูกค้าได้ข้อความเดียวกันสองครั้ง และกิน push โควต้าฟรีสองใบ
  const lastNoticeRef = useRef<Record<string, number>>({});
  // เคลมปลาตาย — บิลที่กำลังบันทึก พร้อมค่าที่กรอก
  const [claimOrder, setClaimOrder] = useState<SavedOrder | null>(null);
  // กรอกทีละสายพันธุ์ไม่ได้ บิลหนึ่งตายได้หลายพันธุ์ — เก็บเป็น map ชื่อพันธุ์ → ที่กรอกไว้
  const [claimRows, setClaimRows] = useState<Record<string, { qty: string; refund: string }>>({});
  // เคลมของแต่ละบิล ไว้ติดป้ายบนการ์ด
  const [orderClaims, setOrderClaims] = useState<Record<string, { dead: number; refund: number }>>({});
  const [claimNote, setClaimNote] = useState('');
  const [savingClaim, setSavingClaim] = useState(false);
  const [claimsVersion, setClaimsVersion] = useState(0);
  const [claimTotals, setClaimTotals] = useState({ dead: 0, refund: 0 });
  // ช่วงเวลาที่กดใช้แล้วจริง ๆ ไม่ใช่ค่าที่กำลังพิมพ์อยู่ในช่องวันที่
  // แยกไว้เพราะ setReportPeriod ยังไม่มีผลทันทีตอนกดปุ่ม อ่าน state ตอนนั้นจะได้ค่าเก่า
  const [appliedRange, setAppliedRange] = useState<[string?, string?]>([]);
  const [deleting, setDeleting] = useState(false);

  // Edit state
  const [editingOrder, setEditingOrder] = useState<SavedOrder | null>(null);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editCopySuccess, setEditCopySuccess] = useState(false);
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  // ฟอร์มแก้ไขแบบ controlled — เลิกอ่านค่าด้วย getElementById ที่เปราะและพลาดง่าย
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editActualShipping, setEditActualShipping] = useState('');
  const [editDiscount, setEditDiscount] = useState('');

  // Load data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: breedsData } = await supabase.from('breeds').select('*').order('name');
      setBreeds(breedsData || []);

      // โหลดข้อมูลบัญชี/ค่าส่ง สำหรับใส่ในข้อความ Copy
      const { data: settingsData } = await supabase.from('settings').select('*').limit(1);
      if (settingsData && settingsData.length > 0) {
        setBankInfo(settingsData[0]);
      }

      await loadAllOrders(reportPeriod);
      setAppliedRange(rangeFor(reportPeriod, startDate, endDate));
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('โหลดข้อมูลไม่สำเร็จ — ข้อมูลที่เห็นอาจไม่ครบ ลองรีเฟรชอีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  const loadAllOrders = async (
    period: 'today' | 'week' | 'month' | 'year' | 'custom' = 'today',
    customStart?: string,
    customEnd?: string
  ) => {
    try {
      let query = supabase.from('orders').select('*').order('created_at', { ascending: false });

      const now = new Date();
      if (period === 'today') {
        // ห้ามใช้ toISOString().split('T')[0] — มันให้ "วันที่ตาม UTC"
        // ไทยเร็วกว่า UTC 7 ชม. ตอนตี 2 ของวันที่ 2 มันจะได้วันที่ 1 กลับมา
        // ทำให้ยอด "วันนี้" ลากยอดเมื่อวานตั้งแต่ 7 โมงเช้ามารวมด้วย
        // และช่วงเที่ยงวันถึงเที่ยงคืน ยอดที่ขายหลังเที่ยงคืนก็จะหายไปจากรายงาน
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        query = query.gte('created_at', todayStart.toISOString());
      } else if (period === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', weekAgo);
      } else if (period === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        query = query.gte('created_at', monthStart);
      } else if (period === 'year') {
        const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
        query = query.gte('created_at', yearStart);
      } else if (period === 'custom' && customStart && customEnd) {
        // ค่าจาก <input type="date"> เป็นวันที่เปล่า ๆ ถ้าส่งดิบ ๆ ฐานข้อมูลจะอ่านเป็น UTC
        // แปลงเป็นเที่ยงคืน–เที่ยงคืนตามเวลาเครื่องก่อน ช่วงที่ได้จะตรงกับวันจริงของร้าน
        query = query
          .gte('created_at', new Date(`${customStart}T00:00:00`).toISOString())
          .lte('created_at', new Date(`${customEnd}T23:59:59.999`).toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const transformedData = (data || []).map((order: any) => ({
        id: order.id,
        created_at: order.created_at,
        items: order.items,
        totalAmount: order.total_amount || 0,
        totalFish: order.total_fish || 0,
        shippingFee: order.shipping_fee ?? 60,
        actualShippingFee: order.actual_shipping_fee,
        totalCost: order.total_cost || 0,
        discount: order.discount || 0,
        orderNumber: order.order_number,
        publicToken: order.public_token,
        lineUserId: order.line_user_id,
        status: order.status,
        paymentStatus: order.payment_status,
        paidAmount: order.paid_amount || 0,
        trackingNumber: order.tracking_number,
        customerId: order.customer_id,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        customerAddress: order.customer_address,
        lineDisplayName: order.line_display_name,
        note: order.note,
      }));

      setAllOrders(transformedData);

      // แมปสลิปที่ยืนยันแล้วเข้ากับบิล ไว้โชว์ปุ่ม "ดูสลิป"
      const orderIds = transformedData.map((o: any) => o.id);
      if (orderIds.length > 0) {
        const { data: slipRows } = await supabase
          .from('payment_slips')
          .select('order_id, image_path, reviewed_by, reviewed_at')
          .eq('status', 'confirmed')
          .in('order_id', orderIds);
        const map: Record<string, any> = {};
        (slipRows || []).forEach((r: any) => {
          if (r.order_id) map[r.order_id] = r;
        });
        setOrderSlips(map);
      } else {
        // ช่วงนี้ไม่มีบิล — ล้างสลิปของช่วงก่อนทิ้ง ไม่งั้นแมปเก่าค้างอยู่
        setOrderSlips({});
      }

      await loadPendingSlipCount();
    } catch (err) {
      console.error('Load all orders error:', err);
      // เดิมเงียบสนิท หน้าจะโชว์ "ไม่มีบิล" เหมือนช่วงนั้นขายไม่ได้เลย
      // ทั้งที่จริงคือโหลดไม่ผ่าน — ต่างกันคนละเรื่องสำหรับคนที่กำลังดูยอด
      toast.error('โหลดรายการบิลไม่สำเร็จ', {
        description: 'ตัวเลขที่เห็นอาจไม่ครบ กดปุ่มรีเฟรชอีกครั้งครับ',
      });
    }
  };

  // ปลดบัญชี LINE ออกจากบิล
  //
  // บิลผูกกับบัญชีแรกที่เปิดลิงก์ ซึ่งไม่ใช่ลูกค้าเสมอไป — ร้านเปิดเองเพื่อเช็ค
  // หรือลูกค้าส่งต่อให้คนอื่นกดก่อน ปลดแล้วคนถัดไปที่เปิดจะผูกใหม่ได้
  const unlinkLine = async () => {
    const order = orderToUnlink;
    if (!order) return;

    const { data, error } = await supabase.rpc('unlink_order_line_user', { p_order_id: order.id });
    if (error || !data?.ok) {
      toast.error('ปลดการผูกไม่สำเร็จ');
      return;
    }

    setAllOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, lineUserId: null, lineDisplayName: null } : o))
    );
    setOrderToUnlink(null);
    toast.success('ปลดการผูกแล้ว', { description: 'คนถัดไปที่เปิดลิงก์จะผูกกับบิลนี้แทน' });
  };

  // ช่วงเวลาเดียวกับที่ loadAllOrders ใช้ เพื่อให้ยอดเคลมกับยอดขายพูดถึงช่วงเดียวกัน
  // (เหตุผลเรื่อง timezone อยู่ในคอมเมนต์ของ loadAllOrders — อย่าใช้ toISOString().split)
  const rangeFor = (
    period: 'today' | 'week' | 'month' | 'year' | 'custom',
    from?: string,
    to?: string
  ): [string?, string?] => {
    const now = new Date();
    if (period === 'today')
      return [new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()];
    if (period === 'week') return [new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()];
    if (period === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1).toISOString()];
    if (period === 'year') return [new Date(now.getFullYear(), 0, 1).toISOString()];
    if (period === 'custom' && from && to)
      return [
        new Date(`${from}T00:00:00`).toISOString(),
        new Date(`${to}T23:59:59.999`).toISOString(),
      ];
    return [];
  };

  // เปิดกล่องเคลม — ตั้งค่าเริ่มต้นจากบิล
  const openClaim = (order: SavedOrder) => {
    setClaimOrder(order);
    setClaimRows({});
    setClaimNote('');
  };

  /** สายพันธุ์ปลาในบิล ไม่ซ้ำ — อาหารไม่นับ */
  const breedsOf = (order: SavedOrder | null) =>
    Array.from(
      new Set(
        (order?.items || [])
          .filter((i: OrderItem) => i.kind !== 'food')
          .map((i: OrderItem) => i.breedName)
      )
    );

  const setClaimRow = (breed: string, field: 'qty' | 'refund', value: string) =>
    setClaimRows((prev) => {
      const row = prev[breed] ?? { qty: '', refund: '' };
      return { ...prev, [breed]: { ...row, [field]: value } };
    });

  const claimDraftTotals = () => {
    let dead = 0;
    let refund = 0;
    for (const r of Object.values(claimRows)) {
      const q = Number(r.qty) || 0;
      if (q > 0) {
        dead += q;
        refund += Number(r.refund) || 0;
      }
    }
    return { dead, refund };
  };

  const saveClaim = async () => {
    if (!claimOrder) return;
    // แถวไหนกรอกจำนวนไว้ก็เป็นเคลมหนึ่งแถว — ตายหลายพันธุ์ก็บันทึกทีเดียวจบ
    const rows = Object.entries(claimRows)
      .map(([breed, r]) => ({ breed, qty: Number(r.qty) || 0, refund: Number(r.refund) || 0 }))
      .filter((r) => r.qty > 0);

    if (rows.length === 0) {
      toast.error('ใส่จำนวนปลาที่ตายอย่างน้อยหนึ่งสายพันธุ์ครับ');
      return;
    }

    setSavingClaim(true);
    const { error } = await supabase.from('claims').insert(
      rows.map((r) => ({
        order_id: claimOrder.id,
        breed_name: r.breed,
        dead_qty: r.qty,
        refund_amount: r.refund,
        note: claimNote.trim() || null,
        created_by: user?.username || null,
      }))
    );
    setSavingClaim(false);

    if (error) {
      toast.error('บันทึกเคลมไม่สำเร็จ');
      return;
    }

    setClaimOrder(null);
    setClaimsVersion((v) => v + 1);
    loadClaimTotals();
    loadOrderClaims();
    const t = rows.reduce((a, r) => ({ dead: a.dead + r.qty, refund: a.refund + r.refund }), { dead: 0, refund: 0 });
    toast.success(`บันทึกเคลมแล้ว — ตาย ${t.dead} ตัว`, {
      description: t.refund > 0 ? `คืน ฿${t.refund.toLocaleString()} · หักออกจากกำไรให้แล้ว` : undefined,
    });
  };

  // ช่วงเปลี่ยนเมื่อไหร่ก็ดึงเคลมใหม่ ทั้งยอดรวมและป้ายบนการ์ด
  // เดิมโหลดแค่ตอนเปิดหน้า พอสลับช่วงแล้วตัวเลขค้างของเดิมไว้
  useEffect(() => {
    // ตอนเพิ่งเปิดหน้ายังไม่ได้ตั้งช่วง ยิงตอนนี้จะได้เคลมทั้งหมดตั้งแต่เปิดร้าน
    // มาแวบหนึ่งก่อนค่าจริงจะมาทับ
    if (appliedRange.length === 0) return;
    loadClaimTotals();
    loadOrderClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedRange]);

  // เคลมของแต่ละบิลที่แสดงอยู่ ไว้ติดป้ายบนการ์ด
  // ดึงทีเดียวทั้งช่วง ไม่ยิงทีละบิล
  const loadOrderClaims = async () => {
    try {
      const rows = await fetchClaims(...appliedRange);
      const map: Record<string, { dead: number; refund: number }> = {};
      for (const c of rows) {
        const cur = map[c.order_id] || { dead: 0, refund: 0 };
        map[c.order_id] = { dead: cur.dead + c.dead_qty, refund: cur.refund + c.refund_amount };
      }
      setOrderClaims(map);
    } catch {
      setOrderClaims({});
    }
  };

  // ยอดเคลมรวมของช่วงที่เลือก — เอาไปหักกำไรในหน้าสรุป
  const loadClaimTotals = async () => {
    try {
      const rows = await fetchClaims(...appliedRange);
      setClaimTotals({
        dead: rows.reduce((sum, c) => sum + c.dead_qty, 0),
        refund: rows.reduce((sum, c) => sum + c.refund_amount, 0),
      });
    } catch {
      // โหลดยอดเคลมพลาดไม่ควรทำให้หน้าสรุปพัง แค่ถือว่ายังไม่มี
      setClaimTotals({ dead: 0, refund: 0 });
    }
  };

  // นับสลิปที่รอตรวจ — head:true คือขอแค่จำนวน ไม่ดึงแถวจริงมาให้เปลืองเน็ต
  const loadPendingSlipCount = async () => {
    const { count, error } = await supabase
      .from('payment_slips')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (!error) setPendingSlipCount(count || 0);
  };

  // ดึงบิลใหม่ตามช่วงเวลาที่เลือกอยู่ — เดิมต้องรีโหลดทั้งหน้าถึงจะเห็นบิลที่เพิ่งออก
  const refresh = async () => {
    setRefreshing(true);
    await loadAllOrders(reportPeriod, startDate, endDate);
    setRefreshing(false);
    toast.success('อัปเดตข้อมูลแล้ว');
  };

  // คัดลอกที่อยู่จัดส่ง เรียง เบอร์ / ชื่อ / ที่อยู่ ไว้แปะฟอร์มส่งพัสดุได้เลย
  //
  // ชื่อวางรูปแบบเดียวกับที่แสดงในการ์ด: ชื่อจริง (ชื่อ LINE)
  // ร้านจะได้เห็นว่าบิลนี้คุยกับใครตอนไล่พิมพ์ใบแปะกล่อง ไม่ต้องเปิดสลับหน้าจอ
  // ถ้าไม่มีชื่อจริง ชื่อ LINE ยืนเดี่ยวแทน
  const nameLine = (order: SavedOrder) => {
    const name = order.customerName?.trim();
    const line = order.lineDisplayName?.trim();
    if (name && line) return `${name} (${line})`;
    return name || line || '';
  };

  const formatAddress = (order: SavedOrder) =>
    [order.customerPhone, nameLine(order), order.customerAddress]
      .map((v) => (v || '').trim())
      .filter(Boolean)
      .join('\n');

  const copyAddress = async (order: SavedOrder) => {
    const text = formatAddress(order);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddressId(order.id);
      setTimeout(() => setCopiedAddressId(null), 2000);
    } catch {
      toast.error('คัดลอกไม่สำเร็จ');
    }
  };

  // คัดลอกที่อยู่ทุกบิลที่แสดงอยู่ (ตามช่วงเวลา/ฟิลเตอร์ที่เลือก) ทีเดียว
  // แต่ละบิลคั่นด้วยเลขบิล + เส้นแบ่ง ไว้ไล่พิมพ์ที่อยู่ส่งพัสดุเป็นชุด
  const copyAllAddresses = async (orders: SavedOrder[]) => {
    const blocks = orders
      .filter((o) => o.customerAddress?.trim() || o.customerPhone?.trim())
      .map((o) => formatAddress(o));
    if (blocks.length === 0) {
      toast.error('ไม่มีบิลที่มีที่อยู่ให้คัดลอก');
      return;
    }
    try {
      await navigator.clipboard.writeText(blocks.join('\n──────────\n'));
      toast.success(`คัดลอกที่อยู่ ${blocks.length} บิลแล้ว`);
    } catch {
      toast.error('คัดลอกไม่สำเร็จ');
    }
  };

  // เปิดรูปสลิปเป็น modal ในหน้าเดียว ไม่เด้งแท็บใหม่
  // บัคเก็ต private ต้องขอ signed URL ตอนกด
  const viewSlip = async (orderId: string) => {
    const slip = orderSlips[orderId];
    if (!slip) return;
    setSlipModalUrl('loading');
    const { data, error } = await supabase.storage.from('slips').createSignedUrl(slip.image_path, 300);
    if (error || !data?.signedUrl) {
      setSlipModalUrl(null);
      toast.error('เปิดสลิปไม่สำเร็จ');
      return;
    }
    setSlipModalUrl(data.signedUrl);
  };

  // Function สำหรับดึงค่าต้นทุนจาก breed โดยตรง (ไม่ดึงจาก item.cost)
  const getItemCost = (breedId: string, type: string): number => {
    if (!breedId) return 0;
    const breed = breeds.find((b: Breed) => b.id === breedId);
    if (!breed) return 0;
    return type === 'piece'
      ? breed.premium_cost_piece || 0
      : type === 'pair'
        ? breed.premium_cost_pair || 0
        : breed.premium_cost_set || 0;
  };

  // ต้นทุนต่อหน่วย: ปลาดึงจาก breed, อาหารใช้ต้นทุนที่บันทึกไว้ในรายการ (ไม่มี breed)
  const resolveItemCost = (item: OrderItem): number =>
    item.kind === 'food' ? item.cost || 0 : item.breedId ? getItemCost(item.breedId, item.type) : 0;

  // อัปเดตสถานะแบบ optimistic แล้ว rollback ถ้าเซิร์ฟเวอร์ปฏิเสธ
  const setOrderStatus = async (order: SavedOrder, status: OrderStatus) => {
    const previous = allOrders;
    setAllOrders((orders) => orders.map((o) => (o.id === order.id ? { ...o, status } : o)));

    const { error } = await supabase.from('orders').update({ status }).eq('id', order.id);
    if (error) {
      setAllOrders(previous);
      toast.error('อัปเดตสถานะไม่สำเร็จ');
    }
  };

  const setPaymentStatus = async (order: SavedOrder, paymentStatus: PaymentStatus) => {
    // จ่ายครบ = ยอดที่จ่ายเท่ายอดบิล, ยังไม่จ่าย = 0, มัดจำปล่อยให้กรอกเอง
    const paidAmount =
      paymentStatus === 'paid'
        ? order.totalAmount || 0
        : paymentStatus === 'unpaid'
          ? 0
          : order.paidAmount || 0;

    const previous = allOrders;
    setAllOrders((orders) =>
      orders.map((o) => (o.id === order.id ? { ...o, paymentStatus, paidAmount } : o))
    );

    const { error } = await supabase
      .from('orders')
      .update({ payment_status: paymentStatus, paid_amount: paidAmount })
      .eq('id', order.id);

    if (error) {
      setAllOrders(previous);
      toast.error('อัปเดตการชำระเงินไม่สำเร็จ');
    }
  };

  // เลขพัสดุนี้ถูกบิลอื่นถือครองอยู่ไหม — คืนบิลที่ถือถ้าชน
  //
  // เกณฑ์เดียวกับฝั่ง DB (sync_parcel_subscription): ลูกค้าคนเดียวกันส่งรวมกล่องได้
  // แถวกำพร้าเพราะบิลเดิมถูกลบก็ย้ายมาได้ ห้ามเฉพาะการแย่งจากบิลอื่นที่ยังอยู่
  //
  // อ่านรายการติดตามไม่ขึ้นก็ถือว่าไม่ผ่าน — fail closed
  // เดาว่า "คงไม่ชนหรอก" แล้วเขียนไปเลย คือท่าที่ทำให้เรื่องนี้เกิดตั้งแต่แรก
  const findTrackingConflict = async (order: SavedOrder, tracking: string) => {
    const { data: row, error } = await supabase
      .from('parcel_subscriptions')
      .select('order_id, line_user_id')
      .eq('tracking_number', tracking)
      .maybeSingle();

    if (error) return { unreadable: true, orderNumber: null };
    if (!row?.order_id) return null;
    if (row.order_id === order.id) return null;
    if (row.line_user_id === order.lineUserId) return null;

    const { data: holder } = await supabase
      .from('orders')
      .select('order_number')
      .eq('id', row.order_id)
      .maybeSingle();

    return { unreadable: false, orderNumber: (holder?.order_number as string | undefined) ?? null };
  };

  // ข้อความ "จัดส่งแล้ว" ลงคิว LINE พร้อมข้อความ/รูปที่ร้านตั้งไว้ในหน้าตั้งค่า
  //
  // ล้มเหลวตรงนี้ไม่ควรทำให้การบันทึกเลขพัสดุพัง — เลขบันทึกไปแล้วและติดตามได้แล้ว
  const queueShippingNotice = async (order: SavedOrder, tracking: string, subscribed: boolean) => {
    try {
      const { data: cfg } = await supabase
        .from('settings')
        .select('shipping_message, shipping_images')
        .limit(1)
        .maybeSingle();

      const extra = (cfg?.shipping_message || '').trim();
      const { error } = await supabase.from('line_notifications').insert({
        line_user_id: order.lineUserId,
        order_id: order.id,
        message:
          `🚚 จัดส่งแล้วครับ\n` +
          `บิล ${order.orderNumber}\n` +
          `เลขพัสดุ ${tracking}` +
          // ไม่สัญญาว่าจะแจ้งอัตโนมัติ ถ้าสมัครติดตามไม่ผ่าน
          (subscribed ? `\n\nระบบจะแจ้งความคืบหน้าให้อัตโนมัติ 🔔` : '') +
          (extra ? `\n\n${extra}` : ''),
        images: cfg?.shipping_images || [],
      });

      if (error) throw error;
      lastNoticeRef.current[order.id] = Date.now();
      return true;
    } catch (err) {
      console.error('[SHIPPING NOTICE]', err);
      return false;
    }
  };

  // กรอกเลขพัสดุ → บันทึกลงออเดอร์ แล้วสมัครติดตามให้บอท LINE ในคราวเดียว
  // บอท poll ตาราง parcel_subscriptions อยู่แล้ว จึงไม่ต้องมี API คั่นกลาง
  const saveTrackingNumber = async (order: SavedOrder, raw: string) => {
    const tracking = raw.trim().toUpperCase();
    if (!tracking) return;

    if (!/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(tracking)) {
      toast.error('รูปแบบเลขพัสดุไม่ถูกต้อง', { description: 'ต้องเป็นแบบ EX123456789TH' });
      return;
    }

    // เช็คก่อนเขียนอะไรทั้งสิ้น
    //
    // เขียนไปก่อนแล้วค่อยตีกลับตอนสมัครติดตามยังไม่พอ — เลขของลูกค้าคนอื่นจะค้างอยู่บน
    // ใบสรุปของบิลนี้ ซึ่งลูกค้าเปิดดูเองได้ตลอด และสถานะบิลก็เด้งเป็น "ส่งแล้ว" ทั้งที่ยังไม่ได้ส่ง
    // ความผิดพลาดถึงลูกค้าอยู่ดี แม้จะไม่ได้ push อะไรออกไป
    const conflict = await findTrackingConflict(order, tracking);
    if (conflict?.unreadable) {
      toast.error('เช็คเลขพัสดุไม่ได้ — ยังไม่ได้บันทึกอะไร', {
        description: 'อ่านรายการติดตามไม่ขึ้น ลองกดบันทึกใหม่อีกทีครับ',
        duration: 8000,
      });
      return;
    }
    if (conflict) {
      toast.error('เลขพัสดุนี้อยู่ในบิลอื่นแล้ว — ยังไม่ได้บันทึกอะไร', {
        description:
          `${conflict.orderNumber ? `บิล ${conflict.orderNumber}` : 'อีกบิลหนึ่ง'} ถืออยู่ — ` +
          'ถ้าตั้งใจย้ายมาบิลนี้ ให้กดปลดการผูกที่บิลนั้นก่อน',
        duration: 12000,
      });
      return;
    }

    const { error } = await supabase
      .from('orders')
      .update({ tracking_number: tracking, status: 'shipped' })
      .eq('id', order.id);

    if (error) {
      toast.error('บันทึกเลขพัสดุไม่สำเร็จ');
      return;
    }

    setAllOrders((orders) =>
      orders.map((o) =>
        o.id === order.id ? { ...o, trackingNumber: tracking, status: 'shipped' as OrderStatus } : o
      )
    );

    if (!order.lineUserId) {
      toast.warning('บันทึกเลขพัสดุแล้ว แต่ยังแจ้งเตือนอัตโนมัติไม่ได้', {
        description: 'ลูกค้ายังไม่เคยเปิดใบสรุปในแอป LINE — พอเปิดเมื่อไหร่ ระบบสมัครติดตามให้เอง',
        duration: 6000,
      });
      return;
    }

    // ฝั่ง DB เป็นคนตัดสินว่าสมัครติดตามได้ไหม และมี trigger คอยเรียกซ้ำให้เอง
    // ตอนลูกค้าเปิดใบสรุปผูกบัญชีทีหลัง — ที่นี่เรียกตรงเพื่อเอาเหตุผลมาบอกร้านทันที
    const { data: sub, error: subError } = await supabase.rpc('sync_parcel_subscription', {
      p_order_id: order.id,
    });

    const subscribed = !subError && sub?.ok === true;

    // ด่านสอง เผื่อการเช็คก่อนหน้าอ่านไม่ขึ้น หรือมีคนกรอกเลขเดียวกันคาบเกี่ยวกัน
    // ห้ามส่งอะไรถึงลูกค้าตรงนี้เด็ดขาด — ข้อความ LINE ถอนคืนไม่ได้
    // และเลขที่จะส่งไปเป็นของอีกบิลหนึ่ง ให้ร้านไปแก้ให้จบก่อนแล้วค่อยกดปุ่ม "ส่งซ้ำ"
    if (sub?.reason === 'taken_by_other_order') {
      toast.error('เลขพัสดุนี้อยู่ในบิลอื่น — ยังไม่ได้แจ้งลูกค้า', {
        description: `บิล ${sub.order_number ?? '—'} ถืออยู่ — ปลดการผูกที่บิลนั้นก่อน แล้วกดปุ่ม "ส่งซ้ำ" ที่บิลนี้`,
        duration: 12000,
      });
      return;
    }

    if (!subscribed) {
      // เลขไม่ได้ชนกับใคร แค่สมัครติดตามไม่ผ่าน — ข้อความยังถูกต้อง ส่งได้ตามปกติ
      // (ข้างล่างจะตัดบรรทัดสัญญาว่าจะแจ้งอัตโนมัติออกให้เอง)
      toast.error('บันทึกเลขพัสดุแล้ว แต่สมัครติดตามไม่สำเร็จ', {
        description: subError?.message ?? sub?.reason ?? 'ไม่ทราบสาเหตุ',
        duration: 8000,
      });
    }

    // แจ้งลูกค้าทันทีว่าส่งของแล้ว
    //
    // บอทที่ poll สถานะพัสดุจะเงียบจนกว่าไปรษณีย์จะสแกนครั้งแรก ซึ่งกินเวลาเป็นชั่วโมง
    // ลูกค้าที่เพิ่งคุยกับร้านอยู่ควรได้รู้ตั้งแต่ตอนนี้ว่าของออกไปแล้ว
    await queueShippingNotice(order, tracking, subscribed);

    if (subscribed) toast.success('บันทึกแล้ว — แจ้งลูกค้าและติดตามสถานะให้อัตโนมัติ');
  };

  // ส่งเลขพัสดุให้ลูกค้าใน LINE อีกรอบ
  //
  // ใช้ตอนกู้เคสที่การติดตามหลุดไปเงียบ ๆ — ลูกค้าเพิ่งมาผูกบัญชี LINE ทีหลัง
  // หรือเลขเคยถูกบิลอื่นยึดไป (บิลทดสอบที่กรอกเลขเดียวกัน)
  //
  // ซิงก์การติดตามก่อนส่งเสมอ ไม่งั้นข้อความไปถึงแต่บอทยังไม่ตามให้ = สัญญาลอย ๆ
  const resendTracking = async (order: SavedOrder) => {
    const tracking = order.trackingNumber?.trim().toUpperCase();
    if (!tracking || resendingId) return;

    const since = Date.now() - (lastNoticeRef.current[order.id] || 0);
    if (since < 5000) {
      toast.info('เพิ่งส่งไปเมื่อสักครู่', { description: 'ลูกค้าได้เลขพัสดุนี้ไปแล้ว' });
      return;
    }

    if (!order.lineUserId) {
      toast.warning('ยังส่งให้ไม่ได้', {
        description: 'บิลนี้ยังไม่ผูกบัญชี LINE — ให้ลูกค้าเปิดใบสรุปในแอป LINE ก่อน',
        duration: 6000,
      });
      return;
    }

    setResendingId(order.id);
    try {
      const { data: sub, error: subError } = await supabase.rpc('sync_parcel_subscription', {
        p_order_id: order.id,
      });
      const subscribed = !subError && sub?.ok === true;

      // ยังชนกับบิลอื่นอยู่ = ยังไม่ได้แก้ ไม่ส่งอะไรออกไปทั้งนั้น
      if (sub?.reason === 'taken_by_other_order') {
        toast.error('ยังส่งให้ไม่ได้ — เลขนี้อยู่ในบิลอื่น', {
          description: `บิล ${sub.order_number ?? '—'} ถืออยู่ — ปลดการผูกที่บิลนั้นก่อน แล้วค่อยกดส่งซ้ำ`,
          duration: 12000,
        });
        return;
      }

      if (!(await queueShippingNotice(order, tracking, subscribed))) {
        toast.error('ส่งเลขพัสดุไม่สำเร็จ');
        return;
      }

      // ส่งไปแล้วก็จริง แต่ถ้าติดตามไม่ผ่านต้องบอกร้าน ไม่งั้นเข้าใจว่าจบแล้ว
      if (!subscribed) {
        toast.warning('ส่งเลขให้ลูกค้าแล้ว แต่ยังติดตามอัตโนมัติไม่ได้', {
          description: subError?.message ?? sub?.reason ?? 'ไม่ทราบสาเหตุ',
          duration: 10000,
        });
        return;
      }

      toast.success('ส่งเลขพัสดุให้ลูกค้าอีกรอบแล้ว', {
        description: 'ติดตามสถานะให้อัตโนมัติเรียบร้อย',
      });
    } finally {
      setResendingId(null);
    }
  };


  // Dashboard stats
  const dashboardStats = useMemo(() => {
    const totalSales = allOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    let totalFish = 0;
    let totalFreeQty = 0; // จำนวนตัวที่แถมฟรี (แปลงคู่/ชุดเป็นตัวแล้ว)
    let totalFreeValue = 0; // มูลค่าของแถมฟรีรวม
    allOrders.forEach((order) => {
      order.items?.forEach((item: OrderItem) => {
        if (item.kind === 'food') return; // อาหารไม่นับเป็นจำนวนปลา/ของแถม
        const mult = item.type === 'piece' ? 1 : item.type === 'pair' ? 2 : 3;
        totalFish += item.quantity * mult;
        const free = item.freeQty || 0;
        if (free > 0) {
          totalFreeQty += free * mult;
          totalFreeValue += free * item.price;
        }
      });
    });

    let totalFishCost = 0;
    let totalFoodCost = 0; // แยกต้นทุนอาหารออก เพราะจ่ายคนละเจ้ากับปลา
    let totalFoodSales = 0;
    let totalProfit = 0;
    const totalShippingIncome = allOrders.reduce((sum, order) => sum + (order.shippingFee || 60), 0);
    const totalShippingCost = allOrders.reduce(
      (sum, order) =>
        sum +
        (order.actualShippingFee !== undefined && order.actualShippingFee !== null
          ? order.actualShippingFee
          : order.shippingFee || 60),
      0
    );

    allOrders.forEach((order) => {
      let orderFishCost = 0;
      let orderFoodCost = 0;
      order.items?.forEach((item: OrderItem) => {
        const c = resolveItemCost(item) * item.quantity;
        if (item.kind === 'food') {
          orderFoodCost += c;
          totalFoodSales += calculateItemTotal(item);
        } else {
          orderFishCost += c;
        }
      });

      totalFishCost += orderFishCost;
      totalFoodCost += orderFoodCost;

      const revenue = order.totalAmount || 0;
      const shipping =
        order.actualShippingFee !== undefined && order.actualShippingFee !== null
          ? order.actualShippingFee
          : order.shippingFee || 60;
      totalProfit += revenue - orderFishCost - orderFoodCost - shipping;
    });

    const avgOrderValue = allOrders.length > 0 ? totalSales / allOrders.length : 0;

    // Breed stats
    const breedStats: { [key: string]: { name: string; qty: number; sales: number; cost: number } } = {};
    allOrders.forEach((order) => {
      order.items.forEach((item: OrderItem) => {
        // อาหารไม่ใช่สายพันธุ์ปลา ไม่ควรไปแย่งอันดับใน "สายพันธุ์ขายดี"
        // (มียอดขาย/ต้นทุนอาหารแยกเป็นช่องของตัวเองอยู่แล้ว)
        if (item.kind === 'food') return;
        const statKey = item.breedId;

        if (!breedStats[statKey]) {
          breedStats[statKey] = { name: item.breedName, qty: 0, sales: 0, cost: 0 };
        }
        const paidQty = item.quantity - (item.freeQty || 0);
        const itemCost = resolveItemCost(item);
        breedStats[statKey].qty += item.quantity;
        breedStats[statKey].sales += item.price * paidQty - (item.discount || 0);
        breedStats[statKey].cost += itemCost * item.quantity;
      });
    });

    const topBreeds = Object.values(breedStats)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    // Customer stats
    const customerStats: {
      [key: string]: { name: string; orders: number; totalSpent: number; totalFish: number };
    } = {};
    allOrders.forEach((order) => {
      const customerName = order.customerName || 'ไม่ระบุชื่อ';
      if (!customerStats[customerName]) {
        customerStats[customerName] = { name: customerName, orders: 0, totalSpent: 0, totalFish: 0 };
      }
      customerStats[customerName].orders += 1;
      customerStats[customerName].totalSpent += order.totalAmount || 0;
      customerStats[customerName].totalFish += fishCountOf(order.items);
    });

    const topCustomers = Object.values(customerStats)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    return {
      totalOrders: allOrders.length,
      totalSales,
      totalFishCost,
      totalShippingIncome,
      totalShippingCost,
      totalFish,
      totalFreeQty,
      totalFreeValue,
      totalFoodCost,
      totalFoodSales,
      // หักเงินที่คืนลูกค้าตอนปลาตายออกจากกำไร
      // ไม่หักแล้วตัวเลขจะสูงเกินจริงทุกเดือน
      totalProfit: totalProfit - claimTotals.refund,
      totalRefund: claimTotals.refund,
      totalDeadFish: claimTotals.dead,
      avgOrderValue,
      topBreeds,
      topCustomers,
    };
  }, [allOrders, claimTotals]);

  // Order actions
  const updateOrder = async () => {
    if (!editingOrder) return;
    const orderId = editingOrder.id;
    try {
      const updatedItems = editItems;
      const updatedDiscount = Number(editDiscount) || 0;
      // ?? ไม่ใช่ || — บิลที่ค่าส่งเป็น 0 (ส่งฟรี) ต้องคงเป็น 0 ไม่ใช่เด้งเป็น 60
      const shippingFee = editingOrder.shippingFee ?? 60;

      // ใช้ calculateItemTotal ตัวเดียวกับตอนออกบิล ไม่งั้นรายการที่ส่วนลดเกินราคา
      // จะกลายเป็นยอดติดลบตอนแก้ไข ทั้งที่ตอนสร้างบิลถูกปัดเป็น 0
      //
      // Math.max(0) ครอบทั้งก้อนด้วย ให้ตรงกับตอนออกบิลที่หน้าขาย (grandTotal)
      // ส่วนลดท้ายบิลที่พิมพ์เกินยอด (1000 ในบิล 900) เคยบันทึกยอดติดลบลงฐานข้อมูลได้
      // แล้วหน้าลูกค้าจะโชว์ -฿100 พร้อม QR ที่สร้างไม่ได้
      const newTotalAmount = Math.max(
        0,
        updatedItems.reduce((sum, item) => sum + calculateItemTotal(item), 0) -
          updatedDiscount +
          shippingFee
      );

      const newTotalFish = fishCountOf(updatedItems);
      const newTotalCost = updatedItems.reduce((sum, item) => {
        const itemCost = resolveItemCost(item);
        return sum + itemCost * item.quantity;
      }, 0);
      const newActualShippingFee =
        editActualShipping.trim() !== '' ? Number(editActualShipping) : editingOrder.actualShippingFee;

      const { error } = await supabase
        .from('orders')
        .update({
          items: updatedItems,
          total_amount: newTotalAmount,
          total_fish: newTotalFish,
          total_cost: newTotalCost,
          actual_shipping_fee: newActualShippingFee,
          discount: updatedDiscount,
          customer_name: editName.trim() || null,
          customer_phone: editPhone.trim() || null,
          customer_address: editAddress.trim() || null,
          note: editNote.trim() || null,
        })
        .eq('id', orderId);

      if (error) throw error;

      setAllOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                items: updatedItems,
                totalAmount: newTotalAmount,
                totalFish: newTotalFish,
                totalCost: newTotalCost,
                actualShippingFee: newActualShippingFee,
                discount: updatedDiscount,
                customerName: editName.trim(),
                customerPhone: editPhone.trim(),
                customerAddress: editAddress.trim(),
                note: editNote.trim(),
              }
            : order
        )
      );

      toast.success('แก้ไขออเดอร์เรียบร้อย!');
      setIsEditingOrder(false);
      setEditingOrder(null);
    } catch (err) {
      console.error('Update order error:', err);
      toast.error('แก้ไขไม่สำเร็จ');
    }
  };

  // ลบบิลคือลบจริงจากฐานข้อมูล กู้คืนไม่ได้
  // confirm() ของเบราว์เซอร์ไม่บอกว่ากำลังลบใบไหน — บนมือถือกดพลาดแล้วจบเลย
  // จึงถามด้วยกล่องที่โชว์เลขบิล ชื่อลูกค้า และยอด ให้ตรวจก่อน
  const deleteOrder = async () => {
    const order = orderToDelete;
    if (!order) return;

    setDeleting(true);
    const { error } = await supabase.from('orders').delete().eq('id', order.id);
    setDeleting(false);

    if (error) {
      console.error('Delete order error:', error);
      toast.error('ลบไม่สำเร็จ');
      return;
    }

    setAllOrders((prev) => prev.filter((o) => o.id !== order.id));
    setOrderToDelete(null);
    toast.success(`ลบบิล ${order.orderNumber || ''} แล้ว`);
  };

  // Edit items helpers
  const openEditModal = (order: SavedOrder) => {
    setEditingOrder(order);
    setEditName(order.customerName || '');
    setEditPhone(order.customerPhone || '');
    setEditAddress(order.customerAddress || '');
    setEditNote(order.note || '');
    setEditActualShipping(order.actualShippingFee != null ? String(order.actualShippingFee) : '');
    setEditDiscount(order.discount ? String(order.discount) : '');
    // Recalculate prices from breed settings
    const itemsWithUpdatedPrices = (order.items || []).map((item: OrderItem) => {
      const breed = breeds.find((b: Breed) => b.id === item.breedId);
      if (breed) {
        const newPrice =
          item.type === 'piece'
            ? breed.premium_price_piece || 0
            : item.type === 'pair'
              ? breed.premium_price_pair || 0
              : breed.premium_price_set || 0;
        return { ...item, price: newPrice };
      }
      return item;
    });
    setEditItems(itemsWithUpdatedPrices);
    setIsEditingOrder(true);
  };

  const getItemPrice = (breedId: string, type: string) => {
    if (!breedId) return 0;
    const breed = breeds.find((b: Breed) => b.id === breedId);
    if (!breed) return 0;
    return type === 'piece'
      ? breed.premium_price_piece || 0
      : type === 'pair'
        ? breed.premium_price_pair || 0
        : breed.premium_price_set || 0;
  };

  const addEditItem = (breedId: string) => {
    const breed = breeds.find((b: Breed) => b.id === breedId);
    if (!breed) return;
    const newItem: OrderItem = {
      id: '',
      breedId,
      breedName: breed.name,
      price: getItemPrice(breed.id, 'piece'),
      quantity: 1,
      type: 'piece',
      gender: 'male',
      freeQty: 0,
      discount: 0,
    };
    setEditItems([...editItems, newItem]);
  };

  const removeEditItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const updateEditItem = (index: number, field: keyof OrderItem, value: any) => {
    const updated = [...editItems];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-update price when breed/type changes
    if (field === 'breedId' || field === 'type') {
      const item = updated[index];
      if (item.breedId) {
        updated[index].price = getItemPrice(item.breedId, item.type);

        if (field === 'breedId') {
          const breed = breeds.find((b: Breed) => b.id === item.breedId);
          if (breed) updated[index].breedName = breed.name;
        }
      }
    }

    setEditItems(updated);
  };

  if (loading) {
    return (
      <Layout>
        <PageLoader />
      </Layout>
    );
  }

  const byPayment =
    paymentFilter === 'all'
      ? allOrders
      : allOrders.filter((o) => (o.paymentStatus || 'unpaid') === paymentFilter);

  const searched = searchTerm.trim()
    ? byPayment.filter((order) => {
        const term = searchTerm.toLowerCase();
        // เบอร์โทรเทียบเฉพาะตัวเลข จะได้ค้น "081-234" กับ "081234" เจอเหมือนกัน
        // แต่เทียบต่อเมื่อคำค้นไม่มีตัวอักษรปนเลย ไม่งั้นค้น "EX9876" จะไปโดนเบอร์
        // ที่บังเอิญมีเลขเรียงกันแบบนั้นอยู่ข้างใน
        const digits = term.replace(/\D/g, '');
        const phoneLike = digits.length >= 3 && !/[a-z\u0E00-\u0E7F]/i.test(term);

        return (
          order.orderNumber?.toLowerCase().includes(term) ||
          order.customerName?.toLowerCase().includes(term) ||
          (phoneLike && !!order.customerPhone?.replace(/\D/g, '').includes(digits)) ||
          order.trackingNumber?.toLowerCase().includes(term) ||
          order.items?.some((item: OrderItem) => item.breedName?.toLowerCase().includes(term)) ||
          order.note?.toLowerCase().includes(term) ||
          order.customerAddress?.toLowerCase().includes(term) ||
          order.id?.toLowerCase().includes(term)
        );
      })
    : byPayment;

  // ── 3. บิลที่ลูกค้ายังไม่ส่งที่อยู่มา — ตัวที่ค้างแพ็คของอยู่จริง ๆ
  const filteredOrders = missingAddressOnly
    ? searched.filter((o) => !o.customerAddress?.trim())
    : searched;

  const missingAddressCount = allOrders.filter(
    (o) => !o.customerAddress?.trim() && o.status !== 'cancelled'
  ).length;

  const outstanding = allOrders
    .filter((o) => (o.paymentStatus || 'unpaid') !== 'paid' && o.status !== 'cancelled')
    .reduce((sum, o) => sum + Math.max(0, (o.totalAmount || 0) - (o.paidAmount || 0)), 0);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <PageHeader
          title="บิล & ยอดขาย"
          description="จัดการออเดอร์และดูสรุปผลของร้าน"
          action={
            <Button variant="outline" onClick={refresh} disabled={refreshing} className="w-full sm:w-auto">
              <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
              รีเฟรช
            </Button>
          }
        />

        {/* ช่วงเวลา — เลื่อนแนวนอนได้บนมือถือ */}
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                setReportPeriod(p.key);
                if (p.key !== 'custom') {
                  loadAllOrders(p.key);
                  setAppliedRange(rangeFor(p.key));
                }
              }}
              className={cn(
                'h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors',
                reportPeriod === p.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground hover:bg-accent'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {reportPeriod === 'custom' && (
          <Card className="gap-0 py-0">
            <CardContent className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="start-date">จากวันที่</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-date">ถึงวันที่</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <Button
                onClick={() => {
                  loadAllOrders('custom', startDate, endDate);
                  setAppliedRange(rangeFor('custom', startDate, endDate));
                }}
                disabled={!startDate || !endDate}
              >
                ดูรายงาน
              </Button>
            </CardContent>
          </Card>
        )}

        <FailedNotifications />

        <Tabs value={adminView} onValueChange={(v) => setAdminView(v as typeof adminView)}>
          <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:inline-flex">
            <TabsTrigger value="orders" onClick={() => loadAllOrders(reportPeriod)}>
              <ClipboardList className="size-4" /> รายการบิล
            </TabsTrigger>
            <TabsTrigger value="dashboard" onClick={() => loadAllOrders(reportPeriod)}>
              สรุปยอด
            </TabsTrigger>
            <TabsTrigger value="claims">
              <HeartCrack className="size-4" /> เคลม
            </TabsTrigger>
            <TabsTrigger value="slips">
              <Receipt className="size-4" /> สลิป
              {/* ขึ้นเฉพาะตอนมีของรอจริง ๆ — เลข 0 ค้างอยู่ตลอดจะกลายเป็นสิ่งที่ตาเลิกมอง */}
              {pendingSlipCount > 0 && (
                <span className="bg-destructive text-destructive-foreground ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums">
                  {pendingSlipCount > 99 ? '99+' : pendingSlipCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ───────── รายการบิล ───────── */}
          <TabsContent value="orders" className="mt-4 space-y-3">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="ค้นหาเลขบิล / ชื่อ / เบอร์โทร / สายพันธุ์…"
            />

            <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
              {PAYMENT_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setPaymentFilter(f.key as 'all' | PaymentStatus)}
                  className={cn(
                    'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors',
                    paymentFilter === f.key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground hover:bg-accent'
                  )}
                >
                  {f.label}
                </button>
              ))}

              <span className="bg-border mx-1 w-px shrink-0" aria-hidden />

              <button
                onClick={() => setMissingAddressOnly((v) => !v)}
                className={cn(
                  'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                  missingAddressOnly
                    ? 'bg-warning/15 text-warning border-warning/40'
                    : 'bg-card text-muted-foreground hover:bg-accent'
                )}
              >
                <MapPinOff className="size-3.5" />
                ยังไม่มีที่อยู่
                {missingAddressCount > 0 && ` (${missingAddressCount})`}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground text-sm">
                พบ {filteredOrders.length} รายการ
                {searchTerm && ` (จาก ${allOrders.length})`}
              </span>
              <div className="flex items-center gap-2">
                {outstanding > 0 && (
                  <Badge variant="danger">ค้างชำระ ฿{outstanding.toLocaleString()}</Badge>
                )}
                {filteredOrders.some(
                  (o: SavedOrder) => o.customerAddress?.trim() || o.customerPhone?.trim()
                ) && (
                  <Button variant="outline" size="sm" onClick={() => copyAllAddresses(filteredOrders)}>
                    <Copy className="size-3.5" /> คัดลอกที่อยู่ทั้งหมด
                  </Button>
                )}
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <Card>
                <EmptyState
                  icon={ClipboardList}
                  title="ไม่พบบิลในช่วงเวลานี้"
                  description="ลองเปลี่ยนช่วงเวลาหรือตัวกรองด้านบน"
                />
              </Card>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {filteredOrders.map((order, index) => {
                  // Calculate cost using getItemCost (breed-based)
                  const orderCost =
                    order.items?.reduce((sum: number, item: OrderItem) => {
                      const cost = resolveItemCost(item);
                      return sum + cost * item.quantity;
                    }, 0) || 0;
                  const shippingFee = order.shippingFee || 60;
                  const actualShipping =
                    order.actualShippingFee !== undefined && order.actualShippingFee !== null
                      ? order.actualShippingFee
                      : 0;
                  const orderProfit = (order.totalAmount || 0) - orderCost - (actualShipping || 0);
                  const payMeta = PAYMENT_META[(order.paymentStatus || 'unpaid') as PaymentStatus];
                  const statusMeta = STATUS_META[(order.status || 'pending') as OrderStatus];

                  return (
                    <Card key={order.id} className="gap-0 py-0">
                      <CardContent className="space-y-3 px-4 py-3.5">
                        {/* หัวบิล */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-primary font-semibold">
                              {order.orderNumber || `#${allOrders.length - index}`}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {new Date(order.created_at).toLocaleString('th-TH', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </p>
                          </div>
                          <p className="shrink-0 text-xl font-semibold tabular-nums">
                            ฿{(order.totalAmount || 0).toLocaleString()}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={payMeta.variant}>
                            {payMeta.label}
                            {order.paymentStatus === 'deposit' &&
                              (order.paidAmount || 0) > 0 &&
                              ` ฿${(order.paidAmount || 0).toLocaleString()}`}
                          </Badge>
                          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                          {orderSlips[order.id] && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => viewSlip(order.id)}
                              title={`อนุมัติโดย ${orderSlips[order.id].reviewed_by || '-'}`}
                            >
                              <Receipt className="size-3" /> ดูสลิป
                            </Button>
                          )}
                        </div>

                        {/* สถานะ — แก้ได้ทันที */}
                        <div className="grid grid-cols-2 gap-2">
                          <Select
                            value={order.paymentStatus || 'unpaid'}
                            onValueChange={(v) => setPaymentStatus(order, v as PaymentStatus)}
                          >
                            <SelectTrigger size="sm" className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unpaid">⏳ ยังไม่จ่าย</SelectItem>
                              <SelectItem value="deposit">💵 มัดจำ</SelectItem>
                              <SelectItem value="paid">💰 จ่ายแล้ว</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={order.status || 'pending'}
                            onValueChange={(v) => setOrderStatus(order, v as OrderStatus)}
                          >
                            <SelectTrigger size="sm" className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">📦 รอส่ง</SelectItem>
                              <SelectItem value="shipped">🚚 ส่งแล้ว</SelectItem>
                              <SelectItem value="delivered">✅ ถึงแล้ว</SelectItem>
                              <SelectItem value="cancelled">✖ ยกเลิก</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* เลขพัสดุ — กรอกแล้วบอท LINE จะเริ่มติดตามให้ลูกค้าทันที */}
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={order.trackingNumber || ''}
                            placeholder="เลขพัสดุ EX123456789TH"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                            }}
                            onBlur={(e) => {
                              const v = e.target.value.trim().toUpperCase();
                              if (v && v !== (order.trackingNumber || '')) saveTrackingNumber(order, v);
                            }}
                            className="h-9 flex-1 uppercase"
                          />
                          {/* ส่งเลขซ้ำ — ลูกค้าหาข้อความเก่าไม่เจอ หรือการติดตามหลุดไปแล้ว */}
                          {order.trackingNumber && order.lineUserId && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 shrink-0 px-2.5"
                              disabled={resendingId === order.id}
                              onClick={() => resendTracking(order)}
                              title="ส่งเลขพัสดุให้ลูกค้าใน LINE อีกรอบ พร้อมซ่อมการติดตามให้ด้วย"
                            >
                              {resendingId === order.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Send className="size-3.5" />
                              )}
                              ส่งซ้ำ
                            </Button>
                          )}
                          {order.lineUserId ? (
                            <Badge
                              variant="success"
                              title="ลูกค้าเชื่อม LINE แล้ว จะได้รับแจ้งเตือนอัตโนมัติ"
                            >
                              <Bell className="size-3" /> LINE
                            </Badge>
                          ) : (
                            <Badge
                              variant="muted"
                              title="ลูกค้ายังไม่เคยเปิดใบสรุปในแอป LINE จึงแจ้งเตือนอัตโนมัติไม่ได้"
                            >
                              <BellOff className="size-3" /> ไม่มี
                            </Badge>
                          )}
                        </div>

                        {/* เคลมของบิลนี้ — เห็นจากรายการได้เลยว่าใบไหนมีปลาตาย */}
                        {orderClaims[order.id] && (
                          <div className="bg-destructive/10 flex items-center gap-2 rounded-lg px-3 py-2">
                            <HeartCrack className="text-destructive size-4 shrink-0" />
                            <p className="text-destructive text-sm">
                              เคลม {orderClaims[order.id].dead} ตัว
                              {orderClaims[order.id].refund > 0 &&
                                ` · คืน ฿${orderClaims[order.id].refund.toLocaleString()}`}
                            </p>
                          </div>
                        )}

                        {/* ลูกค้า / ที่อยู่ */}
                        {(order.customerName ||
                          order.customerPhone ||
                          order.customerAddress ||
                          order.lineDisplayName) && (
                          <div className="bg-muted/50 relative rounded-lg px-3 py-2.5 text-sm">
                            {(order.customerName || order.lineDisplayName) && (
                              <p className="pr-24 font-medium">
                                {order.customerName?.trim() || order.lineDisplayName}
                                {/* ชื่อ LINE ต่อท้ายไว้เทียบว่าคุยอยู่กับบัญชีไหน
                                    ไม่ใช่ชื่อสำหรับจ่าหน้ากล่อง เลยทำให้จางกว่าชื่อจริง */}
                                {order.customerName?.trim() && order.lineDisplayName && (
                                  <span className="text-muted-foreground ml-1 text-xs font-normal">
                                    ({order.lineDisplayName})
                                  </span>
                                )}
                              </p>
                            )}
                            {/* ผูกผิดคนได้ง่าย — แค่ร้านเปิดลิงก์เองเพื่อเช็คก่อนส่ง
                                บิลก็ผูกกับ LINE ร้านไปแล้ว ต้องมีทางปลด */}
                            {order.lineUserId && (
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-destructive mt-0.5 text-xs underline underline-offset-2"
                                onClick={() => setOrderToUnlink(order)}
                              >
                                ปลดการผูก LINE
                              </button>
                            )}
                            {order.customerPhone && (
                              <a
                                href={`tel:${order.customerPhone.replace(/[^\d+]/g, '')}`}
                                className="text-muted-foreground hover:text-primary block w-fit hover:underline"
                              >
                                {order.customerPhone}
                              </a>
                            )}
                            {order.customerAddress && (
                              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                                {order.customerAddress}
                              </p>
                            )}
                            {(order.customerPhone || order.customerAddress) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="absolute top-2 right-2 h-7 px-2 text-xs"
                                onClick={() => copyAddress(order)}
                              >
                                {copiedAddressId === order.id ? (
                                  <Check className="text-success size-3" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                                {copiedAddressId === order.id ? 'คัดลอกแล้ว' : 'คัดลอก'}
                              </Button>
                            )}
                          </div>
                        )}

                        <p className="text-muted-foreground text-xs">
                          🐟 {fishCountOf(order.items)} ตัว · 📋 {order.items?.length || 0} รายการ
                          {order.note && <span className="italic"> · 💬 {order.note}</span>}
                        </p>

                        {/* รายละเอียด — พับไว้ให้การ์ดสั้นลงบนมือถือ */}
                        <details className="group">
                          <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-1 text-xs font-medium">
                            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
                            รายการปลา · ต้นทุน · กำไร
                          </summary>

                          <div className="mt-2 space-y-1">
                            {order.items?.map((item: OrderItem, i: number) => {
                              const itemCost = resolveItemCost(item);
                              return (
                                <div
                                  key={i}
                                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs odd:bg-muted/40"
                                >
                                  <div className="flex min-w-0 flex-wrap items-center gap-1">
                                    <span className="truncate">
                                      {item.kind === 'food' ? '🍤 ' : ''}
                                      {item.breedName}
                                    </span>
                                    <Badge
                                      variant={item.kind === 'food' ? 'warning' : 'soft'}
                                      className="shrink-0"
                                    >
                                      {item.quantity}{' '}
                                      {item.kind === 'food'
                                        ? 'ชิ้น'
                                        : `${item.type === 'piece' ? 'ตัว' : item.type === 'pair' ? 'คู่' : 'ชุด'}${
                                            item.type === 'piece' && item.gender !== 'mixed'
                                              ? item.gender === 'male'
                                                ? '(ผู้)'
                                                : '(เมีย)'
                                              : ''
                                          }`}
                                    </Badge>
                                    {(item.freeQty || 0) > 0 && (
                                      <Badge variant="success" className="shrink-0">
                                        แถม {item.freeQty}
                                      </Badge>
                                    )}
                                    {(item.discount || 0) > 0 && (
                                      <Badge variant="warning" className="shrink-0">
                                        ลด {item.discount}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-muted-foreground flex shrink-0 gap-2 tabular-nums">
                                    <span>ทุน {itemCost * item.quantity}</span>
                                    <span className="text-success font-medium">
                                      ขาย{' '}
                                      {item.price * Math.max(0, item.quantity - (item.freeQty || 0)) -
                                        (item.discount || 0)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}

                            <div className="text-muted-foreground flex items-center justify-between px-2 py-1 text-xs">
                              <span>🚚 ค่าส่งที่เก็บลูกค้า</span>
                              <span className="tabular-nums">฿{shippingFee.toLocaleString()}</span>
                            </div>
                            {(order.discount || 0) > 0 && (
                              <div className="text-warning flex items-center justify-between px-2 py-1 text-xs">
                                <span>💸 ส่วนลดท้ายบิล</span>
                                <span className="tabular-nums">
                                  -฿{(order.discount || 0).toLocaleString()}
                                </span>
                              </div>
                            )}

                            <div className="bg-muted/50 mt-2 space-y-1 rounded-lg px-3 py-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">ค่าจัดส่งจริง</span>
                                <button
                                  onClick={() => openEditModal(order)}
                                  className={cn(
                                    'font-medium tabular-nums underline-offset-2 hover:underline',
                                    order.actualShippingFee == null && 'text-warning'
                                  )}
                                >
                                  ฿{actualShipping}
                                  {order.actualShippingFee == null ? ' (ยังไม่ระบุ)' : ''}
                                </button>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">ต้นทุนสินค้า</span>
                                <span className="tabular-nums">฿{orderCost.toLocaleString()}</span>
                              </div>
                              <Separator className="my-1" />
                              <div className="flex items-center justify-between">
                                <span className="font-medium">กำไรสุทธิ</span>
                                <span
                                  className={cn(
                                    'text-base font-semibold tabular-nums',
                                    orderProfit >= 0 ? 'text-success' : 'text-destructive'
                                  )}
                                >
                                  ฿{orderProfit.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </details>

                        <Separator />

                        {/* ปุ่มทำงาน */}
                        <div className="flex flex-wrap items-center gap-2">
                          {order.publicToken && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  const url = getLiffOrderUrl(order.publicToken!);
                                  const msg = buildOrderLinkMessage(
                                    order.orderNumber || '',
                                    order.items || [],
                                    order.totalAmount || 0,
                                    url
                                  );
                                  try {
                                    await navigator.clipboard.writeText(msg);
                                    toast.success('คัดลอกลิงก์ใบสรุปแล้ว');
                                  } catch {
                                    toast.error('คัดลอกไม่สำเร็จ');
                                  }
                                }}
                              >
                                <Copy className="size-3.5" /> ลิงก์ใบสรุป
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="ลิงก์สำรองสำหรับลูกค้าที่เปิดลิงก์ LINE ไม่ได้"
                                onClick={async () => {
                                  // สำรองไว้เวลาลูกค้ากดลิงก์ LIFF ไม่ได้ (LINE เก่า / เปิดจากแอปอื่น)
                                  // ลิงก์นี้เปิดในเบราว์เซอร์ไหนก็ได้ แต่จะไม่ผูกบัญชี LINE ให้
                                  try {
                                    await navigator.clipboard.writeText(
                                      getPublicOrderUrl(order.publicToken!)
                                    );
                                    toast.success('คัดลอกลิงก์ธรรมดาแล้ว', {
                                      description:
                                        'เปิดได้ทุกเบราว์เซอร์ แต่จะไม่แจ้งเตือนพัสดุอัตโนมัติ',
                                    });
                                  } catch {
                                    toast.error('คัดลอกไม่สำเร็จ');
                                  }
                                }}
                              >
                                สำรอง
                              </Button>
                            </>
                          )}
                          {/* เคลมเปิดได้เฉพาะบิลที่ส่งของไปแล้ว ปลายังไม่ออกจากร้านก็ยังไม่ตายระหว่างส่ง */}
                          {order.status !== 'pending' && order.status !== 'cancelled' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => openClaim(order)}
                            >
                              <HeartCrack className="size-3.5" /> เคลม
                            </Button>
                          )}
                          <div className="ml-auto flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEditModal(order)}>
                              <Edit2 className="size-3.5" /> แก้ไข
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setOrderToDelete(order)}
                            >
                              <Trash2 className="size-3.5" /> ลบ
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ───────── สรุปยอด ───────── */}
          <TabsContent value="dashboard" className="mt-4 space-y-6">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-5">
              <Stat label="จำนวนบิล" value={dashboardStats.totalOrders} />
              <Stat
                label="ปลาตาย / คืนเงิน"
                value={`${dashboardStats.totalDeadFish} ตัว · ฿${dashboardStats.totalRefund.toLocaleString()}`}
                accent={dashboardStats.totalDeadFish > 0 ? 'destructive' : undefined}
              />
              <Stat
                label="ยอดขายรวม"
                value={`฿${dashboardStats.totalSales.toLocaleString()}`}
                accent="success"
              />
              <Stat
                label="กำไรสุทธิ"
                value={`฿${dashboardStats.totalProfit.toLocaleString()}`}
                accent={dashboardStats.totalProfit >= 0 ? 'primary' : 'destructive'}
              />
              <Stat label="จำนวนปลา" value={`${dashboardStats.totalFish} ตัว`} />
              <Stat
                label="เฉลี่ย/บิล"
                value={`฿${Math.round(dashboardStats.avgOrderValue).toLocaleString()}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
              <Stat
                label="🎁 ของแถมฟรี"
                value={`${dashboardStats.totalFreeQty} ตัว`}
                hint={`มูลค่า ฿${dashboardStats.totalFreeValue.toLocaleString()}`}
              />
              <Stat
                label="🍤 ยอดขายอาหาร"
                value={`฿${dashboardStats.totalFoodSales.toLocaleString()}`}
                hint={`ทุน ฿${dashboardStats.totalFoodCost.toLocaleString()}`}
              />
              <Stat label="🐟 ต้นทุนปลา" value={`฿${dashboardStats.totalFishCost.toLocaleString()}`} />
              <Stat
                label="รายได้ค่าส่ง"
                value={`฿${dashboardStats.totalShippingIncome.toLocaleString()}`}
                hint={`จ่ายจริง ฿${dashboardStats.totalShippingCost.toLocaleString()}`}
              />
              <Stat
                label="กำไรค่าส่ง"
                value={`฿${(dashboardStats.totalShippingIncome - dashboardStats.totalShippingCost).toLocaleString()}`}
                accent="success"
              />
              <Stat
                label="ยอดรวมสุทธิ"
                value={`฿${(dashboardStats.totalSales - dashboardStats.totalFishCost - dashboardStats.totalShippingCost).toLocaleString()}`}
                accent="primary"
              />
            </div>

            {dashboardStats.topBreeds.length > 0 && (
              <section>
                <h3 className="mb-2 font-medium">🏆 สายพันธุ์ขายดี</h3>
                <Card className="gap-0 py-0">
                  <div className="divide-y">
                    {dashboardStats.topBreeds.map((breed: any, idx: number) => {
                      const profit = breed.sales - breed.cost;
                      return (
                        <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="text-muted-foreground w-5 shrink-0 text-sm tabular-nums">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{breed.name}</p>
                            <p className="text-muted-foreground text-xs">{breed.qty} รายการ</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold tabular-nums">
                              ฿{breed.sales.toLocaleString()}
                            </p>
                            <p
                              className={cn(
                                'text-xs font-medium tabular-nums',
                                profit >= 0 ? 'text-success' : 'text-destructive'
                              )}
                            >
                              กำไร {profit >= 0 ? '+' : ''}฿{profit.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </section>
            )}

            {dashboardStats.topCustomers.length > 0 && (
              <section>
                <h3 className="mb-2 font-medium">👥 ลูกค้าประจำ</h3>
                <Card className="gap-0 py-0">
                  <div className="divide-y">
                    {dashboardStats.topCustomers.map((customer: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="text-muted-foreground w-5 shrink-0 text-sm tabular-nums">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{customer.name}</p>
                          <p className="text-muted-foreground text-xs">
                            {customer.orders} บิล · {customer.totalFish} ตัว
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">
                          ฿{customer.totalSpent.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            )}
          </TabsContent>

          {/* ───────── เคลมปลาตาย ───────── */}
          <TabsContent value="claims" className="mt-4">
            <ClaimsPanel
              from={appliedRange[0]}
              to={appliedRange[1]}
              onChanged={loadClaimTotals}
              key={claimsVersion}
            />
          </TabsContent>

          {/* ───────── สลิป ───────── */}
          <TabsContent value="slips" className="mt-4">
            <PendingSlips
              onConfirmed={() => loadAllOrders(reportPeriod)}
              onChanged={setPendingSlipCount}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* ───────── แก้ไขออเดอร์ ───────── */}
      <ResponsiveModal
        open={isEditingOrder}
        onOpenChange={(open) => {
          setIsEditingOrder(open);
          if (!open) setEditingOrder(null);
        }}
      >
        <ResponsiveModalContent className="sm:max-w-3xl">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>
              แก้ไขออเดอร์ {editingOrder?.orderNumber || ''}
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <ResponsiveModalBody className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
            {/* ── ข้อมูลลูกค้า / ที่อยู่จัดส่ง ── */}
            <div className="space-y-3 lg:col-start-1 lg:row-start-1">
              <p className="text-muted-foreground text-sm font-medium">ข้อมูลลูกค้า / ที่อยู่จัดส่ง</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="e-name">ชื่อลูกค้า</Label>
                  <Input id="e-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-phone">เบอร์โทร</Label>
                  <Input
                    id="e-phone"
                    type="tel"
                    inputMode="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-address">ที่อยู่จัดส่ง</Label>
                <Textarea
                  id="e-address"
                  rows={2}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-note">หมายเหตุ</Label>
                <Input id="e-note" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
              </div>
            </div>

            {/* ── ค่าส่ง / ส่วนลด ── */}
            <div className="grid gap-3 sm:grid-cols-2 lg:col-start-1 lg:row-start-2">
              <div className="space-y-1.5">
                <Label htmlFor="e-shipping">ค่าจัดส่งจริง (ต้นทุน)</Label>
                <Input
                  id="e-shipping"
                  type="number"
                  inputMode="numeric"
                  value={editActualShipping}
                  onChange={(e) => setEditActualShipping(e.target.value)}
                  placeholder="ยังไม่ระบุ"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-discount">ส่วนลดท้ายบิล</Label>
                <Input
                  id="e-discount"
                  type="number"
                  inputMode="numeric"
                  value={editDiscount}
                  onChange={(e) => setEditDiscount(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* ── รายการปลา ── */}
            <div className="space-y-2 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <div className="flex items-center justify-between gap-2">
                <Label>รายการสินค้า</Label>
                <Select value="" onValueChange={(v) => v && addEditItem(v)}>
                  <SelectTrigger size="sm" className="w-40">
                    <span className="flex items-center gap-1.5">
                      <Plus className="size-3.5" /> เพิ่มปลา
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {breeds.map((breed: Breed) => (
                      <SelectItem key={breed.id} value={breed.id}>
                        {breed.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                {editItems.map((item: OrderItem, idx: number) => {
                  // อาหาร: แก้แค่จำนวน ไม่มีสายพันธุ์/เพศ/ชนิด (กันข้อมูลเพี้ยน)
                  if (item.kind === 'food') {
                    return (
                      <div
                        key={idx}
                        className="bg-warning/8 flex items-center justify-between gap-2 rounded-lg border p-3"
                      >
                        <span className="min-w-0 truncate text-sm font-medium">
                          🍤 {item.breedName}
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) =>
                              updateEditItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="h-9 w-16 text-center"
                          />
                          <span className="w-16 text-right text-sm font-semibold tabular-nums">
                            ฿{(item.price * item.quantity).toLocaleString()}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="ลบรายการ"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => removeEditItem(idx)}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={idx} className="space-y-2.5 rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Select
                          value={item.breedId}
                          onValueChange={(v) => updateEditItem(idx, 'breedId', v)}
                        >
                          <SelectTrigger size="sm" className="min-w-0 flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {breeds.map((b: Breed) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="ลบรายการ"
                          className="text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removeEditItem(idx)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-muted-foreground text-xs">หน่วยขาย</Label>
                          <Select value={item.type} onValueChange={(v) => updateEditItem(idx, 'type', v)}>
                            <SelectTrigger size="sm" className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="piece">ตัว</SelectItem>
                              <SelectItem value="pair">คู่</SelectItem>
                              <SelectItem value="set">ชุด</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {item.type === 'piece' && (
                          <div className="space-y-1">
                            <Label className="text-muted-foreground text-xs">เพศ</Label>
                            <Select
                              value={item.gender || 'mixed'}
                              onValueChange={(v) => updateEditItem(idx, 'gender', v)}
                            >
                              <SelectTrigger size="sm" className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">ผู้</SelectItem>
                                <SelectItem value="female">เมีย</SelectItem>
                                <SelectItem value="mixed">รวม</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-muted-foreground text-xs">จำนวน</Label>
                          <Input
                            type="number"
                            min="1"
                            placeholder="1"
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              updateEditItem(idx, 'quantity', isNaN(val) ? 0 : Math.max(0, val));
                            }}
                            className="h-9 text-center"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-muted-foreground text-xs">แถม</Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={item.freeQty || ''}
                            onChange={(e) => updateEditItem(idx, 'freeQty', parseInt(e.target.value) || 0)}
                            className="h-9 text-center"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-muted-foreground text-xs">หน่วยละ</Label>
                          <div className="bg-muted flex h-9 items-center justify-center rounded-md text-sm font-medium tabular-nums">
                            ฿{item.price.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {editItems.length === 0 && (
                  <p className="text-muted-foreground py-4 text-center text-sm">ยังไม่มีรายการ</p>
                )}
              </div>
            </div>
          </ResponsiveModalBody>

          <ResponsiveModalFooter className="space-y-2">
            {/* ยอดรวมสด — เห็นผลก่อนบันทึก */}
            {editingOrder &&
              (() => {
                const itemsTotal = editItems.reduce(
                  (s, it) => s + (it.price * Math.max(0, it.quantity - (it.freeQty || 0)) - (it.discount || 0)),
                  0
                );
                // clamp เหมือนตอนบันทึกจริง ตัวเลขที่เห็นก่อนกดต้องตรงกับที่จะถูกเก็บ
                const grand = Math.max(
                  0,
                  itemsTotal - (Number(editDiscount) || 0) + (editingOrder.shippingFee ?? 60)
                );
                return (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      ยอดรวมใหม่ (รวมค่าส่ง ฿{editingOrder.shippingFee ?? 60})
                    </span>
                    <span className="text-primary text-xl font-semibold tabular-nums">
                      ฿{grand.toLocaleString()}
                    </span>
                  </div>
                );
              })()}

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  const message = buildOrderMessage({
                    items: editItems,
                    totalFish: editItems.reduce(
                      (s, it) =>
                        s + (it.type === 'piece' ? it.quantity : it.type === 'pair' ? it.quantity * 2 : it.quantity * 3),
                      0
                    ),
                    shippingFee: editingOrder?.shippingFee ?? 60,
                    billDiscount: Number(editDiscount) || 0,
                    bankInfo,
                    customerName: editName,
                    customerPhone: editPhone,
                    customerAddress: editAddress,
                    note: editNote,
                  });
                  if (message) {
                    navigator.clipboard.writeText(message).then(() => {
                      setEditCopySuccess(true);
                      toast.success('คัดลอกข้อความแล้ว!');
                      setTimeout(() => setEditCopySuccess(false), 2000);
                    });
                  }
                }}
              >
                {editCopySuccess ? <Check className="size-4" /> : <Copy className="size-4" />}
                {editCopySuccess ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}
              </Button>
              <Button size="lg" onClick={updateOrder}>
                <Save className="size-4" /> บันทึก
              </Button>
            </div>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* ───────── ยืนยันลบบิล ───────── */}
      {/* ───────── เคลมปลาตาย ───────── */}
      <Dialog open={!!claimOrder} onOpenChange={(open) => !open && setClaimOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>บันทึกเคลมปลาตาย</DialogTitle>
            <DialogDescription>
              เก็บไว้ดูว่าแต่ละช่วงตายกี่ตัว บิลไหนบ้าง และหักเงินที่คืนออกจากกำไรให้
            </DialogDescription>
          </DialogHeader>

          {claimOrder && (
            <div className="bg-muted/50 flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <span className="text-primary font-medium">{claimOrder.orderNumber}</span>
                {claimOrder.customerName && (
                  <span className="text-muted-foreground ml-2 text-xs">{claimOrder.customerName}</span>
                )}
              </div>
              <span className="shrink-0 font-semibold tabular-nums">
                ฿{(claimOrder.totalAmount || 0).toLocaleString()}
              </span>
            </div>
          )}

          <div className="space-y-3">
            {/* ตารางต่อสายพันธุ์ — บิลหนึ่งตายได้หลายพันธุ์ กรอกทีเดียวจบ ไม่ต้องเปิดกล่องซ้ำ */}
            <div className="space-y-2">
              <div className="text-muted-foreground grid grid-cols-[1fr_5rem_6rem] gap-2 text-xs">
                <span>สายพันธุ์ในบิลนี้</span>
                <span className="text-center">ตาย (ตัว)</span>
                <span className="text-center">คืนเงิน (฿)</span>
              </div>

              {breedsOf(claimOrder).map((name) => (
                <div key={name} className="grid grid-cols-[1fr_5rem_6rem] items-center gap-2">
                  <span className="truncate text-sm" title={name}>
                    {name}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    className="text-center"
                    value={claimRows[name]?.qty ?? ''}
                    onChange={(e) => setClaimRow(name, 'qty', e.target.value)}
                    placeholder="0"
                    aria-label={`จำนวนที่ตายของ ${name}`}
                  />
                  <Input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    className="text-center"
                    value={claimRows[name]?.refund ?? ''}
                    onChange={(e) => setClaimRow(name, 'refund', e.target.value)}
                    placeholder="0"
                    aria-label={`เงินคืนของ ${name}`}
                    // ยังไม่ได้ใส่จำนวนตาย ก็ยังไม่มีอะไรให้คืน
                    disabled={!(Number(claimRows[name]?.qty) > 0)}
                  />
                </div>
              ))}

              {breedsOf(claimOrder).length === 0 && (
                <p className="text-muted-foreground text-sm">บิลนี้ไม่มีรายการปลา</p>
              )}
            </div>

            {claimDraftTotals().dead > 0 && (
              <div className="bg-muted/50 flex items-center justify-between rounded-lg px-3 py-2 text-sm">
                <span className="text-muted-foreground">รวมที่จะบันทึก</span>
                <span className="font-medium">
                  ตาย {claimDraftTotals().dead} ตัว
                  {claimDraftTotals().refund > 0 &&
                    ` · คืน ฿${claimDraftTotals().refund.toLocaleString()}`}
                </span>
              </div>
            )}

            <p className="text-muted-foreground text-xs">
              ส่งปลาชดเชยแทนเงิน ก็ปล่อยคืนเงินเป็น 0 ได้ จำนวนตัวยังถูกนับอยู่
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="claim-note">หมายเหตุ</Label>
              <Input
                id="claim-note"
                value={claimNote}
                onChange={(e) => setClaimNote(e.target.value)}
                placeholder="เช่น ส่งช้า อากาศร้อน (ไม่ใส่ก็ได้)"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setClaimOrder(null)} disabled={savingClaim}>
              ยกเลิก
            </Button>
            <Button onClick={saveClaim} disabled={savingClaim}>
              {savingClaim ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              บันทึกเคลม
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────── ปลดการผูก LINE ───────── */}
      <Dialog open={!!orderToUnlink} onOpenChange={(open) => !open && setOrderToUnlink(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ปลดการผูก LINE?</DialogTitle>
            <DialogDescription>
              บิลจะหยุดส่งแจ้งเตือนหาบัญชีนี้ และคนถัดไปที่เปิดลิงก์จะผูกแทน
            </DialogDescription>
          </DialogHeader>

          {orderToUnlink && (
            <div className="bg-muted/50 space-y-1 rounded-lg px-3 py-2.5 text-sm">
              <p className="text-primary font-medium">{orderToUnlink.orderNumber}</p>
              <p className="text-muted-foreground">
                ผูกอยู่กับ {orderToUnlink.lineDisplayName || 'บัญชี LINE ที่ไม่ทราบชื่อ'}
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOrderToUnlink(null)}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={unlinkLine}>
              ปลดการผูก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>ลบบิลนี้?</DialogTitle>
            <DialogDescription>ลบแล้วกู้คืนไม่ได้ ยอดขายและกำไรของช่วงนี้จะเปลี่ยนตามด้วย</DialogDescription>
          </DialogHeader>

          {orderToDelete && (
            <div className="bg-muted/50 space-y-1 rounded-lg px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-primary font-medium">{orderToDelete.orderNumber}</span>
                <span className="font-semibold tabular-nums">
                  ฿{(orderToDelete.totalAmount || 0).toLocaleString()}
                </span>
              </div>
              {orderToDelete.customerName && (
                <p className="text-muted-foreground">{orderToDelete.customerName}</p>
              )}
              <p className="text-muted-foreground text-xs">
                {new Date(orderToDelete.created_at).toLocaleString('th-TH', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}{' '}
                · {orderToDelete.items?.length || 0} รายการ
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOrderToDelete(null)} disabled={deleting}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={deleteOrder} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              ลบบิล
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────── ดูสลิป ───────── */}
      <Dialog open={!!slipModalUrl} onOpenChange={(open) => !open && setSlipModalUrl(null)}>
        <DialogContent className="max-w-[min(32rem,calc(100%-2rem))] bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">สลิปโอนเงิน</DialogTitle>
          {slipModalUrl === 'loading' ? (
            <div className="flex h-56 items-center justify-center">
              <Loader2 className="size-8 animate-spin text-white" />
            </div>
          ) : slipModalUrl ? (
            <img
              src={slipModalUrl}
              alt="สลิปโอนเงิน"
              className="max-h-[85dvh] w-full rounded-xl object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
