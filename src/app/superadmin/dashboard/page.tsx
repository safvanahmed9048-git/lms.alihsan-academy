"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LogoutButton } from '@/components/logout-button'
import { Users, GraduationCap, BookOpen, BarChart3, Loader2, UserPlus, UserMinus, ShieldAlert, CheckCircle, Search, AlertCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

type Tab = 'students' | 'teachers' | 'attendance' | 'manage'

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('students')
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // Data state
  const [students, setStudents] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  
  // UI state
  const [searchQuery, setSearchQuery] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'student', name: '', className: '' })

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
      
      setAllUsers(combinedUsers)
      setStudents(combinedUsers.filter(u => u.role === 'student'))
      setTeachers(combinedUsers.filter(u => u.role === 'teacher'))

      // Fetch attendance
      const { data: attendance } = await supabase
        .from('attendance')
        .select(`
          *,
          classes (
            title,
            scheduled_at
          )
        `)
        .order('marked_at', { ascending: false })
      
      setAttendanceRecords(attendance || [])

    } catch (error) {
      console.error("Error fetching superadmin data:", error)
      toast.error("Failed to load dashboard data.")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    
    // Note: In a real production app, you should create users via a secure API route 
    // using the SUPABASE_SERVICE_ROLE_KEY so you don't log out the current admin.
    // We are calling an API route here assuming it will be set up.
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      })
      
      const result = await response.json()
      
      if (!response.ok) throw new Error(result.error || "Failed to create user")
      
      toast.success("User created successfully!")
      setNewUser({ email: '', password: '', role: 'student', name: '', className: '' })
      fetchData() // Refresh list
    } catch (error: any) {
      toast.error(error.message)
      if (error.message.includes("Service Role")) {
        toast.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local", { duration: 5000 })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRemoveUser(userId: string) {
    if (!confirm("Are you sure you want to remove this user? This action cannot be undone.")) return
    
    try {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: 'DELETE',
      })
      
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to delete user")
        
      toast.success("User removed successfully!")
      fetchData() // Refresh list
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.email.toLowerCase().includes(searchQuery.toLowerCase())
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
            <ShieldAlert className="h-5 w-5 text-red-600" />
            Super Admin
          </h2>
        </div>
        <LogoutButton />
      </header>

      {/* Desktop Navigation */}
      <div className="hidden md:block bg-white border-b border-green-100 px-8">
        <nav className="flex space-x-8 max-w-5xl mx-auto">
          <button onClick={() => setActiveTab('students')} className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'students' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><GraduationCap className="h-5 w-5" />Students</button>
          <button onClick={() => setActiveTab('teachers')} className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'teachers' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><BookOpen className="h-5 w-5" />Teachers</button>
          <button onClick={() => setActiveTab('attendance')} className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'attendance' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><CheckCircle className="h-5 w-5" />Attendance</button>
          <button onClick={() => setActiveTab('manage')} className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'manage' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><Users className="h-5 w-5" />Manage Users</button>
        </nav>
      </div>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
        
        {/* STUDENTS TAB */}
        {activeTab === 'students' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-green-100">
              <h3 className="text-xl font-bold text-green-900">All Students ({students.length})</h3>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Search students..." 
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
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Student Name</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Email</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Class</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Joined Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStudents.length > 0 ? filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-bold text-gray-900">{s.name}</td>
                        <td className="p-4 text-gray-500 text-sm">{s.email}</td>
                        <td className="p-4 font-medium text-gray-700">
                          <span className="bg-green-100 text-green-800 px-2.5 py-0.5 rounded text-xs font-bold uppercase">{s.class_name}</span>
                        </td>
                        <td className="p-4 text-sm text-gray-500 font-medium">
                          {format(new Date(s.created_at), "MMM d, yyyy")}
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="p-8 text-center text-gray-500">No students found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TEACHERS TAB */}
        {activeTab === 'teachers' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-green-100">
              <h3 className="text-xl font-bold text-green-900">All Teachers ({teachers.length})</h3>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Search teachers..." 
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
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Teacher Name</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Email</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Joined Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTeachers.length > 0 ? filteredTeachers.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-bold text-gray-900">{t.name}</td>
                        <td className="p-4 text-gray-500 text-sm">{t.email}</td>
                        <td className="p-4 text-sm text-gray-500 font-medium">
                          {format(new Date(t.created_at), "MMM d, yyyy")}
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={3} className="p-8 text-center text-gray-500">No teachers found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h3 className="text-xl font-bold text-green-900 mb-4">Academy Attendance Records</h3>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-green-50 border-b border-green-100">
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Student</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Teacher</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Class Date</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Marked At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {attendanceRecords.length > 0 ? attendanceRecords.map((a) => {
                      const studentName = allUsers.find(u => u.id === a.student_id)?.name || 'Unknown'
                      const teacherName = allUsers.find(u => u.id === a.teacher_id)?.name || 'Unknown'
                      return (
                        <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4 font-bold text-gray-900">{studentName}</td>
                          <td className="p-4 text-gray-600 font-medium">{teacherName}</td>
                          <td className="p-4 text-sm text-gray-500">
                            {a.classes?.scheduled_at ? format(parseISO(a.classes.scheduled_at), "MMM d, yyyy") : 'N/A'}
                          </td>
                          <td className="p-4 text-sm text-gray-400">
                            {format(parseISO(a.marked_at), "MMM d, yyyy h:mm a")}
                          </td>
                        </tr>
                      )
                    }) : (
                      <tr><td colSpan={4} className="p-8 text-center text-gray-500">No attendance records found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MANAGE USERS TAB */}
        {activeTab === 'manage' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-green-100">
              <h3 className="text-xl font-bold text-green-900 mb-6 flex items-center gap-2">
                <UserPlus className="h-6 w-6" /> Create New Profile
              </h3>
              
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg mb-6 text-sm flex items-start gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>Note:</strong> Creating users directly from this dashboard requires the <code>SUPABASE_SERVICE_ROLE_KEY</code> to be configured in your environment variables.
                </p>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-6 max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-semibold text-gray-700">Full Name</Label>
                    <Input 
                      placeholder="John Doe" 
                      value={newUser.name}
                      onChange={e => setNewUser({...newUser, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold text-gray-700">Email Address</Label>
                    <Input 
                      type="email"
                      placeholder="john@example.com" 
                      value={newUser.email}
                      onChange={e => setNewUser({...newUser, email: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-semibold text-gray-700">Temporary Password</Label>
                    <Input 
                      type="password"
                      placeholder="Minimum 6 characters" 
                      value={newUser.password}
                      onChange={e => setNewUser({...newUser, password: e.target.value})}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold text-gray-700">Account Role</Label>
                    <select 
                      className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none"
                      value={newUser.role}
                      onChange={e => setNewUser({...newUser, role: e.target.value})}
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                {newUser.role === 'student' && (
                  <div className="space-y-2">
                    <Label className="font-semibold text-gray-700">Class Name (Optional)</Label>
                    <Input 
                      placeholder="e.g. Batch A - Quran Memorization" 
                      value={newUser.className}
                      onChange={e => setNewUser({...newUser, className: e.target.value})}
                    />
                  </div>
                )}

                <Button type="submit" disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-6">
                  {isSubmitting ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : null}
                  {isSubmitting ? "Creating Profile..." : "Create User Profile"}
                </Button>
              </form>
            </div>

            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-red-100">
              <h3 className="text-xl font-bold text-red-900 mb-6 flex items-center gap-2">
                <UserMinus className="h-6 w-6" /> Danger Zone: Remove Access
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-red-50 border-b border-red-100">
                      <th className="p-4 text-xs font-bold text-red-800 uppercase tracking-wider">User</th>
                      <th className="p-4 text-xs font-bold text-red-800 uppercase tracking-wider">Role</th>
                      <th className="p-4 text-xs font-bold text-red-800 uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allUsers.filter(u => u.role === 'student' || u.role === 'teacher').map((u) => (
                      <tr key={u.id} className="hover:bg-red-50/50 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-gray-900">{u.name}</p>
                          <p className="text-sm text-gray-500">{u.email}</p>
                        </td>
                        <td className="p-4">
                          <span className="bg-gray-100 text-gray-800 px-2.5 py-0.5 rounded text-xs font-bold uppercase">
                            {u.role}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => handleRemoveUser(u.id)}
                            className="bg-red-600 hover:bg-red-700 font-bold text-xs"
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-50 md:hidden pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <NavBtn active={activeTab === 'students'} onClick={() => setActiveTab('students')} icon={<GraduationCap />} label="Students" />
        <NavBtn active={activeTab === 'teachers'} onClick={() => setActiveTab('teachers')} icon={<BookOpen />} label="Teachers" />
        <NavBtn active={activeTab === 'manage'} onClick={() => setActiveTab('manage')} icon={<Users />} label="Manage" />
      </nav>
    </div>
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
