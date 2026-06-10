import { createClient } from '@supabase/supabase-js'

// ใช้ Project เดียวกับใน supabase.ts (USE_PROJECT = 'new' → ชี้ไป OLD URL)
const supabaseUrl = 'https://mowhbttcrnohkljbasxc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vd2hidHRjcm5vaGtsamJhc3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mjc4NjgsImV4cCI6MjA4NjQwMzg2OH0.E5SI2UxQpHzfjBOCbVCiaaCRp7Dv-h-Z06l5sNRuNTI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function updatePremiumCosts() {
  console.log('🔄 กำลังอัปเดตราคา premium cost สำหรับทุกสายพันธุ์...\n')

  // Step 1: ดึงรายชื่อสายพันธุ์ทั้งหมดก่อน
  const { data: breeds, error: fetchError } = await supabase
    .from('breeds')
    .select('id, name')

  if (fetchError) {
    console.error('❌ Error ดึงข้อมูล breeds:', fetchError.message)
    process.exit(1)
  }

  console.log(`📋 พบสายพันธุ์ทั้งหมด ${breeds?.length ?? 0} รายการ`)
  breeds?.forEach(b => console.log(`   - [${b.id}] ${b.name}`))
  console.log()

  // Step 2: อัปเดตราคา premium cost ทุกพันธุ์
  // หมายเหตุ: premium_cost_piece ใน DB เป็น integer
  const { data, error: updateError } = await supabase
    .from('breeds')
    .update({
      premium_cost_piece: 35,
      premium_cost_pair: 75,
      premium_cost_set: 150,
    })
    .not('id', 'is', null) // update ทุก row

  if (updateError) {
    console.error('❌ Error อัปเดต:', updateError.message)
    process.exit(1)
  }

  console.log('✅ อัปเดตเสร็จสิ้น!')
  console.log('   premium_cost_piece = 35')
  console.log('   premium_cost_pair  = 75')
  console.log('   premium_cost_set   = 150')

  // Step 3: ตรวจสอบผลลัพธ์
  const { data: verify, error: verifyError } = await supabase
    .from('breeds')
    .select('id, name, premium_cost_piece, premium_cost_pair, premium_cost_set')

  if (!verifyError && verify) {
    console.log('\n📊 ผลลัพธ์หลังอัปเดต:')
    console.table(verify)
  }
}

updatePremiumCosts()
