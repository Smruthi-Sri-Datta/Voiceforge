import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { VoicesProvider } from './context/VoicesContext'
import { HistoryProvider } from './context/HistoryContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <VoicesProvider>
          <HistoryProvider>
            <App />
          </HistoryProvider>
        </VoicesProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
)