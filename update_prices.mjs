import { createClient } from '@supabase/supabase-js'

const PROJECT_OLD_URL = 'https://mowhbttcrnohkljbasxc.supabase.co'
const PROJECT_OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vd2hidHRjcm5vaGtsamJhc3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mjc4NjgsImV4cCI6MjA4NjQwMzg2OH0.E5SI2UxQpHzfjBOCbVCiaaCRp7Dv-h-Z06l5sNRuNTI'

const PROJECT_NEW_URL = 'https://kilvqwtgxuhumwocbmtv.supabase.co'
const PROJECT_NEW_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpbHZxd3RneHVodW13b2NibXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNzU4NTEsImV4cCI6MjA4OTc1MTg1MX0.ysiiqZZkPQx9GXSNvEgobKVYiSkYIh9qRBFXbLiccnY'

const supabaseOld = createClient(PROJECT_OLD_URL, PROJECT_OLD_KEY)
const supabaseNew = createClient(PROJECT_NEW_URL, PROJECT_NEW_KEY)

async function run() {
  const updateData = {
    // Premium Grade
    premium_price_piece: 100,
    premium_cost_piece: 50,
    premium_price_pair: 200,
    premium_cost_pair: 100,
    premium_price_set: 300,
    premium_cost_set: 150,
    
    // Normal Grade
    price_piece: 40,
    cost_piece: 20,
    price_pair: 80,
    cost_pair: 40,
    price_set: 120,
    cost_set: 60
  }

  console.log('Starting mass update for NEW DB...')
  const res1 = await supabaseNew.from('breeds').update(updateData).not('id', 'is', null)
  if (res1.error) console.error("New DB Error:", res1.error)
  else console.log("New DB updated successfully!")

  console.log('Starting mass update for OLD DB...')
  const res2 = await supabaseOld.from('breeds').update(updateData).not('id', 'is', null)
  if (res2.error) console.error("Old DB Error:", res2.error)
  else console.log("Old DB updated successfully!")
}

run()
