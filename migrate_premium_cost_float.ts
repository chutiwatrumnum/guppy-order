import { createClient } from '@supabase/supabase-js'

// ใช้ Project เดียวกับใน supabase.ts (USE_PROJECT = 'new' → ชี้ไป OLD URL)
const supabaseUrl = 'https://mowhbttcrnohkljbasxc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vd2hidHRjcm5vaGtsamJhc3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mjc4NjgsImV4cCI6MjA4NjQwMzg2OH0.E5SI2UxQpHzfjBOCbVCiaaCRp7Dv-h-Z06l5sNRuNTI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function main() {
  console.log('🔧 Step 1: เปลี่ยน column type เป็น float8 (double precision)...')

  // ALTER TABLE ผ่าน rpc execute_sql
  const migrations = [
    `ALTER TABLE breeds ALTER COLUMN premium_cost_piece TYPE float8`,
    `ALTER TABLE breeds ALTER COLUMN premium_cost_pair TYPE float8`,
    `ALTER TABLE breeds ALTER COLUMN premium_cost_set TYPE float8`,
    `ALTER TABLE breeds ALTER COLUMN cost_piece TYPE float8`,
    `ALTER TABLE breeds ALTER COLUMN cost_pair TYPE float8`,
    `ALTER TABLE breeds ALTER COLUMN cost_set TYPE float8`,
  ]

  for (const sql of migrations) {
    const { error } = await supabase.rpc('execute_sql', { query: sql })
    if (error) {
      console.warn(`⚠️  rpc ไม่รองรับ (${error.message}), ข้ามขั้นตอน migration...`)
      console.log('   👉 กรุณารัน SQL ต่อไปนี้ใน Supabase SQL Editor แทนครับ:')
      console.log()
      for (const s of migrations) {
        console.log(`   ${s};`)
      }
      break
    } else {
      console.log(`   ✅ ${sql}`)
    }
  }

  console.log()
  console.log('💾 Step 2: อัปเดตราคา premium cost ทุกสายพันธุ์...')

  const ids = await supabase.from('breeds').select('id').then(r => r.data?.map(b => b.id) ?? [])

  let success = 0
  for (const id of ids) {
    const { error } = await supabase
      .from('breeds')
      .update({
        premium_cost_piece: 37.5,
        premium_cost_pair: 75,
        premium_cost_set: 113,
      })
      .eq('id', id)

    if (error) {
      console.error(`❌ id=${id} → ${error.message}`)
    } else {
      success++
    }
  }

  console.log(`✅ อัปเดตสำเร็จ ${success}/${ids.length} รายการ`)
  console.log('   premium_cost_piece = 37.5')
  console.log('   premium_cost_pair  = 75')
  console.log('   premium_cost_set   = 113')

  // ตรวจสอบผลลัพธ์
  const { data, error } = await supabase
    .from('breeds')
    .select('name, premium_cost_piece, premium_cost_pair, premium_cost_set')
    .limit(5)

  if (!error && data) {
    console.log('\n📊 ตัวอย่างผลลัพธ์ (5 รายการแรก):')
    console.table(data)
  }
}

main()
