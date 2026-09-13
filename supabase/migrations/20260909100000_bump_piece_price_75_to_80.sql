-- ขึ้นราคาต่อตัว 75 -> 80 เฉพาะพันธุ์ที่ทุน 35
--
-- ทุนเท่ากันแต่ราคาไม่เท่ากัน: พันธุ์ทุน 35 บางตัวขาย 80 (กำไร 45 = 56%)
-- อีกหลายตัวยังค้างที่ 75 (กำไร 40 = 53%) ทั้งที่ต้นทุนเท่ากันเป๊ะ
-- ดึงมาชนที่ 80 ให้หมด ของทุนเดียวกันจะได้ขายราคาเดียวกัน
--
-- แตะ premium_price_piece อย่างเดียว — ราคาคู่/เซ็ตไม่ยุ่ง (ดูหมายเหตุท้ายไฟล์)
-- เงื่อนไขทุนใช้ = 35 ตรง ๆ ไม่ใช้ coalesce ตั้งใจให้พันธุ์ที่ยังไม่ได้คีย์ทุน
-- (premium_cost_piece เป็น null) หลุดออกไป — ไม่รู้ทุนก็ไม่ควรไปขึ้นราคาให้
--
-- บิลเก่าไม่กระทบ: ราคาถูกก๊อปเก็บไว้ใน orders.items ตั้งแต่ตอนออกบิลแล้ว
--
-- idempotent: รันซ้ำไม่ทำอะไรเพิ่ม (รอบสองไม่เหลือแถวที่ 75 + ทุน 35 แล้ว)

-- ── 1. บอกก่อนว่าจะแก้ตัวไหนบ้าง ────────────────────────────────────
--
-- พิมพ์ชื่อออกมาก่อนแก้ ไม่ใช่แค่จำนวน เพราะนี่คือรายชื่อชุดเดียวที่ใช้ย้อนกลับได้
-- ถ้าจะ rollback ให้ก๊อปรายชื่อจาก notice นี้เก็บไว้ก่อน — ย้อนด้วย
-- "update ... set 80 -> 75 where ทุน 35" เฉย ๆ ไม่ได้ เพราะจะลากพันธุ์ที่ขาย 80
-- อยู่แต่เดิมลงมา 75 ไปด้วย แยกไม่ออกแล้วว่าตัวไหนเป็นตัวไหน
do $$
declare
  n     int;
  names text;
begin
  select count(*), string_agg(name, ', ' order by name)
    into n, names
  from public.breeds
  where premium_price_piece = 75
    and premium_cost_piece  = 35;

  if n = 0 then
    raise notice 'ℹ️ ไม่มีพันธุ์ไหนที่ราคา 75 + ทุน 35 — ไม่มีอะไรต้องแก้ (น่าจะรันไปแล้ว)';
  else
    raise notice '📋 กำลังจะขึ้นราคา % พันธุ์: %', n, names;
  end if;
end $$;

-- ── 2. ขึ้นราคา ────────────────────────────────────────────────────
update public.breeds
set    premium_price_piece = 80
where  premium_price_piece = 75
  and  premium_cost_piece  = 35;

-- ── 3. ตรวจผล ──────────────────────────────────────────────────────
do $$
declare
  n_done       int;
  n_left_75    int;
  n_no_cost    int;
begin
  select count(*) into n_done
  from public.breeds
  where premium_price_piece = 80 and premium_cost_piece = 35;

  select count(*) into n_left_75
  from public.breeds
  where premium_price_piece = 75;

  select count(*) into n_no_cost
  from public.breeds
  where premium_price_piece = 75 and premium_cost_piece is null;

  raise notice '✅ ทุน 35 ขาย 80 ตอนนี้มี % พันธุ์', n_done;

  if n_left_75 > 0 then
    raise notice 'ℹ️ ยังเหลือราคา 75 อีก % พันธุ์ — ทุนไม่ใช่ 35 เลยไม่ได้แตะตามที่สั่ง (ในนั้นเป็นพันธุ์ที่ยังไม่ได้คีย์ทุน % พันธุ์)', n_left_75, n_no_cost;
  end if;
end $$;

-- ── หมายเหตุ: ราคาคู่ยังไม่ได้ตาม ───────────────────────────────────
--
-- พันธุ์กลุ่มนี้ส่วนใหญ่ราคาคู่ = 150 ซึ่งคือ 75 x 2 พอดี (ซื้อคู่ไม่ได้ถูกลง)
-- พอตัวละขึ้นเป็น 80 คู่ที่ยังเป็น 150 จะกลายเป็นถูกกว่าซื้อแยก 10 บาท
-- ทั้งที่เมื่อก่อนเท่ากัน — เท่ากับเผลอแถมส่วนลดคู่ที่ไม่เคยตั้งใจให้
--
-- ไม่ได้แก้ให้ในไฟล์นี้เพราะสั่งมาแค่ราคาต่อตัว ถ้าอยากให้คู่ตามด้วยรันเพิ่ม:
--
--   update public.breeds
--   set    premium_price_pair = 160
--   where  premium_price_pair = 150
--     and  premium_price_piece = 80
--     and  premium_cost_piece  = 35;
