import * as React from 'react';

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-media-query';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

// หน้าต่างเดียวใช้ได้สองแบบ
// - มือถือ: เด้งขึ้นจากขอบล่าง ปุ่มอยู่ใกล้นิ้วโป้ง ปัดลงปิดได้
// - จอคอมพ์: สไลด์เข้ามาจากขวา ได้ความสูงเต็มจอ และยังเห็นรายการที่อยู่ข้างหลัง
const ModalContext = React.createContext(false);

function ResponsiveModal({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  // ตรึงชนิดหน้าต่างไว้ตลอดที่เปิดอยู่ แล้วค่อยอัปเดตตอนปิด
  // ถ้าปล่อยให้สลับกลางคัน (หมุน iPad ข้าม 768px) React จะ remount ทั้งก้อน
  // ฟอร์มที่ยังไม่ได้บันทึกจะถูกล้างทิ้งโดยที่ผู้ใช้ไม่ได้ทำอะไรผิด
  const [mode, setMode] = React.useState(isMobile);
  if (!open && mode !== isMobile) setMode(isMobile);

  const Root = mode ? Drawer : Sheet;

  return (
    <ModalContext.Provider value={mode}>
      <Root open={open} onOpenChange={onOpenChange}>
        {children}
      </Root>
    </ModalContext.Provider>
  );
}

function ResponsiveModalContent({
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { className?: string }) {
  const isMobile = React.useContext(ModalContext);

  if (isMobile) {
    return (
      <DrawerContent className={cn('max-h-[92dvh]', className)} {...props}>
        {children}
      </DrawerContent>
    );
  }

  return (
    <SheetContent
      side="right"
      className={cn('flex w-full flex-col gap-0 p-0 sm:max-w-lg', className)}
      {...props}
    >
      {children}
    </SheetContent>
  );
}

function ResponsiveModalHeader({ className, ...props }: React.ComponentProps<'div'>) {
  const isMobile = React.useContext(ModalContext);
  const Comp = isMobile ? DrawerHeader : SheetHeader;
  return (
    <Comp
      className={cn(
        'shrink-0 border-b px-4 py-4 sm:px-6',
        // เว้นที่ให้ปุ่มปิดมุมขวาบนของแผงข้าง
        !isMobile && 'pr-14',
        className
      )}
      {...props}
    />
  );
}

function ResponsiveModalTitle({ className, ...props }: React.ComponentProps<'div'>) {
  const isMobile = React.useContext(ModalContext);
  const Comp = isMobile ? DrawerTitle : SheetTitle;
  return <Comp className={cn('text-base sm:text-lg', className)} {...props} />;
}

function ResponsiveModalDescription({ className, ...props }: React.ComponentProps<'div'>) {
  const isMobile = React.useContext(ModalContext);
  const Comp = isMobile ? DrawerDescription : SheetDescription;
  return <Comp className={cn('text-sm', className)} {...props} />;
}

/** ตัวเนื้อหาที่เลื่อนได้ ส่วนหัว/ท้ายอยู่กับที่ */
function ResponsiveModalBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6', className)}
      {...props}
    />
  );
}

function ResponsiveModalFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'bg-card shrink-0 border-t px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-3',
        className
      )}
      {...props}
    />
  );
}

export {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalBody,
  ResponsiveModalFooter,
};
