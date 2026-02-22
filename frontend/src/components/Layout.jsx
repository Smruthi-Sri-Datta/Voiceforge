import { Link, useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

const navLinks = [
  { path: '/',        label: 'Home',           icon: '⊞' },
  { path: '/studio',  label: 'Text to Speech', icon: '◎' },
  { path: '/voices',  label: 'Voices',         icon: '◈' },
  { path: '/history', label: 'History',        icon: '◷' },
]

export default function Layout({ children }) {
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()
  const { user, isAuthenticated, openAuthModal, logout, guestCredits } = useAuth()

  const t = {
    sidebar:       isDark ? '#111118' : '#f7f7f8',
    sidebarBorder: isDark ? '#222230' : '#e5e5e8',
    sidebarText:   isDark ? '#888899' : '#666677',
    activeText:    isDark ? '#ffffff' : '#111118',
    activeBg:      isDark ? '#222230' : '#ebebed',
    logo:          isDark ? '#ffffff' : '#111118',
    main:          isDark ? '#0d0d14' : '#ffffff',
    mainText:      isDark ? '#e2e8f0' : '#111118',
    topBarBorder:  isDark ? '#1e1e2e' : '#eeeeee',
    toggleBg:      isDark ? '#1e1e2e' : '#f0f0f5',
    toggleBorder:  isDark ? '#2a2a4a' : '#e0e0e8',
    toggleColor:   isDark ? '#888899' : '#666677',
    labelColor:    isDark ? '#666'    : '#999',
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: '220px', background: t.sidebar,
        borderRight: `1px solid ${t.sidebarBorder}`,
        padding: '1.2rem 0.8rem',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', height: '100vh',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.8rem', marginBottom: '1.5rem' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🔊</div>
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
                fontSize: '0.9rem', transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = t.activeBg }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: '1rem', opacity: 0.8 }}>{link.icon}</span>
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* ── Guest credit indicator (only for guests) ── */}
        {!isAuthenticated && (
          <div style={{
            marginTop: 'auto', padding: '0.75rem 0.8rem',
            background: isDark ? '#13131f' : '#f4f4f8',
            border: `1px solid ${t.sidebarBorder}`,
            borderRadius: '10px',
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: '700', color: t.labelColor, letterSpacing: '0.4px', marginBottom: '0.5rem' }}>
              FREE CREDITS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: t.sidebarText }}>⚡ TTS</span>
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: guestCredits.tts > 0 ? '#a78bfa' : '#ef4444' }}>
                  {guestCredits.tts} left
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: t.sidebarText }}>🎙️ Clone</span>
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: guestCredits.clone > 0 ? '#a78bfa' : '#ef4444' }}>
                  {guestCredits.clone} left
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Main Content ── */}
      <div style={{ marginLeft: '220px', flex: 1, background: t.main, color: t.mainText, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* ── Top bar ── */}
        <div style={{
          height: '48px', borderBottom: `1px solid ${t.topBarBorder}`,
          display: 'flex', alignItems: 'center',
          justifyContent: 'flex-end', padding: '0 1.5rem',
          gap: '0.75rem', flexShrink: 0,
        }}>

          {/* Theme toggle */}
          <button onClick={toggleTheme} title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{ width: '34px', height: '34px', borderRadius: '8px', background: t.toggleBg, border: `1px solid ${t.toggleBorder}`, color: t.toggleColor, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', transition: 'all 0.15s ease' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed55'; e.currentTarget.style.color = '#a78bfa' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.toggleBorder; e.currentTarget.style.color = t.toggleColor }}
          >
            {isDark ? '☀️' : '🌙'}
          </button>

          {/* ── Logged IN: avatar + name + logout ── */}
          {isAuthenticated && user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {user.picture ? (
                <img src={user.picture} alt={user.name}
                  style={{ width: '30px', height: '30px', borderRadius: '50%', border: '2px solid #7c3aed44', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '0.8rem' }}>
                  {user.name?.[0]}
                </div>
              )}
              <span style={{ fontSize: '0.84rem', fontWeight: '600', color: t.mainText }}>
                {user.name?.split(' ')[0]}
              </span>
              <button onClick={logout}
                style={{ padding: '0.3rem 0.75rem', borderRadius: '6px', border: `1px solid ${t.toggleBorder}`, background: 'transparent', color: t.labelColor, fontSize: '0.78rem', cursor: 'pointer', fontFamily: "'Segoe UI', sans-serif", transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef444455'; e.currentTarget.style.color = '#ef4444' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.toggleBorder; e.currentTarget.style.color = t.labelColor }}
              >
                Sign out
              </button>
            </div>
          ) : (
            /* ── Guest: Login button ── */
            <button onClick={() => openAuthModal()}
              style={{
                padding: '0.4rem 1.1rem', borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                color: 'white', fontSize: '0.82rem', fontWeight: '700',
                cursor: 'pointer', fontFamily: "'Segoe UI', sans-serif",
                boxShadow: '0 2px 10px rgba(124,58,237,0.25)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,58,237,0.4)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 10px rgba(124,58,237,0.25)'}
            >
              Sign in
            </button>
          )}
        </div>

        {/* ── Page content ── */}
        <div style={{ flex: 1, padding: '2rem' }}>
          {children}
        </div>
      </div>
    </div>
  )
}