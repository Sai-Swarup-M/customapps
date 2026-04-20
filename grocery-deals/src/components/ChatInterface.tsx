'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Message = { role: 'user' | 'assistant'; content: string }

const QUICK_QUERIES = [
  'Top 3 best deals this week',
  'Best price for basmati rice',
  'Which store has the cheapest produce?',
  'Best deal on lentils',
]

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text: string) {
    if (!text.trim() || loading) return
    const userMsg: Message = { role: 'user', content: text }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages }),
      })
      const data = await res.json()
      setMessages((m) => [...m, { role: 'assistant', content: data.answer }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 && (
        <div className="p-4">
          <p className="text-sm text-gray-500 mb-3">Try asking:</p>
          <div className="flex flex-col gap-2">
            {QUICK_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="text-left text-sm bg-green-50 text-green-800 rounded-xl px-4 py-2 hover:bg-green-100 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm ${
                m.role === 'user'
                  ? 'bg-green-600 text-white rounded-br-sm'
                  : 'bg-white border border-gray-100 shadow-sm text-gray-900 rounded-bl-sm'
              }`}
            >
              {m.role === 'user' ? (
                <p>{m.content}</p>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h3: ({ children }) => (
                      <h3 className="font-bold text-base text-gray-900 mt-3 mb-2 first:mt-0">{children}</h3>
                    ),
                    h4: ({ children }) => (
                      <h4 className="font-semibold text-sm text-gray-800 mt-2 mb-1">{children}</h4>
                    ),
                    p: ({ children }) => (
                      <p className="text-sm text-gray-700 mb-2 last:mb-0 leading-relaxed">{children}</p>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-gray-900">{children}</strong>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-none space-y-1 mb-2">{children}</ul>
                    ),
                    li: ({ children }) => (
                      <li className="text-sm text-gray-700 flex gap-2">
                        <span className="text-green-500 mt-0.5">•</span>
                        <span>{children}</span>
                      </li>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-2 rounded-lg border border-gray-100">
                        <table className="w-full text-xs">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-green-50">{children}</thead>
                    ),
                    th: ({ children }) => (
                      <th className="px-3 py-2 text-left font-semibold text-green-800 whitespace-nowrap">{children}</th>
                    ),
                    td: ({ children }) => (
                      <td className="px-3 py-2 text-gray-700 border-t border-gray-50">{children}</td>
                    ),
                    hr: () => <hr className="border-gray-100 my-3" />,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-green-300 pl-3 text-gray-500 italic text-xs my-2">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {m.content}
                </ReactMarkdown>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-100 p-3 bg-white">
        <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about deals..."
            className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:border-green-400"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="bg-green-600 text-white rounded-full w-9 h-9 flex items-center justify-center disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
