import { io, Socket } from 'socket.io-client'

const URL = import.meta.env.VITE_SERVER_URL || ''

export const socket: Socket = io(URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
})
