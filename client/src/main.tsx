import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GameProvider } from './context/GameContext'
import './index.css'
import Home from './pages/Home'
import JoinRoom from './pages/JoinRoom'
import Lobby from './pages/Lobby'
import SubmitPrompt from './pages/SubmitPrompt'
import DrawPhase from './pages/DrawPhase'
import Gallery from './pages/Gallery'
import RoundResults from './pages/RoundResults'
import Results from './pages/Results'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <GameProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/join" element={<JoinRoom />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/prompt" element={<SubmitPrompt />} />
          <Route path="/draw" element={<DrawPhase />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/round-results" element={<RoundResults />} />
          <Route path="/results" element={<Results />} />
        </Routes>
      </GameProvider>
    </BrowserRouter>
  </React.StrictMode>
)
