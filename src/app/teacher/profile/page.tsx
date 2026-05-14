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
    !!data.date_of_joining,
    !!data.educational_qualifications,
    !!data.mobile_number,
    !!data.current_country,
    !!data.current_state,
    !!data.bank_account_number,
    !!data.bank_name,
    !!data.profile_photo
  ]
  const total = fields.length
  const filled = fields.filter(Boolean).length
  return { filled, total, percent: Math.round((filled / total) * 100) }
}

export default function TeacherProfilePage() {
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
        
      const { data: teach } = await supabase
        .from('teacher_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      const combined = {
        registered_email: user.email,
        full_name: teach?.name || user.user_metadata?.full_name || '',
        date_of_joining: teach?.date_of_joining ? format(parseISO(teach.date_of_joining), 'yyyy-MM-dd') : '',
        educational_qualifications: teach?.educational_qualifications || '',
        mobile_number: teach?.mobile_number || '',
        current_country: teach?.current_country || '',
        current_state: teach?.current_state || '',
        bank_account_number: teach?.bank_account_number || '',
        bank_name: teach?.bank_name || '',
        profile_photo: teach?.profile_photo || ''
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
    const fileName = `${profile.full_name || 'profile'}_${Date.now()}.${fileExt}`
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
    const { error: teacherError } = await supabase.from('teacher_profiles').upsert({
      user_id: user.id,
      name: profile.full_name,
      date_of_joining: profile.date_of_joining ? new Date(profile.date_of_joining).toISOString() : null,
      educational_qualifications: profile.educational_qualifications,
      mobile_number: profile.mobile_number,
      current_country: profile.current_country,
      current_state: profile.current_state,
      bank_account_number: profile.bank_account_number,
      bank_name: profile.bank_name,
      profile_photo: profile.profile_photo
    })
    if (teacherError) {
      toast.error('Failed to save teacher details')
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
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Teacher Profile</h2>
        <div className="text-sm">
          <span className="font-medium mr-2">{completion.percent}% complete</span>
          <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden inline-block align-middle">
            <div className={`h-2 ${barColor}`} style={{ width: `${completion.percent}%` }} />
          </div>
        </div>
      </div>

      {/* Photo */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
          {profile.profile_photo ? (
            <img src={profile.profile_photo} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-gray-500">{profile.full_name?.charAt(0) || 'U'}</span>
          )}
        </div>
        <label className="cursor-pointer">
          <Upload className="h-5 w-5 text-gray-600" />
          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        </label>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Registered Email</Label>
          <Input value={profile.registered_email} disabled />
        </div>
        <div>
          <Label>Full Name</Label>
          <Input name="full_name" value={profile.full_name} onChange={handleChange} />
        </div>
        <div>
          <Label>Date of Joining Academy</Label>
          <Input type="date" name="date_of_joining" value={profile.date_of_joining} onChange={handleChange} />
        </div>
        <div>
          <Label>Educational Qualifications</Label>
          <Textarea name="educational_qualifications" value={profile.educational_qualifications} onChange={handleChange} />
        </div>
        <div>
          <Label>Mobile Number</Label>
          <Input name="mobile_number" value={profile.mobile_number} onChange={handleChange} />
        </div>
        <div>
          <Label>Current Country</Label>
          <Input name="current_country" value={profile.current_country} onChange={handleChange} />
        </div>
        <div>
          <Label>Current State</Label>
          <Input name="current_state" value={profile.current_state} onChange={handleChange} />
        </div>
        <div>
          <Label>Bank Account Number</Label>
          <Input name="bank_account_number" value={profile.bank_account_number} onChange={handleChange} />
        </div>
        <div>
          <Label>Bank Name</Label>
          <Input name="bank_name" value={profile.bank_name} onChange={handleChange} />
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3">
          {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
          Save Profile
        </Button>
      </div>
    </div>
  )
}
