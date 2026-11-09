-- บิลเดียวแต่แยกส่งหลายกล่อง
--
-- ระบบเดิมตั้งอยู่บน 1 บิล = 1 เลขพัสดุ (orders.tracking_number คอลัมน์เดียว)
-- ทางกลับกันรองรับไว้ดีแล้ว — 2 บิลแพ็ครวมกล่องเดียวใช้เลขร่วมกันได้
-- แต่ 1 บิลแตก 2 กล่องไม่มีที่ให้เก็บเลขที่สอง
--
-- ถ้าร้านพิมพ์สองเลขลงช่องเดียว ทั้งสตริงจะถูกส่งไปถามไปรษณีย์เป็นบาร์โค้ดเดียว
-- ไม่เจอข้อมูล ลูกค้าเห็นการ์ดเทา "ยังไม่มีข้อมูลจากไปรษณีย์" ค้างตลอดไป และไม่มี error ให้ร้านรู้
--
-- ของจริงที่เก็บรายการกล่องคือ parcel_subscriptions อยู่แล้ว (order_id + index พร้อม)
-- ที่ขาดคือช่องเก็บเลขหลายอันในบิล กับตัวซิงก์ที่มองเห็นได้ทีละเลข

begin;

-- ── 1. รายการกล่องของบิล ────────────────────────────────────────────
--
-- tracking_numbers คือของจริง tracking_number เหลือไว้เป็นเงาของกล่องแรก
-- เพราะมีโค้ดอ่านมันอยู่หลายที่ทั้งสองรีโป (ใบสรุป, ปิดบิลตอนของถึง, เช็คก่อนรวมบิล)
-- เปลี่ยนทั้งหมดพร้อมกันในที่ที่บั๊กทำให้ลูกค้าได้ข้อความผิดเสี่ยงเกินไป
alter table public.orders
  add column if not exists tracking_numbers text[] not null default '{}';

comment on column public.orders.tracking_numbers is
  'เลขพัสดุทุกกล่องของบิลนี้ เรียงตามลำดับที่กรอก — เขียนที่นี่ที่เดียว';
comment on column public.orders.tracking_number is
  'เงาของ tracking_numbers[1] ซิงก์โดย trigger orders_mirror_tracking — อย่าเขียนตรง ๆ ในโค้ดใหม่';

update public.orders
set tracking_numbers = array[btrim(tracking_number)]
where nullif(btrim(coalesce(tracking_number, '')), '') is not null
  and cardinality(tracking_numbers) = 0;

-- ── 2. กันสองช่องเพี้ยนจากกัน ────────────────────────────────────────
--
-- เขียนช่องไหนมาก็ได้ ตัวนี้จับให้ตรงกันก่อนลงตาราง
-- โค้ดเก่าที่ยังเขียน tracking_number อยู่จึงไม่พัง และไม่ลบกล่องอื่นทิ้งด้วย
create or replace function public.orders_mirror_tracking()
returns trigger
language plpgsql
as $$
declare
  cleaned      text[];
  list_changed boolean;
begin
  -- old ยังไม่มีค่าตอน INSERT แตะได้เฉพาะตอน UPDATE
  -- (plpgsql ไม่รับประกันว่า or จะลัดวงจร เลยแยกออกมาคิดก่อน)
  if tg_op = 'INSERT' then
    list_changed := true;
  else
    list_changed := new.tracking_numbers is distinct from old.tracking_numbers;
  end if;

  -- เขียน array มา → ล้างให้เรียบร้อยแล้วค่อยสะท้อนลงช่องเงา
  if list_changed then
    select coalesce(array_agg(distinct_number order by ord), '{}'::text[])
      into cleaned
      from (
        select upper(btrim(n)) as distinct_number, min(i) as ord
        from unnest(coalesce(new.tracking_numbers, '{}'::text[])) with ordinality as t(n, i)
        where nullif(btrim(n), '') is not null
        group by upper(btrim(n))
      ) q;

    new.tracking_numbers := cleaned;
    new.tracking_number  := cleaned[1];
    return new;
  end if;

  -- เขียนช่องเงามาอย่างเดียว = แก้เลขกล่องแรก กล่องที่เหลือต้องอยู่ครบ
  if new.tracking_number is distinct from old.tracking_number then
    if nullif(btrim(coalesce(new.tracking_number, '')), '') is null then
      new.tracking_numbers := coalesce(new.tracking_numbers[2:], '{}'::text[]);
      new.tracking_number  := new.tracking_numbers[1];
    else
      new.tracking_number := upper(btrim(new.tracking_number));
      new.tracking_numbers :=
        array[new.tracking_number] || coalesce(new.tracking_numbers[2:], '{}'::text[]);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_mirror_tracking on public.orders;
create trigger orders_mirror_tracking
  before insert or update of tracking_number, tracking_numbers on public.orders
  for each row execute function public.orders_mirror_tracking();

-- ── 3. สมัครติดตามทีละกล่อง ─────────────────────────────────────────
--
-- ของเดิมอ่าน o.tracking_number ค่าเดียวแล้วตัดสินใจครั้งเดียว
-- ตอนนี้วนทุกกล่อง เหตุผลรายกล่องเหมือนเดิมทุกข้อ (ดู 20260916060000)
-- แล้วปิดท้ายด้วยการเก็บแถวของกล่องที่ถูกลบออกจากบิลไปแล้ว
create or replace function public.sync_parcel_subscription(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o         public.orders%rowtype;
  ex        public.parcel_subscriptions%rowtype;
  tracking  text;
  other     text;
  results   jsonb := '[]'::jsonb;
  taken_by  text;
  mate_id   uuid;
  stale     text;
begin
  select * into o from public.orders where id = p_order_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- ถึงมือแล้วหรือยกเลิกไปแล้ว ไม่มีอะไรให้ตามต่อ
  if o.status in ('delivered', 'cancelled') then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;

  if cardinality(coalesce(o.tracking_numbers, '{}')) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_tracking');
  end if;

  if o.line_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_line_user');
  end if;

  -- กล่องที่ถูกเอาออกจากบิลแล้ว — ยกให้บิลอื่นที่ยังใช้เลขนั้น ไม่งั้นลบทิ้ง
  -- (เดิมอยู่ในตัว trigger เพราะมีเลขเดียวให้เทียบ ตอนนี้ต้องเทียบทั้งรายการ)
  for stale in
    select s.tracking_number
    from public.parcel_subscriptions s
    where s.order_id = o.id
      and not (s.tracking_number = any (o.tracking_numbers))
  loop
    select id into mate_id
    from public.orders
    where id <> o.id
      and stale = any (coalesce(tracking_numbers, '{}'))
      and status not in ('delivered', 'cancelled')
    order by created_at
    limit 1;

    if mate_id is not null then
      update public.parcel_subscriptions
      set order_id = mate_id
      where tracking_number = stale;
    else
      delete from public.parcel_subscriptions where tracking_number = stale;
    end if;
  end loop;

  foreach tracking in array o.tracking_numbers loop
    select * into ex from public.parcel_subscriptions where tracking_number = tracking;

    if not found then
      insert into public.parcel_subscriptions (tracking_number, line_user_id, order_id)
      values (tracking, o.line_user_id, o.id);
      results := results || jsonb_build_object('tracking', tracking, 'action', 'created');
      continue;
    end if;

    -- เลขนี้ติดตามอยู่แล้วและเป็นของลูกค้าคนเดียวกัน
    -- (ส่งรวมกล่องเดียวสองบิลก็มาทางนี้ — ปล่อยให้บิลแรกถือการติดตามไว้คนเดียวพอ)
    -- ห้ามแตะ last_status เด็ดขาด ล้างเมื่อไหร่ลูกค้าโดนแจ้งสถานะที่เคยได้ไปแล้วซ้ำ
    if ex.line_user_id = o.line_user_id then
      if ex.order_id is null then
        update public.parcel_subscriptions
        set order_id = o.id
        where tracking_number = tracking;
        results := results || jsonb_build_object('tracking', tracking, 'action', 'reattached');
      else
        results := results || jsonb_build_object(
          'tracking', tracking,
          'action', case when ex.order_id = o.id then 'unchanged' else 'shared' end
        );
      end if;
      continue;
    end if;

    -- จะย้ายการติดตามไปให้บัญชี LINE คนอื่น ซึ่งเป็นท่าที่ทำลูกค้าหลุดมาแล้ว
    if ex.order_id is not null and ex.order_id <> o.id then
      select order_number into other from public.orders where id = ex.order_id;
      taken_by := coalesce(taken_by, other);
      results := results || jsonb_build_object(
        'tracking', tracking,
        'action', 'taken_by_other_order',
        'order_number', other
      );
      continue;
    end if;

    -- แถวกำพร้า หรือบิลนี้เองที่เพิ่งเปลี่ยนไปผูกกับบัญชี LINE ใหม่
    update public.parcel_subscriptions
    set line_user_id = o.line_user_id,
        order_id     = o.id,
        last_status  = null
    where tracking_number = tracking;
    results := results || jsonb_build_object('tracking', tracking, 'action', 'moved');
  end loop;

  -- สัญญาเดิมกับหน้าแอดมิน: ok=false + reason='taken_by_other_order' เมื่อมีเลขชน
  if taken_by is not null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'taken_by_other_order',
      'order_number', taken_by,
      'results', results
    );
  end if;

  return jsonb_build_object('ok', true, 'results', results);
end;
$$;

revoke all on function public.sync_parcel_subscription(uuid) from public;
grant execute on function public.sync_parcel_subscription(uuid) to authenticated;

-- ── 4. trigger เรียกตัวซิงก์ ────────────────────────────────────────
-- การเก็บกวาดกล่องที่ถูกเอาออกย้ายเข้าไปอยู่ในตัวซิงก์แล้ว ตรงนี้เหลือแค่เรียก
create or replace function public.orders_sync_parcel_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if cardinality(coalesce(new.tracking_numbers, '{}')) > 0 and new.line_user_id is not null then
    -- ล้มเหลวไม่ควรทำให้การบันทึกบิลพัง — ฟังก์ชันคืน jsonb ไม่ raise อยู่แล้ว
    perform public.sync_parcel_subscription(new.id);
  end if;
  return null;
end;
$$;

-- เดิม trigger ฟังแค่ tracking_number — เขียน tracking_numbers อย่างเดียวจะไม่ยิง
-- (update of ดูว่าคำสั่งเอ่ยถึงคอลัมน์ไหน ไม่ได้ดูว่าค่าไหนเปลี่ยน ตัว mirror จึงช่วยตรงนี้ไม่ได้)
drop trigger if exists orders_sync_parcel_subscription on public.orders;
create trigger orders_sync_parcel_subscription
after insert or update of line_user_id, tracking_number, tracking_numbers on public.orders
for each row execute function public.orders_sync_parcel_subscription();

-- ── 5. ปิดบิลเมื่อครบทุกกล่อง ───────────────────────────────────────
--
-- markDelivered ฝั่งบอทเดิมปิดบิลทันทีที่กล่องใดกล่องหนึ่งถึง
-- พอบิลขึ้น "ถึงแล้ว" ตัวซิงก์จะเห็นว่าบิลปิดแล้วและหยุดตามกล่องที่เหลือ
-- ลูกค้าที่รอกล่องสองจึงไม่มีวันรู้ว่าของถึงไหน
create or replace function public.close_order_if_all_delivered(
  p_order_id     uuid,
  p_delivered_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o         public.orders%rowtype;
  remaining int;
begin
  select * into o from public.orders where id = p_order_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- บิลที่ไม่เคยมีเลขพัสดุก็ไม่มีแถวติดตามเหมือนกัน ต้องไม่ถูกนับว่า "ครบทุกกล่องแล้ว"
  if cardinality(coalesce(o.tracking_numbers, '{}'::text[])) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_tracking');
  end if;

  -- แถวติดตามจะถูกลบทิ้งตอนกล่องนั้นถึงแล้ว เหลือกี่แถวคือเหลือกี่กล่องที่ยังเดินทาง
  select count(*) into remaining
  from public.parcel_subscriptions
  where order_id = p_order_id;

  if remaining > 0 then
    return jsonb_build_object('ok', false, 'reason', 'boxes_in_transit', 'remaining', remaining);
  end if;

  update public.orders
  set status = 'delivered',
      delivered_at = p_delivered_at
  where id = p_order_id
    and (
      status in ('pending', 'shipped')
      or (status = 'delivered' and delivered_at is null)
    );

  return jsonb_build_object('ok', true, 'boxes', cardinality(coalesce(o.tracking_numbers, '{}')));
end;
$$;

revoke all on function public.close_order_if_all_delivered(uuid, timestamptz) from public;
grant execute on function public.close_order_if_all_delivered(uuid, timestamptz) to service_role;
grant execute on function public.close_order_if_all_delivered(uuid, timestamptz) to authenticated;

-- ── 6. ใบสรุปต้องเห็นทุกกล่อง ───────────────────────────────────────
-- ต่อยอดจากสำเนาล่าสุด (20260907180000) เพิ่มรายการกล่องอย่างเดียว
-- tracking_number ยังส่งไปเหมือนเดิม หน้าเว็บเวอร์ชันเก่าที่ยังไม่ deploy จะได้ไม่จอขาว
create or replace function public.get_public_order(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o           public.orders%rowtype;
  s           public.settings%rowtype;
  acct        public.payment_accounts%rowtype;
  safe_items  jsonb;
  slip_state  text;
  slip_note   text;
begin
  if p_token is null or length(p_token) < 16 then
    return null;
  end if;

  select * into o from public.orders where public_token = p_token;
  if not found then
    return null;
  end if;

  select * into s from public.settings limit 1;

  if coalesce(o.payment_status, 'unpaid') <> 'unpaid' and o.payment_account_id is not null then
    select * into acct from public.payment_accounts where id = o.payment_account_id;
  end if;

  if acct.id is null then
    select * into acct from public.payment_accounts
    where is_active and not archived
    limit 1;
  end if;

  if acct.id is null and o.payment_account_id is not null then
    select * into acct from public.payment_accounts where id = o.payment_account_id;
  end if;

  -- ตัด cost ทิ้งทีละรายการ ห้ามให้ต้นทุนหลุดออกไปกับใบสรุป
  select coalesce(jsonb_agg(item - 'cost'), '[]'::jsonb)
    into safe_items
    from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) as item;

  select ps.status, ps.review_note into slip_state, slip_note
  from public.payment_slips ps
  where ps.order_id = o.id
  order by ps.created_at desc
  limit 1;

  return jsonb_build_object(
    'order_number',          o.order_number,
    'created_at',            o.created_at,
    'items',                 safe_items,
    'total_amount',          o.total_amount,
    'total_fish',            o.total_fish,
    'shipping_fee',          o.shipping_fee,
    'discount',              o.discount,
    'status',                o.status,
    'payment_status',        o.payment_status,
    'paid_amount',           o.paid_amount,
    'tracking_number',       o.tracking_number,
    'tracking_numbers',      to_jsonb(coalesce(o.tracking_numbers, '{}'::text[])),
    'customer_name',         o.customer_name,
    'customer_phone',        o.customer_phone,
    'customer_address',      o.customer_address,
    'note',                  o.note,
    'slip_status',           slip_state,
    'slip_note',             slip_note,
    'line_display_name',     o.line_display_name,
    'contact_from_customer', o.contact_from_customer,
    'payment', jsonb_build_object(
      'promptpay_id',   coalesce(acct.promptpay_id,   s.promptpay_id),
      'bank_name',      coalesce(acct.bank_name,      s.bank_name),
      'account_number', coalesce(acct.account_number, s.account_number),
      'account_name',   coalesce(acct.account_name,   s.account_name)
    )
  );
end;
$$;

commit;
