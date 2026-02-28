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
  assignPromptsForRound,
  calculateRoundResults,
  hasMoreRounds,
  resetForNewGame,
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
const VOTE_TIME = 30 // seconds

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

    // Set up rounds: N-1 drawing rounds for N players
    room.playerOrder = [...room.players.keys()]
    room.totalRounds = room.players.size - 1
    room.drawingRound = 0

    room.phase = 'prompts'
    io.to(room.code).emit('game-phase', {
      phase: 'prompts',
      timerEnd: Date.now() + PROMPT_TIME * 1000,
    })

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

    // Don't allow double submission
    if (room.currentRoundDrawings.some(d => d.playerId === socket.id)) return

    const prompt = room.promptAssignments.get(socket.id) || 'Unknown'
    const player = room.players.get(socket.id)

    // Find who authored this prompt
    let promptAuthorId = ''
    for (const [pid, p] of room.prompts) {
      if (p === prompt) {
        promptAuthorId = pid
        break
      }
    }

    const drawing: import('./types.js').Drawing = {
      playerId: socket.id,
      playerNickname: player?.nickname || 'Anonymous',
      prompt,
      promptAuthorId,
      imageData,
      votes: [],
      round: room.drawingRound,
    }

    room.currentRoundDrawings.push(drawing)
    room.drawings.push(drawing)

    // If all submitted, advance early
    if (room.currentRoundDrawings.length === room.players.size) {
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

    // Remove previous vote from this round's drawings
    room.currentRoundDrawings.forEach(d => {
      d.votes = d.votes.filter(v => v !== socket.id)
    })

    // Add new vote
    room.currentRoundDrawings[drawingIndex].votes.push(socket.id)

    // Check if all players have voted (everyone can vote except their own drawing's author isn't restricted from voting)
    const totalVotes = room.currentRoundDrawings.reduce((sum, d) => sum + d.votes.length, 0)
    if (totalVotes >= room.players.size) {
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
    room.totalRounds = room.players.size - 1

    room.phase = 'prompts'
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

  // Advance to next drawing round
  room.drawingRound++
  room.currentRoundDrawings = []

  assignPromptsForRound(room)
  room.phase = 'drawing'
  room.timerEnd = Date.now() + DRAW_TIME * 1000

  // Send each player their assigned prompt
  for (const [playerId, prompt] of room.promptAssignments) {
    io.to(playerId).emit('assign-prompt', { prompt })
  }

  io.to(room.code).emit('game-phase', {
    phase: 'drawing',
    timerEnd: room.timerEnd,
    drawingRound: room.drawingRound,
    totalRounds: room.totalRounds,
  })

  room.roundTimer = setTimeout(() => {
    advanceToVoting(room)
  }, DRAW_TIME * 1000)
}

function advanceToVoting(room: ReturnType<typeof getRoom>) {
  if (!room) return
  room.phase = 'voting'
  room.timerEnd = Date.now() + VOTE_TIME * 1000

  io.to(room.code).emit('game-phase', {
    phase: 'voting',
    drawingRound: room.drawingRound,
    totalRounds: room.totalRounds,
    timerEnd: room.timerEnd,
  })
  io.to(room.code).emit('drawings', {
    drawings: room.currentRoundDrawings.map((d, i) => ({
      index: i,
      prompt: d.prompt,
      imageData: d.imageData,
      playerNickname: d.playerNickname,
    })),
  })

  room.roundTimer = setTimeout(() => {
    advanceToRoundResults(room)
  }, VOTE_TIME * 1000)
}

function advanceToRoundResults(room: ReturnType<typeof getRoom>) {
  if (!room) return

  const results = calculateRoundResults(room)

  if (hasMoreRounds(room)) {
    // Show round results, then auto-advance to next drawing round
    io.to(room.code).emit('round-results', {
      drawingRound: room.drawingRound,
      totalRounds: room.totalRounds,
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

    // Auto-advance to next drawing round after 8 seconds
    room.roundTimer = setTimeout(() => {
      advanceToDrawing(room)
    }, 8000)
  } else {
    // Final results
    room.phase = 'results'
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
}

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`Drawly server running on port ${PORT}`)
})
