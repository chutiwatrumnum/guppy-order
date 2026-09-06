import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  username: string;
  shop_name: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // โปรไฟล์ของใครที่โหลดไปแล้ว — ใช้กันโหลดซ้ำเวลา supabase ยิง event ของคนเดิมมาอีก
  const loadedUserId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadProfile = async (userId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, shop_name, role')
        .eq('id', userId)
        .single();

      if (!active) return;

      if (error || !data) {
        // ล็อกอินผ่านแต่ไม่มี profile — ถือว่ายังใช้งานไม่ได้ ดีกว่าปล่อยผ่านแบบไม่รู้สิทธิ์
        console.error('Load profile error:', error);
        loadedUserId.current = null;
        setUser(null);
      } else {
        setUser({
          id: data.id,
          username: data.username,
          shop_name: data.shop_name,
          role: data.role === 'admin' ? 'admin' : 'user',
        });
      }
      setLoading(false);
    };

    /**
     * รับ session ที่ได้มา แล้วตัดสินใจว่าต้องโหลดโปรไฟล์ใหม่ไหม
     *
     * ⚠️ ห้าม setLoading(true) เวลาเป็นคนเดิม
     *
     * supabase ดัก visibilitychange ไว้เอง ทุกครั้งที่แท็บกลับมาโฟกัส (สลับแท็บ
     * สลับแอป กลับมาจากไลน์) มันจะกู้ session แล้วยิง SIGNED_IN ของคนเดิมซ้ำ
     * ถ้าเผลอสั่ง loading ตรงนี้ ProtectedRoute จะสลับไปหน้า PageLoader
     * = ทั้งแอปถูก unmount แล้วเรนเดอร์ใหม่หมด คำค้น ตะกร้า ออเดอร์ที่เลือกค้างไว้
     * หายเกลี้ยงทุกครั้งที่สลับแท็บ แล้วยิงคิวรีใหม่ทั้งชุดโดยไม่จำเป็น
     */
    const applySession = (session: { user?: { id: string } } | null) => {
      const userId = session?.user?.id ?? null;

      if (!userId) {
        loadedUserId.current = null;
        setUser(null);
        setLoading(false);
        return;
      }

      // คนเดิม — ไม่ต้องทำอะไรทั้งนั้น ปล่อยหน้าที่เปิดค้างไว้ทำงานต่อ
      if (userId === loadedUserId.current) return;

      // เพิ่งล็อกอิน หรือสลับบัญชี — ค่อยขึ้นหน้ารอ แล้วโหลดโปรไฟล์ของคนใหม่
      loadedUserId.current = userId;
      setLoading(true);
      // เลื่อนออกจาก callback ก่อน — เรียก supabase ซ้อนใน callback ทำให้ค้างได้
      setTimeout(() => {
        if (active) loadProfile(userId);
      }, 0);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) applySession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) applySession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
