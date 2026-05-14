import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function checkSchema() {
  console.log('Checking student_profiles table...')
  const { data: studentData, error: studentError } = await supabase
    .from('student_profiles')
    .select('*')
    .limit(1)
  
  if (studentError) {
    console.error('Error fetching student_profiles:', studentError)
  } else {
    console.log('Student profiles sample:', studentData)
  }

  console.log('Checking teacher_profiles table...')
  const { data: teacherData, error: teacherError } = await supabase
    .from('teacher_profiles')
    .select('*')
    .limit(1)
  
  if (teacherError) {
    console.error('Error fetching teacher_profiles:', teacherError)
  } else {
    console.log('Teacher profiles sample:', teacherData)
  }
}

checkSchema()
