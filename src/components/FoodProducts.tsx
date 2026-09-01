import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import type { Product } from '../types';

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

  useEffect(() => { load(); }, []);

  const addProduct = async () => {
    if (!name.trim()) { toast.error('กรอกชื่อสินค้าก่อน'); return; }
    setSaving(true);
    const { error } = await supabase.from('products').insert({
      name: name.trim(),
      price: Number(price) || 0,
      cost: Number(cost) || 0,
    });
    setSaving(false);
    if (error) { toast.error('เพิ่มไม่สำเร็จ'); return; }
    setName(''); setPrice(''); setCost('');
    toast.success('เพิ่มสินค้าแล้ว');
    load();
  };

  const removeProduct = async (id: string) => {
    if (!confirm('ลบสินค้านี้?')) return;
    // ปิดการใช้งานแทนการลบจริง เพื่อไม่ให้ออเดอร์เก่าที่อ้างถึงเสียหาย
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
    if (error) { toast.error('ลบไม่สำเร็จ'); return; }
    setProducts(prev => prev.filter(p => p.id !== id));
    toast.success('ลบแล้ว');
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-6">
      <h3 className="font-black text-lg flex items-center gap-2 text-slate-800 mb-4">
        <Package className="h-5 w-5 text-amber-500" /> อาหาร / สินค้าอื่น
      </h3>

      {/* แถวเพิ่มสินค้า */}
      <div className="grid grid-cols-12 gap-2 mb-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addProduct(); }}
          placeholder="ชื่อสินค้า เช่น อาหารปลา ซอง S"
          className="col-span-12 sm:col-span-6 h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-700 outline-none focus:border-amber-400"
        />
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addProduct(); }}
          placeholder="ราคาขาย"
          className="col-span-5 sm:col-span-2 h-11 bg-amber-50 border border-amber-200 rounded-xl px-3 text-sm font-black text-amber-700 outline-none focus:border-amber-400"
        />
        <input
          type="number"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addProduct(); }}
          placeholder="ต้นทุน"
          className="col-span-4 sm:col-span-2 h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-500 outline-none focus:border-slate-300"
        />
        <button
          onClick={addProduct}
          disabled={saving}
          className="col-span-3 sm:col-span-2 h-11 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1 active:scale-95 transition-all"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> เพิ่ม</>}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
      ) : products.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-6">ยังไม่มีสินค้า — เพิ่มด้านบนได้เลย</p>
      ) : (
        <div className="space-y-2">
          {products.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
              <span className="font-bold text-sm text-slate-700 min-w-0 truncate">{p.name}</span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-black text-amber-600">฿{p.price}</span>
                {(p.cost || 0) > 0 && <span className="text-[11px] text-slate-400">ทุน ฿{p.cost}</span>}
                <button
                  onClick={() => removeProduct(p.id)}
                  className="h-8 w-8 bg-white hover:bg-red-500 text-red-500 hover:text-white rounded-lg flex items-center justify-center transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
