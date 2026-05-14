import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    
    // 1. Auth Client
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          }
        }
      }
    )

    const { data: { user } } = await supabaseAuth.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      )
    }

    // 2. Admin Client for fetching data
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Bypasses RLS issues
      {
        cookies: {
          get(name: string) { return undefined },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {}
        }
      }
    )

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Forbidden - Superadmin only' }, 
        { status: 403 }
      )
    }

    // Fetch all profiles and student details
    const { data: profiles, error: pError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    const { data: studentProfiles, error: sError } = await supabase
      .from('student_profiles')
      .select('*')

    const { data: teacherProfiles, error: tError } = await supabase
      .from('teacher_profiles')
      .select('*')

    if (pError || sError || tError) throw pError || sError || tError

    // Fetch attendance for the dashboard
    const { data: attendance, error: aError } = await supabase
      .from('attendance')
      .select(`
        *,
        classes (
          scheduled_at
        )
      `)
      .order('marked_at', { ascending: false })

    // Fetch classes for statistics
    const { data: classes, error: cError } = await supabase
      .from('classes')
      .select('*')
      
    if (aError || cError) console.error("Error fetching attendance or classes", aError, cError)

    return NextResponse.json({ 
      profiles: profiles || [], 
      studentProfiles: studentProfiles || [],
      teacherProfiles: teacherProfiles || [],
      attendance: attendance || [],
      classes: classes || []
    })
  } catch (err: any) {
    console.error("Dashboard API Error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
