import { createContext, useContext, useState } from 'react'

const ThemeContext = createContext()
const STORAGE_KEY = 'voiceforge_theme'

export function ThemeProvider({ children }) {
  // Read from localStorage on first load — default to dark if nothing saved
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved !== null) return saved === 'dark'
    } catch {}
    return true  // default: dark mode
  })

  function toggleTheme() {
    setIsDark(prev => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
      } catch {}
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}