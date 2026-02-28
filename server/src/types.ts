export type GamePhase = 'lobby' | 'prompts' | 'drawing' | 'voting' | 'results'

export interface Player {
  id: string
  nickname: string
  isHost: boolean
  score: number
  connected: boolean
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
  players: Map<string, Player>
  phase: GamePhase
  prompts: Map<string, string> // playerId → prompt text
  drawings: Drawing[]
  currentRoundDrawings: Drawing[] // drawings for the current round only
  promptAssignments: Map<string, string> // playerId → prompt they must draw
  roundTimer: ReturnType<typeof setTimeout> | null
  timerEnd: number | null
  drawingRound: number // current drawing round (1-based)
  totalRounds: number // total drawing rounds (players - 1)
  playerOrder: string[] // fixed order for rotation
}
