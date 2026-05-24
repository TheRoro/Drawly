import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { Room, Player, Drawing } from './types.js'

const rooms = new Map<string, Room>()
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()
const DISCONNECT_GRACE_MS = 15_000
const PREVIOUS_TOKEN_GRACE_MS = 120_000
const MAX_PREVIOUS_TOKENS = 3
const MAX_ACTIVE_ROOMS = 500
const MAX_ACTIVE_ROOMS_PER_ADDRESS = 10

const PLAYER_COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
]

const AVATARS = ['🐱', '🐶', '🦊', '🐸', '🐼', '🐨', '🦄', '🐙', '🐥', '🦋', '🐢', '🦈', '🤖', '👻', '🎃', '👽', '🧠', '🔥', '⭐', '🍕', '🎮', '🌈', '💎', '🍄']

function getRandomAvatar(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)]
}

function normalizeAvatar(avatar?: string): string {
  return avatar || getRandomAvatar()
}

function getNextColor(room: Room): string {
  const usedColors = [...room.players.values()].map(p => p.color)
  return PLAYER_COLORS.find(c => !usedColors.includes(c)) || PLAYER_COLORS[room.players.size % PLAYER_COLORS.length]
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return rooms.has(code) ? generateCode() : code
}

function hashReconnectToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function issueReconnectToken(player: Player): string {
  const token = randomBytes(32).toString('hex')
  const now = Date.now()
  player.previousReconnectTokenHashes = player.previousReconnectTokenHashes
    .filter(entry => entry.expiresAt > now)
    .slice(0, MAX_PREVIOUS_TOKENS - 1)
  if (player.reconnectTokenHash) {
    player.previousReconnectTokenHashes.unshift({
      hash: player.reconnectTokenHash,
      expiresAt: now + PREVIOUS_TOKEN_GRACE_MS,
    })
  }
  player.reconnectTokenHash = hashReconnectToken(token)
  return token
}

function reconnectTokenMatches(player: Player, token: string): boolean {
  const suppliedHash = Buffer.from(hashReconnectToken(token), 'hex')
  const now = Date.now()
  player.previousReconnectTokenHashes = player.previousReconnectTokenHashes.filter(entry => entry.expiresAt > now)
  const acceptedHashes = [
    player.reconnectTokenHash,
    ...player.previousReconnectTokenHashes.map(entry => entry.hash),
  ]
  return acceptedHashes.some(hash => {
    const storedHash = Buffer.from(hash, 'hex')
    return suppliedHash.length === storedHash.length && timingSafeEqual(suppliedHash, storedHash)
  })
}

export function canCreateRoom(creatorAddress: string): boolean {
  if (rooms.size >= MAX_ACTIVE_ROOMS) return false
  let roomsForAddress = 0
  for (const room of rooms.values()) {
    if (room.creatorAddress === creatorAddress) roomsForAddress++
  }
  return roomsForAddress < MAX_ACTIVE_ROOMS_PER_ADDRESS
}

export function createRoom(
  hostId: string,
  nickname: string,
  creatorAddress: string,
  avatar?: string,
): { room: Room; reconnectToken: string } {
  const code = generateCode()
  const room: Room = {
    code,
    creatorAddress,
    players: new Map(),
    phase: 'lobby',
    prompts: new Map(),
    drawings: [],
    currentRoundDrawings: [],
    roundTimer: null,
    timerEnd: null,
    currentRound: 0,
    totalRounds: 0,
    playerOrder: [],
    currentPromptAuthorId: '',
    drawTime: 60,
  }
  const host: Player = {
    id: hostId,
    nickname,
    avatar: normalizeAvatar(avatar),
    reconnectTokenHash: '',
    previousReconnectTokenHashes: [],
    isHost: true,
    score: 0,
    connected: true,
    color: getNextColor(room),
  }
  const reconnectToken = issueReconnectToken(host)
  room.players.set(hostId, host)
  rooms.set(code, room)
  return { room, reconnectToken }
}

export function joinRoom(
  code: string,
  playerId: string,
  nickname: string,
  avatar?: string,
): { room: Room; reconnectToken: string } | null {
  const room = rooms.get(code.toUpperCase())
  if (!room) return null
  if (room.phase !== 'lobby') return null
  if (room.players.size >= 10) return null
  if ([...room.players.values()].some(player => player.nickname.toLowerCase() === nickname.toLowerCase())) return null

  const player: Player = {
    id: playerId,
    nickname,
    avatar: normalizeAvatar(avatar),
    reconnectTokenHash: '',
    previousReconnectTokenHashes: [],
    isHost: false,
    score: 0,
    connected: true,
    color: getNextColor(room),
  }
  const reconnectToken = issueReconnectToken(player)
  room.players.set(playerId, player)
  return { room, reconnectToken }
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

  const disconnectTimer = disconnectTimers.get(playerId)
  if (disconnectTimer) {
    clearTimeout(disconnectTimer)
    disconnectTimers.delete(playerId)
  }

  room.players.delete(playerId)

  if (room.players.size === 0) {
    if (room.roundTimer) clearTimeout(room.roundTimer)
    rooms.delete(room.code)
    return undefined
  }

  // Transfer host if needed
  const wasHost = ![...room.players.values()].some(p => p.isHost)
  if (wasHost) {
    const newHost = [...room.players.values()].find(player => player.connected) || [...room.players.values()][0]
    if (newHost) newHost.isHost = true
  }

  return room
}

export function markDisconnected(playerId: string, onExpire?: () => void): Room | undefined {
  const room = getRoomByPlayerId(playerId)
  if (!room) return undefined

  const player = room.players.get(playerId)
  if (!player) return room

  player.connected = false

  const existingTimer = disconnectTimers.get(playerId)
  if (existingTimer) clearTimeout(existingTimer)

  const timer = setTimeout(() => {
    disconnectTimers.delete(playerId)
    onExpire?.()
  }, DISCONNECT_GRACE_MS)

  disconnectTimers.set(playerId, timer)
  return room
}

export function reconnectPlayer(
  code: string,
  reconnectToken: string,
  newSocketId: string,
): { room: Room; reconnectToken: string } | null {
  const room = rooms.get(code.toUpperCase())
  if (!room) return null

  const disconnectedEntry = [...room.players.entries()].find(([, player]) => {
    return !player.connected && reconnectTokenMatches(player, reconnectToken)
  })

  if (!disconnectedEntry) return null

  const [oldSocketId, player] = disconnectedEntry
  const disconnectTimer = disconnectTimers.get(oldSocketId)
  if (disconnectTimer) {
    clearTimeout(disconnectTimer)
    disconnectTimers.delete(oldSocketId)
  }

  room.players.delete(oldSocketId)
  player.id = newSocketId
  player.connected = true
  const rotatedReconnectToken = issueReconnectToken(player)
  room.players.set(newSocketId, player)

  room.playerOrder = room.playerOrder.map(id => id === oldSocketId ? newSocketId : id)
  if (room.currentPromptAuthorId === oldSocketId) {
    room.currentPromptAuthorId = newSocketId
  }

  if (room.prompts.has(oldSocketId)) {
    const prompt = room.prompts.get(oldSocketId)
    room.prompts.delete(oldSocketId)
    if (prompt !== undefined) room.prompts.set(newSocketId, prompt)
  }

  room.currentRoundDrawings.forEach(drawing => {
    if (drawing.playerId === oldSocketId) drawing.playerId = newSocketId
    if (drawing.promptAuthorId === oldSocketId) drawing.promptAuthorId = newSocketId
    drawing.votes = drawing.votes.map(vote => {
      if (vote === oldSocketId) return newSocketId
      if (vote === `${oldSocketId}-bonus`) return `${newSocketId}-bonus`
      return vote
    })
  })

  room.drawings.forEach(drawing => {
    if (drawing.playerId === oldSocketId) drawing.playerId = newSocketId
    if (drawing.promptAuthorId === oldSocketId) drawing.promptAuthorId = newSocketId
    drawing.votes = drawing.votes.map(vote => {
      if (vote === oldSocketId) return newSocketId
      if (vote === `${oldSocketId}-bonus`) return `${newSocketId}-bonus`
      return vote
    })
  })

  const lastSnapshots: Map<string, string> | undefined = (room as any)._lastSnapshots
  if (lastSnapshots?.has(oldSocketId)) {
    const snapshot = lastSnapshots.get(oldSocketId)
    lastSnapshots.delete(oldSocketId)
    if (snapshot !== undefined) lastSnapshots.set(newSocketId, snapshot)
  }

  return { room, reconnectToken: rotatedReconnectToken }
}

export function getCurrentPrompt(room: Room): { prompt: string; authorId: string } {
  let authorId = room.playerOrder[room.currentRound]
  // If the author disconnected, use their prompt still (it was submitted) but assign author role to first player
  if (!room.players.has(authorId)) {
    // Use the prompt they submitted, but any connected player can be the "author"
    const prompt = room.prompts.get(authorId) || 'Mystery prompt'
    const fallbackAuthor = [...room.players.keys()][0] || authorId
    return { prompt, authorId: fallbackAuthor }
  }
  const prompt = room.prompts.get(authorId) || 'Mystery prompt'
  return { prompt, authorId }
}

export function getDrawersForRound(room: Room): string[] {
  // Use currentPromptAuthorId (kept in sync on reconnect) rather than
  // playerOrder[currentRound] which can go stale after disconnections
  const authorId = room.currentPromptAuthorId || room.playerOrder[room.currentRound]
  return [...room.players.entries()]
    .filter(([id, player]) => id !== authorId && player.connected)
    .map(([id]) => id)
}

export function haveAllDrawersSubmitted(room: Room): boolean {
  const submittedIds = new Set(room.currentRoundDrawings.map(drawing => drawing.playerId))
  return getDrawersForRound(room).every(playerId => submittedIds.has(playerId))
}

export function calculateRoundResults(room: Room): Drawing[] {
  const sorted = [...room.currentRoundDrawings].sort((a, b) => b.votes.length - a.votes.length)

  sorted.forEach((drawing, index) => {
    const player = room.players.get(drawing.playerId)
    if (player) {
      const points = drawing.votes.length * 10
      if (index === 0) player.score += points + 30
      else if (index === 1) player.score += points + 20
      else if (index === 2) player.score += points + 10
      else player.score += points
    }
  })

  return sorted
}

export function hasMoreRounds(room: Room): boolean {
  // Use actual connected player count as max rounds (handles disconnects)
  const maxRounds = Math.min(room.totalRounds, room.playerOrder.length)
  return room.currentRound < maxRounds - 1
}

export function resetForNewGame(room: Room): void {
  room.phase = 'prompts'
  room.prompts.clear()
  room.drawings = []
  room.currentRoundDrawings = []
  room.currentRound = 0
  room.totalRounds = 0
  room.playerOrder = []
  room.currentPromptAuthorId = ''
  if (room.roundTimer) {
    clearTimeout(room.roundTimer)
    room.roundTimer = null
  }
  room.timerEnd = null
  for (const player of room.players.values()) {
    player.score = 0
  }
}

export function getSerializablePlayers(
  room: Room,
): Omit<Player, 'reconnectTokenHash' | 'previousReconnectTokenHashes'>[] {
  return [...room.players.values()].map(({
    reconnectTokenHash: _reconnectTokenHash,
    previousReconnectTokenHashes: _previousReconnectTokenHashes,
    ...player
  }) => player)
}
