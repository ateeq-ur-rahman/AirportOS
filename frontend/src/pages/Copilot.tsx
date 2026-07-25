import { useEffect, useRef, useState } from "react"
import { Send, Bot, User as UserIcon, Sparkles } from "lucide-react"
import { api } from "../api/client"
import type { ChatMessage } from "../types"

const SUGGESTIONS = [
  "What's the current operational status?",
  "Why is the top plan recommended?",
  "Compare the recovery plans",
  "Show passenger impact",
  "Show gate utilization",
  "Explain the confidence score",
  "Generate a recovery report",
]

export default function Copilot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "AOCC Copilot online. Ask me about live flight status, disruptions, or recovery recommendations.", ts: Date.now() },
  ])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  async function send(text: string) {
    if (!text.trim() || sending) return
    setInput("")
    setMessages((m) => [...m, { role: "user", content: text, ts: Date.now() }])
    setSending(true)
    try {
      const res = await api.chat(text)
      setMessages((m) => [...m, { role: "assistant", content: res.content, ts: Date.now() }])
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Sorry — I couldn't reach the copilot service. Please try again.", ts: Date.now() }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col p-6">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-ink">
          <Sparkles size={20} className="text-cyan" /> AOCC Copilot
        </h1>
        <p className="mt-1 text-sm text-ink-dim">Conversational access to live operations, disruptions, and recovery recommendations.</p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-hairline bg-panel p-5">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-blue/15 text-blue" : "bg-cyan/15 text-cyan"}`}>
              {m.role === "user" ? <UserIcon size={15} /> : <Bot size={15} />}
            </div>
            <div className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-blue/10 text-ink" : "bg-raised text-ink"}`}>
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan/15 text-cyan"><Bot size={15} /></div>
            <div className="rounded-xl bg-raised px-4 py-2.5 text-sm text-ink-dim">Thinking…</div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)} className="rounded-full border border-hairline bg-panel px-3 py-1.5 text-xs text-ink-dim hover:border-cyan/30 hover:text-cyan">
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input) }}
        className="mt-3 flex items-center gap-2 rounded-xl border border-hairline bg-panel p-2"
      >
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the copilot…"
          className="flex-1 bg-transparent px-2 py-2 text-sm text-ink outline-none placeholder:text-ink-dim"
        />
        <button type="submit" disabled={sending} className="rounded-lg bg-cyan p-2.5 text-void hover:bg-cyan/90 disabled:opacity-50">
          <Send size={15} />
        </button>
      </form>
    </div>
  )
}
