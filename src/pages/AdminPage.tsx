import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Trash2,
  Edit2,
  X,
  Loader2,
  Copy,
  Check,
  Save
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
  
  // Edit state
  const [editingOrder, setEditingOrder] = useState<SavedOrder | null>(null);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editCopySuccess, setEditCopySuccess] = useState(false);

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
                      // wait for date selection
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
            
            {/* Custom Date Picker */}
            {reportPeriod === 'custom' && (
              <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100">
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
            
            {adminView === 'orders' ? (
              <>
                <div className="mb-4 text-sm text-slate-500">พบ {allOrders.length} รายการ</div>
                <div className="space-y-3">
                  {allOrders.map((order, index) => (
                    <div key={order.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-black text-blue-600">#{allOrders.length - index}</span>
                          <span className="text-sm text-slate-500">
                            {new Date(order.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xl text-blue-600">฿{(order.totalAmount || 0).toLocaleString()}</span>
                          <button onClick={() => { setEditingOrder(order); setIsEditingOrder(true); }} className="h-8 w-8 bg-blue-100 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg flex items-center justify-center transition-all" title="แก้ไข"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => deleteOrder(order.id)} className="h-8 w-8 bg-red-100 hover:bg-red-600 text-red-600 hover:text-white rounded-lg flex items-center justify-center transition-all" title="ลบ"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                      
                      {order.customerName && <p className="text-sm text-slate-600 mb-1">👤 {order.customerName}</p>}
                      <p className="text-xs text-slate-400">{(order.totalFish || 0)} ตัว • {(order.items?.length || 0)} รายการ</p>
                      
                      {order.note && <p className="text-xs text-slate-400 mt-2 italic">💬 {order.note}</p>}
                      
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <div className="space-y-2">
                          {order.items?.map((item: OrderItem, i: number) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-700">{item.breedName}</span>
                                {item.grade === 'premium' && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">👑 คัดเกรด</span>}
                                <span className="text-slate-500">{item.quantity} ตัว</span>
                                {(item.freeQty || 0) > 0 && <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">🎁 แถม {item.freeQty}</span>}
                                {(item.discount || 0) > 0 && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">ลด {item.discount}฿</span>}
                              </div>
                              <span className="font-bold text-slate-700">฿{((item.price * (item.quantity - (item.freeQty || 0))) - (item.discount || 0)).toLocaleString()}</span>
                            </div>
                          ))}
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
                  </div>
                  <div className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl text-white">
                    <p className="text-[10px] uppercase tracking-widest text-orange-100 mb-1">เฉลี่ย/บิล</p>
                    <p className="font-black text-3xl">฿{Math.round(dashboardStats.avgOrderValue).toLocaleString()}</p>
                  </div>
                </div>
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
                  const updatedItems = editingOrder.items || [];
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