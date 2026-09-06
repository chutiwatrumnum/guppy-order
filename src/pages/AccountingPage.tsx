import { useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  Download,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import Layout from './Layout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// บัญชีร้าน — เงินเข้าเงินออกของกิจการ แยกจากหน้าบิลที่ดูรายวัน
//
// หน้าบิลตอบว่า "ขายดีไหม" หน้านี้ตอบว่า "เดือนนี้เหลือเท่าไหร่"
// ต่างกันตรงรายจ่ายที่ไม่ผูกกับบิล (ค่าไฟ ค่ากล่อง ค่าอาหารที่ซื้อเข้า)
// ซึ่งไม่มีทางรู้ได้จากตาราง orders เลย ต้องให้ร้านคีย์เอง

interface Expense {
  id: string;
  spent_on: string;
  category: string;
  amount: number;
  note: string | null;
}

interface OrderRow {
  id: string;
  order_number: string | null;
  created_at: string;
  customer_name: string | null;
  total_amount: number | null;
  total_cost: number | null;
  shipping_fee: number | null;
  actual_shipping_fee: number | null;
  payment_status: string | null;
  paid_amount: number | null;
  paid_at: string | null;
  payment_account_id: string | null;
}

/** บิลที่ฝังมากับแถวสลิป — เอาแค่ว่าเป็นของบัญชีไหน */
interface SlipOrder {
  payment_account_id: string | null;
}

interface AccountRef {
  id: string;
  label: string | null;
  bank_name: string;
  account_number: string | null;
}

/** หมวดรายจ่าย — อยู่ในโค้ดไม่ใช่ในฐานข้อมูล เพิ่มหมวดใหม่แค่แก้บรรทัดนี้ */
const CATEGORIES = [
  'อาหารปลา',
  'พ่อแม่พันธุ์',
  'อุปกรณ์/ของใช้',
  'กล่อง/ถุง/แพ็คของ',
  'ค่าน้ำ/ค่าไฟ',
  'ค่าเดินทาง/น้ำมัน',
  'ค่าโฆษณา',
  'ค่าเช่า',
  'อื่น ๆ',
];

type Period = 'this-month' | 'last-month' | 'this-year' | 'custom';

/**
 * งบนับยังไง — คนละคำถามกัน ไม่ใช่แค่มุมมอง
 *
 * bill = นับตามวันที่ออกบิล ตอบว่า "เดือนนี้ขายได้เท่าไหร่"
 * cash = นับตามวันที่เงินเข้าจริง ตอบว่า "เดือนนี้เงินเข้ากระเป๋าเท่าไหร่"
 *
 * บิลสิ้นเดือนที่ลูกค้าโอนต้นเดือนถัดไป จะอยู่คนละเดือนในสองโหมดนี้
 * เวลายื่นภาษีต้องรู้ว่ากำลังใช้เกณฑ์ไหน จึงแยกให้ชัดแทนที่จะเลือกให้เอง
 */
type Basis = 'bill' | 'cash';

const BASIS_LABEL: Record<Basis, string> = {
  bill: 'ตามวันที่ออกบิล',
  cash: 'ตามวันที่เงินเข้า',
};

/** สถานะการชำระเป็นภาษาไทยในไฟล์ export — คนอ่านไฟล์คือนักบัญชี ไม่ใช่โปรแกรม */
const PAYMENT_TH: Record<string, string> = {
  unpaid: 'ยังไม่จ่าย',
  deposit: 'มัดจำ',
  paid: 'จ่ายแล้ว',
};

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** ช่วงวันของแต่ละปุ่ม — คิดจากเวลาเครื่อง (เวลาไทย) ไม่ใช่ UTC */
function rangeOf(period: Period, customStart: string, customEnd: string): [string, string] {
  const now = new Date();
  if (period === 'this-month') {
    return [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(now)];
  }
  if (period === 'last-month') {
    return [
      ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      ymd(new Date(now.getFullYear(), now.getMonth(), 0)),
    ];
  }
  if (period === 'this-year') {
    return [ymd(new Date(now.getFullYear(), 0, 1)), ymd(now)];
  }
  return [customStart, customEnd];
}

const PERIOD_LABEL: Record<Period, string> = {
  'this-month': 'เดือนนี้',
  'last-month': 'เดือนก่อน',
  'this-year': 'ปีนี้',
  custom: 'กำหนดเอง',
};

/** ตัวเลขเงิน — เลขกลม ๆ ไม่ต้องมี .00 ให้รก แต่มีสตางค์เมื่อไหร่ต้องเห็น */
const money = (n: number) =>
  n.toLocaleString('th-TH', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });

const thaiDate = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

export default function AccountingPage() {
  const { user } = useAuth();

  const [basis, setBasis] = useState<Basis>('bill');
  const [period, setPeriod] = useState<Period>('this-month');
  const [customStart, setCustomStart] = useState(ymd(new Date()));
  const [customEnd, setCustomEnd] = useState(ymd(new Date()));
  const [loading, setLoading] = useState(true);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [refund, setRefund] = useState(0);
  // บิลที่ปิดไปแล้วแต่ไม่มีวันที่รับเงิน — โหมดเงินสดมองไม่เห็น ต้องบอกว่าตกไปเท่าไหร่
  const [noPaidDate, setNoPaidDate] = useState({ count: 0, amount: 0 });
  const [payAccounts, setPayAccounts] = useState<AccountRef[]>([]);
  // สลิปที่ร้านยืนยันแล้วในช่วงนี้ = จำนวนครั้งที่มีเงินโอนเข้าจริงพร้อมหลักฐาน
  const [confirmedSlips, setConfirmedSlips] = useState<{ accountId: string | null }[]>([]);

  const [editing, setEditing] = useState<Expense | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ spent_on: ymd(new Date()), category: CATEGORIES[0], amount: '', note: '' });
  const [toDelete, setToDelete] = useState<Expense | null>(null);

  const [start, end] = rangeOf(period, customStart, customEnd);

  useEffect(() => {
    load();
    // ช่วงวันหรือเกณฑ์เปลี่ยนเมื่อไหร่ก็ดึงใหม่ทั้งชุด
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, basis]);

  const load = async () => {
    if (!start || !end) return;
    setLoading(true);

    // บิลกับเคลมเก็บเป็น timestamptz — ต้องแปลงวันเป็นช่วงเวลาไทยก่อนเทียบ
    // ส่งวันเปล่า ๆ ไปฐานข้อมูลจะอ่านเป็น UTC แล้วยอดต้นเดือน/ปลายเดือนคลาดไป 7 ชม.
    const fromIso = new Date(`${start}T00:00:00`).toISOString();
    const toIso = new Date(`${end}T23:59:59.999`).toISOString();

    const columns =
      'id, order_number, created_at, customer_name, total_amount, total_cost, shipping_fee, actual_shipping_fee, payment_status, paid_amount, paid_at, payment_account_id';

    // โหมดเงินสดกรองด้วยวันที่รับเงิน ไม่ใช่วันที่ออกบิล
    // (บิลที่ยังไม่มี paid_at จะหลุดจากผลลัพธ์เอง — ตั้งใจ แล้วนับแยกไว้ข้างล่าง)
    const ordersQuery =
      basis === 'cash'
        ? supabase
            .from('orders')
            .select(columns)
            .gte('paid_at', fromIso)
            .lte('paid_at', toIso)
            .order('paid_at', { ascending: true })
        : supabase
            .from('orders')
            .select(columns)
            .gte('created_at', fromIso)
            .lte('created_at', toIso)
            .order('created_at', { ascending: true });

    const [ordersRes, expensesRes, claimsRes, legacyRes, accountsRes, slipsRes] = await Promise.all([
      ordersQuery,
      supabase
        .from('expenses')
        .select('id, spent_on, category, amount, note')
        .gte('spent_on', start)
        .lte('spent_on', end)
        .order('spent_on', { ascending: false }),
      supabase.from('claims').select('refund_amount').gte('created_at', fromIso).lte('created_at', toIso),
      // บิลที่ปิดแล้วแต่ไม่รู้ว่าเงินเข้าวันไหน (ปิดก่อนระบบเก็บวันที่ หรือกดสถานะเอง)
      supabase
        .from('orders')
        .select('total_amount, paid_amount')
        .is('paid_at', null)
        .neq('payment_status', 'unpaid')
        .gte('created_at', fromIso)
        .lte('created_at', toIso),
      supabase.from('payment_accounts').select('id, label, bank_name, account_number'),
      // นับสลิปโดยกรองจากบิลที่ผูกอยู่ (!inner) ช่วงเดียวกับตารางบิลด้านบนเป๊ะ ๆ
      // ไม่ส่ง id บิลทั้งช่วงไปเป็นเงื่อนไข in() เพราะพอเลือก "ปีนี้" URL จะยาวเกินจนคิวรีพัง
      (basis === 'cash'
        ? supabase
            .from('payment_slips')
            .select('id, orders!inner(payment_account_id, paid_at)')
            .eq('status', 'confirmed')
            .gte('orders.paid_at', fromIso)
            .lte('orders.paid_at', toIso)
        : supabase
            .from('payment_slips')
            .select('id, orders!inner(payment_account_id, created_at)')
            .eq('status', 'confirmed')
            .gte('orders.created_at', fromIso)
            .lte('orders.created_at', toIso)),
    ]);

    setLoading(false);

    if (ordersRes.error || expensesRes.error) {
      console.error('Load accounting error:', ordersRes.error || expensesRes.error);
      toast.error('โหลดข้อมูลบัญชีไม่สำเร็จ', { description: 'ตัวเลขที่เห็นอาจไม่ครบ ลองใหม่อีกครั้ง' });
      return;
    }

    setOrders((ordersRes.data || []) as OrderRow[]);
    setExpenses(((expensesRes.data || []) as Expense[]).map((e) => ({ ...e, amount: Number(e.amount) })));
    setRefund((claimsRes.data || []).reduce((sum: number, c: any) => sum + (c.refund_amount || 0), 0));
    setPayAccounts((accountsRes.data || []) as AccountRef[]);
    // ตารางที่ฝังมา (orders) บางเวอร์ชันคืนเป็นอ็อบเจกต์ บางเวอร์ชันเป็นอาร์เรย์ รับไว้ทั้งสองแบบ
    type SlipRow = { orders?: SlipOrder | SlipOrder[] | null };
    setConfirmedSlips(
      ((slipsRes.data || []) as unknown as SlipRow[]).map((row) => {
        const rel = Array.isArray(row.orders) ? row.orders[0] : row.orders;
        return { accountId: rel?.payment_account_id ?? null };
      })
    );
    const legacy = (legacyRes.data || []) as { total_amount: number | null; paid_amount: number | null }[];
    setNoPaidDate({
      count: legacy.length,
      amount: legacy.reduce((sum, o) => sum + (o.paid_amount || o.total_amount || 0), 0),
    });
  };

  const stats = useMemo(() => {
    const sales = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const goodsCost = orders.reduce((sum, o) => sum + (o.total_cost || 0), 0);
    // ค่าส่งจ่ายจริงถ้ากรอกไว้ ไม่กรอกก็ใช้ค่าที่เก็บลูกค้าไปก่อน (เดาดีที่สุดที่มี)
    const shippingCost = orders.reduce(
      (sum, o) => sum + (o.actual_shipping_fee ?? o.shipping_fee ?? 0),
      0
    );
    const missingActualShipping = orders.filter((o) => o.actual_shipping_fee == null).length;
    const other = expenses.reduce((sum, e) => sum + e.amount, 0);
    // โหมดเงินสดนับเงินที่รับมาจริง ไม่ใช่ยอดหน้าบิล (บิลมัดจำจ่ายมาบางส่วน)
    const cashIn = orders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);

    // เงินที่ยังไม่เข้ากระเป๋า — ยอดขายข้างบนนับทุกบิลที่ออกในช่วงนี้
    // ไม่ว่าลูกค้าจ่ายแล้วหรือยัง ต้องบอกไว้ ไม่งั้นเข้าใจว่าได้เงินครบ
    const unpaid = orders.reduce(
      (sum, o) => sum + Math.max(0, (o.total_amount || 0) - (o.paid_amount || 0)),
      0
    );

    // รับเงินแยกตามบัญชี — กี่บิลและรวมเท่าไหร่
    // โหมดเงินสดนับเงินที่รับจริง โหมดบิลนับยอดหน้าบิล
    const byAccount = new Map<string, { count: number; amount: number; slips: number }>();
    const bucket = (key: string) =>
      byAccount.get(key) || { count: 0, amount: 0, slips: 0 };

    orders.forEach((o) => {
      const key = o.payment_account_id || '__none__';
      const cur = bucket(key);
      byAccount.set(key, {
        ...cur,
        count: cur.count + 1,
        amount: cur.amount + (basis === 'cash' ? o.paid_amount || 0 : o.total_amount || 0),
      });
    });

    // สลิปที่ยืนยันแล้ว — หนึ่งใบคือเงินโอนเข้าหนึ่งครั้งที่มีหลักฐานภาพ
    // ต่างจากจำนวนบิล เพราะบิลที่ปิดด้วยการกดสถานะเอง (โอนสด/นัดรับ) ไม่มีสลิป
    confirmedSlips.forEach((slip) => {
      const key = slip.accountId || '__none__';
      const cur = bucket(key);
      byAccount.set(key, { ...cur, slips: cur.slips + 1 });
    });

    const byCategory = new Map<string, number>();
    expenses.forEach((e) => byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount));

    return {
      sales,
      goodsCost,
      shippingCost,
      missingActualShipping,
      refund,
      other,
      unpaid,
      cashIn,
      net:
        basis === 'cash'
          ? cashIn - refund - other
          : sales - goodsCost - shippingCost - refund - other,
      byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
      byAccount: [...byAccount.entries()]
        .map(([id, v]) => {
          const acct = payAccounts.find((a) => a.id === id);
          return {
            id,
            name: acct
              ? acct.label || `${acct.bank_name}${acct.account_number ? ` ${acct.account_number}` : ''}`
              : 'ไม่ระบุบัญชี (บิลก่อนแยกบัญชี)',
            ...v,
          };
        })
        .sort((a, b) => b.amount - a.amount),
      orderCount: orders.length,
    };
  }, [orders, expenses, refund, basis, payAccounts, confirmedSlips]);

  const openAdd = () => {
    setEditing(null);
    setForm({ spent_on: ymd(new Date()), category: CATEGORIES[0], amount: '', note: '' });
    setModalOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    setForm({
      spent_on: expense.spent_on,
      category: expense.category,
      amount: String(expense.amount),
      note: expense.note || '',
    });
    setModalOpen(true);
  };

  const saveExpense = async () => {
    const amount = Number(form.amount);
    if (!form.spent_on) {
      toast.error('ใส่วันที่ที่จ่ายเงินด้วยครับ');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('จำนวนเงินต้องมากกว่า 0');
      return;
    }

    setSaving(true);
    const payload = {
      spent_on: form.spent_on,
      category: form.category,
      amount,
      note: form.note.trim() || null,
      created_by: user?.username || null,
    };

    // เช็ก error ที่ supabase คืนมาเสมอ — มันไม่โยนให้ try/catch จับ
    const { error } = editing
      ? await supabase.from('expenses').update(payload).eq('id', editing.id)
      : await supabase.from('expenses').insert(payload);
    setSaving(false);

    if (error) {
      console.error('Save expense error:', error);
      toast.error('บันทึกไม่สำเร็จ ลองใหม่อีกครั้งครับ');
      return;
    }

    setModalOpen(false);
    setEditing(null);
    load();
    toast.success(editing ? 'แก้ไขรายจ่ายแล้ว' : 'บันทึกรายจ่ายแล้ว');
  };

  const deleteExpense = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from('expenses').delete().eq('id', toDelete.id);
    if (error) {
      toast.error('ลบไม่สำเร็จ');
      return;
    }
    setExpenses((prev) => prev.filter((e) => e.id !== toDelete.id));
    setToDelete(null);
    toast.success('ลบรายจ่ายแล้ว');
  };

  // ── ไฟล์สำหรับเอาไปทำบัญชีต่อ ──
  //
  // ใส่เฉพาะรายการที่เป็น "เงินจริง" คือบิลที่ขายกับรายจ่ายที่คีย์ไว้
  // ไม่รวมต้นทุนปลาที่คิดจากราคาทุนที่ตั้งไว้ เพราะนั่นไม่ใช่เงินที่จ่ายออกในเดือนนี้
  // เอาไปปนกันแล้วนักบัญชีต้องมานั่งแยกออกทีหลัง
  const exportCsv = () => {
    const summary: string[][] =
      basis === 'cash'
        ? [
            ['เงินเข้าจริง', String(stats.cashIn)],
            ['บิลที่ปิดไว้แต่ไม่รู้วันรับเงิน (ไม่ได้นับ)', String(noPaidDate.amount)],
            ['เงินคืนลูกค้า (ปลาตาย)', String(stats.refund)],
            ['รายจ่ายที่จ่ายจริง', String(stats.other)],
            ['เงินสดคงเหลือ', String(stats.net)],
          ]
        : [
            ['ยอดขายรวม', String(stats.sales)],
            ['ต้นทุนสินค้าที่ขายไป (จากราคาทุนที่ตั้งไว้)', String(stats.goodsCost)],
            ['ค่าส่งที่จ่ายจริง', String(stats.shippingCost)],
            ['เงินคืนลูกค้า (ปลาตาย)', String(stats.refund)],
            ['รายจ่ายอื่น', String(stats.other)],
            ['คงเหลือ', String(stats.net)],
          ];

    const rows: string[][] = [
      ['บัญชีร้าน', `${start} ถึง ${end}`, BASIS_LABEL[basis]],
      [],
      ['สรุป'],
      ...summary,
      [],
      [basis === 'cash' ? 'รายรับ — บิลที่เงินเข้าในช่วงนี้' : 'รายรับ — บิลที่ออกในช่วงนี้'],
      ['วันที่ออกบิล', 'วันที่รับเงิน', 'เลขบิล', 'ลูกค้า', 'ยอดรวม', 'รับเงินแล้ว', 'สถานะ'],
      ...orders.map((o) => [
        o.created_at.slice(0, 10),
        o.paid_at ? o.paid_at.slice(0, 10) : '',
        o.order_number || '',
        o.customer_name || '',
        String(o.total_amount || 0),
        String(o.paid_amount || 0),
        PAYMENT_TH[o.payment_status || 'unpaid'] || o.payment_status || '',
      ]),
      [],
      ['รับเงินแยกตามบัญชี'],
      ['บัญชี', 'จำนวนบิล', 'สลิปที่ยืนยันแล้ว', 'ยอดรวม'],
      ...stats.byAccount.map((a) => [a.name, String(a.count), String(a.slips), String(a.amount)]),
      [],
      ['รายจ่ายที่คีย์ไว้'],
      ['วันที่', 'หมวด', 'รายละเอียด', 'จำนวนเงิน'],
      ...expenses.map((e) => [e.spent_on, e.category, e.note || '', String(e.amount)]),
    ];

    const csv = rows
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // \uFEFF (BOM) ต้องนำหน้าไฟล์ ไม่งั้น Excel เปิดแล้วภาษาไทยเป็นตัวยึกยือ
    // เขียนเป็นรหัส ไม่ใช่อักขระจริง — อักขระ BOM มองไม่เห็นในเอดิเตอร์ หายไปเมื่อไหร่ก็ไม่มีใครรู้
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `บัญชีร้าน-${start}-ถึง-${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('ดาวน์โหลดไฟล์แล้ว', { description: 'เปิดด้วย Excel หรือส่งให้นักบัญชีได้เลย' });
  };

  const line = (label: string, value: number, opts?: { minus?: boolean; hint?: string }) => (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div className="min-w-0">
        <span className="text-muted-foreground">{label}</span>
        {opts?.hint && <p className="text-muted-foreground/70 text-xs">{opts.hint}</p>}
      </div>
      <span className={cn('shrink-0 font-medium tabular-nums', opts?.minus && 'text-warning')}>
        {opts?.minus ? '-' : ''}฿{money(value)}
      </span>
    </div>
  );

  return (
    <Layout>
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-5 pb-10">
        <PageHeader
          title="บัญชีร้าน"
          description="เงินเข้า–เงินออกของร้าน สำหรับทำงบและส่งให้นักบัญชี"
          action={
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading}>
              <Download className="size-4" /> ดาวน์โหลด CSV
            </Button>
          }
        />

        {/* ── เกณฑ์การนับ ── */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(BASIS_LABEL) as Basis[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setBasis(key)}
              aria-pressed={basis === key}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors active:scale-[0.98]',
                basis === key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              {BASIS_LABEL[key]}
            </button>
          ))}
        </div>

        {/* ── ช่วงเวลา ── */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors active:scale-[0.98]',
                period === key
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              {PERIOD_LABEL[key]}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="acc-start">ตั้งแต่</Label>
              <Input
                id="acc-start"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-end">ถึง</Label>
              <Input
                id="acc-end"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </div>
        )}

        {loading ? (
          <PageLoader label="กำลังรวมยอด…" />
        ) : (
          <>
            {/* ── งบของช่วงที่เลือก ── */}
            <Card>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Wallet className="text-primary size-4" />
                  <span className="font-medium">สรุปช่วงนี้</span>
                  <span className="text-muted-foreground text-xs">{stats.orderCount} บิล</span>
                </div>

                {basis === 'cash' ? (
                  <>
                    {line('เงินเข้าจริง', stats.cashIn, {
                      hint: 'เฉพาะบิลที่มีวันที่รับเงินอยู่ในช่วงนี้',
                    })}
                    {noPaidDate.count > 0 &&
                      line('— บิลที่ไม่รู้วันรับเงิน', noPaidDate.amount, {
                        hint: `${noPaidDate.count} บิลในช่วงนี้ปิดไว้ตั้งแต่ก่อนระบบเก็บวันที่ ยอดนี้ไม่ได้ถูกนับข้างบน`,
                      })}

                    <Separator />

                    {stats.refund > 0 && line('เงินคืนลูกค้า (ปลาตาย)', stats.refund, { minus: true })}
                    {line('รายจ่ายที่จ่ายจริง', stats.other, { minus: true })}
                    <p className="text-muted-foreground/70 text-xs leading-relaxed">
                      โหมดนี้ไม่หักต้นทุนปลา เพราะไม่ใช่เงินที่จ่ายออกในช่วงนี้ — ค่าปลา ค่าอาหาร
                      ที่ซื้อเข้าให้คีย์เป็นรายจ่ายตามวันที่จ่ายจริง
                    </p>
                  </>
                ) : (
                  <>
                    {line('ยอดขายรวม', stats.sales)}
                    {stats.unpaid > 0 &&
                      line('— ในนั้นยังเก็บเงินไม่ได้', stats.unpaid, {
                        hint: 'ยอดขายด้านบนนับทุกบิลที่ออก ไม่ว่าจะเก็บเงินได้แล้วหรือยัง',
                      })}

                    <Separator />

                    {line('ต้นทุนสินค้าที่ขายไป', stats.goodsCost, {
                      minus: true,
                      hint: 'คิดจากราคาทุนที่ตั้งไว้ตอนออกบิล ไม่ใช่เงินที่จ่ายซื้อจริงในเดือนนี้',
                    })}
                    {line('ค่าส่งที่จ่ายจริง', stats.shippingCost, {
                      minus: true,
                      hint:
                        stats.missingActualShipping > 0
                          ? `${stats.missingActualShipping} บิลยังไม่ได้กรอกค่าส่งจริง ใช้ค่าส่งที่เก็บลูกค้าแทนไปก่อน`
                          : undefined,
                    })}
                    {stats.refund > 0 && line('เงินคืนลูกค้า (ปลาตาย)', stats.refund, { minus: true })}
                    {line('รายจ่ายอื่นของร้าน', stats.other, { minus: true })}
                  </>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="font-medium">{basis === 'cash' ? 'เงินสดคงเหลือ' : 'คงเหลือ'}</span>
                  <span
                    className={cn(
                      'text-2xl font-semibold tabular-nums',
                      stats.net >= 0 ? 'text-primary' : 'text-destructive'
                    )}
                  >
                    ฿{money(stats.net)}
                  </span>
                </div>

                {stats.byCategory.length > 0 && (
                  <>
                    <Separator />
                    <p className="text-muted-foreground text-xs font-medium">รายจ่ายแยกตามหมวด</p>
                    <div className="space-y-1.5">
                      {stats.byCategory.map(([cat, amount]) => (
                        <div key={cat} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{cat}</span>
                          <span className="font-medium tabular-nums">฿{money(amount)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* ── รับเงินแยกตามบัญชี ── */}
            {stats.byAccount.length > 0 && (
              <Card>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="text-primary size-4" />
                    <span className="font-medium">
                      {basis === 'cash' ? 'เงินเข้าแยกตามบัญชี' : 'ยอดบิลแยกตามบัญชี'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {stats.byAccount.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-start justify-between gap-3 border-b pb-2 last:border-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{account.name}</p>
                          <p className="text-muted-foreground text-xs">
                            {account.count} บิล · สลิปยืนยันแล้ว {account.slips} ใบ
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          ฿{money(account.amount)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="text-muted-foreground/70 text-xs leading-relaxed">
                    "สลิปยืนยันแล้ว" คือจำนวนครั้งที่มีเงินโอนเข้าพร้อมหลักฐานภาพ
                    บิลที่ปิดโดยกดสถานะเอง (รับสด/นัดรับ) จะมีบิลแต่ไม่มีสลิป ตัวเลขสองช่องนี้จึงไม่เท่ากันเป็นเรื่องปกติ
                    <br />
                    ทั้งหมดนับเฉพาะบิลที่อยู่ในระบบ — ยอดในสมุดบัญชีธนาคารจะมากกว่านี้เสมอถ้าบัญชีนั้นรับเงินอย่างอื่นด้วย
                  </p>
                </CardContent>
              </Card>
            )}

            {/* ── รายจ่าย ── */}
            <Card>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Receipt className="text-primary size-4" />
                    <span className="font-medium">รายจ่ายของร้าน</span>
                  </div>
                  <Button size="sm" onClick={openAdd}>
                    <Plus className="size-4" /> เพิ่มรายจ่าย
                  </Button>
                </div>

                {expenses.length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title="ยังไม่มีรายจ่ายในช่วงนี้"
                    description="ค่าอาหารปลา ค่าไฟ ค่ากล่อง ค่าน้ำมันไปส่งของ — คีย์ไว้ที่นี่แล้วจะถูกหักออกจากยอดคงเหลือให้"
                  />
                ) : (
                  <div className="divide-y">
                    {expenses.map((expense) => (
                      <div key={expense.id} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{expense.category}</p>
                          <p className="text-muted-foreground truncate text-xs">
                            {thaiDate(expense.spent_on)}
                            {expense.note ? ` · ${expense.note}` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          ฿{money(expense.amount)}
                        </span>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="แก้ไข"
                            onClick={() => openEdit(expense)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="ลบ"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setToDelete(expense)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-muted-foreground text-center text-xs leading-relaxed">
              ตัวเลขหน้านี้คือบันทึกของร้านเอง ไม่ใช่เอกสารทางบัญชี
              <br />
              ก่อนเอาไปยื่นภาษี ให้นักบัญชีตรวจไฟล์ CSV อีกครั้งนะครับ
            </p>
          </>
        )}
      </div>

      {/* ── เพิ่ม/แก้รายจ่าย ── */}
      <ResponsiveModal open={modalOpen} onOpenChange={setModalOpen}>
        <ResponsiveModalContent className="sm:max-w-md">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{editing ? 'แก้ไขรายจ่าย' : 'เพิ่มรายจ่าย'}</ResponsiveModalTitle>
          </ResponsiveModalHeader>

          <ResponsiveModalBody className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp-date">วันที่จ่าย</Label>
              <Input
                id="exp-date"
                type="date"
                value={form.spent_on}
                onChange={(e) => setForm((f) => ({ ...f, spent_on: e.target.value }))}
              />
              <p className="text-muted-foreground text-xs">
                ใส่วันที่ตามใบเสร็จได้เลย เก็บไว้คีย์ทีเดียวตอนสิ้นเดือนก็ได้
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exp-category">หมวด</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger id="exp-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exp-amount">จำนวนเงิน (บาท)</Label>
              <Input
                id="exp-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exp-note">รายละเอียด</Label>
              <Input
                id="exp-note"
                placeholder="เช่น อาหารเม็ด 2 กระปุก / ค่าไฟเดือน ก.ย."
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
              <p className="text-muted-foreground text-xs">
                ค่าส่งพัสดุรายบิลไม่ต้องใส่ที่นี่ กรอกในบิลแล้วระบบหักให้เอง
              </p>
            </div>
          </ResponsiveModalBody>

          <ResponsiveModalFooter>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" onClick={() => setModalOpen(false)}>
                ยกเลิก
              </Button>
              <Button size="lg" onClick={saveExpense} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </Button>
            </div>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* ── ยืนยันลบ ── */}
      <ResponsiveModal open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <ResponsiveModalContent className="sm:max-w-sm">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>ลบรายจ่ายนี้?</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <ResponsiveModalBody>
            <p className="text-sm">
              {toDelete?.category} · ฿{money(toDelete?.amount || 0)}
              {toDelete?.note ? ` · ${toDelete.note}` : ''}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">ลบแล้วยอดคงเหลือจะเปลี่ยนตาม</p>
          </ResponsiveModalBody>
          <ResponsiveModalFooter>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" onClick={() => setToDelete(null)}>
                ยกเลิก
              </Button>
              <Button variant="destructive" size="lg" onClick={deleteExpense}>
                <Trash2 className="size-4" /> ลบ
              </Button>
            </div>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </Layout>
  );
}
