export type GamePhase = 'lobby' | 'prompts' | 'drawing' | 'voting' | 'round-results' | 'results'

export interface Player {
  id: string
  nickname: string
  avatar: string
  reconnectTokenHash: string
  previousReconnectTokenHashes: { hash: string; expiresAt: number }[]
  isHost: boolean
  score: number
  connected: boolean
  color: string
}

export interface Drawing {
  playerId: string
  playerNickname: string
  prompt: string
  promptAuthorId: string
  imageData: string // base64 PNG
  votes: string[] // player IDs who voted for this
  round: number
}

export interface Room {
  code: string
  creatorAddress: string
  players: Map<string, Player>
  phase: GamePhase
  prompts: Map<string, string> // playerId → prompt text
  drawings: Drawing[]
  currentRoundDrawings: Drawing[] // drawings for current round only
  roundTimer: ReturnType<typeof setTimeout> | null
  timerEnd: number | null
  currentRound: number // which prompt we're on (0-based index into playerOrder)
  totalRounds: number // total prompts = number of players
  playerOrder: string[] // fixed order — determines whose prompt is used each round
  currentPromptAuthorId: string // whose prompt is being drawn this round
  drawTime: number // seconds per drawing round
}
