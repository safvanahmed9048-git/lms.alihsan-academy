"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LogoutButton } from '@/components/logout-button'
import { Home, BarChart3, User, Loader2, Calendar, Clock, Video } from 'lucide-react'
import { format, isToday, isFuture, parseISO } from 'date-fns'

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState<'home' | 'attendance' | 'profile'>('home')
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // State data
  const [todayClass, setTodayClass] = useState<any>(null)
  const [upcomingClasses, setUpcomingClasses] = useState<any[]>([])
  const [attendanceData, setAttendanceData] = useState<{
    totalScheduled: number
    totalAttended: number
    percentage: number
    history: any[]
  }>({ totalScheduled: 0, totalAttended: 0, percentage: 0, history: [] })
  const [profileData, setProfileData] = useState<any>(null)
  
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

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

        // Fetch classes
        const { data: classes } = await supabase
          .from('classes')
          .select('*')
          .eq('student_id', user.id)

        const allScheduledClasses = classes?.filter(c => c.status === 'scheduled') || []
        
        // Today's class & Upcoming
        const now = new Date()
        let today: any = null
        const upcoming: any[] = []

        allScheduledClasses.forEach(c => {
          if (!c.scheduled_at) return
          const date = parseISO(c.scheduled_at)
          if (isToday(date)) {
            today = c
          } else if (isFuture(date)) {
            upcoming.push(c)
          }
        })
        
        upcoming.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())

        setTodayClass(today)
        setUpcomingClasses(upcoming.slice(0, 5))

        // Fetch attendance
        const { data: attendance } = await supabase
          .from('attendance')
          .select('*')
          .eq('student_id', user.id)
          
        const totalScheduled = classes?.length || 0
        const attendedIds = new Set(attendance?.map(a => a.class_id) || [])
        const totalAttended = attendedIds.size
        const percentage = totalScheduled === 0 ? 0 : Math.round((totalAttended / totalScheduled) * 100)

        // Generate history: map all classes (past) to attendance status
        const pastClasses = classes?.filter(c => c.scheduled_at && new Date(c.scheduled_at) < now) || []
        const history = pastClasses.map(c => ({
          date: c.scheduled_at,
          status: attendedIds.has(c.id) ? 'Attended' : 'Missed',
          className: c.title || 'Class'
        })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        setAttendanceData({ totalScheduled, totalAttended, percentage, history })

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
        {activeTab === 'home' && <HomeTab todayClass={todayClass} upcomingClasses={upcomingClasses} />}
        {activeTab === 'attendance' && <AttendanceTab data={attendanceData} />}
        {activeTab === 'profile' && <ProfileTab profile={profileData} />}
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

function HomeTab({ todayClass, upcomingClasses }: { todayClass: any, upcomingClasses: any[] }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <section>
        <h3 className="text-xl font-bold text-green-900 mb-4 flex items-center gap-2">
          <Calendar className="h-6 w-6 text-green-600" />
          Today's Class
        </h3>
        {todayClass ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-green-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full uppercase tracking-wider mb-2">Live Today</span>
              <h4 className="font-bold text-2xl text-gray-900">{todayClass.title || 'Live Session'}</h4>
              <p className="text-gray-600 flex items-center gap-2 font-medium">
                <Clock className="h-5 w-5 text-gray-400" />
                {format(parseISO(todayClass.scheduled_at), "EEEE, d MMMM yyyy 'at' h:mm a")}
              </p>
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
            {upcomingClasses.map((c, i) => (
              <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center justify-between hover:border-green-200 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="bg-green-50 p-3 rounded-lg text-green-600">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{c.title || 'Live Session'}</h4>
                    <p className="text-sm text-gray-500 font-medium">{format(parseISO(c.scheduled_at), "MMM d, yyyy • h:mm a")}</p>
                  </div>
                </div>
              </div>
            ))}
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

function AttendanceTab({ data }: { data: any }) {
  let barColor = "bg-red-500"
  if (data.percentage > 50 && data.percentage <= 75) barColor = "bg-yellow-500"
  if (data.percentage > 75) barColor = "bg-green-500"

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h3 className="text-2xl font-bold text-green-900 mb-6">Attendance Overview</h3>
      
      <div className="grid grid-cols-3 gap-3 md:gap-6">
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-green-100 text-center flex flex-col items-center justify-center">
          <p className="text-gray-500 text-xs md:text-sm font-semibold uppercase tracking-wider mb-2">Scheduled</p>
          <p className="text-3xl md:text-4xl font-extrabold text-gray-900">{data.totalScheduled}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-green-100 text-center flex flex-col items-center justify-center">
          <p className="text-gray-500 text-xs md:text-sm font-semibold uppercase tracking-wider mb-2">Attended</p>
          <p className="text-3xl md:text-4xl font-extrabold text-green-600">{data.totalAttended}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-green-100 text-center flex flex-col items-center justify-center">
          <p className="text-gray-500 text-xs md:text-sm font-semibold uppercase tracking-wider mb-2">Percentage</p>
          <p className="text-3xl md:text-4xl font-extrabold text-gray-900">{data.percentage}%</p>
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
              {data.history.map((h: any, i: number) => (
                <div key={i} className="p-4 md:p-5 flex justify-between items-center hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="font-bold text-gray-900">{h.className}</p>
                    <p className="text-sm text-gray-500 font-medium">{format(parseISO(h.date), "MMMM d, yyyy")}</p>
                  </div>
                  <div>
                    {h.status === 'Attended' ? (
                      <span className="px-4 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-bold border border-green-200">Attended</span>
                    ) : (
                      <span className="px-4 py-1.5 bg-red-50 text-red-700 rounded-full text-sm font-bold border border-red-200">Missed</span>
                    )}
                  </div>
                </div>
              ))}
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

function ProfileTab({ profile }: { profile: any }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-green-100 text-center flex flex-col items-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-32 bg-green-700"></div>
        <div className="w-28 h-28 bg-white p-1 rounded-full flex items-center justify-center text-green-700 text-4xl font-bold mb-4 z-10 shadow-md">
          <div className="w-full h-full bg-green-100 rounded-full flex items-center justify-center overflow-hidden">
            {profile.photo_url ? (
              <img src={profile.photo_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              profile.name.charAt(0).toUpperCase()
            )}
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">{profile.name}</h2>
        <p className="text-gray-500 mb-4 font-medium">{profile.email}</p>
        <span className="px-5 py-1.5 bg-green-100 text-green-800 rounded-full text-sm font-bold tracking-wide border border-green-200 shadow-sm">
          Student
        </span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 md:p-8">
          <h3 className="font-bold text-gray-900 mb-6 text-xl">Account Details</h3>
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center py-3 border-b border-gray-50">
              <p className="text-sm text-gray-500 font-medium mb-1 md:mb-0">Class Name</p>
              <p className="font-bold text-gray-900 text-lg">{profile.class_name}</p>
            </div>
            <div className="flex flex-col md:flex-row md:justify-between md:items-center py-3 border-b border-gray-50">
              <p className="text-sm text-gray-500 font-medium mb-1 md:mb-0">Date Joined</p>
              <p className="font-bold text-gray-900">
                {profile.date_joined ? format(new Date(profile.date_joined), "MMMM d, yyyy") : 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
