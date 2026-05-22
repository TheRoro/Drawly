import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import {
  createRoom,
  canCreateRoom,
  joinRoom,
  getRoom,
  getRoomByPlayerId,
  removePlayer,
  markDisconnected,
  reconnectPlayer,
  getCurrentPrompt,
  getDrawersForRound,
  calculateRoundResults,
  hasMoreRounds,
  resetForNewGame,
  getSerializablePlayers,
} from './rooms.js'
import {
  FixedWindowRateLimiter,
  MAX_DRAWING_BYTES,
  MAX_ROOM_DRAWING_BYTES,
  MAX_SNAPSHOT_BYTES,
  asRecord,
  getImageBytes,
  parseAvatar,
  parseChatMessage,
  parseDrawingIndex,
  parseDrawTime,
  parseNickname,
  parsePngDataUrl,
  parsePrompt,
  parseReaction,
  parseReconnectToken,
  parseRoomCode,
  parseSocketId,
  type RateLimit,
} from './security.js'

const app = express()
const allowedOrigins = [
  'https://drawly.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.CLIENT_URL,
].filter((origin): origin is string => Boolean(origin))

const corsOptions = {
  origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }

    callback(new Error(`CORS blocked origin: ${origin}`))
  },
  methods: ['GET', 'POST'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}

app.use(cors(corsOptions))
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1_500_000,
})

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

const PROMPT_TIME = 30 // seconds
const VOTE_TIME = 30 // seconds
const RESULTS_PAUSE = 8 // seconds between rounds
const MAX_CONNECTIONS_PER_ADDRESS = 25
const activeConnectionsByAddress = new Map<string, number>()
const eventRateLimiter = new FixedWindowRateLimiter()
const DEFAULT_SOCKET_RATE: RateLimit = { limit: 120, windowMs: 10_000 }
const DEFAULT_ADDRESS_RATE: RateLimit = { limit: 600, windowMs: 10_000 }
const EVENT_RATE_LIMITS: Record<string, { socket: RateLimit; address: RateLimit }> = {
  'create-room': {
    socket: { limit: 5, windowMs: 60_000 },
    address: { limit: 20, windowMs: 60_000 },
  },
  'join-room': {
    socket: { limit: 10, windowMs: 60_000 },
    address: { limit: 60, windowMs: 60_000 },
  },
  'rejoin-room': {
    socket: { limit: 10, windowMs: 60_000 },
    address: { limit: 60, windowMs: 60_000 },
  },
  'chat-message': {
    socket: { limit: 10, windowMs: 10_000 },
    address: { limit: 100, windowMs: 10_000 },
  },
  reaction: {
    socket: { limit: 8, windowMs: 10_000 },
    address: { limit: 80, windowMs: 10_000 },
  },
  snapshot: {
    socket: { limit: 8, windowMs: 10_000 },
    address: { limit: 80, windowMs: 10_000 },
  },
  'submit-drawing': {
    socket: { limit: 3, windowMs: 60_000 },
    address: { limit: 30, windowMs: 60_000 },
  },
}
const INBOUND_EVENTS = new Set([
  'time-sync',
  'create-room',
  'join-room',
  'rejoin-room',
  'start-game',
  'chat-message',
  'reaction',
  'submit-prompt',
  'snapshot',
  'submit-drawing',
  'submit-vote',
  'play-again',
  'kick-player',
])

function getClientAddress(headers: Record<string, string | string[] | undefined>, fallback: string): string {
  if (process.env.TRUST_PROXY !== 'true') return fallback
  const forwarded = headers['x-forwarded-for']
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded
  const address = forwardedValue?.split(',')[0]?.trim() || fallback
  return address.slice(0, 64)
}

function getRoomDrawingBytes(room: NonNullable<ReturnType<typeof getRoom>>): number {
  const drawingBytes = room.drawings.reduce((total, drawing) => total + getImageBytes(drawing.imageData), 0)
  const snapshots: Map<string, string> | undefined = (room as any)._lastSnapshots
  const snapshotBytes = snapshots
    ? [...snapshots.values()].reduce((total, imageData) => total + getImageBytes(imageData), 0)
    : 0
  return drawingBytes + snapshotBytes
}

io.use((socket, next) => {
  const address = getClientAddress(socket.handshake.headers, socket.handshake.address || 'unknown')
  if ((activeConnectionsByAddress.get(address) || 0) >= MAX_CONNECTIONS_PER_ADDRESS) {
    next(new Error('Too many active connections from this network'))
    return
  }
  socket.data.address = address
  next()
})

io.on('connection', (socket) => {
  const address = typeof socket.data.address === 'string' ? socket.data.address : 'unknown'
  activeConnectionsByAddress.set(address, (activeConnectionsByAddress.get(address) || 0) + 1)
  console.log(`Player connected: ${socket.id}`)

  socket.use(([event], next) => {
    if (!INBOUND_EVENTS.has(event)) {
      const socketAllowed = eventRateLimiter.consume(
        `socket:${socket.id}:unknown`,
        { limit: 10, windowMs: 10_000 },
      )
      const addressAllowed = eventRateLimiter.consume(
        `address:${address}:unknown`,
        { limit: 50, windowMs: 10_000 },
      )
      if (socketAllowed && addressAllowed) {
        socket.emit('error', { message: 'Unknown request' })
      }
      return
    }

    const limits = EVENT_RATE_LIMITS[event] || {
      socket: DEFAULT_SOCKET_RATE,
      address: DEFAULT_ADDRESS_RATE,
    }
    const socketAllowed = eventRateLimiter.consume(`socket:${socket.id}:${event}`, limits.socket)
    const addressAllowed = eventRateLimiter.consume(`address:${address}:${event}`, limits.address)
    if (!socketAllowed || !addressAllowed) {
      socket.emit('error', { message: 'Too many requests. Please slow down.' })
      return
    }
    next()
  })

  const rejectPayload = (message = 'Invalid request') => {
    socket.emit('error', { message })
  }

  // Time sync: client calculates clock offset to align timers
  socket.on('time-sync', (_data: unknown, callback: (res: { serverTime: number }) => void) => {
    if (typeof callback === 'function') {
      callback({ serverTime: Date.now() })
    }
  })

  socket.on('create-room', (payload: unknown) => {
    const data = asRecord(payload)
    const nickname = parseNickname(data?.nickname)
    const avatar = parseAvatar(data?.avatar)
    if (!nickname || avatar === null) {
      rejectPayload('Nickname or avatar is invalid')
      return
    }
    if (!canCreateRoom(address)) {
      rejectPayload('Room capacity reached. Please try again later.')
      return
    }

    const { room, reconnectToken } = createRoom(socket.id, nickname, address, avatar)
    socket.join(room.code)
    socket.emit('room-created', { code: room.code })
    socket.emit('session-token', { reconnectToken })
    socket.emit('room-update', {
      players: getSerializablePlayers(room),
      phase: room.phase,
      code: room.code,
    })
  })

  socket.on('join-room', (payload: unknown) => {
    const data = asRecord(payload)
    const code = parseRoomCode(data?.code)
    const nickname = parseNickname(data?.nickname)
    const avatar = parseAvatar(data?.avatar)
    if (!code || !nickname || avatar === null) {
      rejectPayload('Room code, nickname, or avatar is invalid')
      return
    }

    const result = joinRoom(code, socket.id, nickname, avatar)
    if (!result) {
      socket.emit('error', { message: 'Room not found, full, nickname taken, or game already started' })
      return
    }
    const { room, reconnectToken } = result
    socket.join(room.code)
    socket.emit('session-token', { reconnectToken })
    io.to(room.code).emit('room-update', {
      players: getSerializablePlayers(room),
      phase: room.phase,
      code: room.code,
    })
  })

  socket.on('rejoin-room', (payload: unknown) => {
    const data = asRecord(payload)
    const code = parseRoomCode(data?.code)
    const reconnectToken = parseReconnectToken(data?.reconnectToken)
    if (!code || !reconnectToken) {
      rejectPayload('Session is invalid. Please join the room again.')
      return
    }

    const room = getRoom(code)
    if (!room) {
      socket.emit('error', { message: 'Room expired. Please create a new room.' })
      socket.emit('room-expired')
      return
    }

    const reconnectResult = reconnectPlayer(code, reconnectToken, socket.id)
    if (reconnectResult) {
      const { room: reconnectedRoom, reconnectToken: rotatedReconnectToken } = reconnectResult
      socket.join(reconnectedRoom.code)
      socket.emit('session-token', { reconnectToken: rotatedReconnectToken })
      io.to(reconnectedRoom.code).emit('room-update', {
        players: getSerializablePlayers(reconnectedRoom),
        phase: reconnectedRoom.phase,
        code: reconnectedRoom.code,
      })

      if (reconnectedRoom.phase === 'drawing') {
        const amAuthor = reconnectedRoom.currentPromptAuthorId === socket.id
        const { prompt } = getCurrentPrompt(reconnectedRoom)
        const hasSubmitted = reconnectedRoom.currentRoundDrawings.some(d => d.playerId === socket.id)

        // Build spy drawings for prompt author
        let spyData: { playerId: string; playerNickname: string; imageData: string; submitted: boolean }[] = []
        if (amAuthor) {
          const lastSnapshots: Map<string, string> = (reconnectedRoom as any)._lastSnapshots || new Map()
          const submittedIds = new Set(reconnectedRoom.currentRoundDrawings.map(d => d.playerId))
          const drawers = getDrawersForRound(reconnectedRoom)
          for (const playerId of drawers) {
            const player = reconnectedRoom.players.get(playerId)
            const nickname = player?.nickname || 'Anonymous'
            if (submittedIds.has(playerId)) {
              const drawing = reconnectedRoom.currentRoundDrawings.find(d => d.playerId === playerId)
              if (drawing) {
                spyData.push({ playerId, playerNickname: nickname, imageData: drawing.imageData, submitted: true })
              }
            } else if (lastSnapshots.has(playerId)) {
              spyData.push({ playerId, playerNickname: nickname, imageData: lastSnapshots.get(playerId)!, submitted: false })
            }
          }
        }

        // Send one complete state snapshot for drawing phase rejoin
        socket.emit('drawing-state', {
          phase: 'drawing',
          role: amAuthor ? 'prompt-author' : 'drawer',
          prompt,
          hasSubmitted,
          timerEnd: reconnectedRoom.timerEnd,
          currentRound: reconnectedRoom.currentRound + 1,
          totalRounds: reconnectedRoom.totalRounds,
          promptAuthorId: reconnectedRoom.currentPromptAuthorId,
          spyDrawings: spyData,
        })
      } else if (reconnectedRoom.phase === 'voting') {
        const { prompt } = getCurrentPrompt(reconnectedRoom)
        socket.emit('game-phase', {
          phase: 'voting',
          currentRound: reconnectedRoom.currentRound + 1,
          totalRounds: reconnectedRoom.totalRounds,
          timerEnd: reconnectedRoom.timerEnd,
        })
        socket.emit('drawings', {
          prompt,
          drawings: reconnectedRoom.currentRoundDrawings.map((d, i) => ({
            index: i,
            prompt: d.prompt,
            imageData: d.imageData,
            playerId: d.playerId,
          })),
        })
      } else if (reconnectedRoom.phase === 'prompts') {
        socket.emit('game-phase', {
          phase: 'prompts',
          timerEnd: reconnectedRoom.timerEnd,
        })
      } else if (reconnectedRoom.phase === 'results') {
        socket.emit('game-phase', { phase: 'results' })
        socket.emit('results', {
          drawings: reconnectedRoom.drawings
            .sort((a, b) => b.votes.length - a.votes.length)
            .slice(0, 6)
            .map(d => ({
              playerNickname: d.playerNickname,
              prompt: d.prompt,
              imageData: d.imageData,
              votes: d.votes.length,
            })),
          leaderboard: getSerializablePlayers(reconnectedRoom)
            .sort((a, b) => b.score - a.score)
            .map(p => ({ nickname: p.nickname, avatar: p.avatar, score: p.score, isHost: p.isHost, color: p.color })),
        })
      } else if (reconnectedRoom.phase === 'round-results') {
        const results = reconnectedRoom.currentRoundDrawings
          .sort((a, b) => b.votes.length - a.votes.length)
        socket.emit('round-results', {
          currentRound: reconnectedRoom.currentRound + 1,
          totalRounds: reconnectedRoom.totalRounds,
          drawings: results.map(d => ({
            playerNickname: d.playerNickname,
            prompt: d.prompt,
            imageData: d.imageData,
            votes: d.votes.length,
          })),
          leaderboard: getSerializablePlayers(reconnectedRoom)
            .sort((a, b) => b.score - a.score)
            .map(p => ({ nickname: p.nickname, avatar: p.avatar, score: p.score, isHost: p.isHost, color: p.color })),
        })
      }
      return
    }

    socket.emit('error', { message: 'Session expired. Please join the room again.' })
    socket.emit('room-expired')
  })

  socket.on('start-game', (payload: unknown) => {
    const data = asRecord(payload)
    const drawTime = parseDrawTime(data?.drawTime)
    if (drawTime === null) {
      rejectPayload('Drawing time must be a whole number from 15 to 180 seconds')
      return
    }

    const room = getRoomByPlayerId(socket.id)
    if (!room) {
      socket.emit('error', { message: 'Room not found. Try refreshing.' })
      return
    }
    const player = room.players.get(socket.id)
    if (!player?.isHost) {
      socket.emit('error', { message: 'Only the host can start the game' })
      return
    }
    if (room.players.size < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start' })
      return
    }

    // Set custom draw time (clamp to valid range)
    room.drawTime = drawTime

    // Set up: one round per player's prompt
    room.playerOrder = [...room.players.keys()]
    room.totalRounds = room.players.size
    room.currentRound = 0

    room.phase = 'prompts'
    io.to(room.code).emit('game-phase', {
      phase: 'prompts',
      timerEnd: Date.now() + PROMPT_TIME * 1000,
    })

    room.timerEnd = Date.now() + PROMPT_TIME * 1000
    room.roundTimer = setTimeout(() => {
      startDrawingRound(room)
    }, PROMPT_TIME * 1000)
  })

  socket.on('chat-message', (payload: unknown) => {
    const data = asRecord(payload)
    const text = parseChatMessage(data?.message)
    if (!text) {
      rejectPayload('Chat message is invalid')
      return
    }
    const room = getRoomByPlayerId(socket.id)
    if (!room) return
    const player = room.players.get(socket.id)
    if (!player) return
    io.to(room.code).emit('chat-message', {
      id: `${socket.id}-${Date.now()}`,
      playerId: socket.id,
      nickname: player.nickname,
      avatar: player.avatar,
      color: player.color,
      message: text,
      timestamp: Date.now(),
    })
  })

  socket.on('reaction', (payload: unknown) => {
    const data = asRecord(payload)
    const emoji = parseReaction(data?.emoji)
    if (!emoji) {
      rejectPayload('Reaction is invalid')
      return
    }
    const room = getRoomByPlayerId(socket.id)
    if (!room) return
    const player = room.players.get(socket.id)
    if (!player) return
    // Broadcast to everyone in room
    io.to(room.code).emit('reaction', {
      id: `${socket.id}-${Date.now()}`,
      playerId: socket.id,
      nickname: player.nickname,
      emoji,
    })
  })

  socket.on('submit-prompt', (payload: unknown) => {
    const data = asRecord(payload)
    const prompt = parsePrompt(data?.prompt)
    if (!prompt) {
      rejectPayload('Prompt must be between 1 and 120 characters')
      return
    }
    const room = getRoomByPlayerId(socket.id)
    if (!room || room.phase !== 'prompts') return
    room.prompts.set(socket.id, prompt)

    if (room.prompts.size === room.players.size) {
      if (room.roundTimer) clearTimeout(room.roundTimer)
      startDrawingRound(room)
    }
  })

  socket.on('snapshot', (payload: unknown) => {
    const data = asRecord(payload)
    const imageData = parsePngDataUrl(data?.imageData, MAX_SNAPSHOT_BYTES)
    if (!imageData) {
      rejectPayload('Drawing snapshot is invalid or too large')
      return
    }
    const room = getRoomByPlayerId(socket.id)
    if (!room || room.phase !== 'drawing') return
    if (socket.id === room.currentPromptAuthorId) return
    const player = room.players.get(socket.id)

    // Store last snapshot for auto-submit on timeout
    const lastSnapshots: Map<string, string> = (room as any)._lastSnapshots || new Map()
    const previousSnapshot = lastSnapshots.get(socket.id)
    const projectedBytes =
      getRoomDrawingBytes(room) -
      (previousSnapshot ? getImageBytes(previousSnapshot) : 0) +
      getImageBytes(imageData)
    if (projectedBytes > MAX_ROOM_DRAWING_BYTES) {
      rejectPayload('Room drawing storage limit reached')
      return
    }
    lastSnapshots.set(socket.id, imageData)
    ;(room as any)._lastSnapshots = lastSnapshots

    // Forward snapshot to prompt author (spy mode)
    io.to(room.currentPromptAuthorId).emit('spy-snapshot', {
      playerId: socket.id,
      playerNickname: player?.nickname || 'Anonymous',
      imageData,
    })
  })

  socket.on('submit-drawing', (payload: unknown) => {
    const data = asRecord(payload)
    const imageData = parsePngDataUrl(data?.imageData, MAX_DRAWING_BYTES)
    if (!imageData) {
      rejectPayload('Drawing is invalid or too large')
      return
    }
    const room = getRoomByPlayerId(socket.id)
    if (!room || room.phase !== 'drawing') {
      console.log(`[submit-drawing] Rejected: no room or phase=${room?.phase} for ${socket.id}`)
      return
    }

    // Don't allow double submission
    if (room.currentRoundDrawings.some(d => d.playerId === socket.id)) return

    // Only drawers can submit (not the prompt author)
    if (socket.id === room.currentPromptAuthorId) return
    if (getRoomDrawingBytes(room) + getImageBytes(imageData) > MAX_ROOM_DRAWING_BYTES) {
      rejectPayload('Room drawing storage limit reached')
      return
    }

    const { prompt } = getCurrentPrompt(room)
    const player = room.players.get(socket.id)

    const drawing: import('./types.js').Drawing = {
      playerId: socket.id,
      playerNickname: player?.nickname || 'Anonymous',
      prompt,
      promptAuthorId: room.currentPromptAuthorId,
      imageData,
      votes: [],
      round: room.currentRound,
    }

    room.currentRoundDrawings.push(drawing)
    room.drawings.push(drawing)

    // If all drawers submitted, advance early
    const drawers = getDrawersForRound(room)

    console.log(`[${room.code}] Drawing submitted by ${player?.nickname || socket.id} (${room.currentRoundDrawings.length}/${drawers.length} drawers)`)

    // Notify prompt author that a drawing was submitted (spy mode)
    if (room.currentPromptAuthorId) {
      io.to(room.currentPromptAuthorId).emit('spy-drawing', {
        playerId: socket.id,
        imageData: drawing.imageData,
        playerNickname: drawing.playerNickname,
        count: room.currentRoundDrawings.length,
        total: drawers.length,
      })
    }

    if (room.currentRoundDrawings.length >= drawers.length) {
      console.log(`[${room.code}] All drawers submitted, advancing to voting`)
      if (room.roundTimer) clearTimeout(room.roundTimer)
      advanceToVoting(room)
    }
  })

  socket.on('submit-vote', (payload: unknown) => {
    const data = asRecord(payload)
    const drawingIndex = parseDrawingIndex(data?.drawingIndex)
    if (drawingIndex === null) {
      rejectPayload('Vote is invalid')
      return
    }
    const room = getRoomByPlayerId(socket.id)
    if (!room || room.phase !== 'voting') return
    if (drawingIndex < 0 || drawingIndex >= room.currentRoundDrawings.length) return

    // Can't vote for own drawing
    if (room.currentRoundDrawings[drawingIndex].playerId === socket.id) return

    // Remove previous vote from this round (including bonus)
    room.currentRoundDrawings.forEach(d => {
      d.votes = d.votes.filter(v => v !== socket.id && v !== socket.id + '-bonus')
    })

    // Add new vote (prompt author's vote counts double)
    room.currentRoundDrawings[drawingIndex].votes.push(socket.id)
    if (socket.id === room.currentPromptAuthorId) {
      room.currentRoundDrawings[drawingIndex].votes.push(socket.id + '-bonus')
    }

    // Everyone votes (including prompt author)
    const totalVoters = [...room.players.values()].filter(player => player.connected).length
    const uniqueVoters = new Set(
      room.currentRoundDrawings.flatMap(d => d.votes.map(v => v.replace('-bonus', '')))
    )
    if (uniqueVoters.size >= totalVoters) {
      if (room.roundTimer) clearTimeout(room.roundTimer)
      advanceToRoundResults(room)
    }
  })

  socket.on('play-again', () => {
    const room = getRoomByPlayerId(socket.id)
    if (!room) return
    const player = room.players.get(socket.id)
    if (!player?.isHost) return

    resetForNewGame(room)
    room.playerOrder = [...room.players.keys()]
    room.totalRounds = room.players.size

    room.phase = 'prompts'
    io.to(room.code).emit('game-phase', {
      phase: 'prompts',
      timerEnd: Date.now() + PROMPT_TIME * 1000,
    })

    room.timerEnd = Date.now() + PROMPT_TIME * 1000
    room.roundTimer = setTimeout(() => {
      startDrawingRound(room)
    }, PROMPT_TIME * 1000)
  })

  socket.on('kick-player', (payload: unknown) => {
    const data = asRecord(payload)
    const targetId = parseSocketId(data?.targetId)
    if (!targetId) {
      rejectPayload('Player is invalid')
      return
    }
    const room = getRoomByPlayerId(socket.id)
    if (!room) return

    if (room.phase !== 'lobby') {
      socket.emit('error', { message: 'Players can only be removed from the lobby' })
      return
    }

    const requester = room.players.get(socket.id)
    if (!requester?.isHost) {
      socket.emit('error', { message: 'Only the host can remove players' })
      return
    }

    if (targetId === socket.id) return
    if (!room.players.has(targetId)) return

    // Notify the kicked player so their client clears state and returns home
    io.to(targetId).emit('kicked')
    const targetSocket = io.sockets.sockets.get(targetId)
    if (targetSocket) targetSocket.leave(room.code)

    const updatedRoom = removePlayer(targetId)
    if (updatedRoom) {
      io.to(updatedRoom.code).emit('room-update', {
        players: getSerializablePlayers(updatedRoom),
        phase: updatedRoom.phase,
        code: updatedRoom.code,
      })
    }
  })

  socket.on('disconnect', () => {
    const remainingConnections = Math.max(0, (activeConnectionsByAddress.get(address) || 1) - 1)
    if (remainingConnections === 0) activeConnectionsByAddress.delete(address)
    else activeConnectionsByAddress.set(address, remainingConnections)
    eventRateLimiter.clearPrefix(`socket:${socket.id}:`)

    console.log(`Player disconnected: ${socket.id}`)
    const room = getRoomByPlayerId(socket.id)
    if (!room) return

    const disconnectedRoom = markDisconnected(socket.id, () => {
      const updatedRoom = removePlayer(socket.id)
      if (updatedRoom) {
        io.to(updatedRoom.code).emit('room-update', {
          players: getSerializablePlayers(updatedRoom),
          phase: updatedRoom.phase,
          code: updatedRoom.code,
        })

        // If the disconnected player was a drawer and all remaining drawers have submitted, advance
        if (updatedRoom.phase === 'drawing') {
          const drawers = getDrawersForRound(updatedRoom)
          if (drawers.length > 0 && updatedRoom.currentRoundDrawings.length >= drawers.length) {
            console.log(`[${updatedRoom.code}] All remaining drawers submitted after player removal, advancing`)
            if (updatedRoom.roundTimer) clearTimeout(updatedRoom.roundTimer)
            advanceToVoting(updatedRoom)
          } else if (drawers.length === 0) {
            console.log(`[${updatedRoom.code}] No drawers remaining after player removal, advancing`)
            if (updatedRoom.roundTimer) clearTimeout(updatedRoom.roundTimer)
            advanceToVoting(updatedRoom)
          }
        }
      }
    })

    if (disconnectedRoom) {
      io.to(disconnectedRoom.code).emit('room-update', {
        players: getSerializablePlayers(disconnectedRoom),
        phase: disconnectedRoom.phase,
        code: disconnectedRoom.code,
      })

      // Check if disconnect means all remaining drawers have submitted (player marked disconnected reduces drawer count)
      if (disconnectedRoom.phase === 'drawing' && socket.id !== disconnectedRoom.currentPromptAuthorId) {
        const drawers = getDrawersForRound(disconnectedRoom)
        if (drawers.length > 0 && disconnectedRoom.currentRoundDrawings.length >= drawers.length) {
          console.log(`[${disconnectedRoom.code}] All connected drawers submitted after disconnect, advancing`)
          if (disconnectedRoom.roundTimer) clearTimeout(disconnectedRoom.roundTimer)
          advanceToVoting(disconnectedRoom)
        } else if (drawers.length === 0) {
          console.log(`[${disconnectedRoom.code}] No connected drawers remaining, advancing`)
          if (disconnectedRoom.roundTimer) clearTimeout(disconnectedRoom.roundTimer)
          advanceToVoting(disconnectedRoom)
        }
      }
    }
  })
})

function startDrawingRound(room: ReturnType<typeof getRoom>) {
  if (!room) return
  console.log(`[${room.code}] Starting drawing round ${room.currentRound + 1}/${room.totalRounds}, players: ${room.players.size}`)

  // Fill in default prompts for players who didn't submit
  for (const [id] of room.players) {
    if (!room.prompts.has(id)) {
      const defaults = ['A happy cat', 'A rocket ship', 'Pizza party', 'Dancing robot', 'Sunny beach']
      room.prompts.set(id, defaults[Math.floor(Math.random() * defaults.length)])
    }
  }

  // Set up this round
  room.currentRoundDrawings = []
  ;(room as any)._lastSnapshots = new Map<string, string>() // Store last snapshot per player
  const { prompt, authorId } = getCurrentPrompt(room)
  room.currentPromptAuthorId = authorId
  const authorNickname = room.players.get(authorId)?.nickname || 'Someone'

  room.phase = 'drawing'
  room.timerEnd = Date.now() + room.drawTime * 1000

  // Tell drawers to draw
  const drawers = getDrawersForRound(room)
  for (const playerId of drawers) {
    io.to(playerId).emit('assign-prompt', { prompt })
  }

  // Tell the author they're waiting
  io.to(authorId).emit('waiting-round', {
    message: `Others are drawing your prompt: "${prompt}"`,
  })

  io.to(room.code).emit('game-phase', {
    phase: 'drawing',
    timerEnd: room.timerEnd,
    currentRound: room.currentRound + 1,
    totalRounds: room.totalRounds,
    promptAuthorId: authorId,
    promptAuthorNickname: authorNickname,
  })

  room.roundTimer = setTimeout(() => {
    // Re-compute drawers at timer expiry (socket IDs may have changed due to reconnections)
    const currentDrawers = getDrawersForRound(room)
    const submittedIds = new Set(room.currentRoundDrawings.map(d => d.playerId))
    const lastSnapshots: Map<string, string> = (room as any)._lastSnapshots || new Map()
    const { prompt: roundPrompt } = getCurrentPrompt(room)

    for (const playerId of currentDrawers) {
      if (!submittedIds.has(playerId) && lastSnapshots.has(playerId)) {
        const player = room.players.get(playerId)
        const drawing: import('./types.js').Drawing = {
          playerId,
          playerNickname: player?.nickname || 'Anonymous',
          prompt: roundPrompt,
          promptAuthorId: room.currentPromptAuthorId,
          imageData: lastSnapshots.get(playerId)!,
          votes: [],
          round: room.currentRound,
        }
        room.currentRoundDrawings.push(drawing)
        room.drawings.push(drawing)
        console.log(`[${room.code}] Auto-submitted drawing for ${player?.nickname || playerId}`)
      }
    }

    advanceToVoting(room)
  }, room.drawTime * 1000)

  // Request periodic snapshots for spy mode (every 2 seconds)
  // Re-compute drawers each tick so reconnected players get snapshot requests
  const snapshotInterval = setInterval(() => {
    if (room.phase !== 'drawing') {
      clearInterval(snapshotInterval)
      return
    }
    const currentDrawers = getDrawersForRound(room)
    for (const playerId of currentDrawers) {
      io.to(playerId).emit('request-snapshot')
    }
  }, 2000)

  // Store interval to clear later
  ;(room as any)._snapshotInterval = snapshotInterval
}

function advanceToVoting(room: ReturnType<typeof getRoom>) {
  if (!room) return
  
  console.log(`[${room.code}] advanceToVoting: ${room.currentRoundDrawings.length} drawings`)

  // Clear snapshot interval
  if ((room as any)._snapshotInterval) {
    clearInterval((room as any)._snapshotInterval)
    ;(room as any)._snapshotInterval = null
  }

  // If no drawings submitted, skip voting and go to next round
  if (room.currentRoundDrawings.length === 0) {
    console.log(`[${room.code}] No drawings, skipping to next round`)
    room.phase = 'round-results'
    room.roundTimer = setTimeout(() => {
      if (hasMoreRounds(room)) {
        room.currentRound++
        startDrawingRound(room)
      } else {
        showFinalResults(room)
      }
    }, 3000)
    return
  }

  // If only 1 drawing, skip voting (auto-win)
  if (room.currentRoundDrawings.length === 1) {
    console.log(`[${room.code}] Only 1 drawing, auto-win → round results`)
    room.currentRoundDrawings[0].votes.push('auto-win')
    advanceToRoundResults(room)
    return
  }

  room.phase = 'voting'
  room.timerEnd = Date.now() + VOTE_TIME * 1000

  const { prompt } = getCurrentPrompt(room)

  io.to(room.code).emit('game-phase', {
    phase: 'voting',
    currentRound: room.currentRound + 1,
    totalRounds: room.totalRounds,
    timerEnd: room.timerEnd,
  })

  io.to(room.code).emit('drawings', {
    prompt,
    drawings: room.currentRoundDrawings.map((d, i) => ({
      index: i,
      prompt: d.prompt,
      imageData: d.imageData,
      playerId: d.playerId, // for self-vote prevention
      // playerNickname hidden until results
    })),
  })

  room.roundTimer = setTimeout(() => {
    advanceToRoundResults(room)
  }, VOTE_TIME * 1000)
}

function advanceToRoundResults(room: ReturnType<typeof getRoom>) {
  if (!room) return
  console.log(`[${room.code}] Round ${room.currentRound + 1} results — ${room.currentRoundDrawings.length} drawings`)

  room.phase = 'round-results'
  const results = calculateRoundResults(room)

  io.to(room.code).emit('round-results', {
    currentRound: room.currentRound + 1,
    totalRounds: room.totalRounds,
    drawings: results.map(d => ({
      playerNickname: d.playerNickname,
      prompt: d.prompt,
      imageData: d.imageData,
      votes: d.votes.length,
    })),
    leaderboard: getSerializablePlayers(room)
      .sort((a, b) => b.score - a.score)
      .map(p => ({ nickname: p.nickname, avatar: p.avatar, score: p.score, isHost: p.isHost, color: p.color })),
  })

  // After pause, go to next round or final results
  room.roundTimer = setTimeout(() => {
    if (hasMoreRounds(room)) {
      room.currentRound++
      startDrawingRound(room)
    } else {
      showFinalResults(room)
    }
  }, RESULTS_PAUSE * 1000)
}

function showFinalResults(room: ReturnType<typeof getRoom>) {
  if (!room) return
  room.phase = 'results'

  io.to(room.code).emit('game-phase', { phase: 'results' })
  io.to(room.code).emit('results', {
    drawings: room.drawings
      .sort((a, b) => b.votes.length - a.votes.length)
      .slice(0, 6)
      .map(d => ({
        playerNickname: d.playerNickname,
        prompt: d.prompt,
        imageData: d.imageData,
        votes: d.votes.length,
      })),
    leaderboard: getSerializablePlayers(room)
      .sort((a, b) => b.score - a.score)
      .map(p => ({ nickname: p.nickname, avatar: p.avatar, score: p.score, isHost: p.isHost, color: p.color })),
  })
}

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Drawly server running on port ${PORT}`)
})
