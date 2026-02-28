import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mowhbttcrnohkljbasxc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vd2hidHRjcm5vaGtsamJhc3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mjc4NjgsImV4cCI6MjA4NjQwMzg2OH0.E5SI2UxQpHzfjBOCbVCiaaCRp7Dv-h-Z06l5sNRuNTI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
