import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Loader2, 
  Search,
  Phone,
  MapPin,
  Save
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast, Toaster } from 'sonner';
import Layout from './Layout';

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  points: number;
  total_orders: number;
  total_spent: number;
  created_at: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Fetch customers error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        address: customer.address || ''
      });
    } else {
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', address: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', address: '' });
  };

  const saveCustomer = async () => {
    if (!formData.name.trim()) {
      toast.error('กรุณากรอกชื่อลูกค้า');
      return;
    }

    if (!formData.phone.trim()) {
      toast.error('กรุณากรอกเบอร์โทรศัพท์');
      return;
    }

    try {
      if (editingCustomer) {
        // Update existing
        const { error } = await supabase
          .from('customers')
          .update({
            name: formData.name,
            phone: formData.phone || null,
            address: formData.address || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCustomer.id);
        
        if (error) throw error;
        toast.success('แก้ไขลูกค้าสำเร็จ');
      } else {
        // Create new
        const { error } = await supabase
          .from('customers')
          .insert({
            name: formData.name,
            phone: formData.phone || null,
            address: formData.address || null
          });
        
        if (error) throw error;
        toast.success('เพิ่มลูกค้าสำเร็จ');
      }
      
      closeModal();
      fetchCustomers();
    } catch (err) {
      console.error('Save customer error:', err);
      toast.error('ไม่สำเร็จ กรุณาลองอีกครั้ง');
    }
  };

  const deleteCustomer = async (id: string) => {
    if (!confirm('ต้องการลบลูกค้านี้ใช่หรือไม่?')) return;
    
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('ลบลูกค้าสำเร็จ');
      fetchCustomers();
    } catch (err) {
      console.error('Delete customer error:', err);
      toast.error('ลบไม่สำเร็จ');
    }
  };

  const filteredCustomers = searchTerm.trim()
    ? customers.filter(c => 
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
      )
    : customers;

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
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="font-black text-2xl text-slate-800 tracking-tight flex items-center gap-3">
                <Users className="h-6 w-6 text-blue-600" />
                ลูกค้าประจำ
              </h2>
              <p className="text-slate-500 text-sm mt-1">จัดการข้อมูลลูกค้า</p>
            </div>
            <button
              onClick={() => openModal()}
              className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-sm tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-5 w-5" />
              เพิ่มลูกค้า
            </button>
          </div>

          {/* Search */}
          <div className="p-6 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาลูกค้า..."
                className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 pl-12 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* Customer List */}
          <div className="p-6">
            <div className="text-sm text-slate-500 mb-4">
              พบ {filteredCustomers.length} รายการ
            </div>
            
            <div className="space-y-3">
              {filteredCustomers.map((customer) => (
                <div 
                  key={customer.id} 
                  className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-lg text-slate-800 truncate">
                        {customer.name}
                      </h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                        {customer.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            {customer.phone}
                          </span>
                        )}
                        {customer.address && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="w-4 h-4" />
                            {customer.address}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        <span>📋 {customer.total_orders || 0} ออเดอร์</span>
                        <span>💰 ฿{(customer.total_spent || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => openModal(customer)}
                        className="h-9 px-3 bg-blue-100 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg flex items-center justify-center gap-1 transition-all text-sm font-bold"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteCustomer(customer.id)}
                        className="h-9 px-3 bg-red-100 hover:bg-red-600 text-red-600 hover:text-white rounded-lg flex items-center justify-center gap-1 transition-all text-sm font-bold"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredCustomers.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>ยังไม่มีลูกค้า</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-500 to-blue-600">
              <h2 className="font-black text-xl text-white">
                {editingCustomer ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้าใหม่'}
              </h2>
              <button 
                onClick={closeModal}
                className="h-10 w-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  ชื่อลูกค้า *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="กรอกชื่อลูกค้า"
                  className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-700 outline-none focus:border-blue-400"
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  เบอร์โทร *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formData.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d]/g, '');
                    setFormData({ ...formData, phone: value });
                  }}
                  placeholder="กรอกเบอร์โทร"
                  className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold text-slate-700 outline-none focus:border-blue-400"
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  ที่อยู่
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="กรอกที่อยู่"
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-400 resize-none"
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50">
              <button
                onClick={saveCustomer}
                className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <Save className="h-5 w-5" />
                {editingCustomer ? 'บันทึกการแก้ไข' : 'เพิ่มลูกค้า'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
