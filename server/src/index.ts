import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import {
  createRoom,
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
  maxHttpBufferSize: 5e6, // 5MB for drawing data
})

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

const DRAW_TIME = 60 // seconds
const PROMPT_TIME = 30 // seconds
const VOTE_TIME = 30 // seconds
const RESULTS_PAUSE = 8 // seconds between rounds

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`)

  // Time sync: client calculates clock offset to align timers
  socket.on('time-sync', (_data: any, callback: (res: { serverTime: number }) => void) => {
    if (typeof callback === 'function') {
      callback({ serverTime: Date.now() })
    }
  })

  socket.on('create-room', ({ nickname }: { nickname: string }) => {
    const room = createRoom(socket.id, nickname)
    socket.join(room.code)
    socket.emit('room-created', { code: room.code })
    socket.emit('room-update', {
      players: getSerializablePlayers(room),
      phase: room.phase,
      code: room.code,
    })
  })

  socket.on('join-room', ({ code, nickname }: { code: string; nickname: string }) => {
    const room = joinRoom(code, socket.id, nickname)
    if (!room) {
      socket.emit('error', { message: 'Room not found, full, or game already started' })
      return
    }
    socket.join(room.code)
    io.to(room.code).emit('room-update', {
      players: getSerializablePlayers(room),
      phase: room.phase,
      code: room.code,
    })
  })

  socket.on('rejoin-room', ({ code, nickname }: { code: string; nickname: string }) => {
    const room = getRoom(code)
    if (!room) {
      socket.emit('error', { message: 'Room expired. Please create a new room.' })
      socket.emit('room-expired')
      return
    }

    const reconnectedRoom = reconnectPlayer(code, nickname, socket.id)
    if (reconnectedRoom) {
      socket.join(reconnectedRoom.code)
      io.to(reconnectedRoom.code).emit('room-update', {
        players: getSerializablePlayers(reconnectedRoom),
        phase: reconnectedRoom.phase,
        code: reconnectedRoom.code,
      })

      if (reconnectedRoom.phase === 'drawing') {
        const amAuthor = reconnectedRoom.currentPromptAuthorId === socket.id
        if (amAuthor) {
          socket.emit('waiting-round', { message: 'Others are drawing your prompt' })
        } else {
          const { prompt } = getCurrentPrompt(reconnectedRoom)
          socket.emit('assign-prompt', { prompt })
        }
        socket.emit('game-phase', {
          phase: 'drawing',
          timerEnd: reconnectedRoom.timerEnd,
          currentRound: reconnectedRoom.currentRound + 1,
          totalRounds: reconnectedRoom.totalRounds,
          promptAuthorId: reconnectedRoom.currentPromptAuthorId,
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
      }
      return
    }

    if (!room.players.has(socket.id)) {
      const result = joinRoom(code, socket.id, nickname)
      if (!result) {
        socket.emit('error', { message: 'Game already in progress' })
        return
      }
    }
    socket.join(room.code)
    io.to(room.code).emit('room-update', {
      players: getSerializablePlayers(room),
      phase: room.phase,
      code: room.code,
    })
  })

  socket.on('start-game', () => {
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

  socket.on('chat-message', ({ message }: { message: string }) => {
    const room = getRoomByPlayerId(socket.id)
    if (!room) return
    const player = room.players.get(socket.id)
    if (!player) return
    const text = message.trim().slice(0, 200)
    if (!text) return
    io.to(room.code).emit('chat-message', {
      id: `${socket.id}-${Date.now()}`,
      playerId: socket.id,
      nickname: player.nickname,
      color: player.color,
      message: text,
      timestamp: Date.now(),
    })
  })

  socket.on('reaction', ({ emoji }: { emoji: string }) => {
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

  socket.on('submit-prompt', ({ prompt }: { prompt: string }) => {
    const room = getRoomByPlayerId(socket.id)
    if (!room || room.phase !== 'prompts') return
    room.prompts.set(socket.id, prompt.trim())

    if (room.prompts.size === room.players.size) {
      if (room.roundTimer) clearTimeout(room.roundTimer)
      startDrawingRound(room)
    }
  })

  socket.on('snapshot', ({ imageData }: { imageData: string }) => {
    const room = getRoomByPlayerId(socket.id)
    if (!room || room.phase !== 'drawing') return
    if (socket.id === room.currentPromptAuthorId) return
    const player = room.players.get(socket.id)

    // Store last snapshot for auto-submit on timeout
    const lastSnapshots: Map<string, string> = (room as any)._lastSnapshots || new Map()
    lastSnapshots.set(socket.id, imageData)
    ;(room as any)._lastSnapshots = lastSnapshots

    // Forward snapshot to prompt author (spy mode)
    io.to(room.currentPromptAuthorId).emit('spy-snapshot', {
      playerId: socket.id,
      playerNickname: player?.nickname || 'Anonymous',
      imageData,
    })
  })

  socket.on('submit-drawing', ({ imageData }: { imageData: string }) => {
    const room = getRoomByPlayerId(socket.id)
    if (!room || room.phase !== 'drawing') return

    // Don't allow double submission
    if (room.currentRoundDrawings.some(d => d.playerId === socket.id)) return

    // Only drawers can submit (not the prompt author)
    if (socket.id === room.currentPromptAuthorId) return

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

    if (room.currentRoundDrawings.length === drawers.length) {
      if (room.roundTimer) clearTimeout(room.roundTimer)
      advanceToVoting(room)
    }
  })

  socket.on('submit-vote', ({ drawingIndex }: { drawingIndex: number }) => {
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

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`)
    const room = getRoomByPlayerId(socket.id)
    if (!room) return

    if (room.phase === 'lobby') {
      const updatedRoom = removePlayer(socket.id)
      if (updatedRoom) {
        io.to(updatedRoom.code).emit('room-update', {
          players: getSerializablePlayers(updatedRoom),
          phase: updatedRoom.phase,
          code: updatedRoom.code,
        })
      }
      return
    }

    const disconnectedRoom = markDisconnected(socket.id, () => {
      const updatedRoom = removePlayer(socket.id)
      if (updatedRoom) {
        io.to(updatedRoom.code).emit('room-update', {
          players: getSerializablePlayers(updatedRoom),
          phase: updatedRoom.phase,
          code: updatedRoom.code,
        })
      }
    })

    if (disconnectedRoom) {
      io.to(disconnectedRoom.code).emit('room-update', {
        players: getSerializablePlayers(disconnectedRoom),
        phase: disconnectedRoom.phase,
        code: disconnectedRoom.code,
      })
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
  room.timerEnd = Date.now() + DRAW_TIME * 1000

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
    // Auto-submit any missing drawings using last snapshots
    const submittedIds = new Set(room.currentRoundDrawings.map(d => d.playerId))
    const lastSnapshots: Map<string, string> = (room as any)._lastSnapshots || new Map()
    const { prompt: roundPrompt } = getCurrentPrompt(room)

    for (const playerId of drawers) {
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
  }, DRAW_TIME * 1000)

  // Request periodic snapshots for spy mode (every 5 seconds)
  const snapshotInterval = setInterval(() => {
    if (room.phase !== 'drawing') {
      clearInterval(snapshotInterval)
      return
    }
    for (const playerId of drawers) {
      io.to(playerId).emit('request-snapshot')
    }
  }, 5000)

  // Store interval to clear later
  ;(room as any)._snapshotInterval = snapshotInterval
}

function advanceToVoting(room: ReturnType<typeof getRoom>) {
  if (!room) return
  
  // Clear snapshot interval
  if ((room as any)._snapshotInterval) {
    clearInterval((room as any)._snapshotInterval)
    ;(room as any)._snapshotInterval = null
  }

  // If no drawings submitted, skip voting and go to next round
  if (room.currentRoundDrawings.length === 0) {
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
      .map(p => ({ nickname: p.nickname, score: p.score, isHost: p.isHost, color: p.color })),
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
      .map(p => ({ nickname: p.nickname, score: p.score, isHost: p.isHost, color: p.color })),
  })
}

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Drawly server running on port ${PORT}`)
})
