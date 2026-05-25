import assert from 'node:assert/strict'
import test from 'node:test'
import { io as createClient, type Socket } from 'socket.io-client'
import { getRoom } from './rooms.js'

const onePixelPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 2_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, handleEvent)
      reject(new Error(`Timed out waiting for ${event}`))
    }, timeoutMs)
    const handleEvent = (payload: T) => {
      clearTimeout(timeout)
      resolve(payload)
    }
    socket.once(event, handleEvent)
  })
}

function waitForEventWhere<T>(
  socket: Socket,
  event: string,
  predicate: (payload: T) => boolean,
  timeoutMs = 2_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, handleEvent)
      reject(new Error(`Timed out waiting for matching ${event}`))
    }, timeoutMs)
    const handleEvent = (payload: T) => {
      if (!predicate(payload)) return
      clearTimeout(timeout)
      socket.off(event, handleEvent)
      resolve(payload)
    }
    socket.on(event, handleEvent)
  })
}

function connectClient(url: string): Promise<Socket> {
  const socket = createClient(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  })
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket))
    socket.once('connect_error', reject)
  })
}

test('validates clients and completes a multiplayer round deterministically', async () => {
  process.env.DRAWLY_RESULTS_PAUSE_MS = '25'
  const { startServer, stopServer } = await import('./index.js')
  const port = await startServer(0)
  const url = `http://127.0.0.1:${port}`
  const clients: Socket[] = []

  try {
    const originalHost = await connectClient(url)
    clients.push(originalHost)

    const invalidRequest = waitForEvent<{ message: string }>(originalHost, 'error')
    originalHost.emit('create-room', { nickname: { invalid: true }, avatar: '🐱' })
    assert.match((await invalidRequest).message, /invalid/u)

    const roomCreated = waitForEvent<{ code: string }>(originalHost, 'room-created')
    const initialToken = waitForEvent<{ reconnectToken: string }>(originalHost, 'session-token')
    originalHost.emit('create-room', { nickname: 'Host', avatar: '🐱' })
    const [{ code }, { reconnectToken }] = await Promise.all([roomCreated, initialToken])
    assert.match(code, /^[A-HJ-NP-Z2-9]{5}$/u)
    assert.match(reconnectToken, /^[a-f0-9]{64}$/u)

    const firstDrawer = await connectClient(url)
    clients.push(firstDrawer)
    const firstJoin = waitForEvent<{ reconnectToken: string }>(firstDrawer, 'session-token')
    firstDrawer.emit('join-room', { code, nickname: 'First', avatar: '🐶' })
    await firstJoin

    const hostDisconnected = waitForEventWhere<{
      players: { nickname: string; connected: boolean }[]
    }>(
      firstDrawer,
      'room-update',
      update => update.players.some(player => player.nickname === 'Host' && !player.connected),
    )
    originalHost.disconnect()
    await hostDisconnected

    const host = await connectClient(url)
    clients.push(host)
    const rotatedToken = waitForEvent<{ reconnectToken: string }>(host, 'session-token')
    const restoredLobby = waitForEvent<{
      players: { id: string; nickname: string; isHost: boolean }[]
      phase: string
    }>(host, 'room-update')
    host.emit('rejoin-room', { code, reconnectToken })
    const [{ reconnectToken: nextToken }, restoredRoom] = await Promise.all([
      rotatedToken,
      restoredLobby,
    ])
    assert.notEqual(nextToken, reconnectToken)
    assert.equal(restoredRoom.phase, 'lobby')
    assert.equal(restoredRoom.players.length, 2)
    const restoredHost = restoredRoom.players.find(player => player.nickname === 'Host')
    assert.equal(restoredHost?.isHost, true)

    const secondDrawer = await connectClient(url)
    clients.push(secondDrawer)

    const secondJoin = waitForEvent<{ reconnectToken: string }>(secondDrawer, 'session-token')
    const fullLobby = waitForEventWhere<{
      players: { nickname: string }[]
    }>(host, 'room-update', update => update.players.length === 3)
    secondDrawer.emit('join-room', { code, nickname: 'Second', avatar: '🦊' })
    const { reconnectToken: secondDrawerToken } = await secondJoin
    assert.equal((await fullLobby).players.length, 3)

    const promptPhase = Promise.all([
      waitForEvent<{ phase: string }>(host, 'game-phase'),
      waitForEvent<{ phase: string }>(firstDrawer, 'game-phase'),
      waitForEvent<{ phase: string }>(secondDrawer, 'game-phase'),
    ])
    host.emit('start-game', { drawTime: 15 })
    assert.deepEqual((await promptPhase).map(event => event.phase), ['prompts', 'prompts', 'prompts'])

    const hostAssignment = waitForEvent<{ prompt: string }>(host, 'assign-prompt')
    const secondAssignment = waitForEvent<{ prompt: string }>(secondDrawer, 'assign-prompt')
    host.emit('submit-prompt', { prompt: 'A secure castle' })
    firstDrawer.emit('submit-prompt', { prompt: 'A tiny moon' })
    secondDrawer.emit('submit-prompt', { prompt: 'A dancing robot' })
    assert.equal((await hostAssignment).prompt, 'A tiny moon')
    assert.equal((await secondAssignment).prompt, 'A tiny moon')

    const drawerDisconnected = waitForEventWhere<{
      players: { nickname: string; connected: boolean }[]
    }>(
      host,
      'room-update',
      update => update.players.some(player => player.nickname === 'Second' && !player.connected),
    )
    secondDrawer.disconnect()
    await drawerDisconnected
    const restoredSecondDrawer = await connectClient(url)
    clients.push(restoredSecondDrawer)
    const restoredDrawingState = waitForEvent<{
      role: string
      prompt: string
      hasSubmitted: boolean
    }>(restoredSecondDrawer, 'drawing-state')
    const rotatedDrawerToken = waitForEvent<{ reconnectToken: string }>(
      restoredSecondDrawer,
      'session-token',
    )
    restoredSecondDrawer.emit('rejoin-room', { code, reconnectToken: secondDrawerToken })
    const [drawingState, drawerToken] = await Promise.all([
      restoredDrawingState,
      rotatedDrawerToken,
    ])
    assert.equal(drawingState.role, 'drawer')
    assert.equal(drawingState.prompt, 'A tiny moon')
    assert.equal(drawingState.hasSubmitted, false)
    assert.notEqual(drawerToken.reconnectToken, secondDrawerToken)

    const firstDrawingAccepted = waitForEvent(firstDrawer, 'spy-drawing')
    host.emit('submit-drawing', { imageData: onePixelPng })
    await firstDrawingAccepted
    host.emit('submit-drawing', { imageData: onePixelPng })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(getRoom(code)?.currentRoundDrawings.length, 1)

    const votingDrawings = waitForEvent<{
      drawings: { index: number; playerId: string }[]
    }>(host, 'drawings')
    restoredSecondDrawer.emit('submit-drawing', { imageData: onePixelPng })
    const { drawings } = await votingDrawings
    assert.equal(drawings.length, 2)

    const firstIndex = drawings.find(drawing => drawing.playerId === host.id)?.index
    const secondIndex = drawings.find(drawing => drawing.playerId === restoredSecondDrawer.id)?.index
    assert.notEqual(firstIndex, undefined)
    assert.notEqual(secondIndex, undefined)

    const roundResults = waitForEvent<{
      drawings: { playerNickname: string; votes: number }[]
      leaderboard: { nickname: string; score: number }[]
    }>(host, 'round-results')
    const nextRound = waitForEventWhere<{
      phase: string
      currentRound?: number
    }>(
      host,
      'game-phase',
      event => event.phase === 'drawing' && event.currentRound === 2,
    )

    const hostId = host.id
    assert.ok(hostId)
    host.emit('submit-vote', { drawingIndex: firstIndex })
    await new Promise(resolve => setImmediate(resolve))
    const roomAfterSelfVote = getRoom(code)
    assert.ok(roomAfterSelfVote)
    assert.equal(
      roomAfterSelfVote.currentRoundDrawings.some(drawing => drawing.votes.includes(hostId)),
      false,
    )

    firstDrawer.emit('submit-vote', { drawingIndex: firstIndex })
    host.emit('submit-vote', { drawingIndex: secondIndex })
    restoredSecondDrawer.emit('submit-vote', { drawingIndex: firstIndex })

    const results = await roundResults
    assert.deepEqual(results.drawings.map(drawing => drawing.votes), [3, 1])
    assert.deepEqual(
      results.leaderboard.slice(0, 2).map(player => player.score),
      [60, 30],
    )
    assert.equal((await nextRound).currentRound, 2)
  } finally {
    clients.forEach(client => client.disconnect())
    await stopServer()
  }
})
