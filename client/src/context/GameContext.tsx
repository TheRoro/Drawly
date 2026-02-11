import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '../socket'

export interface Player {
  id: string
  nickname: string
  isHost: boolean
  score: number
  color: string
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
  playerId?: string
  playerNickname?: string
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
  color: string
}

export interface SpyDrawing {
  imageData: string
  playerNickname: string
  count: number
  total: number
}

export interface ChatMessage {
  id: string
  playerId: string
  nickname: string
  color: string
  message: string
  timestamp: number
}

export interface Reaction {
  id: string
  playerId: string
  nickname: string
  emoji: string
  drawingIndex: number
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
  chatMessages: ChatMessage[]
  reactions: Reaction[]
  sendChatMessage: (message: string) => void
  sendReaction: (emoji: string, drawingIndex: number) => void
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])

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

    socket.on('chat-message', (msg: ChatMessage) => {
      setChatMessages(prev => [...prev.slice(-99), msg])
    })

    socket.on('reaction', (reaction: Reaction) => {
      setReactions(prev => [...prev.slice(-49), reaction])
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
      socket.off('chat-message')
      socket.off('reaction')
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

  const sendChatMessage = useCallback((message: string) => {
    socket.emit('chat-message', { message })
  }, [])

  const sendReaction = useCallback((emoji: string, drawingIndex: number) => {
    socket.emit('reaction', { emoji, drawingIndex })
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
      chatMessages,
      reactions,
      sendChatMessage,
      sendReaction,
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
