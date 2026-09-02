import { Toaster as Sonner, type ToasterProps } from 'sonner';

/** Toaster ที่ผูกกับ token สีของธีม และหลบ notch/แถบ home บนมือถือ */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-center"
      richColors
      closeButton
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          top: 'calc(env(safe-area-inset-top) + 0.5rem)',
        } as React.CSSProperties
      }
      toastOptions={{ classNames: { toast: 'rounded-xl text-sm' } }}
      {...props}
    />
  );
}

export { Toaster };
