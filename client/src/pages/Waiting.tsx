import { useGame } from '../context/GameContext'
import Timer from '../components/Timer'

export default function Waiting() {
  const { waitingMessage, timerEnd, drawingRound, totalRounds } = useGame()

  return (
    <section className="w-screen h-screen bg-paper-pattern bg-no-repeat bg-cover flex flex-col items-center justify-center p-6">
      <Timer timerEnd={timerEnd} />

      <div className="card text-center animate-bounce-in max-w-md">
        <p className="text-5xl mb-6">✏️</p>
        <p className="text-ink-100 text-sm mb-2">Round {drawingRound} of {totalRounds}</p>
        <h2 className="font-pacifico text-2xl text-ink-200 mb-4">Your prompt is being drawn!</h2>
        <p className="text-ink-100 text-lg">{waitingMessage}</p>
        <p className="text-ink-100 mt-6 text-sm animate-pulse">
          Sit back and relax...
        </p>
      </div>
    </section>
  )
}
