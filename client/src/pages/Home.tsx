import { useNavigate } from 'react-router-dom'

export default function Home() {
  const navigate = useNavigate()

  return (
    <section className="w-screen h-screen bg-paper-pattern bg-no-repeat bg-cover flex items-center justify-center p-6">
      <div className="flex flex-col lg:flex-row items-center gap-12 max-w-5xl w-full">
        <div className="flex-1 flex flex-col items-center gap-6">
          <h1 className="font-pacifico text-7xl lg:text-9xl text-ink-200 text-center animate-bounce-in">
            Drawly
          </h1>
          <h2 className="font-shadows text-4xl lg:text-6xl text-ink-100 text-center animate-fade-in">
            Fun With Friends
          </h2>
          <p className="text-ink-100 text-center text-lg mt-4 max-w-md">
            Draw, guess, and vote for the best artwork! Create a room and invite your friends for a hilarious drawing showdown.
          </p>
        </div>
        <div className="flex flex-col gap-4 animate-slide-up">
          <button
            className="btn-green w-72"
            onClick={() => navigate('/join?mode=create')}
          >
            🎨 Create Room
          </button>
          <button
            className="btn-blue w-72"
            onClick={() => navigate('/join?mode=join')}
          >
            🚪 Join Room
          </button>
        </div>
      </div>
    </section>
  )
}
