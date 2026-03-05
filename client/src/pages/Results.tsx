import { useGame } from '../context/GameContext'
import { socket } from '../socket'

const MEDALS = ['🥇', '🥈', '🥉']

export default function Results() {
  const { results, leaderboard, playAgain, room } = useGame()
  const isHost = room?.players.find(p => p.id === socket.id)?.isHost

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
                i === 0 ? 'bg-yellow-100' : i === 1 ? 'bg-gray-100' : i === 2 ? 'bg-orange-50' : 'bg-paper-200'
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
              <span className="font-bold text-ink-200">{entry.score} pts</span>
            </div>
          ))}
        </div>
      </div>

      {/* Winning drawings */}
      {results.length > 0 && (
        <div className="max-w-4xl mx-auto mb-10">
          <h3 className="font-shadows text-3xl text-ink-200 text-center mb-6">Top Drawings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.slice(0, 3).map((result, i) => (
              <div key={i} className="card text-center animate-slide-up relative" style={{ animationDelay: `${i * 150}ms` }}>
                <div className="absolute -top-3 -right-3 bg-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg shadow-lg">
                  {result.votes}
                </div>
                <span className="text-3xl">{MEDALS[i]}</span>
                <p className="font-shadows text-lg text-ink-100 mt-2">"{result.prompt}"</p>
                <img src={result.imageData} alt={result.prompt} className="w-full rounded-xl mt-3 border border-paper-300" />
                <p className="mt-2 text-ink-200 font-medium">by {result.playerNickname}</p>
                <p className="text-ink-100 text-sm">{result.votes} vote{result.votes !== 1 ? 's' : ''}</p>
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
