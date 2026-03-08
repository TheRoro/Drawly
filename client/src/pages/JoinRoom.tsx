import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useGame } from '../context/GameContext'
import ServerStatus from '../components/ServerStatus'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || ''

export default function JoinRoom() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') || 'join'
  const { createRoom, joinRoom, error, room } = useGame()

  const [nickname, setNickname] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [waiting, setWaiting] = useState(false)
  const [waking, setWaking] = useState(false)

  // Navigate to lobby once the server confirms room
  useEffect(() => {
    if (waiting && room?.code) {
      navigate('/lobby')
    }
  }, [waiting, room, navigate])

  const wakeServer = async (): Promise<boolean> => {
    setWaking(true)
    try {
      const response = await fetch(`${SERVER_URL}/health`, { signal: AbortSignal.timeout(15000) })
      if (response.ok) {
        setWaking(false)
        return true
      }
    } catch {
      // First attempt failed, retry once (cold start can take ~30s)
      try {
        await new Promise(r => setTimeout(r, 3000))
        const response = await fetch(`${SERVER_URL}/health`, { signal: AbortSignal.timeout(30000) })
        if (response.ok) {
          setWaking(false)
          return true
        }
      } catch {
        // Still failed
      }
    }
    setWaking(false)
    return false
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!nickname.trim()) return

    // Wake the server first
    const serverReady = await wakeServer()
    if (!serverReady) {
      return // error will show via socket
    }

    if (mode === 'create') {
      createRoom(nickname.trim())
      setWaiting(true)
    } else {
      if (!roomCode.trim()) return
      joinRoom(roomCode.trim().toUpperCase(), nickname.trim())
      setWaiting(true)
    }
  }

  return (
    <section className="w-screen h-screen bg-paper-pattern bg-no-repeat bg-cover flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4">
        <ServerStatus />
      </div>
      <button
        className="absolute top-6 left-6 text-ink-100 hover:text-ink-200 text-lg transition-colors"
        onClick={() => navigate('/')}
      >
        ← Back
      </button>

      <div className="card max-w-sm w-full animate-slide-up">
        <h2 className="font-pacifico text-4xl text-ink-200 text-center mb-8">
          {mode === 'create' ? '🎨 Create Room' : '🚪 Join Room'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            className="input-field"
            type="text"
            placeholder="Your nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={15}
            autoFocus
          />

          {mode === 'join' && (
            <input
              className="input-field uppercase tracking-widest text-center"
              type="text"
              placeholder="Room Code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={5}
            />
          )}

          <button
            type="submit"
            className={mode === 'create' ? 'btn-green mt-4' : 'btn-blue mt-4'}
            disabled={waking}
          >
            {waking ? '⏳ Waking up server...' : mode === 'create' ? "Let's Go!" : 'Join'}
          </button>
        </form>

        {waking && (
          <p className="mt-4 text-ink-100 text-center text-sm animate-pulse">
            Free server is waking up, this can take ~30s...
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
