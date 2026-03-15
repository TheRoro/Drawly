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
  const [roomCode, setRoomCode] = useState(searchParams.get('code')?.toUpperCase() || '')
  const [waiting, setWaiting] = useState(false)
  const [waking, setWaking] = useState(false)
  const [wakeError, setWakeError] = useState<string | null>(null)

  // If a code was passed in URL, force join mode
  const effectiveMode = roomCode && searchParams.get('code') ? 'join' : mode

  // Navigate to lobby once the server confirms room
  useEffect(() => {
    if (waiting && room?.code) {
      navigate('/lobby')
    }
  }, [waiting, room, navigate])

  const wakeServer = async (): Promise<boolean> => {
    setWakeError(null)
    setWaking(true)
    let lastError = 'Health check timed out'

    try {
      const response = await fetch(`${SERVER_URL}/health`, { signal: AbortSignal.timeout(15000) })
      if (response.ok) {
        setWaking(false)
        return true
      }
      lastError = `Health check returned ${response.status}`
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network request failed'
    }

    // First attempt failed, retry once (cold start can take ~30s)
    try {
      await new Promise(r => setTimeout(r, 3000))
      const response = await fetch(`${SERVER_URL}/health`, { signal: AbortSignal.timeout(30000) })
      if (response.ok) {
        setWaking(false)
        return true
      }
      lastError = `Health check returned ${response.status}`
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network request failed'
    }

    setWakeError(
      `Can't reach game server — try mobile data or a different network. Possible causes: Render is still waking up, your home/corporate Wi-Fi is blocking the request, or the browser rejected the connection. Last error: ${lastError}`
    )
    setWaking(false)
    return false
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setWakeError(null)
    if (!nickname.trim()) return

    // Wake the server first
    const serverReady = await wakeServer()
    if (!serverReady) {
      return
    }

    if (effectiveMode === 'create') {
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
          {effectiveMode === 'create' ? '🎨 Create Room' : '🚪 Join Room'}
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

          {effectiveMode === 'join' && (
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
            className={effectiveMode === 'create' ? 'btn-green mt-4' : 'btn-blue mt-4'}
            disabled={waking}
          >
            {waking ? '⏳ Waking up server...' : effectiveMode === 'create' ? "Let's Go!" : 'Join'}
          </button>
        </form>

        {waking && (
          <p className="mt-4 text-ink-100 text-center text-sm animate-pulse">
            Free server is waking up, this can take ~30s...
          </p>
        )}

        {(wakeError || error) && (
          <div className="mt-4 text-center animate-fade-in">
            <p className="text-red-500 font-medium">{wakeError || error}</p>
            {wakeError && <p className="mt-2 text-xs text-ink-100">If friends can connect on mobile data but not home Wi-Fi, the network is likely the problem.</p>}
          </div>
        )}
      </div>
    </section>
  )
}
