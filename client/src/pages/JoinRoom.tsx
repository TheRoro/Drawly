import { useState, FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useGame } from '../hooks/useGame'

export default function JoinRoom() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') || 'join'
  const { createRoom, joinRoom, error } = useGame()

  const [nickname, setNickname] = useState('')
  const [roomCode, setRoomCode] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!nickname.trim()) return

    if (mode === 'create') {
      createRoom(nickname.trim())
      navigate('/lobby')
    } else {
      if (!roomCode.trim()) return
      joinRoom(roomCode.trim().toUpperCase(), nickname.trim())
      navigate('/lobby')
    }
  }

  return (
    <section className="w-screen h-screen bg-paper-pattern bg-no-repeat bg-cover flex flex-col items-center justify-center p-6">
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

          <button type="submit" className={mode === 'create' ? 'btn-green mt-4' : 'btn-blue mt-4'}>
            {mode === 'create' ? "Let's Go!" : 'Join'}
          </button>
        </form>

        {error && (
          <p className="mt-4 text-red-500 text-center font-medium animate-fade-in">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
