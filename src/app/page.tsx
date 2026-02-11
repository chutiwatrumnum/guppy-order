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
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// --- Sophisticated Minimal UI Components ---
const Card = ({ children, className }: any) => (
  <div className={`bg-white rounded-[2rem] shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] border border-slate-100 ${className}`}>
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
    <button className={`disabled:opacity-50 active:scale-95 transition-all rounded-2xl font-bold flex items-center justify-center gap-2 h-12 ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Input = ({ className, ...props }: any) => (
  <input 
    className={`w-full h-12 bg-slate-50 border border-slate-100 focus:border-blue-500 focus:bg-white text-slate-900 font-semibold rounded-xl px-4 outline-none transition-all placeholder:text-slate-300 ${className}`} 
    {...props} 
  />
);

const DarkInput = ({ className, ...props }: any) => (
  <input 
    className={`w-full h-12 bg-[#0F172A] border border-slate-800 text-white font-bold rounded-xl px-4 outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600 ${className}`} 
    {...props} 
  />
);

const Label = ({ children, className }: any) => (
  <label className={`text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block ${className}`}>
    {children}
  </label>
);

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
        if (error || !data) throw new Error('Username หรือ Password ไม่ถูกต้อง');
        login({ id: data.id, username: data.username, shop_name: data.shop_name });
        toast.success('ยินดีต้อนรับครับ');
      } else {
        const { data, error } = await supabase
          .from('app_users')
          .insert([{ username: username.trim().toLowerCase(), password: password, shop_name: shopName }])
          .select().single();
        if (error) throw new Error('Username นี้ถูกใช้ไปแล้วครับ');
        login({ id: data.id, username: data.username, shop_name: data.shop_name });
        toast.success('สร้างบัญชีสำเร็จ!');
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center mb-12 text-center text-slate-900">
          <div className="p-4 bg-blue-600 rounded-[1.5rem] shadow-xl shadow-blue-500/30 mb-5 transform -rotate-6">
            <Fish className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic leading-none">GuppyReal</h1>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mt-2 leading-none ml-1">Cloud Database ERP</p>
        </div>

        <Card className="p-10 border-slate-200">
          <div className="flex p-1.5 bg-slate-100 rounded-2xl mb-10">
            <button onClick={() => setIsLogin(true)} className={`flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isLogin ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Sign In</button>
            <button onClick={() => setIsLogin(false)} className={`flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isLogin ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Register</button>
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
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (isLogin ? 'Login to ERP' : 'Create My Shop')}
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

  if (loading && breeds.length === 0) return <div className="min-h-screen flex flex-col items-center justify-center bg-white"><Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" /><p className="font-black text-slate-400 uppercase tracking-widest text-xs">Synchronizing with Cloud...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 py-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20 transform -rotate-6"><Fish className="h-6 w-6 text-white" /></div>
          <div>
             <h1 className="font-black text-2xl tracking-tighter text-slate-900 leading-none uppercase italic">GuppyReal</h1>
             <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1 leading-none">{user?.shop_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsManagingBreeds(!isManagingBreeds)} className="h-11 px-6 rounded-2xl text-[10px] uppercase tracking-widest">
            {isManagingBreeds ? 'Home' : 'Settings'}
          </Button>
          <button onClick={() => logout()} className="h-11 w-11 flex items-center justify-center bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-md active:scale-90">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto p-6 py-10">
        {isManagingBreeds ? (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
               {/* Breed Form */}
               <div className="lg:col-span-5">
                <Card className="p-10 sticky top-28 border-none text-slate-900">
                    <h3 className="font-black text-2xl mb-8 uppercase tracking-tighter italic">Breed Setup</h3>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const d = { name: fd.get('name'), price_piece: Number(fd.get('price_piece')), price_pair: Number(fd.get('price_pair')) };
                      try {
                        if (editingBreed) await supabase.from('breeds').update(d).eq('id', editingBreed.id);
                        else await supabase.from('breeds').insert([d]);
                        setEditingBreed(null); fetchData(); (e.target as any).reset(); toast.success('Saved');
                      } catch (err) { toast.error('Failed to save'); }
                    }} className="space-y-6">
                        <div className="space-y-2">
                          <Label>ชื่อสายพันธุ์ปลา</Label>
                          <Input name="name" defaultValue={editingBreed?.name} placeholder="เช่น Full Gold" required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>ราคาต่อตัว (฿)</Label>
                            <Input name="price_piece" type="number" defaultValue={editingBreed?.price_piece} required />
                          </div>
                          <div className="space-y-2">
                            <Label>ราคาต่อคู่ (฿)</Label>
                            <Input name="price_pair" type="number" defaultValue={editingBreed?.price_pair} required />
                          </div>
                        </div>
                        <Button type="submit" className="w-full h-14 uppercase tracking-widest text-[10px] mt-4 shadow-blue-500/20">
                          {editingBreed ? 'Update Breed' : 'Add to Collection'}
                        </Button>
                    </form>
                </Card>
               </div>
               {/* Bank Form */}
               <div className="lg:col-span-7 space-y-8">
                <Card className="p-10 bg-slate-900 text-white border-none shadow-2xl relative overflow-hidden text-slate-900">
                    <div className="absolute top-0 right-0 p-10 opacity-5"><CreditCard className="w-48 h-48 text-blue-400" /></div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-10">
                         <h3 className="font-black text-2xl uppercase tracking-tighter text-blue-400 italic">Shop Settings</h3>
                         <Button onClick={saveSettings} disabled={isSavingSettings} className="bg-blue-600 hover:bg-blue-500 px-8 h-12 text-[10px] font-black uppercase tracking-widest">
                            {isSavingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Sync Cloud
                         </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="space-y-2"><Label className="text-slate-500">ธนาคาร</Label><input value={bankInfo.bank_name} onChange={e => setBankInfo({...bankInfo, bank_name: e.target.value})} placeholder="ระบุชื่อธนาคาร" className="w-full h-14 bg-slate-800 rounded-2xl px-5 border-none outline-none font-bold text-white focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600" /></div>
                         <div className="space-y-2"><Label className="text-slate-500">เลขบัญชี</Label><input value={bankInfo.account_number} onChange={e => setBankInfo({...bankInfo, account_number: e.target.value})} placeholder="XXX-X-XXXXX-X" className="w-full h-14 bg-slate-800 rounded-2xl px-5 border-none outline-none font-black text-white focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600" /></div>
                         <div className="space-y-2"><Label className="text-slate-500">ชื่อบัญชี</Label><input value={bankInfo.account_name} onChange={e => setBankInfo({...bankInfo, account_name: e.target.value})} placeholder="ชื่อ-นามสกุล" className="w-full h-14 bg-slate-800 rounded-2xl px-5 border-none outline-none font-bold text-white focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600" /></div>
                         <div className="space-y-2"><Label className="text-slate-500">ค่าส่งแฟลช (฿)</Label><input type="number" value={bankInfo.shipping_fee} onChange={e => setBankInfo({...bankInfo, shipping_fee: Number(e.target.value)})} className="w-full h-14 bg-slate-800 rounded-2xl px-5 border-none outline-none font-black text-blue-400 focus:ring-1 focus:ring-blue-500 transition-all" /></div>
                      </div>
                    </div>
                </Card>
                
                {/* List of Breeds */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {breeds.map(b => (
                    <div key={b.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-blue-200 transition-all">
                      <div className="flex items-center gap-5">
                        <div className="h-14 w-14 bg-blue-50 rounded-[1.5rem] flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300"><Fish className="h-7 w-7" /></div>
                        <div><p className="font-black text-lg text-slate-900 tracking-tight">{b.name}</p><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">฿{b.price_piece} / ฿{b.price_pair}</p></div>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => setEditingBreed(b)} className="h-10 w-10 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl flex items-center justify-center active:scale-90"><Edit2 className="h-4 w-4" /></button>
                         <button onClick={async () => { if(confirm('Delete?')) { await supabase.from('breeds').delete().eq('id', b.id).then(() => fetchData()); } }} className="h-10 w-10 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center justify-center active:scale-90"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-500">
             <div className="lg:col-span-7 space-y-10">
                <div className="px-2">
                   <h2 className="font-black text-4xl uppercase tracking-tighter text-slate-900 italic leading-none">Marketplace</h2>
                   <div className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mt-4 ml-1 flex items-center gap-3">
                      <div className="h-1.5 w-10 bg-blue-600 rounded-full"></div> 
                      <span>Select Species</span>
                   </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-slate-900 font-bold">
                  {breeds.map(b => (
                    <Card key={b.id} className="p-8 hover:shadow-2xl hover:shadow-blue-500/10 transition-all group overflow-hidden relative active:scale-[0.97] cursor-pointer border-slate-200">
                      <div className="absolute -top-12 -right-12 h-40 w-40 bg-blue-50 rounded-full group-hover:scale-[3] transition-all duration-700 -z-0 opacity-40"></div>
                      <div className="relative z-10 text-center sm:text-left">
                        <h4 className="font-black text-2xl mb-8 text-slate-900 tracking-tight leading-tight uppercase italic">{b.name}</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <button onClick={() => addToOrder(b.name, 'piece', b.price_piece)} className="flex flex-col items-center bg-slate-900 hover:bg-blue-600 text-white p-5 rounded-[2rem] transition-all shadow-xl shadow-slate-900/10 hover:shadow-blue-500/20"><p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1 text-white">Per Piece</p><p className="text-xl font-black text-white italic leading-none">฿{b.price_piece}</p></button>
                          <button onClick={() => addToOrder(b.name, 'pair', b.price_pair)} className="flex flex-col items-center bg-slate-900 hover:bg-blue-600 text-white p-5 rounded-[2rem] transition-all shadow-xl shadow-slate-900/10 hover:shadow-blue-500/20"><p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1 text-white">Per Pair</p><p className="text-xl font-black text-white italic leading-none">฿{b.price_pair}</p></button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                {breeds.length === 0 && (
                  <Card className="py-32 text-center bg-white border-2 border-dashed border-slate-200 flex flex-col items-center">
                    <div className="p-6 bg-slate-50 rounded-full mb-6"><Fish className="h-12 w-12 text-slate-300" /></div>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">No Data in Cloud Database</p>
                    <button onClick={() => setIsManagingBreeds(true)} className="mt-6 text-xs font-black text-blue-600 uppercase underline tracking-widest hover:text-blue-700 transition-colors">Start Adding Species</button>
                  </Card>
                )}
             </div>
             <div className="lg:col-span-5">
                <div className="sticky top-28 space-y-8">
                   <Card className="overflow-hidden border-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] rounded-[3.5rem] bg-white">
                      <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md">
                         <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/30"><ClipboardList className="h-6 w-6 text-white" /></div>
                            <span className="font-black italic uppercase tracking-tighter text-3xl text-slate-900">Total</span>
                         </div>
                         <button onClick={() => setOrderItems([])} className="h-11 px-6 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-90">Reset</button>
                      </div>
                      <div className="p-10 max-h-[450px] overflow-y-auto custom-scrollbar space-y-8">
                        {orderItems.map(item => (
                          <div key={item.id} className="flex justify-between items-center animate-in slide-in-from-right-4 duration-500">
                            <div className="min-w-0 pr-4">
                               <p className="font-black text-slate-900 text-xl leading-none tracking-tight mb-2 uppercase italic truncate">{item.breedName}</p>
                               <div className="text-[11px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                  <span>{item.quantity} {item.type === 'piece' ? 'ตัว' : 'คู่'}</span>
                                  <span className="opacity-20 mx-1">|</span>
                                  <span>฿{item.price.toLocaleString()}</span>
                               </div>
                            </div>
                            <div className="flex items-center gap-6 text-slate-900">
                               <span className="font-black text-2xl tracking-tighter italic">฿{(item.price * item.quantity).toLocaleString()}</span>
                               <button onClick={() => setOrderItems(orderItems.filter(i => i.id !== item.id))} className="h-10 w-10 bg-slate-50 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center active:scale-75"><Trash2 className="h-5 w-5" /></button>
                            </div>
                          </div>
                        ))}
                        {orderItems.length === 0 && <div className="py-20 text-center opacity-5 flex flex-col items-center uppercase tracking-[0.5em] font-black text-xs text-slate-900"><ShoppingCart className="h-24 w-24 mb-6" /> Cart Empty</div>}
                      </div>
                      {orderItems.length > 0 && (
                        <div className="p-10 bg-[#0F172A] text-white rounded-b-[3.5rem] space-y-10 relative overflow-hidden shadow-2xl border-t border-slate-800">
                           <div className="absolute bottom-0 left-0 p-10 opacity-5 -ml-16 -mb-16 transform rotate-12"><Fish className="h-64 w-64 text-blue-500" /></div>
                          <div className="flex justify-between items-end relative z-10 px-2">
                             <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Total Amount</p>
                                <p className="text-5xl font-black text-blue-400 tracking-tighter italic drop-shadow-2xl">฿{grandTotal.toLocaleString()}</p>
                             </div>
                             <div className="text-right text-white">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Ship</p>
                                <p className="text-lg font-black italic">฿{bankInfo.shipping_fee}.00</p>
                             </div>
                          </div>
                          <div className="grid grid-cols-1 gap-4 relative z-10 px-2 pb-2">
                             <button onClick={() => { window.location.href = `line://msg/text/${encodeURIComponent(lineMessage)}`; setTimeout(() => window.open(`https://line.me/R/msg/text/?${encodeURIComponent(lineMessage)}`, '_blank'), 500); }} className="h-16 bg-[#06C755] hover:bg-[#05b14c] text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-4 shadow-2xl shadow-green-500/30 active:scale-[0.98] transition-all transform hover:-translate-y-1"><MessageCircle className="h-7 w-7" /> Share via LINE</button>
                             <button onClick={() => { navigator.clipboard.writeText(lineMessage); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); toast.success('Copied!'); }} className={`h-16 rounded-3xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] border-2 shadow-xl ${copySuccess ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white hover:border-slate-600'}`}>{copySuccess ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />} {copySuccess ? 'Invoice Copied' : 'Copy Summary'}</button>
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
  if (loading) return <div className="min-h-screen flex flex-col items-center justify-center bg-white"><Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" /><p className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-300 animate-pulse text-center leading-relaxed">Connecting Database...</p></div>;
  return user ? <GuppyApp /> : <AuthScreen />;
}
