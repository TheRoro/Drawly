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
  assignPrompts,
  calculateResults,
  resetForNewRound,
  getSerializablePlayers,
} from './rooms.js'

const app = express()
app.use(cors())
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 5e6, // 5MB for drawing data
})

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

const DRAW_TIME = 60 // seconds
const PROMPT_TIME = 30 // seconds

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`)

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

  socket.on('start-game', () => {
    const room = getRoomByPlayerId(socket.id)
    if (!room) return
    const player = room.players.get(socket.id)
    if (!player?.isHost) return
    if (room.players.size < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start' })
      return
    }

    room.phase = 'prompts'
    io.to(room.code).emit('game-phase', {
      phase: 'prompts',
      timerEnd: Date.now() + PROMPT_TIME * 1000,
    })

    // Auto-advance after prompt time
    room.timerEnd = Date.now() + PROMPT_TIME * 1000
    room.roundTimer = setTimeout(() => {
      advanceToDrawing(room)
    }, PROMPT_TIME * 1000)
  })

  socket.on('submit-prompt', ({ prompt }: { prompt: string }) => {
    const room = getRoomByPlayerId(socket.id)
    if (!room || room.phase !== 'prompts') return
    room.prompts.set(socket.id, prompt.trim())

    // If all players submitted, advance early
    if (room.prompts.size === room.players.size) {
      if (room.roundTimer) clearTimeout(room.roundTimer)
      advanceToDrawing(room)
    }
  })

  socket.on('submit-drawing', ({ imageData }: { imageData: string }) => {
    const room = getRoomByPlayerId(socket.id)
    if (!room || room.phase !== 'drawing') return

    const prompt = room.promptAssignments.get(socket.id) || 'Unknown'
    const player = room.players.get(socket.id)

    room.drawings.push({
      playerId: socket.id,
      playerNickname: player?.nickname || 'Anonymous',
      prompt,
      imageData,
      votes: [],
    })

    // If all submitted, advance early
    if (room.drawings.length === room.players.size) {
      if (room.roundTimer) clearTimeout(room.roundTimer)
      advanceToVoting(room)
    }
  })

  socket.on('submit-vote', ({ drawingIndex }: { drawingIndex: number }) => {
    const room = getRoomByPlayerId(socket.id)
    if (!room || room.phase !== 'voting') return
    if (drawingIndex < 0 || drawingIndex >= room.drawings.length) return

    // Can't vote for own drawing
    if (room.drawings[drawingIndex].playerId === socket.id) return

    // Remove previous vote
    room.drawings.forEach(d => {
      d.votes = d.votes.filter(v => v !== socket.id)
    })

    // Add new vote
    room.drawings[drawingIndex].votes.push(socket.id)

    // Check if all non-authors have voted
    const totalVoters = room.players.size
    const totalVotes = room.drawings.reduce((sum, d) => sum + d.votes.length, 0)
    if (totalVotes >= totalVoters - 1) {
      // -1 because at least one person is an author who might also vote
      advanceToResults(room)
    }
  })

  socket.on('play-again', () => {
    const room = getRoomByPlayerId(socket.id)
    if (!room) return
    const player = room.players.get(socket.id)
    if (!player?.isHost) return

    resetForNewRound(room)
    io.to(room.code).emit('game-phase', {
      phase: 'prompts',
      timerEnd: Date.now() + PROMPT_TIME * 1000,
    })

    room.timerEnd = Date.now() + PROMPT_TIME * 1000
    room.roundTimer = setTimeout(() => {
      advanceToDrawing(room)
    }, PROMPT_TIME * 1000)
  })

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`)
    const room = removePlayer(socket.id)
    if (room) {
      io.to(room.code).emit('room-update', {
        players: getSerializablePlayers(room),
        phase: room.phase,
        code: room.code,
      })
    }
  })
})

function advanceToDrawing(room: ReturnType<typeof getRoom>) {
  if (!room) return

  // If some players didn't submit prompts, generate defaults
  for (const [id] of room.players) {
    if (!room.prompts.has(id)) {
      const defaults = ['A happy cat', 'A rocket ship', 'Pizza party', 'Dancing robot', 'Sunny beach']
      room.prompts.set(id, defaults[Math.floor(Math.random() * defaults.length)])
    }
  }

  assignPrompts(room)
  room.phase = 'drawing'
  room.timerEnd = Date.now() + DRAW_TIME * 1000

  // Send each player their assigned prompt
  for (const [playerId, prompt] of room.promptAssignments) {
    io.to(playerId).emit('assign-prompt', { prompt })
  }

  io.to(room.code).emit('game-phase', {
    phase: 'drawing',
    timerEnd: room.timerEnd,
  })

  room.roundTimer = setTimeout(() => {
    advanceToVoting(room)
  }, DRAW_TIME * 1000)
}

function advanceToVoting(room: ReturnType<typeof getRoom>) {
  if (!room) return
  room.phase = 'voting'
  room.timerEnd = null

  io.to(room.code).emit('game-phase', { phase: 'voting' })
  io.to(room.code).emit('drawings', {
    drawings: room.drawings.map((d, i) => ({
      index: i,
      prompt: d.prompt,
      imageData: d.imageData,
      playerNickname: d.playerNickname,
    })),
  })
}

function advanceToResults(room: ReturnType<typeof getRoom>) {
  if (!room) return
  room.phase = 'results'

  const results = calculateResults(room)
  io.to(room.code).emit('game-phase', { phase: 'results' })
  io.to(room.code).emit('results', {
    drawings: results.map(d => ({
      playerNickname: d.playerNickname,
      prompt: d.prompt,
      imageData: d.imageData,
      votes: d.votes.length,
    })),
    leaderboard: getSerializablePlayers(room)
      .sort((a, b) => b.score - a.score)
      .map(p => ({ nickname: p.nickname, score: p.score, isHost: p.isHost })),
  })
}

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Drawly server running on port ${PORT}`)
})
