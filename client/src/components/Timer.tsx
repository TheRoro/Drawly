import { useState, useEffect } from 'react'

interface TimerProps {
  timerEnd: number | null
}

export default function Timer({ timerEnd }: TimerProps) {
  const [seconds, setSeconds] = useState<number | null>(null)

  useEffect(() => {
    if (!timerEnd) {
      setSeconds(null)
      return
    }

    const update = () => {
      const remaining = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000))
      setSeconds(remaining)
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [timerEnd])

  if (seconds === null) return null

  const isUrgent = seconds <= 10

  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-full font-bold text-xl shadow-lg transition-all ${
      isUrgent
        ? 'bg-red-500 text-white animate-pulse scale-110'
        : 'bg-white/90 text-ink-200'
    }`}>
      ⏱️ {seconds}s
    </div>
  )
}
