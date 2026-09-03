import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Save, Truck, X } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// ข้อความ + รูปที่ส่งให้ลูกค้าตอนแจ้งเลขพัสดุ
//
// เดิมร้านพิมพ์เองในไลน์ทุกบิล แล้วส่งรูปตามอีก 2 ใบ
// ทำมือทุกครั้งแปลว่าลืมได้ และคำก็เพี้ยนไปเรื่อย ๆ
//
// เก็บเป็นการตั้งค่าเพราะลิงก์ TikTok กับคำขอรีวิวเปลี่ยนบ่อย
// ฝังในโค้ดแล้วต้องรอ deploy ทุกครั้งที่อยากแก้คำ

const MAX_IMAGES = 4; // LINE ส่งได้ 5 ชิ้นต่อคำขอ กันไว้ 1 ให้ข้อความ
const MAX_BYTES = 5 * 1024 * 1024;

export default function ShippingNoticeCard({ settingsId }: { settingsId: string | null }) {
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('settings')
        .select('shipping_message, shipping_images')
        .limit(1)
        .maybeSingle();
      setMessage(data?.shipping_message || '');
      setImages(data?.shipping_images || []);
      setLoading(false);
    })();
  }, []);

  const upload = async (file: File) => {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('รองรับเฉพาะ JPG และ PNG');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('ไฟล์ใหญ่เกิน 5MB รบกวนย่อรูปก่อนครับ');
      return;
    }
    if (images.length >= MAX_IMAGES) {
      toast.error(`แนบได้สูงสุด ${MAX_IMAGES} รูป`);
      return;
    }

    setUploading(true);
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const path = `shipping/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('notices')
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) {
      setUploading(false);
      toast.error('อัปโหลดไม่สำเร็จ');
      return;
    }

    // บัคเก็ตนี้ public จึงใช้ URL ถาวรได้ — signed URL จะหมดอายุแล้วรูปในแชทเก่าพัง
    const { data } = supabase.storage.from('notices').getPublicUrl(path);
    setImages((prev) => [...prev, data.publicUrl]);
    setUploading(false);
    toast.success('เพิ่มรูปแล้ว — กดบันทึกเพื่อใช้งาน');
  };

  const save = async () => {
    if (!settingsId) {
      toast.error('ยังไม่มีข้อมูลตั้งค่าร้าน กรุณาบันทึกบัญชี/ค่าส่งก่อน');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('settings')
      .update({ shipping_message: message.trim() || null, shipping_images: images })
      .eq('id', settingsId);
    setSaving(false);

    if (error) {
      toast.error('บันทึกไม่สำเร็จ');
      return;
    }
    toast.success('บันทึกแล้ว', { description: 'บิลที่แจ้งเลขพัสดุหลังจากนี้จะได้ข้อความชุดนี้' });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2">
          <Truck className="text-primary mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-medium">ข้อความตอนแจ้งเลขพัสดุ</p>
            <p className="text-muted-foreground text-sm">
              ส่งให้ลูกค้าอัตโนมัติทันทีที่กดบันทึกเลขพัสดุในบิล
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ship-msg">ข้อความ</Label>
          <Textarea
            id="ship-msg"
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              'เช็คเลขได้ที่ https://track.thailandpost.co.th/\n\nบ้านหมีฝากรีวิว ติ/ชม หน้าช่องด้วยนะค้าบ'
            }
          />
          <p className="text-muted-foreground text-xs">
            เลขพัสดุกับชื่อบิลระบบใส่ให้เองด้านบนแล้ว ตรงนี้พิมพ์เฉพาะส่วนที่อยากบอกเพิ่ม
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>รูปแนบ</Label>
            <span className="text-muted-foreground text-xs">
              {images.length}/{MAX_IMAGES}
            </span>
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((url, i) => (
                <div key={url} className="group relative">
                  <img
                    src={url}
                    alt={`รูปแนบที่ ${i + 1}`}
                    className="bg-muted/50 aspect-square w-full rounded-lg border object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-1 right-1 size-6 rounded-full p-0"
                    onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                    aria-label={`เอารูปที่ ${i + 1} ออก`}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) upload(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={uploading || images.length >= MAX_IMAGES}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            เพิ่มรูป
          </Button>
          <p className="text-muted-foreground text-xs">
            JPG หรือ PNG ไม่เกิน 5MB · ส่งตามลำดับที่เรียงไว้
          </p>
        </div>

        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          บันทึก
        </Button>
      </CardContent>
    </Card>
  );
}
