import { useState, FormEvent } from 'react'
import { useGame } from '../context/GameContext'
import Timer from '../components/Timer'
import { getRandomPrompts } from '../data/promptSuggestions'

export default function SubmitPrompt() {
  const { submitPrompt, timerEnd } = useGame()
  const [prompt, setPrompt] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>(() => getRandomPrompts(3))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return
    submitPrompt(prompt.trim())
    setSubmitted(true)
  }

  const shuffleSuggestions = () => {
    setSuggestions(getRandomPrompts(3, [prompt.trim()]))
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

            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-ink-100 text-sm font-medium">💡 Need ideas? Tap one:</p>
                <button
                  type="button"
                  onClick={shuffleSuggestions}
                  className="text-xs px-2 py-1 bg-paper-200 hover:bg-paper-300 text-ink-100 rounded-full transition-colors"
                >
                  🎲 Shuffle
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPrompt(s)}
                    className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                      prompt === s
                        ? 'bg-orange-100 border-orange-300 text-orange-700'
                        : 'bg-paper-200 border-transparent text-ink-200 hover:bg-paper-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
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
