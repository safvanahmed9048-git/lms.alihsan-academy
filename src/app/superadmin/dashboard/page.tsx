"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LogoutButton } from '@/components/logout-button'
import { Users, GraduationCap, BookOpen, BarChart3, Loader2, UserPlus, UserMinus, ShieldAlert, CheckCircle, Search, AlertCircle, X, ExternalLink, RefreshCw } from 'lucide-react'
import { format, parseISO, isValid } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Avatar } from '@/components/avatar'

type Tab = 'statistics' | 'students' | 'teachers' | 'attendance' | 'manage'

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('statistics')
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // Data state
  const [students, setStudents] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  
  // UI state
  const [searchQuery, setSearchQuery] = useState('')
  const [removeAccessSearchQuery, setRemoveAccessSearchQuery] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'student', name: '', className: '', teacherId: '', registrationNumber: '' })
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null)
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [selectedProfile, setSelectedProfile] = useState<any>(null)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    console.log("Fetching data started...")
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/data', { cache: 'no-store' })
      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error || "Failed to fetch data")

      const profiles = data.profiles
      const studentProfiles = data.studentProfiles
      const teacherProfiles = data.teacherProfiles
      
      const combinedUsers = profiles?.map((p: any) => {
        if (p.role === 'student') {
          const studentInfo = studentProfiles?.find((sp: any) => sp.user_id === p.id)
          return {
            ...studentInfo,
            ...p,
            id: p.id, // Explicitly use user ID from profiles
            name: studentInfo?.name || p.email,
            class_name: studentInfo?.class_name || 'N/A',
            teacher_id: studentInfo?.teacher_id || null,
            registration_number: studentInfo?.registration_number || 'N/A'
          }
        } else if (p.role === 'teacher') {
          const teacherInfo = teacherProfiles?.find((tp: any) => tp.user_id === p.id)
          return {
            ...teacherInfo,
            ...p,
            id: p.id, // Explicitly use user ID from profiles
            name: teacherInfo?.name || p.email
          }
        }
        return { ...p, name: p.email }
      }) || []
      
      setAllUsers(combinedUsers)
      setStudents(combinedUsers.filter((u: any) => u.role === 'student'))
      setTeachers(combinedUsers.filter((u: any) => u.role === 'teacher'))
      setAttendanceRecords(data.attendance || [])
      setClasses(data.classes || [])
      
      console.log('Superadmin data refreshed:', {
        totalProfiles: profiles?.length,
        totalStudents: studentProfiles?.length,
        totalTeachers: teacherProfiles?.length
      })

    } catch (error) {
      console.error("Error fetching superadmin data:", error)
      toast.error("Failed to load dashboard data.")
    } finally {
      setIsLoading(false)
      console.log("Fetching data finished.")
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
      setNewUser({ email: '', password: '', role: 'student', name: '', className: '', teacherId: '', registrationNumber: '' })
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

  async function handleReassignTeacher(studentId: string, teacherId: string) {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: studentId, teacherId: teacherId || null })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to reassign teacher")
      
      toast.success("Student reassigned successfully")
      setEditingStudentId(null)
      setSelectedTeacherId('')
      fetchData()
      return true
    } catch (error: any) {
      toast.error(error.message)
      return false
    }
  }

  const safeLower = (value: unknown) => String(value ?? '').toLowerCase()

  const filteredStudents = students.filter(s => 
    safeLower(s.name).includes(safeLower(searchQuery)) || 
    safeLower(s.email).includes(safeLower(searchQuery)) ||
    safeLower(s.registration_number).includes(safeLower(searchQuery))
  )

  const filteredTeachers = teachers.filter(t => 
    safeLower(t.name).includes(safeLower(searchQuery)) || 
    safeLower(t.email).includes(safeLower(searchQuery))
  )

  if (isLoading && allUsers.length === 0) {
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
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchData} 
            disabled={isLoading}
            className="border-green-200 text-green-700 hover:bg-green-50 flex items-center gap-2"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <LogoutButton />
        </div>
      </header>

      {/* Desktop Navigation */}
      <div className="hidden md:block bg-white border-b border-green-100 px-8">
        <nav className="flex space-x-8 max-w-5xl mx-auto">
          <button onClick={() => setActiveTab('statistics')} className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'statistics' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><BarChart3 className="h-5 w-5" />Statistics</button>
          <button onClick={() => setActiveTab('students')} className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'students' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><GraduationCap className="h-5 w-5" />Students</button>
          <button onClick={() => setActiveTab('teachers')} className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'teachers' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><BookOpen className="h-5 w-5" />Teachers</button>
          <button onClick={() => setActiveTab('attendance')} className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'attendance' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><CheckCircle className="h-5 w-5" />Attendance</button>
          <button onClick={() => setActiveTab('manage')} className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'manage' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><Users className="h-5 w-5" />Manage Users</button>
        </nav>
      </div>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">

        {/* STATISTICS TAB */}
        {activeTab === 'statistics' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* SECTION 1: Academy Overview */}
            <section>
              <h3 className="text-xl font-bold text-green-900 mb-4">Academy Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="bg-white border-green-100 shadow-sm">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500">Total Students</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold text-green-800">{students.length}</div>
                  </CardContent>
                </Card>
                <Card className="bg-white border-green-100 shadow-sm">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500">Total Teachers</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold text-green-800">{teachers.length}</div>
                  </CardContent>
                </Card>
                <Card className="bg-white border-green-100 shadow-sm">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500">Scheduled Classes</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold text-green-800">{classes.length}</div>
                  </CardContent>
                </Card>
                <Card className="bg-white border-green-100 shadow-sm">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500">Completed Classes</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold text-green-800">{classes.filter(c => c.status === 'completed').length}</div>
                  </CardContent>
                </Card>
                <Card className="bg-white border-green-100 shadow-sm">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500">Attendance Records</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold text-green-800">{attendanceRecords.length}</div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* SECTION 2: Students Under Each Teacher */}
            <section>
              <h3 className="text-xl font-bold text-green-900 mb-4">Students Under Each Teacher</h3>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-green-50 border-b border-green-100">
                        <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Teacher Info</th>
                        <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Total Students</th>
                        <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Assigned Students</th>
                        <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Classes (Total/Done)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {teachers.map(t => {
                        const assignedStudentsList = students.filter(s => s.teacher_id === t.id);
                        const assignedStudentsNames = assignedStudentsList.map(s => s.name);
                        const teacherClasses = classes.filter(c => c.teacher_id === t.id);
                        const completedClasses = teacherClasses.filter(c => c.status === 'completed').length;
                        return (
                          <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4">
                              <p className="font-bold text-gray-900">{t.name}</p>
                              <p className="text-sm text-gray-500">{t.email}</p>
                            </td>
                            <td className="p-4 font-bold text-gray-700">{assignedStudentsList.length}</td>
                            <td className="p-4 text-sm text-gray-600 max-w-xs truncate" title={assignedStudentsNames.join(', ')}>
                              {assignedStudentsNames.length > 0 ? assignedStudentsNames.join(', ') : 'None'}
                            </td>
                            <td className="p-4 text-sm font-medium text-gray-600">
                              {teacherClasses.length} / {completedClasses}
                            </td>
                          </tr>
                        )
                      })}
                      {teachers.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-gray-500">No data available yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* SECTION 3: Each Student's Attendance */}
            <section>
              <h3 className="text-xl font-bold text-green-900 mb-4">Each Student's Attendance</h3>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-green-50 border-b border-green-100">
                        <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Student Info</th>
                        <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Teacher(s)</th>
                        <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Scheduled</th>
                        <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Attended</th>
                        <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {students.map(s => {
                        const studentClasses = classes.filter(c => c.student_id === s.id);
                        const studentAttendance = attendanceRecords.filter(a => a.student_id === s.id);
                        const totalScheduled = studentClasses.length;
                        const totalAttended = studentAttendance.length;
                        const percentage = totalScheduled > 0 ? Math.round((totalAttended / totalScheduled) * 100) : 0;
                        const teacherNames = Array.from(new Set(studentClasses.map(c => teachers.find(t => t.id === c.teacher_id)?.name))).filter(Boolean).join(', ');
                        
                        let color = 'bg-red-500';
                        if (percentage >= 76) color = 'bg-green-500';
                        else if (percentage >= 51) color = 'bg-yellow-500';

                        return (
                          <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4">
                              <p className="font-bold text-gray-900">{s.name}</p>
                              <p className="text-sm text-gray-500">{s.email}</p>
                            </td>
                            <td className="p-4 text-sm text-gray-600">{teacherNames || 'None'}</td>
                            <td className="p-4 font-medium text-gray-700">{totalScheduled}</td>
                            <td className="p-4 font-medium text-gray-700">{totalAttended}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
                                </div>
                                <span className="text-xs font-bold text-gray-600 w-8">{percentage}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {students.length === 0 && (
                        <tr><td colSpan={5} className="p-8 text-center text-gray-500">No data available yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* SECTION 4: Each Teacher's Performance */}
            <section>
              <h3 className="text-xl font-bold text-green-900 mb-4">Each Teacher's Performance</h3>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-green-50 border-b border-green-100">
                        <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Teacher Info</th>
                        <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Classes Created</th>
                        <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Classes Completed</th>
                        <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Completion Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {teachers.map(t => {
                        const teacherClasses = classes.filter(c => c.teacher_id === t.id);
                        const completedClasses = teacherClasses.filter(c => c.status === 'completed').length;
                        const completionRate = teacherClasses.length > 0 ? Math.round((completedClasses / teacherClasses.length) * 100) : 0;
                        
                        let color = 'bg-red-500';
                        if (completionRate >= 76) color = 'bg-green-500';
                        else if (completionRate >= 51) color = 'bg-yellow-500';

                        return (
                          <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4">
                              <p className="font-bold text-gray-900">{t.name}</p>
                              <p className="text-sm text-gray-500">{t.email}</p>
                            </td>
                            <td className="p-4 font-medium text-gray-700">{teacherClasses.length}</td>
                            <td className="p-4 font-medium text-gray-700">{completedClasses}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={`h-full ${color}`} style={{ width: `${completionRate}%` }} />
                                </div>
                                <span className="text-xs font-bold text-gray-600 w-8">{completionRate}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {teachers.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-gray-500">No data available yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        )}
        
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
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Reg No</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Student Name</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Email</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Class</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Assigned Teacher</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Joined Date</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStudents.length > 0 ? filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-bold text-green-700">{s.registration_number}</td>
                        <td className="p-4 font-bold text-gray-900">
                          <div className="flex items-center gap-3">
                            <Avatar photoUrl={s.profile_photo} name={s.name} size="sm" />
                            {s.name}
                          </div>
                        </td>
                        <td className="p-4 text-gray-500 text-sm">{s.email}</td>
                        <td className="p-4 font-medium text-gray-700">
                          <span className="bg-green-100 text-green-800 px-2.5 py-0.5 rounded text-xs font-bold uppercase">{s.class_name}</span>
                        </td>
                        <td className="p-4 text-sm text-gray-700">
                          {editingStudentId === s.id ? (
                            <div className="flex items-center gap-2">
                              <select
                                className="bg-transparent border-b border-gray-200 outline-none hover:border-green-500 focus:border-green-500 text-sm py-1 w-full max-w-[220px]"
                                value={selectedTeacherId}
                                onChange={(e) => setSelectedTeacherId(e.target.value)}
                              >
                                <option value="" className="text-gray-400 italic">Unassigned</option>
                                {teachers.map(t => (
                                  <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                                ))}
                              </select>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs"
                                onClick={() => handleReassignTeacher(s.id, selectedTeacherId)}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingStudentId(null)
                                  setSelectedTeacherId('')
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-700 min-w-[140px]">
                                {teachers.find(t => t.id === s.teacher_id)?.name || teachers.find(t => t.id === s.teacher_id)?.email || 'Unassigned'}
                              </span>
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs"
                                onClick={() => {
                                  setEditingStudentId(s.id)
                                  setSelectedTeacherId(s.teacher_id || '')
                                }}
                              >
                                Change Teacher
                              </Button>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-sm text-gray-500 font-medium">
                          {format(new Date(s.created_at), "MMM d, yyyy")}
                        </td>
                        <td className="p-4 text-right">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-green-600 hover:text-green-700 font-bold"
                            onClick={() => {
                              setSelectedProfile(s)
                              setIsProfileModalOpen(true)
                            }}
                          >
                            View Profile
                          </Button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={7} className="p-8 text-center text-gray-500">No students found.</td></tr>
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
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Students Count</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider">Joined Date</th>
                      <th className="p-4 text-xs font-bold text-green-800 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTeachers.length > 0 ? filteredTeachers.map((t) => {
                      const studentCount = students.filter(s => s.teacher_id === t.id).length;
                      return (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-bold text-gray-900">
                          <div className="flex items-center gap-3">
                            <Avatar photoUrl={t.profile_photo} name={t.name} size="sm" />
                            {t.name}
                          </div>
                        </td>
                        <td className="p-4 text-gray-500 text-sm">{t.email}</td>
                        <td className="p-4 text-gray-700 font-bold text-center sm:text-left">{studentCount}</td>
                        <td className="p-4 text-sm text-gray-500 font-medium">
                          {format(new Date(t.created_at), "MMM d, yyyy")}
                        </td>
                        <td className="p-4 text-right">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-green-600 hover:text-green-700 font-bold"
                            onClick={() => {
                              setSelectedProfile(t)
                              setIsProfileModalOpen(true)
                            }}
                          >
                            View Profile
                          </Button>
                        </td>
                      </tr>
                    )}) : (
                      <tr><td colSpan={5} className="p-8 text-center text-gray-500">No teachers found.</td></tr>
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
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-lg text-gray-800">Account Role</Label>
                    <select 
                      className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none font-semibold text-gray-700"
                      value={newUser.role}
                      onChange={e => setNewUser({...newUser, role: e.target.value})}
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

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
                    {newUser.role === 'student' && (
                      <div className="space-y-2">
                        <Label className="font-semibold text-gray-700">Registration Number</Label>
                        <Input 
                          placeholder="e.g. 26009" 
                          value={newUser.registrationNumber}
                          onChange={e => setNewUser({...newUser, registrationNumber: e.target.value})}
                          required
                        />
                      </div>
                    )}
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
                  </div>

                  {newUser.role === 'student' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="font-semibold text-gray-700">Assign to Teacher <span className="text-red-500">*</span></Label>
                        <select 
                          className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none"
                          value={newUser.teacherId}
                          onChange={e => setNewUser({...newUser, teacherId: e.target.value})}
                          required
                        >
                          <option value="">Select a teacher...</option>
                          {teachers.map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-semibold text-gray-700">Class Name (Optional)</Label>
                        <Input 
                          placeholder="e.g. Batch A - Quran Memorization" 
                          value={newUser.className}
                          onChange={e => setNewUser({...newUser, className: e.target.value})}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-6 rounded-xl">
                  {isSubmitting ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : null}
                  {isSubmitting ? "Creating Profile..." : "Create User Profile"}
                </Button>
              </form>
            </div>

            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-red-100">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h3 className="text-xl font-bold text-red-900 flex items-center gap-2 m-0">
                  <UserMinus className="h-6 w-6" /> Danger Zone: Remove Access
                </h3>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input 
                    placeholder="Search by name or email..." 
                    value={removeAccessSearchQuery}
                    onChange={(e) => setRemoveAccessSearchQuery(e.target.value)}
                    className="pl-9 bg-gray-50 border-gray-200 focus-visible:ring-red-500"
                  />
                </div>
              </div>
              
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
                    {allUsers.filter(u => u.role === 'student' || u.role === 'teacher')
                      .filter(u => safeLower(u.name).includes(safeLower(removeAccessSearchQuery)) || safeLower(u.email).includes(safeLower(removeAccessSearchQuery)))
                      .map((u) => (
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
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-50 md:hidden pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] overflow-x-auto">
        <NavBtn active={activeTab === 'statistics'} onClick={() => setActiveTab('statistics')} icon={<BarChart3 />} label="Stats" />
        <NavBtn active={activeTab === 'students'} onClick={() => setActiveTab('students')} icon={<GraduationCap />} label="Students" />
        <NavBtn active={activeTab === 'teachers'} onClick={() => setActiveTab('teachers')} icon={<BookOpen />} label="Teachers" />
        <NavBtn active={activeTab === 'manage'} onClick={() => setActiveTab('manage')} icon={<Users />} label="Manage" />
      </nav>

      {/* Profile Modal */}
      {isProfileModalOpen && selectedProfile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-green-50">
              <h3 className="text-xl font-bold text-green-900">
                {selectedProfile.role === 'student' ? 'Student Profile' : 'Teacher Profile'}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setIsProfileModalOpen(false)}>
                <X className="h-6 w-6 text-gray-500" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex flex-col items-center mb-8 text-center">
                <Avatar photoUrl={selectedProfile.profile_photo} name={selectedProfile.name} size="lg" className="border-4 border-white shadow-lg mb-4" />
                <h4 className="text-2xl font-bold text-gray-900">{selectedProfile.name}</h4>
                <p className="text-gray-500">{selectedProfile.email}</p>
                {selectedProfile.role === 'student' && (
                  <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-bold">
                    Reg. No: {selectedProfile.registration_number}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedProfile.role === 'student' ? (
                  <>
                    <ProfileItem label="Assigned Teacher" value={teachers.find(t => t.id === selectedProfile.teacher_id)?.name || 'Unassigned'} />
                    <ProfileItem label="Class Name" value={selectedProfile.class_name} />
                    <ProfileItem label="Date of Birth" value={selectedProfile.dob ? format(parseISO(selectedProfile.dob), 'MMM d, yyyy') : 'N/A'} />
                    <ProfileItem label="Guardian Name" value={selectedProfile.guardian_name} />
                    <ProfileItem label="Guardian Mobile" value={selectedProfile.guardian_mobile} />
                    <ProfileItem label="Address" value={selectedProfile.address} />
                    <ProfileItem label="Academy Joined Date" value={selectedProfile.academy_joined_date ? format(parseISO(selectedProfile.academy_joined_date), 'MMM d, yyyy') : (selectedProfile.created_at ? format(new Date(selectedProfile.created_at), 'MMM d, yyyy') : 'N/A')} />
                    
                    {/* Attendance Stats */}
                    <div className="md:col-span-2 mt-4 pt-6 border-t border-gray-100">
                      <h5 className="font-bold text-green-800 mb-4">Attendance Statistics</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {(() => {
                          const studentClasses = classes.filter(c => c.student_id === selectedProfile.id);
                          const studentAttendance = attendanceRecords.filter(a => a.student_id === selectedProfile.id);
                          const totalClasses = studentClasses.length;
                          const present = studentAttendance.length;
                          const absent = totalClasses - present;
                          const percentage = totalClasses > 0 ? Math.round((present / totalClasses) * 100) : 0;
                          
                          return (
                            <>
                              <StatCard label="Total Classes" value={totalClasses} />
                              <StatCard label="Present" value={present} color="text-green-600" />
                              <StatCard label="Absent" value={absent} color="text-red-600" />
                              <StatCard label="Percentage" value={`${percentage}%`} color={percentage >= 75 ? 'text-green-600' : 'text-orange-600'} />
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <ProfileItem label="Date of Joining" value={selectedProfile.date_of_joining ? format(parseISO(selectedProfile.date_of_joining), 'MMM d, yyyy') : (selectedProfile.created_at ? format(new Date(selectedProfile.created_at), 'MMM d, yyyy') : 'N/A')} />
                    <ProfileItem label="Mobile Number" value={selectedProfile.mobile_number} />
                    <ProfileItem label="Country" value={selectedProfile.current_country} />
                    <ProfileItem label="State" value={selectedProfile.current_state} />
                    <div className="md:col-span-2">
                      <ProfileItem label="Educational Qualifications" value={selectedProfile.educational_qualifications} />
                    </div>
                    <div className="md:col-span-2">
                      <ProfileItem label="Bank Account Details" value={selectedProfile.bank_account_number ? `${selectedProfile.bank_name} - ${selectedProfile.bank_account_number}` : 'N/A'} />
                    </div>

                    {/* Teacher Performance */}
                    <div className="md:col-span-2 mt-4 pt-6 border-t border-gray-100">
                      <h5 className="font-bold text-green-800 mb-4">Teaching Performance</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {(() => {
                          const teacherClasses = classes.filter(c => c.teacher_id === selectedProfile.id);
                          const assignedStudents = students.filter(s => s.teacher_id === selectedProfile.id);
                          const completed = teacherClasses.filter(c => c.status === 'completed').length;
                          const rate = teacherClasses.length > 0 ? Math.round((completed / teacherClasses.length) * 100) : 0;
                          
                          return (
                            <>
                              <StatCard label="Total Students" value={assignedStudents.length} />
                              <StatCard label="Classes Taken" value={teacherClasses.length} />
                              <StatCard label="Completed" value={completed} color="text-green-600" />
                              <StatCard label="Completion Rate" value={`${rate}%`} color={rate >= 75 ? 'text-green-600' : 'text-orange-600'} />
                            </>
                          )
                        })()}
                      </div>
                      <div className="mt-4">
                        <Label className="text-xs font-bold text-gray-400 uppercase">Assigned Students</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {students.filter(s => s.teacher_id === selectedProfile.id).map(s => (
                            <span key={s.id} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs font-medium">
                              {s.name}
                            </span>
                          )) || <span className="text-sm text-gray-500">No students assigned</span>}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
              <Button onClick={() => setIsProfileModalOpen(false)} className="bg-green-600 hover:bg-green-700 text-white font-bold">
                Close Profile
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileItem({ label, value }: { label: string, value: any }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</Label>
      <p className="font-semibold text-gray-800">{value || 'N/A'}</p>
    </div>
  )
}

function StatCard({ label, value, color = 'text-gray-900' }: { label: string, value: any, color?: string }) {
  return (
    <div className="bg-white border border-gray-100 p-3 rounded-xl shadow-sm">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
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
