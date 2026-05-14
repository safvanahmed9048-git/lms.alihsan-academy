'use client'

import { useState, useEffect, ChangeEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'

function calculateCompletion(data: any) {
  const fields = [
    !!data.full_name,
    !!data.dob,
    !!data.guardian_name,
    !!data.guardian_mobile,
    !!data.address,
    !!data.profile_photo,
    !!data.academy_joined_date,
    !!data.registration_number,
    !!data.assigned_teacher_name,
    !!data.registered_email
  ]
  const total = fields.length
  const filled = fields.filter(Boolean).length
  return { filled, total, percent: Math.round((filled / total) * 100) }
}

export default function StudentProfilePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [completion, setCompletion] = useState({ filled: 0, total: 0, percent: 0 })

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        
      const { data: stud } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      const combined = {
        registered_email: user.email,
        full_name: stud?.name || user.user_metadata?.full_name || '',
        assigned_teacher_name: stud?.teacher_name || '',
        registration_number: stud?.registration_number || '',
        dob: stud?.dob ? format(parseISO(stud.dob), 'yyyy-MM-dd') : '',
        guardian_name: stud?.guardian_name || '',
        guardian_mobile: stud?.guardian_mobile || '',
        address: stud?.address || '',
        profile_photo: stud?.profile_photo || '',
        academy_joined_date: stud?.academy_joined_date ? format(parseISO(stud.academy_joined_date), 'yyyy-MM-dd') : ''
      }
      setProfile(combined)
      setCompletion(calculateCompletion(combined))
      setLoading(false)
    }
    fetchProfile()
  }, [])

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setProfile((prev: any) => ({ ...prev, [name]: value }))
    setCompletion(calculateCompletion({ ...profile, [name]: value }))
  }

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fileExt = file.name.split('.').pop()
    const fileName = `${profile.registration_number || 'profile'}_${Date.now()}.${fileExt}`
    const { error: uploadError } = await supabase.storage.from('profiles').upload(fileName, file, { upsert: true })
    if (uploadError) {
      toast.error('Photo upload failed')
      return
    }
    const { data: urlData } = supabase.storage.from('profiles').getPublicUrl(fileName)
    setProfile((prev: any) => ({ ...prev, profile_photo: urlData.publicUrl }))
    toast.success('Photo uploaded')
  }

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error: profError } = await supabase.from('profiles').upsert({ id: user.id })
    if (profError) {
      toast.error('Failed to save profile')
      setSaving(false)
      return
    }
    const { error: studError } = await supabase.from('student_profiles').upsert({
      user_id: user.id,
      name: profile.full_name,
      registration_number: profile.registration_number,
      dob: profile.dob ? new Date(profile.dob).toISOString() : null,
      guardian_name: profile.guardian_name,
      guardian_mobile: profile.guardian_mobile,
      address: profile.address,
      profile_photo: profile.profile_photo,
      academy_joined_date: profile.academy_joined_date ? new Date(profile.academy_joined_date).toISOString() : null
    })
    if (studError) {
      toast.error('Failed to save student details')
    } else {
      toast.success('Profile saved')
    }
    setSaving(false)
  }

  if (loading || !profile) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-green-600" />
      </div>
    )
  }

  const barColor = completion.percent >= 100 ? 'bg-green-500' : completion.percent >= 50 ? 'bg-orange-500' : 'bg-red-500'

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-green-900">Student Dashboard</h2>
        <div className="text-sm bg-white px-3 py-1 rounded-full border border-green-100 shadow-sm">
          <span className="font-bold text-green-700 mr-2">{completion.percent}% Profile Complete</span>
          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden inline-block align-middle">
            <div className={`h-2 ${barColor}`} style={{ width: `${completion.percent}%` }} />
          </div>
        </div>
      </div>

      {/* Profile Header Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-green-100 flex flex-col items-center text-center">
        <div className="relative mb-4">
          <div className="w-28 h-28 rounded-full bg-green-50 flex items-center justify-center overflow-hidden border-4 border-white shadow-md">
            {profile.profile_photo ? (
              <img src={profile.profile_photo} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-green-300">{profile.full_name?.charAt(0) || 'U'}</span>
            )}
          </div>
          <label className="absolute bottom-0 right-0 p-2 bg-green-600 rounded-full text-white cursor-pointer hover:bg-green-700 transition-colors shadow-lg">
            <Upload className="h-4 w-4" />
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </label>
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900">{profile.full_name}</h3>
        <div className="mt-2 inline-flex items-center px-4 py-1.5 rounded-full bg-green-100 border border-green-200 text-green-700 font-bold text-xl shadow-sm">
          Reg No: {profile.registration_number}
        </div>
        <p className="mt-2 text-gray-500 font-medium italic">Islamic Online Academy Student</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="flex items-center gap-2">Registered Email 🔒</Label>
          <Input value={profile.registered_email} disabled className="bg-gray-50" />
        </div>
        <div>
          <Label>Registration Number</Label>
          <Input name="registration_number" value={profile.registration_number} disabled className="bg-gray-50 font-bold text-green-700" />
        </div>
        <div>
          <Label>Full Name</Label>
          <Input name="full_name" value={profile.full_name} onChange={handleChange} />
        </div>
        <div>
          <Label>Date of Birth</Label>
          <Input type="date" name="dob" value={profile.dob} onChange={handleChange} />
        </div>
        <div>
          <Label>Guardian Name</Label>
          <Input name="guardian_name" value={profile.guardian_name} onChange={handleChange} />
        </div>
        <div>
          <Label>Guardian Mobile Number</Label>
          <Input name="guardian_mobile" value={profile.guardian_mobile} onChange={handleChange} />
        </div>
        <div>
          <Label>Address</Label>
          <Textarea name="address" value={profile.address} onChange={handleChange} />
        </div>
        <div>
          <Label className="flex items-center gap-2">Assigned Teacher 👨‍🏫</Label>
          <Input value={profile.assigned_teacher_name} disabled className="bg-gray-50" />
        </div>
        <div>
          <Label>Academy Joined Date</Label>
          <Input type="date" name="academy_joined_date" value={profile.academy_joined_date} onChange={handleChange} />
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3">
          {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
          Save Profile
        </Button>
      </div>
    </div>
  )
}
