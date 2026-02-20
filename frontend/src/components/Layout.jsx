import { Link, useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

const navLinks = [
  { path: '/', label: 'Home', icon: '⊞' },
  { path: '/studio', label: 'Text to Speech', icon: '◎' },
  { path: '/voices', label: 'Voices', icon: '◈' },
  { path: '/history', label: 'History', icon: '◷' },
]

export default function Layout({ children }) {
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()

  const t = {
    sidebar: isDark ? '#111118' : '#f7f7f8',
    sidebarBorder: isDark ? '#222230' : '#e5e5e8',
    sidebarText: isDark ? '#888899' : '#666677',
    activeText: isDark ? '#ffffff' : '#111118',
    activeBg: isDark ? '#222230' : '#ebebed',
    logo: isDark ? '#ffffff' : '#111118',
    main: isDark ? '#0d0d14' : '#ffffff',
    mainText: isDark ? '#e2e8f0' : '#111118',
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Sidebar */}
      <div style={{
        width: '280px', background: t.sidebar,
        borderRight: `1px solid ${t.sidebarBorder}`,
        padding: '1.2rem 0.8rem',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', height: '100vh',
        justifyContent: 'space-between'
      }}>
        {/* Top section */}
        <div>
          {/* Logo */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.4rem 0.8rem', marginBottom: '1.5rem'
          }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px'
            }}>🔊</div>
            <span style={{ color: t.logo, fontWeight: '700', fontSize: '1rem' }}>VoiceForge</span>
          </div>

          {/* Nav Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {navLinks.map(link => {
              const isActive = location.pathname === link.path
              return (
                <Link key={link.path} to={link.path} style={{
                  display: 'flex', alignItems: 'center', gap: '0.7rem',
                  padding: '0.55rem 0.8rem', borderRadius: '8px',
                  textDecoration: 'none',
                  color: isActive ? t.activeText : t.sidebarText,
                  background: isActive ? t.activeBg : 'transparent',
                  fontWeight: isActive ? '600' : '400',
                  fontSize: '0.9rem',
                  transition: 'all 0.15s ease',
                }}>
                  <span style={{ fontSize: '1rem', opacity: 0.8 }}>{link.icon}</span>
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Bottom — theme toggle */}
        <div style={{ padding: '0 0.8rem' }}>
          <button onClick={toggleTheme} style={{
            width: '100%', padding: '0.6rem',
            background: 'transparent',
            border: `1px solid ${t.sidebarBorder}`,
            borderRadius: '8px', cursor: 'pointer',
            color: t.sidebarText, fontSize: '0.85rem',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '0.5rem'
          }}>
            {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        marginLeft: '280px', flex: 1,
        background: t.main, color: t.mainText,
        minHeight: '100vh', padding: '2rem',
      }}>
        {children}
      </div>
    </div>
  )
}