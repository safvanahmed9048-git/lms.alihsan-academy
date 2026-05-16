"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LogoutButton } from '@/components/logout-button'
import { AcademyHeader } from '@/components/academy-header'
import { Users, GraduationCap, BookOpen, BarChart3, Loader2, UserPlus, UserMinus, ShieldAlert, CheckCircle, Search, AlertCircle, X, ExternalLink, RefreshCw, Trash } from 'lucide-react'
import { format, parseISO, isValid } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Avatar } from '@/components/avatar'
import { motion, AnimatePresence } from 'framer-motion'
import { Skeleton } from '@/components/skeleton'

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
  const [removeAccessRoleFilter, setRemoveAccessRoleFilter] = useState('all')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'student', name: '', className: '', teacherId: '', registrationNumber: '' })
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null)
  const [reassigningStudentId, setReassigningStudentId] = useState<string | null>(null)
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

      const mappedStudents = data.students?.map((s: any) => {
        const sp = s.student_profiles?.[0] || {}
        return {
          ...s,
          name: sp.name || s.email,
          class_name: sp.class_name || 'N/A',
          teacher_id: sp.teacher_id || null,
          registration_number: sp.registration_number || 'N/A',
          profile_photo: sp.profile_photo || null,
          created_at: sp.joined_date || s.created_at
        }
      }) || []

      const mappedTeachers = data.teachers?.map((t: any) => {
        const tp = t.teacher_profiles?.[0] || {}
        return {
          ...t,
          name: tp.name || t.email,
          profile_photo: tp.profile_photo || null,
          mobile_number: tp.mobile_number || tp.mobile || null,
          date_of_joining: tp.date_of_joining || tp.doj || null,
        }
      }) || []

      const mappedAllUsers = data.allUsers?.map((u: any) => {
        let name = u.email;
        if (u.role === 'student' && u.student_profiles?.[0]?.name) {
          name = u.student_profiles[0].name;
        } else if (u.role === 'teacher' && u.teacher_profiles?.[0]?.name) {
          name = u.teacher_profiles[0].name;
        }
        return { ...u, name }
      }) || []

      setAllUsers(mappedAllUsers)
      setStudents(mappedStudents)
      setTeachers(mappedTeachers)
      setAttendanceRecords(data.attendance || [])
      setClasses(data.classes || [])
      
      console.log('Superadmin data refreshed:', {
        totalStudents: mappedStudents.length,
        totalTeachers: mappedTeachers.length,
        totalAllUsers: mappedAllUsers.length
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
        body: JSON.stringify({ ...newUser, fullName: newUser.name })
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

  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState<string | null>(null)

  const handleRemoveUser = (userId: string, userName: string) => {
    setShowConfirm(userId)
  }

  const confirmRemove = async (userId: string) => {
    setRemovingUserId(userId)
    setShowConfirm(null)
    
    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove user')
      }

      // Remove from local state immediately
      setAllUsers(prev => prev.filter(u => u.id !== userId))
      setStudents(prev => prev.filter(s => s.id !== userId))
      setTeachers(prev => prev.filter(t => t.id !== userId))
      
      toast.success('User access removed successfully')
      
      // Also refresh background data to be sure
      fetchData()

    } catch (error: any) {
      toast.error('Failed to remove: ' + error.message)
    } finally {
      setRemovingUserId(null)
    }
  }

  async function handleReassignTeacher(studentId: string, teacherId: string) {
    setReassigningStudentId(studentId)
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
    } finally {
      setReassigningStudentId(null)
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
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex flex-col">
        <header className="bg-white border-b border-green-100 p-4 flex justify-between items-center shadow-sm">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-4">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-12" />
          </div>
        </header>
        <div className="p-8 max-w-5xl mx-auto w-full space-y-8">
          <Skeleton className="h-8 w-40" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-gradient-to-br from-green-50 to-white flex flex-col pb-20 md:pb-0"
    >
      <header className="bg-white border-b border-green-100 p-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <AcademyHeader size="sm" showTagline={true} />
          <div className="flex items-center gap-2 border-l border-gray-200 pl-3 ml-3 hidden sm:flex">
             <ShieldAlert className="h-5 w-5 text-red-600" />
             <span className="font-bold text-green-800 text-xl">Super Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <motion.button 
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={fetchData} 
            disabled={isLoading}
            className="border border-green-200 text-green-700 bg-white hover:bg-green-50 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </motion.button>
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
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >

        {/* STATISTICS TAB */}
        {activeTab === 'statistics' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* SECTION 1: Academy Overview */}
            <section>
              <h3 className="text-xl font-bold text-green-900 mb-4">Academy Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <DashboardStatCard title="Total Students" value={students.length} index={0} gradient="from-blue-400 to-blue-600" />
                <DashboardStatCard title="Total Teachers" value={teachers.length} index={1} gradient="from-green-400 to-green-600" />
                <DashboardStatCard title="Scheduled" value={classes.length} index={2} gradient="from-purple-400 to-purple-600" />
                <DashboardStatCard title="Completed" value={classes.filter(c => c.status === 'completed').length} index={3} gradient="from-orange-400 to-orange-500" />
                <DashboardStatCard title="Attendance" value={attendanceRecords.length} index={4} gradient="from-green-500 to-emerald-700" />
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
                      {teachers.map((t, index) => {
                        const assignedStudentsList = students.filter(s => s.teacher_id === t.id);
                        const assignedStudentsNames = assignedStudentsList.map(s => s.name);
                        const teacherClasses = classes.filter(c => c.teacher_id === t.id);
                        const completedClasses = teacherClasses.filter(c => c.status === 'completed').length;
                        return (
                          <motion.tr 
                            key={t.id} 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="hover:bg-gray-50 transition-colors"
                          >
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
                          </motion.tr>
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
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar photoUrl={s.profile_photo} name={s.name} size="sm" />
                            <div>
                              <p className="font-bold text-gray-900">{s.name}</p>
                              <p className="text-sm text-gray-500">{s.email}</p>
                            </div>
                          </div>
                        </td>
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
                                disabled={reassigningStudentId === s.id}
                              >
                                {reassigningStudentId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
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
                      <tr><td colSpan={6} className="p-8 text-center text-gray-500">No students found.</td></tr>
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
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar photoUrl={t.profile_photo} name={t.name} size="sm" />
                            <div>
                              <p className="font-bold text-gray-900">{t.name}</p>
                              <p className="text-sm text-gray-500">{t.email}</p>
                            </div>
                          </div>
                        </td>
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
                      <tr><td colSpan={4} className="p-8 text-center text-gray-500">No teachers found.</td></tr>
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
                          <td className="p-4">
                            <p className="font-bold text-gray-900">{studentName}</p>
                            <p className="text-sm text-gray-500">{allUsers.find(u => u.id === a.student_id)?.email || ''}</p>
                          </td>
                          <td className="p-4">
                            <p className="font-bold text-gray-900">{teacherName}</p>
                            <p className="text-sm text-gray-500">{allUsers.find(u => u.id === a.teacher_id)?.email || ''}</p>
                          </td>
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

                <motion.button 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-6 rounded-xl transition-all shadow-md"
                >
                  {isSubmitting ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : null}
                  {isSubmitting ? "Creating Profile..." : "Create User Profile"}
                </motion.button>
              </form>
            </div>

            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-red-100">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h3 className="text-xl font-bold text-red-900 flex items-center gap-2 m-0">
                  <UserMinus className="h-6 w-6" /> Danger Zone: Remove Access
                </h3>
                <div className="flex w-full sm:w-auto items-center gap-2">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder="Search by name or email..." 
                      value={removeAccessSearchQuery}
                      onChange={(e) => setRemoveAccessSearchQuery(e.target.value)}
                      className="pl-9 bg-gray-50 border-gray-200 focus-visible:ring-red-500"
                    />
                  </div>
                  <select
                    className="p-2 border border-gray-200 rounded-md bg-gray-50 text-sm font-medium focus:ring-2 focus:ring-red-500 outline-none"
                    value={removeAccessRoleFilter}
                    onChange={(e) => setRemoveAccessRoleFilter(e.target.value)}
                  >
                    <option value="all">All Roles</option>
                    <option value="teacher">Teacher</option>
                    <option value="student">Student</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              
              {(() => {
                const filteredRemoveUsers = allUsers
                  .filter(u => removeAccessRoleFilter === 'all' ? true : u.role === removeAccessRoleFilter)
                  .filter(u => safeLower(u.name).includes(safeLower(removeAccessSearchQuery)) || safeLower(u.email).includes(safeLower(removeAccessSearchQuery)))
                
                const roleLabel = removeAccessRoleFilter === 'all' ? 'Users' : 
                                  removeAccessRoleFilter === 'teacher' ? 'Teachers' :
                                  removeAccessRoleFilter === 'student' ? 'Students' : 'Admins'
                                  
                return (
                  <>
                    <p className="text-sm text-gray-500 font-medium mb-4">
                      Showing {filteredRemoveUsers.length} {filteredRemoveUsers.length === 1 ? roleLabel.slice(0, -1) : roleLabel}
                    </p>
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
                          {filteredRemoveUsers.length > 0 ? filteredRemoveUsers.map((u) => (
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
                                {showConfirm === u.id ? (
                                  <div className="flex items-center justify-end gap-2">
                                    <span className="text-sm text-red-600 font-bold">Sure?</span>
                                    <button
                                      onClick={() => confirmRemove(u.id)}
                                      className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold shadow-sm hover:bg-red-700 transition-colors"
                                    >
                                      Yes, Remove
                                    </button>
                                    <button
                                      onClick={() => setShowConfirm(null)}
                                      className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs font-bold hover:bg-gray-300 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : removingUserId === u.id ? (
                                  <div className="flex items-center justify-end gap-2 text-gray-500">
                                    <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full" />
                                    <span className="text-xs font-bold">Removing...</span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleRemoveUser(u.id, u.name)}
                                    className="flex items-center gap-1.5 bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-600 transition-all shadow-sm hover:shadow-md"
                                  >
                                    <Trash className="h-3.5 w-3.5" /> Remove
                                  </button>
                                )}
                              </td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={3} className="p-8 text-center text-gray-500">
                                <div className="flex flex-col items-center justify-center gap-2">
                                  <Search className="h-8 w-8 text-gray-300" />
                                  <p>No users found matching your search</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
              })()}
            </div>

          </div>
        )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-50 md:hidden pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] overflow-x-auto">
        <NavBtn active={activeTab === 'statistics'} onClick={() => setActiveTab('statistics')} icon={<BarChart3 />} label="Stats" />
        <NavBtn active={activeTab === 'students'} onClick={() => setActiveTab('students')} icon={<GraduationCap />} label="Students" />
        <NavBtn active={activeTab === 'teachers'} onClick={() => setActiveTab('teachers')} icon={<BookOpen />} label="Teachers" />
        <NavBtn active={activeTab === 'manage'} onClick={() => setActiveTab('manage')} icon={<Users />} label="Manage" />
      </nav>

      {/* Profile Modal */}
      <AnimatePresence>
        {isProfileModalOpen && selectedProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
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
                              <ModalStatCard label="Total Classes" value={totalClasses} />
                              <ModalStatCard label="Present" value={present} color="text-green-600" />
                              <ModalStatCard label="Absent" value={absent} color="text-red-600" />
                              <ModalStatCard label="Percentage" value={`${percentage}%`} color={percentage >= 75 ? 'text-green-600' : 'text-orange-600'} />
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
                              <ModalStatCard label="Total Students" value={assignedStudents.length} />
                              <ModalStatCard label="Classes Taken" value={teacherClasses.length} />
                              <ModalStatCard label="Completed" value={completed} color="text-green-600" />
                              <ModalStatCard label="Completion Rate" value={`${rate}%`} color={rate >= 75 ? 'text-green-600' : 'text-orange-600'} />
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
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </motion.div>
  )
}
function DashboardStatCard({ title, value, index, gradient }: { title: string, value: any, index: number, gradient: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15 }}
      whileHover={{ y: -5, scale: 1.02 }}
    >
      <Card className={`bg-gradient-to-br ${gradient} text-white border-none shadow-md overflow-hidden`}>
        <CardHeader className="p-4 pb-1">
          <CardTitle className="text-xs font-bold uppercase tracking-wider opacity-80">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="text-2xl font-extrabold">{value}</div>
        </CardContent>
      </Card>
    </motion.div>
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

function ModalStatCard({ label, value, color = 'text-gray-900' }: { label: string, value: any, color?: string }) {
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
