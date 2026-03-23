import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Trash2,
  Edit2,
  X,
  Loader2,
  Copy,
  Check,
  Save,
  Plus,
  Minus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast, Toaster } from 'sonner';
import { cn } from '../lib/utils';
import { generateOrderMessage } from '../utils/message';
import type { OrderItem, SavedOrder, Breed } from '../types';
import Layout from './Layout';

export default function AdminPage() {
  // State
  const [allOrders, setAllOrders] = useState<SavedOrder[]>([]);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminView, setAdminView] = useState<'orders' | 'dashboard'>('orders');
  const [reportPeriod, setReportPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit state
  const [editingOrder, setEditingOrder] = useState<SavedOrder | null>(null);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editCopySuccess, setEditCopySuccess] = useState(false);
  const [editItems, setEditItems] = useState<OrderItem[]>([]);

  // Load data
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
      
      await loadAllOrders(reportPeriod);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

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

  // Dashboard stats
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
    
    // Breed stats
    const breedStats: { [key: string]: { name: string; qty: number; sales: number; isPremium?: boolean } } = {};
    allOrders.forEach(order => {
      order.items.forEach((item: OrderItem) => {
        const statKey = `${item.breedId}${item.grade === 'premium' ? '-premium' : '-normal'}`;
        
        if (!breedStats[statKey]) {
          breedStats[statKey] = { name: item.breedName, qty: 0, sales: 0, isPremium: item.grade === 'premium' };
        }
        const paidQty = item.quantity - (item.freeQty || 0);
        breedStats[statKey].qty += item.quantity;
        breedStats[statKey].sales += (item.price * paidQty) - (item.discount || 0);
      });
    });
    
    const topBreeds = Object.values(breedStats)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);
    
    // Customer stats
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

  // Order actions
  const updateOrder = async (orderId: string, updatedItems: OrderItem[], updatedCustomerName?: string, updatedNote?: string, updatedActualShippingFee?: number) => {
    try {
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
      
      setAllOrders(prev => prev.map(order => 
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

  // Edit items helpers
  const openEditModal = (order: SavedOrder) => {
    setEditingOrder(order);
    setEditItems(order.items || []);
    setIsEditingOrder(true);
  };

  const getItemPrice = (breedId: string, grade: string, type: string) => {
    if (!breedId) return 0;
    const breed = breeds.find((b: Breed) => b.id === breedId);
    if (!breed) return 0;
    if (grade === 'premium') {
      return type === 'piece' ? (breed.premium_price_piece || 0) 
        : type === 'pair' ? (breed.premium_price_pair || 0) 
        : (breed.premium_price_set || 0);
    }
    return type === 'piece' ? (breed.price_piece || 0) 
      : type === 'pair' ? (breed.price_pair || 0) 
      : (breed.price_set || 0);
  };

  const addEditItem = (breedId: string) => {
    const breed = breeds.find((b: Breed) => b.id === breedId);
    if (!breed) return;
    const newItem: OrderItem = {
      id: '',
      breedId,
      breedName: breed.name,
      price: breed.price_piece || 0,
      quantity: 1,
      grade: 'normal',
      type: 'piece',
      gender: 'male',
      freeQty: 0,
      discount: 0
    };
    setEditItems([...editItems, newItem]);
  };

  const removeEditItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const updateEditItem = (index: number, field: keyof OrderItem, value: any) => {
    const updated = [...editItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-update price when breed/grade/type changes
    if (field === 'breedId' || field === 'grade' || field === 'type') {
      const item = updated[index];
      if (item.breedId) {
        updated[index].price = getItemPrice(item.breedId, item.grade, item.type);
      }
    }
    
    setEditItems(updated);
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-blue-600 font-bold uppercase tracking-widest text-xs">
          <Loader2 className="h-10 w-10 animate-spin mb-4" /> Loading...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Toaster position="top-center" richColors />
      <main className="max-w-6xl mx-auto p-4 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-slate-100 overflow-hidden flex flex-col min-h-[75vh]">
          {/* Header */}
          <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="font-black text-2xl text-slate-800 tracking-tight flex items-center gap-3">
                 <ClipboardList className="h-6 w-6 text-blue-600" />
                 Admin Dashboard
              </h2>
              <p className="text-slate-500 text-sm mt-1">จัดการออเดอร์ & ดูรายงานสรุปผล</p>
            </div>
            {/* Period Selector - moved to header */}
            <div className="flex flex-wrap gap-2">
              {(['today', 'week', 'month', 'year', 'custom'] as const).map(period => (
                <button
                  key={period}
                  onClick={() => { 
                    setReportPeriod(period); 
                    if (period !== 'custom') {
                      loadAllOrders(period); 
                    }
                  }}
                  className={`px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${
                    reportPeriod === period 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {period === 'today' && 'วันนี้'}
                  {period === 'week' && '7 วัน'}
                  {period === 'month' && 'เดือนนี้'}
                  {period === 'year' && 'ปีนี้'}
                  {period === 'custom' && 'เลือกวัน'}
                </button>
              ))}
            </div>
          </div>
          
          {/* Custom Date Picker - moved here after header */}
          {reportPeriod === 'custom' && (
            <div className="p-4 mx-6 mt-4 bg-blue-50 rounded-2xl border border-blue-100">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-2">จากวันที่</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 px-3 bg-white border border-blue-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-2">ถึงวันที่</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 px-3 bg-white border border-blue-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-400" />
                </div>
                <button onClick={() => loadAllOrders('custom', startDate, endDate)} disabled={!startDate || !endDate} className="h-10 px-6 bg-blue-600 disabled:bg-slate-300 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all">
                  ดูรายงาน
                </button>
              </div>
            </div>
          )}
          
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
            {adminView === 'orders' ? (
              <>
                {/* Search Bar */}
                <div className="mb-4">
                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="ค้นหาออเดอร์..."
                      className="w-full h-10 bg-white border border-slate-200 rounded-xl px-4 pl-10 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
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
                </div>
                
                {/* Filtered Orders */}
                {(() => {
                  const filteredOrders = searchTerm.trim() 
                    ? allOrders.filter(order => {
                        const term = searchTerm.toLowerCase();
                        const matchCustomer = order.customerName?.toLowerCase().includes(term);
                        const matchItems = order.items?.some((item: OrderItem) => 
                          item.breedName?.toLowerCase().includes(term)
                        );
                        const matchNote = order.note?.toLowerCase().includes(term);
                        const matchId = order.id?.toLowerCase().includes(term);
                        return matchCustomer || matchItems || matchNote || matchId;
                      })
                    : allOrders;
                  
                  return (
                    <div>
                      <div className="mb-4 text-sm text-slate-500">พบ {filteredOrders.length} รายการ {searchTerm && `(จาก ${allOrders.length} รายการ)`}</div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {filteredOrders.map((order, index) => {
                          // Calculate cost for each order
                          const orderCost = order.items?.reduce((sum: number, item: OrderItem) => {
                            const breed = breeds.find((b: Breed) => b.id === item.breedId);
                            let cost = 0;
                            if (breed) {
                              cost = item.type === 'piece' 
                                ? (item.grade === 'premium' ? (breed.premium_cost_piece || 0) : (breed.cost_piece || 0))
                                : item.type === 'pair'
                                ? (item.grade === 'premium' ? (breed.premium_cost_pair || 0) : (breed.cost_pair || 0))
                                : (item.grade === 'premium' ? (breed.premium_cost_set || 0) : (breed.cost_set || 0));
                            }
                            return sum + (cost * item.quantity);
                          }, 0) || 0;
                          const shippingFee = order.shippingFee || 60;
                          const actualShipping = order.actualShippingFee !== undefined && order.actualShippingFee !== null ? order.actualShippingFee : shippingFee;
                          const orderProfit = (order.totalAmount || 0) - orderCost - actualShipping;
                          
                          return (
                          <div key={order.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:shadow-md transition-all">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span className="text-xl font-black text-blue-600">#{allOrders.length - index}</span>
                                <span className="text-sm text-slate-500">
                                  {new Date(order.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-2xl text-blue-600">฿{(order.totalAmount || 0).toLocaleString()}</span>
                              </div>
                            </div>
                            
                            {order.customerName && <p className="text-sm text-slate-600 mb-2">👤 {order.customerName}</p>}
                            <p className="text-xs text-slate-400">🐟 {(order.totalFish || 0)} ตัว • 📋 {(order.items?.length || 0)} รายการ</p>
                            
                            {order.note && <p className="text-xs text-slate-400 mt-2 italic">💬 {order.note}</p>}
                            
                            <div className="mt-3 pt-3 border-t border-slate-200">
                              <div className="space-y-1.5">
                                {order.items?.map((item: OrderItem, i: number) => {
                                  const breed = breeds.find((b: Breed) => b.id === item.breedId);
                                  const cost = breed 
                                    ? (item.type === 'piece' 
                                        ? (item.grade === 'premium' ? (breed.premium_cost_piece || 0) : (breed.cost_piece || 0))
                                        : item.type === 'pair'
                                        ? (item.grade === 'premium' ? (breed.premium_cost_pair || 0) : (breed.cost_pair || 0))
                                        : (item.grade === 'premium' ? (breed.premium_cost_set || 0) : (breed.cost_set || 0)))
                                    : 0;
                                  const itemRevenue = (item.price * (item.quantity - (item.freeQty || 0))) - (item.discount || 0);
                                  const itemCost = cost * item.quantity;
                                  const itemProfit = itemRevenue - itemCost;
                                  
                                  return (
                                  <div key={i} className="flex items-center justify-between text-sm bg-white/50 rounded-lg px-2 py-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-medium text-slate-700 text-xs">{item.breedName}</span>
                                      {item.grade === 'premium' && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold">👑</span>}
                                      <span className="text-slate-400 text-xs">x{item.quantity}</span>
                                      {(item.freeQty || 0) > 0 && <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded">+{item.freeQty}</span>}
                                      {(item.discount || 0) > 0 && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">-{item.discount}</span>}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px]">
                                      <span className="text-slate-500">ขาย <span className="font-bold text-green-600">{itemRevenue}</span></span>
                                      <span className="text-slate-300">|</span>
                                      <span className="text-slate-500">ทุน <span className="font-bold text-red-400">{itemCost}</span></span>
                                      <span className="text-slate-300">|</span>
                                      <span className={`font-bold ${itemProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        กำไร {itemProfit}
                                      </span>
                                    </div>
                                  </div>
                                )})}
                              </div>
                            </div>
                            
                            {/* Cost Summary - Simplified */}
                            <div className="mt-3 pt-3 border-t border-slate-200 bg-orange-50/50 rounded-xl p-3">
                              {/* Row 1: Revenue breakdown */}
                              <div className="flex items-center gap-2 text-xs mb-2">
                                <span className="text-slate-500">ราคาขาย</span>
                                <span className="font-black text-green-600">฿{order.totalAmount}</span>
                                <span className="text-slate-300">=</span>
                                <span className="text-slate-400">ปลา {order.totalAmount - shippingFee}</span>
                                <span className="text-slate-300">+</span>
                                <span className="text-slate-400">ค่าส่งลูกค้า ฿{shippingFee}</span>
                              </div>
                              
                              {/* Row 2: Cost breakdown */}
                              <div className="flex items-center gap-2 text-xs mb-2">
                                <span className="text-slate-500">หัก:</span>
                                <span className="text-slate-400">ต้นทุนปลา <span className="font-bold text-red-500">฿{orderCost}</span></span>
                                <span className="text-slate-300">+</span>
                                <button 
                                  onClick={() => { setEditingOrder(order); setIsEditingOrder(true); }}
                                  className="text-slate-400 hover:text-orange-700 cursor-pointer"
                                >
                                  ค่าส่งจริง <span className="font-bold text-orange-500">฿{actualShipping}</span>
                                </button>
                              </div>
                              
                              {/* Row 3: Profit */}
                              <div className="flex items-center justify-between pt-2 border-t border-orange-100">
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="font-bold text-slate-600">กำไรปลา:</span>
                                  <span className={`font-black ${(order.totalAmount - shippingFee - orderCost) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    ฿{order.totalAmount - shippingFee - orderCost}
                                  </span>
                                  <span className="text-slate-300">|</span>
                                  <span className="font-bold text-slate-600">กำไรค่าส่ง:</span>
                                  <span className={`font-black ${(shippingFee - actualShipping) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    ฿{shippingFee - actualShipping}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-600">= กำไรสุทธิ:</span>
                                  <span className={`font-black text-xl ${orderProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    ฿{orderProfit.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="mt-4 pt-3 border-t border-slate-200 flex justify-end gap-2">
                              <button onClick={() => { setEditingOrder(order); setEditItems(order.items || []); setIsEditingOrder(true); }} className="h-9 px-4 bg-blue-100 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg flex items-center justify-center gap-2 transition-all text-sm font-bold" title="แก้ไข">
                                <Edit2 className="h-4 w-4" /> แก้ไข
                              </button>
                              <button onClick={() => deleteOrder(order.id)} className="h-9 px-4 bg-red-100 hover:bg-red-600 text-red-600 hover:text-white rounded-lg flex items-center justify-center gap-2 transition-all text-sm font-bold" title="ลบ">
                                <Trash2 className="h-4 w-4" /> ลบ
                              </button>
                            </div>
                          </div>
                        )})}
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                {/* Dashboard Stats - Revenue & Profit */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="p-5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl text-white">
                    <p className="text-[10px] uppercase tracking-widest text-blue-100 mb-1">จำนวนบิล</p>
                    <p className="font-black text-3xl">{dashboardStats.totalOrders}</p>
                  </div>
                  <div className="p-5 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl text-white">
                    <p className="text-[10px] uppercase tracking-widest text-green-100 mb-1">ยอดขายรวม</p>
                    <p className="font-black text-3xl">฿{dashboardStats.totalSales.toLocaleString()}</p>
                  </div>
                  <div className="p-5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl text-white">
                    <p className="text-[10px] uppercase tracking-widest text-indigo-100 mb-1">กำไรสุทธิ</p>
                    <p className="font-black text-3xl">฿{dashboardStats.totalProfit.toLocaleString()}</p>
                  </div>
                  <div className="p-5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl text-white">
                    <p className="text-[10px] uppercase tracking-widest text-purple-100 mb-1">จำนวนปลาทั้งหมด</p>
                    <p className="font-black text-3xl">{dashboardStats.totalFish}</p>
                  </div>
                  <div className="p-5 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl text-white">
                    <p className="text-[10px] uppercase tracking-widest text-orange-100 mb-1">เฉลี่ย/บิล</p>
                    <p className="font-black text-3xl">฿{Math.round(dashboardStats.avgOrderValue).toLocaleString()}</p>
                  </div>
                </div>

                {/* Cost Breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="p-5 bg-white border-2 border-slate-200 rounded-2xl">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">ต้นทุนปลา</p>
                    <p className="font-black text-2xl text-slate-700">฿{dashboardStats.totalFishCost.toLocaleString()}</p>
                  </div>
                  <div className="p-5 bg-white border-2 border-slate-200 rounded-2xl">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">รายได้ค่าส่ง</p>
                    <p className="font-black text-2xl text-green-600">฿{dashboardStats.totalShippingIncome.toLocaleString()}</p>
                    <p className="text-xs text-slate-400 mt-1">จ่ายจริง ฿{dashboardStats.totalShippingCost.toLocaleString()}</p>
                  </div>
                  <div className="p-5 bg-white border-2 border-slate-200 rounded-2xl">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">กำไรค่าส่ง</p>
                    <p className="font-black text-2xl text-green-600">฿{(dashboardStats.totalShippingIncome - dashboardStats.totalShippingCost).toLocaleString()}</p>
                  </div>
                  <div className="p-5 bg-white border-2 border-slate-200 rounded-2xl">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">ยอดรวมสุทธิ</p>
                    <p className="font-black text-2xl text-indigo-600">฿{(dashboardStats.totalSales - dashboardStats.totalFishCost - dashboardStats.totalShippingCost).toLocaleString()}</p>
                  </div>
                </div>

                {/* Fish Count by Grade */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-5 bg-orange-50 border-2 border-orange-100 rounded-2xl">
                    <p className="text-xs uppercase tracking-widest text-orange-600 font-bold mb-2">👑 ปลาคัดเกรด</p>
                    <p className="font-black text-3xl text-orange-600">{dashboardStats.totalFishPremium} <span className="text-sm font-bold text-orange-400">ตัว</span></p>
                  </div>
                  <div className="p-5 bg-blue-50 border-2 border-blue-100 rounded-2xl">
                    <p className="text-xs uppercase tracking-widest text-blue-600 font-bold mb-2">🐟 ปลาเกรดปกติ</p>
                    <p className="font-black text-3xl text-blue-600">{dashboardStats.totalFishNormal} <span className="text-sm font-bold text-blue-400">ตัว</span></p>
                  </div>
                </div>

                {/* Top Breeds */}
                {dashboardStats.topBreeds.length > 0 && (
                  <div className="mb-8">
                    <h3 className="font-black text-lg text-slate-800 mb-4">🏆 สายพันธุ์ขายดี</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {dashboardStats.topBreeds.map((breed: any, idx: number) => (
                        <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{breed.isPremium ? '👑' : '🐟'}</span>
                            <span className="font-bold text-xs text-slate-600 truncate">{breed.name}</span>
                          </div>
                          <p className="font-black text-lg text-slate-800">฿{breed.sales.toLocaleString()}</p>
                          <p className="text-xs text-slate-400">{breed.qty} ตัว</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Customers */}
                {dashboardStats.topCustomers.length > 0 && (
                  <div>
                    <h3 className="font-black text-lg text-slate-800 mb-4">👥 ลูกค้าประจำ</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {dashboardStats.topCustomers.map((customer: any, idx: number) => (
                        <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <p className="font-bold text-xs text-slate-600 truncate">{customer.name}</p>
                          <p className="font-black text-lg text-slate-800">฿{customer.totalSpent.toLocaleString()}</p>
                          <p className="text-xs text-slate-400">{customer.orders} บิล • {customer.totalFish} ตัว</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Edit Order Modal */}
      {isEditingOrder && editingOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-orange-500 to-orange-600">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl"><Edit2 className="h-6 w-6 text-white" /></div>
                <div>
                  <h2 className="font-black text-xl text-white tracking-tight">แก้ไขออเดอร์</h2>
                  <p className="text-orange-200 text-sm">#{editingOrder.id?.slice(-6)}</p>
                </div>
              </div>
              <button onClick={() => { setIsEditingOrder(false); setEditingOrder(null); }} className="h-12 w-12 bg-white/20 hover:bg-white/30 rounded-2xl flex items-center justify-center text-white transition-all"><X className="h-6 w-6" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">ชื่อลูกค้า</label>
                <input type="text" defaultValue={editingOrder.customerName} id="edit-customer-name" className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-700 outline-none focus:border-blue-400" placeholder="ชื่อลูกค้า" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">หมายเหตุ</label>
                <input type="text" defaultValue={editingOrder.note} id="edit-order-note" className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-700 outline-none focus:border-blue-400" placeholder="หมายเหตุ" />
              </div>
              <div>
                <label className="text-xs font-bold text-orange-500 uppercase tracking-wider block mb-2">🚚 ค่าจัดส่งจริง (ต้นทุนที่เสียไป)</label>
                <input type="number" defaultValue={editingOrder.actualShippingFee !== undefined ? editingOrder.actualShippingFee : (editingOrder.shippingFee || 60)} id="edit-actual-shipping-fee" className="w-full h-12 bg-orange-50 border border-orange-200 rounded-xl px-4 font-bold text-orange-700 outline-none focus:border-orange-400" />
              </div>
              
              {/* Edit Items Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-blue-500 uppercase tracking-wider block">🐟 รายการปลา</label>
                  <select
                    onChange={(e) => { if (e.target.value) { addEditItem(e.target.value); e.target.value = ''; } }}
                    className="h-9 bg-blue-50 border border-blue-200 rounded-lg px-3 text-sm font-bold text-blue-600 outline-none focus:border-blue-400"
                    value=""
                  >
                    <option value="">+ เพิ่มปลา</option>
                    {breeds.map((breed: Breed) => (
                      <option key={breed.id} value={breed.id}>{breed.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {editItems.map((item: OrderItem, idx: number) => {
                    const breed = breeds.find((b: Breed) => b.id === item.breedId);
                    return (
                      <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <select
                            value={item.breedId}
                            onChange={(e) => updateEditItem(idx, 'breedId', e.target.value)}
                            className="h-8 bg-white border border-slate-200 rounded-lg px-2 text-sm font-bold text-slate-700 outline-none"
                          >
                            {breeds.map((b: Breed) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          <button onClick={() => removeEditItem(idx)} className="h-8 w-8 bg-red-100 hover:bg-red-500 text-red-500 hover:text-white rounded-lg flex items-center justify-center transition-all">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 block">เกรด</label>
                            <select
                              value={item.grade}
                              onChange={(e) => updateEditItem(idx, 'grade', e.target.value)}
                              className="w-full h-8 bg-white border border-slate-200 rounded-lg px-1 text-xs font-bold text-slate-700"
                            >
                              <option value="normal">ธรรมดา</option>
                              <option value="premium">👑 พรีเมียม</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block">ชนิด</label>
                            <select
                              value={item.type}
                              onChange={(e) => updateEditItem(idx, 'type', e.target.value)}
                              className="w-full h-8 bg-white border border-slate-200 rounded-lg px-1 text-xs font-bold text-slate-700"
                            >
                              <option value="piece">ตัว</option>
                              <option value="pair">คู่</option>
                              <option value="set">ชุด</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block">จำนวน</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateEditItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-full h-8 bg-white border border-slate-200 rounded-lg px-2 text-xs font-bold text-slate-700 text-center"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block">ราคา</label>
                            <input
                              type="number"
                              value={item.price}
                              onChange={(e) => updateEditItem(idx, 'price', parseInt(e.target.value) || 0)}
                              className="w-full h-8 bg-white border border-slate-200 rounded-lg px-2 text-xs font-bold text-green-600 text-center"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <label className="text-[10px] text-slate-400 block">แถม</label>
                            <input
                              type="number"
                              min="0"
                              value={item.freeQty || 0}
                              onChange={(e) => updateEditItem(idx, 'freeQty', parseInt(e.target.value) || 0)}
                              className="w-full h-8 bg-white border border-slate-200 rounded-lg px-2 text-xs font-bold text-slate-700"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block">ส่วนลด</label>
                            <input
                              type="number"
                              min="0"
                              value={item.discount || 0}
                              onChange={(e) => updateEditItem(idx, 'discount', parseInt(e.target.value) || 0)}
                              className="w-full h-8 bg-white border border-slate-200 rounded-lg px-2 text-xs font-bold text-slate-700"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {editItems.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-4">ยังไม่มีรายการปลา</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 space-y-3">
              <button
                onClick={() => {
                  const message = generateOrderMessage(
                    editingOrder.items || [],
                    editingOrder.totalFish || 0,
                    editingOrder.totalAmount || 0,
                    (document.getElementById('edit-customer-name') as HTMLInputElement)?.value,
                    (document.getElementById('edit-order-note') as HTMLInputElement)?.value,
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
                className={cn("h-12 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2", editCopySuccess ? "bg-blue-600 border-blue-600 text-white" : "bg-white text-slate-600 border-slate-200")}
              >
                {editCopySuccess ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {editCopySuccess ? 'Copied!' : 'Copy Message'}
              </button>
              <button
                onClick={() => {
                  const updatedItems = editItems;
                  const updatedCustomerName = (document.getElementById('edit-customer-name') as HTMLInputElement)?.value;
                  const updatedNote = (document.getElementById('edit-order-note') as HTMLInputElement)?.value;
                  const updatedActualShippingFee = (document.getElementById('edit-actual-shipping-fee') as HTMLInputElement)?.value ? Number((document.getElementById('edit-actual-shipping-fee') as HTMLInputElement)?.value) : undefined;
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
    </Layout>
  );
}