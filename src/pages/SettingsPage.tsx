import React, { useState, useEffect } from 'react';
import {
  Fish,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  CreditCard,
  Loader2,
  Settings2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast, Toaster } from 'sonner';
import { cn } from '../lib/utils';
import type { Breed } from '../types';
import Layout from './Layout';

export default function SettingsPage() {
  // State
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [bankInfo, setBankInfo] = useState<any>({
    id: null,
    bank_name: 'กสิกรไทย',
    account_number: '',
    account_name: '',
    shipping_fee: 60
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isBreedModalOpen, setIsBreedModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [editingBreed, setEditingBreed] = useState<Breed | null>(null);

  // Load Data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
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
      setIsLoading(false);
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
      setIsBankModalOpen(false);
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
      price_piece: Number(formData.get('price_piece')) || null,
      price_pair: Number(formData.get('price_pair')) || null,
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

  if (isLoading) {
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
        {/* Breeds Management */}
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="font-black text-xl flex items-center gap-3 tracking-tight text-slate-800"><Fish className="h-6 w-6 text-blue-600" /> จัดการสายพันธุ์ปลา</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsBankModalOpen(true)}
              className="h-10 px-4 bg-slate-700 hover:bg-slate-600 active:scale-95 transition-all text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2"
            >
              <CreditCard className="h-4 w-4" /> Bank
            </button>
            <button 
              onClick={() => { setEditingBreed(null); setIsBreedModalOpen(true); }} 
              className="h-10 px-4 bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> เพิ่มสายพันธุ์
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
          {breeds.map(breed => (
            <div key={breed.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col group hover:shadow-md hover:border-blue-100 transition-all">
              <div className="flex items-center gap-3.5 flex-1 min-w-0 mb-3">
                <div className="min-w-0 pr-2 w-full">
                   <h4 className="font-black text-base sm:text-lg text-slate-800 flex flex-wrap items-center gap-2">
                      <span className="break-words">{breed.name}</span>
                      {breed.premium_price_piece && <span className="shrink-0 bg-orange-100 text-orange-600 text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-md uppercase tracking-wider font-bold">👑</span>}
                   </h4>
                   <div className="flex flex-col gap-0.5 mt-1 text-[10px] sm:text-[11px]">
                     {(breed.premium_price_piece || 0) > 0 && (
                       <div className="flex items-center gap-1">
                         <span className="text-orange-400">👑</span>
                         <span className="font-bold text-orange-500">ตัว:{breed.premium_price_piece}</span>
                         {(breed.premium_price_pair || 0) > 0 && <span className="text-slate-300">|</span>}
                         {(breed.premium_price_pair || 0) > 0 && <span className="font-bold text-orange-500">คู่:{breed.premium_price_pair}</span>}
                         {(breed.premium_price_set || 0) > 0 && <span className="text-slate-300">|</span>}
                         {(breed.premium_price_set || 0) > 0 && <span className="font-bold text-orange-500">ชุด:{breed.premium_price_set}</span>}
                       </div>
                     )}
                     {(breed.price_piece || 0) > 0 && (
                       <div className="flex items-center gap-1">
                         <span className="text-slate-400">🐟</span>
                         <span className="font-bold text-blue-500">ตัว:{breed.price_piece}</span>
                         {(breed.price_pair || 0) > 0 && <span className="text-slate-300">|</span>}
                         {(breed.price_pair || 0) > 0 && <span className="font-bold text-blue-500">คู่:{breed.price_pair}</span>}
                         {(breed.price_set || 0) > 0 && <span className="text-slate-300">|</span>}
                         {(breed.price_set || 0) > 0 && <span className="font-bold text-blue-500">ชุด:{breed.price_set}</span>}
                       </div>
                     )}
                   </div>
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0 relative z-20">
                <button onClick={() => { setEditingBreed(breed); setIsBreedModalOpen(true); }} className="h-8 w-8 sm:h-9 sm:w-9 bg-slate-50 text-slate-400 hover:bg-white hover:text-blue-600 border border-transparent hover:border-slate-200 rounded-xl flex items-center justify-center active:scale-90 transition-all"><Edit2 className="h-3.5 w-3.5" /></button>
                <button onClick={() => deleteBreed(breed.id)} className="h-8 w-8 sm:h-9 sm:w-9 bg-slate-50 text-slate-400 hover:bg-white hover:text-red-600 border border-transparent hover:border-slate-200 rounded-xl flex items-center justify-center active:scale-90 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Bank Settings Modal */}
        {isBankModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-900">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-2xl">
                    <CreditCard className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="font-black text-xl text-white tracking-tight">Bank & Shipping</h2>
                    <p className="text-slate-400 text-sm">ตั้งค่าธนาคารและค่าจัดส่ง</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsBankModalOpen(false)}
                  className="h-12 w-12 bg-white/20 hover:bg-white/30 rounded-2xl flex items-center justify-center text-white transition-all"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ธนาคาร</label>
                  <input value={bankInfo.bank_name} onChange={e => setBankInfo({ ...bankInfo, bank_name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl h-12 px-4 font-bold outline-none focus:border-blue-400" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">เลขบัญชี</label>
                  <input value={bankInfo.account_number} onChange={e => setBankInfo({ ...bankInfo, account_number: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl h-12 px-4 font-bold outline-none focus:border-blue-400" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ชื่อบัญชี</label>
                  <input value={bankInfo.account_name} onChange={e => setBankInfo({ ...bankInfo, account_name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl h-12 px-4 font-bold outline-none focus:border-blue-400" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ค่าจัดส่ง</label>
                  <input type="number" value={bankInfo.shipping_fee} onChange={e => setBankInfo({ ...bankInfo, shipping_fee: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl h-12 px-4 font-black outline-none focus:border-blue-400" />
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setIsBankModalOpen(false)}
                  className="flex-1 h-14 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:border-slate-300 transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={saveSettings}
                  disabled={isSavingSettings}
                  className="flex-1 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all"
                >
                  {isSavingSettings ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  บันทึก
                </button>
              </div>
            </div>
          </div>
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
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">ชื่อสายพันธุ์ *</label>
                    <input name="name" defaultValue={editingBreed?.name} required placeholder="เช่น Full Gold" className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-5 font-bold focus:ring-2 focus:ring-blue-500/10 outline-none" />
                  </div>
                  
                  <div className="space-y-6">
                    {/* Premium Grade */}
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

                    {/* Normal Grade - Not Required */}
                    <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-200 shadow-sm space-y-4">
                      <p className="text-sm font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">🐟 เกรดปกติ (ไม่บังคับ)</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-3 p-4 bg-white rounded-[1.5rem] border border-slate-100 shadow-sm">
                          <p className="text-xs font-bold text-center text-slate-600 uppercase tracking-widest">Piece (ต่อตัว)</p>
                          <div className="space-y-2">
                            <div>
                              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">ราคาขาย</label>
                              <input name="price_piece" type="number" defaultValue={editingBreed?.price_piece || ''} placeholder="0" className="w-full h-11 bg-blue-50/30 border border-blue-100 rounded-xl px-4 font-black outline-none text-sm focus:border-blue-300" />
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
                              <input name="price_pair" type="number" defaultValue={editingBreed?.price_pair || ''} placeholder="0" className="w-full h-11 bg-blue-50/30 border border-blue-100 rounded-xl px-4 font-black outline-none text-sm focus:border-blue-300" />
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
                              <input name="price_set" type="number" defaultValue={editingBreed?.price_set || ''} placeholder="0" className="w-full h-11 bg-blue-50/30 border border-blue-100 rounded-xl px-4 font-black outline-none text-sm focus:border-blue-300" />
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
      </main>
    </Layout>
  );
}