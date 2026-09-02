import React, { useState } from 'react';
import { Fish, Loader2, Lock, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="bg-primary text-primary-foreground mb-4 flex size-14 items-center justify-center rounded-2xl">
            <Fish className="size-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">GuppyReal</h1>
          <p className="text-muted-foreground mt-1 text-sm">ระบบจัดการออเดอร์ปลาหางนกยูง</p>
        </div>

        <Card>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">ชื่อผู้ใช้งาน</Label>
                <div className="relative">
                  <UserIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    id="username"
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="pl-9"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">รหัสผ่าน</Label>
                <div className="relative">
                  <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-9"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : 'เข้าสู่ระบบ'}
              </Button>
            </form>

            <p className="text-muted-foreground mt-6 text-center text-xs leading-relaxed">
              บัญชีผู้ใช้งานสร้างโดยผู้ดูแลระบบเท่านั้น
              <br />
              ต้องการเพิ่มผู้ใช้ กรุณาติดต่อแอดมินร้าน
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
