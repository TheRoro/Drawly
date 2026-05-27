// Shared Socket.IO contracts consumed by both the browser and server builds.
export type GamePhase = 'lobby' | 'prompts' | 'drawing' | 'voting' | 'round-results' | 'results'
export type ReactionEmoji = '💥' | '👁️' | '🗿' | '🫠' | '💀' | '🎺'

export interface PlayerView {
  id: string
  nickname: string
  avatar: string
  isHost: boolean
  score: number
  connected: boolean
  color: string
}

export interface RoomState {
  players: PlayerView[]
  phase: GamePhase
  code: string
}

export interface DrawingEntry {
  index: number
  prompt: string
  imageData: string
  playerId: string
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
  playerId: string
  playerNickname: string
  imageData: string
  submitted?: boolean
  count?: number
  total?: number
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
  emoji: ReactionEmoji
}

export interface ClientToServerEvents {
  'time-sync': (
    data: { clientSend: number },
    callback: (response: { serverTime: number }) => void,
  ) => void
  'create-room': (data: { nickname: string; avatar: string }) => void
  'join-room': (data: { code: string; nickname: string; avatar: string }) => void
  'rejoin-room': (data: { code: string; reconnectToken: string }) => void
  'start-game': (data: { drawTime: number }) => void
  'chat-message': (data: { message: string }) => void
  reaction: (data: { emoji: ReactionEmoji }) => void
  'submit-prompt': (data: { prompt: string }) => void
  snapshot: (data: { imageData: string }) => void
  'submit-drawing': (data: { imageData: string }) => void
  'submit-vote': (data: { drawingIndex: number }) => void
  'play-again': () => void
  'kick-player': (data: { targetId: string }) => void
}

export interface ServerToClientEvents {
  error: (data: { message: string }) => void
  'room-created': (data: { code: string }) => void
  'session-token': (data: { reconnectToken: string }) => void
  'room-update': (data: RoomState) => void
  'room-expired': () => void
  kicked: () => void
  'game-phase': (data: {
    phase: GamePhase
    timerEnd?: number | null
    currentRound?: number
    totalRounds?: number
    promptAuthorId?: string
    promptAuthorNickname?: string
  }) => void
  'drawing-state': (data: {
    phase: 'drawing'
    role: 'drawer' | 'prompt-author'
    prompt: string
    hasSubmitted: boolean
    timerEnd: number | null
    currentRound: number
    totalRounds: number
    promptAuthorId: string
    spyDrawings: (SpyDrawing & { submitted: boolean })[]
  }) => void
  'assign-prompt': (data: { prompt: string }) => void
  'waiting-round': (data: { message: string }) => void
  'request-snapshot': () => void
  'spy-snapshot': (data: {
    playerId: string
    playerNickname: string
    imageData: string
  }) => void
  'spy-drawing': (data: SpyDrawing) => void
  drawings: (data: { prompt: string; drawings: DrawingEntry[] }) => void
  'round-results': (data: {
    currentRound: number
    totalRounds: number
    drawings: ResultEntry[]
    leaderboard: LeaderboardEntry[]
  }) => void
  results: (data: { drawings: ResultEntry[]; leaderboard: LeaderboardEntry[] }) => void
  'chat-message': (data: ChatMessage) => void
  reaction: (data: Reaction) => void
}

export interface InterServerEvents {}

export interface SocketData {
  address: string
}
