import { useRef, useState, useEffect, useCallback } from 'react'
import { useGame } from '../context/GameContext'
import { socket } from '../socket'
import Timer from '../components/Timer'
import Chat from '../components/Chat'

const COLORS = ['#1a1a1a', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff']
const SIZES = [2, 4, 8, 14]

export default function DrawPhase() {
  const { assignedPrompt, timerEnd, submitDrawing, drawingRound, totalRounds } = useGame()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState('#1a1a1a')
  const [brushSize, setBrushSize] = useState(4)
  const [submitted, setSubmitted] = useState(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  // Prevent page scroll/bounce while touching the canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const prevent = (e: TouchEvent) => e.preventDefault()
    canvas.addEventListener('touchmove', prevent, { passive: false })
    canvas.addEventListener('touchstart', prevent, { passive: false })
    return () => {
      canvas.removeEventListener('touchmove', prevent)
      canvas.removeEventListener('touchstart', prevent)
    }
  }, [])

  // Auto-submit when timer expires
  useEffect(() => {
    if (!timerEnd || submitted) return
    const remaining = timerEnd - Date.now()
    if (remaining <= 0) return
    const timer = setTimeout(() => {
      if (!submittedRef.current && canvasRef.current) {
        const imageData = canvasRef.current.toDataURL('image/png')
        submitDrawing(imageData)
        submittedRef.current = true
        setSubmitted(true)
      }
    }, remaining)
    return () => clearTimeout(timer)
  }, [timerEnd, submitted, submitDrawing])

  // Respond to server snapshot requests (for spy mode)
  useEffect(() => {
    const handleSnapshotRequest = () => {
      if (submittedRef.current || !canvasRef.current) return
      const imageData = canvasRef.current.toDataURL('image/png')
      socket.emit('snapshot', { imageData })
    }
    socket.on('request-snapshot', handleSnapshotRequest)
    return () => { socket.off('request-snapshot', handleSnapshotRequest) }
  }, [])

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }, [])

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true)
    lastPos.current = getPos(e)
  }, [getPos])

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !lastPos.current) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e)

    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()

    lastPos.current = pos
  }, [isDrawing, color, brushSize, getPos])

  const stopDraw = useCallback(() => {
    setIsDrawing(false)
    lastPos.current = null
  }, [])

  const clearCanvas = () => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const handleSubmit = () => {
    if (submittedRef.current) return
    const canvas = canvasRef.current!
    const imageData = canvas.toDataURL('image/png')
    submitDrawing(imageData)
    submittedRef.current = true
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <section className="w-screen h-screen bg-paper-pattern bg-no-repeat bg-cover flex flex-col items-center justify-center p-6">
        <div className="card text-center animate-bounce-in">
          <p className="text-4xl mb-4">🎨</p>
          <p className="text-xl font-medium text-ink-200">Drawing submitted!</p>
          <p className="text-ink-100 mt-2">Waiting for other artists...</p>
        </div>
        <Chat />
      </section>
    )
  }

  return (
    <section className="w-screen h-[100dvh] bg-paper-pattern bg-no-repeat bg-cover flex flex-col items-center justify-center p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden">
      <Timer timerEnd={timerEnd} />

      <div className="text-center">
        <p className="text-ink-100 text-sm">Round {drawingRound} of {totalRounds} · Draw this:</p>
        <h2 className="font-pacifico text-2xl sm:text-3xl text-ink-200">"{assignedPrompt}"</h2>
      </div>

      <div className="card p-2 sm:p-3 flex-1 min-h-0 w-full max-w-[800px]">
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          className="rounded-xl cursor-crosshair w-full h-full touch-none select-none"
          style={{ aspectRatio: '2/1' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>

      {/* Toolbar — bigger touch targets on mobile */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full max-w-[800px]">
        <div className="flex gap-1.5 sm:gap-1">
          {COLORS.map(c => (
            <button
              key={c}
              className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full border-2 transition-transform touch-manipulation ${
                color === c ? 'scale-125 border-ink-200' : 'border-paper-300'
              }`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>

        <div className="flex gap-1.5 sm:gap-1 items-center">
          {SIZES.map(s => (
            <button
              key={s}
              className={`rounded-full bg-ink-200 transition-transform touch-manipulation ${
                brushSize === s ? 'ring-2 ring-blue-400 scale-110' : ''
              }`}
              style={{ width: Math.max(s + 16, 28), height: Math.max(s + 16, 28) }}
              onClick={() => setBrushSize(s)}
            />
          ))}
        </div>

        <button className="btn text-sm bg-red-100 text-red-600 active:bg-red-200 px-4 py-2" onClick={clearCanvas}>
          🗑️ Clear
        </button>

        <button className="btn-green text-sm px-4 py-2" onClick={handleSubmit}>
          ✅ Done
        </button>
      </div>
    </section>
  )
}
