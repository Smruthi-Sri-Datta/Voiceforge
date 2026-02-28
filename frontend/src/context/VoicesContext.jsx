import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'https://voiceforge-4v8l.onrender.com'

const DEFAULT_VOICES = [
  { name: "Ana Florence",    color: "#f97316", type: "default" },
  { name: "Claribel Dervla", color: "#a855f7", type: "default" },
  { name: "Daisy Studious",  color: "#3b82f6", type: "default" },
  { name: "Gracie Wise",     color: "#10b981", type: "default" },
]

const VoicesContext = createContext()

export function VoicesProvider({ children }) {
  const { user, authFetch } = useAuth()
  const [clonedVoices, setClonedVoices] = useState([])
  const [loading, setLoading] = useState(false)

    // Add this inside VoicesProvider, before the useEffect
    useEffect(() => {
    localStorage.removeItem('voiceforge_cloned_voices')
    localStorage.removeItem('voiceforge_tts_history')
    }, [])

  useEffect(() => {
    if (!user) {
      setClonedVoices([])
      return
    }
    fetchVoices()
  }, [user])

  async function fetchVoices() {
    setLoading(true)
    try {
      const res = await authFetch(`${BACKEND}/api/my-voices`)
      if (!res.ok) return
      const data = await res.json()
      const voices = data.voices.map(v => ({
        name:      v.name,
        voice_id:  v.voice_id,
        audio_url: v.audio_url,   // ← add this
        color:     "#7c3aed",
        type:      "custom",
      }))
      setClonedVoices(voices)
    } catch (err) {
      console.error("Failed to fetch voices:", err)
    } finally {
      setLoading(false)
    }
  }

  function addClonedVoice(voice) {
    setClonedVoices(prev => [...prev, voice])
  }

  async function removeClonedVoice(voiceId) {
  try {
    await authFetch(`${BACKEND}/api/my-voices/${voiceId}`, { method: 'DELETE' })
  } catch (err) {
    console.error("Failed to delete voice:", err)
  }
  setClonedVoices(prev => prev.filter(v => v.voice_id !== voiceId))
}

  const allVoices = [...DEFAULT_VOICES, ...clonedVoices]

  return (
    <VoicesContext.Provider value={{
      allVoices,
      clonedVoices,
      addClonedVoice,
      removeClonedVoice,
      refreshVoices: fetchVoices,
      DEFAULT_VOICES,
      loading
    }}>
      {children}
    </VoicesContext.Provider>
  )
}

export function useVoices() {
  return useContext(VoicesContext)
}