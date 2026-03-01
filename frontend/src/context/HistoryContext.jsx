import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
const HistoryContext = createContext()

export function HistoryProvider({ children }) {
  const { user, authFetch } = useAuth()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) { setHistory([]); return }
    fetchHistory()
  }, [user])

  async function fetchHistory() {
    setLoading(true)
    try {
      const res = await authFetch(`${BACKEND}/api/my-history`)
      if (!res.ok) return
      const data = await res.json()
      const entries = data.generations.map(g => ({
        id:        g.id,
        text:      g.text,
        language:  g.language,
        speed:     g.speed,
        voice:     { name: g.speaker, color: '#7c3aed' },
        audioUrl:  g.audio_url,   // ← fixed: no backticks, no healing logic
        timestamp: g.created_at,
      }))
      setHistory(entries)
    } catch (err) {
      console.error("Failed to fetch history:", err)
    } finally {
      setLoading(false)
    }
  }

  function addHistoryEntry(entry) {
    const newEntry = {
      id:        entry.id || Date.now().toString(),
      text:      entry.text,
      voice:     entry.voice,
      language:  entry.language,
      speed:     entry.speed,
      audioUrl:  entry.audioUrl,
      timestamp: new Date().toISOString(),
    }
    setHistory(prev => [newEntry, ...prev])
  }

  async function removeHistoryEntry(id) {
    try {
      await authFetch(`${BACKEND}/api/my-history/${id}`, { method: 'DELETE' })
    } catch (err) {
      console.error("Failed to delete generation:", err)
    }
    setHistory(prev => prev.filter(e => e.id !== id))
  }

  async function clearHistory() {
    try {
      await authFetch(`${BACKEND}/api/my-history`, { method: 'DELETE' })
    } catch (err) {
      console.error("Failed to clear history:", err)
    }
    setHistory([])
  }

  return (
    <HistoryContext.Provider value={{
      history, addHistoryEntry, removeHistoryEntry,
      clearHistory, refreshHistory: fetchHistory, loading,
    }}>
      {children}
    </HistoryContext.Provider>
  )
}

export function useHistory() {
  return useContext(HistoryContext)
}