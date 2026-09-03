-- ข้อความที่ส่งหาลูกค้า แก้ได้จากหน้าตั้งค่า
--
-- เดิมกระจายอยู่ 3 ที่: โค้ดบอท, หน้าแอดมิน และในตัวฟังก์ชัน SQL เอง
-- อยากแก้คำเดียวต้องรอ deploy และต้องรู้ว่าคำนั้นอยู่ที่ไหน
--
-- ตัวแปรเขียนแบบ {{ชื่อ}} ผู้เรียกเป็นคนแทนค่า
-- เก็บ variables ไว้ด้วยเพื่อให้หน้าตั้งค่าโชว์ได้ว่าข้อความนี้ใช้ตัวแปรอะไรได้บ้าง
-- และเตือนเมื่อร้านเผลอลบตัวแปรสำคัญทิ้ง — ลบ {{tracking}} คือลูกค้าไม่ได้เลขพัสดุ

create table if not exists public.message_templates (
  key         text primary key,
  -- ชื่อที่โชว์ในหน้าตั้งค่า
  label       text not null,
  description text,
  -- จัดกลุ่มในหน้าตั้งค่า: push = ร้านส่งหาลูกค้า, chat = บอทตอบในแชท
  group_key   text not null default 'chat',
  body        text not null,
  variables   text[] not null default '{}',
  -- ตัวแปรที่ขาดไม่ได้ ใช้เตือนตอนบันทึก
  required    text[] not null default '{}',
  sort_order  integer not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.message_templates enable row level security;

-- ร้านอ่าน/แก้ได้ บอทใช้ service_role ซึ่งข้าม RLS อยู่แล้ว
-- anon ไม่มี policy = แตะไม่ได้
drop policy if exists message_templates_authenticated_all on public.message_templates;
create policy message_templates_authenticated_all
  on public.message_templates for all to authenticated
  using (true) with check (true);

-- ── ค่าเริ่มต้น = ข้อความที่ใช้อยู่เดิมทุกตัวอักษร ────────────────────
-- on conflict do nothing เพื่อให้รัน migration ซ้ำแล้วไม่ทับของที่ร้านแก้ไปแล้ว
insert into public.message_templates (key, label, description, group_key, body, variables, required, sort_order) values

-- ── ร้านส่งหาลูกค้า ──
('slip_received', 'ได้รับสลิปแล้ว', 'ส่งทันทีที่ลูกค้าแนบสลิปในใบสรุป', 'push',
 E'🧾 ได้รับสลิปแล้วครับ\nบิล {{order_number}} ยอด ฿{{total}}\n\nทางร้านกำลังตรวจสอบ เมื่อยืนยันแล้วสถานะในใบสรุปจะเปลี่ยนเป็น "ชำระเงินแล้ว" ครับ 🙏',
 array['order_number','total'], array['order_number'], 10),

('payment_confirmed', 'ยืนยันรับเงินแล้ว', 'ส่งเมื่อร้านกดยืนยันสลิป', 'push',
 E'✅ ยืนยันการชำระเงินแล้วครับ\nบิล {{order_number}} · ฿{{total}}\n\nทางร้านกำลังจัดเตรียมพัสดุ เมื่อจัดส่งจะแจ้งเลขพัสดุให้อีกครั้งครับ 🐟\nดูใบสรุป: {{summary_url}}',
 array['order_number','total','summary_url'], array['order_number'], 20),

('slip_rejected', 'สลิปตรวจสอบไม่ผ่าน', 'ส่งเมื่อร้านกดปฏิเสธสลิป — {{reason}} คือเหตุผลที่เลือกไว้', 'push',
 E'⚠️ สลิปที่ส่งมายังตรวจสอบไม่ผ่านครับ\nบิล {{order_number}}\n\n{{reason}}รบกวนแนบสลิปใหม่อีกครั้งที่ลิงก์นี้ครับ 🙏\n{{summary_url}}',
 array['order_number','reason','summary_url'], array['summary_url'], 30),

('parcel_update', 'อัปเดตสถานะพัสดุ', 'ส่งทุกครั้งที่สถานะพัสดุขยับ', 'push',
 E'🔔 อัปเดตพัสดุ {{tracking}}\n📍 {{status}}: {{location}}\n🕐 {{time}}',
 array['tracking','status','location','time'], array['tracking'], 40),

('parcel_delivered', 'พัสดุถึงมือลูกค้าแล้ว', 'ส่งเมื่อไปรษณีย์แจ้งว่านำจ่ายสำเร็จ', 'push',
 E'✅ พัสดุ {{tracking}} นำจ่ายสำเร็จแล้วครับ',
 array['tracking'], array['tracking'], 50),

-- ── บอทตอบในแชท ──
('cmd_help', 'ช่วยเหลือ', 'ตอบเมื่อลูกค้าพิมพ์ "ช่วยเหลือ" หรือกดปุ่มริชเมนู', 'chat',
 E'📌 วิธีใช้งาน\n\n📦 ติดตามพัสดุ\nส่งเลขพัสดุ เช่น EF123456789TH\n\n📋 ดูรายการที่ติดตาม\nพิมพ์: รายการ\n\n❌ ยกเลิกติดตาม\nพิมพ์: ยกเลิก EF123456789TH\n\n🧾 ดูบิลค้างชำระ\nพิมพ์: บิล\n\n💸 แจ้งโอนเงิน\nพิมพ์ "บิล" แล้วกดลิงก์ใบสรุป\nจะมีปุ่มแนบสลิปอยู่ในนั้นครับ\n\n🔔 ระบบจะแจ้งเตือนอัตโนมัติเมื่อสถานะพัสดุเปลี่ยน',
 array[]::text[], array[]::text[], 60),

('cmd_track_prompt', 'กดปุ่มติดตามพัสดุ', 'ตอบเมื่อกดปุ่มริชเมนู "ติดตามพัสดุ"', 'chat',
 E'📦 ส่งเลขพัสดุมาได้เลยครับ\nเช่น EF123456789TH\n\nระบบจะแจ้งเตือนให้อัตโนมัติเมื่อสถานะเปลี่ยน 🔔',
 array[]::text[], array[]::text[], 70),

('list_empty', 'ไม่มีพัสดุที่ติดตาม', 'ตอบเมื่อกด "รายการติดตาม" แล้วยังไม่มีอะไร', 'chat',
 E'📭 ไม่มีพัสดุที่กำลังติดตามอยู่ครับ\nส่งเลขพัสดุมาได้เลย',
 array[]::text[], array[]::text[], 80),

('list_header', 'หัวข้อรายการติดตาม', 'บรรทัดบนสุดก่อนรายชื่อเลขพัสดุ', 'chat',
 E'📦 พัสดุที่กำลังติดตาม:',
 array[]::text[], array[]::text[], 90),

('list_footer', 'ท้ายรายการติดตาม', 'บรรทัดล่างสุดหลังรายชื่อเลขพัสดุ', 'chat',
 E'พิมพ์ "ยกเลิก [เลขพัสดุ]" เพื่อหยุดติดตาม',
 array[]::text[], array[]::text[], 100),

('cancel_ok', 'ยกเลิกติดตามสำเร็จ', null, 'chat',
 E'✅ ยกเลิกการติดตามพัสดุ {{tracking}} แล้วครับ',
 array['tracking'], array[]::text[], 110),

('cancel_not_found', 'ยกเลิกไม่สำเร็จ', 'ลูกค้าพิมพ์เลขที่ไม่ได้ติดตามอยู่', 'chat',
 E'ไม่พบพัสดุ {{tracking}} ในรายการติดตามของคุณครับ',
 array['tracking'], array[]::text[], 120),

('track_subscribed', 'เริ่มติดตามให้แล้ว', 'ตอบหลังลูกค้าส่งเลขพัสดุเข้ามาครั้งแรก', 'chat',
 E'🔔 ระบบจะแจ้งเตือนอัตโนมัติเมื่อสถานะพัสดุ {{tracking}} เปลี่ยนแปลงครับ',
 array['tracking'], array[]::text[], 130),

('track_not_found', 'ไม่พบเลขพัสดุ', 'ไปรษณีย์ยังไม่มีข้อมูลเลขนี้', 'chat',
 E'ไม่พบข้อมูลพัสดุ {{tracking}} ครับ\nกรุณาตรวจสอบเลขพัสดุอีกครั้ง',
 array['tracking'], array[]::text[], 140),

('track_error', 'ตรวจสอบพัสดุไม่สำเร็จ', 'ระบบไปรษณีย์มีปัญหาชั่วคราว', 'chat',
 E'ไม่สามารถตรวจสอบพัสดุ {{tracking}} ได้\nกรุณาลองใหม่อีกครั้ง',
 array['tracking'], array[]::text[], 150),

('bills_empty', 'ไม่มีบิลค้างชำระ', null, 'chat',
 E'🧾 ตอนนี้ไม่มีบิลค้างชำระครับ\n\nถ้าเพิ่งสั่งของแล้วยังไม่เห็นบิล รอทางร้านสรุปให้สักครู่นะครับ 🙏',
 array[]::text[], array[]::text[], 160),

('bills_footer', 'ท้ายรายการบิลค้าง', 'บรรทัดล่างสุดหลังรายชื่อบิล', 'chat',
 E'กดลิงก์เพื่อดูรายการ ชำระเงิน และแจ้งที่อยู่ได้เลยครับ',
 array[]::text[], array[]::text[], 170),

('slip_via_chat', 'ลูกค้าส่งรูปเข้าแชท', 'บอกให้ไปแนบที่หน้าใบสรุปแทน', 'chat',
 E'🧾 ถ้าเป็นสลิปโอนเงิน รบกวนแนบที่หน้าใบสรุปแทนนะครับ\nระบบจะได้รู้ว่าเป็นของบิลไหนทันที ไม่ต้องรอร้านมาจับคู่',
 array[]::text[], array[]::text[], 180)

on conflict (key) do nothing;

-- ── ให้ SQL ดึงข้อความไปใช้ได้ ───────────────────────────────────────
-- submit_order_slip เป็นฟังก์ชันฝั่งฐานข้อมูล จึงต้องอ่านเองไม่ผ่านโค้ดแอป
create or replace function public.render_template(p_key text, p_vars jsonb default '{}'::jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tpl text;
  k   text;
  v   text;
begin
  select body into tpl from public.message_templates where key = p_key;
  if tpl is null then
    return null;
  end if;

  for k, v in select key, value from jsonb_each_text(coalesce(p_vars, '{}'::jsonb)) loop
    tpl := replace(tpl, '{{' || k || '}}', coalesce(v, ''));
  end loop;

  return tpl;
end;
$$;

revoke all on function public.render_template(text, jsonb) from public;
grant execute on function public.render_template(text, jsonb) to authenticated, service_role;

-- ── ให้ข้อความ "ได้รับสลิปแล้ว" อ่านจากตาราง ────────────────────────
-- เดิมข้อความฝังอยู่ในตัวฟังก์ชัน แก้คำทีต้องเขียน migration ใหม่ทุกครั้ง
create or replace function public.submit_order_slip(
  p_token        text,
  p_path         text,
  p_line_user_id text default null,
  p_image_hash   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o        public.orders%rowtype;
  prefix   text;
  fname    text;
  n_slips  int;
  owner_id text;
  hash     text;
  msg      text;
begin
  if p_token is null or length(p_token) < 16 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token');
  end if;

  select * into o from public.orders where public_token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if o.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'already_shipped');
  end if;

  prefix := 'p/' || p_token || '/';
  if p_path is null or left(p_path, length(prefix)) <> prefix then
    return jsonb_build_object('ok', false, 'reason', 'bad_path');
  end if;

  fname := substring(p_path from length(prefix) + 1);
  if fname = '' or position('/' in fname) > 0 then
    return jsonb_build_object('ok', false, 'reason', 'bad_path');
  end if;

  hash := lower(nullif(btrim(coalesce(p_image_hash, '')), ''));
  if hash is not null and hash !~ '^[0-9a-f]{64}$' then
    hash := null;
  end if;

  -- ไฟล์เดิมของบิลเดิมที่ยังรอตรวจอยู่ = กดส่งซ้ำ ไม่ต้องเพิ่มแถว
  if hash is not null and exists (
    select 1 from public.payment_slips
    where order_id = o.id and image_hash = hash and status = 'pending'
  ) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  select count(*) into n_slips
  from public.payment_slips
  where order_id = o.id and status = 'pending';

  if n_slips >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'too_many');
  end if;

  owner_id := nullif(btrim(coalesce(p_line_user_id, '')), '');
  if owner_id is not null and owner_id !~ '^U[0-9a-f]{32}$' then
    owner_id := null;
  end if;
  owner_id := coalesce(owner_id, o.line_user_id, 'web:' || p_token);

  insert into public.payment_slips (order_id, line_user_id, image_path, image_hash)
  values (o.id, owner_id, p_path, hash);

  if n_slips = 0 and owner_id ~ '^U[0-9a-f]{32}$' then
    msg := public.render_template('slip_received', jsonb_build_object(
      'order_number', o.order_number,
      'total', to_char(coalesce(o.total_amount, 0), 'FM999,999,999')
    ));

    if msg is not null then
      insert into public.line_notifications (line_user_id, order_id, message)
      values (owner_id, o.id, msg);
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.submit_order_slip(text, text, text, text) from public;
grant execute on function public.submit_order_slip(text, text, text, text) to anon, authenticated;
