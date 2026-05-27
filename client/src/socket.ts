import { io, Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@drawly/protocol'

const URL = import.meta.env.VITE_SERVER_URL || ''

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling'],
  timeout: 20000,
})

socket.on('connect_error', error => {
  console.error('Socket connection failed:', error.message, error)
})

// Server time offset: difference between server clock and client clock.
// serverTime ≈ Date.now() + serverTimeOffset
export let serverTimeOffset = 0

socket.on('connect', () => {
  syncTime()
})

function syncTime() {
  const clientSend = Date.now()
  socket.emit('time-sync', { clientSend }, ({ serverTime }: { serverTime: number }) => {
    const clientReceive = Date.now()
    const roundTrip = clientReceive - clientSend
    // Estimate server's current time accounting for half the round-trip
    serverTimeOffset = serverTime - clientSend - Math.round(roundTrip / 2)
  })
}

/** Convert a server timerEnd to a local-clock timerEnd */
export function toLocalTime(serverTimerEnd: number): number {
  return serverTimerEnd - serverTimeOffset
}
