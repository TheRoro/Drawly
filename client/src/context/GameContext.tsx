import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
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

export interface SpyDrawing {
  imageData: string
  playerNickname: string
  count: number
  total: number
}

interface GameContextType {
  room: RoomState | null
  error: string | null
  assignedPrompt: string
  timerEnd: number | null
  drawings: DrawingEntry[]
  results: ResultEntry[]
  leaderboard: LeaderboardEntry[]
  drawingRound: number
  totalRounds: number
  roundResults: { drawings: ResultEntry[]; leaderboard: LeaderboardEntry[] } | null
  isPromptAuthor: boolean
  waitingMessage: string
  spyDrawings: SpyDrawing[]
  createRoom: (nickname: string) => void
  joinRoom: (code: string, nickname: string) => void
  startGame: () => void
  submitPrompt: (prompt: string) => void
  submitDrawing: (imageData: string) => void
  submitVote: (drawingIndex: number) => void
  playAgain: () => void
}

const GameContext = createContext<GameContextType | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [room, setRoom] = useState<RoomState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [assignedPrompt, setAssignedPrompt] = useState<string>('')
  const [timerEnd, setTimerEnd] = useState<number | null>(null)
  const [drawings, setDrawings] = useState<DrawingEntry[]>([])
  const [results, setResults] = useState<ResultEntry[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [drawingRound, setDrawingRound] = useState<number>(0)
  const [totalRounds, setTotalRounds] = useState<number>(0)
  const [roundResults, setRoundResults] = useState<{ drawings: ResultEntry[]; leaderboard: LeaderboardEntry[] } | null>(null)
  const [isPromptAuthor, setIsPromptAuthor] = useState<boolean>(false)
  const [waitingMessage, setWaitingMessage] = useState<string>('')
  const [spyDrawings, setSpyDrawings] = useState<SpyDrawing[]>([])

  useEffect(() => {
    if (!socket.connected) {
      socket.connect()
    }

    socket.on('room-created', ({ code }: { code: string }) => {
      setRoom(prev => prev ? { ...prev, code } : { players: [], phase: 'lobby', code })
    })

    socket.on('room-update', (data: RoomState) => {
      setRoom(data)
    })

    socket.on('game-phase', ({ phase, timerEnd: te, currentRound: cr, totalRounds: tr, promptAuthorId }: { phase: string; timerEnd?: number; currentRound?: number; totalRounds?: number; promptAuthorId?: string }) => {
      setRoom(prev => prev ? { ...prev, phase } : null)
      setTimerEnd(te || null)
      if (cr !== undefined) setDrawingRound(cr)
      if (tr !== undefined) setTotalRounds(tr)

      // Check if this player is the prompt author for this round
      const amAuthor = promptAuthorId === socket.id
      setIsPromptAuthor(amAuthor)

      switch (phase) {
        case 'prompts':
          setRoundResults(null)
          setIsPromptAuthor(false)
          setWaitingMessage('')
          navigate('/prompt')
          break
        case 'drawing':
          setRoundResults(null)
          if (amAuthor) {
            navigate('/waiting')
          } else {
            navigate('/draw')
          }
          break
        case 'voting':
          navigate('/gallery')
          break
        case 'results':
          navigate('/results')
          break
      }
    })

    socket.on('waiting-round', ({ message }: { message: string }) => {
      setWaitingMessage(message)
      setSpyDrawings([])
    })

    socket.on('spy-drawing', (data: SpyDrawing) => {
      setSpyDrawings(prev => [...prev, data])
    })

    socket.on('assign-prompt', ({ prompt }: { prompt: string }) => {
      setAssignedPrompt(prompt)
    })

    socket.on('drawings', ({ drawings: d }: { drawings: DrawingEntry[] }) => {
      setDrawings(d)
    })

    socket.on('round-results', ({ drawings: d, leaderboard: l, currentRound: cr, totalRounds: tr }: { drawings: ResultEntry[]; leaderboard: LeaderboardEntry[]; currentRound: number; totalRounds: number }) => {
      setRoundResults({ drawings: d, leaderboard: l })
      setDrawingRound(cr)
      setTotalRounds(tr)
      navigate('/round-results')
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
      socket.off('room-created')
      socket.off('room-update')
      socket.off('game-phase')
      socket.off('assign-prompt')
      socket.off('waiting-round')
      socket.off('spy-drawing')
      socket.off('drawings')
      socket.off('round-results')
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

  return (
    <GameContext.Provider value={{
      room,
      error,
      assignedPrompt,
      timerEnd,
      drawings,
      results,
      leaderboard,
      drawingRound,
      totalRounds,
      roundResults,
      isPromptAuthor,
      waitingMessage,
      spyDrawings,
      createRoom,
      joinRoom,
      startGame,
      submitPrompt,
      submitDrawing,
      submitVote,
      playAgain,
    }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const context = useContext(GameContext)
  if (!context) throw new Error('useGame must be used within GameProvider')
  return context
}
