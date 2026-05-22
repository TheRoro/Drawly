import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRoom,
  getSerializablePlayers,
  markDisconnected,
  reconnectPlayer,
  removePlayer,
} from './rooms.js'

test('reconnects by token, rotates it, and never serializes token hashes', () => {
  const initial = createRoom('socket-1', 'Roro', 'test-address', '🐱')
  markDisconnected('socket-1')

  const firstReconnect = reconnectPlayer(initial.room.code, initial.reconnectToken, 'socket-2')
  assert.ok(firstReconnect)
  assert.notEqual(firstReconnect.reconnectToken, initial.reconnectToken)

  const [serializedPlayer] = getSerializablePlayers(firstReconnect.room)
  assert.equal('reconnectTokenHash' in serializedPlayer, false)
  assert.equal('previousReconnectTokenHashes' in serializedPlayer, false)

  markDisconnected('socket-2')
  const retryWithPreviousToken = reconnectPlayer(
    initial.room.code,
    initial.reconnectToken,
    'socket-3',
  )
  assert.ok(retryWithPreviousToken)

  removePlayer('socket-3')
})
