import { useState } from 'react'
import { useGame } from '../context/GameContext'
import { socket } from '../socket'
import Chat from '../components/Chat'

export default function Lobby() {
  const { room, startGame, error } = useGame()
  const [copied, setCopied] = useState(false)

  const isHost = room?.players.find(p => p.id === socket.id)?.isHost

  const copyInviteLink = () => {
    if (!room?.code) return
    const link = `${window.location.origin}/join?mode=join&code=${room.code}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

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
            <button
              onClick={copyInviteLink}
              className="block mx-auto mt-2 text-sm px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full transition-colors"
            >
              {copied ? '✅ Copied!' : '🔗 Copy invite link'}
            </button>
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
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-lg shadow-md"
                style={{ backgroundColor: player.color }}
              >
                {player.avatar || player.nickname.charAt(0).toUpperCase()}
              </div>
              <span className="text-lg font-medium text-ink-200">{player.nickname}</span>
              {player.isHost && <span className="text-sm">👑</span>}
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
            {!room || room.players.length < 2 ? `Need 2+ players (${room?.players.length || 0} joined)` : '🚀 Start Game!'}
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

      <Chat />
    </section>
  )
}
