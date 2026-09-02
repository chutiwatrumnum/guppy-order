import { useEffect, useState } from 'react';
import { Loader2, Package, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import type { Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// จัดการรายการอาหาร/สินค้าอื่นที่ไม่ใช่ปลา
// แยกจากตาราง breeds เพราะไม่มีเพศ/ตัว-คู่-ชุด และไม่นับเป็นจำนวนปลา
export default function FoodProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) toast.error('โหลดรายการอาหารไม่สำเร็จ');
    else setProducts((data || []) as Product[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addProduct = async () => {
    if (!name.trim()) {
      toast.error('กรอกชื่อสินค้าก่อน');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('products').insert({
      name: name.trim(),
      price: Number(price) || 0,
      cost: Number(cost) || 0,
    });
    setSaving(false);
    if (error) {
      toast.error('เพิ่มไม่สำเร็จ');
      return;
    }
    setName('');
    setPrice('');
    setCost('');
    toast.success('เพิ่มสินค้าแล้ว');
    load();
  };

  const removeProduct = async (id: string) => {
    if (!confirm('ลบสินค้านี้?')) return;
    // ปิดการใช้งานแทนการลบจริง เพื่อไม่ให้ออเดอร์เก่าที่อ้างถึงเสียหาย
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
    if (error) {
      toast.error('ลบไม่สำเร็จ');
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== id));
    toast.success('ลบแล้ว');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="text-warning size-4" /> อาหาร / สินค้าอื่น
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* แถวเพิ่มสินค้า — บนมือถือเรียงลงมาทีละบรรทัดจะกดง่ายกว่าบีบให้อยู่แถวเดียว */}
        <div className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem_auto]">
          <div className="space-y-1.5 sm:space-y-0">
            <Label htmlFor="food-name" className="text-muted-foreground text-xs sm:sr-only">
              ชื่อสินค้า
            </Label>
            <Input
              id="food-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addProduct();
              }}
              placeholder="ชื่อสินค้า เช่น อาหารปลา ซอง S"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:contents">
            <div className="space-y-1.5 sm:space-y-0">
              <Label htmlFor="food-price" className="text-muted-foreground text-xs sm:sr-only">
                ราคาขาย
              </Label>
              <Input
                id="food-price"
                type="number"
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addProduct();
                }}
                placeholder="ราคาขาย"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-0">
              <Label htmlFor="food-cost" className="text-muted-foreground text-xs sm:sr-only">
                ต้นทุน
              </Label>
              <Input
                id="food-cost"
                type="number"
                inputMode="numeric"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addProduct();
                }}
                placeholder="ต้นทุน"
              />
            </div>
          </div>
          <Button onClick={addProduct} disabled={saving} className="sm:w-auto">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            เพิ่ม
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            ยังไม่มีสินค้า — เพิ่มด้านบนได้เลย
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="min-w-0 truncate text-sm font-medium">{p.name}</span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold">฿{p.price.toLocaleString()}</span>
                  {(p.cost || 0) > 0 && (
                    <span className="text-muted-foreground text-xs">ทุน ฿{p.cost}</span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="ลบสินค้า"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeProduct(p.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
