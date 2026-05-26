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
  const shouldAnnounce = [10, 5, 3, 2, 1, 0].includes(seconds)

  return (
    <>
      <div
        role="timer"
        aria-label={`${seconds} seconds remaining`}
        className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-full font-bold text-xl shadow-lg transition-all ${
          isUrgent
            ? 'bg-red-500 text-white motion-safe:animate-pulse motion-safe:scale-110'
            : 'bg-white/90 text-ink-200'
        }`}
      >
        <span aria-hidden="true">⏱️ </span>{seconds}s
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {shouldAnnounce ? `${seconds} seconds remaining` : ''}
      </span>
    </>
  )
}
