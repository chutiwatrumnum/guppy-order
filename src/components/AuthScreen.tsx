import React, { useState } from 'react';
import { Fish, User as UserIcon, Lock, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Input = ({ className, ...props }: any) => (
  <input
    className={cn("w-full h-12 bg-slate-50 border border-slate-100 focus:border-blue-500 focus:bg-white text-slate-900 font-semibold rounded-xl px-4 outline-none transition-all placeholder:text-slate-300", className)}
    {...props}
  />
);

const Label = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <label className={cn("text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block", className)}>
    {children}
  </label>
);

export default function AuthScreen() {
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

        login({ id: data.id, username: data.username, shop_name: data.shop_name, role: data.role || 'user' });
        toast.success('เข้าสู่ระบบสำเร็จ');
      } else {
        const { data, error } = await supabase
          .from('app_users')
          .insert([{
            username: username.trim().toLowerCase(),
            password: password,
            shop_name: shopName,
            role: 'user'
          }])
          .select()
          .single();

        if (error) throw new Error('ชื่อผู้ใช้นี้ถูกใช้ไปแล้วครับ');

        login({ id: data.id, username: data.username, shop_name: data.shop_name, role: data.role || 'user' });
        toast.success('สมัครสมาชิกสำเร็จ!');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans text-slate-900">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-12 text-center">
          <div className="p-4 bg-blue-600 rounded-[1.5rem] shadow-xl shadow-blue-500/30 mb-5 transform -rotate-6">
            <Fish className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic leading-none">GuppyReal</h1>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mt-2 leading-none ml-1">Cloud Database ERP</p>
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-lg">
          <div className="flex p-1.5 bg-slate-100 rounded-2xl mb-10">
            <button onClick={() => setIsLogin(true)} className={cn("flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", isLogin ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700')}>เข้าสู่ระบบ</button>
            <button onClick={() => setIsLogin(false)} className={cn("flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", !isLogin ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700')}>สมัครสมาชิก</button>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {!isLogin && (
              <div className="space-y-2">
                <Label>ชื่อร้าน / ชื่อฟาร์ม</Label>
                <div className="relative group">
                  <Fish className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                  <Input placeholder="เช่น เจมส์ Guppy" value={shopName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShopName(e.target.value)} required className="pl-12" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>ชื่อผู้ใช้งาน (Username)</Label>
              <div className="relative group">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                <Input placeholder="Username" value={username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)} required className="pl-12" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>รหัสผ่าน</Label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                <Input type="password" placeholder="••••••••" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} required className="pl-12" />
              </div>
            </div>

            <button type="submit" className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-lg shadow-blue-500/20 disabled:opacity-50 active:scale-95 transition-all rounded-2xl font-bold flex items-center justify-center gap-2 h-14 px-6 shadow-md text-xs uppercase tracking-[0.2em]" disabled={loading}>
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (isLogin ? 'Login to ERP' : 'Create My Shop')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
