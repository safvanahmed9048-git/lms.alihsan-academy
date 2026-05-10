"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LogoutButton } from '@/components/logout-button'
import { Calendar, Plus, BarChart3, Loader2, Video, CheckCircle, Clock, User, Globe, AlertCircle } from 'lucide-react'
import { format, parseISO, addWeeks, isAfter, startOfToday } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

type Tab = 'classes' | 'create' | 'stats'

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('classes')
  const [isLoading, setIsLoading] = useState(true)
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const supabase = createClient()

  // Data state
  const [students, setStudents] = useState<any[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [classes, setClasses] = useState<any[]>([])
  const [stats, setStats] = useState<any>({ total: 0, completed: 0, percentage: 0, studentBreakdown: [] })

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setTeacherId(user.id)

      // Fetch students
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('role', 'student')
      
      const { data: studentProfiles } = await supabase
        .from('student_profiles')
        .select('user_id, name')

      const combinedStudents = profiles?.map(p => ({
        id: p.id,
        email: p.email,
        name: studentProfiles?.find(sp => sp.user_id === p.id)?.name || p.email
      })) || []

      setStudents(combinedStudents)
      if (combinedStudents.length > 0) {
        setSelectedStudentId(combinedStudents[0].id)
      }
      setIsLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (teacherId && selectedStudentId) {
      fetchClasses()
    }
  }, [teacherId, selectedStudentId])

  useEffect(() => {
    if (teacherId && activeTab === 'stats') {
      fetchStats()
    }
  }, [teacherId, activeTab])

  async function fetchClasses() {
    if (!teacherId || !selectedStudentId) return
    const { data } = await supabase
      .from('classes')
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('student_id', selectedStudentId)
      .order('scheduled_at', { ascending: false })
    setClasses(data || [])
  }

  async function fetchStats() {
    if (!teacherId) return
    const { data: allTeacherClasses } = await supabase
      .from('classes')
      .select('*')
      .eq('teacher_id', teacherId)
    
    if (!allTeacherClasses) return

    const total = allTeacherClasses.length
    const completed = allTeacherClasses.filter(c => c.status === 'completed').length
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100)

    // Breakdown
    const breakdownMap = new Map()
    allTeacherClasses.forEach(c => {
      if (!breakdownMap.has(c.student_id)) {
        breakdownMap.set(c.student_id, { total: 0, completed: 0 })
      }
      const s = breakdownMap.get(c.student_id)
      s.total++
      if (c.status === 'completed') s.completed++
    })

    const breakdown = Array.from(breakdownMap.entries()).map(([sid, data]) => {
      const student = students.find(st => st.id === sid)
      return {
        name: student?.name || 'Unknown Student',
        total: data.total,
        completed: data.completed,
        percentage: data.total === 0 ? 0 : Math.round((data.completed / data.total) * 100)
      }
    })

    setStats({ total, completed, percentage, studentBreakdown: breakdown })
  }

  async function markAsCompleted(classObj: any) {
    try {
      const { error: updateError } = await supabase
        .from('classes')
        .update({ status: 'completed' })
        .eq('id', classObj.id)

      if (updateError) throw updateError

      const { error: attendanceError } = await supabase
        .from('attendance')
        .insert({
          class_id: classObj.id,
          student_id: classObj.student_id,
          teacher_id: teacherId,
          marked_at: new Date().toISOString()
        })

      if (attendanceError) throw attendanceError

      toast.success("Class marked as completed!")
      fetchClasses()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

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
          <button onClick={() => setActiveTab('classes')} className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'classes' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500'}`}><Calendar className="h-5 w-5" />Classes</button>
          <button onClick={() => setActiveTab('create')} className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'create' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500'}`}><Plus className="h-5 w-5" />Create</button>
          <button onClick={() => setActiveTab('stats')} className={`py-4 px-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'stats' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500'}`}><BarChart3 className="h-5 w-5" />Stats</button>
        </nav>
      </div>

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-8">
        {activeTab === 'classes' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm space-y-2">
              <Label className="text-sm font-medium text-gray-500">Viewing classes for:</Label>
              <select 
                className="w-full p-2 border border-gray-200 rounded-lg bg-gray-50 font-bold text-green-900"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="space-y-4">
              {classes.length > 0 ? (
                classes.map(c => (
                  <Card key={c.id} className="border-green-100 overflow-hidden shadow-sm">
                    <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                          <Clock className="h-4 w-4" />
                          {format(parseISO(c.scheduled_at), "EEEE, d MMMM yyyy 'at' h:mm a")}
                        </div>
                        {c.meet_link && (
                          <a href={c.meet_link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:underline text-sm font-medium">
                            <Video className="h-4 w-4" />
                            Google Meet Link
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${c.status === 'scheduled' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                          {c.status}
                        </span>
                        {c.status === 'scheduled' && (
                          <Button onClick={() => markAsCompleted(c)} size="sm" className="bg-green-600 hover:bg-green-700 text-white font-bold">
                            Mark Completed
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center p-12 bg-white rounded-2xl border border-dashed border-gray-200">
                  <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 font-medium">No classes found for this student.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'create' && (
          <CreateClassForm students={students} teacherId={teacherId} onCreated={() => setActiveTab('classes')} />
        )}

        {activeTab === 'stats' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard title="Total Created" value={stats.total} />
              <StatCard title="Total Completed" value={stats.completed} />
              <StatCard title="Completion Rate" value={`${stats.percentage}%`} />
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-6 text-xl">Student Breakdown</h3>
              <div className="space-y-6">
                {stats.studentBreakdown.length > 0 ? (
                  stats.studentBreakdown.map((s: any, i: number) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="font-bold text-gray-900">{s.name}</p>
                          <p className="text-xs text-gray-500 font-medium">{s.completed} / {s.total} Classes</p>
                        </div>
                        <span className="font-bold text-green-700">{s.percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: `${s.percentage}%` }}></div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No data available yet.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-50 md:hidden pb-safe">
        <NavBtn active={activeTab === 'classes'} onClick={() => setActiveTab('classes')} icon={<Calendar />} label="Classes" />
        <NavBtn active={activeTab === 'create'} onClick={() => setActiveTab('create')} icon={<Plus />} label="Create" />
        <NavBtn active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<BarChart3 />} label="Stats" />
      </nav>
    </div>
  )
}

function StatCard({ title, value }: { title: string, value: any }) {
  return (
    <Card className="border-green-100 shadow-sm">
      <CardHeader className="p-4 pb-0"><CardTitle className="text-xs font-bold uppercase tracking-wider text-gray-500">{title}</CardTitle></CardHeader>
      <CardContent className="p-4 pt-2 text-3xl font-extrabold text-green-900">{value}</CardContent>
    </Card>
  )
}

function NavBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center p-2 w-full transition-colors ${active ? 'text-green-700' : 'text-gray-500'}`}>
      <div className={`p-1 rounded-full mb-1 ${active ? 'bg-green-100' : ''}`}>{icon}</div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

function CreateClassForm({ students, teacherId, onCreated }: { students: any[], teacherId: string | null, onCreated: () => void }) {
  const [formData, setFormData] = useState({ studentId: '', meetLink: '', date: '', time: '', repeatWeekly: false })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (students.length > 0) setFormData(prev => ({ ...prev, studentId: students[0].id }))
  }, [students])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teacherId || !formData.studentId || !formData.date || !formData.time) return
    
    setIsSubmitting(true)
    try {
      const scheduledAt = new Date(`${formData.date}T${formData.time}`)
      const classesToCreate = []

      if (formData.repeatWeekly) {
        for (let i = 0; i < 4; i++) {
          classesToCreate.push({
            teacher_id: teacherId,
            student_id: formData.studentId,
            meet_link: formData.meetLink,
            scheduled_at: addWeeks(scheduledAt, i).toISOString(),
            status: 'scheduled',
            repeat_weekly: true
          })
        }
      } else {
        classesToCreate.push({
          teacher_id: teacherId,
          student_id: formData.studentId,
          meet_link: formData.meetLink,
          scheduled_at: scheduledAt.toISOString(),
          status: 'scheduled',
          repeat_weekly: false
        })
      }

      const { error } = await supabase.from('classes').insert(classesToCreate)
      if (error) throw error

      toast.success("Class created successfully!")
      onCreated()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-green-100 animate-in fade-in duration-300">
      <h3 className="text-xl font-bold text-green-900 mb-6 flex items-center gap-2"><Plus className="h-6 w-6" /> Create New Class</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label className="text-green-900 font-semibold">Select Student</Label>
          <select 
            className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none"
            value={formData.studentId}
            onChange={(e) => setFormData(prev => ({ ...prev, studentId: e.target.value }))}
            required
          >
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-green-900 font-semibold">Google Meet Link</Label>
          <Input 
            placeholder="https://meet.google.com/xxx-xxxx-xxx"
            value={formData.meetLink}
            onChange={(e) => setFormData(prev => ({ ...prev, meetLink: e.target.value }))}
            className="rounded-xl border-gray-200"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-green-900 font-semibold">Class Date</Label>
            <Input 
              type="date"
              min={format(startOfToday(), "yyyy-MM-dd")}
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              required
              className="rounded-xl border-gray-200"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-green-900 font-semibold">Class Time</Label>
            <Input 
              type="time"
              value={formData.time}
              onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
              required
              className="rounded-xl border-gray-200"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-green-50 p-4 rounded-xl border border-green-100">
          <input 
            type="checkbox"
            id="repeat"
            className="w-5 h-5 accent-green-600 rounded cursor-pointer"
            checked={formData.repeatWeekly}
            onChange={(e) => setFormData(prev => ({ ...prev, repeatWeekly: e.target.checked }))}
          />
          <Label htmlFor="repeat" className="text-green-900 font-bold cursor-pointer">Repeat this class every week (for 4 weeks)</Label>
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white font-extrabold py-6 rounded-xl transition-all shadow-md">
          {isSubmitting ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : null}
          {isSubmitting ? "Creating..." : "Create Class"}
        </Button>
      </form>
    </div>
  )
}
