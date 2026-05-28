import { useEffect, useState, useRef, useCallback } from 'react'
import { useGame } from '../context/GameContext'
import { socket } from '../socket'
import confetti from 'canvas-confetti'
import Reactions from '../components/Reactions'
import { createRecapImage } from '../utils/createRecapImage'

const MEDALS = ['🥇', '🥈', '🥉']
const PODIUM_HEIGHTS = ['h-40', 'h-28', 'h-20']
const PODIUM_COLORS = ['bg-yellow-400', 'bg-gray-300', 'bg-orange-300']

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
  const [recapStatus, setRecapStatus] = useState('')
  const [isCreatingRecap, setIsCreatingRecap] = useState(false)

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

  const podiumDrawings = results.slice(0, 3)
  // Reorder for podium display: [2nd, 1st, 3rd]
  const podiumOrder = podiumDrawings.length >= 3
    ? [podiumDrawings[1], podiumDrawings[0], podiumDrawings[2]]
    : podiumDrawings.length === 2
    ? [podiumDrawings[1], podiumDrawings[0]]
    : podiumDrawings

  const downloadDrawing = useCallback((imageData: string, prompt: string) => {
    const link = document.createElement('a')
    link.href = imageData
    link.download = `drawly-${prompt.replace(/[^a-z0-9]/gi, '-').slice(0, 30)}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [])

  const createRecap = useCallback(async (share: boolean) => {
    if (isCreatingRecap) return
    setIsCreatingRecap(true)
    setRecapStatus('')

    try {
      const blob = await createRecapImage(leaderboard, results)
      const file = new File([blob], 'drawly-game-recap.png', { type: 'image/png' })

      if (share && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'Our Drawly game',
          text: 'Check out the results from our Drawly game!',
          files: [file],
        })
        setRecapStatus('Recap shared.')
        return
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setRecapStatus(share ? 'Sharing is unavailable here, so the recap was downloaded.' : 'Recap downloaded.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setRecapStatus('Sharing canceled.')
      } else {
        setRecapStatus(error instanceof Error ? error.message : 'The recap could not be created.')
      }
    } finally {
      setIsCreatingRecap(false)
    }
  }, [isCreatingRecap, leaderboard, results])

  return (
    <section className="w-screen min-h-screen bg-paper-pattern bg-no-repeat bg-cover p-6 pb-20">
      <h2 className="font-pacifico text-5xl text-ink-200 text-center mb-8 animate-bounce-in">
        🏆 Results
      </h2>

      {/* Leaderboard */}
      <div className="card max-w-md mx-auto mb-10 animate-slide-up">
        <h3 className="font-shadows text-3xl text-ink-200 text-center mb-4">Leaderboard</h3>
        <div className="space-y-3">
          {leaderboard.map((entry, i, arr) => {
            const rank = i === 0 ? 1 : (entry.score === arr[i - 1].score ? null : i + 1)
            const rankLabel = rank ? (MEDALS[rank - 1] || `#${rank}`) : '—'
            const isFirst = i === 0 || entry.score === arr[0].score
            const isSecond = !isFirst && (rank === 2 || (i > 0 && arr.findIndex(e => e.score === entry.score) === arr.findIndex(e => e.score === arr[1]?.score)))
            const isThird = !isFirst && !isSecond && (rank === 3 || (i > 0 && arr.findIndex(e => e.score === entry.score) === arr.findIndex(e => e.score === arr[2]?.score)))

            return (
              <div
                key={entry.nickname}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                  isFirst ? 'bg-yellow-100 ring-2 ring-yellow-400' : isSecond ? 'bg-gray-100' : isThird ? 'bg-orange-50' : 'bg-paper-200'
                }`}
              >
                <span className="text-2xl w-9 text-center">{rankLabel}</span>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm shadow"
                  style={{ backgroundColor: entry.color }}
                >
                  {entry.avatar || entry.nickname.charAt(0).toUpperCase()}
                </div>
                <span className="text-lg font-medium text-ink-200 flex-1">{entry.nickname}</span>
                <span className="font-bold text-ink-200">
                  <AnimatedScore target={entry.score} delay={i * 300} /> pts
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Podium */}
      {podiumDrawings.length > 0 && (
        <div className="max-w-3xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <h3 className="font-shadows text-3xl text-ink-200 text-center mb-6">🎨 Top Drawings</h3>

          {/* Drawing cards in podium order */}
          <div className={`grid gap-4 mb-4 ${podiumOrder.length === 1 ? 'grid-cols-1 max-w-xs mx-auto' : podiumOrder.length === 2 ? 'grid-cols-2 max-w-lg mx-auto' : 'grid-cols-3'}`}>
            {podiumOrder.map((result, displayIdx) => {
              const actualRank = podiumDrawings.indexOf(result)
              return (
                <div
                  key={displayIdx}
                  className={`card text-center relative ${actualRank === 0 ? 'ring-4 ring-yellow-400 shadow-xl' : ''} ${actualRank === 0 ? 'sm:-mt-4' : 'sm:mt-4'}`}
                  style={{ animationDelay: `${(displayIdx + 1) * 200}ms` }}
                >
                  {/* Vote badge */}
                  <div className={`absolute -top-3 -right-3 rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg shadow-lg ${actualRank === 0 ? 'bg-yellow-400 text-yellow-900' : 'bg-blue-500 text-white'}`}>
                    {result.votes}
                  </div>

                  <span className="text-3xl">{MEDALS[actualRank]}</span>
                  <p className="font-shadows text-sm sm:text-base text-ink-100 mt-1 truncate">"{result.prompt}"</p>
                  <img src={result.imageData} alt={result.prompt} className="w-full rounded-xl mt-2 border border-paper-300" />
                  <p className="mt-2 text-ink-200 font-medium text-sm">by {result.playerNickname}</p>

                  {/* Download button */}
                  <button
                    onClick={() => downloadDrawing(result.imageData, result.prompt)}
                    className="mt-2 text-xs bg-paper-200 hover:bg-paper-300 text-ink-200 rounded-lg px-3 py-1.5 touch-manipulation transition-colors"
                    title="Save drawing"
                  >
                    💾 Save
                  </button>
                </div>
              )
            })}
          </div>

          {/* Podium bars */}
          <div className={`flex items-end justify-center gap-1 ${podiumOrder.length < 3 ? 'max-w-sm mx-auto' : ''}`}>
            {podiumOrder.map((result, displayIdx) => {
              const actualRank = podiumDrawings.indexOf(result)
              return (
                <div key={displayIdx} className="flex-1 flex flex-col items-center">
                  <p className="text-xs text-ink-100 mb-1 truncate max-w-full">{result.playerNickname}</p>
                  <div className={`w-full ${PODIUM_HEIGHTS[actualRank]} ${PODIUM_COLORS[actualRank]} rounded-t-lg flex items-center justify-center shadow-inner`}>
                    <span className="text-2xl font-bold">{actualRank + 1}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {leaderboard.length > 0 && (
        <div className="card max-w-xl mx-auto mb-10 text-center">
          <h3 className="font-shadows text-3xl text-ink-200">Share the chaos</h3>
          <p className="text-ink-100 mt-2 mb-4">
            Create a branded recap with the leaderboard and top drawings. It is generated entirely in your browser.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              className="btn-blue text-base"
              onClick={() => void createRecap(true)}
              disabled={isCreatingRecap}
            >
              📤 Share Recap
            </button>
            <button
              type="button"
              className="btn text-base bg-paper-200 text-ink-200 hover:bg-paper-300 disabled:opacity-60"
              onClick={() => void createRecap(false)}
              disabled={isCreatingRecap}
            >
              💾 Save Recap
            </button>
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            {isCreatingRecap ? 'Creating recap.' : recapStatus}
          </p>
          {recapStatus && (
            <p className="text-sm text-ink-100 mt-3" aria-hidden="true">{recapStatus}</p>
          )}
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

      <Reactions />
    </section>
  )
}
