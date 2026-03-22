import { useState, useRef, useEffect } from 'react'
import { useGame } from '../context/GameContext'
import { socket } from '../socket'

export default function Chat() {
  const { chatMessages, sendChatMessage } = useGame()
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const unreadRef = useRef(0)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      unreadRef.current = 0
      setUnread(0)
    } else {
      unreadRef.current++
      setUnread(unreadRef.current)
    }
  }, [chatMessages, isOpen])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    sendChatMessage(text)
    setInput('')
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-full shadow-lg p-3 touch-manipulation z-50 border border-paper-300"
      >
        💬
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-72 sm:w-80 max-h-[50vh] flex flex-col bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-paper-300 z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-paper-300">
        <span className="font-shadows text-lg text-ink-200">💬 Chat</span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-ink-100 hover:text-ink-200 text-xl leading-none touch-manipulation"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-[120px] max-h-[35vh]">
        {chatMessages.length === 0 && (
          <p className="text-ink-100 text-sm text-center py-4">No messages yet 👋</p>
        )}
        {chatMessages.map((msg) => {
          const isMe = msg.playerId === socket.id
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              <div
                className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs"
                style={{ backgroundColor: msg.color }}
              >
                {msg.avatar || msg.nickname.charAt(0).toUpperCase()}
              </div>
              <div className={`max-w-[75%] ${isMe ? 'text-right' : ''}`}>
                {!isMe && (
                  <p className="text-xs text-ink-100 mb-0.5">{msg.nickname}</p>
                )}
                <p className={`text-sm px-3 py-1.5 rounded-xl inline-block ${
                  isMe ? 'bg-blue-100 text-ink-200' : 'bg-paper-200 text-ink-200'
                }`}>
                  {msg.message}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2 px-3 py-2 border-t border-paper-300">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          maxLength={200}
          className="flex-1 bg-paper-200 rounded-xl px-3 py-2 text-sm text-ink-200 placeholder-ink-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
          style={{ fontSize: '16px' }}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="bg-blue-400 text-white rounded-xl px-3 py-2 text-sm font-bold touch-manipulation disabled:opacity-40"
        >
          ➤
        </button>
      </form>
    </div>
  )
}
