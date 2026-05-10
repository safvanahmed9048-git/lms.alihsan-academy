import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Service Role Key is missing. Cannot create user.' },
        { status: 500 }
      )
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        cookies: {
          get(name: string) { return undefined },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {}
        }
      }
    )

    const body = await request.json()
    const { email, password, role, name, className } = body

    // 1. Create the user in Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) throw authError

    const userId = authData.user.id

    // 2. Update their role in the profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)

    if (profileError) throw profileError

    // 3. Create student/teacher profile
    if (role === 'student' || role === 'teacher') {
      const { error: detailedProfileError } = await supabase
        .from('student_profiles')
        .insert({
          user_id: userId,
          name: name || email,
          class_name: role === 'student' ? className : null
        })

      if (detailedProfileError && detailedProfileError.code !== '23505') { // Ignore duplicate keys
        console.error("Detailed profile error:", detailedProfileError)
      }
    }

    return NextResponse.json({ success: true, user: authData.user })

  } catch (error: any) {
    console.error("Admin user creation error:", error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Service Role Key is missing. Cannot delete user.' },
        { status: 500 }
      )
    }

    const url = new URL(request.url)
    const userId = url.searchParams.get('id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        cookies: {
          get(name: string) { return undefined },
          set(name: string, value: string, options: any) {},
          remove(name: string, options: any) {}
        }
      }
    )

    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error("Admin user deletion error:", error)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
