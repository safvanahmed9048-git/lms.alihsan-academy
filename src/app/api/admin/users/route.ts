import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    return {
      errorResponse: NextResponse.json(
        { error: 'NEXT_PUBLIC_SUPABASE_URL not configured' },
        { status: 500 }
      ),
      supabaseAdmin: null,
    }
  }

  if (!serviceRoleKey) {
    return {
      errorResponse: NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' },
        { status: 500 }
      ),
      supabaseAdmin: null,
    }
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return { supabaseAdmin, errorResponse: null }
}

export async function POST(request: Request) {
  try {
    const { supabaseAdmin, errorResponse } = getAdminClient()
    if (errorResponse || !supabaseAdmin) {
      return errorResponse
    }

    const body = await request.json()
    const { email, password, role, name, className, teacherId, registrationNumber } = body

    // 1. Create the user in Auth (or reuse existing account by email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    let userId = authData?.user?.id

    if (authError) {
      if (authError.code === 'email_exists') {
        const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
        if (usersError) throw usersError

        const existingUser = usersData.users.find(
          (u) => u.email?.toLowerCase() === String(email).toLowerCase()
        )

        if (!existingUser) {
          throw new Error('User exists but could not be loaded from Supabase Auth')
        }

        userId = existingUser.id

        // Keep login credentials in sync with what superadmin enters.
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
        })
        if (updateError) throw updateError
      } else {
        throw authError
      }
    }

    if (!userId) {
      throw new Error('Failed to resolve user id for provisioning')
    }

    // 2. Create or update role in profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: userId, role }, { onConflict: 'id' })

    if (profileError) throw profileError

    // 3. Create student/teacher profile
    if (role === 'student') {
      const { error: detailedProfileError } = await supabaseAdmin
        .from('student_profiles')
        .upsert({
          user_id: userId,
          name: name || email,
          class_name: className || null,
          teacher_id: teacherId || null,
          registration_number: registrationNumber || null,
          academy_joined_date: new Date().toISOString(),
          joined_date: new Date().toISOString()
        }, { onConflict: 'user_id' })

      if (detailedProfileError) {
        throw detailedProfileError
      }
    }

    if (role === 'teacher') {
      const { error: teacherProfileError } = await supabaseAdmin
        .from('teacher_profiles')
        .upsert({ 
          user_id: userId,
          name: name || email,
          date_of_joining: new Date().toISOString()
        }, { onConflict: 'user_id' })

      if (teacherProfileError) {
        throw teacherProfileError
      }
    }

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
    return NextResponse.json({ success: true, user: userData.user })

  } catch (error: any) {
    console.error("Admin user creation error:", error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabaseAdmin, errorResponse } = getAdminClient()
    if (errorResponse || !supabaseAdmin) {
      return errorResponse
    }

    const url = new URL(request.url)
    const userId = url.searchParams.get('id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // 1. Delete from profiles table first (to satisfy any FK constraints if they exist)
    await supabaseAdmin.from('profiles').delete().eq('id', userId)
    await supabaseAdmin.from('student_profiles').delete().eq('user_id', userId)
    await supabaseAdmin.from('teacher_profiles').delete().eq('user_id', userId)

    // 2. Delete from Supabase Auth
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error("Admin user deletion error:", error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabaseAdmin, errorResponse } = getAdminClient()
    if (errorResponse || !supabaseAdmin) {
      return errorResponse
    }

    const body = await request.json()
    const { userId, teacherId } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const { data: existingStudentProfile, error: existingStudentProfileError } = await supabaseAdmin
      .from('student_profiles')
      .select('teacher_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existingStudentProfileError) throw existingStudentProfileError

    const previousTeacherId = existingStudentProfile?.teacher_id || null

    const { data: updatedRows, error } = await supabaseAdmin
      .from('student_profiles')
      .update({ teacher_id: teacherId || null })
      .eq('user_id', userId)
      .select('user_id')

    if (error) throw error

    if (!updatedRows || updatedRows.length === 0) {
      const { error: insertError } = await supabaseAdmin
        .from('student_profiles')
        .insert({
          user_id: userId,
          name: null,
          class_name: null,
          teacher_id: teacherId || null,
          joined_date: new Date().toISOString(),
        })

      if (insertError && insertError.code !== '23505') throw insertError
    }

    if (previousTeacherId && teacherId && previousTeacherId !== teacherId) {
      const { error: deleteClassesError } = await supabaseAdmin
        .from('classes')
        .delete()
        .eq('student_id', userId)
        .eq('teacher_id', previousTeacherId)
        .eq('status', 'scheduled')
        .gt('scheduled_at', new Date().toISOString())

      if (deleteClassesError) throw deleteClassesError
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error("Admin user update error:", error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
