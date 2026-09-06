import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Check,
  Copy,
  Loader2,
  MessageCircle,
  Pencil,
  Receipt,
  Send,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import PromptPayQR from '@/components/PromptPayQR';
import { closeLiffWindow, getLineProfile } from '@/utils/liff';
import { normalizeThaiPhone, validateShippingContact } from '@/utils/address';
import { cn } from '@/lib/utils';
import { FARM } from '@/config/farm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { PageLoader } from '@/components/ui/page-loader';

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
  // สถานะสลิปใบล่าสุด — null คือยังไม่เคยส่ง
  slip_status?: 'pending' | 'confirmed' | 'rejected' | null;
  /** เหตุผลที่ร้านปฏิเสธสลิปใบล่าสุด */
  slip_note?: string | null;
  line_display_name?: string | null;
  /** ชื่อในบิลนี้ลูกค้าเป็นคนกรอกเอง ไม่ใช่ร้านใส่ให้ */
  contact_from_customer?: boolean;
  payment: {
    promptpay_id?: string | null;
    bank_name?: string | null;
    account_number?: string | null;
    account_name?: string | null;
  };
}

type BadgeVariant = React.ComponentProps<typeof Badge>['variant'];

/**
 * ทางกลับเข้าแอปไลน์สำหรับคนที่เปิดใบสรุปในเบราว์เซอร์ธรรมดา
 *
 * ในแอปไลน์ใช้ liff.closeWindow() ปิดกลับไปที่แชทได้ตรง ๆ อยู่แล้ว
 * นอกแอปปิดแท็บแทนลูกค้าไม่ได้ ต้องส่งกลับเข้าไลน์ด้วยลิงก์แทน
 * ยังไม่ได้ตั้งลิงก์ร้านใน FARM.lineUrl ก็พากลับไปหน้ารายการแชทของไลน์ไปก่อน
 */
const LINE_CHAT_URL = FARM.lineUrl || 'https://line.me/R/nv/chat';

/**
 * ลายนิ้วมือของไฟล์ ไว้ให้ร้านรู้ว่าสลิปใบนี้เคยส่งมาแล้วหรือยัง
 *
 * ไม่ได้อ่านอะไรจากรูป แค่ย่อยไฟล์ทั้งก้อนเป็นเลขชุดเดียว
 * crypto.subtle ต้องการ https ซึ่ง LIFF เป็นอยู่แล้ว แต่ถ้าพลาดก็ไม่ควรทำให้อัปสลิปไม่ได้
 */
async function fileHash(file: File): Promise<string | null> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

/**
 * ชื่อที่เอาไปตั้งไว้ในช่อง "ชื่อผู้รับ"
 *
 * ชื่อในบิลเชื่อได้ก็ต่อเมื่อลูกค้าเป็นคนกรอกเอง (contact_from_customer)
 * ถ้าร้านเป็นคนใส่ ปล่อยว่างไว้ดีกว่าตั้งชื่อผิดไว้ให้ลูกค้ากดผ่าน —
 * ชื่อ LINE พอใช้เป็นตัวตั้งได้ เพราะอย่างน้อยก็มาจากบัญชีของเจ้าตัวเอง
 */
function nameSuggestion(order: PublicOrder, displayName?: string | null): string {
  if (order.contact_from_customer && order.customer_name) return order.customer_name;
  return displayName || '';
}

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
  const [copiedTracking, setCopiedTracking] = useState(false);
  // กด "เสร็จสิ้น" นอกแอปไลน์ — ปิดแท็บให้ไม่ได้ เลยสลับไปหน้าจบแทน
  const [finished, setFinished] = useState(false);
  const addressRef = useRef<HTMLDivElement>(null);
  const finishRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [uploading, setUploading] = useState(false);
  const [slipStatus, setSlipStatus] = useState<PublicOrder['slip_status']>(null);
  const [lineName, setLineName] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState(false);
  const lineUserIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // ยังไม่รู้ชื่อ LINE ตอนนี้ — เติมทีหลังหลังผูกบัญชีเสร็จ
      setName(nameSuggestion(o));
      setPhone(o.customer_phone || '');
      setAddress(o.customer_address || '');
      setSlipStatus(o.slip_status ?? null);
      setLineName(o.line_display_name ?? null);
      setLoading(false);

      // ถ้าเปิดในแอป LINE ให้ผูกบัญชีกับออเดอร์เงียบ ๆ
      // ลูกค้าจะได้รับอัปเดตพัสดุอัตโนมัติโดยไม่ต้องทำอะไรเพิ่ม
      // เปิดในเบราว์เซอร์ธรรมดาก็ข้ามไป หน้ายังใช้งานได้ครบ
      const profile = await getLineProfile();
      if (!active || !profile) return;
      lineUserIdRef.current = profile.userId;

      const { data: linked } = await supabase.rpc('link_order_line_user', {
        p_token: token,
        p_line_user_id: profile.userId,
        p_display_name: profile.displayName,
      });
      if (active && linked?.ok) {
        setLinkedToLine(true);
        // แสดงชื่อที่เพิ่งส่งไปเลย ไม่ต้องรอโหลดใบสรุปใหม่
        if (profile.displayName) setLineName(profile.displayName);

        // ตอนผูกบัญชี ฝั่ง DB อาจเติมชื่อ/เบอร์/ที่อยู่จากครั้งก่อนลงบิลให้
        // ต้องอ่านซ้ำ ไม่งั้นฟอร์มยังว่างทั้งที่ข้อมูลเข้าไปแล้ว
        const { data: refreshed } = await supabase.rpc('get_public_order', { p_token: token });
        if (!active || !refreshed) return;

        const r = refreshed as PublicOrder;
        setOrder(r);
        // เขียนเฉพาะช่องที่ยังว่าง เผื่อลูกค้าเริ่มพิมพ์ไปแล้วระหว่างรอ
        //
        // ชื่อ: ใช้ของในบิลได้เฉพาะตอนที่ลูกค้าเคยกรอกเอง
        // ร้านออกบิลตอนรู้จักลูกค้าแค่ชื่อในแชท บางทีใส่ชื่อคร่าว ๆ ไปก่อน
        // เอามาตั้งไว้ในช่องแล้วลูกค้ากดผ่าน จะได้ชื่อมั่ว ๆ ไปจ่าหน้ากล่อง
        setName((prev) => prev || nameSuggestion(r, profile.displayName));
        setPhone((prev) => prev || r.customer_phone || '');
        setAddress((prev) => prev || r.customer_address || '');
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  // แก้ช่องไหนก็ตาม = ยังไม่ได้บันทึกของใหม่
  // ถ้าปล่อยให้ปุ่มค้างว่า "บันทึกแล้ว" ลูกค้าที่แก้ที่อยู่จะเชื่อว่าส่งไปแล้ว
  // ปิดหน้าไปเลย ที่อยู่ใหม่หายโดยไม่มีใครรู้
  const editField = (setter: (v: string) => void, value: string) => {
    setter(value);
    setSaved(false);
  };

  // กล่องท้ายหน้าเพิ่งเปลี่ยนเป็น "เรียบร้อยแล้ว" — ต้องพาสายตาลูกค้าไปเห็นเอง
  // ปุ่มที่เพิ่งกดอยู่กลางหน้า ถ้าไม่เลื่อนให้ก็ไม่มีอะไรบอกว่าครบทุกขั้นแล้ว
  const scrollToFinish = () => {
    setTimeout(() => finishRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
  };

  // "เสร็จสิ้น" — ในแอปไลน์คือปิดใบสรุปกลับไปที่แชทร้าน
  // เปิดในเบราว์เซอร์ธรรมดาปิดแท็บให้ไม่ได้ เลยขึ้นหน้าจบแทน จะได้จบเหมือนกัน
  const finishOrder = async () => {
    if (await closeLiffWindow()) return;
    setFinished(true);
    window.scrollTo({ top: 0 });
  };

  const submitContact = async () => {
    const problem = validateShippingContact({ name, phone, address });
    if (problem) {
      toast.error(problem);
      return;
    }

    // เก็บเบอร์เป็นเลขล้วนขึ้นต้น 0 เสมอ ร้านจะได้ก็อปไปกรอกฟอร์มส่งพัสดุได้เลย
    const normalizedPhone = normalizeThaiPhone(phone) || phone;

    setSaving(true);
    const { data, error } = await supabase.rpc('submit_order_contact', {
      p_token: token,
      p_name: name,
      p_phone: normalizedPhone,
      p_address: address,
    });
    setSaving(false);

    if (error || !data?.ok) {
      const reason = data?.reason;
      const REASONS: Record<string, string> = {
        already_shipped: 'ออเดอร์นี้จัดส่งแล้ว ไม่สามารถแก้ที่อยู่ได้',
        too_long: 'ข้อมูลยาวเกินกำหนด',
        no_postcode: 'ที่อยู่ยังไม่มีรหัสไปรษณีย์ รบกวนใส่เลข 5 หลักด้วยครับ',
        address_too_short: 'ที่อยู่สั้นเกินไป รบกวนใส่ให้ครบถึงจังหวัดครับ',
        bad_phone: 'เบอร์โทรไม่ถูกต้อง กรอกเป็นเลข 10 หลัก เช่น 0812345678',
      };
      toast.error(REASONS[reason] || 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง');
      return;
    }

    setSaved(true);
    // พับกลับไปเป็นแบบอ่านอย่างเดียว พร้อมค่าที่เพิ่งบันทึก
    // ไม่งั้นฟอร์มค้างเปิดอยู่ ดูเหมือนยังทำไม่เสร็จ
    setEditingAddress(false);
    setOrder((prev) =>
      prev
        ? { ...prev, customer_name: name, customer_phone: normalizedPhone, customer_address: address }
        : prev
    );
    toast.success('บันทึกที่อยู่เรียบร้อยแล้ว ขอบคุณครับ');

    // ที่อยู่เป็นขั้นสุดท้ายพอดี (จ่ายเงิน/ส่งสลิปไปแล้ว) — พาไปดูกล่องจบท้ายหน้า
    if (order?.payment_status === 'paid' || slipStatus === 'pending' || slipStatus === 'confirmed') {
      scrollToFinish();
    }
  };

  // อัปสลิปจากหน้านี้ — ต่างจากส่งเข้าไลน์ตรงที่รู้อยู่แล้วว่าเป็นบิลไหน
  // ไม่ต้องให้ร้านมานั่งจับคู่ทีหลัง
  const uploadSlip = async (file: File) => {
    // บัคเก็ตรับแค่ 3 ชนิดนี้ ดักตั้งแต่ตรงนี้จะได้บอกเหตุผลได้ชัดกว่า error จาก storage
    // iPhone บางรุ่นส่ง HEIC มา ถ้าเจอก็บอกให้ส่งทางไลน์แทน ไม่ปล่อยให้งง
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('รองรับเฉพาะไฟล์ JPG, PNG, WebP\nถ้าเป็นไฟล์แบบอื่น รบกวนถ่ายภาพหน้าจอแล้วส่งใหม่ครับ');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ไฟล์ใหญ่เกิน 5MB รบกวนถ่ายใหม่หรือย่อรูปก่อนครับ');
      return;
    }

    setUploading(true);
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `p/${token}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('slips')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      setUploading(false);
      toast.error('อัปโหลดไม่สำเร็จ รบกวนลองใหม่อีกครั้ง หรือทักหาแอดมินได้เลยครับ');
      return;
    }

    const { data, error } = await supabase.rpc('submit_order_slip', {
      p_token: token,
      p_path: path,
      p_line_user_id: lineUserIdRef.current,
      p_image_hash: await fileHash(file),
    });
    setUploading(false);

    if (error || !data?.ok) {
      const reason = data?.reason;
      toast.error(
        reason === 'already_shipped'
          ? 'ออเดอร์นี้จัดส่งแล้ว ไม่ต้องส่งสลิปเพิ่มครับ'
          : reason === 'too_many'
            ? 'ส่งสลิปมาหลายใบแล้ว รอทางร้านตรวจสอบสักครู่นะครับ'
            : 'บันทึกสลิปไม่สำเร็จ รบกวนลองใหม่ หรือทักหาแอดมินได้เลยครับ'
      );
      return;
    }

    setSlipStatus('pending');
    toast.success('ได้รับสลิปแล้วครับ ทางร้านกำลังตรวจสอบ 🙏');

    // จ่ายเงินเสร็จลูกค้าถือว่าจบแล้ว ถ้ายังไม่มีที่อยู่ต้องพาไปตรงนั้นทันที
    // ไม่บล็อกการส่งสลิป แค่ไม่ปล่อยให้ปิดหน้าไปโดยที่ร้านไม่รู้จะส่งไปไหน
    if (!order?.customer_address?.trim()) {
      setTimeout(() => {
        addressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toast.warning('เหลืออีกขั้นเดียว', { description: 'กรอกที่อยู่จัดส่งให้ร้านด้วยนะครับ' });
      }, 600);
    } else {
      // ครบทุกขั้นแล้ว — พาไปที่ปุ่ม "เสร็จสิ้น" ท้ายหน้า
      scrollToFinish();
    }
  };

  // ลากเลือกตัวหนังสือในเบราว์เซอร์ของไลน์ทำยาก ต้องมีปุ่มให้กด
  const copyTracking = async () => {
    if (!order?.tracking_number) return;
    try {
      await navigator.clipboard.writeText(order.tracking_number);
      setCopiedTracking(true);
      toast.success('คัดลอกเลขพัสดุแล้ว');
      setTimeout(() => setCopiedTracking(false), 2000);
    } catch {
      toast.error('คัดลอกไม่สำเร็จ');
    }
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
    // หน้าแรกที่ลูกค้าเห็นหลังกดลิงก์จากไลน์ — ให้เจอโลโก้ร้าน ไม่ใช่วงกลมหมุน
    return <PageLoader className="min-h-[100dvh]" label="กำลังเปิดใบสรุป…" />;
  }

  if (!order) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
        <img
          src="/logo.png"
          alt=""
          aria-hidden
          width={56}
          height={56}
          className="mb-4 size-14 rounded-full object-contain opacity-50"
        />
        <h1 className="text-lg font-semibold">ไม่พบใบสรุปนี้</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          ลิงก์อาจไม่ถูกต้อง กรุณาสอบถามทางร้านอีกครั้ง
        </p>
      </div>
    );
  }

  // หน้าจบ — ปิดแท็บแทนลูกค้าไม่ได้ อย่างน้อยต้องมีจอที่บอกชัด ๆ ว่าจบแล้ว
  // ไม่ใช่ปล่อยให้ค้างอยู่หน้าใบสรุปแล้วเดาเองว่ายังเหลืออะไรอีกไหม
  if (finished) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
        <div className="bg-success/15 mb-4 flex size-16 items-center justify-center rounded-full">
          <Check className="text-success size-8" />
        </div>
        <h1 className="text-lg font-semibold">ขอบคุณครับ 🙏</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          ร้านได้รับข้อมูลของบิล {order.order_number} ครบแล้ว
          <br />
          ปิดหน้านี้ได้เลย เมื่อจัดส่งทางร้านจะแจ้งเลขพัสดุให้ครับ
        </p>
        <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
          <Button variant="line" size="lg" asChild>
            <a href={LINE_CHAT_URL}>
              <MessageCircle className="size-4" /> กลับไปที่แชทไลน์
            </a>
          </Button>
          <Button variant="ghost" onClick={() => setFinished(false)}>
            กลับไปดูใบสรุป
          </Button>
        </div>
      </div>
    );
  }

  const canEditAddress = order.status === 'pending';
  const hasSavedAddress = !!order.customer_address?.trim();
  const payment = PAYMENT_TEXT[order.payment_status] || PAYMENT_TEXT.unpaid;
  const status = STATUS_TEXT[order.status] || STATUS_TEXT.pending;

  // ลูกค้าเหลืออะไรต้องทำอีกไหม — ใช้คุมกล่องปิดท้าย
  // บิลที่จัดส่งแล้วถือว่าที่อยู่ครบแน่นอน ไม่งั้นร้านคงส่งไม่ได้
  const contactDone = hasSavedAddress || !canEditAddress;
  const slipSubmitted = slipStatus === 'pending' || slipStatus === 'confirmed';
  const slipPending = order.payment_status !== 'paid' && slipSubmitted;
  const paymentDone = order.payment_status === 'paid' || slipSubmitted;
  const allDone = contactDone && paymentDone;

  // ลูกค้าที่ยังไม่มีที่อยู่ต้องเจอช่องกรอกก่อนถึงจะสแกนจ่าย
  // เดิมจ่ายเงินอยู่บน พอโอนกับแนบสลิปเสร็จลูกค้าถือว่าจบแล้วและปิดหน้าไป
  // ร้านเลยได้เงินมาโดยไม่มีที่อยู่ส่ง ต้องไปตามทวงในแชท ซึ่งคือเรื่องที่หน้านี้ตั้งใจจะเลิกทำ
  // ลูกค้าเก่าที่มีที่อยู่แล้วไม่มีอะไรต้องกรอก จ่ายเงินขึ้นก่อนตามเดิม
  // สลิปถึงร้านแล้วไม่ต้องโชว์ QR กับเลขบัญชีอีก เหลือแค่บรรทัดยืนยัน
  // ของเดิมต้องเลื่อนผ่าน QR เต็มจอทุกครั้งที่เปิดใบสรุปกลับมาดูสถานะ
  const slipReceivedNote = (
    <div className="bg-success/10 flex items-start gap-2 rounded-xl px-4 py-3">
      <Receipt className="text-success mt-0.5 size-4 shrink-0" />
      <div>
        <p className="text-success text-sm font-medium">ได้รับสลิปแล้วครับ</p>
        <p className="text-success/80 text-xs">
          ทางร้านกำลังตรวจสอบ เมื่อยืนยันแล้วสถานะจะเปลี่ยนเป็น "ชำระเงินแล้ว"
        </p>
      </div>
    </div>
  );

  const paymentCard = order.payment_status !== 'paid' && (slipSubmitted ? slipReceivedNote : (
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

        <Separator className="my-4" />

        {/* แจ้งสลิป — ทำได้ 2 ทาง ตรงนี้กับส่งเข้าไลน์ ลงที่เดียวกัน */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // เคลียร์ค่าทิ้งทุกครั้ง ไม่งั้นเลือกไฟล์เดิมซ้ำแล้ว onChange ไม่ยิง
            e.target.value = '';
            if (file) uploadSlip(file);
          }}
        />
        <Button
          size="lg"
          className="w-full"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> กำลังส่งสลิป...
            </>
          ) : (
            <>
              <Upload className="size-4" />
              {slipStatus === 'rejected' ? 'ส่งสลิปใหม่อีกครั้ง' : 'แนบสลิปโอนเงิน'}
            </>
          )}
        </Button>
        {slipStatus === 'rejected' && (
          <div className="bg-warning/10 mt-3 rounded-xl px-3 py-2.5">
            <p className="text-warning text-xs font-medium">
              สลิปที่ส่งมาก่อนหน้านี้ตรวจสอบไม่ผ่าน
            </p>
            {/* บอกเหตุผลด้วย ไม่งั้นลูกค้าก็ส่งใบเดิมกลับมาอีก */}
            {order.slip_note && (
              <p className="text-warning/90 mt-0.5 text-xs">เหตุผล: {order.slip_note}</p>
            )}
            <p className="text-warning/90 mt-0.5 text-xs">รบกวนแนบใหม่อีกครั้งครับ 🙏</p>
          </div>
        )}
        <p className="text-muted-foreground mt-3 text-center text-xs">
          แนบที่นี่ทางเดียวนะครับ ระบบจะได้รู้ว่าเป็นของบิลไหนทันที 🙏
        </p>
      </CardContent>
    </Card>
  ));

  const addressCard = (
  <div ref={addressRef}>
  <Card>
    <CardContent>
      <p className="text-muted-foreground mb-3 text-sm font-medium">ที่อยู่จัดส่ง</p>

      {/* ชื่อ LINE ไม่ใช่ชื่อผู้รับ — โชว์ไว้ให้รู้ว่าร้านคุยกับบัญชีไหนอยู่ */}
      {lineName && (
        <div className="bg-muted/40 mb-3 flex items-center gap-2 rounded-lg px-3 py-2">
          <MessageCircle className="text-muted-foreground size-3.5 shrink-0" />
          <p className="text-muted-foreground text-xs">
            บัญชี LINE <span className="text-foreground font-medium">{lineName}</span>
          </p>
        </div>
      )}

      {!canEditAddress ? (
        <div className="space-y-1 text-sm">
          <p className="font-medium">{order.customer_name || lineName || '-'}</p>
          <p className="text-muted-foreground">{order.customer_phone || '-'}</p>
          <p className="text-muted-foreground leading-relaxed">{order.customer_address || '-'}</p>
          <p className="text-muted-foreground pt-2 text-xs">
            ออเดอร์จัดส่งแล้ว ไม่สามารถแก้ไขที่อยู่ได้
          </p>
        </div>
      ) : !editingAddress && hasSavedAddress ? (
        /* มีที่อยู่แล้ว — โชว์เฉย ๆ ไม่ต้องให้กรอกซ้ำ
           ฟอร์มเปล่าที่มีปุ่ม "ส่งที่อยู่" ค้างอยู่ทำให้เข้าใจว่ายังต้องทำอะไรอีก
           ทั้งที่จริงเหลือแค่แนบสลิป */
        <div className="space-y-3">
          <div className="space-y-1 text-sm">
            <p className="font-medium">{order.customer_name || lineName || '-'}</p>
            <p className="text-muted-foreground">{order.customer_phone || '-'}</p>
            <p className="text-muted-foreground leading-relaxed">{order.customer_address}</p>
          </div>

          <div className="bg-success/10 flex items-start gap-2 rounded-xl px-3 py-2.5">
            <Check className="text-success mt-0.5 size-4 shrink-0" />
            <p className="text-success text-xs leading-relaxed">ร้านได้รับที่อยู่แล้ว ไม่ต้องส่งซ้ำครับ</p>
          </div>

          <Button variant="outline" className="w-full" onClick={() => setEditingAddress(true)}>
            <Pencil className="size-4" /> แก้ไขที่อยู่
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">ชื่อผู้รับ</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => editField(setName, e.target.value)}
              placeholder="ชื่อ-นามสกุล สำหรับจ่าหน้ากล่อง"
            />
            {/* ช่องนี้ตั้งต้นด้วยชื่อ LINE ซึ่งมักเป็นชื่อเล่น
                บอกไว้กันลูกค้าปล่อยผ่านแล้วกล่องมาถึงพร้อมชื่อ "🐻หมีน้อย" */}
            {name && name === lineName && (
              <p className="text-muted-foreground text-xs">
                ดึงมาจากชื่อ LINE รบกวนแก้เป็นชื่อจริงถ้าไม่ตรงครับ
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-phone">เบอร์โทรศัพท์</Label>
            <Input
              id="p-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => editField(setPhone, e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-address">ที่อยู่</Label>
            <Textarea
              id="p-address"
              rows={4}
              value={address}
              onChange={(e) => editField(setAddress, e.target.value)}
              placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
            />
            <p className="text-muted-foreground text-xs">
              อย่าลืมรหัสไปรษณีย์ 5 หลัก ไม่งั้นทางร้านส่งของไม่ได้ครับ
            </p>
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
                <Send className="size-4" />
                {/* บิลที่มีที่อยู่อยู่แล้ว = กำลังแก้ ไม่ใช่ส่งครั้งแรก */}
                {order.customer_address ? 'บันทึกที่อยู่ใหม่' : 'ส่งที่อยู่ให้ร้าน'}
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
  </div>
  );

  // ── กล่องสถานะ อยู่ใต้บิล เหนือกล่องที่ต้องลงมือทำ ──
  // เดิมพอกรอกที่อยู่กับแนบสลิปครบแล้ว หน้านี้ก็เงียบไปเฉย ๆ ไม่มีอะไรบอกว่าจบแล้ว
  // ลูกค้าเลยค้างอยู่หน้าใบสรุปแล้วทักมาถามในแชทว่า "ต้องกดอะไรต่อ"
  //
  // ต้องอยู่เหนืองาน ไม่ใช่ท้ายหน้า — คนที่ยังไม่รู้ว่าต้องทำอะไรจะได้เห็นตั้งแต่แรก
  // ไม่ต้องเลื่อนผ่าน QR กับฟอร์มไปจนสุดหน้าถึงจะรู้ว่าตัวเองเหลืออะไร
  // ด้วยเหตุผลเดียวกัน คำใบ้แต่ละขั้นห้ามอ้าง "ด้านบน/ด้านล่าง" เพราะกล่องที่อยู่
  // กับกล่องจ่ายเงินสลับที่กันได้ ตามว่าบิลนั้นมีที่อยู่มาแล้วหรือยัง
  //
  // บิลที่ยกเลิกแล้วไม่ต้องมีขั้นตอนอะไรให้ทำ ข้ามไปเลย
  const steps = [
    {
      done: contactDone,
      label: 'ส่งที่อยู่ให้ร้าน',
      hint: contactDone ? 'ร้านได้รับที่อยู่แล้ว' : 'กรอกชื่อ เบอร์ และที่อยู่ให้ร้าน',
    },
    {
      done: paymentDone,
      label: 'ชำระเงินและแนบสลิป',
      hint:
        order.payment_status === 'paid'
          ? 'ร้านยืนยันการชำระเงินแล้ว'
          : slipStatus === 'pending'
            ? 'ได้รับสลิปแล้ว รอทางร้านตรวจสอบ'
            : slipStatus === 'rejected'
              ? 'สลิปใบก่อนตรวจสอบไม่ผ่าน รบกวนแนบใหม่'
              : 'สแกน QR จ่ายเงิน แล้วกดแนบสลิป',
    },
  ];

  const finishCard = order.status !== 'cancelled' && (
    <div ref={finishRef}>
      <Card className={allDone ? 'border-success/40 bg-success/5' : undefined}>
        <CardContent>
          {allDone ? (
            // จบแล้วไม่ต้องไล่เช็กลิสต์ให้อ่านซ้ำ เหลือประโยคเดียวกับปุ่มก็พอ
            <div className="text-center">
              <div className="bg-success/15 mx-auto mb-3 flex size-12 items-center justify-center rounded-full">
                <Check className="text-success size-6" />
              </div>
              <p className="font-semibold">เรียบร้อยแล้วครับ</p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {order.payment_status === 'paid'
                  ? 'ร้านยืนยันการชำระเงินแล้ว ไม่ต้องทำอะไรต่อ'
                  : 'ร้านได้รับที่อยู่และสลิปแล้ว ไม่ต้องทำอะไรต่อ'}
              </p>
              <Button variant="success" size="lg" className="mt-4 w-full" onClick={finishOrder}>
                <Check className="size-4" /> เสร็จสิ้น
              </Button>
              <p className="text-muted-foreground mt-2 text-xs">
                {linkedToLine
                  ? 'เมื่อจัดส่ง ระบบจะแจ้งเลขพัสดุให้ทางไลน์อัตโนมัติ'
                  : 'เปิดลิงก์นี้กลับมาดูสถานะพัสดุได้ตลอดครับ'}
              </p>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground text-sm font-medium">
                เหลืออีก {steps.filter((step) => !step.done).length} ขั้นตอน
              </p>
              <div className="mt-3 space-y-2.5">
                {steps.map((step, i) => (
                  <div key={step.label} className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                        step.done
                          ? 'bg-success text-success-foreground'
                          : 'border-muted-foreground/40 text-muted-foreground border'
                      )}
                    >
                      {step.done ? <Check className="size-3" /> : i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className={cn('text-sm font-medium', !step.done && 'text-muted-foreground')}>
                        {step.label}
                      </p>
                      <p className="text-muted-foreground text-xs leading-relaxed">{step.hint}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-[100dvh] px-4 pt-safe pb-10">
      <div className="mx-auto max-w-md space-y-3 py-5">
        {/* หัวใบสรุป */}
        <Card>
          <CardContent className="text-center">
            {/* โลโก้ร้านจริง — หน้านี้ลูกค้าเปิดจากไลน์ ต้องรู้ทันทีว่าเป็นร้านไหน */}
            <img
              src="/logo.png"
              alt=""
              aria-hidden
              width={48}
              height={48}
              className="mx-auto mb-3 size-12 rounded-full object-contain"
            />
            <h1 className="text-lg font-semibold">ใบสรุปรายการสั่งซื้อ</h1>
            <p className="text-primary mt-0.5 text-sm font-medium">{order.order_number}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {new Date(order.created_at).toLocaleString('th-TH', {
                dateStyle: 'long',
                timeStyle: 'short',
              })}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {/* สถานะกลางระหว่างรอชำระกับชำระแล้ว — ขึ้นแทนป้าย "รอชำระเงิน" ไปเลย
                  สองป้ายพร้อมกันอ่านแล้วขัดกันเอง ทั้งที่พูดเรื่องเดียวกัน */}
              <Badge variant={slipPending ? 'soft' : payment.variant}>
                {slipPending ? 'ได้รับสลิปแล้ว · รอตรวจสอบ' : payment.text}
              </Badge>
              <Badge variant={status.variant}>{status.text}</Badge>
            </div>
            {order.tracking_number && (
              <button
                type="button"
                onClick={copyTracking}
                className="hover:bg-muted mx-auto mt-3 flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium"
              >
                📦 เลขพัสดุ {order.tracking_number}
                {copiedTracking ? (
                  <Check className="text-success size-3.5" />
                ) : (
                  <Copy className="text-muted-foreground size-3.5" />
                )}
              </button>
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

        {finishCard}

        {hasSavedAddress ? (
          <>
            {paymentCard}
            {addressCard}
          </>
        ) : (
          <>
            {addressCard}
            {paymentCard}
          </>
        )}

        {order.note && (
          <Card>
            <CardContent>
              <p className="text-muted-foreground mb-2 text-sm font-medium">หมายเหตุ</p>
              <p className="text-sm">{order.note}</p>
            </CardContent>
          </Card>
        )}

        <p className="text-muted-foreground/60 py-4 text-center text-xs">บ้านหมีมีปลานะ</p>
      </div>
    </div>
  );
}
