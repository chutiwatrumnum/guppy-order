import { Link, useLocation } from 'react-router-dom';
import {
  Fish,
  ShoppingCart,
  Settings2,
  ClipboardList,
  LogOut,
  Home
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen pb-20 bg-slate-50 font-sans">
      <header className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-50 px-3 sm:px-4 py-3 sm:py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/" className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 bg-blue-600 rounded-xl sm:rounded-2xl shadow-lg shadow-blue-500/20">
                <Fish className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight leading-none uppercase">GuppyReal</h1>
                <p className="text-[8px] sm:text-[9px] font-black text-blue-500 uppercase tracking-widest mt-0.5 sm:mt-1">{user?.shop_name || 'Shop'}</p>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Select Species - Always visible */}
            <Link 
              to="/"
              className={cn(
                "h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-5 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all",
                location.pathname === '/' 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                  : "bg-orange-50 text-orange-600 hover:bg-orange-100"
              )}
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">ขายปลา</span>
            </Link>
            
            {isAdmin && (
              <>
                <Link 
                  to="/admin"
                  className={cn(
                    "h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-5 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all",
                    location.pathname === '/admin' 
                      ? "bg-slate-800 text-white shadow-lg shadow-slate-900/10" 
                      : "bg-green-50 text-green-600 hover:bg-green-100"
                  )}
                >
                  <ClipboardList className="h-4 w-4" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
                <Link 
                  to="/settings"
                  className={cn(
                    "h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-5 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest transition-all",
                    location.pathname === '/settings' 
                      ? "bg-slate-800 text-white shadow-lg shadow-slate-900/10" 
                      : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                  )}
                >
                  <Settings2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </Link>
              </>
            )}
            <button 
              onClick={logout} 
              className="h-9 sm:h-10 flex items-center justify-center px-2.5 sm:px-4 rounded-xl sm:rounded-2xl text-xs font-black uppercase tracking-widest bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}