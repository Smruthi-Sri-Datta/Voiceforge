import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Studio from './pages/Studio'
import Voices from './pages/Voices'
import History from './pages/History'
import Home from './pages/Home'
import Login from './pages/Login'
import AuthModal from './components/AuthModal'

function App() {
  const { authModalOpen, authModalReason } = useAuth()

  return (
    <BrowserRouter>
      {/* Global auth modal — rendered above everything, triggered from any page */}
      {authModalOpen && <AuthModal reason={authModalReason} />}

      <Routes>
        {/* Standalone login page (used if user navigates directly) */}
        <Route path="/login" element={<Login />} />

        {/* All app routes are public — no forced redirect */}
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/"        element={<Home />} />
              <Route path="/studio"  element={<Studio />} />
              <Route path="/voices"  element={<Voices />} />
              <Route path="/history" element={<History />} />
              <Route path="*"        element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </BrowserRouter>
  )
}

export default App