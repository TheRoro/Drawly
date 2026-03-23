import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket, toLocalTime } from '../socket'

export interface Player {
  id: string
  nickname: string
  avatar: string
  isHost: boolean
  score: number
  connected: boolean
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
  avatar: string
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
  avatar: string
  color: string
  message: string
  timestamp: number
}

export interface Reaction {
  id: string
  playerId: string
  nickname: string
  emoji: string
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
  hasSubmittedDrawing: boolean
  waitingMessage: string
  spyDrawings: SpyDrawing[]
  chatMessages: ChatMessage[]
  reactions: Reaction[]
  sendChatMessage: (message: string) => void
  sendReaction: (emoji: string) => void
  createRoom: (nickname: string, avatar: string) => void
  joinRoom: (code: string, nickname: string, avatar: string) => void
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
  const [hasSubmittedDrawing, setHasSubmittedDrawing] = useState<boolean>(false)
  const [waitingMessage, setWaitingMessage] = useState<string>('')
  const [spyDrawings, setSpyDrawings] = useState<SpyDrawing[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const nicknameRef = useRef<string>('')
  const avatarRef = useRef<string>('')
  const roomCodeRef = useRef<string>('')

  useEffect(() => {
    if (!socket.connected) {
      socket.connect()
    }

    socket.on('connect', () => {
      setError(null)
      const code = roomCodeRef.current
      const nickname = nicknameRef.current
      if (code && nickname) {
        socket.emit('rejoin-room', { code, nickname, avatar: avatarRef.current })
      }
    })

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        setError('Disconnected by server')
      } else {
        setError('Connection lost — reconnecting...')
      }
    })

    socket.on('connect_error', (err: Error & { description?: unknown }) => {
      const detail = typeof err.message === 'string' && err.message ? err.message : 'Unknown connection error'
      setError(`Can't connect to the game server (${detail}). Try mobile data or a different network.`)
      setTimeout(() => setError(null), 5000)
    })

    socket.on('room-created', ({ code }: { code: string }) => {
      roomCodeRef.current = code
      setRoom(prev => prev ? { ...prev, code } : { players: [], phase: 'lobby', code })
    })

    socket.on('room-update', (data: RoomState) => {
      roomCodeRef.current = data.code
      setRoom(data)
    })

    socket.on('game-phase', ({ phase, timerEnd: te, currentRound: cr, totalRounds: tr, promptAuthorId }: { phase: string; timerEnd?: number; currentRound?: number; totalRounds?: number; promptAuthorId?: string }) => {
      setRoom(prev => prev ? { ...prev, phase } : null)
      setTimerEnd(te ? toLocalTime(te) : null)
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
          setHasSubmittedDrawing(false)
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
          // Navigation happens in 'results' event handler when data arrives
          break
      }
    })

    // Complete state restore for drawing phase rejoin
    socket.on('drawing-state', (data: {
      phase: string
      role: 'drawer' | 'prompt-author'
      prompt: string
      hasSubmitted: boolean
      timerEnd: number
      currentRound: number
      totalRounds: number
      promptAuthorId: string
      spyDrawings: { playerId: string; playerNickname: string; imageData: string; submitted: boolean }[]
    }) => {
      setRoom(prev => prev ? { ...prev, phase: data.phase } : null)
      setTimerEnd(data.timerEnd ? toLocalTime(data.timerEnd) : null)
      setDrawingRound(data.currentRound)
      setTotalRounds(data.totalRounds)
      setRoundResults(null)
      setHasSubmittedDrawing(data.hasSubmitted)

      if (data.role === 'prompt-author') {
        setIsPromptAuthor(true)
        setWaitingMessage(`Others are drawing your prompt: "${data.prompt}"`)
        setSpyDrawings(data.spyDrawings.map(s => ({
          ...s,
          count: 0,
          total: 0,
        })) as any)
        navigate('/waiting')
      } else {
        setIsPromptAuthor(false)
        setAssignedPrompt(data.prompt)
        navigate('/draw')
      }
    })

    socket.on('waiting-round', ({ message }: { message: string }) => {
      setWaitingMessage(message)
      setSpyDrawings([])
    })

    socket.on('spy-drawing', (data: SpyDrawing & { playerId?: string }) => {
      setSpyDrawings(prev => {
        // Replace existing snapshot entry for this player with submitted version
        if (data.playerId) {
          const existing = prev.findIndex(s => (s as any).playerId === data.playerId)
          const entry = { ...data, submitted: true } as any
          if (existing >= 0) {
            const updated = [...prev]
            updated[existing] = entry
            return updated
          }
          return [...prev, entry]
        }
        return [...prev, { ...data, submitted: true } as any]
      })
    })

    socket.on('spy-snapshot', ({ playerId, playerNickname, imageData }: { playerId: string; playerNickname: string; imageData: string }) => {
      setSpyDrawings(prev => {
        const existing = prev.findIndex(s => (s as any).playerId === playerId && !(s as any).submitted)
        const entry = { playerId, playerNickname, imageData, count: 0, total: 0, submitted: false } as any
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = entry
          return updated
        }
        return [...prev, entry]
      })
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
      navigate('/results')
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

    socket.on('room-expired', () => {
      setRoom(null)
      navigate('/')
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('connect_error')
      socket.off('room-created')
      socket.off('room-update')
      socket.off('game-phase')
      socket.off('drawing-state')
      socket.off('assign-prompt')
      socket.off('waiting-round')
      socket.off('spy-drawing')
      socket.off('spy-snapshot')
      socket.off('drawings')
      socket.off('round-results')
      socket.off('results')
      socket.off('error')
      socket.off('chat-message')
      socket.off('reaction')
      socket.off('room-expired')
    }
  }, [navigate])

  const createRoom = useCallback((nickname: string, avatar: string) => {
    nicknameRef.current = nickname
    avatarRef.current = avatar
    socket.emit('create-room', { nickname, avatar })
  }, [])

  const joinRoom = useCallback((code: string, nickname: string, avatar: string) => {
    nicknameRef.current = nickname
    avatarRef.current = avatar
    socket.emit('join-room', { code, nickname, avatar })
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

  const sendReaction = useCallback((emoji: string) => {
    socket.emit('reaction', { emoji })
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
      hasSubmittedDrawing,
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
