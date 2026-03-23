import React, { useState, useEffect, useMemo } from 'react';
import {
  Fish,
  Plus,
  Trash2,
  Copy,
  MessageCircle,
  Save,
  X,
  Edit2,
  Check,
  Loader2,
  ArrowLeft,
  ShoppingCart
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast, Toaster } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { calculateItemTotal, getGenderLabel } from '../utils/message';
import type { Breed, Gender, OrderItem, SavedOrder, GroupedOrderItem } from '../types';
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
  const [selectedGrade, setSelectedGrade] = useState<'all' | 'normal' | 'premium'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [isSavingOrder, setIsSavingOrder] = useState(false);

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
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter breeds
  const filteredBreeds = useMemo(() => {
    let list = breeds;
    
    if (selectedGrade === 'premium') {
      list = list.filter(breed => 
        (breed.premium_price_piece && breed.premium_price_piece > 0) || 
        (breed.premium_price_pair && breed.premium_price_pair > 0) || 
        (breed.premium_price_set && breed.premium_price_set > 0)
      );
    }
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(breed => breed.name.toLowerCase().includes(term));
    }
    
    return list;
  }, [breeds, searchTerm, selectedGrade]);

  const addToOrder = (breed: Breed, type: 'piece' | 'pair' | 'set', gender: Gender = 'mixed', grade: 'normal' | 'premium' = 'normal') => {
    let price = 0;
    let cost = 0;
    
    if (grade === 'premium') {
      price = type === 'piece' ? (breed.premium_price_piece || breed.price_piece) : 
              type === 'pair' ? (breed.premium_price_pair || breed.price_pair) : 
              (breed.premium_price_set || breed.price_set || 0);
      cost = type === 'piece' ? (breed.premium_cost_piece || breed.cost_piece || 0) : 
             type === 'pair' ? (breed.premium_cost_pair || breed.cost_pair || 0) : 
             (breed.premium_cost_set || breed.cost_set || 0);
    } else {
      price = type === 'piece' ? breed.price_piece : type === 'pair' ? breed.price_pair : breed.price_set || 0;
      cost = type === 'piece' ? (breed.cost_piece || 0) : type === 'pair' ? (breed.cost_pair || 0) : (breed.cost_set || 0);
    }

    const existing = orderItems.find(item => item.breedId === breed.id && item.type === type && item.gender === gender && item.grade === grade);
    
    const genderText = gender === 'male' ? 'ตัวผู้' : gender === 'female' ? 'ตัวเมีย' : '';
    const typeText = type === 'piece' ? 'ตัว' : type === 'pair' ? 'คู่' : 'set';
    const gradeText = grade === 'premium' ? ' (คัดเกรด)' : '';
    
    if (existing) {
      setOrderItems(orderItems.map(item => item === existing ? { ...item, quantity: item.quantity + 1 } : item));
      toast.success(`เพิ่ม ${breed.name}${gradeText} ${genderText ? `(${genderText})` : ''} อีก 1 ${typeText}`, {
        description: `จำนวนในออเดอร์: ${existing.quantity + 1} ${typeText}`,
        duration: 2000,
      });
    } else {
      setOrderItems([...orderItems, { id: Date.now().toString(), breedId: breed.id, breedName: breed.name, type, quantity: 1, price, cost, grade, gender }]);
      toast.success(`เพิ่ม ${breed.name}${gradeText} ${genderText ? `(${genderText})` : ''} ลงออเดอร์`, {
        description: `1 ${typeText} - ฿${price.toLocaleString()}`,
        duration: 2000,
      });
    }
  };

  const setItemDiscount = (itemId: string, discount: number) => {
    setOrderItems(orderItems.map(item => 
      item.id === itemId ? { ...item, discount } : item
    ));
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
      group.totalFishCount += item.type === 'piece' ? item.quantity : item.type === 'pair' ? item.quantity * 2 : item.quantity;
      group.totalPrice += calculateItemTotal(item);
      group.totalDiscount += item.discount || 0;
      group.totalFreeQty += item.freeQty || 0;
    });
    
    return Object.values(groups);
  }, [orderItems]);

  const totalFishCount = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      if (item.type === 'piece') return sum + item.quantity;
      if (item.type === 'pair') return sum + (item.quantity * 2);
      return sum + item.quantity;
    }, 0);
  }, [orderItems]);
  
  const totalFishPrice = useMemo(() => orderItems.reduce((sum, item) => sum + calculateItemTotal(item), 0), [orderItems]);
  const grandTotal = totalFishPrice + (orderItems.length > 0 ? bankInfo.shipping_fee : 0);

  const lineMessage = useMemo(() => {
    if (orderItems.length === 0) return '';
    let text = `🐠 รายการสั่งซื้อปลาหางนกยูง\n`;
    text += `----------------------------\n`;
    orderItems.forEach((item, index) => {
      const typeLabel = item.type === 'piece' ? 'ตัว' : item.type === 'pair' ? 'คู่' : 'set';
      const genderLabel = item.gender === 'male' ? '♂️' : item.gender === 'female' ? '♀️' : '⚥';
      const gradeLabel = item.grade === 'premium' ? ' 👑[งานคัดเกรด]' : '';
      const itemTotal = calculateItemTotal(item);
      const paidQty = item.quantity - (item.freeQty || 0);
      
      if (item.freeQty && item.freeQty >= item.quantity) {
        text += `${index + 1}. 🎁 ${item.breedName}${gradeLabel} ${genderLabel}: ${item.quantity} ${typeLabel} = แถมฟรีทั้งหมด\n`;
      } else if (item.freeQty && item.freeQty > 0) {
        text += `${index + 1}. ${item.breedName}${gradeLabel} ${genderLabel}: ${item.quantity} ${typeLabel} (ซื้อ ${paidQty} + แถม ${item.freeQty})`;
        if (item.discount && item.discount > 0) {
          text += ` (ลด ${item.discount} บาท)`;
        }
        text += ` = ${itemTotal.toLocaleString()}.-\n`;
      } else {
        text += `${index + 1}. ${item.breedName}${gradeLabel} ${genderLabel}: ${item.quantity} ${typeLabel}`;
        if (item.discount && item.discount > 0) {
          text += ` (ลด ${item.discount} บาท)`;
        }
        text += ` = ${itemTotal.toLocaleString()}.-\n`;
      }
    });
    text += `----------------------------\n`;
    text += `📊 จำนวนปลาทั้งหมด: ${totalFishCount} ตัว\n`;
    text += `💰 ค่าปลา: ${totalFishPrice.toLocaleString()} บาท\n`;
    text += `🚚 ค่าจัดส่ง: ${bankInfo.shipping_fee.toLocaleString()} บาท\n`;
    text += `🔥 ยอดรวมทั้งสิ้น: ${grandTotal.toLocaleString()} บาท\n`;
    text += `----------------------------\n`;
    text += `🏦 ช่องทางชำระเงิน\n`;
    text += `${bankInfo.bank_name || 'ไม่ระบุธนาคาร'}\n`;
    text += `เลขบัญชี: ${bankInfo.account_number || 'ไม่ระบุเลขบัญชี'}\n`;
    text += `ชื่อบัญชี: ${bankInfo.account_name || 'ไม่ระบุชื่อ'}\n`;
    text += `----------------------------\n`;
    text += `ชำระแล้วรบกวนส่งสลิปแจ้งชื่อที่อยู่ได้เลยครับ 🙏✨`;
    return text;
  }, [orderItems, totalFishCount, totalFishPrice, bankInfo, grandTotal]);

  const copyToClipboard = () => {
    if (!lineMessage) return;
    navigator.clipboard.writeText(lineMessage).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
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
        total_amount: grandTotal,
        total_fish: totalFishCount,
        shipping_fee: bankInfo.shipping_fee,
        actual_shipping_fee: bankInfo.shipping_fee,
        total_cost: totalCost,
        customer_name: customerName || null,
        note: orderNote || null,
        created_by: user?.username || 'unknown'
      };
      
      const { error } = await supabase
        .from('orders')
        .insert([orderData]);
      
      if (error) throw error;
      
      setOrderItems([]);
      setCustomerName('');
      setOrderNote('');
      
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

              <div className="flex items-center justify-between px-2 mb-4">
                <h2 className="font-black uppercase tracking-tight text-base lg:text-xl text-slate-800">Select Species</h2>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setSelectedGrade('all')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${selectedGrade === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    ทั้งหมด
                  </button>
                  <button 
                    onClick={() => setSelectedGrade('premium')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${selectedGrade === 'premium' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    👑 คัดเกรด
                  </button>
                  <button 
                    onClick={() => setSelectedGrade('normal')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${selectedGrade === 'normal' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    เกรดปกติ
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
                {filteredBreeds.map(breed => (
                  <div key={breed.id} className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 mb-1.5 leading-tight line-clamp-1">{breed.name}</h4>
                      <div className="flex gap-1.5 mb-1.5">
                        <button onClick={() => addToOrder(breed, 'piece', 'male', selectedGrade === 'all' ? 'normal' : selectedGrade)} className="flex-1 py-2 bg-blue-50 hover:bg-blue-500 hover:text-white text-blue-600 rounded-lg text-[11px] font-bold transition-all">
                          ตัวผู้ (฿{selectedGrade === 'premium' && breed.premium_price_piece ? breed.premium_price_piece : breed.price_piece})
                        </button>
                        <button onClick={() => addToOrder(breed, 'piece', 'female', selectedGrade === 'all' ? 'normal' : selectedGrade)} className="flex-1 py-2 bg-pink-50 hover:bg-pink-500 hover:text-white text-pink-600 rounded-lg text-[11px] font-bold transition-all">
                          ตัวเมีย (฿{selectedGrade === 'premium' && breed.premium_price_piece ? breed.premium_price_piece : breed.price_piece})
                        </button>
                      </div>
                      <div className={`grid gap-1.5 ${breed.price_set && breed.price_set > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        <button onClick={() => addToOrder(breed, 'pair', 'mixed', selectedGrade === 'all' ? 'normal' : selectedGrade)} className="flex flex-col items-center bg-slate-50 hover:bg-blue-600 hover:text-white py-2 rounded-lg transition-all">
                          <p className="text-[8px] font-black uppercase tracking-wider opacity-60">Pair</p>
                          <p className="font-black text-sm">฿{selectedGrade === 'premium' && breed.premium_price_pair ? breed.premium_price_pair : breed.price_pair}</p>
                        </button>
                        {breed.price_set && breed.price_set > 0 ? (
                          <button onClick={() => addToOrder(breed, 'set', 'mixed', selectedGrade === 'all' ? 'normal' : selectedGrade)} className="flex flex-col items-center bg-slate-50 hover:bg-blue-600 hover:text-white py-2 rounded-lg transition-all">
                            <p className="text-[8px] font-black uppercase tracking-wider opacity-60">Set</p>
                            <p className="font-black text-sm">฿{selectedGrade === 'premium' && breed.premium_price_set ? breed.premium_price_set : breed.price_set}</p>
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
              
              {orderItems.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 z-50 shadow-[0_-5px_40px_rgba(0,0,0,0.08)]">
                  <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div>
                      <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest">ยอดรวมทั้งหมด</p>
                      <p className="text-xl sm:text-2xl font-black text-blue-600 tracking-tighter">฿{(orderItems.reduce((acc, item) => acc + item.price, 0) + (bankInfo.shipping_fee || 0)).toLocaleString()}</p>
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
                                  {item.grade === 'premium' && (
                                    <span className="text-[10px] text-orange-500 font-bold bg-orange-100 px-2 py-0.5 rounded-full">👑 คัดเกรด</span>
                                  )}
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
                                  <span className="text-[10px] font-bold text-slate-400">ส่วนลด:</span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-slate-400 text-sm">-฿</span>
                                    <input
                                      type="number"
                                      value={item.discount || ''}
                                      onChange={(e) => setItemDiscount(item.id, Number(e.target.value) || 0)}
                                      placeholder="0"
                                      className="w-16 h-9 sm:h-7 bg-slate-50 border border-slate-200 rounded-lg px-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 min-h-[36px]"
                                    />
                                  </div>
                                </div>
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
                    
                    {orderItems.length > 0 && (
                      <div className="mt-4 sm:mt-6 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3">ข้อมูลลูกค้า (ไม่บังคับ)</p>
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="ชื่อลูกค้า"
                            className="w-full h-11 sm:h-10 bg-white border border-blue-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                          />
                          <input
                            type="text"
                            value={orderNote}
                            onChange={(e) => setOrderNote(e.target.value)}
                            placeholder="หมายเหตุ"
                            className="w-full h-11 sm:h-10 bg-white border border-blue-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                          />
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
                      <div className="flex justify-between items-center pt-2"><span className="font-black text-lg sm:text-xl tracking-tight uppercase">Total Amount</span><span className="font-black text-2xl sm:text-3xl text-blue-400 tracking-tighter">฿{grandTotal.toLocaleString()}</span></div>
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