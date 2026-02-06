import { useEffect, useState, useRef } from 'react'
import { useGame } from '../context/GameContext'
import { socket } from '../socket'
import confetti from 'canvas-confetti'

const MEDALS = ['🥇', '🥈', '🥉']

function AnimatedScore({ target, delay = 0 }: { target: number; delay?: number }) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      const duration = 1200
      const start = Date.now()
      const tick = () => {
        const elapsed = Date.now() - start
        const progress = Math.min(elapsed / duration, 1)
        // Ease out quad
        const eased = 1 - (1 - progress) * (1 - progress)
        setValue(Math.round(eased * target))
        if (progress < 1) requestAnimationFrame(tick)
      }
      tick()
    }, delay)
    return () => clearTimeout(timer)
  }, [target, delay])

  return <>{value}</>
}

export default function Results() {
  const { results, leaderboard, playAgain, room } = useGame()
  const isHost = room?.players.find(p => p.id === socket.id)?.isHost
  const confettiFired = useRef(false)

  // Fire confetti for the winner
  useEffect(() => {
    if (leaderboard.length > 0 && !confettiFired.current) {
      confettiFired.current = true
      // Initial burst
      setTimeout(() => {
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } })
      }, 500)
      // Second burst
      setTimeout(() => {
        confetti({ particleCount: 80, spread: 120, origin: { x: 0.3, y: 0.7 } })
        confetti({ particleCount: 80, spread: 120, origin: { x: 0.7, y: 0.7 } })
      }, 1200)
    }
  }, [leaderboard])

  // Find best drawing (most votes overall)
  const bestDrawing = results.length > 0 ? results[0] : null

  return (
    <section className="w-screen min-h-screen bg-paper-pattern bg-no-repeat bg-cover p-6">
      <h2 className="font-pacifico text-5xl text-ink-200 text-center mb-8 animate-bounce-in">
        🏆 Results
      </h2>

      {/* Leaderboard */}
      <div className="card max-w-md mx-auto mb-10 animate-slide-up">
        <h3 className="font-shadows text-3xl text-ink-200 text-center mb-4">Leaderboard</h3>
        <div className="space-y-3">
          {leaderboard.map((entry, i) => (
            <div
              key={entry.nickname}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                i === 0 ? 'bg-yellow-100 ring-2 ring-yellow-400' : i === 1 ? 'bg-gray-100' : i === 2 ? 'bg-orange-50' : 'bg-paper-200'
              }`}
            >
              <span className="text-2xl">{MEDALS[i] || `#${i + 1}`}</span>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow"
                style={{ backgroundColor: entry.color }}
              >
                {entry.nickname.charAt(0).toUpperCase()}
              </div>
              <span className="text-lg font-medium text-ink-200 flex-1">{entry.nickname}</span>
              <span className="font-bold text-ink-200">
                <AnimatedScore target={entry.score} delay={i * 300} /> pts
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Best of the Game */}
      {bestDrawing && (
        <div className="max-w-sm mx-auto mb-10 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <h3 className="font-shadows text-3xl text-ink-200 text-center mb-4">⭐ Best of the Game</h3>
          <div className="card text-center ring-4 ring-yellow-400 shadow-xl relative">
            <div className="absolute -top-4 -right-4 bg-yellow-400 text-yellow-900 rounded-full w-12 h-12 flex items-center justify-center font-bold text-xl shadow-lg">
              {bestDrawing.votes}
            </div>
            <p className="font-shadows text-xl text-ink-200">"{bestDrawing.prompt}"</p>
            <img src={bestDrawing.imageData} alt={bestDrawing.prompt} className="w-full rounded-xl mt-3 border border-paper-300" />
            <p className="mt-3 text-ink-200 font-bold text-lg">🎨 by {bestDrawing.playerNickname}</p>
            <p className="text-ink-100 text-sm">{bestDrawing.votes} vote{bestDrawing.votes !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {/* Other top drawings */}
      {results.length > 1 && (
        <div className="max-w-4xl mx-auto mb-10">
          <h3 className="font-shadows text-2xl text-ink-200 text-center mb-6">Runner Ups</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.slice(1, 4).map((result, i) => (
              <div key={i} className="card text-center animate-slide-up relative" style={{ animationDelay: `${(i + 2) * 150}ms` }}>
                <div className="absolute -top-3 -right-3 bg-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg shadow-lg">
                  {result.votes}
                </div>
                <p className="font-shadows text-lg text-ink-100">"{result.prompt}"</p>
                <img src={result.imageData} alt={result.prompt} className="w-full rounded-xl mt-3 border border-paper-300" />
                <p className="mt-2 text-ink-200 font-medium">by {result.playerNickname}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Play again */}
      <div className="text-center">
        {isHost ? (
          <button className="btn-green" onClick={playAgain}>
            🔄 Play Again!
          </button>
        ) : (
          <p className="text-ink-100 text-lg">Waiting for host to start next round...</p>
        )}
      </div>
    </section>
  )
}
