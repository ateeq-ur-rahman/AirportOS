import { useEffect, useRef, useState, useCallback } from "react"

export interface LiveEvent {
  type: string
  data: any
  published_at: string
}

/**
 * Connects to /ws/live and keeps a rolling buffer of recent events plus a
 * `lastEvent` pointer, with automatic reconnect (capped backoff) so a
 * dropped connection during a demo silently recovers.
 */
export function useLiveEvents(maxBuffer = 100) {
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<LiveEvent | null>(null)
  const [events, setEvents] = useState<LiveEvent[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef(1000)

  const connect = useCallback(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/live`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      retryRef.current = 1000
    }
    ws.onmessage = (msg) => {
      try {
        const evt: LiveEvent = JSON.parse(msg.data)
        setLastEvent(evt)
        setEvents((prev) => [evt, ...prev].slice(0, maxBuffer))
      } catch {
        /* ignore malformed frame */
      }
    }
    ws.onclose = () => {
      setConnected(false)
      setTimeout(connect, retryRef.current)
      retryRef.current = Math.min(retryRef.current * 1.5, 15000)
    }
    ws.onerror = () => ws.close()
  }, [maxBuffer])

  useEffect(() => {
    connect()
    return () => wsRef.current?.close()
  }, [connect])

  return { connected, lastEvent, events }
}
