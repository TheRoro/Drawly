import { useGame } from '../context/GameContext'
import { socket } from '../socket'

export default function Lobby() {
  const { room, startGame, error } = useGame()

  const isHost = room?.players.find(p => p.id === socket.id)?.isHost

  return (
    <section className="w-screen h-screen bg-paper-pattern bg-no-repeat bg-cover flex flex-col items-center justify-center p-6">
      <div className="card max-w-md w-full animate-slide-up">
        <h2 className="font-pacifico text-4xl text-ink-200 text-center mb-2">
          Waiting Room
        </h2>

        {room?.code && (
          <div className="text-center mb-6">
            <p className="text-ink-100 text-sm">Room Code</p>
            <p className="font-mono text-3xl font-bold text-ink-200 tracking-[0.3em] bg-paper-300 rounded-lg py-2 px-4 inline-block">
              {room.code}
            </p>
          </div>
        )}

        <div className="space-y-3 mb-6">
          <p className="text-ink-100 text-sm font-medium">
            Players ({room?.players.length || 0}/10)
          </p>
          {room?.players.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-3 bg-paper-200 rounded-lg px-4 py-2 animate-fade-in"
            >
              <span className="text-2xl">{player.isHost ? '👑' : '✏️'}</span>
              <span className="text-lg font-medium text-ink-200">{player.nickname}</span>
              {player.id === socket.id && (
                <span className="ml-auto text-xs bg-blue-200 text-blue-700 px-2 py-1 rounded-full">You</span>
              )}
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            className="btn-green w-full"
            onClick={startGame}
            disabled={!room || room.players.length < 2}
          >
            {room && room.players.length < 2 ? 'Need 2+ players' : '🚀 Start Game!'}
          </button>
        ) : (
          <p className="text-center text-ink-100 text-lg">
            Waiting for host to start...
          </p>
        )}

        {error && (
          <p className="mt-4 text-red-500 text-center font-medium animate-fade-in">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
