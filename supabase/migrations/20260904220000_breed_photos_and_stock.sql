-- รูปปลาจริง + ป้าย "หมด / มีขาย" บนหน้าเว็บฟาร์ม
--
-- ตอนทำ 20260904200000_public_showcase ตั้งใจให้ image_url เป็นลิงก์จากเพจร้าน
-- เพื่อไม่กิน egress ของ Supabase — แต่ TikTok/Facebook บล็อก hotlink และ URL
-- มีโทเคนหมดอายุ อีกไม่กี่เดือนรูปจะพังทั้งหน้าโดยไม่มีใครรู้ตัว
-- จึงย้ายมาเก็บเองในบัคเก็ต แล้วคุมขนาดไฟล์แทนการหวังว่าคนอัปจะย่อรูปมาก่อน
--
-- image_url ยังเป็น text เหมือนเดิม ลิงก์นอกที่ใส่ไว้แล้วใช้ได้ต่อ ไม่ต้องย้ายข้อมูล

-- ── 1. ที่เก็บรูปปลา ────────────────────────────────────────────────
--
-- public เหมือนบัคเก็ต notices — รูปโชว์สินค้าไม่มีอะไรต้องปิด และ signed URL
-- ที่หมดอายุจะทำให้รูปหายจากหน้าเว็บของคนที่เปิดค้างไว้
--
-- ⚠️ file_size_limit 600KB ไม่ใช่เลขมั่ว มันคือด่านสุดท้ายที่กัน egress:
--    แพลนฟรีมี egress 5GB/เดือน และ "ไม่มี" Image Transformation (เป็นของ Pro)
--    แปลว่าอัปไฟล์ใหญ่เข้ามาเท่าไหร่ ลูกค้าโหลดเท่านั้นทุกครั้ง ย่อทีหลังไม่ได้
--    ฝั่งเว็บย่อให้เหลือ ~150KB ก่อนอัปอยู่แล้ว (src/utils/image.ts)
--    เลขนี้ไว้ดักกรณีมีคนอัปผ่านแดชบอร์ดตรง ๆ ข้ามหน้าเว็บไป
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('breeds', 'breeds', true, 614400, array['image/webp', 'image/jpeg'])
on conflict (id) do update set
  public = true,
  file_size_limit = 614400,
  allowed_mime_types = array['image/webp', 'image/jpeg'];

drop policy if exists "breeds_public_read" on storage.objects;
create policy "breeds_public_read"
  on storage.objects for select to public
  using (bucket_id = 'breeds');

-- อัป/ทับ/ลบได้เฉพาะร้านที่ล็อกอินแล้ว — ลูกค้าไม่มีสิทธิ์เขียนบัคเก็ตนี้
drop policy if exists "breeds_authenticated_write" on storage.objects;
create policy "breeds_authenticated_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'breeds');

drop policy if exists "breeds_authenticated_update" on storage.objects;
create policy "breeds_authenticated_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'breeds');

-- ลบได้ ไม่งั้นรูปที่ถูกเปลี่ยนจะค้างกินพื้นที่ 1GB ไปเรื่อย ๆ
drop policy if exists "breeds_authenticated_delete" on storage.objects;
create policy "breeds_authenticated_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'breeds');

-- ── 2. หมด หรือมีขายอยู่ ────────────────────────────────────────────
--
-- นี่คือสวิตช์ ไม่ใช่จำนวน — ร้านไม่ได้นับสต็อกและไม่ได้อยากนับ
-- ค่าเดียวที่ตอบคำถามลูกค้าได้คือ "ตอนนี้สั่งได้ไหม" ซึ่งร้านรู้อยู่แล้วในหัว
--
-- default true เพราะพันธุ์ที่มีอยู่ในระบบตอนนี้คือของที่ขายอยู่
-- ถ้า default false หน้าเว็บจะขึ้นว่าหมดทั้งร้านทันทีที่ push migration
alter table public.breeds add column if not exists in_stock boolean not null default true;

-- ── 3. ส่งสถานะออกหน้าเว็บ ──────────────────────────────────────────
--
-- พันธุ์ที่หมดยัง "ส่งออก" ไปแสดงเหมือนเดิม ไม่ได้กรองทิ้ง — ลูกค้าที่ตามหาพันธุ์นี้
-- ควรได้เห็นว่าร้านมีพันธุ์นี้และทักมาถามรอบหน้าได้ ดีกว่าเปิดมาแล้วไม่เจอเลย
-- แล้วเข้าใจว่าร้านไม่มี
create or replace function public.get_public_showcase()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'breeds', coalesce(
      (
        select jsonb_agg(b order by b.name)
        from (
          -- เลือกทีละคอลัมน์ ไม่ใช้ to_jsonb(breeds) เพราะวันหน้ามีคนเพิ่มคอลัมน์
          -- ต้นทุนเข้ามาอีก แล้วมันจะไหลออกหน้าเว็บเองโดยไม่มีใครทันสังเกต
          select
            breeds.id,
            breeds.name,
            breeds.blurb,
            breeds.image_url,
            breeds.in_stock,
            breeds.premium_price_piece as price_piece,
            breeds.premium_price_pair  as price_pair,
            breeds.premium_price_set   as price_set
          from public.breeds
          where breeds.showcase
            and coalesce(breeds.premium_price_piece, 0) > 0
        ) as b
      ),
      '[]'::jsonb
    ),

    -- ตัวเลขที่ใช้สร้างความน่าเชื่อถือ — ต้องเป็นของจริง ไม่ใช่เลขที่พิมพ์ใส่หน้าเว็บ
    'stats', jsonb_build_object(
      'breeds', (select count(*) from public.breeds where showcase),
      -- นับเฉพาะบิลที่ส่งของจริง บิลที่ยกเลิกไม่ใช่ผลงาน
      'orders', (select count(*) from public.orders where coalesce(status, '') <> 'cancelled'),
      'fish',   (select coalesce(sum(total_fish), 0) from public.orders where coalesce(status, '') <> 'cancelled'),
      'since',  (select extract(year from min(created_at))::int from public.orders)
    )
  );
$$;

revoke all on function public.get_public_showcase() from public;
grant execute on function public.get_public_showcase() to anon, authenticated;
