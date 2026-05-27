const IMAGE_PREFIX = 'data:image/png;base64,'
const PNG_SIGNATURE = '89504e470d0a1a0a'

export const ALLOWED_AVATARS = new Set([
  '🐱', '🐶', '🦊', '🐸', '🐼', '🐨', '🦄', '🐙', '🐥', '🦋', '🐢', '🦈',
  '🤖', '👻', '🎃', '👽', '🧠', '🔥', '⭐', '🍕', '🎮', '🌈', '💎', '🍄',
])
export const ALLOWED_REACTIONS = new Set<ReactionEmoji>(['💥', '👁️', '🗿', '🫠', '💀', '🎺'])

export const MAX_DRAWING_BYTES = 1_000_000
export const MAX_SNAPSHOT_BYTES = 500_000
export const MAX_ROOM_DRAWING_BYTES = 20_000_000

type UnknownRecord = Record<string, unknown>

export interface RateLimit {
  limit: number
  windowMs: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>()
  private operations = 0

  consume(key: string, rule: RateLimit, now = Date.now()): boolean {
    this.operations++
    if (this.operations % 256 === 0) this.prune(now)

    const entry = this.entries.get(key)
    if (!entry || entry.resetAt <= now) {
      this.entries.set(key, { count: 1, resetAt: now + rule.windowMs })
      return true
    }

    if (entry.count >= rule.limit) return false
    entry.count++
    return true
  }

  clearPrefix(prefix: string): void {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key)
    }
  }

  private prune(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key)
    }
  }
}

export function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as UnknownRecord
}

export function parseNickname(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const nickname = value.trim()
  if (nickname.length < 1 || nickname.length > 24 || /[\u0000-\u001f\u007f]/u.test(nickname)) return null
  return nickname
}

export function parseAvatar(value: unknown): string | undefined | null {
  if (value === undefined || value === '') return undefined
  if (typeof value !== 'string' || !ALLOWED_AVATARS.has(value)) return null
  return value
}

export function parseRoomCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return /^[A-HJ-NP-Z2-9]{5}$/u.test(code) ? code : null
}

export function parseReconnectToken(value: unknown): string | null {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value) ? value : null
}

export function parsePrompt(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const prompt = value.trim()
  if (prompt.length < 1 || prompt.length > 120 || /[\u0000-\u001f\u007f]/u.test(prompt)) return null
  return prompt
}

export function parseChatMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const message = value.trim()
  if (message.length < 1 || message.length > 200 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(message)) return null
  return message
}

export function parseReaction(value: unknown): ReactionEmoji | null {
  return typeof value === 'string' && ALLOWED_REACTIONS.has(value as ReactionEmoji)
    ? value as ReactionEmoji
    : null
}

export function parseDrawTime(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 15 && value <= 180 ? value : null
}

export function parseDrawingIndex(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

export function parseSocketId(value: unknown): string | null {
  return typeof value === 'string' && value.length >= 1 && value.length <= 128 ? value : null
}

export function parsePngDataUrl(
  value: unknown,
  maxBytes: number,
  maxWidth = 1_600,
  maxHeight = 1_200,
): string | null {
  if (typeof value !== 'string' || !value.startsWith(IMAGE_PREFIX)) return null

  const encoded = value.slice(IMAGE_PREFIX.length)
  if (encoded.length < 32 || encoded.length > Math.ceil(maxBytes * 4 / 3) + 4) return null
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)) return null

  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0
  const decodedBytes = Math.floor(encoded.length * 3 / 4) - padding
  if (decodedBytes > maxBytes) return null

  const header = Buffer.from(encoded.slice(0, 40), 'base64')
  if (header.length < 24 || header.subarray(0, 8).toString('hex') !== PNG_SIGNATURE) return null

  const width = header.readUInt32BE(16)
  const height = header.readUInt32BE(20)
  if (width < 1 || height < 1 || width > maxWidth || height > maxHeight) return null

  return value
}

export function getImageBytes(imageData: string): number {
  const encoded = imageData.slice(IMAGE_PREFIX.length)
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0
  return Math.floor(encoded.length * 3 / 4) - padding
}
import type { ReactionEmoji } from '@drawly/protocol'
