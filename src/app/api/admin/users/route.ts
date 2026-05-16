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
    const { 
      fullName,
      email, 
      password,
      role,
      teacherId,
      registrationNumber,
      className
    } = body

    console.log('Received body:', { 
      fullName, email, role, teacherId, 
      registrationNumber, className 
    })

    console.log('Full name received:', fullName)

    // 1. Create the user in Auth (or reuse existing account by email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { name: fullName, role: role }
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
          user_metadata: { name: fullName, role: role }
        })
        if (updateError) throw updateError
      } else {
        throw authError
      }
    }

    if (!userId) {
      throw new Error('Failed to resolve user id for provisioning')
    }

    // 2. Insert into profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: userId, email: email, role }, { onConflict: 'id' })

    if (profileError) {
      console.log('Profile insert result error:', profileError)
      throw profileError
    }

    // 3. Create student/teacher profile
    if (role === 'student') {
      const { error: spError } = await supabaseAdmin
        .from('student_profiles')
        .insert({
          user_id: userId,
          name: fullName,
          registration_number: registrationNumber || null,
          teacher_id: teacherId || null,
          class_name: className || null,
          joined_date: new Date().toISOString().split('T')[0]
        })

      console.log('student_profiles insert error:', spError)
      if (spError) throw spError
    }

    if (role === 'teacher') {
      const { error: tpError } = await supabaseAdmin
        .from('teacher_profiles')
        .insert({
          user_id: userId,
          name: fullName,
          date_of_joining: new Date().toISOString().split('T')[0]
        })

      console.log('teacher_profiles insert error:', tpError)
      if (tpError) throw tpError
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

    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' }, 
        { status: 400 }
      )
    }

    // Delete from student_profiles first
    await supabaseAdmin
      .from('student_profiles')
      .delete()
      .eq('user_id', userId)

    // Delete from teacher_profiles
    await supabaseAdmin
      .from('teacher_profiles')
      .delete()
      .eq('user_id', userId)

    // Delete from classes (as student)
    await supabaseAdmin
      .from('classes')
      .delete()
      .eq('student_id', userId)

    // Delete from classes (as teacher)
    await supabaseAdmin
      .from('classes')
      .delete()
      .eq('teacher_id', userId)

    // Delete from attendance
    await supabaseAdmin
      .from('attendance')
      .delete()
      .eq('student_id', userId)

    await supabaseAdmin
      .from('attendance')
      .delete()
      .eq('teacher_id', userId)

    // Delete from profiles
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    // Finally delete from Supabase Auth
    const { error: authError } = await supabaseAdmin
      .auth.admin.deleteUser(userId)

    if (authError) {
      console.error('Auth delete error:', authError)
      return NextResponse.json(
        { error: authError.message }, 
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Delete error:', error)
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabaseAdmin, errorResponse } = getAdminClient()
    if (errorResponse || !supabaseAdmin) {
      return errorResponse
    }

    const body = await request.json()
    const studentId = body.userId || body.studentId
    const newTeacherId = body.teacherId || body.newTeacherId || null

    if (!studentId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const { data: existingStudentProfile, error: existingStudentProfileError } = await supabaseAdmin
      .from('student_profiles')
      .select('teacher_id')
      .eq('user_id', studentId)
      .maybeSingle()

    if (existingStudentProfileError) throw existingStudentProfileError

    const oldTeacherId = existingStudentProfile?.teacher_id || null

    console.log('Reassigning student:', studentId)
    console.log('New teacher:', newTeacherId)

    const { error } = await supabaseAdmin
      .from('student_profiles')
      .update({ teacher_id: newTeacherId })
      .eq('user_id', studentId)

    console.log('Update result:', error)
    if (error) throw error

    if (oldTeacherId && oldTeacherId !== newTeacherId) {
      const { error: deleteClassesError } = await supabaseAdmin
        .from('classes')
        .delete()
        .eq('student_id', studentId)
        .eq('teacher_id', oldTeacherId)
        .eq('status', 'scheduled')

      if (deleteClassesError) throw deleteClassesError
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error("Admin user update error:", error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
