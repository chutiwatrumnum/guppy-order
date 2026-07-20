import { createContext, useContext, useEffect, useState } from 'react';
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        setLoading(true);
        // เลื่อนออกจาก callback ก่อน — เรียก supabase ซ้อนใน callback ทำให้ค้างได้
        setTimeout(() => loadProfile(session.user.id), 0);
      } else {
        setUser(null);
        setLoading(false);
      }
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
