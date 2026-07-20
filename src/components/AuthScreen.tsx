import React, { useState } from 'react';
import { Fish, User as UserIcon, Lock, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
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

// Supabase Auth ใช้อีเมลเป็น identifier แต่พนักงานยังพิมพ์ username เหมือนเดิม
// ถ้ากรอกมาเป็นอีเมลอยู่แล้วก็ใช้ตามนั้น ไม่งั้นเติมโดเมนให้
const USERNAME_EMAIL_DOMAIN = 'guppy-order.local';

const toEmail = (identifier: string) => {
  const value = identifier.trim().toLowerCase();
  return value.includes('@') ? value : `${value}@${USERNAME_EMAIL_DOMAIN}`;
};

export default function AuthScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: toEmail(username),
        password,
      });

      // ข้อความเดียวกันหมดไม่ว่าพลาดตรงไหน จะได้ไม่บอกใบ้ว่ามี username นี้อยู่จริงหรือเปล่า
      if (error) throw new Error('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');

      // ไม่ต้อง setUser เอง — AuthContext ฟัง onAuthStateChange อยู่แล้ว
      toast.success('เข้าสู่ระบบสำเร็จ');
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
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label>ชื่อผู้ใช้งาน (Username)</Label>
              <div className="relative group">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                <Input placeholder="Username" value={username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)} required className="pl-12" autoComplete="username" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>รหัสผ่าน</Label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                <Input type="password" placeholder="••••••••" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} required className="pl-12" autoComplete="current-password" />
              </div>
            </div>

            <button type="submit" className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-lg shadow-blue-500/20 disabled:opacity-50 active:scale-95 transition-all rounded-2xl font-bold flex items-center justify-center gap-2 h-14 px-6 shadow-md text-xs uppercase tracking-[0.2em]" disabled={loading}>
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Login to ERP'}
            </button>
          </form>

          <p className="text-[10px] text-slate-400 text-center mt-8 leading-relaxed">
            บัญชีผู้ใช้งานสร้างโดยผู้ดูแลระบบเท่านั้น<br />ต้องการเพิ่มผู้ใช้ กรุณาติดต่อแอดมินร้าน
          </p>
        </div>
      </div>
    </div>
  );
}
