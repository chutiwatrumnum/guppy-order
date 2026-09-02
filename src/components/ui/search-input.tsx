import { Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** ช่องค้นหาพร้อมปุ่มล้าง — ใช้ซ้ำในหน้าขาย/บิล/สายพันธุ์/ลูกค้า */
export function SearchInput({ value, onChange, placeholder, className }: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10 pl-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="ล้างการค้นหา"
          className="text-muted-foreground hover:bg-accent absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md transition-colors"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
