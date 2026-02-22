import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useVoices } from '../context/VoicesContext'
import { useHistory } from '../context/HistoryContext'

const LANGUAGE_NAMES = {
  en: 'English', hi: 'Hindi', fr: 'French',
  de: 'German', es: 'Spanish', ja: 'Japanese', 'zh-cn': 'Chinese',
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function truncate(text, max = 60) {
  return text.length > max ? text.slice(0, max) + '...' : text
}

// ── Quick action cards data ──────────────────────────────────
const QUICK_ACTIONS = [
  {
    icon: '⚡',
    label: 'Text to Speech',
    desc: 'Turn any text into lifelike audio',
    route: '/studio',
    gradient: 'linear-gradient(135deg, #7c3aed22, #a855f722)',
    iconBg: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    border: '#7c3aed33',
  },
  {
    icon: '🎙️',
    label: 'Clone a Voice',
    desc: 'Upload a sample and clone any voice',
    route: '/voices',
    gradient: 'linear-gradient(135deg, #0ea5e922, #38bdf822)',
    iconBg: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
    border: '#0ea5e933',
  },
  {
    icon: '🕑',
    label: 'History',
    desc: 'Browse and replay past generations',
    route: '/history',
    gradient: 'linear-gradient(135deg, #f59e0b22, #fbbf2422)',
    iconBg: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
    border: '#f59e0b33',
  },
]

function Home() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { clonedVoices, DEFAULT_VOICES } = useVoices()
  const { history } = useHistory()

  const t = {
    bg:          isDark ? '#0d0d14' : '#f8f8fc',
    cardBg:      isDark ? '#13131f' : '#ffffff',
    cardBorder:  isDark ? '#1e1e2e' : '#e8e8ec',
    cardHover:   isDark ? '#1a1a2e' : '#f0ecff',
    textColor:   isDark ? '#e2e8f0' : '#111118',
    labelColor:  isDark ? '#666'    : '#999',
    labelMid:    isDark ? '#888'    : '#555',
    divider:     isDark ? '#1e1e2e' : '#eeeeee',
    rowBg:       isDark ? '#13131f' : '#f9f9f9',
    rowBorder:   isDark ? '#1e1e2e' : '#e8e8ec',
    rowHover:    isDark ? '#1a1a2e' : '#f3f3f3',
    statBg:      isDark ? '#0f0f1a' : '#f4f4f8',
  }

  // ── Derived stats ────────────────────────────────────────────
  const totalGenerations = history.length
  const totalCloned      = clonedVoices.length
  const languagesUsed    = [...new Set(history.map(e => e.language))].length
  const recentHistory    = history.slice(0, 4)

  const STATS = [
    { label: 'Generations', value: totalGenerations, icon: '⚡', color: '#a78bfa' },
    { label: 'Cloned Voices', value: totalCloned,   icon: '🎙️', color: '#38bdf8' },
    { label: 'Languages',    value: languagesUsed,  icon: '🌍', color: '#34d399' },
    { label: 'Default Voices', value: DEFAULT_VOICES.length, icon: '🎤', color: '#f59e0b' },
  ]

  return (
    <div style={{
      minHeight: 'calc(100vh - 4rem)',
      margin: '-2rem',
      background: t.bg,
      overflowY: 'auto',
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '3rem 3rem 4rem' }}>

        {/* ── GREETING ─────────────────────────────────────────── */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: t.labelColor, letterSpacing: '0.5px', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
            VoiceForge Workspace
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: t.textColor, lineHeight: '1.2' }}>
            {getGreeting()} 👋
          </div>
          <div style={{ fontSize: '0.9rem', color: t.labelMid, marginTop: '0.4rem' }}>
            What would you like to create today?
          </div>
        </div>

        {/* ── QUICK ACTION CARDS ───────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}>
          {QUICK_ACTIONS.map((action) => (
            <div
              key={action.label}
              onClick={() => navigate(action.route)}
              style={{
                background: t.cardBg,
                border: `1px solid ${t.cardBorder}`,
                borderRadius: '16px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.border = `1px solid ${action.border}`
                e.currentTarget.style.background = isDark ? '#1a1a2e' : '#faf8ff'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = isDark
                  ? '0 8px 32px rgba(0,0,0,0.3)'
                  : '0 8px 32px rgba(124,58,237,0.08)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.border = `1px solid ${t.cardBorder}`
                e.currentTarget.style.background = t.cardBg
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {/* Icon */}
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: action.iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.3rem', marginBottom: '1rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}>
                {action.icon}
              </div>
              <div style={{ fontWeight: '700', fontSize: '0.95rem', color: t.textColor, marginBottom: '0.3rem' }}>
                {action.label}
              </div>
              <div style={{ fontSize: '0.8rem', color: t.labelColor, lineHeight: '1.5' }}>
                {action.desc}
              </div>
              {/* Arrow */}
              <div style={{
                position: 'absolute', top: '1.5rem', right: '1.5rem',
                color: t.labelColor, fontSize: '1rem',
              }}>
                ›
              </div>
            </div>
          ))}
        </div>

        {/* ── STATS ROW ────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '2.5rem' }}>
          {STATS.map((stat) => (
            <div key={stat.label} style={{
              background: t.statBg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: '12px',
              padding: '1rem 1.2rem',
              display: 'flex', alignItems: 'center', gap: '0.8rem',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: `${stat.color}18`,
                border: `1px solid ${stat.color}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', flexShrink: 0,
              }}>
                {stat.icon}
              </div>
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: '700', color: t.textColor, lineHeight: '1' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '0.72rem', color: t.labelColor, marginTop: '0.2rem' }}>
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── BOTTOM TWO-COLUMN SECTION ────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

          {/* ── Recent Generations ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: '700', color: t.textColor }}>
                Recent Generations
              </div>
              {history.length > 0 && (
                <button
                  onClick={() => navigate('/history')}
                  style={{
                    background: 'transparent', border: 'none',
                    color: '#a78bfa', fontSize: '0.78rem',
                    cursor: 'pointer', fontWeight: '600',
                    fontFamily: "'Segoe UI', sans-serif",
                  }}>
                  View all →
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recentHistory.length === 0 ? (
                <div style={{
                  background: t.cardBg, border: `1px solid ${t.cardBorder}`,
                  borderRadius: '12px', padding: '2.5rem 1rem',
                  textAlign: 'center', color: t.labelColor,
                }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>⚡</div>
                  <div style={{ fontSize: '0.82rem' }}>No generations yet.</div>
                  <button
                    onClick={() => navigate('/studio')}
                    style={{
                      marginTop: '0.8rem', padding: '0.45rem 1rem',
                      background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                      border: 'none', borderRadius: '20px',
                      color: 'white', fontSize: '0.78rem',
                      fontWeight: '600', cursor: 'pointer',
                      fontFamily: "'Segoe UI', sans-serif",
                    }}>
                    Generate audio
                  </button>
                </div>
              ) : (
                recentHistory.map(entry => (
                  <div
                    key={entry.id}
                    onClick={() => navigate('/history')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.8rem 1rem',
                      background: t.cardBg,
                      border: `1px solid ${t.cardBorder}`,
                      borderRadius: '10px', cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = t.rowHover
                      e.currentTarget.style.borderColor = '#7c3aed33'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = t.cardBg
                      e.currentTarget.style.borderColor = t.cardBorder
                    }}
                  >
                    {/* Voice avatar */}
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                      background: `radial-gradient(circle at 35% 35%, ${entry.voice?.color}cc, ${entry.voice?.color}44)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: '700', fontSize: '0.78rem',
                    }}>
                      {entry.voice?.name[0]}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.84rem', color: t.textColor, fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {truncate(entry.text)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: t.labelColor, marginTop: '0.15rem' }}>
                        {entry.voice?.name} · {LANGUAGE_NAMES[entry.language] || entry.language} · {formatDate(entry.timestamp)}
                      </div>
                    </div>

                    {/* Audio squiggle indicator */}
                    <div style={{ color: '#a78bfa', fontSize: '0.85rem', flexShrink: 0 }}>🔊</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Your Voices ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: '700', color: t.textColor }}>
                Your Voices
              </div>
              <button
                onClick={() => navigate('/voices')}
                style={{
                  background: 'transparent', border: 'none',
                  color: '#a78bfa', fontSize: '0.78rem',
                  cursor: 'pointer', fontWeight: '600',
                  fontFamily: "'Segoe UI', sans-serif",
                }}>
                Manage →
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

              {/* Cloned voices first */}
              {clonedVoices.slice(0, 2).map((v, i) => (
                <div key={i}
                  onClick={() => navigate('/voices')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.8rem 1rem',
                    background: t.cardBg, border: `1px solid ${t.cardBorder}`,
                    borderRadius: '10px', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = t.rowHover
                    e.currentTarget.style.borderColor = '#7c3aed33'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = t.cardBg
                    e.currentTarget.style.borderColor = t.cardBorder
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, background: `radial-gradient(circle at 35% 35%, ${v.color}cc, ${v.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '0.78rem' }}>
                    {v.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: '600', color: t.textColor }}>{v.name}</div>
                    <div style={{ fontSize: '0.7rem', color: t.labelColor }}>Cloned voice</div>
                  </div>
                  <div style={{ background: '#7c3aed18', color: '#a78bfa', padding: '0.1rem 0.45rem', borderRadius: '20px', fontSize: '0.66rem', border: '1px solid #7c3aed33' }}>Custom</div>
                </div>
              ))}

              {/* Default voices to fill remaining space */}
              {DEFAULT_VOICES.slice(0, Math.max(0, 4 - clonedVoices.slice(0, 2).length)).map((v, i) => (
                <div key={i}
                  onClick={() => navigate('/studio')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.8rem 1rem',
                    background: t.cardBg, border: `1px solid ${t.cardBorder}`,
                    borderRadius: '10px', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = t.rowHover
                    e.currentTarget.style.borderColor = '#7c3aed33'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = t.cardBg
                    e.currentTarget.style.borderColor = t.cardBorder
                  }}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, background: `radial-gradient(circle at 35% 35%, ${v.color}cc, ${v.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '0.78rem' }}>
                    {v.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: '600', color: t.textColor }}>{v.name}</div>
                    <div style={{ fontSize: '0.7rem', color: t.labelColor }}>Default voice</div>
                  </div>
                  <div style={{ background: isDark ? '#1e1e2e' : '#f0f0f5', color: t.labelColor, padding: '0.1rem 0.45rem', borderRadius: '20px', fontSize: '0.66rem', border: `1px solid ${t.cardBorder}` }}>Built-in</div>
                </div>
              ))}

              {/* Clone CTA if no cloned voices */}
              {clonedVoices.length === 0 && (
                <div
                  onClick={() => navigate('/voices')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.8rem 1rem',
                    background: isDark ? '#13131f' : '#faf8ff',
                    border: `1px dashed #7c3aed55`,
                    borderRadius: '10px', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed99'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#7c3aed55'}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, background: '#7c3aed18', border: '1px solid #7c3aed33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
                    +
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: '600', color: '#a78bfa' }}>Clone your voice</div>
                    <div style={{ fontSize: '0.7rem', color: t.labelColor }}>Upload a 6–30s sample to get started</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>      
            </div>
          </div>
        
 
)}

export default Home