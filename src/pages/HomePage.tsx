import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Fish,
  Loader2,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Save,
  ShoppingCart,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  calculateItemTotal,
  getGenderLabel,
  buildOrderLinkMessage,
  buildOrderMessage,
} from '@/utils/message';
import { parseThaiAddress } from '@/utils/address';
import { getLiffOrderUrl } from '@/utils/liff';
import type { Breed, Gender, OrderItem, GroupedOrderItem, Customer, Product } from '@/types';
import Layout from './Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { SearchInput } from '@/components/ui/search-input';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/page-loader';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// เก็บตะกร้าที่ยังไม่ได้บันทึกไว้ในเครื่อง
//
// คนขายมักสลับไปเปิดไลน์ดูที่อยู่ลูกค้ากลางคัน แล้ว iOS เขี่ยแท็บทิ้งเพื่อคืนหน่วยความจำ
// ถ้าไม่เก็บไว้ บิลที่คีย์ค้างไว้ทั้งใบจะหายโดยไม่มีอะไรเตือน ต้องคีย์ใหม่หมด
const DRAFT_KEY = 'guppy:draft-order:v1';

interface OrderDraft {
  items: OrderItem[];
  customerId: string;
  name: string;
  phone: string;
  address: string;
  note: string;
  discount: number;
}

function readDraft(): OrderDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as OrderDraft;
    // ร่างที่ไม่มีรายการก็ไม่มีอะไรให้กู้
    return Array.isArray(draft?.items) && draft.items.length > 0 ? draft : null;
  } catch {
    // ข้อมูลเสีย หรือเบราว์เซอร์ปิด storage ไว้ — ถือว่าไม่มีร่าง ไม่ต้องรบกวนคนขาย
    return null;
  }
}

/** ป้ายกำกับหน่วยขายของรายการในตะกร้า เช่น "♂ ตัว" / "คู่" */
const variantLabel = (item: OrderItem) => {
  if (item.type === 'pair') return 'คู่';
  if (item.type === 'set') return 'ชุด';
  return item.gender === 'male' ? '♂ ตัว' : item.gender === 'female' ? '♀ ตัว' : 'ตัว';
};

/** แถบสรุปที่ลอยอยู่เหนือเมนูล่างบนมือถือ */
const STICKY_BAR =
  'fixed inset-x-0 bottom-[calc(var(--bottom-nav,0px)+env(safe-area-inset-bottom))] z-30 md:bottom-0';

export default function HomePage() {
  const { user } = useAuth();

  // State
  const [restoredDraft] = useState(() => readDraft());
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>(() => restoredDraft?.items ?? []);
  const [bankInfo, setBankInfo] = useState<any>({
    id: null,
    bank_name: 'กสิกรไทย',
    account_number: '',
    account_name: '',
    shipping_fee: 60,
  });
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(restoredDraft?.customerId ?? '');
  const [customerName, setCustomerName] = useState(restoredDraft?.name ?? '');
  const [customerPhone, setCustomerPhone] = useState(restoredDraft?.phone ?? '');
  const [customerAddress, setCustomerAddress] = useState(restoredDraft?.address ?? '');
  const [orderNote, setOrderNote] = useState(restoredDraft?.note ?? '');
  const [billDiscount, setBillDiscount] = useState<number>(restoredDraft?.discount ?? 0);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [addressPaste, setAddressPaste] = useState('');
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  const [quickBreedIds, setQuickBreedIds] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  // ลิงก์ใบสรุปของบิลที่เพิ่งบันทึก เอาไว้ส่งให้ลูกค้าในไลน์
  const [lastOrderLink, setLastOrderLink] = useState<{
    url: string;
    orderNumber: string;
    message: string;
  } | null>(null);

  // Handle customer selection
  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (customerId) {
      const customer = customers.find((c) => c.id === customerId);
      if (customer) {
        setCustomerName(customer.name || '');
        setCustomerPhone(customer.phone || '');
        setCustomerAddress(customer.address || '');
      }
    } else {
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setAddressPaste('');
    }
  };

  // แยกที่อยู่ที่ลูกค้าพิมพ์มาในไลน์ ใส่ลงช่องให้อัตโนมัติ
  // เติมเฉพาะช่องที่แยกได้ ช่องที่เดาไม่ออกปล่อยค่าเดิมไว้ให้พิมพ์เอง
  const applyPastedAddress = (text: string) => {
    setAddressPaste(text);
    if (!text.trim()) return;

    const parsed = parseThaiAddress(text);
    if (!parsed.name && !parsed.phone && !parsed.address) {
      toast.error('แยกข้อมูลไม่ออก ลองกรอกเองด้านล่างครับ');
      return;
    }

    if (parsed.name) {
      setCustomerName(parsed.name);
      setSelectedCustomerId('');
    }
    if (parsed.phone) setCustomerPhone(parsed.phone);
    if (parsed.address) setCustomerAddress(parsed.address);

    const filled = [parsed.name && 'ชื่อ', parsed.phone && 'เบอร์', parsed.address && 'ที่อยู่'].filter(
      Boolean
    );
    toast.success(`แยกได้: ${filled.join(' / ')}`, {
      description: 'ตรวจอีกครั้งก่อนบันทึกนะครับ',
      duration: 3000,
    });
  };

  // เบอร์ครบแล้ว → หาลูกค้าเดิมด้วยเบอร์ ถ้าเจอเติมชื่อ/ที่อยู่ให้อัตโนมัติ
  // ลูกค้าประจำจะออกบิลเร็วขึ้นรอบสอง ไม่ต้องพิมพ์ที่อยู่ใหม่
  const lookupCustomerByPhone = async (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) return;
    const { data } = await supabase.rpc('find_customer_by_phone', { p_phone: digits });
    const match = Array.isArray(data) ? data[0] : data;
    if (!match) return;
    setSelectedCustomerId(match.id);
    if (match.name) setCustomerName(match.name);
    if (match.address) setCustomerAddress(match.address);
    toast.success(`ลูกค้าเดิม: ${match.name}`, { description: 'เติมชื่อ/ที่อยู่ให้แล้ว', duration: 2500 });
  };

  // บอกให้รู้ว่าของในตะกร้ามาจากไหน ไม่งั้นจะงงว่าทำไมมีของค้างอยู่
  const announcedDraft = useRef(false);
  useEffect(() => {
    if (!restoredDraft || announcedDraft.current) return;
    announcedDraft.current = true;
    toast.info('กู้คืนตะกร้าที่ค้างไว้', {
      description: `${restoredDraft.items.length} รายการ · ตรวจอีกครั้งก่อนบันทึก`,
      duration: 5000,
    });
  }, [restoredDraft]);

  // เก็บร่างไว้ทุกครั้งที่แก้ — ล้างทิ้งเมื่อตะกร้าว่าง (บันทึกบิลแล้ว หรือกดล้าง)
  useEffect(() => {
    try {
      if (orderItems.length === 0) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      const draft: OrderDraft = {
        items: orderItems,
        customerId: selectedCustomerId,
        name: customerName,
        phone: customerPhone,
        address: customerAddress,
        note: orderNote,
        discount: billDiscount,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // storage เต็มหรือถูกปิด — ไม่ควรขัดจังหวะการขาย ปล่อยผ่าน
    }
  }, [
    orderItems,
    selectedCustomerId,
    customerName,
    customerPhone,
    customerAddress,
    orderNote,
    billDiscount,
  ]);

  // Load Data from Supabase
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: breedsData } = await supabase.from('breeds').select('*').order('name');
      setBreeds(breedsData || []);

      const { data: settingsData } = await supabase.from('settings').select('*').limit(1);

      if (settingsData && settingsData.length > 0) {
        setBankInfo(settingsData[0]);
      }

      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');
      setProducts((productsData || []) as Product[]);

      const { data: customersData } = await supabase.from('customers').select('*').order('name');
      setCustomers(customersData || []);

      // ปลาขายบ่อยล่าสุด ไว้ปักบนสุดให้กดเพิ่มเร็ว ไม่ต้องเสิร์ช
      const { data: topBreeds } = await supabase.rpc('top_recent_breeds', { p_days: 14, p_limit: 8 });
      setQuickBreedIds((topBreeds || []).map((r: any) => r.breed_id));
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('โหลดข้อมูลไม่สำเร็จ — ข้อมูลที่เห็นอาจไม่ครบ ลองรีเฟรชอีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  // Filter breeds
  const filteredBreeds = useMemo(() => {
    let list = breeds;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((breed) => breed.name.toLowerCase().includes(term));
    }

    return list;
  }, [breeds, searchTerm]);

  const addToOrder = (breed: Breed, type: 'piece' | 'pair' | 'set', gender: Gender = 'mixed') => {
    const price =
      type === 'piece'
        ? breed.premium_price_piece
        : type === 'pair'
          ? breed.premium_price_pair
          : breed.premium_price_set || 0;
    const cost =
      type === 'piece'
        ? breed.premium_cost_piece || 0
        : type === 'pair'
          ? breed.premium_cost_pair || 0
          : breed.premium_cost_set || 0;

    const existing = orderItems.find(
      (item) => item.breedId === breed.id && item.type === type && item.gender === gender
    );

    const genderText = gender === 'male' ? 'ตัวผู้' : gender === 'female' ? 'ตัวเมีย' : '';
    const typeText = type === 'piece' ? 'ตัว' : type === 'pair' ? 'คู่' : 'ชุด';

    if (existing) {
      setOrderItems(
        orderItems.map((item) => (item === existing ? { ...item, quantity: item.quantity + 1 } : item))
      );
      toast.success(`เพิ่ม ${breed.name} ${genderText ? `(${genderText})` : ''} อีก 1 ${typeText}`, {
        description: `จำนวนในออเดอร์: ${existing.quantity + 1} ${typeText}`,
        duration: 2000,
      });
    } else {
      setOrderItems([
        ...orderItems,
        {
          id: Date.now().toString(),
          breedId: breed.id,
          breedName: breed.name,
          type,
          quantity: 1,
          price,
          cost,
          gender,
        },
      ]);
      toast.success(`เพิ่ม ${breed.name} ${genderText ? `(${genderText})` : ''} ลงออเดอร์`, {
        description: `1 ${typeText} · ฿${price.toLocaleString()}`,
        duration: 2000,
      });
    }
  };

  // เพิ่มอาหาร/สินค้าอื่นลงออเดอร์ — kind='food' จะไม่ถูกนับเป็นจำนวนปลา
  const addFoodToOrder = (product: Product) => {
    const existing = orderItems.find((item) => item.kind === 'food' && item.breedId === product.id);
    if (existing) {
      setOrderItems(
        orderItems.map((item) => (item === existing ? { ...item, quantity: item.quantity + 1 } : item))
      );
    } else {
      setOrderItems([
        ...orderItems,
        {
          id: Date.now().toString(),
          breedId: product.id,
          breedName: product.name,
          type: 'piece',
          quantity: 1,
          price: product.price,
          cost: product.cost || 0,
          gender: 'mixed',
          kind: 'food',
        },
      ]);
    }
    toast.success(`เพิ่ม ${product.name} ลงออเดอร์`, {
      description: `฿${product.price.toLocaleString()}`,
      duration: 2000,
    });
  };

  const setItemQty = (itemId: string, qty: number) => {
    setOrderItems(
      orderItems.map((item) => (item.id === itemId ? { ...item, quantity: Math.max(1, qty) } : item))
    );
  };

  const setFreeQty = (itemId: string, freeQty: number) => {
    setOrderItems(
      orderItems.map((item) =>
        item.id === itemId ? { ...item, freeQty: freeQty > 0 ? freeQty : undefined } : item
      )
    );
  };

  const removeFromOrder = (id: string) => setOrderItems(orderItems.filter((item) => item.id !== id));

  // ปรับจำนวนได้จากการ์ดหน้าขายเลย — เดิมกดเกินแล้วต้องเข้าไปแก้ในตะกร้าอย่างเดียว
  const stepItem = (item: OrderItem, delta: number) => {
    const next = item.quantity + delta;
    if (next <= 0) removeFromOrder(item.id);
    else setItemQty(item.id, next);
  };

  // รายการในตะกร้าแยกตามสายพันธุ์/สินค้า ไว้โชว์จำนวนบนการ์ด
  const cartByBreed = useMemo(() => {
    const map = new Map<string, OrderItem[]>();
    orderItems.forEach((item) => {
      const key = item.kind === 'food' ? `food:${item.breedId}` : item.breedId;
      map.set(key, [...(map.get(key) ?? []), item]);
    });
    return map;
  }, [orderItems]);

  // Group order items
  const groupedOrderItems = useMemo(() => {
    const groups: { [key: string]: GroupedOrderItem } = {};

    orderItems.forEach((item) => {
      if (item.kind === 'food') return; // อาหารแสดงแยก ไม่รวมในกลุ่มปลา
      if (!groups[item.breedId]) {
        groups[item.breedId] = {
          breedId: item.breedId,
          breedName: item.breedName,
          items: [],
          totalQuantity: 0,
          totalFishCount: 0,
          totalPrice: 0,
          totalDiscount: 0,
          totalFreeQty: 0,
        };
      }

      const group = groups[item.breedId];
      group.items.push(item);
      group.totalQuantity += item.quantity;
      group.totalFishCount +=
        item.type === 'piece' ? item.quantity : item.type === 'pair' ? item.quantity * 2 : item.quantity * 3;
      group.totalPrice += calculateItemTotal(item);
      group.totalDiscount += item.discount || 0;
      group.totalFreeQty += item.freeQty || 0;
    });

    return Object.values(groups);
  }, [orderItems]);

  const totalFishCount = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      if (item.kind === 'food') return sum; // อาหารไม่นับเป็นตัวปลา
      if (item.type === 'piece') return sum + item.quantity;
      if (item.type === 'pair') return sum + item.quantity * 2;
      return sum + item.quantity * 3;
    }, 0);
  }, [orderItems]);

  // แยกอาหารออกจากรายการปลา เพื่อแสดงคนละส่วน
  const foodItems = useMemo(() => orderItems.filter((item) => item.kind === 'food'), [orderItems]);

  const totalFishPrice = useMemo(
    () => orderItems.reduce((sum, item) => sum + calculateItemTotal(item), 0),
    [orderItems]
  );
  const grandTotal = Math.max(
    0,
    totalFishPrice - billDiscount + (orderItems.length > 0 ? bankInfo.shipping_fee : 0)
  );

  const lineMessage = useMemo(
    () =>
      buildOrderMessage({
        items: orderItems,
        totalFish: totalFishCount,
        shippingFee: bankInfo.shipping_fee,
        billDiscount,
        bankInfo,
        customerName,
        customerPhone,
        customerAddress,
        shortClosing: !!selectedCustomerId,
      }),
    [
      orderItems,
      totalFishCount,
      bankInfo,
      billDiscount,
      customerName,
      customerPhone,
      customerAddress,
      selectedCustomerId,
    ]
  );

  const copyToClipboard = () => {
    if (!lineMessage) return;
    navigator.clipboard.writeText(lineMessage).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const copyOrderLink = async () => {
    if (!lastOrderLink) return;
    try {
      await navigator.clipboard.writeText(lastOrderLink.message);
      toast.success('คัดลอกลิงก์แล้ว', { description: 'วางในไลน์ส่งให้ลูกค้าได้เลย' });
    } catch {
      toast.error('คัดลอกไม่สำเร็จ');
    }
  };

  const shareLinkToLine = () => {
    if (!lastOrderLink) return;
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(lastOrderLink.message)}`, '_blank');
  };

  const shareToLine = () => {
    if (!lineMessage) return;
    const lineUrl = `line://msg/text/${encodeURIComponent(lineMessage)}`;
    window.location.href = lineUrl;
    setTimeout(() => {
      window.open(`https://line.me/R/msg/text/?${encodeURIComponent(lineMessage)}`, '_blank');
    }, 500);
  };

  // Save order
  const saveOrder = async () => {
    if (orderItems.length === 0) {
      toast.error('ไม่มีรายการสินค้า');
      return;
    }

    setIsSavingOrder(true);
    try {
      const totalCost = orderItems.reduce((sum, item) => sum + (item.cost || 0) * item.quantity, 0);

      const orderData = {
        shop_id: user?.shop_name || 'default',
        items: orderItems,
        total_amount: Math.round(grandTotal),
        total_fish: totalFishCount,
        shipping_fee: Math.round(bankInfo.shipping_fee || 0),
        discount: Math.round(billDiscount || 0),
        total_cost: Math.round(totalCost),
        customer_id: selectedCustomerId || null,
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        customer_address: customerAddress || null,
        note: orderNote || null,
        created_by: user?.username || 'unknown',
      };

      const { data: saved, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select('public_token, order_number')
        .single();

      if (error) throw error;

      // จำลูกค้าไว้ถ้ามีเบอร์แต่ยังไม่ได้ผูกกับลูกค้าเดิม
      // ครั้งหน้าเบอร์นี้สั่ง ชื่อ/ที่อยู่จะขึ้นเอง — ไม่บล็อกการบันทึกออเดอร์ถ้าพลาด
      if (!selectedCustomerId && customerPhone.replace(/\D/g, '').length >= 9) {
        try {
          const digits = customerPhone.replace(/\D/g, '');
          const { data: existing } = await supabase.rpc('find_customer_by_phone', { p_phone: digits });
          const match = Array.isArray(existing) ? existing[0] : existing;
          if (match?.id) {
            await supabase
              .from('customers')
              .update({
                name: customerName || match.name,
                address: customerAddress || match.address,
              })
              .eq('id', match.id);
          } else {
            await supabase.from('customers').insert({
              name: customerName || 'ไม่ระบุชื่อ',
              phone: customerPhone,
              address: customerAddress || null,
            });
          }
        } catch (custErr) {
          console.error('Save customer error:', custErr);
        }
      }

      if (saved?.public_token) {
        const url = getLiffOrderUrl(saved.public_token);
        setLastOrderLink({
          url,
          orderNumber: saved.order_number,
          // สร้างข้อความตอน orderItems ยังอยู่ (ก่อนถูกล้าง) — มีรายการปลาครบ
          message: buildOrderLinkMessage(saved.order_number, orderItems, Math.round(grandTotal), url),
        });
      } else {
        // ออเดอร์บันทึกแล้วแต่ไม่ได้ token กลับมา ลิงก์จะเสีย
        // บอกให้รู้ดีกว่าโชว์ลิงก์ที่เปิดไม่ได้
        setLastOrderLink(null);
        toast.warning('บันทึกออเดอร์แล้ว แต่สร้างลิงก์ใบสรุปไม่สำเร็จ', {
          description: 'คัดลอกลิงก์ได้จากหน้าแอดมินแทน',
        });
      }

      // ยอดสะสมลูกค้าคำนวณสดจาก view customer_order_stats แล้ว
      // ไม่ต้องบวกเองตรงนี้ (ของเดิมบวกอย่างเดียว ลบออเดอร์แล้วไม่เคยลด)

      setOrderItems([]);
      setSelectedCustomerId('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setOrderNote('');
      setBillDiscount(0);
      setAddressPaste('');
      setShowCart(false);

      toast.success('บันทึกออเดอร์เรียบร้อย!');
    } catch (err) {
      console.error('Save order error:', err);
      toast.error('บันทึกไม่สำเร็จ');
    } finally {
      setIsSavingOrder(false);
    }
  };

  if (loading && breeds.length === 0) {
    return (
      <Layout>
        <PageLoader label="กำลังโหลดสายพันธุ์…" />
      </Layout>
    );
  }

  const cartCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);

  // เนื้อหาตะกร้า — ใช้ก้อนเดียวกันทั้งแผงข้างบนจอคอมพ์ และหน้าตะกร้าเต็มจอบนมือถือ
  // นับว่ากรอกครบแค่ไหน ไว้โชว์บนการ์ดสรุปโดยไม่ต้องเปิดแผง
  const customerFilledCount = [customerName, customerPhone, customerAddress].filter(
    (v) => v.trim().length > 0
  ).length;

  // ฟอร์มลูกค้า — เนื้อเดียวกับของเดิม ย้ายมาอยู่ในแผงสไลด์
  const customerFormBody = (
    <div className="space-y-5">

            <div className="space-y-2">
              <Label htmlFor="cust-name">ชื่อลูกค้า</Label>
              <div className="relative">
                <User className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  id="cust-name"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    setSelectedCustomerId('');
                  }}
                  placeholder="ชื่อ TikTok / ชื่อไลน์ / ชื่อลูกค้า"
                  className="pl-9"
                />
              </div>
              {customers.length > 0 && (
                <Select
                  value={selectedCustomerId || undefined}
                  onValueChange={handleCustomerChange}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue placeholder="หรือเลือกจากลูกค้าเดิม" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} {customer.phone ? `(${customer.phone})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="cust-paste">ที่อยู่จัดส่ง</Label>
                <span className="text-muted-foreground text-xs">ลูกค้ากรอกเองในลิงก์ได้</span>
              </div>

              {/* วางข้อความจากไลน์ทั้งก้อน แล้วแยก ชื่อ/เบอร์/ที่อยู่ ให้อัตโนมัติ */}
              <div className="relative">
                <Textarea
                  id="cust-paste"
                  value={addressPaste}
                  onChange={(e) => applyPastedAddress(e.target.value)}
                  placeholder={'📋 วางข้อความที่ลูกค้าส่งมาในไลน์ตรงนี้\nระบบจะแยก ชื่อ / เบอร์ / ที่อยู่ ให้เอง'}
                  rows={2}
                  className="border-dashed pr-14"
                />
                {addressPaste && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-1.5 right-1.5"
                    onClick={() => setAddressPaste('')}
                  >
                    ล้าง
                  </Button>
                )}
              </div>

              <Input
                type="tel"
                inputMode="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                onBlur={(e) => lookupCustomerByPhone(e.target.value)}
                placeholder="เบอร์โทร"
              />
              <Textarea
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
                rows={2}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="order-note">หมายเหตุ</Label>
              <Input
                id="order-note"
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="เช่น ห่อพิเศษ, นัดส่งวันไหน"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bill-discount">ส่วนลดท้ายบิล (บาท)</Label>
              <Input
                id="bill-discount"
                type="number"
                min="0"
                value={billDiscount || ''}
                onChange={(e) => setBillDiscount(Number(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
    </div>
  );

  const cartPanel = (
    <div className="space-y-4">
          <Card className="gap-0 py-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="text-primary size-4" />
                <span className="font-medium">สรุปออเดอร์</span>
                {totalFishCount > 0 && <Badge variant="soft">{totalFishCount} ตัว</Badge>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setOrderItems([])}
              >
                ล้างทั้งหมด
              </Button>
            </div>

            <CardContent className="space-y-4 px-4 py-4">
              {groupedOrderItems.map((group) => (
                <div key={group.breedId} className="overflow-hidden rounded-lg border">
                  <div className="bg-muted/60 flex items-center justify-between gap-2 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Fish className="text-primary size-4 shrink-0" />
                      <span className="truncate text-sm font-medium">{group.breedName}</span>
                      <Badge variant="muted" className="shrink-0">
                        {group.totalFishCount} ตัว
                      </Badge>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      ฿{group.totalPrice.toLocaleString()}
                    </span>
                  </div>

                  <div className="divide-y">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className={cn('px-3 py-2.5', item.freeQty ? 'bg-success/5' : 'bg-card')}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            {getGenderLabel(item.gender) && (
                              <span className="text-muted-foreground">
                                {getGenderLabel(item.gender)}
                              </span>
                            )}
                            <span className="font-medium">
                              {item.quantity}{' '}
                              {item.type === 'piece' ? 'ตัว' : item.type === 'pair' ? 'คู่' : 'ชุด'}
                            </span>
                            {item.freeQty ? (
                              <Badge variant="success">แถม {item.freeQty}</Badge>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span
                              className={cn(
                                'text-sm font-semibold',
                                item.freeQty && 'text-success'
                              )}
                            >
                              ฿{calculateItemTotal(item).toLocaleString()}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => removeFromOrder(item.id)}
                              aria-label="ลบรายการ"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-1.5 flex items-center gap-2">
                          <Label
                            htmlFor={`free-${item.id}`}
                            className="text-muted-foreground text-xs font-normal"
                          >
                            🎁 แถม
                          </Label>
                          <Input
                            id={`free-${item.id}`}
                            type="number"
                            min={0}
                            max={item.quantity}
                            value={item.freeQty || ''}
                            onChange={(e) => setFreeQty(item.id, Number(e.target.value) || 0)}
                            placeholder="0"
                            className="h-9 w-20 text-center"
                          />
                          <span className="text-muted-foreground text-xs">ตัว</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* อาหาร / สินค้าอื่น — แยกจากปลา ไม่นับเป็นจำนวนตัว */}
              {(products.length > 0 || foodItems.length > 0) && (
                <div className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <Package className="text-warning size-4" /> อาหาร / สินค้าอื่น
                    </p>
                    {products.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Plus className="size-4" /> เพิ่มอาหาร
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {products.map((p) => (
                            <DropdownMenuItem key={p.id} onSelect={() => addFoodToOrder(p)}>
                              {p.name}
                              <span className="text-muted-foreground ml-auto pl-3">
                                ฿{p.price.toLocaleString()}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {foodItems.length === 0 ? (
                    <p className="text-muted-foreground text-xs">ยังไม่ได้เลือกอาหาร</p>
                  ) : (
                    <div className="space-y-2">
                      {foodItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-sm">{item.breedName}</span>
                          <div className="flex shrink-0 items-center gap-2">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => setItemQty(item.id, Number(e.target.value) || 1)}
                              className="h-9 w-16 text-center"
                            />
                            <span className="w-16 text-right text-sm font-semibold">
                              ฿{(item.price * item.quantity).toLocaleString()}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => removeFromOrder(item.id)}
                              aria-label="ลบรายการ"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {orderItems.length === 0 && (
                <EmptyState
                  icon={ShoppingCart}
                  title="ตะกร้าว่าง"
                  description="เลือกปลาที่ต้องการขายก่อน"
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      className="lg:hidden"
                      onClick={() => setShowCart(false)}
                    >
                      เลือกปลา
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>

          {/* ── ข้อมูลลูกค้า: ย่อเหลือการ์ดสรุป กดแล้วเปิดแผงสไลด์ ── */}
          {/* ฟอร์มนี้ยาวจนดันยอดรวมกับปุ่มบันทึกตกจอ ทั้งที่ใช้แค่ตอนปิดบิล
              ตะกร้ากับยอดรวมต้องเห็นตลอดขณะเลือกปลา จึงแยกฟอร์มออกไป */}
          {orderItems.length > 0 && (
            <Card>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-muted-foreground text-sm font-medium">ข้อมูลลูกค้า</p>
                  {customerFilledCount > 0 && (
                    <Badge variant="soft">กรอกแล้ว {customerFilledCount}/3</Badge>
                  )}
                </div>

                {customerName || customerPhone || customerAddress ? (
                  <div className="space-y-0.5 text-sm">
                    <p className="font-medium">{customerName || "ยังไม่ได้ใส่ชื่อ"}</p>
                    {customerPhone && <p className="text-muted-foreground">{customerPhone}</p>}
                    {customerAddress && (
                      <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                        {customerAddress}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    ไม่ใส่ก็ได้ ลูกค้ากรอกเองในลิงก์ใบสรุปได้
                  </p>
                )}

                <Button variant="outline" className="w-full" onClick={() => setShowCustomerForm(true)}>
                  <User className="size-4" />
                  {customerFilledCount > 0 ? "แก้ไขข้อมูลลูกค้า" : "กรอกข้อมูลลูกค้า"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── ยอดรวม + ปุ่มทำงาน ── */}
          {/* ตรึงไว้ล่างสุดของแผงที่เลื่อนได้ ตะกร้ายาวแค่ไหนยอดก็ยังอยู่ในสายตา
              เดิมยอดถูกดันตกจอจนต้องเลื่อนกลับมาดูทุกครั้งที่กดเพิ่มปลา */}
          {orderItems.length > 0 && (
            <Card className="lg:bg-card lg:sticky lg:bottom-0 lg:z-10 lg:shadow-lg">
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">จำนวนปลา</span>
                  <span className="font-medium">{totalFishCount} ตัว</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">ค่าจัดส่ง</span>
                  <span className="font-medium">฿{Number(bankInfo.shipping_fee).toLocaleString()}</span>
                </div>
                {billDiscount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">ส่วนลดท้ายบิล</span>
                    <span className="text-warning font-medium">-฿{billDiscount.toLocaleString()}</span>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="font-medium">ยอดรวมทั้งสิ้น</span>
                  <span className="text-primary text-2xl font-semibold">
                    ฿{grandTotal.toLocaleString()}
                  </span>
                </div>

                <div className="grid gap-2 pt-1">
                  <Button size="lg" onClick={saveOrder} disabled={isSavingOrder}>
                    {isSavingOrder ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    {isSavingOrder ? 'กำลังบันทึก…' : 'บันทึกออเดอร์'}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="line" size="lg" onClick={shareToLine}>
                      <MessageCircle className="size-4" /> ส่งไลน์
                    </Button>
                    <Button variant="outline" size="lg" onClick={copyToClipboard}>
                      {copySuccess ? <Check className="size-4" /> : <Copy className="size-4" />}
                      {copySuccess ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
    </div>
  );

  // กล่อง “บันทึกแล้ว” — บนจอคอมพ์อยู่หัวแผงตะกร้า บนมือถือลอยอยู่ขอบล่าง
  const savedLinkBody = lastOrderLink && (
    <>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-success text-sm font-medium">
                        บันทึกแล้ว · {lastOrderLink.orderNumber}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">{lastOrderLink.url}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setLastOrderLink(null)}
                      aria-label="ปิด"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="line" size="lg" onClick={shareLinkToLine}>
                      <MessageCircle className="size-4" /> ส่งลิงก์ในไลน์
                    </Button>
                    <Button variant="outline" size="lg" onClick={copyOrderLink}>
                      <Copy className="size-4" /> คัดลอกลิงก์
                    </Button>
                  </div>
                  <p className="text-muted-foreground mt-2 text-center text-xs">
                    ลูกค้าเปิดลิงก์แล้วสแกนจ่ายและกรอกที่อยู่เองได้เลย
                  </p>
    </>
  );

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 pb-6 lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-6">
        {/* ── เลือกปลา ── */}
        <div className={cn(showCart && 'hidden lg:block')}>
          {/* ค้นหา — ปักไว้ใต้แถบบน กดเลือกปลาต่อได้เรื่อย ๆ โดยไม่ต้องเลื่อนกลับ */}
          <div className="bg-background/95 sticky top-header z-20 -mx-4 px-4 py-3 backdrop-blur-md lg:mx-0 lg:px-0">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="ค้นหาสายพันธุ์…"
            />
            {searchTerm && (
              <p className="text-muted-foreground mt-1.5 text-xs">พบ {filteredBreeds.length} สายพันธุ์</p>
            )}
          </div>

          <div className="space-y-6">
            {!searchTerm.trim() &&
              quickBreedIds.length > 0 &&
              (() => {
                const byId = new Map(breeds.map((b) => [b.id, b]));
                const quick = quickBreedIds.map((id) => byId.get(id)).filter(Boolean) as Breed[];
                if (quick.length === 0) return null;
                return (
                  <section>
                    <h2 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-sm font-medium">
                      <Zap className="text-warning size-4" /> ขายบ่อยล่าสุด
                    </h2>
                    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                      {quick.map((breed) => (
                        <button
                          key={breed.id}
                          onClick={() => setSearchTerm(breed.name)}
                          className="bg-card hover:border-primary/40 min-w-36 shrink-0 rounded-lg border px-3 py-2.5 text-left shadow-xs transition-colors active:scale-[0.98]"
                        >
                          <p className="truncate text-sm font-medium">{breed.name}</p>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            คู่ละ ฿{breed.premium_price_pair.toLocaleString()}
                          </p>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })()}

            {/* อาหาร / สินค้าอื่น — กดเพิ่มลงออเดอร์ได้เลยจากหน้าขาย */}
            {!searchTerm.trim() && products.length > 0 && (
              <section>
                <h2 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-sm font-medium">
                  <Package className="text-warning size-4" /> อาหาร / สินค้าอื่น
                </h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {products.map((p) => {
                    const inCart = cartByBreed.get(`food:${p.id}`)?.[0]?.quantity ?? 0;
                    return (
                      <button
                        key={p.id}
                        onClick={() => addFoodToOrder(p)}
                        className={cn(
                          'bg-card hover:border-primary/40 flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left shadow-xs transition-colors active:scale-[0.98]',
                          inCart > 0 && 'border-primary/40'
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{p.name}</span>
                          <span className="text-muted-foreground block text-xs">
                            ฿{p.price.toLocaleString()}
                          </span>
                        </span>
                        {inCart > 0 ? (
                          <Badge variant="soft" className="shrink-0">
                            {inCart}
                          </Badge>
                        ) : (
                          <Plus className="text-muted-foreground size-4 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Fish className="text-primary size-4" /> สายพันธุ์ปลา
              </h2>

              {filteredBreeds.length === 0 ? (
                <EmptyState
                  icon={Fish}
                  title={searchTerm ? `ไม่พบ “${searchTerm}”` : 'ยังไม่มีสายพันธุ์'}
                  description={searchTerm ? 'ลองพิมพ์ชื่อสั้นลง' : 'เพิ่มสายพันธุ์ได้ที่หน้าตั้งค่า'}
                  action={
                    searchTerm ? (
                      <Button variant="outline" size="sm" onClick={() => setSearchTerm('')}>
                        ล้างการค้นหา
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredBreeds.map((breed) => {
                    const lines = cartByBreed.get(breed.id) ?? [];
                    return (
                    <div
                      key={breed.id}
                      className={cn(
                        'bg-card flex flex-col gap-2 rounded-xl border p-2.5 shadow-xs transition-colors',
                        lines.length > 0 && 'border-primary/40'
                      )}
                    >
                      <p className="truncate text-sm leading-tight font-medium" title={breed.name}>
                        {breed.name}
                      </p>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => addToOrder(breed, 'piece', 'male')}
                          className="bg-secondary hover:bg-secondary/70 flex h-10 flex-col items-center justify-center rounded-md text-xs transition-colors active:scale-95"
                        >
                          <span className="text-muted-foreground leading-none">
                            <span className="text-primary font-semibold">♂</span> ตัวผู้
                          </span>
                          <span className="mt-0.5 leading-none font-semibold">
                            ฿{breed.premium_price_piece.toLocaleString()}
                          </span>
                        </button>
                        <button
                          onClick={() => addToOrder(breed, 'piece', 'female')}
                          className="bg-secondary hover:bg-secondary/70 flex h-10 flex-col items-center justify-center rounded-md text-xs transition-colors active:scale-95"
                        >
                          <span className="text-muted-foreground leading-none">
                            <span className="font-semibold text-pink-600">♀</span> ตัวเมีย
                          </span>
                          <span className="mt-0.5 leading-none font-semibold">
                            ฿{breed.premium_price_piece.toLocaleString()}
                          </span>
                        </button>
                      </div>

                      <div
                        className={cn(
                          'grid gap-1.5',
                          breed.premium_price_set && breed.premium_price_set > 0
                            ? 'grid-cols-2'
                            : 'grid-cols-1'
                        )}
                      >
                        <button
                          onClick={() => addToOrder(breed, 'pair', 'mixed')}
                          className="bg-primary/8 text-primary hover:bg-primary/15 flex h-10 flex-col items-center justify-center rounded-md text-xs transition-colors active:scale-95"
                        >
                          <span className="opacity-70 leading-none">คู่</span>
                          <span className="mt-0.5 leading-none font-semibold">
                            ฿{breed.premium_price_pair.toLocaleString()}
                          </span>
                        </button>
                        {breed.premium_price_set && breed.premium_price_set > 0 ? (
                          <button
                            onClick={() => addToOrder(breed, 'set', 'mixed')}
                            className="bg-primary/8 text-primary hover:bg-primary/15 flex h-10 flex-col items-center justify-center rounded-md text-xs transition-colors active:scale-95"
                          >
                            <span className="opacity-70 leading-none">ชุด</span>
                            <span className="mt-0.5 leading-none font-semibold">
                              ฿{breed.premium_price_set.toLocaleString()}
                            </span>
                          </button>
                        ) : null}
                      </div>

                      {/* อยู่ในตะกร้าแล้ว — ปรับจำนวนตรงนี้ได้เลย ไม่ต้องเข้าตะกร้า */}
                      {lines.length > 0 && (
                        <div className="space-y-1 border-t pt-2">
                          {lines.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-1">
                              <span className="text-muted-foreground min-w-0 truncate text-xs">
                                {variantLabel(item)}
                              </span>
                              <div className="flex shrink-0 items-center gap-0.5">
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  className="size-7"
                                  aria-label={`ลด ${breed.name} ${variantLabel(item)} 1`}
                                  onClick={() => stepItem(item, -1)}
                                >
                                  <Minus className="size-3.5" />
                                </Button>
                                <span className="w-6 text-center text-sm font-semibold tabular-nums">
                                  {item.quantity}
                                </span>
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  className="size-7"
                                  aria-label={`เพิ่ม ${breed.name} ${variantLabel(item)} 1`}
                                  onClick={() => stepItem(item, 1)}
                                >
                                  <Plus className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* ── ตะกร้าบนจอคอมพ์: อยู่ข้าง ๆ เห็นยอดตลอด ไม่ต้องสลับหน้า ── */}
        <aside className="hidden lg:block">
          <div className="sticky top-header max-h-[calc(100dvh-4.5rem)] space-y-4 overflow-y-auto pt-4 pb-4">
            {lastOrderLink && orderItems.length === 0 && (
              <Card>
                <CardContent>{savedLinkBody}</CardContent>
              </Card>
            )}
            {cartPanel}
          </div>
        </aside>

        {/* ── ตะกร้าบนมือถือ: เปิดเป็นหน้าเต็ม ── */}
        {showCart && (
          <div className="space-y-4 py-4 lg:hidden">
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setShowCart(false)}>
              <ArrowLeft className="size-4" /> เลือกปลาเพิ่ม
            </Button>
            {cartPanel}
          </div>
        )}
      </div>

      {/* แถบลอยล่าง — เฉพาะจอที่ยังไม่มีแผงตะกร้าข้าง ๆ */}
      {!showCart && lastOrderLink && orderItems.length === 0 && (
        <div className="lg:hidden">
          <div className="h-36" />
          <div className={cn(STICKY_BAR, 'bg-card border-t shadow-lg')}>
            <div className="mx-auto max-w-6xl px-4 py-3">{savedLinkBody}</div>
          </div>
        </div>
      )}

      {/* แถบตะกร้า */}
      {!showCart && orderItems.length > 0 && (
        <div className="lg:hidden">
          <div className="h-24" />
          <div className={cn(STICKY_BAR, 'bg-card/95 border-t backdrop-blur-md')}>
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-muted-foreground text-xs">ยอดรวมทั้งหมด</p>
                <p className="text-primary text-xl font-semibold">฿{grandTotal.toLocaleString()}</p>
              </div>
              <Button
                size="lg"
                onClick={() => {
                  setShowCart(true);
                  window.scrollTo({ top: 0, behavior: 'instant' });
                }}
              >
                <ShoppingCart className="size-4" />
                ดูตะกร้า ({cartCount})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* แผงข้อมูลลูกค้า — จอคอมพ์สไลด์จากขวา มือถือเด้งจากล่าง */}
      <ResponsiveModal open={showCustomerForm} onOpenChange={setShowCustomerForm}>
        <ResponsiveModalContent className="sm:max-w-lg">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>ข้อมูลลูกค้า</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              ไม่ใส่ก็ได้ ลูกค้ากรอกเองในลิงก์ใบสรุปได้
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <ResponsiveModalBody>{customerFormBody}</ResponsiveModalBody>
          <ResponsiveModalFooter>
            <Button className="w-full" onClick={() => setShowCustomerForm(false)}>
              เสร็จแล้ว
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </Layout>
  );
}
