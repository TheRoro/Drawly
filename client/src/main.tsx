import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Home from './pages/Home'
import JoinRoom from './pages/JoinRoom'
import Lobby from './pages/Lobby'
import SubmitPrompt from './pages/SubmitPrompt'
import DrawPhase from './pages/DrawPhase'
import Gallery from './pages/Gallery'
import Results from './pages/Results'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join" element={<JoinRoom />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/prompt" element={<SubmitPrompt />} />
        <Route path="/draw" element={<DrawPhase />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
