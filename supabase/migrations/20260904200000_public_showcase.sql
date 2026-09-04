-- หน้าเว็บโชว์ฟาร์มสำหรับลูกค้าทั่วไป (/farm)
--
-- ต่างจากใบสรุปที่เปิดด้วย token รายบิล — หน้านี้ใครก็เปิดได้ ไม่มีอะไรให้เดา
-- จึงต้องคัดเองว่าอะไร "ออกสู่สาธารณะได้"
--
-- ข้อบังคับเดียวกับ get_public_order:
--   * anon แตะตาราง breeds ตรง ๆ ไม่ได้ — เข้าได้ผ่านฟังก์ชันนี้เท่านั้น
--   * ห้ามคืน premium_cost_* เด็ดขาด คู่แข่งเปิดหน้าเว็บก็เห็นต้นทุนร้านทันที
--   * ตัวเลขสถิติคืนเป็นยอดรวมล้วน ๆ ไม่มีทางย้อนกลับไปหาลูกค้ารายใด

-- ── 1. ฟิลด์ที่มีไว้เพื่อหน้าเว็บโดยเฉพาะ ────────────────────────────
--
-- image_url เป็น "ลิงก์" ไม่ใช่ไฟล์ในสตอเรจ — ตั้งใจตามที่คุยกันไว้ว่ารูปปลา
-- ฝากไว้ที่เพจ/TikTok ของร้านแล้ววางลิงก์มา จะไม่กิน egress ของ Supabase เลย
-- ว่างไว้ได้ หน้าเว็บจะวาดปลาการ์ตูนจากชื่อพันธุ์ให้แทน
alter table public.breeds add column if not exists image_url text;

-- คำโปรยสั้น ๆ ใต้ชื่อพันธุ์ เช่น "ครีบยาว สีเข้มตั้งแต่เล็ก"
alter table public.breeds add column if not exists blurb text;

-- ปลาบางพันธุ์รับมาขายรอบเดียวแล้วเลิก ไม่ควรค้างอยู่หน้าเว็บตลอดไป
-- ตั้ง default true เพื่อให้พันธุ์ที่มีอยู่แล้วขึ้นหน้าเว็บทันทีโดยไม่ต้องมานั่งติ๊กทีละตัว
alter table public.breeds add column if not exists showcase boolean not null default true;

-- ── 2. ข้อมูลที่หน้าเว็บดึงไปแสดง ──────────────────────────────────
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

-- ── 3. สิทธิ์ ──────────────────────────────────────────────────────
-- ถอนของ public ก่อนแล้วค่อยให้เป็นราย role — กัน role อื่นที่เพิ่มมาทีหลังได้ไปฟรี ๆ
revoke all on function public.get_public_showcase() from public;
grant execute on function public.get_public_showcase() to anon, authenticated;
