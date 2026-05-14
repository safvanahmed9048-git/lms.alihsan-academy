"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogoutButton } from '@/components/logout-button'
import { Home, BarChart3, User, Loader2, Calendar, Clock, Video } from 'lucide-react'
import { format, isToday, isFuture, parseISO } from 'date-fns'
import { Avatar } from '@/components/avatar'

import StudentProfilePage from '@/app/student/profile/page'

export default function StudentDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'home' | 'attendance' | 'profile'>('home')
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // State data
  const [todayClass, setTodayClass] = useState<any>(null)
  const [upcomingClasses, setUpcomingClasses] = useState<any[]>([])
  const [attendanceData, setAttendanceData] = useState<{
    totalClasses: number
    presentCount: number
    absentCount: number
    percentage: number
    history: any[]
  }>({ totalClasses: 0, presentCount: 0, absentCount: 0, percentage: 0, history: [] })
  const [profileData, setProfileData] = useState<any>(null)
  const [teachers, setTeachers] = useState<any[]>([])
  
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        // Fetch profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        const { data: studentProfile } = await supabase
          .from('student_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()

        setProfileData({
          email: user.email,
          name: studentProfile?.name || user.email,
          photo_url: studentProfile?.photo_url,
          class_name: studentProfile?.class_name || 'Unassigned',
          date_joined: profile?.created_at || user.created_at
        })

        // Fetch classes via direct Supabase call
        const { data: classesData, error: classesError } = await supabase
          .from('classes')
          .select('*')
          .eq('student_id', user.id)
          .order('scheduled_at', { ascending: true })

        console.log('Student ID:', user.id)
        console.log('Classes:', classesData)
        console.log('Error:', classesError)

        const allClasses = classesData || []

        const today = allClasses.filter((c: any) => {
          const classDate = new Date(c.scheduled_at).toDateString()
          const todayDate = new Date().toDateString()
          return classDate === todayDate
        })
        
        const upcoming = allClasses.filter((c: any) => {
          const classDate = new Date(c.scheduled_at)
          const todayDate = new Date()
          todayDate.setHours(23, 59, 59, 999)
          return classDate > todayDate && c.status === 'scheduled'
        })
        
        // Fetch teachers
        const teacherIds = Array.from(new Set(allClasses.map((c: any) => c.teacher_id))).filter(Boolean)
        const { data: teacherProfiles } = await supabase
          .from('teacher_profiles')
          .select('user_id, name, profile_photo')
          .in('user_id', teacherIds)
        
        setTeachers(teacherProfiles || [])

        setTodayClass(today[0] || null)
        setUpcomingClasses(upcoming)

        // Fetch attendance
        const { data: attendance } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', user.id)
          
        const completedClasses = allClasses.filter(c => c.status === 'completed')
        const totalClasses = completedClasses.length
        const presentCount = attendance?.filter(a => a.status === 'present' || !a.status).length || 0 // Default to present if status missing
        const absentCount = attendance?.filter(a => a.status === 'absent').length || 0
        const percentage = totalClasses === 0 ? 0 : Math.round((presentCount / totalClasses) * 100)

        const history = completedClasses.map(c => {
          const att = attendance?.find(a => a.class_id === c.id)
          const status = att && att.status === 'absent' ? 'Absent' : 'Present'
          return {
            date: c.scheduled_at,
            status: status,
            className: c.title || 'Class',
            teacher_id: c.teacher_id
          }
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        setAttendanceData({ totalClasses, presentCount, absentCount, percentage, history })

      } catch (err) {
        console.error("Error fetching data:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-green-50 flex justify-center items-center">
        <Loader2 className="h-10 w-10 animate-spin text-green-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-green-50 flex flex-col pb-20 md:pb-0">
      <header className="bg-white border-b border-green-100 p-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
        <div>
          <h2 className="font-bold text-green-800 text-xl">Al-Ihsan Learnings</h2>
        </div>
        <LogoutButton />
      </header>

      {/* Desktop Navigation */}
      <div className="hidden md:block bg-white border-b border-green-100 px-8">
        <nav className="flex space-x-8 max-w-4xl mx-auto">
          <button 
            onClick={() => setActiveTab('home')}
            className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'home' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            <Home className="h-5 w-5" />
            Home
          </button>
          <button 
            onClick={() => setActiveTab('attendance')}
            className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'attendance' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            <BarChart3 className="h-5 w-5" />
            Attendance
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'profile' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            <User className="h-5 w-5" />
            Profile
          </button>
        </nav>
      </div>

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-8">
        {activeTab === 'home' && <HomeTab todayClass={todayClass} upcomingClasses={upcomingClasses} teachers={teachers} />}
        {activeTab === 'attendance' && <AttendanceTab data={attendanceData} teachers={teachers} />}
        {activeTab === 'profile' && <StudentProfilePage />}
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-50 md:hidden pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setActiveTab('home')} 
          className={`flex flex-col items-center p-2 w-full transition-colors ${activeTab === 'home' ? 'text-green-700' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <div className={`p-1 rounded-full mb-1 ${activeTab === 'home' ? 'bg-green-100' : ''}`}>
            <Home className="h-6 w-6" />
          </div>
          <span className="text-xs font-medium">Home</span>
        </button>
        <button 
          onClick={() => setActiveTab('attendance')} 
          className={`flex flex-col items-center p-2 w-full transition-colors ${activeTab === 'attendance' ? 'text-green-700' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <div className={`p-1 rounded-full mb-1 ${activeTab === 'attendance' ? 'bg-green-100' : ''}`}>
            <BarChart3 className="h-6 w-6" />
          </div>
          <span className="text-xs font-medium">Attendance</span>
        </button>
        <button 
          onClick={() => setActiveTab('profile')} 
          className={`flex flex-col items-center p-2 w-full transition-colors ${activeTab === 'profile' ? 'text-green-700' : 'text-gray-500 hover:text-gray-900'}`}
        >
          <div className={`p-1 rounded-full mb-1 ${activeTab === 'profile' ? 'bg-green-100' : ''}`}>
            <User className="h-6 w-6" />
          </div>
          <span className="text-xs font-medium">Profile</span>
        </button>
      </nav>
    </div>
  )
}

function HomeTab({ todayClass, upcomingClasses, teachers }: { todayClass: any, upcomingClasses: any[], teachers: any[] }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <section>
        <h3 className="text-xl font-bold text-green-900 mb-4 flex items-center gap-2">
          <Calendar className="h-6 w-6 text-green-600" />
          Today's Class
        </h3>
        {todayClass ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-green-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {(() => {
                const teacher = teachers.find(t => t.user_id === todayClass.teacher_id);
                return (
                  <>
                    <Avatar photoUrl={teacher?.profile_photo} name={teacher?.name} size="lg" />
                    <div className="space-y-1">
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full uppercase tracking-wider mb-1">Live Today</span>
                      <h4 className="font-bold text-2xl text-gray-900">{todayClass.title || 'Live Session'}</h4>
                      <p className="text-sm font-bold text-green-700 mb-1">Teacher: {teacher?.name || 'Assigned Teacher'}</p>
                      <p className="text-gray-600 flex items-center gap-2 font-medium">
                        <Clock className="h-5 w-5 text-gray-400" />
                        {format(parseISO(todayClass.scheduled_at), "EEEE, d MMMM yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </>
                )
              })()}
            </div>
            {todayClass.meet_link ? (
              <a 
                href={todayClass.meet_link} 
                target="_blank" 
                rel="noreferrer"
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-bold transition-all hover:shadow-lg flex items-center justify-center gap-2 text-center whitespace-nowrap"
              >
                <Video className="h-5 w-5" />
                Join Class
              </a>
            ) : (
              <div className="bg-gray-100 text-gray-500 px-6 py-3 rounded-xl font-medium text-center">
                Link not available yet
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-green-100 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
              <Calendar className="h-8 w-8 text-green-300" />
            </div>
            <h4 className="text-lg font-bold text-gray-900 mb-1">You're all caught up!</h4>
            <p className="text-gray-500">No class scheduled for today.</p>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-xl font-bold text-green-900 mb-4">Upcoming Classes</h3>
        {upcomingClasses.length > 0 ? (
          <div className="grid gap-3">
            {upcomingClasses.map((c, i) => {
              const teacher = teachers.find(t => t.user_id === c.teacher_id);
              return (
                <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center justify-between hover:border-green-200 transition-colors">
                  <div className="flex items-center gap-4">
                    <Avatar photoUrl={teacher?.profile_photo} name={teacher?.name} size="md" />
                    <div>
                      <h4 className="font-bold text-gray-900">{c.title || 'Live Session'}</h4>
                      <p className="text-xs font-bold text-green-700">{teacher?.name || 'Teacher'}</p>
                      <p className="text-sm text-gray-500 font-medium">{format(parseISO(c.scheduled_at), "MMM d, yyyy • h:mm a")}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
            <p className="text-gray-500">No upcoming classes.</p>
          </div>
        )}
      </section>
    </div>
  )
}

function AttendanceTab({ data, teachers }: { data: any, teachers: any[] }) {
  let barColor = "bg-red-500"
  if (data.percentage > 50 && data.percentage <= 75) barColor = "bg-yellow-500"
  if (data.percentage > 75) barColor = "bg-green-500"

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h3 className="text-2xl font-bold text-green-900 mb-6">Attendance Overview</h3>
      
      <div className="grid grid-cols-4 gap-3 md:gap-6">
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-green-100 text-center flex flex-col items-center justify-center">
          <p className="text-gray-500 text-[10px] md:text-sm font-semibold uppercase tracking-wider mb-2">Total</p>
          <p className="text-2xl md:text-4xl font-extrabold text-gray-900">{data.totalClasses}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-green-100 text-center flex flex-col items-center justify-center">
          <p className="text-gray-500 text-[10px] md:text-sm font-semibold uppercase tracking-wider mb-2">Present</p>
          <p className="text-2xl md:text-4xl font-extrabold text-green-600">{data.presentCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-green-100 text-center flex flex-col items-center justify-center">
          <p className="text-gray-500 text-[10px] md:text-sm font-semibold uppercase tracking-wider mb-2">Absent</p>
          <p className="text-2xl md:text-4xl font-extrabold text-red-600">{data.absentCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-green-100 text-center flex flex-col items-center justify-center">
          <p className="text-gray-500 text-[10px] md:text-sm font-semibold uppercase tracking-wider mb-2">Percent</p>
          <p className="text-2xl md:text-4xl font-extrabold text-gray-900">{data.percentage}%</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
        <div className="flex justify-between items-end mb-4">
          <span className="font-bold text-gray-700">Overall Attendance</span>
          <span className="font-extrabold text-2xl text-gray-900">{data.percentage}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
          <div className={`${barColor} h-4 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${data.percentage}%` }}></div>
        </div>
        <p className="text-xs text-gray-400 mt-3 text-center">Aim for 75% or higher to stay on track!</p>
      </div>

      <div className="mt-8">
        <h4 className="font-bold text-gray-900 mb-4 text-lg">Attendance History</h4>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          {data.history.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {data.history.map((h: any, i: number) => {
                const teacher = teachers.find(t => t.user_id === h.teacher_id);
                return (
                  <div key={i} className="p-4 md:p-5 flex justify-between items-center hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <Avatar photoUrl={teacher?.profile_photo} name={teacher?.name} size="md" />
                      <div>
                        <p className="font-bold text-gray-900">{h.className}</p>
                        <p className="text-xs font-bold text-green-700">{teacher?.name || 'Teacher'}</p>
                        <p className="text-sm text-gray-500 font-medium">{format(parseISO(h.date), "MMMM d, yyyy")}</p>
                      </div>
                    </div>
                    <div>
                      {h.status === 'Present' ? (
                        <span className="px-4 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-bold border border-green-200">Present</span>
                      ) : (
                        <span className="px-4 py-1.5 bg-red-50 text-red-700 rounded-full text-sm font-bold border border-red-200">Absent</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-10 text-center flex flex-col items-center">
              <BarChart3 className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No past attendance records found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


