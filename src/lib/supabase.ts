import { createClient } from '@supabase/supabase-js'

// --- Project 1 (Old) ---
const PROJECT_OLD_URL = 'https://mowhbttcrnohkljbasxc.supabase.co'
const PROJECT_OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vd2hidHRjcm5vaGtsamJhc3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mjc4NjgsImV4cCI6MjA4NjQwMzg2OH0.E5SI2UxQpHzfjBOCbVCiaaCRp7Dv-h-Z06l5sNRuNTI'

// --- Project 2 (New) ---
const PROJECT_NEW_URL = 'https://kilvqwtgxuhumwocbmtv.supabase.co'
// ❗️ อย่าลืมเอา API Key อันใหม่ (anon public) มาใส่ตรงนี้นะครับ ❗️
const PROJECT_NEW_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpbHZxd3RneHVodW13b2NibXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNzU4NTEsImV4cCI6MjA4OTc1MTg1MX0.ysiiqZZkPQx9GXSNvEgobKVYiSkYIh9qRBFXbLiccnY'

// ==========================================
// ⬇️ สลับโปรเจกต์ตรงนี้ (พิมพ์คำว่า 'old' หรือ 'new') ⬇️
// ==========================================
const USE_PROJECT: 'old' | 'new' = 'new'

const supabaseUrl = USE_PROJECT === 'new' ? PROJECT_NEW_URL : PROJECT_OLD_URL
const supabaseAnonKey = USE_PROJECT === 'new' ? PROJECT_NEW_KEY : PROJECT_OLD_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
