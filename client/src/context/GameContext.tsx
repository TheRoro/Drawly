import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type {
  ChatMessage,
  DrawingEntry,
  GamePhase,
  LeaderboardEntry,
  PlayerView as Player,
  Reaction,
  ReactionEmoji,
  ResultEntry,
  RoomState,
  ServerToClientEvents,
  SpyDrawing,
} from '@drawly/protocol'
import { socket, toLocalTime } from '../socket'

export type {
  ChatMessage,
  DrawingEntry,
  LeaderboardEntry,
  Player,
  Reaction,
  ResultEntry,
  RoomState,
  SpyDrawing,
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
  sendReaction: (emoji: ReactionEmoji) => void
  kickPlayer: (targetId: string) => void
  createRoom: (nickname: string, avatar: string) => void
  joinRoom: (code: string, nickname: string, avatar: string) => void
  startGame: (drawTime?: number) => void
  submitPrompt: (prompt: string) => void
  submitDrawing: (imageData: string) => void
  submitVote: (drawingIndex: number) => void
  playAgain: () => void
}

const GameContext = createContext<GameContextType | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
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
  const nicknameRef = useRef<string>(sessionStorage.getItem('drawly-nickname') || '')
  const avatarRef = useRef<string>(sessionStorage.getItem('drawly-avatar') || '')
  const roomCodeRef = useRef<string>(sessionStorage.getItem('drawly-room') || '')
  const reconnectTokenRef = useRef<string>(sessionStorage.getItem('drawly-reconnect-token') || '')
  const reconnectAttemptSocketIdRef = useRef<string | null>(null)

  useEffect(() => {
    interface ServerEventSubscriber {
      on<Event extends keyof ServerToClientEvents>(
        event: Event,
        listener: ServerToClientEvents[Event],
      ): void
      off<Event extends keyof ServerToClientEvents>(
        event: Event,
        listener: ServerToClientEvents[Event],
      ): void
    }
    const serverEvents = socket as unknown as ServerEventSubscriber
    const removeListeners: (() => void)[] = []
    const on = <Event extends keyof ServerToClientEvents>(
      event: Event,
      listener: ServerToClientEvents[Event],
    ) => {
      serverEvents.on(event, listener)
      removeListeners.push(() => serverEvents.off(event, listener))
    }

    if (!socket.connected) {
      socket.connect()
    }

    const handleConnect = () => {
      setError(null)
      const code = roomCodeRef.current
      const nickname = nicknameRef.current
      const reconnectToken = reconnectTokenRef.current
      console.log('[Drawly] Socket connected, rejoin check:', { code, nickname, socketId: socket.id })
      if (code && reconnectToken) {
        if (reconnectAttemptSocketIdRef.current === socket.id) return
        reconnectAttemptSocketIdRef.current = socket.id || null
        socket.emit('rejoin-room', {
          code,
          reconnectToken,
        })
      } else if (code || reconnectToken) {
        roomCodeRef.current = ''
        nicknameRef.current = ''
        avatarRef.current = ''
        reconnectTokenRef.current = ''
        sessionStorage.removeItem('drawly-room')
        sessionStorage.removeItem('drawly-nickname')
        sessionStorage.removeItem('drawly-avatar')
        sessionStorage.removeItem('drawly-reconnect-token')
        navigateRef.current('/')
      }
    }

    socket.on('connect', handleConnect)
    removeListeners.push(() => socket.off('connect', handleConnect))

    // If socket already connected (e.g. StrictMode remount), rejoin immediately
    if (socket.connected) {
      handleConnect()
    }

    const handleDisconnect = (reason: string) => {
      if (reason === 'io server disconnect') {
        setError('Disconnected by server')
      } else {
        setError('Connection lost — reconnecting...')
      }
    }
    socket.on('disconnect', handleDisconnect)
    removeListeners.push(() => socket.off('disconnect', handleDisconnect))

    const handleConnectError = (err: Error & { description?: unknown }) => {
      const detail = typeof err.message === 'string' && err.message ? err.message : 'Unknown connection error'
      setError(`Can't connect to the game server (${detail}). Try mobile data or a different network.`)
      setTimeout(() => setError(null), 5000)
    }
    socket.on('connect_error', handleConnectError)
    removeListeners.push(() => socket.off('connect_error', handleConnectError))

    on('room-created', ({ code }: { code: string }) => {
      roomCodeRef.current = code
      sessionStorage.setItem('drawly-room', code)
      setRoom(prev => prev ? { ...prev, code } : { players: [], phase: 'lobby', code })
    })

    on('session-token', ({ reconnectToken }: { reconnectToken: string }) => {
      reconnectTokenRef.current = reconnectToken
      sessionStorage.setItem('drawly-reconnect-token', reconnectToken)
    })

    on('room-update', (data: RoomState) => {
      roomCodeRef.current = data.code
      sessionStorage.setItem('drawly-room', data.code)
      setRoom(data)
    })

    on('game-phase', ({ phase, timerEnd: te, currentRound: cr, totalRounds: tr, promptAuthorId }: { phase: GamePhase; timerEnd?: number | null; currentRound?: number; totalRounds?: number; promptAuthorId?: string }) => {
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
          navigateRef.current('/prompt')
          break
        case 'drawing':
          setRoundResults(null)
          setHasSubmittedDrawing(false)
          if (amAuthor) {
            navigateRef.current('/waiting')
          } else {
            navigateRef.current('/draw')
          }
          break
        case 'voting':
          navigateRef.current('/gallery')
          break
        case 'results':
          // Navigation happens in 'results' event handler when data arrives
          break
      }
    })

    // Complete state restore for drawing phase rejoin
    on('drawing-state', (data: {
      phase: 'drawing'
      role: 'drawer' | 'prompt-author'
      prompt: string
      hasSubmitted: boolean
      timerEnd: number | null
      currentRound: number
      totalRounds: number
      promptAuthorId: string
      spyDrawings: { playerId: string; playerNickname: string; imageData: string; submitted: boolean }[]
    }) => {
      console.log('[Drawly] Received drawing-state:', data.role, data.prompt, data.hasSubmitted)
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
        navigateRef.current('/waiting')
      } else {
        setIsPromptAuthor(false)
        setAssignedPrompt(data.prompt)
        navigateRef.current('/draw')
      }
    })

    on('waiting-round', ({ message }: { message: string }) => {
      setWaitingMessage(message)
      setSpyDrawings([])
    })

    on('spy-drawing', (data: SpyDrawing & { playerId?: string }) => {
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

    on('spy-snapshot', ({ playerId, playerNickname, imageData }: { playerId: string; playerNickname: string; imageData: string }) => {
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

    on('assign-prompt', ({ prompt }: { prompt: string }) => {
      setAssignedPrompt(prompt)
    })

    on('drawings', ({ drawings: d }: { drawings: DrawingEntry[] }) => {
      setDrawings(d)
    })

    on('round-results', ({ drawings: d, leaderboard: l, currentRound: cr, totalRounds: tr }: { drawings: ResultEntry[]; leaderboard: LeaderboardEntry[]; currentRound: number; totalRounds: number }) => {
      setRoundResults({ drawings: d, leaderboard: l })
      setDrawingRound(cr)
      setTotalRounds(tr)
      navigateRef.current('/round-results')
    })

    on('results', ({ drawings: d, leaderboard: l }: { drawings: ResultEntry[]; leaderboard: LeaderboardEntry[] }) => {
      setResults(d)
      setLeaderboard(l)
      navigateRef.current('/results')
    })

    on('error', ({ message }: { message: string }) => {
      setError(message)
      setTimeout(() => setError(null), 3000)
    })

    on('chat-message', (msg: ChatMessage) => {
      setChatMessages(prev => [...prev.slice(-99), msg])
    })

    on('reaction', (reaction: Reaction) => {
      setReactions(prev => [...prev.slice(-49), reaction])
    })

    on('room-expired', () => {
      setRoom(null)
      roomCodeRef.current = ''
      nicknameRef.current = ''
      avatarRef.current = ''
      reconnectTokenRef.current = ''
      reconnectAttemptSocketIdRef.current = null
      sessionStorage.removeItem('drawly-room')
      sessionStorage.removeItem('drawly-nickname')
      sessionStorage.removeItem('drawly-avatar')
      sessionStorage.removeItem('drawly-reconnect-token')
      navigateRef.current('/')
    })

    on('kicked', () => {
      roomCodeRef.current = ''
      sessionStorage.removeItem('drawly-room')
      sessionStorage.removeItem('drawly-nickname')
      sessionStorage.removeItem('drawly-avatar')
      sessionStorage.removeItem('drawly-reconnect-token')
      reconnectTokenRef.current = ''
      setRoom(null)
      setError('You were removed from the room by the host.')
      setTimeout(() => setError(null), 4000)
      navigateRef.current('/')
    })

    return () => {
      removeListeners.forEach(removeListener => removeListener())
    }
  }, [])

  const createRoom = useCallback((nickname: string, avatar: string) => {
    nicknameRef.current = nickname
    avatarRef.current = avatar
    sessionStorage.setItem('drawly-nickname', nickname)
    sessionStorage.setItem('drawly-avatar', avatar)
    reconnectTokenRef.current = ''
    sessionStorage.removeItem('drawly-reconnect-token')
    socket.emit('create-room', { nickname, avatar })
  }, [])

  const joinRoom = useCallback((code: string, nickname: string, avatar: string) => {
    nicknameRef.current = nickname
    avatarRef.current = avatar
    sessionStorage.setItem('drawly-nickname', nickname)
    sessionStorage.setItem('drawly-avatar', avatar)
    reconnectTokenRef.current = ''
    sessionStorage.removeItem('drawly-reconnect-token')
    socket.emit('join-room', { code, nickname, avatar })
  }, [])

  const kickPlayer = useCallback((targetId: string) => {
    socket.emit('kick-player', { targetId })
  }, [])

  const startGame = useCallback((drawTime?: number) => {
    socket.emit('start-game', { drawTime: drawTime || 60 })
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

  const sendReaction = useCallback((emoji: ReactionEmoji) => {
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
      kickPlayer,
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
