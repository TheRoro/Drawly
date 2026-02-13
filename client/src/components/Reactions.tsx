import { useState, useEffect } from 'react'
import { useGame } from '../context/GameContext'

const REACTION_EMOJIS = ['😂', '🔥', '💀', '👏', '😍', '💩']

interface FloatingEmoji {
  id: string
  emoji: string
  x: number
}

export default function Reactions() {
  const { reactions, sendReaction } = useGame()
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([])

  // Convert incoming reactions to floating emojis
  useEffect(() => {
    if (reactions.length === 0) return
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
  }, [reactions])

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
        {REACTION_EMOJIS.map(emoji => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="text-2xl hover:scale-125 active:scale-90 transition-transform touch-manipulation p-1"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  )
}
