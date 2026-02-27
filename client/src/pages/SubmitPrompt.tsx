import { useState, FormEvent } from 'react'
import { useGame } from '../context/GameContext'
import Timer from '../components/Timer'

export default function SubmitPrompt() {
  const { submitPrompt, timerEnd } = useGame()
  const [prompt, setPrompt] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return
    submitPrompt(prompt.trim())
    setSubmitted(true)
  }

  return (
    <section className="w-screen h-screen bg-paper-pattern bg-no-repeat bg-cover flex flex-col items-center justify-center p-6">
      <Timer timerEnd={timerEnd} />

      <div className="card max-w-md w-full animate-slide-up">
        <h2 className="font-pacifico text-4xl text-ink-200 text-center mb-2">
          ✍️ Write a Prompt
        </h2>
        <p className="text-ink-100 text-center mb-6">
          What should someone draw? Be creative!
        </p>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              className="input-field text-center text-xl"
              type="text"
              placeholder="e.g. A cat riding a unicorn"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={50}
              autoFocus
            />
            <button type="submit" className="btn-orange">
              Submit Prompt
            </button>
          </form>
        ) : (
          <div className="text-center animate-bounce-in">
            <p className="text-4xl mb-4">✅</p>
            <p className="text-xl text-ink-200 font-medium">Prompt submitted!</p>
            <p className="text-ink-100 mt-2">Waiting for other players...</p>
          </div>
        )}
      </div>
    </section>
  )
}
