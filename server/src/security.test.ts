import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FixedWindowRateLimiter,
  parseChatMessage,
  parseDrawTime,
  parseNickname,
  parsePngDataUrl,
  parseReaction,
  parseRoomCode,
} from './security.js'

const onePixelPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

test('normalizes bounded text and room codes', () => {
  assert.equal(parseNickname('  Roro  '), 'Roro')
  assert.equal(parseNickname(''), null)
  assert.equal(parseNickname('x'.repeat(25)), null)
  assert.equal(parseChatMessage(' hello\nworld '), 'hello\nworld')
  assert.equal(parseRoomCode(' abc23 '), 'ABC23')
  assert.equal(parseRoomCode('ABCDE!'), null)
})

test('accepts only supported settings and reactions', () => {
  assert.equal(parseDrawTime(60), 60)
  assert.equal(parseDrawTime(60.5), null)
  assert.equal(parseDrawTime(181), null)
  assert.equal(parseReaction('💥'), '💥')
  assert.equal(parseReaction('😈'), null)
})

test('validates PNG data URLs and decoded size', () => {
  assert.equal(parsePngDataUrl(onePixelPng, 1_000), onePixelPng)
  assert.equal(parsePngDataUrl('data:image/svg+xml;base64,PHN2Zz4=', 1_000), null)
  assert.equal(parsePngDataUrl(onePixelPng, 20), null)
})

test('enforces fixed-window limits independently by key', () => {
  const limiter = new FixedWindowRateLimiter()
  const rule = { limit: 2, windowMs: 1_000 }

  assert.equal(limiter.consume('socket:a', rule, 0), true)
  assert.equal(limiter.consume('socket:a', rule, 1), true)
  assert.equal(limiter.consume('socket:a', rule, 2), false)
  assert.equal(limiter.consume('socket:b', rule, 2), true)
  assert.equal(limiter.consume('socket:a', rule, 1_000), true)
})
