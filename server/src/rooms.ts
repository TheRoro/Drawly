import { Room, Player, GamePhase, Drawing } from './types.js'

const rooms = new Map<string, Room>()

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return rooms.has(code) ? generateCode() : code
}

export function createRoom(hostId: string, nickname: string): Room {
  const code = generateCode()
  const host: Player = {
    id: hostId,
    nickname,
    isHost: true,
    score: 0,
    connected: true,
  }
  const room: Room = {
    code,
    players: new Map([[hostId, host]]),
    phase: 'lobby',
    prompts: new Map(),
    drawings: [],
    promptAssignments: new Map(),
    roundTimer: null,
    timerEnd: null,
    round: 1,
  }
  rooms.set(code, room)
  return room
}

export function joinRoom(code: string, playerId: string, nickname: string): Room | null {
  const room = rooms.get(code.toUpperCase())
  if (!room) return null
  if (room.phase !== 'lobby') return null
  if (room.players.size >= 10) return null

  const player: Player = {
    id: playerId,
    nickname,
    isHost: false,
    score: 0,
    connected: true,
  }
  room.players.set(playerId, player)
  return room
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase())
}

export function getRoomByPlayerId(playerId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.has(playerId)) return room
  }
  return undefined
}

export function removePlayer(playerId: string): Room | undefined {
  const room = getRoomByPlayerId(playerId)
  if (!room) return undefined

  room.players.delete(playerId)

  if (room.players.size === 0) {
    if (room.roundTimer) clearTimeout(room.roundTimer)
    rooms.delete(room.code)
    return undefined
  }

  // Transfer host if needed
  const wasHost = ![...room.players.values()].some(p => p.isHost)
  if (wasHost) {
    const newHost = [...room.players.values()][0]
    if (newHost) newHost.isHost = true
  }

  return room
}

export function assignPrompts(room: Room): void {
  const playerIds = [...room.prompts.keys()]
  const prompts = [...room.prompts.values()]

  // Shift prompts by 1 so no one draws their own
  room.promptAssignments.clear()
  for (let i = 0; i < playerIds.length; i++) {
    const assignedPrompt = prompts[(i + 1) % prompts.length]
    room.promptAssignments.set(playerIds[i], assignedPrompt)
  }
}

export function calculateResults(room: Room): Drawing[] {
  // Sort by votes (descending)
  const sorted = [...room.drawings].sort((a, b) => b.votes.length - a.votes.length)

  // Award points
  sorted.forEach((drawing, index) => {
    const player = room.players.get(drawing.playerId)
    if (player) {
      const points = drawing.votes.length * 100
      // Bonus for top 3
      if (index === 0) player.score += points + 300
      else if (index === 1) player.score += points + 200
      else if (index === 2) player.score += points + 100
      else player.score += points
    }
  })

  return sorted
}

export function resetForNewRound(room: Room): void {
  room.phase = 'prompts'
  room.prompts.clear()
  room.drawings = []
  room.promptAssignments.clear()
  room.round++
  if (room.roundTimer) {
    clearTimeout(room.roundTimer)
    room.roundTimer = null
  }
  room.timerEnd = null
}

export function getSerializablePlayers(room: Room): Player[] {
  return [...room.players.values()]
}
