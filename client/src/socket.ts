import { io, Socket } from 'socket.io-client'

const URL = import.meta.env.VITE_SERVER_URL || ''

export const socket: Socket = io(URL, {
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
