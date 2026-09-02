import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import { PageLoader } from '@/components/ui/page-loader';
import AuthScreen from '@/components/AuthScreen';

// โหลดแต่ละหน้าเมื่อเข้าจริง — ลูกค้าที่เปิดลิงก์ใบสรุปในไลน์จะได้ไม่ต้อง
// ดาวน์โหลดหน้าหลังบ้านทั้งชุดไปด้วย
// (AuthScreen ไม่ lazy เพราะต้องโชว์ทันทีเมื่อยังไม่ล็อกอิน)
const HomePage = lazy(() => import('@/pages/HomePage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const CustomersPage = lazy(() => import('@/pages/CustomersPage'));
const PublicOrderPage = lazy(() => import('@/pages/PublicOrderPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader label="กำลังเข้าสู่ระบบ…" />;
  if (!user) return <AuthScreen />;

  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ใบสรุปสำหรับลูกค้า — เปิดได้โดยไม่ต้องล็อกอิน ต้องอยู่นอก ProtectedRoute */}
          <Route path="/o/:token" element={<PublicOrderPage />} />

          {/* Auth Route - Always accessible */}
          <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthScreen />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <CustomersPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster />
    </BrowserRouter>
  );
}
