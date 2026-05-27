import type { Server } from 'socket.io'
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@drawly/protocol'
import type { Drawing, Room } from './types.js'
import {
  calculateRoundResults,
  getCurrentPrompt,
  getDrawersForRound,
  getSerializablePlayers,
  hasMoreRounds,
} from './rooms.js'

type DrawlyServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

export interface GameController {
  startDrawingRound(room: Room): void
  advanceToVoting(room: Room): void
  advanceToRoundResults(room: Room): void
}

const VOTE_TIME_MS = 30_000

export function createGameController(io: DrawlyServer, resultsPauseMs: number): GameController {
  const startDrawingRound = (room: Room) => {
    console.log(`[${room.code}] Starting drawing round ${room.currentRound + 1}/${room.totalRounds}, players: ${room.players.size}`)

    for (const [id] of room.players) {
      if (!room.prompts.has(id)) {
        const defaults = ['A happy cat', 'A rocket ship', 'Pizza party', 'Dancing robot', 'Sunny beach']
        room.prompts.set(id, defaults[Math.floor(Math.random() * defaults.length)])
      }
    }

    room.currentRoundDrawings = []
    room.lastSnapshots = new Map<string, string>()
    const { prompt, authorId } = getCurrentPrompt(room)
    room.currentPromptAuthorId = authorId
    const authorNickname = room.players.get(authorId)?.nickname || 'Someone'

    room.phase = 'drawing'
    room.timerEnd = Date.now() + room.drawTime * 1000

    const drawers = getDrawersForRound(room)
    for (const playerId of drawers) {
      io.to(playerId).emit('assign-prompt', { prompt })
    }

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
      const currentDrawers = getDrawersForRound(room)
      const submittedIds = new Set(room.currentRoundDrawings.map(drawing => drawing.playerId))
      const { prompt: roundPrompt } = getCurrentPrompt(room)

      for (const playerId of currentDrawers) {
        const snapshot = room.lastSnapshots?.get(playerId)
        if (!submittedIds.has(playerId) && snapshot) {
          const player = room.players.get(playerId)
          const drawing: Drawing = {
            playerId,
            playerNickname: player?.nickname || 'Anonymous',
            prompt: roundPrompt,
            promptAuthorId: room.currentPromptAuthorId,
            imageData: snapshot,
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

    room.snapshotInterval = setInterval(() => {
      if (room.phase !== 'drawing') {
        if (room.snapshotInterval) clearInterval(room.snapshotInterval)
        room.snapshotInterval = null
        return
      }
      for (const playerId of getDrawersForRound(room)) {
        io.to(playerId).emit('request-snapshot')
      }
    }, 2_000)
  }

  const advanceToVoting = (room: Room) => {
    console.log(`[${room.code}] advanceToVoting: ${room.currentRoundDrawings.length} drawings`)

    if (room.snapshotInterval) {
      clearInterval(room.snapshotInterval)
      room.snapshotInterval = null
    }

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
      }, 3_000)
      return
    }

    if (room.currentRoundDrawings.length === 1) {
      console.log(`[${room.code}] Only 1 drawing, auto-win → round results`)
      room.currentRoundDrawings[0].votes.push('auto-win')
      advanceToRoundResults(room)
      return
    }

    room.phase = 'voting'
    room.timerEnd = Date.now() + VOTE_TIME_MS
    const { prompt } = getCurrentPrompt(room)

    io.to(room.code).emit('game-phase', {
      phase: 'voting',
      currentRound: room.currentRound + 1,
      totalRounds: room.totalRounds,
      timerEnd: room.timerEnd,
    })
    io.to(room.code).emit('drawings', {
      prompt,
      drawings: room.currentRoundDrawings.map((drawing, index) => ({
        index,
        prompt: drawing.prompt,
        imageData: drawing.imageData,
        playerId: drawing.playerId,
      })),
    })

    room.roundTimer = setTimeout(() => advanceToRoundResults(room), VOTE_TIME_MS)
  }

  const advanceToRoundResults = (room: Room) => {
    console.log(`[${room.code}] Round ${room.currentRound + 1} results — ${room.currentRoundDrawings.length} drawings`)

    room.phase = 'round-results'
    const results = calculateRoundResults(room)
    io.to(room.code).emit('round-results', {
      currentRound: room.currentRound + 1,
      totalRounds: room.totalRounds,
      drawings: results.map(drawing => ({
        playerNickname: drawing.playerNickname,
        prompt: drawing.prompt,
        imageData: drawing.imageData,
        votes: drawing.votes.length,
      })),
      leaderboard: getLeaderboard(room),
    })

    room.roundTimer = setTimeout(() => {
      if (hasMoreRounds(room)) {
        room.currentRound++
        startDrawingRound(room)
      } else {
        showFinalResults(room)
      }
    }, resultsPauseMs)
  }

  const showFinalResults = (room: Room) => {
    room.phase = 'results'
    io.to(room.code).emit('game-phase', { phase: 'results' })
    io.to(room.code).emit('results', {
      drawings: room.drawings
        .sort((a, b) => b.votes.length - a.votes.length)
        .slice(0, 6)
        .map(drawing => ({
          playerNickname: drawing.playerNickname,
          prompt: drawing.prompt,
          imageData: drawing.imageData,
          votes: drawing.votes.length,
        })),
      leaderboard: getLeaderboard(room),
    })
  }

  return { startDrawingRound, advanceToVoting, advanceToRoundResults }
}

function getLeaderboard(room: Room) {
  return getSerializablePlayers(room)
    .sort((a, b) => b.score - a.score)
    .map(player => ({
      nickname: player.nickname,
      avatar: player.avatar,
      score: player.score,
      isHost: player.isHost,
      color: player.color,
    }))
}
