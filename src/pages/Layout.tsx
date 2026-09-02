import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Settings2, ClipboardList, LogOut, Users } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LayoutProps {
  children: React.ReactNode;
}

const NAV = [
  { to: '/', label: 'ขายปลา', icon: ShoppingCart, adminOnly: false },
  { to: '/admin', label: 'บิล', icon: ClipboardList, adminOnly: true },
  { to: '/customers', label: 'ลูกค้า', icon: Users, adminOnly: true },
  { to: '/settings', label: 'ตั้งค่า', icon: Settings2, adminOnly: true },
];

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const items = NAV.filter((item) => isAdmin || !item.adminOnly);

  // พนักงานทั่วไปเข้าได้หน้าเดียว แถบล่างจึงไม่มีอะไรให้สลับ
  const showBottomNav = items.length > 1;

  return (
    <div
      className="bg-background flex min-h-[100dvh] flex-col"
      style={{ '--bottom-nav': showBottomNav ? '4rem' : '0px' } as React.CSSProperties}
    >
      <header className="bg-card/85 sticky top-0 z-40 border-b pt-safe backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            {/* โลโก้จริงแทนไอคอนปลาทั่วไป — โลโก้เป็นวงกลม เลยตัดกลม */}
            <img
              src="/logo.png"
              alt=""
              aria-hidden
              width={36}
              height={36}
              className="size-9 shrink-0 rounded-full object-contain"
            />
            <div className="min-w-0">
              <p className="truncate text-sm leading-tight font-semibold">บ้านหมีมีปลา</p>
              <p className="text-muted-foreground truncate text-xs leading-tight">
                {user?.shop_name || 'ร้านค้า'}
              </p>
            </div>
          </Link>

          {/* เมนูเต็มบนจอคอมพ์ — บนมือถือใช้แถบล่างแทน */}
          <nav className="hidden items-center gap-1 md:flex">
            {items.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Button
                  key={item.to}
                  asChild
                  variant={active ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(active && 'text-primary')}
                >
                  <Link to={item.to}>
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </nav>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="เมนูผู้ใช้">
                <span className="bg-secondary text-secondary-foreground flex size-8 items-center justify-center rounded-full text-xs font-semibold uppercase">
                  {(user?.username || '?').slice(0, 2)}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuLabel className="font-normal">
                <span className="block text-sm font-medium">{user?.username}</span>
                <span className="text-muted-foreground block text-xs">
                  {isAdmin ? 'ผู้ดูแลระบบ' : 'พนักงานขาย'}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => logout()}>
                <LogOut className="size-4" />
                ออกจากระบบ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className={cn('flex-1', showBottomNav && 'pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0')}>
        {children}
      </main>

      {showBottomNav && (
        <nav
          className="bg-card/95 fixed inset-x-0 bottom-0 z-40 border-t pb-safe backdrop-blur-md md:hidden"
          aria-label="เมนูหลัก"
        >
          <div className="mx-auto flex h-16 max-w-lg items-stretch">
            {items.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                      active && 'bg-primary/10'
                    )}
                  >
                    <item.icon className="size-5" />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
