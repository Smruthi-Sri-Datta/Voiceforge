import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

const HistoryContext = createContext()

export function HistoryProvider({ children }) {
  const { user, authFetch } = useAuth()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setHistory([])
      return
    }
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
        voice:     { name: g.speaker, color: "#7c3aed" },
        audioUrl:  `${BACKEND}/api/audio/${g.file}`,
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
    // Optimistically add to local state — DB already saved via backend
    const newEntry = {
      id:        entry.id || Date.now().toString(),
      text:      entry.text,
      voice:     entry.voice,
      language:  entry.language,
      speed:     entry.speed,
      audioUrl:  entry.audioUrl,
      timestamp: new Date().toISOString(),
      duration:  entry.duration || null,
    }
    setHistory(prev => [newEntry, ...prev])
  }

  function removeHistoryEntry(id) {
    setHistory(prev => prev.filter(e => e.id !== id))
  }

  function clearHistory() {
    setHistory([])
  }

  return (
    <HistoryContext.Provider value={{
      history,
      addHistoryEntry,
      removeHistoryEntry,
      clearHistory,
      refreshHistory: fetchHistory,
      loading,
    }}>
      {children}
    </HistoryContext.Provider>
  )
}

export function useHistory() {
  return useContext(HistoryContext)
}