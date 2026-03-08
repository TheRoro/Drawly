import { useState, useEffect } from 'react'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || ''

export default function ServerStatus() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/health`, { signal: AbortSignal.timeout(5000) })
        setStatus(res.ok ? 'online' : 'offline')
      } catch {
        setStatus('offline')
      }
    }

    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [])

  const colors = {
    checking: 'bg-yellow-400',
    online: 'bg-emerald-400',
    offline: 'bg-red-400',
  }

  const labels = {
    checking: 'Checking...',
    online: 'Server online',
    offline: 'Server offline',
  }

  return (
    <div className="flex items-center gap-2 text-xs text-ink-100">
      <span className={`w-2.5 h-2.5 rounded-full ${colors[status]} ${status === 'checking' ? 'animate-pulse' : ''} ${status === 'online' ? 'shadow-[0_0_6px_rgba(52,211,153,0.7)]' : ''}`} />
      <span>{labels[status]}</span>
    </div>
  )
}
