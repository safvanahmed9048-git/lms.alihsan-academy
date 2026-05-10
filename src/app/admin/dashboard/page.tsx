"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LogoutButton } from '@/components/logout-button'
import { Users, Calendar, BarChart3, Loader2, Video, Clock, CheckCircle, Search, Edit2, ShieldAlert } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

type Tab = 'users' | 'classes' | 'stats'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // Data state
  const [users, setUsers] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [stats, setStats] = useState<any>({ totalStudents: 0, totalTeachers: 0, totalClasses: 0, attendanceRate: 0 })
  
  // UI state
  const [searchQuery, setSearchQuery] = useState('')
  const [isEditingRole, setIsEditingRole] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setIsLoading(true)
    try {
      // Fetch users
      const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      const { data: studentProfiles } = await supabase.from('student_profiles').select('*')
      
      const combinedUsers = profiles?.map(p => {
        const studentInfo = studentProfiles?.find(sp => sp.user_id === p.id)
        return {
          ...p,
          name: studentInfo?.name || p.email,
          class_name: studentInfo?.class_name || 'N/A'
        }
      }) || []
      
      setUsers(combinedUsers)

      // Fetch classes
      const { data: allClasses } = await supabase.from('classes').select('*').order('scheduled_at', { ascending: false })
      setClasses(allClasses || [])

      // Fetch attendance for stats
      const { data: attendance } = await supabase.from('attendance').select('class_id')
      
      // Calculate Stats
      const totalStudents = combinedUsers.filter(u => u.role === 'student').length
      const totalTeachers = combinedUsers.filter(u => u.role === 'teacher').length
      const totalClasses = allClasses?.length || 0
      
      const attendedClassesCount = attendance?.length || 0
      const attendanceRate = totalClasses > 0 ? Math.round((attendedClassesCount / totalClasses) * 100) : 0

      setStats({ totalStudents, totalTeachers, totalClasses, attendanceRate })

    } catch (error) {
      console.error("Error fetching admin data:", error)
      toast.error("Failed to load dashboard data.")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
      if (error) throw error
      
      toast.success("User role updated successfully!")
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
      setIsEditingRole(null)
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
          <h2 className="font-bold text-green-800 text-xl flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-green-600" />
            Admin Portal
          </h2>
        </div>
        <LogoutButton />
      </header>

      {/* Desktop Navigation */}
      <div className="hidden md:block bg-white border-b border-green-100 px-8">
        <nav className="flex space-x-8 max-w-5xl mx-auto">
          <button onClick={() => setActiveTab('users')} className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'users' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><Users className="h-5 w-5" />User Management</button>
          <button onClick={() => setActiveTab('classes')} className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'classes' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><Calendar className="h-5 w-5" />Global Classes</button>
          <button onClick={() => setActiveTab('stats')} className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'stats' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><BarChart3 className="h-5 w-5" />Academy Stats</button>
        </nav>
      </div>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
        {activeTab === 'users' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-green-100">
              <h3 className="text-xl font-bold text-green-900">Registered Users ({users.length})</h3>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Search by name, email or role..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-gray-50 border-gray-200"
                />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-green-50 border-b border-green-100">
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">User Details</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Role</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider hidden md:table-cell">Joined</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUsers.length > 0 ? filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-gray-900">{u.name}</p>
                          <p className="text-sm text-gray-500">{u.email}</p>
                        </td>
                        <td className="p-4">
                          {isEditingRole === u.id ? (
                            <select 
                              className="p-1.5 border border-gray-300 rounded bg-white text-sm font-medium focus:ring-2 focus:ring-green-500"
                              value={u.role || ''}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            >
                              <option value="student">Student</option>
                              <option value="teacher">Teacher</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-block
                              ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 
                                u.role === 'teacher' ? 'bg-blue-100 text-blue-800' : 
                                'bg-green-100 text-green-800'}`}
                            >
                              {u.role || 'Unassigned'}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-sm text-gray-500 font-medium hidden md:table-cell">
                          {format(new Date(u.created_at), "MMM d, yyyy")}
                        </td>
                        <td className="p-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setIsEditingRole(isEditingRole === u.id ? null : u.id)}
                            className="text-gray-500 hover:text-green-700 hover:bg-green-50"
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            {isEditingRole === u.id ? 'Cancel' : 'Edit Role'}
                          </Button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500">No users found matching your search.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'classes' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h3 className="text-xl font-bold text-green-900 mb-4">All Scheduled Classes</h3>
            <div className="grid gap-4">
              {classes.length > 0 ? classes.map((c) => {
                const isCompleted = c.status === 'completed'
                const studentName = users.find(u => u.id === c.student_id)?.name || 'Unknown Student'
                const teacherName = users.find(u => u.id === c.teacher_id)?.name || 'Unknown Teacher'
                
                return (
                  <Card key={c.id} className="border-green-100 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${isCompleted ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                            {c.status}
                          </span>
                          <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                            Teacher: {teacherName}
                          </span>
                        </div>
                        <h4 className="font-bold text-gray-900 text-lg">Student: {studentName}</h4>
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                          <Clock className="h-4 w-4 text-gray-400" />
                          {c.scheduled_at ? format(parseISO(c.scheduled_at), "EEEE, MMM d, yyyy 'at' h:mm a") : 'No Date'}
                        </div>
                      </div>
                      
                      {c.meet_link && !isCompleted && (
                        <a href={c.meet_link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-4 py-2 rounded-lg transition-colors">
                          <Video className="h-4 w-4" />
                          Meet Link
                        </a>
                      )}
                    </CardContent>
                  </Card>
                )
              }) : (
                <div className="bg-white rounded-xl p-10 text-center border border-gray-100 shadow-sm">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No classes have been scheduled yet.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <h3 className="text-xl font-bold text-green-900 mb-2">Academy Performance Overview</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Students" value={stats.totalStudents} icon={<Users className="h-5 w-5 text-blue-500" />} />
              <StatCard title="Total Teachers" value={stats.totalTeachers} icon={<Users className="h-5 w-5 text-purple-500" />} />
              <StatCard title="Classes Created" value={stats.totalClasses} icon={<Calendar className="h-5 w-5 text-orange-500" />} />
              <StatCard title="Global Attendance" value={`${stats.attendanceRate}%`} icon={<CheckCircle className="h-5 w-5 text-green-500" />} />
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <h4 className="font-bold text-gray-900 mb-6 text-lg">System Health</h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-600">Student to Teacher Ratio</span>
                    <span className="text-sm font-bold text-gray-900">
                      {stats.totalTeachers > 0 ? (stats.totalStudents / stats.totalTeachers).toFixed(1) : 0} : 1
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: '60%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-600">Class Completion Rate</span>
                    <span className="text-sm font-bold text-gray-900">{stats.attendanceRate}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${stats.attendanceRate}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-50 md:hidden pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <NavBtn active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users />} label="Users" />
        <NavBtn active={activeTab === 'classes'} onClick={() => setActiveTab('classes')} icon={<Calendar />} label="Classes" />
        <NavBtn active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<BarChart3 />} label="Stats" />
      </nav>
    </div>
  )
}

function StatCard({ title, value, icon }: { title: string, value: any, icon: React.ReactNode }) {
  return (
    <Card className="border-gray-100 shadow-sm overflow-hidden group hover:border-green-200 transition-colors">
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-500 group-hover:text-gray-700 transition-colors">
          {title}
        </CardTitle>
        <div className="p-2 bg-gray-50 rounded-lg group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-3xl font-extrabold text-gray-900">{value}</div>
      </CardContent>
    </Card>
  )
}

function NavBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center p-2 w-full transition-colors ${active ? 'text-green-700' : 'text-gray-500 hover:text-gray-900'}`}>
      <div className={`p-1.5 rounded-full mb-1 ${active ? 'bg-green-100 text-green-700' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  )
}
