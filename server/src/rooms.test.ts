import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRoom,
  getSerializablePlayers,
  haveAllDrawersSubmitted,
  joinRoom,
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

test('requires submissions from every currently connected drawer', () => {
  const { room } = createRoom('host', 'Host', 'test-address', '🐱')
  assert.ok(joinRoom(room.code, 'drawer-1', 'First', '🐶'))
  assert.ok(joinRoom(room.code, 'drawer-2', 'Second', '🦊'))

  room.phase = 'drawing'
  room.currentPromptAuthorId = 'host'
  room.currentRoundDrawings.push({
    playerId: 'drawer-1',
    playerNickname: 'First',
    prompt: 'Test',
    promptAuthorId: 'host',
    imageData: 'data:image/png;base64,test',
    votes: [],
    round: 0,
  })

  markDisconnected('drawer-1')
  assert.equal(room.currentRoundDrawings.length, 1)
  assert.equal(room.players.get('drawer-2')?.connected, true)
  assert.equal(haveAllDrawersSubmitted(room), false)

  room.currentRoundDrawings.push({
    playerId: 'drawer-2',
    playerNickname: 'Second',
    prompt: 'Test',
    promptAuthorId: 'host',
    imageData: 'data:image/png;base64,test',
    votes: [],
    round: 0,
  })
  assert.equal(haveAllDrawersSubmitted(room), true)

  removePlayer('drawer-1')
  removePlayer('drawer-2')
  removePlayer('host')
})
