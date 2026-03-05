import { useState, useEffect } from 'react'
import { useGame } from '../context/GameContext'

const MEDALS = ['🥇', '🥈', '🥉']

export default function RoundResults() {
  const { roundResults, drawingRound, totalRounds } = useGame()
  const [revealedVotes, setRevealedVotes] = useState(false)

  // Animate vote reveal after a short delay
  useEffect(() => {
    setRevealedVotes(false)
    const timer = setTimeout(() => setRevealedVotes(true), 800)
    return () => clearTimeout(timer)
  }, [roundResults])

  if (!roundResults) {
    return (
      <section className="w-screen h-screen bg-paper-pattern bg-no-repeat bg-cover flex items-center justify-center">
        <p className="text-ink-100 text-xl">Loading results...</p>
      </section>
    )
  }

  return (
    <section className="w-screen min-h-screen bg-paper-pattern bg-no-repeat bg-cover p-6">
      <h2 className="font-pacifico text-4xl text-ink-200 text-center mb-2 animate-bounce-in">
        Round {drawingRound} of {totalRounds}
      </h2>
      <p className="text-ink-100 text-center mb-8 text-lg animate-slide-up">
        Next round starting soon...
      </p>

      {/* Mini leaderboard */}
      <div className="card max-w-sm mx-auto mb-8 animate-slide-up">
        <h3 className="font-shadows text-2xl text-ink-200 text-center mb-3">Standings</h3>
        <div className="space-y-2">
          {roundResults.leaderboard.map((entry, i) => (
            <div
              key={entry.nickname}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                i === 0 ? 'bg-yellow-100' : 'bg-paper-200'
              }`}
            >
              <span className="text-xl">{MEDALS[i] || `#${i + 1}`}</span>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shadow"
                style={{ backgroundColor: entry.color }}
              >
                {entry.nickname.charAt(0).toUpperCase()}
              </div>
              <span className="text-ink-200 font-medium flex-1">{entry.nickname}</span>
              <span className="font-bold text-ink-200">{entry.score} pts</span>
            </div>
          ))}
        </div>
      </div>

      {/* Round drawings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {roundResults.drawings.map((result, i) => (
          <div key={i} className="card text-center animate-slide-up relative" style={{ animationDelay: `${i * 100}ms` }}>
            <div className={`absolute -top-3 -right-3 bg-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg shadow-lg transition-all duration-500 ${
              revealedVotes ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
            }`}>
              {result.votes}
            </div>
            {i < 3 && <span className="text-2xl">{MEDALS[i]}</span>}
            <p className="font-shadows text-lg text-ink-100 mt-1">"{result.prompt}"</p>
            <img src={result.imageData} alt={result.prompt} className="w-full rounded-xl mt-3 border border-paper-300" />
            <p className={`mt-2 text-ink-200 font-medium transition-opacity duration-500 ${revealedVotes ? 'opacity-100' : 'opacity-0'}`}>
              by {result.playerNickname}
            </p>
            <p className={`text-ink-100 text-sm transition-opacity duration-500 ${revealedVotes ? 'opacity-100' : 'opacity-0'}`}>
              {result.votes} vote{result.votes !== 1 ? 's' : ''}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
