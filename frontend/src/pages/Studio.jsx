import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'

const VOICES = [
  { name: "Ana Florence", color: "#f97316" },
  { name: "Claribel Dervla", color: "#a855f7" },
  { name: "Daisy Studious", color: "#3b82f6" },
  { name: "Gracie Wise", color: "#10b981" },
]

const LANGUAGES = [
  { code: "en", name: "🇬🇧 English" },
  { code: "hi", name: "🇮🇳 Hindi" },
  { code: "fr", name: "🇫🇷 French" },
  { code: "de", name: "🇩🇪 German" },
  { code: "es", name: "🇪🇸 Spanish" },
  { code: "ja", name: "🇯🇵 Japanese" },
  { code: "zh-cn", name: "🇨🇳 Chinese" },
]

const SUGGESTIONS = [
  { label: "📖 Narrate a story", text: "In a quiet village where the sky brushes the fields in hues of gold, a young girl discovered a map leading to forgotten treasures." },
  { label: "😄 Tell a silly joke", text: "Why don't scientists trust atoms? Because they make up everything!" },
  { label: "📢 Record an advertisement", text: "Introducing VoiceForge — the AI voice platform that brings your words to life. Try it today and hear the difference." },
  { label: "🌍 Speak in different languages", text: "Bonjour! Je m'appelle VoiceForge. Je peux parler dans de nombreuses langues différentes." },
  { label: "🎬 Direct a dramatic scene", text: "The storm was closing in. She had one chance, one choice — and the weight of the world rested on her next words." },
  { label: "🎙️ Introduce your podcast", text: "Welcome to The Future Forward podcast, where we explore the ideas, technologies, and people shaping tomorrow's world." },
]

function Studio() {
  const { isDark } = useTheme()
  const [text, setText] = useState("")
  const [voice, setVoice] = useState(VOICES[0])
  const [showVoiceMenu, setShowVoiceMenu] = useState(false)
  const [language, setLanguage] = useState("en")
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [speed, setSpeed] = useState(1.0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [hoveredChip, setHoveredChip] = useState(null)

  const t = {
    bg: isDark ? '#0d0d14' : '#ffffff',
    panelBg: isDark ? '#0d0d14' : '#ffffff',
    panelBorder: isDark ? '#1e1e2e' : '#e5e5e8',
    textColor: isDark ? '#e2e8f0' : '#111118',
    labelColor: isDark ? '#666' : '#888',
    labelBold: isDark ? '#aaa' : '#444',
    divider: isDark ? '#1e1e2e' : '#efefef',
    rowBg: isDark ? '#13131f' : '#f9f9f9',
    rowBorder: isDark ? '#1e1e2e' : '#e5e5e8',
    rowHover: isDark ? '#1a1a2e' : '#f3f3f3',
    chipBg: isDark ? '#1a1a2e' : '#f3f3f3',
    chipBorder: isDark ? '#2a2a4a' : '#e0e0e3',
    chipHover: isDark ? '#2a2a4a' : '#e8e8e8',
    menuBg: isDark ? '#13131f' : '#ffffff',
    menuBorder: isDark ? '#2a2a4a' : '#e5e5e8',
    menuHover: isDark ? '#1a1a2e' : '#f5f5f5',
  }

  async function generateAudio() {
    if (!text.trim()) return
    setLoading(true)
    setAudioUrl(null)
    const response = await fetch("http://localhost:8000/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speaker: voice.name, language, speed })
    })
    const data = await response.json()
    setAudioUrl(`http://localhost:8000/api/audio/${data.file}`)
    setLoading(false)
  }

  const displayText = hoveredChip !== null ? SUGGESTIONS[hoveredChip].text : text
  const selectedLang = LANGUAGES.find(l => l.code === language)

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 4rem)',
      margin: '-2rem',
      background: t.bg,
    }}>

      {/* ── CENTER ── */}
      <div style={{
        flex: 6,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        padding: '2.5rem 3rem',
        overflowY: 'auto',
      }}>
        <div style={{ fontSize: '0.95rem', fontWeight: '600', color: t.textColor, marginBottom: '1.5rem' }}>
          Text to Speech
        </div>

        {/* FIX #1 #2 #3 — textarea fills height, no box, breathing room */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <textarea
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: hoveredChip !== null ? t.labelColor : t.textColor,
              fontSize: '1rem',
              lineHeight: '1.8',
              resize: 'none',
              fontFamily: "'Segoe UI', sans-serif",
              fontStyle: hoveredChip !== null ? 'italic' : 'normal',
              paddingTop: '2rem',   // breathing room above placeholder
            }}
            placeholder="Start typing here or paste any text you want to turn into lifelike speech..."
            value={displayText}
            onChange={(e) => setText(e.target.value)}
          />
          <div style={{
            textAlign: 'right',
            color: t.labelColor,
            fontSize: '0.78rem',
            paddingBottom: '0.5rem',
            borderTop: `1px solid ${t.divider}`,
            paddingTop: '0.5rem',
          }}>
            {text.length} characters
          </div>
        </div>

        {/* Suggestion Chips */}
        {!text && (
          <div style={{ paddingTop: '1.5rem' }}>
            <div style={{ color: t.labelColor, fontSize: '0.8rem', marginBottom: '0.8rem' }}>
              Get started with
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i}
                  onMouseEnter={() => setHoveredChip(i)}
                  onMouseLeave={() => setHoveredChip(null)}
                  onClick={() => setText(s.text)}
                  style={{
                    background: hoveredChip === i ? t.chipHover : t.chipBg,
                    border: `1px solid ${t.chipBorder}`,
                    color: t.textColor,
                    padding: '0.4rem 0.9rem',
                    borderRadius: '20px',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontFamily: "'Segoe UI', sans-serif",
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Audio Player */}
        {audioUrl && (
          <div style={{
            marginTop: '1rem',
            borderTop: `1px solid ${t.divider}`,
            paddingTop: '1rem',
          }}>
            <div style={{ color: '#a78bfa', fontSize: '0.78rem', marginBottom: '0.5rem', fontWeight: '600' }}>
              ✨ Audio Ready
            </div>
            <audio controls src={audioUrl} style={{ width: '100%' }} />
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ── */}
      {/* FIX #7 — same bg as page */}
      <div style={{
        flex: 4,
        borderLeft: `1px solid ${t.panelBorder}`,
        padding: '2.5rem 1.8rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
        overflowY: 'auto',
        background: t.panelBg,
        position: 'relative',
      }}>

        {/* FIX #4 — Voice as clickable row with avatar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: '600', color: t.textColor, marginBottom: '0.8rem' }}>
            Voice
          </div>
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => { setShowVoiceMenu(!showVoiceMenu); setShowLangMenu(false) }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                border: `1px solid ${t.rowBorder}`,
                borderRadius: '10px',
                cursor: 'pointer',
                background: t.rowBg,
                transition: 'all 0.15s',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                {/* Avatar circle */}
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: `radial-gradient(circle at 35% 35%, ${voice.color}cc, ${voice.color}44)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8rem', color: 'white', fontWeight: '700',
                }}>
                  {voice.name[0]}
                </div>
                <span style={{ fontSize: '0.9rem', color: t.textColor, fontWeight: '500' }}>
                  {voice.name}
                </span>
              </div>
              <span style={{ color: t.labelColor, fontSize: '1rem' }}>›</span>
            </div>

            {/* Voice dropdown menu */}
            {showVoiceMenu && (
              <div style={{
                position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 100,
                background: t.menuBg, border: `1px solid ${t.menuBorder}`,
                borderRadius: '10px', overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              }}>
                {VOICES.map(v => (
                  <div key={v.name}
                    onClick={() => { setVoice(v); setShowVoiceMenu(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.7rem',
                      padding: '0.7rem 1rem', cursor: 'pointer',
                      background: voice.name === v.name ? t.menuHover : 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = t.menuHover}
                    onMouseLeave={e => e.currentTarget.style.background = voice.name === v.name ? t.menuHover : 'transparent'}
                  >
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: `radial-gradient(circle at 35% 35%, ${v.color}cc, ${v.color}44)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', color: 'white', fontWeight: '700',
                    }}>
                      {v.name[0]}
                    </div>
                    <span style={{ fontSize: '0.88rem', color: t.textColor }}>{v.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${t.divider}`, marginBottom: '1.5rem' }} />

        {/* Language as clickable row */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: '600', color: t.textColor, marginBottom: '0.8rem' }}>
            Language
          </div>
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => { setShowLangMenu(!showLangMenu); setShowVoiceMenu(false) }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                border: `1px solid ${t.rowBorder}`,
                borderRadius: '10px',
                cursor: 'pointer',
                background: t.rowBg,
              }}>
              <span style={{ fontSize: '0.9rem', color: t.textColor }}>{selectedLang?.name}</span>
              <span style={{ color: t.labelColor, fontSize: '1rem' }}>›</span>
            </div>

            {showLangMenu && (
              <div style={{
                position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 100,
                background: t.menuBg, border: `1px solid ${t.menuBorder}`,
                borderRadius: '10px', overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                maxHeight: '220px', overflowY: 'auto',
              }}>
                {LANGUAGES.map(l => (
                  <div key={l.code}
                    onClick={() => { setLanguage(l.code); setShowLangMenu(false) }}
                    style={{
                      padding: '0.7rem 1rem', cursor: 'pointer',
                      fontSize: '0.88rem', color: t.textColor,
                      background: language === l.code ? t.menuHover : 'transparent',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = t.menuHover}
                    onMouseLeave={e => e.currentTarget.style.background = language === l.code ? t.menuHover : 'transparent'}
                  >
                    {l.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${t.divider}`, marginBottom: '1.5rem' }} />

        {/* FIX #6 — Speed with Slower/Faster on same row as slider ends */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: '600', color: t.textColor }}>Speed</div>
            <span style={{
              background: '#7c3aed18', color: '#a78bfa',
              padding: '0.15rem 0.6rem', borderRadius: '20px',
              fontSize: '0.78rem', fontWeight: '700',
              border: '1px solid #7c3aed33',
            }}>
              {speed}x
            </span>
          </div>
          <input type="range" min="0.5" max="2.0" step="0.1"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: t.labelColor, fontSize: '0.72rem', marginTop: '0.3rem' }}>
            <span>Slower</span><span>Faster</span>
          </div>
        </div>

        {/* FIX #8 — Generate button pinned to bottom */}
        <div style={{ marginTop: 'auto' }}>
          <div style={{ borderTop: `1px solid ${t.divider}`, marginBottom: '1.5rem' }} />
          <button
            onClick={generateAudio}
            disabled={loading || !text.trim()}
            style={{
              width: '100%', padding: '0.85rem',
              borderRadius: '8px', border: 'none',
              fontSize: '0.9rem', fontWeight: '700',
              cursor: loading || !text.trim() ? 'not-allowed' : 'pointer',
              background: loading || !text.trim()
                ? (isDark ? '#1e1e2e' : '#e5e5e8')
                : 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: loading || !text.trim()
                ? (isDark ? '#444' : '#aaa')
                : 'white',
              boxShadow: loading || !text.trim() ? 'none' : '0 4px 16px rgba(124,58,237,0.3)',
              transition: 'all 0.2s ease',
            }}>
            {loading ? "⏳ Generating..." : "⚡ Generate Audio"}
          </button>
        </div>

      </div>
    </div>
  )
}

export default Studio