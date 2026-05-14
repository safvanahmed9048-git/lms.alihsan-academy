import React from 'react'

interface AvatarProps {
  photoUrl?: string | null
  name?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Avatar({ photoUrl, name, size = 'md', className = '' }: AvatarProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
  }

  const getColorClass = (name: string) => {
    const firstLetter = (name[0] || 'A').toUpperCase()
    if (firstLetter >= 'A' && firstLetter <= 'E') return 'bg-green-500'
    if (firstLetter >= 'F' && firstLetter <= 'J') return 'bg-blue-500'
    if (firstLetter >= 'K' && firstLetter <= 'O') return 'bg-purple-500'
    if (firstLetter >= 'P' && firstLetter <= 'T') return 'bg-orange-500'
    return 'bg-red-500'
  }

  const sizeClasses = {
    sm: 'w-[30px] h-[30px] text-[10px]',
    md: 'w-[40px] h-[40px] text-sm',
    lg: 'w-[80px] h-[80px] text-2xl'
  }

  if (photoUrl) {
    return (
      <div className={`rounded-full overflow-hidden flex-shrink-0 border border-gray-100 ${sizeClasses[size]} ${className}`}>
        <img src={photoUrl} alt={name || 'User'} className="w-full h-full object-cover" />
      </div>
    )
  }

  const userName = name || 'Unknown'
  return (
    <div className={`rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${sizeClasses[size]} ${getColorClass(userName)} ${className}`}>
      {getInitials(userName)}
    </div>
  )
}
