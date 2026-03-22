import React, { useState, useEffect, useMemo } from 'react';
import {
  Fish,
  Plus,
  Trash2,
  Copy,
  MessageCircle,
  Settings2,
  ClipboardList,
  Save,
  ChevronRight,
  User,
  CreditCard,
  History,
  X,
  Edit2,
  Check,
  Loader2,
  LogOut,
  Search,
  ShoppingCart,
  ArrowLeft
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from '@/lib/supabase';
import { toast, Toaster } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import AuthScreen from '@/components/AuthScreen';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface Breed {
  id: string;
  name: string;
  price_piece: number;
  price_pair: number;
  price_set?: number;
  cost_piece?: number;
  cost_pair?: number;
  cost_set?: number;
  premium_price_piece?: number;
  premium_price_pair?: number;
  premium_price_set?: number;
  premium_cost_piece?: number;
  premium_cost_pair?: number;
  premium_cost_set?: number;
}

type UserRole = 'admin' | 'user';

type Gender = 'male' | 'female' | 'mixed';

interface OrderItem {
  id: string;
  breedId: string;
  breedName: string;
  type: 'piece' | 'pair' | 'set';
  quantity: number;
  price: number;
  cost?: number;
  grade?: 'normal' | 'premium';
  gender: Gender;
  discount?: number;
  freeQty?: number;
}

// ประวัติออเดอร์ที่บันทึกแล้ว
interface SavedOrder {
  id: string;
  created_at: string;
  items: OrderItem[];
  totalAmount: number;
  totalFish: number;
  shippingFee?: number;
  actualShippingFee?: number;
  totalCost?: number;
  customerName?: string;
  note?: string;
}

// Grouped Order Item สำหรับแสดงใน Summary
interface GroupedOrderItem {
  breedId: string;
  breedName: string;
  items: OrderItem[];
  totalQuantity: number;
  totalFishCount: number;
  totalPrice: number;
  totalDiscount: number;
  totalFreeQty: number;
}

export default function App() {
  const { user, logout } = useAuth();

  // Helper: Check if admin
  const isAdmin = user?.role === 'admin';

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
  const [isManagingBreeds, setIsManagingBreeds] = useState(false);
  const [editingBreed, setEditingBreed] = useState<Breed | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<'normal' | 'premium'>('premium');
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
  // State สำหรับประวัติออเดอร์
  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>([]);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  
  // State สำหรับ Admin Dashboard
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [adminView, setAdminView] = useState<'orders' | 'dashboard' | 'reports'>('orders');
  const [allOrders, setAllOrders] = useState<SavedOrder[]>([]);
  const [reportPeriod, setReportPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('today');
  
  // State สำหรับเลือกวันที่ custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // State สำหรับแก้ไขออเดอร์
  const [editingOrder, setEditingOrder] = useState<SavedOrder | null>(null);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editCopySuccess, setEditCopySuccess] = useState(false);

  // State สำหรับตะกร้าสินค้า
  const [showCart, setShowCart] = useState(false);
  const [isBreedModalOpen, setIsBreedModalOpen] = useState(false);

  // State สำหรับค้นหาสายพันธุ์
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter breeds ตาม search term และ grade
  const filteredBreeds = useMemo(() => {
    let list = breeds;
    
    // Filter by Premium Grade if selected
    if (selectedGrade === 'premium') {
      list = list.filter(breed => 
        (breed.premium_price_piece && breed.premium_price_piece > 0) || 
        (breed.premium_price_pair && breed.premium_price_pair > 0) || 
        (breed.premium_price_set && breed.premium_price_set > 0)
      );
    }
    
    // Filter by Search Term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(breed => breed.name.toLowerCase().includes(term));
    }
    
    return list;
  }, [breeds, searchTerm, selectedGrade]);

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

  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const payload = {
        bank_name: bankInfo.bank_name,
        account_number: bankInfo.account_number,
        account_name: bankInfo.account_name,
        shipping_fee: Number(bankInfo.shipping_fee)
      };

      let error;
      if (bankInfo.id) {
        const { error: err } = await supabase
          .from('settings')
          .update(payload)
          .eq('id', bankInfo.id);
        error = err;
      } else {
        const { error: err } = await supabase
          .from('settings')
          .insert([payload]);
        error = err;
      }

      if (error) throw error;
      toast.success('บันทึกการตั้งค่าสำเร็จแล้วครับ');
      fetchData();
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
      price_piece: Number(formData.get('price_piece')),
      price_pair: Number(formData.get('price_pair')),
      price_set: Number(formData.get('price_set')) || null,
      cost_piece: Number(formData.get('cost_piece')) || 0,
      cost_pair: Number(formData.get('cost_pair')) || 0,
      cost_set: Number(formData.get('cost_set')) || 0,
      premium_price_piece: Number(formData.get('premium_price_piece')) || null,
      premium_price_pair: Number(formData.get('premium_price_pair')) || null,
      premium_price_set: Number(formData.get('premium_price_set')) || null,
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
    
    // สร้างข้อความแจ้งเตือน
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

  // ใส่ส่วนลดเองตอนขาย
  const setItemDiscount = (itemId: string, discount: number) => {
    setOrderItems(orderItems.map(item => 
      item.id === itemId ? { ...item, discount } : item
    ));
  };

  // ตั้งค่าจำนวนแถมฟรี
  const setFreeQty = (itemId: string, freeQty: number) => {
    setOrderItems(orderItems.map(item => 
      item.id === itemId ? { ...item, freeQty: freeQty > 0 ? freeQty : undefined } : item
    ));
  };

  const removeFromOrder = (id: string) => setOrderItems(orderItems.filter(item => item.id !== id));

  // คำนวณราคาหลังหักส่วนลดและของแถม - ต้องอยู่ก่อน groupedOrderItems
  const calculateItemTotal = (item: OrderItem): number => {
    const paidQty = Math.max(0, item.quantity - (item.freeQty || 0));
    const subtotal = item.price * paidQty;
    const discount = item.discount || 0;
    return Math.max(0, subtotal - discount);
  };
  
  // Group order items by breed
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

  // ยอดสรุปจำนวนตัวรวมทั้งหมด
  const totalFishCount = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      if (item.type === 'piece') return sum + item.quantity;
      if (item.type === 'pair') return sum + (item.quantity * 2);
      return sum + item.quantity;
    }, 0);
  }, [orderItems]);
  
  const totalFishPrice = useMemo(() => orderItems.reduce((sum, item) => sum + calculateItemTotal(item), 0), [orderItems]);
  const grandTotal = totalFishPrice + (orderItems.length > 0 ? bankInfo.shipping_fee : 0);

  const getGenderLabel = (gender: Gender) => {
    switch (gender) {
      case 'male': return '♂️ ตัวผู้';
      case 'female': return '♀️ ตัวเมีย';
      default: return '';
    }
  };

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
        // แถมทั้งหมด
        text += `${index + 1}. 🎁 ${item.breedName}${gradeLabel} ${genderLabel}: ${item.quantity} ${typeLabel} = แถมฟรีทั้งหมด\n`;
      } else if (item.freeQty && item.freeQty > 0) {
        // แถมบางส่วน
        text += `${index + 1}. ${item.breedName}${gradeLabel} ${genderLabel}: ${item.quantity} ${typeLabel} (ซื้อ ${paidQty} + แถม ${item.freeQty})`;
        if (item.discount && item.discount > 0) {
          text += ` (ลด ${item.discount} บาท)`;
        }
        text += ` = ${itemTotal.toLocaleString()}.-\n`;
      } else {
        // ไม่มีแถม
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

  const generateOrderMessage = (items: OrderItem[], totalFish: number, totalAmount: number, customer?: string, note?: string, shippingFee?: number) => {
    if (items.length === 0) return '';
    
    const itemsTotal = items.reduce((sum, item) => {
      const paidQty = item.quantity - (item.freeQty || 0);
      return sum + (item.price * paidQty) - (item.discount || 0);
    }, 0);
    
    const finalShippingFee = shippingFee || bankInfo.shipping_fee;
    const grandTotal = itemsTotal + finalShippingFee;
    
    let text = `🐠 รายการสั่งซื้อปลาหางนกยูง\n`;
    text += `----------------------------\n`;
    items.forEach((item, index) => {
      const typeLabel = item.type === 'piece' ? 'ตัว' : item.type === 'pair' ? 'คู่' : 'set';
      const genderLabel = item.gender === 'male' ? '♂️' : item.gender === 'female' ? '♀️' : '⚥';
      const gradeLabel = item.grade === 'premium' ? ' 👑[งานคัดเกรด]' : '';
      const paidQty = item.quantity - (item.freeQty || 0);
      const itemTotal = (item.price * paidQty) - (item.discount || 0);
      
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
    text += `📊 จำนวนปลาทั้งหมด: ${totalFish} ตัว\n`;
    text += `💰 ค่าปลา: ${itemsTotal.toLocaleString()} บาท\n`;
    text += `🚚 ค่าจัดส่ง: ${finalShippingFee.toLocaleString()} บาท\n`;
    text += `🔥 ยอดรวมทั้งสิ้น: ${grandTotal.toLocaleString()} บาท\n`;
    if (customer) {
      text += `👤 ลูกค้า: ${customer}\n`;
    }
    if (note) {
      text += `💬 หมายเหตุ: ${note}\n`;
    }
    text += `----------------------------\n`;
    text += `🏦 ช่องทางชำระเงิน\n`;
    text += `${bankInfo.bank_name || 'ไม่ระบุธนาคาร'}\n`;
    text += `เลขบัญชี: ${bankInfo.account_number || 'ไม่ระบุเลขบัญชี'}\n`;
    text += `ชื่อบัญชี: ${bankInfo.account_name || 'ไม่ระบุชื่อ'}\n`;
    text += `----------------------------\n`;
    text += `ชำระแล้วรบกวนส่งสลิปแจ้งชื่อที่อยู่ได้เลยครับ 🙏✨`;
    return text;
  };

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

  // บันทึกออเดอร์ลงฐานข้อมูล
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
      
      const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select();
      
      if (error) throw error;
      
      // บันทึกลง state ด้วย
      const newSavedOrder: SavedOrder = {
        id: data[0].id,
        created_at: data[0].created_at,
        items: [...orderItems],
        totalAmount: grandTotal,
        totalFish: totalFishCount,
        shippingFee: bankInfo.shipping_fee || 60,
        actualShippingFee: bankInfo.shipping_fee || 60,
        totalCost: totalCost,
        customerName: customerName || undefined,
        note: orderNote || undefined
      };
      
      setSavedOrders([newSavedOrder, ...savedOrders]);
      
      // รีเซ็ตออเดอร์ปัจจุบัน
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
  
  // แก้ไขออเดอร์ (สำหรับ Admin)
  const updateOrder = async (orderId: string, updatedItems: OrderItem[], updatedCustomerName?: string, updatedNote?: string, updatedActualShippingFee?: number) => {
    try {
      // คำนวณยอดรวมใหม่
      const newTotalAmount = updatedItems.reduce((sum, item) => {
        const paidQty = item.quantity - (item.freeQty || 0);
        return sum + (item.price * paidQty) - (item.discount || 0);
      }, 0) + (editingOrder?.shippingFee || 60);
      
      const newTotalFish = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
      const newTotalCost = updatedItems.reduce((sum, item) => {
        let itemCost = item.cost;
        if (itemCost === undefined) {
          const breed = breeds.find((b: Breed) => b.id === item.breedId);
          if (breed) {
            itemCost = item.type === 'piece' ? (breed.cost_piece || 0) : item.type === 'pair' ? (breed.cost_pair || 0) : (breed.cost_set || 0);
            item.cost = itemCost;
          } else {
            itemCost = 0;
          }
        }
        return sum + (itemCost * item.quantity);
      }, 0);
      const newActualShippingFee = updatedActualShippingFee !== undefined ? updatedActualShippingFee : editingOrder?.actualShippingFee;
      
      const { error } = await supabase
        .from('orders')
        .update({
          items: updatedItems,
          total_amount: newTotalAmount,
          total_fish: newTotalFish,
          total_cost: newTotalCost,
          actual_shipping_fee: newActualShippingFee,
          customer_name: updatedCustomerName || null,
          note: updatedNote || null
        })
        .eq('id', orderId);
      
      if (error) throw error;
      
      // อัปเดตใน state allOrders
      setAllOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { ...order, items: updatedItems, totalAmount: newTotalAmount, totalFish: newTotalFish, totalCost: newTotalCost, actualShippingFee: newActualShippingFee, customerName: updatedCustomerName, note: updatedNote }
          : order
      ));

      // อัปเดตใน state savedOrders (หน้าแรก)
      setSavedOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { ...order, items: updatedItems, totalAmount: newTotalAmount, totalFish: newTotalFish, totalCost: newTotalCost, actualShippingFee: newActualShippingFee, customerName: updatedCustomerName, note: updatedNote }
          : order
      ));
      
      toast.success('แก้ไขออเดอร์เรียบร้อย!');
      setIsEditingOrder(false);
      setEditingOrder(null);
    } catch (err) {
      console.error('Update order error:', err);
      toast.error('แก้ไขไม่สำเร็จ');
    }
  };
  
  // ลบออเดอร์ (สำหรับ Admin)
  const deleteOrder = async (orderId: string) => {
    if (!confirm('ต้องการลบออเดอร์นี้ใช่หรือไม่?')) return;
    
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);
      
      if (error) throw error;
      
      setAllOrders(allOrders.filter(order => order.id !== orderId));
      toast.success('ลบออเดอร์เรียบร้อย!');
    } catch (err) {
      console.error('Delete order error:', err);
      toast.error('ลบไม่สำเร็จ');
    }
  };
  
  // โหลดประวัติออเดอร์ของวันนี้
  const loadTodayOrders = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', today)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // แปลง snake_case เป็น camelCase
      const transformedData = (data || []).map((order: any) => ({
        id: order.id,
        created_at: order.created_at,
        items: order.items,
        totalAmount: order.total_amount || 0,
        totalFish: order.total_fish || 0,
        shippingFee: order.shipping_fee || 60,
        actualShippingFee: order.actual_shipping_fee || order.shipping_fee || 60,
        totalCost: order.total_cost || 0,
        customerName: order.customer_name,
        note: order.note
      }));
      
      setSavedOrders(transformedData);
    } catch (err) {
      console.error('Load orders error:', err);
    }
  };
  
  // โหลดออเดอร์ทั้งหมดสำหรับ Admin
  const loadAllOrders = async (period: 'today' | 'week' | 'month' | 'year' | 'custom' = 'today', customStart?: string, customEnd?: string) => {
    try {
      let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
      
      const now = new Date();
      if (period === 'today') {
        const today = now.toISOString().split('T')[0];
        query = query.gte('created_at', today);
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
        query = query.gte('created_at', customStart).lte('created_at', customEnd + 'T23:59:59');
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const transformedData = (data || []).map((order: any) => ({
        id: order.id,
        created_at: order.created_at,
        items: order.items,
        totalAmount: order.total_amount || 0,
        totalFish: order.total_fish || 0,
        shippingFee: order.shipping_fee || 60,
        actualShippingFee: order.actual_shipping_fee !== null ? order.actual_shipping_fee : (order.shipping_fee || 60),
        totalCost: order.total_cost || 0,
        customerName: order.customer_name,
        note: order.note
      }));
      
      setAllOrders(transformedData);
    } catch (err) {
      console.error('Load all orders error:', err);
    }
  };
  
  // คำนวณสถิติสำหรับ Dashboard
  const dashboardStats = useMemo(() => {
    const totalSales = allOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalFish = allOrders.reduce((sum, order) => sum + (order.totalFish || 0), 0);
    
    let totalFishNormal = 0;
    let totalFishPremium = 0;
    allOrders.forEach(order => {
      order.items?.forEach((item: OrderItem) => {
        const qty = item.type === 'piece' ? item.quantity : item.type === 'pair' ? item.quantity * 2 : item.quantity;
        if (item.grade === 'premium') {
          totalFishPremium += qty;
        } else {
          totalFishNormal += qty;
        }
      });
    });

    const totalFishCost = allOrders.reduce((sum, order) => sum + (order.totalCost || 0), 0);
    const totalShippingIncome = allOrders.reduce((sum, order) => sum + (order.shippingFee || 60), 0);
    const totalShippingCost = allOrders.reduce((sum, order) => sum + (order.actualShippingFee !== undefined && order.actualShippingFee !== null ? order.actualShippingFee : (order.shippingFee || 60)), 0);
    const totalProfit = allOrders.reduce((sum, order) => {
      const revenue = order.totalAmount || 0;
      const cost = order.totalCost || 0;
      const shipping = order.actualShippingFee !== undefined && order.actualShippingFee !== null ? order.actualShippingFee : (order.shippingFee || 60);
      return sum + (revenue - cost - shipping);
    }, 0);
    const avgOrderValue = allOrders.length > 0 ? totalSales / allOrders.length : 0;
    
    // สรุปตามสายพันธุ์
    const breedStats: { [key: string]: { name: string; qty: number; sales: number; isPremium?: boolean } } = {};
    allOrders.forEach(order => {
      order.items.forEach((item: OrderItem) => {
        const gradeSuffix = item.grade === 'premium' ? ' (คัดเกรด)' : '';
        const statKey = `${item.breedId}${item.grade === 'premium' ? '-premium' : '-normal'}`;
        
        if (!breedStats[statKey]) {
          breedStats[statKey] = { name: item.breedName, qty: 0, sales: 0, isPremium: item.grade === 'premium' };
        }
        const paidQty = item.quantity - (item.freeQty || 0);
        breedStats[statKey].qty += item.quantity;
        breedStats[statKey].sales += (item.price * paidQty) - (item.discount || 0);
      });
    });
    
    // Top 10 ปลาขายดี
    const topBreeds = Object.values(breedStats)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);
    
    // สรุปตามลูกค้า (Top Customers)
    const customerStats: { [key: string]: { name: string; orders: number; totalSpent: number; totalFish: number } } = {};
    allOrders.forEach(order => {
      const customerName = order.customerName || 'ไม่ระบุชื่อ';
      if (!customerStats[customerName]) {
        customerStats[customerName] = { name: customerName, orders: 0, totalSpent: 0, totalFish: 0 };
      }
      customerStats[customerName].orders += 1;
      customerStats[customerName].totalSpent += order.totalAmount || 0;
      customerStats[customerName].totalFish += order.totalFish || 0;
    });
    
    // Top 10 ลูกค้า (เรียงตามยอดซื้อ)
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
      totalFishNormal,
      totalFishPremium,
      totalProfit,
      avgOrderValue,
      topBreeds,
      topCustomers
    };
  }, [allOrders]);
  
  // คำนวณยอดขายรายวัน
  const todaySummary = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = savedOrders.filter(order => 
      order.created_at?.startsWith(today)
    );
    
    return {
      orderCount: todayOrders.length,
      totalSales: todayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0),
      totalFish: todayOrders.reduce((sum, order) => sum + (order.totalFish || 0), 0)
    };
  }, [savedOrders]);

  if (loading && breeds.length === 0) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-blue-600 font-bold uppercase tracking-widest text-xs"><Loader2 className="h-10 w-10 animate-spin mb-4" /> Connecting to Cloud...</div>;
  }

  // Show auth screen if not logged in
  if (!user) {
    return (
      <>
        <AuthScreen />
        <Toaster position="top-center" richColors />
      </>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-slate-50 font-sans">
      <Toaster position="top-center" richColors />
      <header className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-50 px-3 sm:px-4 py-3 sm:py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-blue-600 rounded-xl sm:rounded-2xl shadow-lg shadow-blue-500/20">
              <Fish className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight leading-none uppercase">GuppyReal</h1>
              <p className="text-[8px] sm:text-[9px] font-black text-blue-500 uppercase tracking-widest mt-0.5 sm:mt-1">{user?.shop_name || 'Shop'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {isAdmin && (
              <>
                <button 
                  onClick={() => { 
                    if (!showAdminDashboard) { loadAllOrders('today'); }
                    setShowAdminDashboard(!showAdminDashboard); 
                    setIsManagingBreeds(false); 
                  }}
                  className={cn("h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-5 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all", showAdminDashboard ? "bg-slate-800 text-white shadow-lg shadow-slate-900/10" : "bg-green-50 text-green-600 hover:bg-green-100")}
                  title={showAdminDashboard ? "Back" : "Admin"}
                >
                  {showAdminDashboard ? <X className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}
                  <span className="hidden sm:inline">{showAdminDashboard ? "Back" : "Admin"}</span>
                </button>
                <button 
                  onClick={() => { 
                    setIsManagingBreeds(!isManagingBreeds); 
                    setShowAdminDashboard(false); 
                  }} 
                  className={cn("h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-5 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all", isManagingBreeds ? "bg-slate-800 text-white shadow-lg shadow-slate-900/10" : "bg-blue-50 text-blue-600 hover:bg-blue-100")}
                  title={isManagingBreeds ? "Back" : "Settings"}
                >
                  {isManagingBreeds ? <X className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
                  <span className="hidden sm:inline">{isManagingBreeds ? "Back" : "Settings"}</span>
                </button>
              </>
            )}
            <button 
              onClick={logout} 
              className="h-9 sm:h-10 flex items-center justify-center px-2.5 sm:px-4 rounded-xl sm:rounded-2xl text-xs font-black uppercase tracking-widest bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Admin Dashboard View */}
      {showAdminDashboard && (
        <main className="max-w-4xl mx-auto p-4 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-slate-100 overflow-hidden flex flex-col min-h-[75vh]">
            {/* Header */}
            <div className="p-6 sm:p-8 border-b border-slate-100">
              <h2 className="font-black text-2xl text-slate-800 tracking-tight flex items-center gap-3">
                 <ClipboardList className="h-6 w-6 text-blue-600" />
                 Admin Dashboard
              </h2>
              <p className="text-slate-500 text-sm mt-1">จัดการออเดอร์ & ดูรายงานสรุปผล</p>
            </div>
            
            {/* Navigation Tabs */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex gap-2">
              <button
                onClick={() => { setAdminView('orders'); loadAllOrders(reportPeriod); }}
                className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                  adminView === 'orders' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                📋 รายการบิล
              </button>
              <button
                onClick={() => { setAdminView('dashboard'); loadAllOrders(reportPeriod); }}
                className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                  adminView === 'dashboard' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                📊 Dashboard
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Period Selector */}
              <div className="flex flex-wrap gap-2 mb-6">
                {(['today', 'week', 'month', 'year', 'custom'] as const).map(period => (
                  <button
                    key={period}
                    onClick={() => { 
                      setReportPeriod(period); 
                      if (period === 'custom') {
                        // ไม่โหลดทันที รอให้เลือกวันที่
                      } else {
                        loadAllOrders(period); 
                      }
                    }}
                    className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${
                      reportPeriod === period 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {period === 'today' && 'วันนี้'}
                    {period === 'week' && '7 วัน'}
                    {period === 'month' && 'เดือนนี้'}
                    {period === 'year' && 'ปีนี้'}
                    {period === 'custom' && 'เลือกวันที่'}
                  </button>
                ))}
              </div>
              
              {/* Custom Date Range Picker */}
              {reportPeriod === 'custom' && (
                <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <div className="flex flex-wrap gap-4 items-end">
                    <div>
                      <label className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-2">จากวันที่</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="h-10 px-3 bg-white border border-blue-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-2">ถึงวันที่</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="h-10 px-3 bg-white border border-blue-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                      />
                    </div>
                    <button
                      onClick={() => loadAllOrders('custom', startDate, endDate)}
                      disabled={!startDate || !endDate}
                      className="h-10 px-6 bg-blue-600 disabled:bg-slate-300 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
                    >
                      ดูรายงาน
                    </button>
                  </div>
                </div>
              )}
              
              {adminView === 'orders' ? (
                <>
                  <div className="mb-4 text-sm text-slate-500">
                    พบ {allOrders.length} รายการ
                  </div>
                  <div className="space-y-3">
                    {allOrders.map((order, index) => (
                      <div key={order.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-black text-blue-600">#{allOrders.length - index}</span>
                            <span className="text-sm text-slate-500">
                              {new Date(order.created_at).toLocaleString('th-TH', { 
                                dateStyle: 'medium', 
                                timeStyle: 'short' 
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xl text-blue-600">
                              ฿{(order.totalAmount || 0).toLocaleString()}
                            </span>
                            {/* ปุ่มแก้ไขและลบ */}
                            <button
                              onClick={() => { setEditingOrder(order); setIsEditingOrder(true); }}
                              className="h-8 w-8 bg-blue-100 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg flex items-center justify-center transition-all"
                              title="แก้ไข"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteOrder(order.id)}
                              className="h-8 w-8 bg-red-100 hover:bg-red-600 text-red-600 hover:text-white rounded-lg flex items-center justify-center transition-all"
                              title="ลบ"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        
                        {order.customerName && (
                          <p className="text-sm text-slate-600 mb-1">👤 {order.customerName}</p>
                        )}
                        
                        <p className="text-xs text-slate-400">
                          {(order.totalFish || 0)} ตัว • {(order.items?.length || 0)} รายการ
                        </p>
                        
                        {order.note && (
                          <p className="text-xs text-slate-400 mt-2 italic">💬 {order.note}</p>
                        )}
                        
                        {/* รายละเอียดสายพันธุ์ */}
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <div className="space-y-2">
                            {order.items?.map((item: OrderItem, i: number) => (
                              <div key={i} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-700">{item.breedName}</span>
                                  {item.grade === 'premium' && (
                                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">
                                      👑 คัดเกรด
                                    </span>
                                  )}
                                  <span className="text-slate-500">{item.quantity} ตัว</span>
                                  {item.gender !== 'mixed' && (
                                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                                      {item.gender === 'male' ? '♂️ ผู้' : '♀️ เมีย'}
                                    </span>
                                  )}
                                  {(item.freeQty || 0) > 0 && (
                                    <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">
                                      🎁 แถม {item.freeQty}
                                    </span>
                                  )}
                                  {(item.discount || 0) > 0 && (
                                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                                      ลด {item.discount}฿
                                    </span>
                                  )}
                                </div>
                                <span className="font-bold text-slate-700">฿{((item.price * (item.quantity - (item.freeQty || 0))) - (item.discount || 0)).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                          
                          {/* สรุปยอด และ ต้นทุน */}
                          <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">ฝั่งรายรับ (ลูกค้าจ่าย)</p>
                              <div className="flex justify-between text-slate-600">
                                <span>ค่าปลา (รวมส่วนลดแล้ว)</span>
                                <span>฿{((order.totalAmount || 0) - (order.shippingFee || 60)).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-slate-600">
                                <span>ค่าจัดส่ง (เก็บลูกค้า)</span>
                                <span>฿{(order.shippingFee || 60).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between font-black text-blue-600 pt-2 border-t border-slate-200 mt-2">
                                <span>ยอดรวม</span>
                                <span>฿{(order.totalAmount || 0).toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="space-y-1 bg-orange-50 p-3 rounded-xl border border-orange-100">
                              <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-2">ฝั่งต้นทุน & กำไร</p>
                              <div className="flex justify-between text-orange-700">
                                <span>ต้นทุนปลา</span>
                                <span>฿{(order.totalCost || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-orange-700">
                                <span>ค่าจัดส่งจริง (จ่ายจริง)</span>
                                <span>฿{(order.actualShippingFee !== undefined ? order.actualShippingFee : (order.shippingFee || 60)).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between font-black text-green-600 pt-2 border-t border-orange-200 mt-2">
                                <span>กำไรบิลนี้</span>
                                <span>฿{((order.totalAmount || 0) - (order.totalCost || 0) - (order.actualShippingFee !== undefined ? order.actualShippingFee : (order.shippingFee || 60))).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {/* Dashboard Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <div className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl text-white">
                      <p className="text-[10px] uppercase tracking-widest text-blue-100 mb-1">จำนวนบิล</p>
                      <p className="font-black text-3xl">{dashboardStats.totalOrders}</p>
                    </div>
                    <div className="p-6 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl text-white">
                      <p className="text-[10px] uppercase tracking-widest text-green-100 mb-1">ยอดขายรวม</p>
                      <p className="font-black text-3xl">฿{dashboardStats.totalSales.toLocaleString()}</p>
                    </div>
                    <div className="p-6 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl text-white">
                      <p className="text-[10px] uppercase tracking-widest text-indigo-100 mb-1">กำไรสุทธิ</p>
                      <p className="font-black text-3xl">฿{dashboardStats.totalProfit.toLocaleString()}</p>
                    </div>
                    <div className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl text-white flex flex-col justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-purple-100 mb-1">จำนวนปลาทั้งหมด</p>
                        <p className="font-black text-3xl flex items-baseline gap-2">
                          {dashboardStats.totalFish}
                          <span className="text-sm font-bold text-purple-200 uppercase tracking-widest">ตัว</span>
                        </p>
                      </div>
                      
                      {(dashboardStats.totalFishNormal > 0 || dashboardStats.totalFishPremium > 0) && (
                        <div className="mt-3 pt-3 border-t border-purple-400/30 flex justify-between items-center text-[10px] font-bold">
                          <span className="text-orange-200 bg-orange-500/20 px-2 py-0.5 rounded-full">👑 คัดเกรด: {dashboardStats.totalFishPremium}</span>
                          <span className="text-purple-100">ปกติ: {dashboardStats.totalFishNormal}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl text-white">
                      <p className="text-[10px] uppercase tracking-widest text-orange-100 mb-1">เฉลี่ย/บิล</p>
                      <p className="font-black text-3xl">฿{Math.round(dashboardStats.avgOrderValue).toLocaleString()}</p>
                    </div>
                  </div>
                  
                  {/* Profit Breakdown */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
                    <h3 className="font-black text-lg mb-4 flex items-center gap-2">
                      📊 สรุปรายรับ - ต้นทุน
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4 p-5 bg-slate-50 rounded-xl border border-slate-100">
                        <h4 className="font-bold text-slate-500 text-sm uppercase tracking-wider border-b border-slate-200 pb-2">ฝั่งรายรับ (ลูกค้าชำระ)</h4>
                        <div className="flex justify-between items-center text-slate-600">
                          <span>รายได้จากค่าปลา (รวมส่วนลด)</span>
                          <span className="font-bold">฿{((dashboardStats.totalSales || 0) - (dashboardStats.totalShippingIncome || 0)).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600">
                          <span>รายได้จากค่าจัดส่ง</span>
                          <span className="font-bold">฿{(dashboardStats.totalShippingIncome || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-800 pt-3 border-t border-slate-200">
                          <span className="font-bold">ยอดขายรวมทั้งหมด</span>
                          <span className="font-black text-blue-600 text-xl">฿{(dashboardStats.totalSales || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-4 p-5 bg-orange-50 rounded-xl border border-orange-100">
                        <h4 className="font-bold text-orange-500 text-sm uppercase tracking-wider border-b border-orange-200 pb-2">ฝั่งต้นทุน & กำไร</h4>
                        <div className="flex justify-between items-center text-orange-700">
                          <span>ต้นทุนปลาทั้งหมด</span>
                          <span className="font-bold">฿{(dashboardStats.totalFishCost || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-orange-700">
                          <span>ค่าจัดส่งจริง (ต้นทุน)</span>
                          <span className="font-bold">฿{(dashboardStats.totalShippingCost || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-orange-200">
                          <span className="font-bold text-orange-800">กำไรสุทธิทั้งหมด</span>
                          <span className="font-black text-green-600 text-xl">฿{(dashboardStats.totalProfit || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top Breeds */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
                    <h3 className="font-black text-lg mb-4 flex items-center gap-2">
                      🏆 Top 10 สายพันธุ์ขายดี
                    </h3>
                    
                    {dashboardStats.topBreeds.length === 0 ? (
                      <p className="text-slate-400 text-center py-8">ไม่มีข้อมูล</p>
                    ) : (
                      <div className="space-y-3">
                        {dashboardStats.topBreeds.map((breed, index) => (
                          <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-3">
                              <span className={`
                                w-8 h-8 rounded-full flex items-center justify-center font-black text-sm
                                ${index === 0 ? 'bg-yellow-100 text-yellow-600' : ''}
                                ${index === 1 ? 'bg-gray-100 text-gray-600' : ''}
                                ${index === 2 ? 'bg-orange-100 text-orange-600' : ''}
                                ${index > 2 ? 'bg-slate-100 text-slate-600' : ''}
                              `}>
                                {index + 1}
                              </span>
                              <span className="font-bold text-slate-700 flex items-center gap-2">
                                {breed.name}
                                {breed.isPremium && (
                                  <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-black">👑 คัดเกรด</span>
                                )}
                              </span>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-blue-600">฿{breed.sales.toLocaleString()}</p>
                              <p className="text-xs text-slate-400">{breed.qty} ตัว</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Top Customers */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h3 className="font-black text-lg mb-4 flex items-center gap-2">
                      👑 Top 10 ลูกค้าซื้อมากที่สุด
                    </h3>
                    
                    {dashboardStats.topCustomers.length === 0 ? (
                      <p className="text-slate-400 text-center py-8">ไม่มีข้อมูล</p>
                    ) : (
                      <div className="space-y-3">
                        {dashboardStats.topCustomers.map((customer, index) => (
                          <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-3">
                              <span className={`
                                w-8 h-8 rounded-full flex items-center justify-center font-black text-sm
                                ${index === 0 ? 'bg-yellow-100 text-yellow-600' : ''}
                                ${index === 1 ? 'bg-gray-100 text-gray-600' : ''}
                                ${index === 2 ? 'bg-orange-100 text-orange-600' : ''}
                                ${index > 2 ? 'bg-slate-100 text-slate-600' : ''}
                              `}>
                                {index + 1}
                              </span>
                              <div>
                                <span className="font-bold text-slate-700 block">{customer.name}</span>
                                <span className="text-xs text-slate-400">{customer.orders} ออเดอร์ • {customer.totalFish} ตัว</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-green-600">฿{customer.totalSpent.toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      )}

            {/* Add/Edit Breed Modal */}
      {isBreedModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  {editingBreed ? <Edit2 className="h-6 w-6 text-white" /> : <Plus className="h-6 w-6 text-white" />}
                </div>
                <div>
                  <h2 className="font-black text-xl text-white tracking-tight">{editingBreed ? 'แก้ไขสายพันธุ์' : 'เพิ่มสายพันธุ์ใหม่'}</h2>
                  <p className="text-blue-200 text-sm">{editingBreed ? `กำลังแก้ไข #${String(editingBreed.id).slice(-6)}` : 'กรอกรายละเอียดเพื่อเพิ่มปลา'}</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsBreedModalOpen(false); setEditingBreed(null); }}
                className="h-12 w-12 bg-white/20 hover:bg-white/30 rounded-2xl flex items-center justify-center text-white transition-all"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
              <form id="breedForm" onSubmit={handleAddOrUpdateBreed} className="space-y-8">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">ชื่อสายพันธุ์</label>
                  <input name="name" defaultValue={editingBreed?.name} required placeholder="เช่น Full Gold" className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-5 font-bold focus:ring-2 focus:ring-blue-500/10 outline-none" />
                </div>
                
                <div className="space-y-6">
                  {/* เกรดคัด */}
                  <div className="bg-orange-50/50 p-6 rounded-[2rem] border-2 border-orange-100 shadow-sm space-y-4">
                    <p className="text-sm font-black text-orange-600 uppercase tracking-widest flex items-center gap-2"><span className="text-lg">👑</span> งานคัดเกรด</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-3 p-4 bg-white rounded-[1.5rem] border border-orange-100/50 shadow-sm">
                        <p className="text-xs font-bold text-center text-slate-600 uppercase tracking-widest">Piece (ต่อตัว)</p>
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest ml-1">ราคาขาย</label>
                            <input name="premium_price_piece" type="number" defaultValue={editingBreed?.premium_price_piece || ''} placeholder="0" className="w-full h-11 bg-orange-50/30 border border-orange-200 rounded-xl px-4 font-black outline-none text-sm focus:border-orange-400" />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ต้นทุน</label>
                            <input name="premium_cost_piece" type="number" defaultValue={editingBreed?.premium_cost_piece || ''} placeholder="0" className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold outline-none text-sm text-slate-500 focus:border-slate-300" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 p-4 bg-white rounded-[1.5rem] border border-orange-100/50 shadow-sm">
                        <p className="text-xs font-bold text-center text-slate-600 uppercase tracking-widest">Pair (คู่)</p>
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest ml-1">ราคาขาย</label>
                            <input name="premium_price_pair" type="number" defaultValue={editingBreed?.premium_price_pair || ''} placeholder="0" className="w-full h-11 bg-orange-50/30 border border-orange-200 rounded-xl px-4 font-black outline-none text-sm focus:border-orange-400" />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ต้นทุน</label>
                            <input name="premium_cost_pair" type="number" defaultValue={editingBreed?.premium_cost_pair || ''} placeholder="0" className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold outline-none text-sm text-slate-500 focus:border-slate-300" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 p-4 bg-white rounded-[1.5rem] border border-orange-100/50 shadow-sm">
                        <p className="text-xs font-bold text-center text-slate-600 uppercase tracking-widest">Set (ชุด)</p>
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest ml-1">ราคาขาย</label>
                            <input name="premium_price_set" type="number" defaultValue={editingBreed?.premium_price_set || ''} placeholder="0" className="w-full h-11 bg-orange-50/30 border border-orange-200 rounded-xl px-4 font-black outline-none text-sm focus:border-orange-400" />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ต้นทุน</label>
                            <input name="premium_cost_set" type="number" defaultValue={editingBreed?.premium_cost_set || ''} placeholder="0" className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold outline-none text-sm text-slate-500 focus:border-slate-300" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* เกรดปกติ */}
                  <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-200 shadow-sm space-y-4">
                    <p className="text-sm font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">🐟 เกรดปกติ (จำเป็น)</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-3 p-4 bg-white rounded-[1.5rem] border border-slate-100 shadow-sm">
                        <p className="text-xs font-bold text-center text-slate-600 uppercase tracking-widest">Piece (ต่อตัว)</p>
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">ราคาขาย</label>
                            <input name="price_piece" type="number" defaultValue={editingBreed?.price_piece} required placeholder="0" className="w-full h-11 bg-blue-50/30 border border-blue-100 rounded-xl px-4 font-black outline-none text-sm focus:border-blue-300" />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ต้นทุน</label>
                            <input name="cost_piece" type="number" defaultValue={editingBreed?.cost_piece || 0} placeholder="0" className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold outline-none text-sm text-slate-500 focus:border-slate-300" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 p-4 bg-white rounded-[1.5rem] border border-slate-100 shadow-sm">
                        <p className="text-xs font-bold text-center text-slate-600 uppercase tracking-widest">Pair (คู่)</p>
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">ราคาขาย</label>
                            <input name="price_pair" type="number" defaultValue={editingBreed?.price_pair} required placeholder="0" className="w-full h-11 bg-blue-50/30 border border-blue-100 rounded-xl px-4 font-black outline-none text-sm focus:border-blue-300" />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ต้นทุน</label>
                            <input name="cost_pair" type="number" defaultValue={editingBreed?.cost_pair || 0} placeholder="0" className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold outline-none text-sm text-slate-500 focus:border-slate-300" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 p-4 bg-white rounded-[1.5rem] border border-slate-100 shadow-sm">
                        <p className="text-xs font-bold text-center text-slate-600 uppercase tracking-widest">Set (ชุด)</p>
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">ราคาขาย</label>
                            <input name="price_set" type="number" defaultValue={editingBreed?.price_set || 0} placeholder="0" className="w-full h-11 bg-blue-50/30 border border-blue-100 rounded-xl px-4 font-black outline-none text-sm focus:border-blue-300" />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ต้นทุน</label>
                            <input name="cost_set" type="number" defaultValue={editingBreed?.cost_set || 0} placeholder="0" className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold outline-none text-sm text-slate-500 focus:border-slate-300" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-4">
              <button 
                type="button" 
                onClick={() => { setIsBreedModalOpen(false); setEditingBreed(null); }}
                className="flex-1 h-14 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:border-slate-300 transition-all"
              >
                ยกเลิก
              </button>
              <button 
                type="submit" 
                form="breedForm"
                className="flex-1 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all"
              >
                <Save className="h-5 w-5" />
                {editingBreed ? 'อัปเดตข้อมูล' : 'เพิ่มปลา'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Edit Order Modal */}
      {isEditingOrder && editingOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-orange-500 to-orange-600">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Edit2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="font-black text-xl text-white tracking-tight">แก้ไขออเดอร์</h2>
                  <p className="text-orange-200 text-sm">#{editingOrder.id?.slice(-6)}</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsEditingOrder(false); setEditingOrder(null); }}
                className="h-12 w-12 bg-white/20 hover:bg-white/30 rounded-2xl flex items-center justify-center text-white transition-all"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* ชื่อลูกค้า */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">ชื่อลูกค้า</label>
                <input
                  type="text"
                  defaultValue={editingOrder.customerName}
                  id="edit-customer-name"
                  className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-700 outline-none focus:border-blue-400"
                  placeholder="ชื่อลูกค้า"
                />
              </div>
              
              {/* หมายเหตุ */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">หมายเหตุ</label>
                <input
                  type="text"
                  defaultValue={editingOrder.note}
                  id="edit-order-note"
                  className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-700 outline-none focus:border-blue-400"
                  placeholder="หมายเหตุ"
                />
              </div>
              
              {/* ค่าจัดส่งจริง */}
              <div>
                <label className="text-xs font-bold text-orange-500 uppercase tracking-wider block mb-2">🚚 ค่าจัดส่งจริง (ต้นทุนที่เสียไป)</label>
                <input
                  type="number"
                  defaultValue={editingOrder.actualShippingFee !== undefined ? editingOrder.actualShippingFee : (editingOrder.shippingFee || 60)}
                  id="edit-actual-shipping-fee"
                  className="w-full h-12 bg-orange-50 border border-orange-200 rounded-xl px-4 font-bold text-orange-700 outline-none focus:border-orange-400"
                  placeholder="ค่าส่งที่จ่ายจริง"
                />
              </div>
              
              {/* รายการสินค้าปัจจุบัน */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">รายการสินค้า ({editingOrder.items?.length || 0} รายการ)</label>
                <div className="space-y-3">
                  {editingOrder.items?.map((item: OrderItem, index: number) => (
                    <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-slate-800">{item.breedName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                            {item.gender === 'male' ? '♂️ ผู้' : item.gender === 'female' ? '♀️ เมีย' : ''}
                          </span>
                          <button
                            onClick={() => {
                              // ลบรายการนี้ออก
                              const newItems = editingOrder.items?.filter((_, i) => i !== index) || [];
                              setEditingOrder({ ...editingOrder, items: newItems });
                            }}
                            className="h-6 w-6 bg-red-100 hover:bg-red-500 text-red-500 hover:text-white rounded-full flex items-center justify-center transition-all"
                            title="ลบรายการ"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">จำนวน</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const newItems = [...(editingOrder.items || [])];
                              newItems[index].quantity = Number(e.target.value) || 1;
                              setEditingOrder({ ...editingOrder, items: newItems });
                            }}
                            className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 font-bold text-slate-700 outline-none focus:border-blue-400"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">ส่วนลด</label>
                          <input
                            type="number"
                            min="0"
                            value={item.discount || 0}
                            onChange={(e) => {
                              const newItems = [...(editingOrder.items || [])];
                              newItems[index].discount = Number(e.target.value) || 0;
                              setEditingOrder({ ...editingOrder, items: newItems });
                            }}
                            className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 font-bold text-slate-700 outline-none focus:border-blue-400"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">แถม</label>
                          <input
                            type="number"
                            min="0"
                            value={item.freeQty || 0}
                            onChange={(e) => {
                              const newItems = [...(editingOrder.items || [])];
                              newItems[index].freeQty = Number(e.target.value) || 0;
                              setEditingOrder({ ...editingOrder, items: newItems });
                            }}
                            className="w-full h-10 bg-white border border-slate-200 rounded-lg px-3 font-bold text-slate-700 outline-none focus:border-blue-400"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* เพิ่มสายพันธุ์ใหม่ */}
              <div className="pt-4 border-t border-slate-200">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">➕ เพิ่มสายพันธุ์ใหม่</label>
                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                  <div className="mb-3">
                    <label className="text-[10px] text-blue-600 font-bold block mb-1">เลือกสายพันธุ์</label>
                    <select
                      id="new-item-breed"
                      className="w-full h-10 bg-white border border-blue-200 rounded-lg px-3 font-bold text-slate-700 outline-none focus:border-blue-400"
                    >
                      <option value="">-- เลือกสายพันธุ์ --</option>
                      {breeds.map(breed => (
                        <option key={breed.id} value={breed.id}>
                          {breed.name} (฿{breed.price_piece}/ตัว, ฿{breed.price_pair}/คู่)
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div>
                      <label className="text-[10px] text-blue-600 font-bold block mb-1">เพศ</label>
                      <select
                        id="new-item-gender"
                        className="w-full h-10 bg-white border border-blue-200 rounded-lg px-2 font-bold text-slate-700 outline-none focus:border-blue-400 text-xs"
                      >
                        <option value="male">♂️ ผู้</option>
                        <option value="female">♀️ เมีย</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-blue-600 font-bold block mb-1">ประเภท</label>
                      <select
                        id="new-item-type"
                        className="w-full h-10 bg-white border border-blue-200 rounded-lg px-2 font-bold text-slate-700 outline-none focus:border-blue-400 text-xs"
                      >
                        <option value="piece">ตัว</option>
                        <option value="pair">คู่</option>
                        <option value="set">Set</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-blue-600 font-bold block mb-1">จำนวน</label>
                      <input
                        type="number"
                        id="new-item-qty"
                        min="1"
                        defaultValue="1"
                        className="w-full h-10 bg-white border border-blue-200 rounded-lg px-3 font-bold text-slate-700 outline-none focus:border-blue-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-blue-600 font-bold block mb-1">ราคา</label>
                      <input
                        type="number"
                        id="new-item-price"
                        min="0"
                        placeholder="ราคา"
                        className="w-full h-10 bg-white border border-blue-200 rounded-lg px-3 font-bold text-slate-700 outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      const breedId = (document.getElementById('new-item-breed') as HTMLSelectElement)?.value;
                      const gender = (document.getElementById('new-item-gender') as HTMLSelectElement)?.value as Gender;
                      const type = (document.getElementById('new-item-type') as HTMLSelectElement)?.value as 'piece' | 'pair' | 'set';
                      const qty = Number((document.getElementById('new-item-qty') as HTMLInputElement)?.value) || 1;
                      const price = Number((document.getElementById('new-item-price') as HTMLInputElement)?.value) || 0;
                      
                      if (!breedId) {
                        toast.error('กรุณาเลือกสายพันธุ์');
                        return;
                      }
                      
                      const breed = breeds.find(b => b.id === breedId);
                      if (!breed) return;
                      
                      // ใช้ราคาจากที่กรอก หรือจากสายพันธุ์
                      const finalPrice = price > 0 ? price : (type === 'piece' ? breed.price_piece : type === 'pair' ? breed.price_pair : breed.price_set || 0);
                      
                      const newItem: OrderItem = {
                        id: Date.now().toString(),
                        breedId: breed.id,
                        breedName: breed.name,
                        type,
                        quantity: qty,
                        price: finalPrice,
                        cost: type === 'piece' ? (breed.cost_piece || 0) : type === 'pair' ? (breed.cost_pair || 0) : (breed.cost_set || 0),
                        gender
                      };
                      
                      setEditingOrder({
                        ...editingOrder,
                        items: [...(editingOrder.items || []), newItem]
                      });
                      
                      // Reset ฟอร์ม
                      (document.getElementById('new-item-breed') as HTMLSelectElement).value = '';
                      (document.getElementById('new-item-price') as HTMLInputElement).value = '';
                      
                      toast.success(`เพิ่ม ${breed.name} ลงออเดอร์`);
                    }}
                    className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    เพิ่มรายการ
                  </button>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 space-y-3">
              {/* ปุ่ม Copy & Share */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    const currentItems = editingOrder.items || [];
                    const totalFish = currentItems.reduce((sum: number, item: OrderItem) => sum + item.quantity, 0);
                    const customerName = (document.getElementById('edit-customer-name') as HTMLInputElement)?.value;
                    const note = (document.getElementById('edit-order-note') as HTMLInputElement)?.value;
                    const message = generateOrderMessage(
                      currentItems,
                      totalFish,
                      editingOrder.totalAmount || 0,
                      customerName,
                      note,
                      editingOrder.shippingFee
                    );
                    if (message) {
                      navigator.clipboard.writeText(message).then(() => {
                        setEditCopySuccess(true);
                        toast.success('คัดลอกข้อความแล้ว!');
                        setTimeout(() => setEditCopySuccess(false), 2000);
                      });
                    }
                  }}
                  className={cn(
                    "h-12 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2",
                    editCopySuccess 
                      ? "bg-blue-600 border-blue-600 text-white" 
                      : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
                  )}
                >
                  {editCopySuccess ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {editCopySuccess ? 'Copied!' : 'Copy'}
                </button>
                
                <button
                  onClick={() => {
                    const currentItems = editingOrder.items || [];
                    const totalFish = currentItems.reduce((sum: number, item: OrderItem) => sum + item.quantity, 0);
                    const customerName = (document.getElementById('edit-customer-name') as HTMLInputElement)?.value;
                    const note = (document.getElementById('edit-order-note') as HTMLInputElement)?.value;
                    const message = generateOrderMessage(
                      currentItems,
                      totalFish,
                      editingOrder.totalAmount || 0,
                      customerName,
                      note,
                      editingOrder.shippingFee
                    );
                    if (message) {
                      const lineUrl = `line://msg/text/${encodeURIComponent(message)}`;
                      window.location.href = lineUrl;
                      setTimeout(() => {
                        window.open(`https://line.me/R/msg/text/?${encodeURIComponent(message)}`, '_blank');
                      }, 500);
                    }
                  }}
                  className="h-12 bg-[#06C755] hover:bg-[#05b34d] text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle className="h-4 w-4" />
                  Send LINE
                </button>
              </div>
              
              {/* ปุ่มบันทึก */}
              <button
                onClick={() => {
                  const updatedItems = editingOrder.items || [];
                  const updatedCustomerName = (document.getElementById('edit-customer-name') as HTMLInputElement)?.value;
                  const updatedNote = (document.getElementById('edit-order-note') as HTMLInputElement)?.value;
                  const updatedActualShippingFee = (document.getElementById('edit-actual-shipping-fee') as HTMLInputElement)?.value 
                    ? Number((document.getElementById('edit-actual-shipping-fee') as HTMLInputElement)?.value) 
                    : undefined;
                  updateOrder(editingOrder.id, updatedItems, updatedCustomerName, updatedNote, updatedActualShippingFee);
                }}
                className="w-full h-14 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-black uppercase text-sm tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <Save className="h-5 w-5" />
                บันทึกการแก้ไข
              </button>
            </div>
          </div>
        </div>
      )}

      {!showAdminDashboard && (
      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {isManagingBreeds && isAdmin ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 py-4 max-w-3xl mx-auto space-y-6">
            <div className="bg-slate-800 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5"><CreditCard className="w-32 h-32" /></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-black text-xl flex items-center gap-3 tracking-tight"><CreditCard className="h-6 w-6 text-blue-400" /> Bank & Shipping</h3>
                  <button onClick={saveSettings} disabled={isSavingSettings} className="bg-blue-600 hover:bg-blue-500 px-6 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                    {isSavingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Settings
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ธนาคาร</label>
                    <input value={bankInfo.bank_name} onChange={e => setBankInfo({ ...bankInfo, bank_name: e.target.value })} className="w-full bg-slate-900 border-none rounded-2xl h-12 px-5 font-bold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">เลขบัญชี</label>
                    <input value={bankInfo.account_number} onChange={e => setBankInfo({ ...bankInfo, account_number: e.target.value })} className="w-full bg-slate-900 border-none rounded-2xl h-12 px-5 font-bold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ชื่อบัญชี</label>
                    <input value={bankInfo.account_name} onChange={e => setBankInfo({ ...bankInfo, account_name: e.target.value })} className="w-full bg-slate-900 border-none rounded-2xl h-12 px-5 font-bold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ค่าส่ง</label>
                    <input type="number" value={bankInfo.shipping_fee} onChange={e => setBankInfo({ ...bankInfo, shipping_fee: Number(e.target.value) })} className="w-full bg-slate-900 border-none rounded-2xl h-12 px-5 font-black outline-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Breeds List Header */}
            <div className="flex items-center justify-between mt-8 mb-4 px-2">
              <h3 className="font-black text-xl flex items-center gap-3 tracking-tight text-slate-800"><Fish className="h-6 w-6 text-blue-600" /> จัดการสายพันธุ์ปลา</h3>
              <button 
                onClick={() => { setEditingBreed(null); setIsBreedModalOpen(true); }} 
                className="h-10 px-4 bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> เพิ่มสายพันธุ์
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
              {breeds.map(breed => (
                <div key={breed.id} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md hover:border-blue-100 transition-all">
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className="h-10 w-10 shrink-0 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 transition-colors group-hover:bg-blue-100">
                      <Fish className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 pr-2">
                       <h4 className="font-black text-sm sm:text-base text-slate-800 truncate flex items-center gap-2">
                          <span className="truncate">{breed.name}</span>
                          {breed.premium_price_piece && <span className="shrink-0 bg-orange-100 text-orange-600 text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-md uppercase tracking-wider font-bold">👑 คัด</span>}
                       </h4>
                       <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 tracking-wide mt-0.5 truncate">
                          ฿{breed.price_piece} / ฿{breed.price_pair} {breed.price_set && breed.price_set > 0 && `/ ฿${breed.price_set}`}
                       </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0 relative z-20">
                    <button onClick={() => { setEditingBreed(breed); setIsBreedModalOpen(true); }} className="h-8 w-8 sm:h-9 sm:w-9 bg-slate-50 text-slate-400 hover:bg-white hover:text-blue-600 border border-transparent hover:border-slate-200 rounded-xl flex items-center justify-center active:scale-90 transition-all"><Edit2 className="h-3.5 w-3.5" /></button>
                    <button onClick={() => deleteBreed(breed.id)} className="h-8 w-8 sm:h-9 sm:w-9 bg-slate-50 text-slate-400 hover:bg-white hover:text-red-600 border border-transparent hover:border-slate-200 rounded-xl flex items-center justify-center active:scale-90 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
) : (
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
                      
                      {/* Gender Selection */}
                      <div className="flex gap-1.5 mb-1.5">
                        <button onClick={() => addToOrder(breed, 'piece', 'male', selectedGrade)} className="flex-1 py-2 bg-blue-50 hover:bg-blue-500 hover:text-white text-blue-600 rounded-lg text-[11px] font-bold transition-all">
                          ตัวผู้ (฿{selectedGrade === 'premium' && breed.premium_price_piece ? breed.premium_price_piece : breed.price_piece})
                        </button>
                        <button onClick={() => addToOrder(breed, 'piece', 'female', selectedGrade)} className="flex-1 py-2 bg-pink-50 hover:bg-pink-500 hover:text-white text-pink-600 rounded-lg text-[11px] font-bold transition-all">
                          ตัวเมีย (฿{selectedGrade === 'premium' && breed.premium_price_piece ? breed.premium_price_piece : breed.price_piece})
                        </button>
                      </div>
                      
                      {/* Price Buttons */}
                      <div className={`grid gap-1.5 ${breed.price_set && breed.price_set > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        <button onClick={() => addToOrder(breed, 'pair', 'mixed', selectedGrade)} className="flex flex-col items-center bg-slate-50 hover:bg-blue-600 hover:text-white py-2 rounded-lg transition-all">
                          <p className="text-[8px] font-black uppercase tracking-wider opacity-60">Pair</p>
                          <p className="font-black text-sm">฿{selectedGrade === 'premium' && breed.premium_price_pair ? breed.premium_price_pair : breed.price_pair}</p>
                        </button>
                        {breed.price_set && breed.price_set > 0 ? (
                          <button onClick={() => addToOrder(breed, 'set', 'mixed', selectedGrade)} className="flex flex-col items-center bg-slate-50 hover:bg-blue-600 hover:text-white py-2 rounded-lg transition-all">
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
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="mt-2 text-blue-600 text-xs font-bold"
                  >
                    ล้างการค้นหา
                  </button>
                </div>
              )}
              
              {/* Floating mobile/desktop cart */}
              {orderItems.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 z-50 transform transition-transform duration-300 translate-y-0 shadow-[0_-5px_40px_rgba(0,0,0,0.08)]">
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
                    <div className="flex items-center gap-2 sm:gap-3"><div className="p-2 bg-blue-600 rounded-xl"><ClipboardList className="h-4 w-4 text-white" /></div><span className="font-black text-base sm:text-lg text-slate-800 tracking-tight uppercase">Order Summary</span></div>
                    <div className="flex items-center gap-2 sm:gap-4">
                      {totalFishCount > 0 && (
                        <span className="text-xs sm:text-sm font-bold text-blue-600 bg-blue-50 px-3 sm:px-4 py-2 rounded-xl">🐟 {totalFishCount} ตัว</span>
                      )}
                      <button onClick={() => setOrderItems([])} className="h-8 px-3 bg-red-50 text-red-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0">Clear</button>
                    </div>
                  </div>
                  <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 max-h-[350px] sm:max-h-[450px] overflow-y-auto">
                    {groupedOrderItems.map(group => (
                      <div key={group.breedId} className="group">
                        {/* Header: Breed Name + Total */}
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

                        {/* Items Detail */}
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
                                    <span className="text-[10px] text-orange-500 font-bold bg-orange-100 px-2 py-0.5 rounded-full">
                                      👑 คัดเกรด
                                    </span>
                                  )}
                                  {item.freeQty ? (
                                    <span className="text-[10px] text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded-full">
                                      แถม {item.freeQty}
                                    </span>
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

                              {/* Discount & Free Qty Inputs */}
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
                                  {item.discount ? (
                                    <span className="text-[10px] text-green-500 font-bold">ประหยัด {item.discount} บาท</span>
                                  ) : null}
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
                    
                    {/* Customer Info & Save Order */}
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
        )}
      </main>
      )}
    </div>
  );
}
