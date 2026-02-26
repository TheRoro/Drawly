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
  imageData: string // base64 PNG
  votes: string[] // player IDs who voted for this
}

export interface Room {
  code: string
  players: Map<string, Player>
  phase: GamePhase
  prompts: Map<string, string> // playerId → prompt text
  drawings: Drawing[]
  promptAssignments: Map<string, string> // playerId → prompt they must draw
  roundTimer: ReturnType<typeof setTimeout> | null
  timerEnd: number | null
  round: number
}
