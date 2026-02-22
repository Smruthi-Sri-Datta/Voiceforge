import { createContext, useContext, useState } from 'react'

const STORAGE_KEY = "voiceforge_tts_history"

function loadFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function saveToStorage(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    console.warn("Could not save history to localStorage")
  }
}

const HistoryContext = createContext()

export function HistoryProvider({ children }) {
  const [history, setHistory] = useState(() => loadFromStorage())

  function addHistoryEntry(entry) {
    const newEntry = {
      id: Date.now(),                              // unique id
      text: entry.text,                            // what was typed
      voice: entry.voice,                          // voice name + color
      language: entry.language,                    // language code
      speed: entry.speed,                          // speed value
      audioUrl: entry.audioUrl,                    // url to replay
      timestamp: new Date().toISOString(),         // when it was generated
      duration: entry.duration || null,            // audio duration (optional)
    }
    setHistory(prev => {
      const updated = [newEntry, ...prev]          // newest first
      saveToStorage(updated)
      return updated
    })
  }

  function removeHistoryEntry(id) {
    setHistory(prev => {
      const updated = prev.filter(e => e.id !== id)
      saveToStorage(updated)
      return updated
    })
  }

  function clearHistory() {
    setHistory([])
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <HistoryContext.Provider value={{
      history,
      addHistoryEntry,
      removeHistoryEntry,
      clearHistory,
    }}>
      {children}
    </HistoryContext.Provider>
  )
}

export function useHistory() {
  return useContext(HistoryContext)
}