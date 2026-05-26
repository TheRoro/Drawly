import { useState } from 'react'
import { useGame } from '../context/GameContext'
import { socket } from '../socket'
import Timer from '../components/Timer'

export default function Gallery() {
  const { drawings, submitVote, isPromptAuthor, timerEnd } = useGame()
  const [voted, setVoted] = useState<number | null>(null)

  const handleVote = (index: number) => {
    // Can't vote for own drawing
    if (drawings[index]?.playerId === socket.id) return
    submitVote(index)
    setVoted(index)
  }

  const isOwnDrawing = (index: number) => drawings[index]?.playerId === socket.id

  return (
    <section className="w-screen min-h-screen bg-paper-pattern bg-no-repeat bg-cover p-6">
      <Timer timerEnd={timerEnd} />

      <h2 className="font-pacifico text-5xl text-ink-200 text-center mb-2 animate-bounce-in">
        🗳️ Vote!
      </h2>
      <p className="text-ink-100 text-center mb-2 text-lg">
        Pick your favorite drawing
      </p>
      {drawings.length > 0 && (
        <p className="text-ink-200 text-center mb-4 font-shadows text-2xl">
          "{drawings[0].prompt}"
        </p>
      )}
      {isPromptAuthor && (
        <div className="text-center mb-6">
          <span className="text-sm bg-yellow-100 rounded-lg px-4 py-2 inline-block">
            ⭐ Your vote counts <span className="font-bold">2x</span> — it's your prompt!
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto">
        {drawings.map((drawing, i) => (
          <button
            type="button"
            key={i}
            className={`card w-full text-left transition-all duration-200 animate-slide-up touch-manipulation ${
              isOwnDrawing(i)
                ? 'opacity-50 cursor-not-allowed ring-2 ring-gray-300'
                : voted === i
                ? 'ring-4 ring-emerald-400 scale-[1.02] sm:scale-105 cursor-default'
                : voted !== null
                ? 'opacity-60 cursor-default'
                : 'cursor-pointer active:scale-95 sm:hover:scale-105 sm:hover:shadow-xl'
            }`}
            style={{ animationDelay: `${i * 100}ms` }}
            onClick={() => voted === null && !isOwnDrawing(i) && handleVote(i)}
            aria-disabled={isOwnDrawing(i) || voted !== null}
            aria-label={
              isOwnDrawing(i)
                ? `Drawing option ${i + 1}, your drawing, voting disabled`
                : `Vote for drawing option ${i + 1}`
            }
            aria-pressed={voted === i}
          >
            <img
              src={drawing.imageData}
              alt=""
              className="w-full rounded-xl border border-paper-300"
            />
            {isOwnDrawing(i) && (
              <span className="block text-center mt-3 text-gray-400 text-sm font-medium">
                🚫 Your drawing
              </span>
            )}
            {voted === i && (
              <span className="block text-center mt-3 text-emerald-600 font-bold animate-bounce-in" role="status">
                ✅ Your vote!
              </span>
            )}
          </button>
        ))}
      </div>

      {drawings.length === 0 && (
        <p className="text-center text-ink-100 text-xl mt-12">
          Waiting for drawings...
        </p>
      )}
    </section>
  )
}
