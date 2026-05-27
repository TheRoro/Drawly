# 🎨 Drawly

A multiplayer drawing game inspired by Gartic Phone and Drawful. Draw, guess, and vote with friends!

## Game Flow

1. **Create/Join Room** — Share a 5-letter room code with friends
2. **Submit Prompts** — Everyone writes what others should draw (30s)
3. **Draw!** — You get someone else's prompt and draw it (60s)
4. **Vote** — View all drawings and vote for your favorite
5. **Results** — See the leaderboard and top drawings

## Tech Stack

- **Client**: React 19 + TypeScript + Vite + Tailwind CSS
- **Server**: Node.js + Express + Socket.io
- **Canvas**: Custom HTML5 Canvas with multi-color, multi-size brushes

## Development

```bash
# Install all dependencies
cd server && npm install
cd ../client && npm install

# Run both (from root)
# Terminal 1: Server
cd server && npm run dev

# Terminal 2: Client
cd client && npm run dev
```

- Client runs on `http://localhost:3000`
- Server runs on `http://localhost:3001`
- Vite proxies WebSocket connections to the server

## Deployment

- **Frontend**: Deploy from the repository root to Vercel
  - Build command: `npm install --prefix client && npm run build:client`
  - Output directory: `client/dist`
- **Server**: Deploy from the repository root to Render as Web Service
  - Build command: `npm install --prefix server && npm run build:server`
  - Start command: `npm run start --prefix server`
  - Set `CLIENT_URL` env var to your Vercel domain
  - Set `TRUST_PROXY=true` only when Render or another trusted reverse proxy
    overwrites `X-Forwarded-For`; leave it unset for direct deployments

## Features

- ✅ Real-time multiplayer with Socket.io
- ✅ Room creation with shareable codes
- ✅ Timed drawing with countdown
- ✅ Color picker + brush sizes
- ✅ Anonymous voting
- ✅ Leaderboard with points across rounds
- ✅ Paper/sketchbook aesthetic
- ✅ Mobile touch drawing support
- ✅ Auto-cleanup on disconnect
