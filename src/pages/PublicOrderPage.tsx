import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Fish, Loader2, Check, Send } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { supabase } from '../lib/supabase';
import PromptPayQR from '../components/PromptPayQR';

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

const TYPE_LABEL: Record<string, string> = { piece: 'ตัว', pair: 'คู่', set: 'ชุด' };
const GENDER_LABEL: Record<string, string> = { male: '♂', female: '♀', mixed: '⚥' };

const PAYMENT_TEXT: Record<string, { text: string; cls: string }> = {
  unpaid:  { text: 'รอชำระเงิน', cls: 'bg-amber-100 text-amber-700' },
  deposit: { text: 'ชำระมัดจำแล้ว', cls: 'bg-blue-100 text-blue-700' },
  paid:    { text: 'ชำระเงินแล้ว', cls: 'bg-green-100 text-green-700' },
};

const STATUS_TEXT: Record<string, { text: string; cls: string }> = {
  pending:   { text: 'กำลังเตรียมของ', cls: 'bg-slate-100 text-slate-600' },
  shipped:   { text: 'จัดส่งแล้ว', cls: 'bg-blue-100 text-blue-700' },
  delivered: { text: 'ส่งถึงแล้ว', cls: 'bg-green-100 text-green-700' },
  cancelled: { text: 'ยกเลิก', cls: 'bg-red-100 text-red-600' },
};

export default function PublicOrderPage() {
  const { token } = useParams<{ token: string }>();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      } else {
        const o = data as PublicOrder;
        setOrder(o);
        setName(o.customer_name || '');
        setPhone(o.customer_phone || '');
        setAddress(o.customer_address || '');
      }
      setLoading(false);
    })();

    return () => { active = false; };
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
        reason === 'already_shipped' ? 'ออเดอร์นี้จัดส่งแล้ว ไม่สามารถแก้ที่อยู่ได้'
        : reason === 'too_long' ? 'ข้อมูลยาวเกินกำหนด'
        : 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง'
      );
      return;
    }

    setSaved(true);
    toast.success('บันทึกที่อยู่เรียบร้อยแล้ว ขอบคุณครับ');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <Fish className="h-12 w-12 text-slate-300 mb-4" />
        <h1 className="font-black text-lg text-slate-700">ไม่พบใบสรุปนี้</h1>
        <p className="text-sm text-slate-400 mt-2">ลิงก์อาจไม่ถูกต้อง กรุณาสอบถามทางร้านอีกครั้ง</p>
      </div>
    );
  }

  const canEditAddress = order.status === 'pending';
  const payment = PAYMENT_TEXT[order.payment_status] || PAYMENT_TEXT.unpaid;
  const status = STATUS_TEXT[order.status] || STATUS_TEXT.pending;

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <Toaster position="top-center" richColors />

      <div className="max-w-md mx-auto space-y-4">
        {/* หัวใบสรุป */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 text-center">
          <div className="inline-flex p-3 bg-blue-600 rounded-2xl mb-3">
            <Fish className="h-6 w-6 text-white" />
          </div>
          <h1 className="font-black text-xl text-slate-900 tracking-tight">ใบสรุปรายการสั่งซื้อ</h1>
          <p className="text-xs font-bold text-blue-600 mt-1">{order.order_number}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            {new Date(order.created_at).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${payment.cls}`}>{payment.text}</span>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${status.cls}`}>{status.text}</span>
          </div>
          {order.tracking_number && (
            <p className="text-xs font-bold text-slate-600 mt-3">📦 เลขพัสดุ {order.tracking_number}</p>
          )}
        </div>

        {/* รายการปลา */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">รายการ</p>
          <div className="space-y-2.5">
            {order.items?.map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-bold text-slate-700 leading-snug">
                    {item.breedName} {item.gender ? GENDER_LABEL[item.gender] : ''}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {item.quantity} {TYPE_LABEL[item.type] || item.type}
                    {item.freeQty ? ` (แถม ${item.freeQty})` : ''}
                  </p>
                </div>
                <span className="font-black text-slate-800 shrink-0">
                  ฿{(item.price * Math.max(0, item.quantity - (item.freeQty || 0)) - (item.discount || 0)).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 mt-4 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>จำนวนปลา</span><span className="font-bold">{order.total_fish} ตัว</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>ค่าจัดส่ง</span><span className="font-bold">฿{(order.shipping_fee || 0).toLocaleString()}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-orange-500">
                <span>ส่วนลด</span><span className="font-bold">-฿{order.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <span className="font-black text-slate-800">ยอดรวม</span>
              <span className="font-black text-2xl text-blue-600">฿{(order.total_amount || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* ชำระเงิน */}
        {order.payment_status !== 'paid' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">ชำระเงิน</p>

            <PromptPayQR
              promptPayId={order.payment.promptpay_id}
              amount={order.total_amount || 0}
              reference={order.order_number}
            />

            {order.payment.account_number && (
              <div className="mt-4 pt-4 border-t border-slate-100 text-sm text-center">
                <p className="text-[11px] text-slate-400 mb-1">หรือโอนเข้าบัญชี</p>
                <p className="font-bold text-slate-700">{order.payment.bank_name}</p>
                <p className="font-black text-lg text-slate-900 tracking-wide">{order.payment.account_number}</p>
                <p className="text-xs text-slate-500">{order.payment.account_name}</p>
              </div>
            )}

            <p className="text-[11px] text-slate-400 text-center mt-4">
              ชำระแล้วรบกวนส่งสลิปในไลน์ได้เลยครับ 🙏
            </p>
          </div>
        )}

        {/* ที่อยู่จัดส่ง */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">ที่อยู่จัดส่ง</p>

          {!canEditAddress ? (
            <div className="text-sm text-slate-600 space-y-1">
              <p className="font-bold">{order.customer_name || '-'}</p>
              <p>{order.customer_phone || '-'}</p>
              <p className="text-slate-500 leading-relaxed">{order.customer_address || '-'}</p>
              <p className="text-[11px] text-slate-400 pt-2">ออเดอร์จัดส่งแล้ว ไม่สามารถแก้ไขที่อยู่ได้</p>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ชื่อผู้รับ"
                className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                inputMode="tel"
                placeholder="เบอร์โทรศัพท์"
                className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
              />
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={4}
                placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 resize-y"
              />
              <button
                onClick={submitContact}
                disabled={saving}
                className="w-full h-13 min-h-[52px] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 active:scale-[0.98] transition-all text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" />
                  : saved ? <><Check className="h-4 w-4" /> บันทึกแล้ว</>
                  : <><Send className="h-4 w-4" /> ส่งที่อยู่ให้ร้าน</>}
              </button>
              {saved && (
                <p className="text-[11px] text-green-600 text-center font-bold">
                  ร้านได้รับที่อยู่แล้ว แก้ไขเพิ่มได้จนกว่าจะจัดส่ง
                </p>
              )}
            </div>
          )}
        </div>

        {order.note && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">หมายเหตุ</p>
            <p className="text-sm text-slate-600">{order.note}</p>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-300 py-4">GuppyReal</p>
      </div>
    </div>
  );
}
