import { createContext, useContext, useState } from 'react'

const DEFAULT_VOICES = [
  { name: "Ana Florence", color: "#f97316", type: "default" },
  { name: "Claribel Dervla", color: "#a855f7", type: "default" },
  { name: "Daisy Studious", color: "#3b82f6", type: "default" },
  { name: "Gracie Wise", color: "#10b981", type: "default" },
]

const STORAGE_KEY = "voiceforge_cloned_voices"

function loadFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

function saveToStorage(voices) {
  try {
    // Don't save previewUrl — it's a blob URL, invalid after refresh
    const toSave = voices.map(({ previewUrl, ...rest }) => rest)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch {
    console.warn("Could not save voices to localStorage")
  }
}

const VoicesContext = createContext()

export function VoicesProvider({ children }) {
  // Initialize from localStorage on first load
  const [clonedVoices, setClonedVoices] = useState(() => loadFromStorage())

  function addClonedVoice(voice) {
    setClonedVoices(prev => {
      const updated = [...prev, voice]
      saveToStorage(updated)   // persist immediately
      return updated
    })
  }

  function removeClonedVoice(voiceName) {
    setClonedVoices(prev => {
      const updated = prev.filter(v => v.name !== voiceName)
      saveToStorage(updated)
      return updated
    })
  }

  const allVoices = [...DEFAULT_VOICES, ...clonedVoices]

  return (
    <VoicesContext.Provider value={{
      allVoices,
      clonedVoices,
      addClonedVoice,
      removeClonedVoice,
      DEFAULT_VOICES
    }}>
      {children}
    </VoicesContext.Provider>
  )
}

export function useVoices() {
  return useContext(VoicesContext)
}