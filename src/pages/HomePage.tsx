import { useState, useEffect, useMemo } from 'react';
import {
  Fish,
  Trash2,
  Copy,
  MessageCircle,
  Save,
  Check,
  Loader2,
  ArrowLeft,
  ShoppingCart
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { calculateItemTotal, getGenderLabel, buildOrderLinkMessage, buildOrderMessage } from '../utils/message';
import { parseThaiAddress } from '../utils/address';
import { getLiffOrderUrl } from '../utils/liff';
import type { Breed, Gender, OrderItem, GroupedOrderItem, Customer, Product } from '../types';
import { User } from 'lucide-react';
import Layout from './Layout';

export default function HomePage() {
  const { user } = useAuth();

  // State
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [bankInfo, setBankInfo] = useState<any>({
    id: null,
    bank_name: 'กสิกรไทย',
    account_number: '',
    account_name: '',
    shipping_fee: 60
  });
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [billDiscount, setBillDiscount] = useState<number>(0);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [addressPaste, setAddressPaste] = useState('');
  const [quickBreedIds, setQuickBreedIds] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  // ลิงก์ใบสรุปของบิลที่เพิ่งบันทึก เอาไว้ส่งให้ลูกค้าในไลน์
  const [lastOrderLink, setLastOrderLink] = useState<{ url: string; orderNumber: string; message: string } | null>(null);

  // Handle customer selection
  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (customerId) {
      const customer = customers.find(c => c.id === customerId);
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

    if (parsed.name) { setCustomerName(parsed.name); setSelectedCustomerId(''); }
    if (parsed.phone) setCustomerPhone(parsed.phone);
    if (parsed.address) setCustomerAddress(parsed.address);

    const filled = [parsed.name && 'ชื่อ', parsed.phone && 'เบอร์', parsed.address && 'ที่อยู่'].filter(Boolean);
    toast.success(`แยกได้: ${filled.join(' / ')}`, { description: 'ตรวจอีกครั้งก่อนบันทึกนะครับ', duration: 3000 });
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

  // Load Data from Supabase
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: breedsData } = await supabase
        .from('breeds')
        .select('*')
        .order('name');
      setBreeds(breedsData || []);

      const { data: settingsData } = await supabase
        .from('settings')
        .select('*')
        .limit(1);
      
      if (settingsData && settingsData.length > 0) {
        setBankInfo(settingsData[0]);
      }
      
      const { data: productsData } = await supabase.from('products').select('*').eq('is_active', true).order('name');
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
      list = list.filter(breed => breed.name.toLowerCase().includes(term));
    }

    return list;
  }, [breeds, searchTerm]);

  const addToOrder = (breed: Breed, type: 'piece' | 'pair' | 'set', gender: Gender = 'mixed') => {
    const price = type === 'piece' ? breed.premium_price_piece :
                  type === 'pair' ? breed.premium_price_pair :
                  (breed.premium_price_set || 0);
    const cost = type === 'piece' ? (breed.premium_cost_piece || 0) :
                 type === 'pair' ? (breed.premium_cost_pair || 0) :
                 (breed.premium_cost_set || 0);

    const existing = orderItems.find(item => item.breedId === breed.id && item.type === type && item.gender === gender);

    const genderText = gender === 'male' ? 'ตัวผู้' : gender === 'female' ? 'ตัวเมีย' : '';
    const typeText = type === 'piece' ? 'ตัว' : type === 'pair' ? 'คู่' : 'set';

    if (existing) {
      setOrderItems(orderItems.map(item => item === existing ? { ...item, quantity: item.quantity + 1 } : item));
      toast.success(`เพิ่ม ${breed.name} ${genderText ? `(${genderText})` : ''} อีก 1 ${typeText}`, {
        description: `จำนวนในออเดอร์: ${existing.quantity + 1} ${typeText}`,
        duration: 2000,
      });
    } else {
      setOrderItems([...orderItems, { id: Date.now().toString(), breedId: breed.id, breedName: breed.name, type, quantity: 1, price, cost, gender }]);
      toast.success(`เพิ่ม ${breed.name} ${genderText ? `(${genderText})` : ''} ลงออเดอร์`, {
        description: `1 ${typeText} - ฿${price.toLocaleString()}`,
        duration: 2000,
      });
    }
  };

  // เพิ่มอาหาร/สินค้าอื่นลงออเดอร์ — kind='food' จะไม่ถูกนับเป็นจำนวนปลา
  const addFoodToOrder = (product: Product) => {
    const existing = orderItems.find(item => item.kind === 'food' && item.breedId === product.id);
    if (existing) {
      setOrderItems(orderItems.map(item => item === existing ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setOrderItems([...orderItems, {
        id: Date.now().toString(), breedId: product.id, breedName: product.name,
        type: 'piece', quantity: 1, price: product.price, cost: product.cost || 0,
        gender: 'mixed', kind: 'food',
      }]);
    }
    toast.success(`เพิ่ม ${product.name} ลงออเดอร์`, { description: `฿${product.price.toLocaleString()}`, duration: 2000 });
  };

  const setItemQty = (itemId: string, qty: number) => {
    setOrderItems(orderItems.map(item => item.id === itemId ? { ...item, quantity: Math.max(1, qty) } : item));
  };

  const setFreeQty = (itemId: string, freeQty: number) => {
    setOrderItems(orderItems.map(item => 
      item.id === itemId ? { ...item, freeQty: freeQty > 0 ? freeQty : undefined } : item
    ));
  };

  const removeFromOrder = (id: string) => setOrderItems(orderItems.filter(item => item.id !== id));

  // Group order items
  const groupedOrderItems = useMemo(() => {
    const groups: { [key: string]: GroupedOrderItem } = {};
    
    orderItems.forEach(item => {
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
          totalFreeQty: 0
        };
      }
      
      const group = groups[item.breedId];
      group.items.push(item);
      group.totalQuantity += item.quantity;
      group.totalFishCount += item.type === 'piece' ? item.quantity : item.type === 'pair' ? item.quantity * 2 : item.quantity * 3;
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
      if (item.type === 'pair') return sum + (item.quantity * 2);
      return sum + (item.quantity * 3);
    }, 0);
  }, [orderItems]);

  // แยกอาหารออกจากรายการปลา เพื่อแสดงคนละส่วน
  const foodItems = useMemo(() => orderItems.filter(item => item.kind === 'food'), [orderItems]);
  
  const totalFishPrice = useMemo(() => orderItems.reduce((sum, item) => sum + calculateItemTotal(item), 0), [orderItems]);
  const grandTotal = Math.max(0, totalFishPrice - billDiscount + (orderItems.length > 0 ? bankInfo.shipping_fee : 0));

  const lineMessage = useMemo(() => buildOrderMessage({
    items: orderItems,
    totalFish: totalFishCount,
    shippingFee: bankInfo.shipping_fee,
    billDiscount,
    bankInfo,
    customerName,
    customerPhone,
    customerAddress,
    shortClosing: !!selectedCustomerId,
  }), [orderItems, totalFishCount, bankInfo, billDiscount, customerName, customerPhone, customerAddress, selectedCustomerId]);

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
      const totalCost = orderItems.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0);
      
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
        created_by: user?.username || 'unknown'
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
            await supabase.from('customers').update({
              name: customerName || match.name,
              address: customerAddress || match.address,
            }).eq('id', match.id);
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
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-blue-600 font-bold uppercase tracking-widest text-xs">
          <Loader2 className="h-10 w-10 animate-spin mb-4" /> Connecting to Cloud...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="max-w-6xl mx-auto p-4 space-y-6">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 py-4">
          {!showCart ? (
            <div className="space-y-4 lg:space-y-6">
              {/* Search Bar */}
              <div className="px-2">
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ค้นหาสายพันธุ์..."
                    className="w-full h-10 bg-white border border-slate-200 rounded-xl px-4 pl-10 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 transition-all"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-400 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
                {searchTerm && (
                  <p className="text-[10px] text-slate-500 mt-1 px-1">
                    พบ {filteredBreeds.length} สายพันธุ์
                  </p>
                )}
              </div>

              {!searchTerm.trim() && quickBreedIds.length > 0 && (() => {
                const byId = new Map(breeds.map(b => [b.id, b]));
                const quick = quickBreedIds.map(id => byId.get(id)).filter(Boolean) as Breed[];
                if (quick.length === 0) return null;
                return (
                  <div className="mb-5">
                    <p className="px-2 mb-2 text-[10px] font-black uppercase tracking-widest text-orange-500">⚡ ขายบ่อยล่าสุด</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 px-2 -mx-0">
                      {quick.map(breed => (
                        <button
                          key={breed.id}
                          onClick={() => setSearchTerm(breed.name)}
                          className="shrink-0 min-w-[130px] bg-white border-2 border-orange-100 hover:border-orange-300 rounded-2xl px-3 py-2.5 text-left active:scale-95 transition-all shadow-sm"
                        >
                          <p className="font-bold text-sm text-slate-800 line-clamp-1">{breed.name}</p>
                          <p className="text-[11px] text-orange-500 font-black mt-0.5">แตะเพื่อเลือก · ฿{breed.premium_price_pair}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* อาหาร / สินค้าอื่น — กดเพิ่มลงออเดอร์ได้เลยจากหน้าขาย */}
              {!searchTerm.trim() && products.length > 0 && (
                <div className="mb-5">
                  <p className="px-2 mb-2 text-[10px] font-black uppercase tracking-widest text-amber-500">🍤 อาหาร / สินค้าอื่น</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 lg:gap-3">
                    {products.map(p => (
                      <button
                        key={p.id}
                        onClick={() => addFoodToOrder(p)}
                        className="bg-white border-2 border-amber-100 hover:border-amber-300 rounded-xl px-3 py-2.5 text-left active:scale-95 transition-all shadow-sm"
                      >
                        <p className="font-bold text-sm text-slate-800 line-clamp-1">{p.name}</p>
                        <p className="text-[11px] text-amber-500 font-black mt-0.5">แตะเพิ่ม · ฿{p.price}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between px-2 mb-4">
                <h2 className="font-black uppercase tracking-tight text-base lg:text-xl text-slate-800">Select Species</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
                {filteredBreeds.map(breed => (
                  <div key={breed.id} className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 mb-1.5 leading-tight line-clamp-1">{breed.name}</h4>
                      <div className="flex gap-1.5 mb-1.5">
                        <button onClick={() => addToOrder(breed, 'piece', 'male')} className="flex-1 py-2 bg-blue-50 hover:bg-blue-500 hover:text-white text-blue-600 rounded-lg text-[11px] font-bold transition-all">
                          ตัวผู้ (฿{breed.premium_price_piece})
                        </button>
                        <button onClick={() => addToOrder(breed, 'piece', 'female')} className="flex-1 py-2 bg-pink-50 hover:bg-pink-500 hover:text-white text-pink-600 rounded-lg text-[11px] font-bold transition-all">
                          ตัวเมีย (฿{breed.premium_price_piece})
                        </button>
                      </div>
                      <div className={`grid gap-1.5 ${breed.premium_price_set && breed.premium_price_set > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        <button onClick={() => addToOrder(breed, 'pair', 'mixed')} className="flex flex-col items-center bg-slate-50 hover:bg-blue-600 hover:text-white py-2 rounded-lg transition-all">
                          <p className="text-[8px] font-black uppercase tracking-wider opacity-60">Pair</p>
                          <p className="font-black text-sm">฿{breed.premium_price_pair}</p>
                        </button>
                        {breed.premium_price_set && breed.premium_price_set > 0 ? (
                          <button onClick={() => addToOrder(breed, 'set', 'mixed')} className="flex flex-col items-center bg-slate-50 hover:bg-blue-600 hover:text-white py-2 rounded-lg transition-all">
                            <p className="text-[8px] font-black uppercase tracking-wider opacity-60">Set</p>
                            <p className="font-black text-sm">฿{breed.premium_price_set}</p>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredBreeds.length === 0 && searchTerm && (
                <div className="text-center py-8">
                  <p className="text-slate-400 text-sm">ไม่พบ "{searchTerm}"</p>
                  <button onClick={() => setSearchTerm('')} className="mt-2 text-blue-600 text-xs font-bold">ล้างการค้นหา</button>
                </div>
              )}
              
              {/* บันทึกออเดอร์แล้ว — ส่งลิงก์ใบสรุปให้ลูกค้ากรอกที่อยู่เอง */}
              {lastOrderLink && orderItems.length === 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t-2 border-green-200 z-50 shadow-[0_-5px_40px_rgba(0,0,0,0.12)]">
                  <div className="max-w-4xl mx-auto">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">บันทึกแล้ว · {lastOrderLink.orderNumber}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">{lastOrderLink.url}</p>
                      </div>
                      <button
                        onClick={() => setLastOrderLink(null)}
                        className="shrink-0 text-slate-300 hover:text-slate-500 text-xl leading-none px-1"
                        aria-label="ปิด"
                      >
                        ×
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={shareLinkToLine}
                        className="h-12 bg-[#06C755] text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98]"
                      >
                        <MessageCircle className="h-4 w-4" /> ส่งลิงก์ในไลน์
                      </button>
                      <button
                        onClick={copyOrderLink}
                        className="h-12 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98]"
                      >
                        <Copy className="h-4 w-4" /> คัดลอกลิงก์
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 text-center mt-2">ลูกค้าเปิดลิงก์แล้วสแกนจ่ายและกรอกที่อยู่เองได้เลย</p>
                  </div>
                </div>
              )}

              {orderItems.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 z-50 shadow-[0_-5px_40px_rgba(0,0,0,0.08)]">
                  <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div>
                      <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest">ยอดรวมทั้งหมด</p>
                      <p className="text-xl sm:text-2xl font-black text-blue-600 tracking-tighter">฿{grandTotal.toLocaleString()}</p>
                    </div>
                    <button 
                      onClick={() => { setShowCart(true); window.scrollTo({ top: 0, behavior: 'instant' }); }}
                      className="h-12 px-5 sm:px-8 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-blue-500 active:scale-95 transition-all"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      ตะกร้าสินค้า ({orderItems.reduce((sum, item) => sum + item.quantity, 0)})
                    </button>
                  </div>
                </div>
              )}
              {orderItems.length > 0 && <div className="h-24"></div>}
            </div>
          ) : (
            <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
              <button 
                onClick={() => setShowCart(false)}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm mb-2 sm:mb-6 transition-all bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm w-fit active:scale-95"
              >
                <ArrowLeft className="h-4 w-4" />
                กลับไปเลือกปลาเพิ่ม
              </button>
              <div className="lg:sticky lg:top-28 space-y-4 lg:space-y-6">
                <div className="bg-white rounded-2xl lg:rounded-[3rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-slate-50 overflow-hidden">
                  <div className="p-4 sm:p-8 border-b border-gray-50 flex items-center justify-between bg-[#F9FAFB]/50">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-2 bg-blue-600 rounded-xl">
                        <ShoppingCart className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-black text-base sm:text-lg text-slate-800 tracking-tight uppercase">Order Summary</span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                      {totalFishCount > 0 && (
                        <span className="text-xs sm:text-sm font-bold text-blue-600 bg-blue-50 px-3 sm:px-4 py-2 rounded-xl">🐟 {totalFishCount} ตัว</span>
                      )}
                      <button onClick={() => setOrderItems([])} className="h-8 px-3 bg-red-50 text-red-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white">Clear</button>
                    </div>
                  </div>
                  <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 max-h-[350px] sm:max-h-[450px] overflow-y-auto">
                    {groupedOrderItems.map(group => (
                      <div key={group.breedId} className="group">
                        <div className="flex items-center justify-between p-3 sm:p-4 bg-slate-100 rounded-t-2xl">
                          <div className="flex items-center gap-2">
                            <Fish className="h-4 w-4 text-blue-600" />
                            <span className="font-black text-sm sm:text-base text-slate-800">{group.breedName}</span>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-1 rounded-full">
                              {group.totalFishCount} ตัว
                            </span>
                          </div>
                          <span className="font-black text-base sm:text-lg text-blue-600">
                            ฿{group.totalPrice.toLocaleString()}
                          </span>
                        </div>
                        <div className="bg-white border border-slate-100 rounded-b-2xl overflow-hidden">
                          {group.items.map(item => (
                            <div key={item.id} className={`p-3 sm:p-4 border-b border-slate-50 last:border-b-0 ${item.freeQty ? 'bg-green-50/50' : ''}`}>
                              <div className="flex items-center justify-between mb-2 sm:mb-3">
                                <div className="flex items-center gap-2 sm:gap-3">
                                  <span className="text-sm font-bold text-slate-600">{getGenderLabel(item.gender)}</span>
                                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                                    {item.quantity} {item.type === 'piece' ? 'ตัว' : item.type === 'pair' ? 'คู่' : 'set'}
                                  </span>
                                  {item.freeQty ? (
                                    <span className="text-[10px] text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded-full">แถม {item.freeQty}</span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3">
                                  <span className={`font-black text-sm sm:text-base ${item.freeQty ? 'text-green-700' : 'text-slate-900'}`}>
                                    ฿{calculateItemTotal(item).toLocaleString()}
                                  </span>
                                  <button 
                                    onClick={() => removeFromOrder(item.id)} 
                                    className="h-10 w-10 sm:h-8 sm:w-8 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center transition-all"
                                  >
                                    <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" />
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-green-600">🎁 แถม:</span>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min={0}
                                      max={item.quantity}
                                      value={item.freeQty || ''}
                                      onChange={(e) => setFreeQty(item.id, Number(e.target.value) || 0)}
                                      placeholder="0"
                                      className="w-16 h-9 sm:h-7 bg-white border border-green-300 rounded-lg px-2 text-sm font-bold text-green-700 outline-none focus:border-green-500 min-h-[36px]"
                                    />
                                    <span className="text-green-600 text-sm">ตัว</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* อาหาร / สินค้าอื่น — แยกจากปลา ไม่นับเป็นจำนวนตัว */}
                    {(products.length > 0 || foodItems.length > 0) && (
                      <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">🍤 อาหาร / สินค้าอื่น</p>
                          {products.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => { const p = products.find(x => x.id === e.target.value); if (p) addFoodToOrder(p); e.target.value = ''; }}
                              className="h-9 bg-white border border-amber-200 rounded-lg px-2 text-xs font-bold text-amber-700 outline-none focus:border-amber-400"
                            >
                              <option value="">+ เพิ่มอาหาร</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.name} · ฿{p.price}</option>)}
                            </select>
                          )}
                        </div>
                        {foodItems.length === 0 ? (
                          <p className="text-xs text-amber-400">เลือกอาหารจากเมนู "+ เพิ่มอาหาร"</p>
                        ) : (
                          <div className="space-y-2">
                            {foodItems.map(item => (
                              <div key={item.id} className="flex items-center justify-between gap-2 bg-white rounded-xl px-3 py-2">
                                <span className="font-bold text-sm text-slate-700 min-w-0 truncate">{item.breedName}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <input
                                    type="number" min="1" value={item.quantity}
                                    onChange={(e) => setItemQty(item.id, Number(e.target.value) || 1)}
                                    className="w-14 h-8 bg-amber-50 border border-amber-200 rounded-lg px-2 text-sm font-black text-amber-700 text-center outline-none focus:border-amber-400"
                                  />
                                  <span className="text-sm font-black text-slate-700 w-16 text-right">฿{(item.price * item.quantity).toLocaleString()}</span>
                                  <button onClick={() => removeFromOrder(item.id)} className="h-7 w-7 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-lg flex items-center justify-center transition-all">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {orderItems.length > 0 && (
                      <div className="mt-4 sm:mt-6 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3">ข้อมูลลูกค้า (ไม่บังคับ)</p>
                        <div className="space-y-4">

                          {/* ── ชื่อลูกค้า ── ตอนออกบิลมักมีแค่ชื่อ TikTok/ไลน์ */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อลูกค้า</label>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="text"
                                value={customerName}
                                onChange={(e) => { setCustomerName(e.target.value); setSelectedCustomerId(''); }}
                                placeholder="ชื่อ TikTok / ชื่อไลน์ / ชื่อลูกค้า"
                                className="w-full h-11 sm:h-10 bg-white border border-blue-200 rounded-xl pl-10 pr-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                              />
                            </div>
                            {customers.length > 0 && (
                              <select
                                value={selectedCustomerId}
                                onChange={(e) => handleCustomerChange(e.target.value)}
                                className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-bold text-slate-500 outline-none focus:border-blue-400 appearance-none cursor-pointer"
                              >
                                <option value="">↩︎ หรือเลือกจากลูกค้าเดิม</option>
                                {customers.map(customer => (
                                  <option key={customer.id} value={customer.id}>
                                    {customer.name} {customer.phone ? `(${customer.phone})` : ''}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          {/* ── ที่อยู่จัดส่ง ── ปกติลูกค้ากรอกเองในลิงก์ กรอกที่นี่ได้ถ้ามีข้อมูลแล้ว */}
                          <div className="space-y-2 pt-2 border-t border-blue-100">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ที่อยู่จัดส่ง</label>
                              <span className="text-[9px] text-slate-400">ลูกค้ากรอกเองในลิงก์ได้</span>
                            </div>

                            {/* วางข้อความจากไลน์ทั้งก้อน แล้วแยก ชื่อ/เบอร์/ที่อยู่ ให้อัตโนมัติ */}
                            <div className="relative">
                              <textarea
                                value={addressPaste}
                                onChange={(e) => applyPastedAddress(e.target.value)}
                                placeholder={'📋 วางข้อความที่ลูกค้าส่งมาในไลน์ตรงนี้\nระบบจะแยก ชื่อ / เบอร์ / ที่อยู่ ให้เอง'}
                                rows={2}
                                className="w-full bg-white border border-dashed border-blue-300 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 resize-y"
                              />
                              {addressPaste && (
                                <button
                                  type="button"
                                  onClick={() => setAddressPaste('')}
                                  className="absolute right-2 top-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 bg-white px-1.5 rounded"
                                >
                                  ล้าง
                                </button>
                              )}
                            </div>

                            <input
                              type="tel"
                              value={customerPhone}
                              onChange={(e) => setCustomerPhone(e.target.value)}
                              onBlur={(e) => lookupCustomerByPhone(e.target.value)}
                              placeholder="📱 เบอร์โทร"
                              className="w-full h-11 sm:h-10 bg-white border border-blue-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                            />
                            <textarea
                              value={customerAddress}
                              onChange={(e) => setCustomerAddress(e.target.value)}
                              placeholder="📍 บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
                              rows={2}
                              className="w-full bg-white border border-blue-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 resize-y"
                            />
                          </div>

                          {/* ── หมายเหตุ ── */}
                          <div className="space-y-1.5 pt-2 border-t border-blue-100">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">หมายเหตุ</label>
                            <input
                              type="text"
                              value={orderNote}
                              onChange={(e) => setOrderNote(e.target.value)}
                              placeholder="เช่น ห่อพิเศษ, นัดส่งวันไหน"
                              className="w-full h-11 sm:h-10 bg-white border border-blue-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                            />
                          </div>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-orange-600">💸 ส่วนลดท้ายบิล</span>
                            <input
                              type="number"
                              min="0"
                              value={billDiscount || ''}
                              onChange={(e) => setBillDiscount(Number(e.target.value) || 0)}
                              placeholder="0"
                              className="w-full h-11 sm:h-10 bg-orange-50/50 border border-orange-200 rounded-xl px-4 pl-36 text-sm font-bold text-orange-700 outline-none focus:border-orange-400"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-orange-600">บาท</span>
                          </div>
                          <button
                            onClick={saveOrder}
                            disabled={isSavingOrder}
                            className="w-full h-12 sm:h-12 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white rounded-xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2 min-h-[48px]"
                          >
                            {isSavingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {isSavingOrder ? 'กำลังบันทึก...' : '💾 บันทึกออเดอร์'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {orderItems.length > 0 && (
                    <div className="p-4 sm:p-8 bg-[#1F2937] text-white space-y-4 sm:space-y-5 rounded-b-2xl sm:rounded-b-[3rem] shadow-2xl">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">จำนวนปลา</span>
                        <span className="text-white font-black">{totalFishCount} ตัว</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-black text-slate-500"><span className="uppercase tracking-[0.2em]">Shipping</span><span className="text-white font-black">฿{bankInfo.shipping_fee}</span></div>
                      {billDiscount > 0 && (
                        <div className="flex justify-between items-center text-xs font-black text-orange-400"><span className="uppercase tracking-[0.2em]">Discount</span><span className="font-black">-฿{billDiscount.toLocaleString()}</span></div>
                      )}
                      <div className="flex justify-between items-center pt-2"><span className="font-black text-lg sm:text-xl tracking-tight uppercase">Total Amount</span><span className="font-black text-2xl sm:text-3xl text-blue-400 tracking-tighter">฿{grandTotal.toLocaleString()}</span></div>
                      {/* QR พร้อมเพย์ย้ายไปอยู่ในหน้าใบสรุปฝั่งลูกค้าแล้ว ที่นี่ไม่ต้องมีซ้ำ */}

                      <div className="pt-4 grid grid-cols-1 gap-3">
                        <button onClick={shareToLine} className="h-14 sm:h-14 bg-[#06C755] text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-[0.98] min-h-[56px]"><MessageCircle className="h-5 w-5" /> Send to LINE</button>
                        <button onClick={copyToClipboard} className={cn("h-14 sm:h-14 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] border-2 min-h-[56px]", copySuccess ? "bg-blue-600 border-blue-600 text-white" : "bg-transparent text-slate-400 border-slate-800")}>{copySuccess ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copySuccess ? 'Copied Success' : 'Copy Text'}</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
}