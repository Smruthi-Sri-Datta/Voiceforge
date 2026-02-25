import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useVoices } from '../context/VoicesContext'
import { useHistory } from '../context/HistoryContext'
import { useAuth } from '../context/AuthContext'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

// ── Indian language codes (routed to Sarvam internally) ───────
const INDIAN_LANG_CODES = ["hi", "bn", "ta", "te", "gu", "kn", "ml", "mr", "pa", "or"]

// ── Indian language voices ────────────────────────────────────
const INDIAN_VOICES = [
  { name: "Anushka", color: "#e879f9", desc: "Warm, expressive female voice"      },
  { name: "Abhilash", color: "#60a5fa", desc: "Clear, authoritative male voice"   },
  { name: "Manisha",  color: "#f472b6", desc: "Friendly, natural female voice"    },
  { name: "Arya",     color: "#34d399", desc: "Confident, bright female voice"    },
  { name: "Karun",    color: "#fb923c", desc: "Smooth, calm male voice"           },
  { name: "Hitesh",   color: "#a78bfa", desc: "Professional, clear male voice"    },
]

// ── XTTS voice metadata ───────────────────────────────────────
const VOICE_META = {
  "Ana Florence":    { desc: "Steady, rich narrator with a smooth darker tone",        previewText: "The ancient city slept beneath a thousand stars, each one holding a secret the night refused to tell." },
  "Claribel Dervla": { desc: "Composed, deep voice with authoritative clarity",         previewText: "Ladies and gentlemen, the evidence speaks for itself. The truth, as always, needs no introduction." },
  "Daisy Studious":  { desc: "Crisp, high-clarity voice with structured precision",     previewText: "Step one — breathe. Step two — focus. Everything else? We'll figure it out together." },
  "Gracie Wise":     { desc: "Bright, lively voice with natural conversational energy", previewText: "Oh, you won't believe what happened today — honestly, I'm still laughing about it!" },
}

const LANG_NAMES = {
  hi: "Hindi", bn: "Bengali", ta: "Tamil",  te: "Telugu",
  gu: "Gujarati", kn: "Kannada", ml: "Malayalam", mr: "Marathi",
  pa: "Punjabi", or: "Odia", "zh-cn": "Chinese", ja: "Japanese",
  en: "English", fr: "French", de: "German", es: "Spanish",
}

const SUGGESTIONS = [
  { label: "📖 Narrate a story",             text: "In a quiet village where the sky brushes the fields in hues of gold, a young girl discovered a map leading to forgotten treasures." },
  { label: "😄 Tell a silly joke",            text: "Why don't scientists trust atoms? Because they make up everything!" },
  { label: "📢 Record an advertisement",      text: "Introducing VoiceForge — the AI voice platform that brings your words to life. Try it today and hear the difference." },
  { label: "🌍 Speak in different languages", text: "Bonjour! Je m'appelle VoiceForge. Je peux parler dans de nombreuses langues différentes." },
  { label: "🎬 Direct a dramatic scene",      text: "The storm was closing in. She had one chance, one choice — and the weight of the world rested on her next words." },
  { label: "🎙️ Introduce your podcast",       text: "Welcome to The Future Forward podcast, where we explore the ideas, technologies, and people shaping tomorrow's world." },
]

function getAudioUrl(v) {
  return v.previewUrl || `${BACKEND}/api/audio/${v.voice_id}`
}

function detectScriptLanguage(text) {
  if (!text || text.trim().length < 3) return null
  const sample = text.slice(0, 200)
  if (/[\u0900-\u097F]/.test(sample)) return "hi"
  if (/[\u4E00-\u9FFF]/.test(sample)) return "zh-cn"
  if (/[\u3040-\u30FF]/.test(sample)) return "ja"
  return null
}

function Studio() {
  const { isDark } = useTheme()
  const { allVoices, clonedVoices, DEFAULT_VOICES } = useVoices()
  const { addHistoryEntry } = useHistory()
  const { useGuestCredit, isAuthenticated, guestCredits, authFetch } = useAuth()

  const [text, setText]                           = useState("")
  const [voice, setVoice]                         = useState(allVoices[0])
  const [language, setLanguage]                   = useState("en")
  const [languages, setLanguages]                 = useState([])
  const [showLangMenu, setShowLangMenu]           = useState(false)
  const [speed, setSpeed]                         = useState(1.0)
  const [loading, setLoading]                     = useState(false)
  const [hoveredChip, setHoveredChip]             = useState(null)
  const [generationError, setGenerationError]     = useState(null)
  const [generationWarning, setGenerationWarning] = useState(null)

  const [panelMode, setPanelMode]       = useState('settings')
  const [voiceTab, setVoiceTab]         = useState('default')
  const [voiceSearch, setVoiceSearch]   = useState('')

  const [bottomBar, setBottomBar]             = useState(null)
  const [previewLoading, setPreviewLoading]   = useState(null)
  const [previewCache, setPreviewCache]       = useState({})
  const [langMismatch, setLangMismatch]       = useState(null)

  // ── Derived ───────────────────────────────────────────────────
  const isIndianLang        = INDIAN_LANG_CODES.includes(language)
  const charLimit           = isIndianLang ? 2500 : 5000
  const charWarnAt          = isIndianLang ? 2200 : 4500
  const activeDefaultVoices = isIndianLang ? INDIAN_VOICES : DEFAULT_VOICES

  // ── Fetch languages from backend on mount ─────────────────────
  useEffect(() => {
    fetch(`${BACKEND}/api/languages`)
      .then(r => r.json())
      .then(data => setLanguages(data.languages))
      .catch(() => {
        setLanguages([
          { code: "en",    name: "🇬🇧 English",   engine: "xtts"   },
          { code: "hi",    name: "🇮🇳 Hindi",     engine: "sarvam" },
          { code: "fr",    name: "🇫🇷 French",    engine: "xtts"   },
          { code: "de",    name: "🇩🇪 German",    engine: "xtts"   },
          { code: "es",    name: "🇪🇸 Spanish",   engine: "xtts"   },
          { code: "ja",    name: "🇯🇵 Japanese",  engine: "xtts"   },
          { code: "zh-cn", name: "🇨🇳 Chinese",   engine: "xtts"   },
        ])
      })
  }, [])

  // ── Auto-select voice when language changes ───────────────────
  useEffect(() => {
    if (isIndianLang) {
      setVoice({ ...INDIAN_VOICES[0], type: 'indian' })
    } else {
      const stillExists = allVoices.find(v => v.name === voice?.name)
      if (!stillExists || voice?.type === 'indian') setVoice(allVoices[0])
    }
  }, [language])

  useEffect(() => {
    const stillExists = allVoices.find(v => v.name === voice?.name)
    if (!stillExists && !isIndianLang) setVoice(allVoices[0])
  }, [allVoices])

  useEffect(() => {
    if (isIndianLang && voice?.type === 'custom') {
      setGenerationWarning("Custom voices aren't supported for Indian languages. Using Anushka (default) instead.")
    } else {
      setGenerationWarning(null)
    }
  }, [isIndianLang, voice])

  useEffect(() => {
    if (langMismatch && language === langMismatch) setLangMismatch(null)
  }, [language])

  const t = {
    bg:              isDark ? '#0d0d14' : '#f8f8fc',
    centerBg:        isDark ? '#0d0d14' : '#ffffff',
    panelBg:         isDark ? '#0f0f1a' : '#fafafa',
    panelBorder:     isDark ? '#1e1e2e' : '#e5e5e8',
    textColor:       isDark ? '#e2e8f0' : '#111118',
    labelColor:      isDark ? '#555'    : '#999',
    labelMid:        isDark ? '#888'    : '#666',
    divider:         isDark ? '#1a1a2a' : '#eeeeee',
    rowBg:           isDark ? '#13131f' : '#f4f4f8',
    rowBorder:       isDark ? '#1e1e2e' : '#e8e8ec',
    rowHover:        isDark ? '#1a1a2e' : '#eeeefd',
    rowSelected:     isDark ? '#1e1a2e' : '#f0ecff',
    chipBg:          isDark ? '#1a1a2e' : '#f0f0f5',
    chipBorder:      isDark ? '#2a2a4a' : '#e0e0e8',
    chipHover:       isDark ? '#2a2a4a' : '#e4e4f0',
    menuBg:          isDark ? '#13131f' : '#ffffff',
    menuBorder:      isDark ? '#2a2a4a' : '#e5e5e8',
    menuHover:       isDark ? '#1a1a2e' : '#f5f5f5',
    inputBg:         isDark ? '#13131f' : '#ffffff',
    inputBorder:     isDark ? '#2a2a3a' : '#d8d8e0',
    bottomBarBg:     isDark ? '#0f0f1a' : '#ffffff',
    bottomBarBorder: isDark ? '#1e1e2e' : '#e5e5e8',
    tabActive:       isDark ? '#e2e8f0' : '#111118',
    tabInactive:     isDark ? '#555'    : '#999',
  }

  // ── Core generate ─────────────────────────────────────────────
  async function _doGenerate() {
    setLangMismatch(null)
    setGenerationError(null)
    setGenerationWarning(null)
    setLoading(true)
    setBottomBar(null)
    try {
      const response = await authFetch(`${BACKEND}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          speaker:  isIndianLang ? voice.name.toLowerCase() : voice.name,
          language,
          speed,
          voice_id: voice.type === 'custom' ? voice.voice_id : null,
        })
      })
      if (!response.ok) {
        const errData = await response.json()
        setGenerationError(errData.detail || "Generation failed. Please try again.")
        setLoading(false)
        return
      }
      const data = await response.json()
      const url  = `${BACKEND}/api/audio/${data.file}`
      setBottomBar({ url, label: voice.name, color: voice.color, isPreview: false })
      if (data.warning) setGenerationWarning(data.warning)
      else setGenerationWarning(null)
      addHistoryEntry({
        text,
        voice: { name: voice.name, color: voice.color, type: voice.type },
        language, speed, audioUrl: url,
      })
    } catch {
      setGenerationError("Could not reach the backend. Make sure the server is running.")
    }
    setLoading(false)
  }

  // ── Generate with mismatch check + credit gate ────────────────
  async function generateAudio() {
    if (!text.trim()) return
    if (!useGuestCredit('tts')) return
    const detected = detectScriptLanguage(text)
    if (detected && detected !== language) {
      setLangMismatch(detected)
      return
    }
    await _doGenerate()
  }

  async function handlePreview(v) {
    if (previewCache[v.name]) {
      setBottomBar({ url: previewCache[v.name], label: v.name, color: v.color, isPreview: true })
      return
    }
    setPreviewLoading(v.name)
    try {
      const previewText = VOICE_META[v.name]?.previewText || `Hi, I'm ${v.name}. How can I help you today?`
      const response = await authFetch(`${BACKEND}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: previewText, speaker: v.name, language: "en", speed: 1.0 })
      })
      const data = await response.json()
      const url  = `${BACKEND}/api/audio/${data.file}`
      setPreviewCache(prev => ({ ...prev, [v.name]: url }))
      setBottomBar({ url, label: v.name, color: v.color, isPreview: true })
    } catch { console.error("Preview failed") }
    setPreviewLoading(null)
  }

  function selectVoice(v) {
    setVoice(v)
    setPanelMode('settings')
  }

  const displayText  = hoveredChip !== null ? SUGGESTIONS[hoveredChip].text : text
  const selectedLang = languages.find(l => l.code === language)
  const globalLangs  = languages.filter(l => l.engine === 'xtts')
  const indianLangs  = languages.filter(l => l.engine === 'sarvam')

  const filteredDefault = activeDefaultVoices.filter(v => v.name.toLowerCase().includes(voiceSearch.toLowerCase()))
  const filteredCloned  = clonedVoices.filter(v => v.name.toLowerCase().includes(voiceSearch.toLowerCase()))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)', margin: '-2rem', background: t.bg }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* ── CENTER — Editor ── */}
        <div style={{ flex: 6, display: 'flex', flexDirection: 'column', minWidth: 0, background: t.centerBg }}>
          <div style={{ padding: '1.5rem 2.5rem 0', fontSize: '0.9rem', fontWeight: '600', color: t.labelMid, letterSpacing: '0.2px' }}>
            Text to Speech
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 2.5rem', overflowY: 'auto' }}>
            <textarea
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: hoveredChip !== null ? t.labelColor : t.textColor,
                fontSize: '1rem', lineHeight: '1.9', resize: 'none',
                fontFamily: "'Segoe UI', sans-serif",
                fontStyle: hoveredChip !== null ? 'italic' : 'normal',
                paddingTop: '2rem', minHeight: '200px',
              }}
              placeholder="Start typing here or paste any text you want to turn into lifelike speech..."
              value={displayText}
              onChange={(e) => {
                setText(e.target.value)
                if (langMismatch) setLangMismatch(null)
                if (generationError) setGenerationError(null)
                if (generationWarning) setGenerationWarning(null)
              }}
            />
            {!text && (
              <div style={{ paddingBottom: '1.5rem' }}>
                <div style={{ color: t.labelColor, fontSize: '0.78rem', marginBottom: '0.7rem', fontWeight: '500' }}>Try an example</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i}
                      onMouseEnter={() => setHoveredChip(i)}
                      onMouseLeave={() => setHoveredChip(null)}
                      onClick={() => setText(s.text)}
                      style={{ background: hoveredChip === i ? t.chipHover : t.chipBg, border: `1px solid ${t.chipBorder}`, color: t.textColor, padding: '0.38rem 0.85rem', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s ease', fontFamily: "'Segoe UI', sans-serif" }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Generation error */}
          {generationError && (
            <div style={{ margin: '0 2.5rem 0.75rem', padding: '0.85rem 1rem', background: isDark ? '#2a1a1a' : '#fff5f5', border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ fontSize: '0.83rem', color: '#ef4444', lineHeight: '1.5' }}>⚠️ {generationError}</div>
              <button onClick={() => setGenerationError(null)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', flexShrink: 0, padding: '0.2rem' }}>✕</button>
            </div>
          )}

          {/* Romanized script warning */}
          {generationWarning && (
            <div style={{ margin: '0 2.5rem 0.75rem', padding: '0.85rem 1rem', background: isDark ? '#1c1500' : '#fffbeb', border: `1px solid ${isDark ? '#7c6400' : '#fcd34d'}`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ fontSize: '0.83rem', color: isDark ? '#fcd34d' : '#92400e', lineHeight: '1.5' }}>⚠️ {generationWarning}</div>
              <button onClick={() => setGenerationWarning(null)} style={{ background: 'transparent', border: 'none', color: isDark ? '#fcd34d' : '#92400e', cursor: 'pointer', fontSize: '1rem', flexShrink: 0, padding: '0.2rem' }}>✕</button>
            </div>
          )}

          {/* Language mismatch */}
          {langMismatch && (
            <div style={{ margin: '0 2.5rem 0.75rem', padding: '0.85rem 1rem', background: isDark ? '#1c1500' : '#fffbeb', border: `1px solid ${isDark ? '#7c6400' : '#fcd34d'}`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.83rem', color: isDark ? '#fcd34d' : '#92400e', lineHeight: '1.5' }}>
                ⚠️ Your text looks like <strong>{LANG_NAMES[langMismatch]}</strong> but language is set to <strong>{selectedLang?.name}</strong>.
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button onClick={async () => { setLanguage(langMismatch); setLangMismatch(null); await new Promise(r => setTimeout(r, 60)); await _doGenerate() }}
                  style={{ padding: '0.38rem 0.85rem', borderRadius: '6px', border: 'none', background: '#f59e0b', color: 'white', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Switch & Generate
                </button>
                <button onClick={() => _doGenerate()}
                  style={{ padding: '0.38rem 0.85rem', borderRadius: '6px', border: `1px solid ${isDark ? '#7c6400' : '#fcd34d'}`, background: 'transparent', color: isDark ? '#fcd34d' : '#92400e', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Generate Anyway
                </button>
              </div>
            </div>
          )}

          {/* Composer bar */}
          <div style={{ borderTop: `1px solid ${t.divider}`, padding: '0.85rem 2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', background: t.centerBg, flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <div style={{ fontSize: '0.8rem', color: t.labelColor }}>
                <span style={{ color: text.length > charWarnAt ? '#ef4444' : t.labelMid, fontWeight: '500' }}>{text.length}</span>
                <span> / {charLimit.toLocaleString()} characters</span>
                {isIndianLang && <span style={{ marginLeft: '0.4rem', color: t.labelColor, fontSize: '0.72rem' }}>(limit for selected language)</span>}
              </div>
              {!isAuthenticated && (
                <div style={{ fontSize: '0.75rem', fontWeight: '500', color: guestCredits.tts > 0 ? '#a78bfa' : '#ef4444' }}>
                  {guestCredits.tts > 0 ? `${guestCredits.tts} free generation remaining` : '0 free generations — sign in to continue'}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <button onClick={() => { if (bottomBar?.url) window.open(bottomBar.url) }}
                disabled={!bottomBar?.url || bottomBar?.isPreview}
                title="Download audio"
                style={{ width: '38px', height: '38px', borderRadius: '8px', border: `1px solid ${t.rowBorder}`, background: 'transparent', color: bottomBar?.url && !bottomBar?.isPreview ? t.textColor : t.labelColor, cursor: bottomBar?.url && !bottomBar?.isPreview ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', transition: 'all 0.15s' }}>
                ⬇
              </button>
              <button onClick={generateAudio} disabled={loading || !text.trim() || text.length > charLimit}
                style={{ padding: '0.65rem 1.8rem', borderRadius: '8px', border: 'none', fontSize: '0.88rem', fontWeight: '700', cursor: loading || !text.trim() || text.length > charLimit ? 'not-allowed' : 'pointer', background: loading || !text.trim() || text.length > charLimit ? (isDark ? '#1e1e2e' : '#e5e5e8') : 'linear-gradient(135deg, #7c3aed, #a855f7)', color: loading || !text.trim() || text.length > charLimit ? (isDark ? '#444' : '#aaa') : 'white', boxShadow: loading || !text.trim() ? 'none' : '0 4px 16px rgba(124,58,237,0.25)', transition: 'all 0.2s ease', whiteSpace: 'nowrap' }}>
                {loading ? "⏳ Generating..." : "⚡ Generate Audio"}
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ flex: 4, borderLeft: `1px solid ${t.panelBorder}`, display: 'flex', flexDirection: 'column', background: t.panelBg, position: 'relative', minWidth: 0 }}>

          {/* Settings mode */}
          {panelMode === 'settings' && (
            <div style={{ padding: '1.8rem', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: t.labelColor, letterSpacing: '0.8px', marginBottom: '0.8rem', textTransform: 'uppercase' }}>Voice</div>
              <div onClick={() => { setPanelMode('explorer'); setVoiceSearch('') }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', border: `1px solid ${t.rowBorder}`, borderRadius: '12px', cursor: 'pointer', background: t.rowBg, marginBottom: '1.8rem', transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = t.rowHover}
                onMouseLeave={e => e.currentTarget.style.background = t.rowBg}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: `radial-gradient(circle at 35% 35%, ${voice?.color}cc, ${voice?.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '0.85rem' }}>{voice?.name[0]}</div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', color: t.textColor, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {voice?.name}
                      {voice?.type === 'cloned' && <span style={{ background: '#7c3aed18', color: '#a78bfa', padding: '0.1rem 0.4rem', borderRadius: '10px', fontSize: '0.68rem', border: '1px solid #7c3aed33' }}>Custom</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: t.labelColor, marginTop: '0.1rem' }}>
                      {voice?.desc || VOICE_META[voice?.name]?.desc || "Custom cloned voice"}
                    </div>
                  </div>
                </div>
                <span style={{ color: t.labelColor, fontSize: '1.1rem', marginLeft: '0.5rem' }}>›</span>
              </div>

              <div style={{ borderTop: `1px solid ${t.divider}`, marginBottom: '1.8rem' }} />

              {/* Language selector */}
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: t.labelColor, letterSpacing: '0.8px', marginBottom: '0.8rem', textTransform: 'uppercase' }}>Language</div>
              <div style={{ position: 'relative', marginBottom: '1.8rem' }}>
                <div onClick={() => setShowLangMenu(!showLangMenu)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', border: `1px solid ${t.rowBorder}`, borderRadius: '12px', cursor: 'pointer', background: t.rowBg }}>
                  <span style={{ fontSize: '0.9rem', color: t.textColor }}>{selectedLang?.name || '🇬🇧 English'}</span>
                  <span style={{ color: t.labelColor, fontSize: '1.1rem' }}>›</span>
                </div>
                {showLangMenu && (
                  <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 100, background: t.menuBg, border: `1px solid ${t.menuBorder}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.14)', maxHeight: '300px', overflowY: 'auto' }}>

                    {/* Global languages */}
                    <div style={{ padding: '0.4rem 1rem 0.2rem', fontSize: '0.68rem', fontWeight: '700', color: t.labelColor, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Global Languages</div>
                    {globalLangs.map(l => (
                      <div key={l.code} onClick={() => { setLanguage(l.code); setShowLangMenu(false) }}
                        style={{ padding: '0.7rem 1rem', cursor: 'pointer', fontSize: '0.88rem', color: t.textColor, background: language === l.code ? t.menuHover : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        onMouseEnter={e => e.currentTarget.style.background = t.menuHover}
                        onMouseLeave={e => e.currentTarget.style.background = language === l.code ? t.menuHover : 'transparent'}>
                        {l.name}
                        {language === l.code && <span style={{ color: '#a78bfa', fontSize: '0.8rem' }}>✓</span>}
                      </div>
                    ))}

                    {/* Indian languages */}
                    <div style={{ padding: '0.4rem 1rem 0.2rem', fontSize: '0.68rem', fontWeight: '700', color: t.labelColor, letterSpacing: '0.5px', textTransform: 'uppercase', borderTop: `1px solid ${t.divider}`, marginTop: '0.3rem' }}>
                      🇮🇳 Indian Languages
                    </div>
                    {indianLangs.map(l => (
                      <div key={l.code} onClick={() => { setLanguage(l.code); setShowLangMenu(false) }}
                        style={{ padding: '0.7rem 1rem', cursor: 'pointer', fontSize: '0.88rem', color: t.textColor, background: language === l.code ? t.menuHover : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        onMouseEnter={e => e.currentTarget.style.background = t.menuHover}
                        onMouseLeave={e => e.currentTarget.style.background = language === l.code ? t.menuHover : 'transparent'}>
                        {l.name}
                        {language === l.code && <span style={{ color: '#a78bfa', fontSize: '0.8rem' }}>✓</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ borderTop: `1px solid ${t.divider}`, marginBottom: '1.8rem' }} />

              {/* Speed */}
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: t.labelColor, letterSpacing: '0.8px', marginBottom: '0.8rem', textTransform: 'uppercase' }}>Speed</div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                  <span style={{ fontSize: '0.85rem', color: t.labelMid }}>Playback speed</span>
                  <span style={{ background: '#7c3aed18', color: '#a78bfa', padding: '0.15rem 0.6rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700', border: '1px solid #7c3aed33' }}>{speed}x</span>
                </div>
                <input type="range" min="0.5" max="2.0" step="0.1" value={speed} onChange={e => setSpeed(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', color: t.labelColor, fontSize: '0.72rem', marginTop: '0.4rem' }}>
                  <span>Slower</span><span>Normal</span><span>Faster</span>
                </div>
              </div>
            </div>
          )}

          {/* Explorer mode */}
          {panelMode === 'explorer' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '1.5rem 1.8rem 0', borderBottom: `1px solid ${t.divider}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.2rem' }}>
                  <button onClick={() => setPanelMode('settings')}
                    style={{ width: '30px', height: '30px', borderRadius: '8px', border: `1px solid ${t.rowBorder}`, background: t.rowBg, cursor: 'pointer', color: t.textColor, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>←</button>
                  <span style={{ fontSize: '0.95rem', fontWeight: '600', color: t.textColor }}>Select a voice</span>
                </div>
                <div style={{ display: 'flex' }}>
                  {[
                    { key: 'default', label: 'Default', count: activeDefaultVoices.length },
                    { key: 'cloned',  label: 'My Voices', count: clonedVoices.length }
                  ].map(tab => (
                    <button key={tab.key} onClick={() => { setVoiceTab(tab.key); setVoiceSearch('') }}
                      style={{ background: 'transparent', border: 'none', borderBottom: voiceTab === tab.key ? '2px solid #7c3aed' : '2px solid transparent', padding: '0.5rem 1rem', marginBottom: '-1px', color: voiceTab === tab.key ? t.tabActive : t.tabInactive, fontWeight: voiceTab === tab.key ? '600' : '400', fontSize: '0.85rem', cursor: 'pointer', fontFamily: "'Segoe UI', sans-serif", display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.15s' }}>
                      {tab.label}
                      <span style={{ background: voiceTab === tab.key ? '#7c3aed22' : (isDark ? '#1e1e2e' : '#efefef'), color: voiceTab === tab.key ? '#a78bfa' : t.labelColor, padding: '0.1rem 0.45rem', borderRadius: '10px', fontSize: '0.68rem', fontWeight: '600' }}>{tab.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ padding: '0.9rem 1.8rem', borderBottom: `1px solid ${t.divider}` }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: t.labelColor, fontSize: '0.82rem' }}>🔍</span>
                  <input type="text" placeholder="Search voices..." value={voiceSearch} onChange={e => setVoiceSearch(e.target.value)}
                    style={{ width: '100%', padding: '0.58rem 0.8rem 0.58rem 2.1rem', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '8px', color: t.textColor, fontSize: '0.84rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
                {voiceTab === 'default' && (
                  filteredDefault.length === 0
                    ? <div style={{ textAlign: 'center', color: t.labelColor, fontSize: '0.84rem', paddingTop: '3rem' }}>No voices match your search</div>
                    : filteredDefault.map(v => (
                      <div key={v.name}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.8rem', background: voice?.name === v.name ? t.rowSelected : 'transparent', borderBottom: `1px solid ${t.divider}`, cursor: 'pointer', transition: 'background 0.12s' }}
                        onMouseEnter={e => { if (voice?.name !== v.name) e.currentTarget.style.background = t.rowHover }}
                        onMouseLeave={e => { if (voice?.name !== v.name) e.currentTarget.style.background = 'transparent' }}>
                        <div onClick={() => selectVoice({ ...v, type: isIndianLang ? 'indian' : 'default' })}
                          style={{ width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0, background: `radial-gradient(circle at 35% 35%, ${v.color}cc, ${v.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '0.88rem' }}>{v.name[0]}</div>
                        <div style={{ flex: 1, minWidth: 0 }} onClick={() => selectVoice({ ...v, type: isIndianLang ? 'indian' : 'default' })}>
                          <div style={{ fontWeight: '600', fontSize: '0.88rem', color: t.textColor, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {v.name}
                            {voice?.name === v.name && <span style={{ color: '#a78bfa', fontSize: '0.72rem', fontWeight: '700' }}>✓</span>}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: t.labelColor, marginTop: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {v.desc || VOICE_META[v.name]?.desc || "Default voice"}
                          </div>
                        </div>
                        {!isIndianLang && (
                          <button onClick={e => { e.stopPropagation(); handlePreview(v) }} disabled={previewLoading === v.name} title="Preview"
                            style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'transparent', border: 'none', color: previewLoading === v.name ? t.labelColor : t.labelMid, cursor: previewLoading === v.name ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', flexShrink: 0 }}
                            onMouseEnter={e => { e.currentTarget.style.background = isDark ? '#2a2a4a' : '#ebebeb'; e.currentTarget.style.color = t.textColor }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.labelMid }}>
                            {previewLoading === v.name ? '⏳' : '▶'}
                          </button>
                        )}
                      </div>
                    ))
                )}

                {voiceTab === 'cloned' && (
                  clonedVoices.length === 0 ? (
                    <div style={{ textAlign: 'center', paddingTop: '4rem', color: t.labelColor }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎙️</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '500', color: t.labelMid }}>No cloned voices yet</div>
                      <div style={{ fontSize: '0.78rem', marginTop: '0.3rem' }}>Go to the Voices page to clone your first voice</div>
                    </div>
                  ) : filteredCloned.length === 0
                    ? <div style={{ textAlign: 'center', color: t.labelColor, fontSize: '0.84rem', paddingTop: '3rem' }}>No voices match your search</div>
                    : filteredCloned.map(v => (
                      <div key={v.name}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.8rem', background: voice?.name === v.name ? t.rowSelected : 'transparent', borderBottom: `1px solid ${t.divider}`, cursor: 'pointer', transition: 'background 0.12s' }}
                        onMouseEnter={e => { if (voice?.name !== v.name) e.currentTarget.style.background = t.rowHover }}
                        onMouseLeave={e => { if (voice?.name !== v.name) e.currentTarget.style.background = 'transparent' }}>
                        <div onClick={() => selectVoice(v)} style={{ width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0, background: `radial-gradient(circle at 35% 35%, ${v.color}cc, ${v.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '0.88rem' }}>{v.name[0]}</div>
                        <div style={{ flex: 1, minWidth: 0 }} onClick={() => selectVoice(v)}>
                          <div style={{ fontWeight: '600', fontSize: '0.88rem', color: t.textColor, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {v.name}
                            {voice?.name === v.name && <span style={{ color: '#a78bfa', fontSize: '0.72rem' }}>✓</span>}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: t.labelColor, marginTop: '0.15rem' }}>Custom cloned voice</div>
                        </div>
                        <span style={{ background: '#7c3aed18', color: '#a78bfa', padding: '0.15rem 0.5rem', borderRadius: '20px', fontSize: '0.68rem', border: '1px solid #7c3aed33', flexShrink: 0 }}>Custom</span>
                        <button onClick={e => { e.stopPropagation(); setBottomBar({ url: getAudioUrl(v), label: v.name, color: v.color, isPreview: true }) }} title="Preview"
                          style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'transparent', border: 'none', color: t.labelMid, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.background = isDark ? '#2a2a4a' : '#ebebeb'; e.currentTarget.style.color = t.textColor }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.labelMid }}>▶</button>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom audio bar */}
      {bottomBar && (
        <div style={{ borderTop: `1px solid ${t.bottomBarBorder}`, background: t.bottomBarBg, padding: '0.7rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0, boxShadow: isDark ? '0 -4px 20px rgba(0,0,0,0.3)' : '0 -4px 20px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0, minWidth: '170px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0, background: `radial-gradient(circle at 35% 35%, ${bottomBar.color}cc, ${bottomBar.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '0.82rem' }}>{bottomBar.label[0]}</div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: t.textColor }}>{bottomBar.label}</div>
              <div style={{ fontSize: '0.7rem', color: t.labelColor }}>{bottomBar.isPreview ? '🎧 Voice preview' : '✨ Generated audio'}</div>
            </div>
          </div>
          <audio controls autoPlay src={bottomBar.url} style={{ flex: 1, height: '34px' }} />
          <button onClick={() => setBottomBar(null)} style={{ background: 'transparent', border: 'none', color: t.labelColor, cursor: 'pointer', fontSize: '1rem', padding: '0.3rem', borderRadius: '4px', flexShrink: 0, transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = t.textColor}
            onMouseLeave={e => e.currentTarget.style.color = t.labelColor}>✕</button>
        </div>
      )}
    </div>
  )
}

export default Studio
