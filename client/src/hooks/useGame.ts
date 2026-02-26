import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '../socket'

export interface Player {
  id: string
  nickname: string
  isHost: boolean
  score: number
}

export interface RoomState {
  players: Player[]
  phase: string
  code: string
}

export interface DrawingEntry {
  index: number
  prompt: string
  imageData: string
  playerNickname: string
}

export interface ResultEntry {
  playerNickname: string
  prompt: string
  imageData: string
  votes: number
}

export interface LeaderboardEntry {
  nickname: string
  score: number
  isHost: boolean
}

export function useGame() {
  const navigate = useNavigate()
  const [room, setRoom] = useState<RoomState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [assignedPrompt, setAssignedPrompt] = useState<string>('')
  const [timerEnd, setTimerEnd] = useState<number | null>(null)
  const [drawings, setDrawings] = useState<DrawingEntry[]>([])
  const [results, setResults] = useState<ResultEntry[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    if (!socket.connected) {
      socket.connect()
    }

    socket.on('room-update', (data: RoomState) => {
      setRoom(data)
    })

    socket.on('room-created', ({ code }: { code: string }) => {
      setRoom(prev => prev ? { ...prev, code } : { players: [], phase: 'lobby', code })
    })

    socket.on('game-phase', ({ phase, timerEnd: te }: { phase: string; timerEnd?: number }) => {
      setRoom(prev => prev ? { ...prev, phase } : null)
      setTimerEnd(te || null)

      switch (phase) {
        case 'prompts':
          navigate('/prompt')
          break
        case 'drawing':
          navigate('/draw')
          break
        case 'voting':
          navigate('/gallery')
          break
        case 'results':
          navigate('/results')
          break
      }
    })

    socket.on('assign-prompt', ({ prompt }: { prompt: string }) => {
      setAssignedPrompt(prompt)
    })

    socket.on('drawings', ({ drawings: d }: { drawings: DrawingEntry[] }) => {
      setDrawings(d)
    })

    socket.on('results', ({ drawings: d, leaderboard: l }: { drawings: ResultEntry[]; leaderboard: LeaderboardEntry[] }) => {
      setResults(d)
      setLeaderboard(l)
    })

    socket.on('error', ({ message }: { message: string }) => {
      setError(message)
      setTimeout(() => setError(null), 3000)
    })

    return () => {
      socket.off('room-update')
      socket.off('room-created')
      socket.off('game-phase')
      socket.off('assign-prompt')
      socket.off('drawings')
      socket.off('results')
      socket.off('error')
    }
  }, [navigate])

  const createRoom = useCallback((nickname: string) => {
    socket.emit('create-room', { nickname })
  }, [])

  const joinRoom = useCallback((code: string, nickname: string) => {
    socket.emit('join-room', { code, nickname })
  }, [])

  const startGame = useCallback(() => {
    socket.emit('start-game')
  }, [])

  const submitPrompt = useCallback((prompt: string) => {
    socket.emit('submit-prompt', { prompt })
  }, [])

  const submitDrawing = useCallback((imageData: string) => {
    socket.emit('submit-drawing', { imageData })
  }, [])

  const submitVote = useCallback((drawingIndex: number) => {
    socket.emit('submit-vote', { drawingIndex })
  }, [])

  const playAgain = useCallback(() => {
    socket.emit('play-again')
  }, [])

  return {
    room,
    error,
    assignedPrompt,
    timerEnd,
    drawings,
    results,
    leaderboard,
    createRoom,
    joinRoom,
    startGame,
    submitPrompt,
    submitDrawing,
    submitVote,
    playAgain,
    socketId: socket.id,
  }
}
