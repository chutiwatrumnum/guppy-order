"use client";

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
  X, 
  Edit2, 
  Check, 
  Loader2, 
  CreditCard, 
  TrendingUp, 
  User as UserIcon,
  LogOut,
  Lock,
  Hash,
  ShoppingCart,
  ChevronRight
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Sophisticated Minimal UI Components ---
const Card = ({ children, className }: any) => (
  <div className={cn("bg-white rounded-[2rem] shadow-lg shadow-slate-200/50 border border-slate-100", className)}>
    {children}
  </div>
);

const Button = ({ children, className, variant = "primary", ...props }: any) => {
  const variants: any = {
    primary: "bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-lg shadow-blue-500/20",
    dark: "bg-[#1E293B] hover:bg-black text-white shadow-lg shadow-slate-900/10",
    outline: "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50",
    ghost: "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
  };
  return (
    <button className={cn("disabled:opacity-50 active:scale-95 transition-all rounded-2xl font-bold flex items-center justify-center gap-2 h-12 md:h-14 px-6 shadow-md", variants[variant], className)} {...props}>
      {children}
    </button>
  );
};

const Input = ({ className, ...props }: any) => (
  <input 
    className={cn("w-full h-12 bg-slate-50 border border-slate-100 focus:border-blue-500 focus:bg-white text-slate-900 font-semibold rounded-xl px-4 outline-none transition-all placeholder:text-slate-300", className)}
    {...props} 
  />
);

const DarkInput = ({ className, ...props }: any) => (
  <input 
    className={cn("w-full h-12 bg-[#0F172A] border border-slate-800 text-white font-bold rounded-xl px-4 outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600", className)}
    {...props} 
  />
);

const Label = ({ children, className }: any) => (
  <label className={cn("text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block", className)}>
    {children}
  </label>
);

function ShoppingCartIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

// --- Auth Section ---
function AuthScreen() {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { data, error } = await supabase
          .from('app_users')
          .select('*')
          .eq('username', username.trim().toLowerCase())
          .eq('password', password)
          .single();
        if (error || !data) throw new Error('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
        login({ id: data.id, username: data.username, shop_name: data.shop_name });
        toast.success('ยินดีต้อนรับกลับมาครับ');
      } else {
        const { data, error } = await supabase
          .from('app_users')
          .insert([{ username: username.trim().toLowerCase(), password: password, shop_name: shopName }])
          .select().single();
        if (error) throw new Error('ชื่อผู้ใช้นี้ถูกใช้ไปแล้วครับ');
        login({ id: data.id, username: data.username, shop_name: data.shop_name });
        toast.success('สร้างบัญชีสำเร็จแล้วครับ!');
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-12 text-center text-slate-900">
          <div className="p-4 bg-[#2563EB] rounded-[1.5rem] shadow-xl shadow-blue-500/30 mb-5 transform -rotate-6">
            <Fish className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic leading-none">GuppyReal</h1>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mt-2 leading-none ml-1">ระบบจัดการฟาร์มปลาออนไลน์</p>
        </div>

        <Card className="p-10 border-slate-200">
          <div className="flex p-1.5 bg-slate-100 rounded-2xl mb-10">
            <button onClick={() => setIsLogin(true)} className={cn("flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", isLogin ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400')}>เข้าสู่ระบบ</button>
            <button onClick={() => setIsLogin(false)} className={cn("flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", !isLogin ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400')}>สมัครสมาชิก</button>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {!isLogin && (
              <div className="space-y-2">
                <Label>ชื่อร้าน / ชื่อฟาร์ม</Label>
                <div className="relative group">
                  <Fish className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                  <Input placeholder="เช่น เจมส์ Guppy" value={shopName} onChange={(e: any) => setShopName(e.target.value)} required className="pl-12" />
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>ชื่อผู้ใช้งาน (Username)</Label>
              <div className="relative group">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                <Input placeholder="Username" value={username} onChange={(e: any) => setUsername(e.target.value)} required className="pl-12" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>รหัสผ่าน</Label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                <Input type="password" placeholder="••••••••" value={password} onChange={(e: any) => setPassword(e.target.value)} required className="pl-12" />
              </div>
            </div>

            <Button type="submit" className="w-full h-14 mt-4 text-xs uppercase tracking-[0.2em]" disabled={loading}>
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (isLogin ? 'ยืนยันเพื่อเข้าสู่ระบบ' : 'สร้างบัญชีของฉัน')}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

// --- Main App ---
function GuppyApp() {
  const { logout, user } = useAuth();
  const [breeds, setBreeds] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [bankInfo, setBankInfo] = useState<any>({ id: null, bank_name: '', account_number: '', account_name: '', shipping_fee: 60 });
  const [isManagingBreeds, setIsManagingBreeds] = useState(false);
  const [editingBreed, setEditingBreed] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: bData } = await supabase.from('breeds').select('*').order('name');
      setBreeds(bData || []);
      const { data: sData } = await supabase.from('settings').select('*').limit(1);
      if (sData && sData.length > 0) setBankInfo(sData[0]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const payload = { bank_name: bankInfo.bank_name, account_number: bankInfo.account_number, account_name: bankInfo.account_name, shipping_fee: Number(bankInfo.shipping_fee) };
      let err;
      if (bankInfo.id) {
        const { error } = await supabase.from('settings').update(payload).eq('id', bankInfo.id);
        err = error;
      } else {
        const { error } = await supabase.from('settings').insert([payload]);
        err = error;
      }
      if (err) throw err;
      toast.success('บันทึกการตั้งค่าแล้ว');
      fetchData();
    } catch (err) { toast.error('ล้มเหลว'); }
    finally { setIsSavingSettings(false); }
  };

  const addToOrder = (breedName: string, type: 'piece' | 'pair', price: number) => {
    setOrderItems(prev => {
      const existingItem = prev.find(item => item.breedName === breedName && item.type === type);
      if (existingItem) {
        return prev.map(item => 
          (item.breedName === breedName && item.type === type) 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      } else {
        return [...prev, { id: Date.now().toString(), breedName, type, quantity: 1, price }];
      }
    });
    toast.success(`เพิ่ม ${breedName} (${type === 'piece' ? 'ตัว' : 'คู่'})`);
  };

  const totalFishPrice = useMemo(() => orderItems.reduce((s, i) => s + (i.price * i.quantity), 0), [orderItems]);
  const grandTotal = totalFishPrice + (orderItems.length > 0 ? bankInfo.shipping_fee : 0);

  const lineMessage = useMemo(() => {
    if (orderItems.length === 0) return '';
    let t = `🐠 สรุปยอดสั่งซื้อปลาครับ\n----------------------------\n`;
    orderItems.forEach((i, idx) => { t += `${idx + 1}. ${i.breedName}: ${i.quantity} ${i.type === 'piece' ? 'ตัว' : 'คู่'} (${(i.price * i.quantity).toLocaleString()}.-)\n`; });
    t += `----------------------------\n💰 ยอดรวม: ${grandTotal.toLocaleString()} บาท\n🚚 (รวมค่าส่ง ${bankInfo.shipping_fee}.- แล้ว)\n----------------------------\n🏦 ชำระได้ที่: ${bankInfo.bank_name}\nเลขบัญชี: ${bankInfo.account_number}\nชื่อบัญชี: ${bankInfo.account_name}\n----------------------------\nแจ้งสลิปและที่อยู่ได้เลยครับ 🙏✨`;
    return t;
  }, [orderItems, grandTotal, bankInfo]);

  if (loading && breeds.length === 0) return <div className="min-h-screen flex flex-col items-center justify-center bg-white"><Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" /><p className="font-black text-slate-400 uppercase tracking-widest text-xs leading-none text-center">กำลังเชื่อมต่อฐานข้อมูล...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 md:px-8 py-4 md:py-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="p-2 md:p-2.5 bg-blue-600 rounded-xl md:rounded-2xl shadow-lg transform -rotate-6"><Fish className="h-5 w-5 md:h-6 md:h-6 text-white" /></div>
          <div>
             <h1 className="font-black text-lg md:text-2xl tracking-tighter text-slate-900 leading-none uppercase italic">GuppyReal</h1>
             <p className="text-[8px] md:text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1 leading-none truncate max-w-[120px] md:max-w-none">{user?.shop_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsManagingBreeds(!isManagingBreeds)} className="h-9 md:h-11 px-3 md:px-6 bg-[#F1F5F9] rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all hover:bg-blue-600 hover:text-white">
            {isManagingBreeds ? (
              <span className="flex items-center gap-2"><X className="h-3 w-3 md:h-4 md:w-4" /> กลับหน้าหลัก</span>
            ) : (
              <span className="flex items-center gap-2"><Settings2 className="h-3 w-3 md:h-4 md:w-4" /> ตั้งค่า</span>
            )}
          </button>
          <button onClick={() => logout()} className="h-9 w-9 md:h-11 md:w-11 flex items-center justify-center bg-red-50 text-red-500 rounded-xl md:rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-90 shadow-md">
            <LogOut className="h-4 w-4 md:h-5 md:w-5" />
          </button>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto p-3 md:p-6 py-6 md:py-10 text-slate-900">
        {isManagingBreeds ? (
          <div className="space-y-8 md:space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10">
               {/* Breed Setup Form */}
               <div className="lg:col-span-5 order-1">
                <Card className="p-6 md:p-10 lg:sticky lg:top-28 border-none">
                    <h3 className="font-black text-xl md:text-2xl mb-6 md:mb-8 uppercase tracking-tighter italic flex items-center gap-3"><Settings2 className="h-5 w-5 md:h-6 md:w-6 text-blue-600" /> ตั้งค่าสายพันธุ์</h3>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const d = { name: fd.get('name'), price_piece: Number(fd.get('price_piece')), price_pair: Number(fd.get('price_pair')) };
                      try {
                        if (editingBreed) await supabase.from('breeds').update(d).eq('id', editingBreed.id);
                        else await supabase.from('breeds').insert([d]);
                        setEditingBreed(null); fetchData(); (e.target as any).reset(); toast.success('Saved');
                      } catch (err) { toast.error('Failed'); }
                    }} className="space-y-5 md:space-y-6">
                        <div className="space-y-1.5 md:space-y-2"><Label>ชื่อสายพันธุ์ปลา</Label><Input name="name" defaultValue={editingBreed?.name} placeholder="เช่น Full Gold" required /></div>
                        <div className="grid grid-cols-2 gap-4 md:gap-6">
                          <div className="space-y-1.5 md:space-y-2"><Label>ราคา/ตัว (฿)</Label><Input name="price_piece" type="number" defaultValue={editingBreed?.price_piece} required /></div>
                          <div className="space-y-1.5 md:space-y-2"><Label>ราคา/คู่ (฿)</Label><Input name="price_pair" type="number" defaultValue={editingBreed?.price_pair} required /></div>
                        </div>
                        <Button type="submit" className="w-full uppercase tracking-widest text-[10px]">
                          {editingBreed ? 'ยืนยันการแก้ไข' : 'เพิ่มลงรายการ'}
                        </Button>
                    </form>
                </Card>
               </div>

               {/* Breed List */}
               <div className="lg:col-span-7 space-y-10 order-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2 mb-2">
                    <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400">รายการปลาทั้งหมด</h3>
                    <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">{breeds.length} สายพันธุ์</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {breeds.map(b => (
                      <div key={b.id} className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-blue-200 transition-all">
                        <div className="flex items-center gap-4 md:gap-5">
                          <div className="h-12 w-12 md:h-14 md:w-14 bg-blue-50 rounded-2xl md:rounded-3xl flex items-center justify-center text-blue-600 transition-all transform group-hover:rotate-12"><Fish className="h-6 w-6 md:h-7 md:w-7" /></div>
                          <div><p className="font-black text-sm md:text-lg text-slate-800 leading-none">{b.name}</p><p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 md:mt-2">฿{b.price_piece} | ฿{b.price_pair}</p></div>
                        </div>
                        <div className="flex gap-1 md:gap-2">
                           <button onClick={() => setEditingBreed(b)} className="h-9 w-9 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-xl flex items-center justify-center transition-all"><Edit2 className="h-3.5 w-3.5" /></button>
                           <button onClick={async () => { if(confirm('Delete?')) { await supabase.from('breeds').delete().eq('id', b.id).then(() => fetchData()); } }} className="h-9 w-9 bg-slate-50 text-slate-400 hover:text-red-600 rounded-xl flex items-center justify-center transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shop Info */}
                <Card className="p-6 md:p-10 bg-[#0F172A] text-white border-none shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-5"><CreditCard className="w-48 h-48 text-blue-400" /></div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-8 md:mb-10">
                         <h3 className="font-black text-xl md:text-2xl uppercase tracking-tighter text-blue-400 italic">ตั้งค่าร้านค้า</h3>
                         <button onClick={saveSettings} disabled={isSavingSettings} className="bg-blue-600 hover:bg-blue-500 px-4 md:px-8 h-10 md:h-12 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50">
                            {isSavingSettings ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                         </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                         <div className="space-y-2"><Label className="text-slate-500">ธนาคาร</Label><DarkInput value={bankInfo.bank_name} onChange={e => setBankInfo({...bankInfo, bank_name: e.target.value})} placeholder="ระบุธนาคาร..." /></div>
                         <div className="space-y-2"><Label className="text-slate-500">เลขบัญชี</Label><DarkInput value={bankInfo.account_number} onChange={e => setBankInfo({...bankInfo, account_number: e.target.value})} placeholder="เลขบัญชี..." /></div>
                         <div className="space-y-2"><Label className="text-slate-500">ชื่อบัญชีรับเงิน</Label><DarkInput value={bankInfo.account_name} onChange={e => setBankInfo({...bankInfo, account_name: e.target.value})} placeholder="ชื่อจริง..." /></div>
                         <div className="space-y-2"><Label className="text-slate-500">ค่าจัดส่ง (฿)</Label><DarkInput type="number" value={bankInfo.shipping_fee} onChange={e => setBankInfo({...bankInfo, shipping_fee: Number(e.target.value)})} /></div>
                      </div>
                    </div>
                </Card>
               </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10 animate-in fade-in duration-500">
             {/* Left: Species Selection */}
             <div className="lg:col-span-7 space-y-6 md:space-y-10 order-2 lg:order-1">
                <div className="px-2 text-center sm:text-left">
                   <h2 className="font-black text-3xl md:text-4xl uppercase tracking-tighter text-slate-900 italic leading-none">รายการปลา</h2>
                   <div className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mt-3 md:mt-4 ml-1 flex items-center justify-center sm:justify-start gap-2 md:gap-3 text-slate-900">
                      <div className="h-1 w-6 md:w-10 bg-blue-600 rounded-full"></div> 
                      <span>จิ้มเลือกสายพันธุ์</span>
                   </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 md:gap-6 font-bold text-slate-900">
                  {breeds.map(b => (
                    <Card key={b.id} className="p-4 md:p-8 hover:shadow-2xl transition-all group overflow-hidden relative active:scale-95 border-none shadow-md">
                      <div className="absolute -top-10 md:-top-12 -right-10 md:-right-12 h-24 md:h-40 w-24 md:w-40 bg-blue-50 rounded-full group-hover:scale-[3] transition-all duration-700 -z-0 opacity-40"></div>
                      <div className="relative z-10 text-center sm:text-left">
                        <h4 className="font-black text-base md:text-2xl mb-4 md:mb-8 text-slate-900 tracking-tight leading-tight uppercase italic truncate">{b.name}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4 font-bold">
                          <button onClick={() => { addToOrder(b.name, 'piece', b.price_piece); }} className="flex flex-col items-center bg-[#0F172A] hover:bg-blue-600 text-white p-2.5 md:p-5 rounded-xl md:rounded-[2rem] transition-all shadow-xl active:scale-95">
                            <p className="text-[7px] md:text-[9px] font-black uppercase tracking-widest opacity-50 mb-0.5 md:mb-1 leading-none text-white">รายตัว</p>
                            <p className="text-xs md:text-xl font-black italic leading-none text-white">฿{b.price_piece}</p>
                          </button>
                          <button onClick={() => { addToOrder(b.name, 'pair', b.price_pair); }} className="flex flex-col items-center bg-[#0F172A] hover:bg-blue-600 text-white p-2.5 md:p-5 rounded-xl md:rounded-[2rem] transition-all shadow-xl active:scale-95">
                            <p className="text-[7px] md:text-[9px] font-black uppercase tracking-widest opacity-50 mb-0.5 md:mb-1 leading-none text-white">รายคู่</p>
                            <p className="text-xs md:text-xl font-black italic leading-none text-white">฿{b.price_pair}</p>
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                {breeds.length === 0 && (
                  <Card className="py-20 md:py-32 text-center bg-white border-2 border-dashed border-slate-200 flex flex-col items-center p-6">
                    <Fish className="h-10 w-10 md:h-12 md:w-12 text-slate-300 mb-4" />
                    <p className="text-xs md:text-sm font-black text-slate-400 uppercase tracking-[0.3em]">ยังไม่มีข้อมูลสายพันธุ์ปลา</p>
                    <button onClick={() => setIsManagingBreeds(true)} className="mt-4 md:mt-6 text-[10px] font-black text-blue-600 uppercase underline tracking-widest hover:text-blue-700 transition-colors">ไปหน้าตั้งค่า</button>
                  </Card>
                )}
             </div>

             {/* Right: Cart Summary */}
             <div className="lg:col-span-5 order-1 lg:order-2 mb-4 md:mb-0">
                <div className="lg:sticky lg:top-28 space-y-6">
                   <Card className="overflow-hidden border-none shadow-[0_40px_100px_-20px_rgba(0,0,0,0.08)] rounded-[2rem] md:rounded-[3.5rem] bg-white text-slate-900">
                      <div className="p-6 md:p-10 border-b border-slate-100 flex items-center justify-between bg-white text-slate-900">
                         <div className="flex items-center gap-3 md:gap-4">
                            <div className="p-2 md:p-3 bg-blue-600 rounded-xl md:rounded-2xl shadow-md"><ClipboardList className="h-4 w-4 md:h-6 md:w-6 text-white" /></div>
                            <span className="font-black italic uppercase tracking-tighter text-xl md:text-3xl leading-none">ตะกร้า</span>
                         </div>
                         <button onClick={() => setOrderItems([])} className="h-9 md:h-11 px-4 md:px-6 bg-red-50 text-red-600 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-90">ล้าง</button>
                      </div>

                      <div className="p-6 md:p-10 max-h-[350px] md:max-h-[450px] overflow-y-auto custom-scrollbar space-y-6 md:space-y-8">
                        {orderItems.map(item => (
                          <div key={item.id} className="flex justify-between items-center animate-in slide-in-from-right-2 duration-300 text-slate-900">
                            <div className="min-w-0 pr-4">
                               <p className="font-black text-base md:text-xl leading-none tracking-tight mb-1 md:mb-2 italic uppercase truncate">{item.breedName}</p>
                               <div className="text-[9px] md:text-[11px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                  <span>{item.quantity} {item.type === 'piece' ? 'ตัว' : 'คู่'}</span>
                                  <span className="opacity-20 mx-1">|</span>
                                  <span>฿{item.price.toLocaleString()}</span>
                               </div>
                            </div>
                            <div className="flex items-center gap-3 md:gap-6">
                               <span className="font-black text-lg md:text-2xl tracking-tighter italic whitespace-nowrap leading-none">฿{(item.price * item.quantity).toLocaleString()}</span>
                               <button onClick={() => setOrderItems(orderItems.filter(i => i.id !== item.id))} className="h-8 w-8 md:h-10 md:w-10 bg-slate-50 text-slate-300 hover:text-red-500 rounded-xl transition-all flex items-center justify-center active:scale-75"><Trash2 className="h-4 w-4 md:h-5 md:w-5" /></button>
                            </div>
                          </div>
                        ))}
                        {orderItems.length === 0 && <div className="py-12 md:py-20 text-center opacity-5 flex flex-col items-center uppercase tracking-[0.4em] font-black text-[10px] leading-none text-slate-900"><ShoppingCartIcon className="h-16 w-16 md:h-24 md:w-24 mb-4 md:mb-6" /> ตะกร้าว่าง</div>}
                      </div>

                      {orderItems.length > 0 && (
                        <div className="p-6 md:p-10 bg-[#0F172A] text-white rounded-b-[2rem] md:rounded-b-[3.5rem] space-y-6 md:space-y-10 relative overflow-hidden border-t border-slate-800">
                           <div className="absolute bottom-0 left-0 p-10 opacity-5 -ml-16 -mb-16 transform rotate-12"><Fish className="h-48 md:h-64 w-48 md:w-64 text-blue-500" /></div>
                          <div className="flex justify-between items-end relative z-10 px-1 md:px-2 text-white">
                             <div>
                                <p className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 mb-1 md:mb-2 leading-none">ยอดรวมทั้งหมด</p>
                                <p className="text-2xl md:text-5xl font-black text-blue-400 tracking-tighter italic drop-shadow-2xl leading-none">฿{grandTotal.toLocaleString()}</p>
                             </div>
                             <div className="text-right">
                                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 leading-none text-slate-500">ค่าส่ง</p>
                                <p className="text-base md:text-lg font-black italic leading-none text-white">฿{bankInfo.shipping_fee}</p>
                             </div>
                          </div>
                          <div className="grid grid-cols-1 gap-3 md:gap-4 relative z-10 px-1 md:px-2 pb-1 md:pb-2 leading-none text-white">
                             <button 
                               onClick={() => { if (!lineMessage) return; const lineUrl = `line://msg/text/${encodeURIComponent(lineMessage)}`; window.location.href = lineUrl; setTimeout(() => { window.open(`https://line.me/R/msg/text/?${encodeURIComponent(lineMessage)}`, '_blank'); }, 500); }} 
                               className="h-14 md:h-16 bg-[#06C755] hover:bg-[#05b14c] text-white rounded-2xl md:rounded-3xl font-black text-[10px] md:text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 md:gap-4 shadow-2xl active:scale-[0.98] transition-all transform hover:-translate-y-1 leading-none"
                             >
                               <MessageCircle className="h-5 w-5 md:h-7 md:w-7" /> 
                               <span>ส่งเข้า LINE</span>
                             </button>
                             <button 
                               onClick={() => { if (!lineMessage) return; navigator.clipboard.writeText(lineMessage); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); toast.success('ก๊อปปี้สำเร็จ!'); }} 
                               className={cn(
                                 "h-14 md:h-16 rounded-2xl md:rounded-3xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all active:scale-[0.98] border-2 shadow-xl flex items-center justify-center gap-3 md:gap-4",
                                 copySuccess ? 'bg-blue-600 border-blue-600 text-white shadow-blue-500/20' : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700 hover:text-white'
                               )}
                             >
                               {copySuccess ? <Check className="h-4 w-4 md:h-5 md:w-5" /> : <Copy className="h-4 w-4 md:h-5 md:w-5" />} 
                               <span>{copySuccess ? 'ก๊อปปี้แล้ว!' : 'คัดลอกข้อความ'}</span>
                             </button>
                          </div>
                        </div>
                      )}
                   </Card>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function Page() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-blue-600 font-black uppercase tracking-[0.5em] text-[10px]"><Loader2 className="h-12 w-12 animate-spin mb-4" /> กำลังเชื่อมต่อ...</div>;
  return user ? <GuppyApp /> : <AuthScreen />;
}
