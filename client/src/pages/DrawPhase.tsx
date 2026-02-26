import { useRef, useState, useEffect, useCallback } from 'react'
import { useGame } from '../hooks/useGame'
import Timer from '../components/Timer'

const COLORS = ['#1a1a1a', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff']
const SIZES = [2, 4, 8, 14]

export default function DrawPhase() {
  const { assignedPrompt, timerEnd, submitDrawing } = useGame()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState('#1a1a1a')
  const [brushSize, setBrushSize] = useState(4)
  const [submitted, setSubmitted] = useState(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
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
    const canvas = canvasRef.current!
    const imageData = canvas.toDataURL('image/png')
    submitDrawing(imageData)
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
      </section>
    )
  }

  return (
    <section className="w-screen h-screen bg-paper-pattern bg-no-repeat bg-cover flex flex-col items-center justify-center p-4 gap-4">
      <Timer timerEnd={timerEnd} />

      <div className="text-center">
        <p className="text-ink-100 text-sm">Draw this:</p>
        <h2 className="font-pacifico text-3xl text-ink-200">"{assignedPrompt}"</h2>
      </div>

      <div className="card p-3">
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          className="rounded-xl cursor-crosshair w-full max-w-[800px] touch-none"
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

      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="flex gap-1">
          {COLORS.map(c => (
            <button
              key={c}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${
                color === c ? 'scale-125 border-ink-200' : 'border-paper-300 hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>

        <div className="flex gap-1 items-center">
          {SIZES.map(s => (
            <button
              key={s}
              className={`rounded-full bg-ink-200 transition-transform ${
                brushSize === s ? 'ring-2 ring-blue-400 scale-110' : 'hover:scale-110'
              }`}
              style={{ width: s + 12, height: s + 12 }}
              onClick={() => setBrushSize(s)}
            />
          ))}
        </div>

        <button className="btn text-sm bg-red-100 text-red-600 hover:bg-red-200" onClick={clearCanvas}>
          🗑️ Clear
        </button>

        <button className="btn-green text-sm" onClick={handleSubmit}>
          ✅ Done
        </button>
      </div>
    </section>
  )
}
