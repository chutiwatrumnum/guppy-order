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
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast, Toaster } from 'sonner';
import type { Breed } from '../types';
import Layout from './Layout';
import FoodProducts from '../components/FoodProducts';

export default function SettingsPage() {
  // State
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [bankInfo, setBankInfo] = useState<any>({
    id: null,
    bank_name: 'กสิกรไทย',
    account_number: '',
    account_name: '',
    promptpay_id: '',
    shipping_fee: 60
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isBreedModalOpen, setIsBreedModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [editingBreed, setEditingBreed] = useState<Breed | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  const [editingCell, setEditingCell] = useState<{ breedId: string; field: keyof Breed } | null>(null);
  const [editValue, setEditValue] = useState('');

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
      toast.error('โหลดข้อมูลไม่สำเร็จ — ข้อมูลที่เห็นอาจไม่ครบ ลองรีเฟรชอีกครั้ง');
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
        promptpay_id: bankInfo.promptpay_id || null,
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
      premium_price_piece: Number(formData.get('premium_price_piece')) || 0,
      premium_price_pair: Number(formData.get('premium_price_pair')) || 0,
      premium_price_set: Number(formData.get('premium_price_set')) || 0,
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

  // Toggle sort: click same column flips direction, new column starts ascending
  const handleSort = (key: string) => {
    setSortConfig(prev =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  };

  // Start editing a single price/cost cell inline
  const startCellEdit = (breed: Breed, field: keyof Breed) => {
    setEditingCell({ breedId: breed.id, field });
    setEditValue(String((breed[field] as number) || ''));
  };

  // Save one inline cell to Supabase with optimistic UI update
  const saveCellEdit = async (breed: Breed, field: keyof Breed) => {
    const num = Number(editValue) || 0;
    setEditingCell(null);
    if (num === ((breed[field] as number) || 0)) return; // no change
    setBreeds(prev => prev.map(b => (b.id === breed.id ? { ...b, [field]: num } : b)));
    const { error } = await supabase.from('breeds').update({ [field]: num }).eq('id', breed.id);
    if (error) {
      toast.error('บันทึกไม่สำเร็จ');
      fetchData();
    } else {
      toast.success('อัปเดตแล้ว');
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

        {/* Search Bar */}
        <div className="mb-4 px-2">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาสายพันธุ์ปลา..."
              className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 pl-10 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-400 text-xs transition-colors"
                title="Clear Search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {(() => {
          const num = (v: unknown) => Number(v) || 0;
          const types = ['piece', 'pair', 'set'] as const;
          const priceField = (t: string) => `premium_price_${t}` as keyof Breed;
          const costField = (t: string) => `premium_cost_${t}` as keyof Breed;
          const profitOf = (b: Breed, t: string) => num(b[priceField(t)]) - num(b[costField(t)]);

          const filteredBreeds = breeds.filter(breed =>
            breed.name.toLowerCase().includes(searchTerm.toLowerCase())
          );

          // Sort by name or by profit of a given item type
          const sortedBreeds = [...filteredBreeds].sort((a, b) => {
            let av: number | string;
            let bv: number | string;
            if (sortConfig.key === 'name') {
              av = a.name.toLowerCase();
              bv = b.name.toLowerCase();
            } else {
              av = profitOf(a, sortConfig.key);
              bv = profitOf(b, sortConfig.key);
            }
            if (av < bv) return sortConfig.dir === 'asc' ? -1 : 1;
            if (av > bv) return sortConfig.dir === 'asc' ? 1 : -1;
            return 0;
          });

          // Summary numbers
          const missingCostCount = filteredBreeds.filter(b =>
            types.some(t => num(b[priceField(t)]) > 0 && num(b[costField(t)]) === 0)
          ).length;
          const pieceMargins = filteredBreeds
            .filter(b => num(b.premium_price_piece) > 0)
            .map(b => (profitOf(b, 'piece') / num(b.premium_price_piece)) * 100);
          const avgPieceMargin = pieceMargins.length
            ? Math.round(pieceMargins.reduce((s, m) => s + m, 0) / pieceMargins.length)
            : 0;

          if (filteredBreeds.length === 0) {
            return (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-12 text-center text-slate-400 font-bold">
                {searchTerm ? 'ไม่พบสายพันธุ์ที่ค้นหา' : 'ยังไม่มีสายพันธุ์ กดปุ่ม "เพิ่มสายพันธุ์" เพื่อเริ่มต้น'}
              </div>
            );
          }

          // An inline-editable number: click to edit, Enter/blur saves, Esc cancels
          const EditableNumber = ({ breed, field, children, className }: { breed: Breed; field: keyof Breed; children: React.ReactNode; className: string }) => {
            const isEditing = editingCell?.breedId === breed.id && editingCell?.field === field;
            if (isEditing) {
              return (
                <input
                  autoFocus
                  type="number"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onFocus={e => e.target.select()}
                  onBlur={() => saveCellEdit(breed, field)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveCellEdit(breed, field);
                    if (e.key === 'Escape') setEditingCell(null);
                  }}
                  className="w-16 h-6 text-right bg-blue-50 border border-blue-400 rounded-md px-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              );
            }
            return (
              <button
                onClick={() => startCellEdit(breed, field)}
                title="กดเพื่อแก้ไข"
                className={`rounded px-1 -mx-1 hover:bg-blue-100/60 transition-colors cursor-text ${className}`}
              >
                {children}
              </button>
            );
          };

          // Cell showing ราคาขาย / ต้นทุน / กำไร (+margin%) for one item type, all inline-editable
          const PriceCell = ({ breed, type }: { breed: Breed; type: string }) => {
            const p = num(breed[priceField(type)]);
            const c = num(breed[costField(type)]);
            const editingHere =
              editingCell?.breedId === breed.id &&
              (editingCell?.field === priceField(type) || editingCell?.field === costField(type));

            if (p === 0 && c === 0 && !editingHere) {
              return (
                <EditableNumber breed={breed} field={priceField(type)} className="text-slate-300 hover:text-blue-500 font-bold">
                  —
                </EditableNumber>
              );
            }

            const profit = p - c;
            const margin = p > 0 ? Math.round((profit / p) * 100) : 0;
            const missingCost = p > 0 && c === 0;

            return (
              <div className="flex flex-col items-end gap-0.5 leading-tight tabular-nums">
                <EditableNumber breed={breed} field={priceField(type)} className="font-black text-slate-800">
                  {p.toLocaleString()}
                </EditableNumber>
                <EditableNumber breed={breed} field={costField(type)} className={`text-[11px] font-bold ${missingCost ? 'text-amber-600' : 'text-slate-400'}`}>
                  ทุน {c.toLocaleString()}
                </EditableNumber>
                {missingCost ? (
                  <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" /> ยังไม่ใส่ทุน
                  </span>
                ) : (
                  <span className={`text-[11px] font-black ${profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {profit >= 0 ? '+' : ''}{profit.toLocaleString()}
                    <span className="text-slate-400 font-bold"> ({margin}%)</span>
                  </span>
                )}
              </div>
            );
          };

          // Sortable header with direction caret
          const SortHeader = ({ label, sortKey, align = 'right' }: { label: string; sortKey: string; align?: 'left' | 'right' }) => {
            const active = sortConfig.key === sortKey;
            return (
              <button
                onClick={() => handleSort(sortKey)}
                className={`flex items-center gap-1 w-full ${align === 'right' ? 'justify-end' : 'justify-start'} ${active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'} transition-colors`}
              >
                {label}
                {active ? (
                  sortConfig.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-30" />
                )}
              </button>
            );
          };

          return (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest">
                      <th className="py-3.5 px-4 sticky left-0 bg-slate-50 z-10"><SortHeader label="สายพันธุ์" sortKey="name" align="left" /></th>
                      <th className="py-3.5 px-4 whitespace-nowrap"><SortHeader label="ตัว" sortKey="piece" /></th>
                      <th className="py-3.5 px-4 whitespace-nowrap"><SortHeader label="คู่" sortKey="pair" /></th>
                      <th className="py-3.5 px-4 whitespace-nowrap"><SortHeader label="ชุด" sortKey="set" /></th>
                      <th className="text-right py-3.5 px-4 whitespace-nowrap text-slate-500">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sortedBreeds.map(breed => (
                      <tr key={breed.id} className="group hover:bg-blue-50/30 transition-colors">
                        <td className="py-3 px-4 sticky left-0 bg-white group-hover:bg-blue-50/30 transition-colors z-10">
                          <span className="font-black text-slate-800 whitespace-nowrap flex items-center gap-1.5">
                            <span className="text-orange-400">👑</span>{breed.name}
                          </span>
                        </td>
                        <td className="py-3 px-4"><PriceCell breed={breed} type="piece" /></td>
                        <td className="py-3 px-4"><PriceCell breed={breed} type="pair" /></td>
                        <td className="py-3 px-4"><PriceCell breed={breed} type="set" /></td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1.5 justify-end">
                            <button onClick={() => { setEditingBreed(breed); setIsBreedModalOpen(true); }} className="h-8 w-8 bg-slate-50 text-slate-400 hover:bg-white hover:text-blue-600 border border-transparent hover:border-slate-200 rounded-xl flex items-center justify-center active:scale-90 transition-all"><Edit2 className="h-3.5 w-3.5" /></button>
                            <button onClick={() => deleteBreed(breed.id)} className="h-8 w-8 bg-slate-50 text-slate-400 hover:bg-white hover:text-red-600 border border-transparent hover:border-slate-200 rounded-xl flex items-center justify-center active:scale-90 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center gap-x-5 gap-y-1.5 text-[11px] font-bold text-slate-500 flex-wrap">
                <span className="text-slate-600">ทั้งหมด <span className="text-slate-800 font-black">{filteredBreeds.length}</span> สายพันธุ์</span>
                <span>กำไรเฉลี่ย/ตัว <span className="text-emerald-600 font-black">{avgPieceMargin}%</span></span>
                {missingCostCount > 0 && (
                  <span className="flex items-center gap-1 text-amber-600 font-black">
                    <AlertTriangle className="h-3 w-3" /> ยังไม่ใส่ต้นทุน {missingCostCount} สายพันธุ์
                  </span>
                )}
                <span className="ml-auto text-slate-400 font-medium">กดหัวตารางเพื่อเรียง · กดตัวเลขเพื่อแก้ไขได้เลย</span>
              </div>
            </div>
          );
        })()}

        {/* อาหาร / สินค้าอื่นที่ไม่ใช่ปลา */}
        <FoodProducts />

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
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                    เลขพร้อมเพย์ <span className="text-blue-500">(สำหรับสร้าง QR)</span>
                  </label>
                  <input
                    value={bankInfo.promptpay_id || ''}
                    onChange={e => setBankInfo({ ...bankInfo, promptpay_id: e.target.value })}
                    placeholder="เบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl h-12 px-4 font-bold outline-none focus:border-blue-400"
                  />
                  <p className="text-[10px] text-slate-400 ml-1">ใส่แล้วระบบจะสร้าง QR พร้อมยอดเงินให้อัตโนมัติในหน้าสรุปออเดอร์</p>
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
                    {/* ราคาขาย */}
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