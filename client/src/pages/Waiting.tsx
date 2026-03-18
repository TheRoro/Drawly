import { useGame } from '../context/GameContext'
import Timer from '../components/Timer'
import Chat from '../components/Chat'

export default function Waiting() {
  const { waitingMessage, timerEnd, drawingRound, totalRounds, spyDrawings } = useGame()

  return (
    <section className="w-screen min-h-screen bg-paper-pattern bg-no-repeat bg-cover flex flex-col items-center justify-center p-6">
      <Timer timerEnd={timerEnd} />

      <div className="card text-center animate-bounce-in max-w-md mb-8">
        <p className="text-5xl mb-4">🕵️</p>
        <p className="text-ink-100 text-sm mb-2">Round {drawingRound} of {totalRounds}</p>
        <h2 className="font-pacifico text-2xl text-ink-200 mb-3">Spy Mode</h2>
        <p className="text-ink-100">{waitingMessage}</p>
        <p className="text-xs text-ink-100 mt-3 bg-yellow-100 rounded-lg px-3 py-2">
          ⭐ Your vote counts <span className="font-bold">2x</span> since it's your prompt!
        </p>
      </div>

      {spyDrawings.length > 0 && (
        <div className="w-full max-w-4xl">
          <p className="text-ink-100 text-center mb-4 text-sm">
            {spyDrawings.filter((s: any) => s.submitted).length} of{' '}
            {spyDrawings.length} drawing{spyDrawings.length !== 1 ? 's' : ''} submitted
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {spyDrawings.map((spy, i) => (
              <div key={i} className="card animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
                <p className="text-sm text-ink-100 text-center mb-2">
                  Artist {i + 1} {(spy as any).submitted ? '✅' : '🎨'}
                </p>
                <img
                  src={spy.imageData}
                  alt="Drawing in progress"
                  className="w-full rounded-xl border border-paper-300"
                  style={{ filter: (spy as any).submitted ? 'blur(4px)' : 'blur(6px)' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {spyDrawings.length === 0 && (
        <p className="text-ink-100 animate-pulse">Waiting for drawings to come in...</p>
      )}

      <Chat />
    </section>
  )
}
