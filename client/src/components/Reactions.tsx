import { useState, useEffect, useRef } from 'react'
import { useGame } from '../context/GameContext'

const REACTIONS = [
  { emoji: '💥', sound: '/sounds/vine-boom.mp3', label: 'Boom' },
  { emoji: '👁️', sound: '/sounds/sus.mp3', label: 'Sus' },
  { emoji: '🗿', sound: '/sounds/bruh.mp3', label: 'Bruh' },
  { emoji: '🫠', sound: '/sounds/faah.mp3', label: 'FAHH' },
  { emoji: '💀', sound: '/sounds/hee-hee.mp3', label: 'Hee Hee' },
  { emoji: '🎺', sound: '/sounds/airhorn.mp3', label: 'Horn' },
]

// Preload audio for instant playback
const audioCache = new Map<string, HTMLAudioElement>()
function playSound(src: string) {
  try {
    // Clone from cache for overlapping plays
    let cached = audioCache.get(src)
    if (!cached) {
      cached = new Audio(src)
      cached.preload = 'auto'
      audioCache.set(src, cached)
    }
    const clone = cached.cloneNode() as HTMLAudioElement
    clone.volume = 0.5
    clone.play().catch(() => {}) // ignore autoplay restrictions
  } catch {
    // Sound not available — fail silently
  }
}

interface FloatingEmoji {
  id: string
  emoji: string
  x: number
}

export default function Reactions() {
  const { reactions, sendReaction } = useGame()
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([])
  const [muted, setMuted] = useState(false)
  const lastReactionCount = useRef(0)

  // Preload sounds on mount
  useEffect(() => {
    REACTIONS.forEach(r => {
      const audio = new Audio(r.sound)
      audio.preload = 'auto'
      audioCache.set(r.sound, audio)
    })
  }, [])

  // Convert incoming reactions to floating emojis + play sound
  useEffect(() => {
    if (reactions.length === 0) return
    if (reactions.length <= lastReactionCount.current) {
      lastReactionCount.current = reactions.length
      return
    }
    lastReactionCount.current = reactions.length

    const latest = reactions[reactions.length - 1]
    const floating: FloatingEmoji = {
      id: latest.id,
      emoji: latest.emoji,
      x: 10 + Math.random() * 80,
    }
    setFloatingEmojis(prev => [...prev, floating])
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(f => f.id !== floating.id))
    }, 2500)

    // Play sound
    if (!muted) {
      const reaction = REACTIONS.find(r => r.emoji === latest.emoji)
      if (reaction) playSound(reaction.sound)
    }
  }, [reactions, muted])

  return (
    <>
      {/* Floating emojis across the page */}
      <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
        {floatingEmojis.map(f => (
          <span
            key={f.id}
            className="absolute text-4xl animate-float-up"
            style={{ left: `${f.x}%`, bottom: '5%' }}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      {/* Reaction bar fixed at bottom */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-1 bg-white/90 backdrop-blur-sm rounded-full shadow-lg px-3 py-2 border border-paper-300">
        <button
          type="button"
          onClick={() => setMuted(!muted)}
          className="text-lg hover:scale-110 active:scale-90 transition-transform touch-manipulation px-1 opacity-60"
          title={muted ? 'Unmute sounds' : 'Mute sounds'}
          aria-label={muted ? 'Unmute reaction sounds' : 'Mute reaction sounds'}
          aria-pressed={muted}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        {REACTIONS.map(({ emoji, label }) => (
          <button
            type="button"
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="text-2xl hover:scale-125 active:scale-90 transition-transform touch-manipulation p-1"
            title={label}
            aria-label={`Send ${label} reaction`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  )
}
