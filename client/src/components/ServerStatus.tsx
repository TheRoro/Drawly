import { useState, useEffect } from 'react'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || ''

export default function ServerStatus() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  useEffect(() => {
    const check = async () => {
      // Try same-origin proxy first, then direct cross-origin
      const urls = ['/api/health', `${SERVER_URL}/health`]
      for (const url of urls) {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
          if (res.ok) {
            setStatus('online')
            return
          }
        } catch {
          // try next
        }
      }
      setStatus('offline')
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
    offline: "Can't reach game server",
  }

  return (
    <div className="flex flex-col items-end text-right" title={status === 'offline' ? 'Try mobile data if this persists' : undefined}>
      <div className="flex items-center gap-2 text-xs text-ink-100">
        <span className={`w-2.5 h-2.5 rounded-full ${colors[status]} ${status === 'checking' ? 'animate-pulse' : ''} ${status === 'online' ? 'shadow-[0_0_6px_rgba(52,211,153,0.7)]' : ''}`} />
        <span>{labels[status]}</span>
      </div>
      {status === 'offline' && (
        <span className="mt-1 max-w-56 text-[11px] leading-4 text-ink-100/80">
          This may be network-related. Try mobile data if this persists.
        </span>
      )}
    </div>
  )
}
