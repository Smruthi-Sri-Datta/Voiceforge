import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useVoices } from '../context/VoicesContext'
import { useHistory } from '../context/HistoryContext'

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function getAudioUrl(v) {
  return v.audio_url || v.previewUrl || `${BACKEND}/api/audio/${v.voice_id}.wav`
}

const LANGUAGE_NAMES = {
  en: '🇬🇧 English', hi: '🇮🇳 Hindi', fr: '🇫🇷 French',
  de: '🇩🇪 German', es: '🇪🇸 Spanish', ja: '🇯🇵 Japanese', 'zh-cn': '🇨🇳 Chinese',
}

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function truncate(text, max = 80) {
  return text.length > max ? text.slice(0, max) + '...' : text
}

function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// ── Custom Audio Player ───────────────────────────────────────────
function AudioPlayer({ src, isDark, accentColor = '#7c3aed', label }) {
  const audioRef  = useRef(null)
  const [playing, setPlaying]   = useState(false)
  const [current, setCurrent]   = useState(0)
  const [duration, setDuration] = useState(0)
  const [dragging, setDragging] = useState(false)

  // Reset when src changes
  useEffect(() => {
    setPlaying(false)
    setCurrent(0)
    setDuration(0)
  }, [src])

  function togglePlay() {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { a.play(); setPlaying(true) }
  }

  function onTimeUpdate() {
    if (!dragging) setCurrent(audioRef.current?.currentTime || 0)
  }

  function onLoadedMetadata() {
    setDuration(audioRef.current?.duration || 0)
  }

  function onEnded() {
    setPlaying(false)
    setCurrent(0)
    if (audioRef.current) audioRef.current.currentTime = 0
  }

  function seek(e) {
    const bar   = e.currentTarget
    const rect  = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const newTime = ratio * duration
    if (audioRef.current) audioRef.current.currentTime = newTime
    setCurrent(newTime)
  }

  function download() {
    const a = document.createElement('a')
    a.href = src
    a.download = label ? `${label}.wav` : 'audio.wav'
    a.click()
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0

  const bg     = isDark ? '#13131f' : '#f4f4f8'
  const border = isDark ? '#1e1e2e' : '#e8e8ec'
  const text   = isDark ? '#e2e8f0' : '#111118'
  const muted  = isDark ? '#555'    : '#999'
  const track  = isDark ? '#2a2a4a' : '#e0e0e8'

  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: '12px',
      padding: '1rem 1.1rem',
      display: 'flex', flexDirection: 'column', gap: '0.75rem',
    }}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        style={{ display: 'none' }}
      />

      {/* ── Progress bar ── */}
      <div
        onClick={seek}
        style={{
          width: '100%', height: '4px',
          background: track, borderRadius: '4px',
          cursor: 'pointer', position: 'relative',
          flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', left: 0, top: 0,
          height: '100%', borderRadius: '4px',
          width: `${progress}%`,
          background: `linear-gradient(90deg, ${accentColor}, #a855f7)`,
          transition: dragging ? 'none' : 'width 0.1s linear',
        }} />
        {/* Scrubber dot */}
        <div style={{
          position: 'absolute',
          left: `${progress}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '12px', height: '12px',
          borderRadius: '50%',
          background: accentColor,
          boxShadow: `0 0 0 2px ${isDark ? '#13131f' : '#f4f4f8'}`,
          transition: dragging ? 'none' : 'left 0.1s linear',
        }} />
      </div>

      {/* ── Controls row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>

        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          style={{
            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${accentColor}, #a855f7)`,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 12px ${accentColor}44`,
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = `0 6px 18px ${accentColor}66` }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';    e.currentTarget.style.boxShadow = `0 4px 12px ${accentColor}44` }}
        >
          {playing
            ? <span style={{ color: 'white', fontSize: '0.75rem', letterSpacing: '1px' }}>❚❚</span>
            : <span style={{ color: 'white', fontSize: '0.85rem', marginLeft: '2px' }}>▶</span>
          }
        </button>

        {/* Time */}
        <span style={{ fontSize: '0.78rem', color: muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {fmtTime(current)} / {fmtTime(duration)}
        </span>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Download */}
        <button
          onClick={download}
          title="Download"
          style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: 'transparent',
            border: `1px solid ${border}`,
            color: muted, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.82rem', flexShrink: 0, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor + '55'; e.currentTarget.style.color = accentColor }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = muted }}
        >
          ⬇
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
function History() {
  const { isDark } = useTheme()
  const { clonedVoices, removeClonedVoice } = useVoices()
  const { history, removeHistoryEntry, clearHistory } = useHistory()

  const [activeTab, setActiveTab]       = useState('tts')
  const [search, setSearch]             = useState('')
  const [selectedId, setSelectedId]     = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // ── Multi-select state ────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false)
  const [checkedIds, setCheckedIds] = useState(new Set())

  const t = {
    bg:                isDark ? '#0d0d14' : '#ffffff',
    panelBg:           isDark ? '#0d0d14' : '#ffffff',
    panelBorder:       isDark ? '#1e1e2e' : '#e5e5e8',
    textColor:         isDark ? '#e2e8f0' : '#111118',
    labelColor:        isDark ? '#666'    : '#888',
    divider:           isDark ? '#1e1e2e' : '#efefef',
    rowBg:             isDark ? '#13131f' : '#f9f9f9',
    rowBorder:         isDark ? '#1e1e2e' : '#e5e5e8',
    rowHover:          isDark ? '#1a1a2e' : '#f3f3f3',
    rowSelected:       isDark ? '#1e1a2e' : '#f0ecff',
    rowSelectedBorder: isDark ? '#7c3aed55' : '#7c3aed33',
    rowChecked:        isDark ? '#1e1a2e' : '#f0ecff',
    rowCheckedBorder:  isDark ? '#7c3aed66' : '#7c3aed44',
    inputBg:           isDark ? '#13131f' : '#fafafa',
    inputBorder:       isDark ? '#2a2a4a' : '#d5d5d8',
    tabActive:         isDark ? '#e2e8f0' : '#111118',
    tabInactive:       isDark ? '#666'    : '#888',
  }

  const filteredTTS = history.filter(e =>
    e.text.toLowerCase().includes(search.toLowerCase()) ||
    e.voice?.name.toLowerCase().includes(search.toLowerCase())
  )
  const filteredVoices = clonedVoices.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedTTS   = activeTab === 'tts'    ? history.find(e => e.id === selectedId)          : null
  const selectedVoice = activeTab === 'voices' ? clonedVoices.find(v => v.name === selectedId)   : null

  // ── Multi-select helpers ──────────────────────────────────────
  const currentList = activeTab === 'tts' ? filteredTTS.map(e => e.id) : filteredVoices.map(v => v.voice_id)
  const allChecked  = currentList.length > 0 && currentList.every(id => checkedIds.has(id))
  const someChecked = checkedIds.size > 0

  function enterSelectMode() { setSelectMode(true); setSelectedId(null); setCheckedIds(new Set()) }
  function exitSelectMode()  { setSelectMode(false); setCheckedIds(new Set()) }

  function toggleCheck(id) {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setCheckedIds(allChecked ? new Set() : new Set(currentList))
  }

  // ── Confirm delete ────────────────────────────────────────────
  function confirmDelete() {
    if (!deleteTarget) return
    if (deleteTarget.type === 'tts') {
      removeHistoryEntry(deleteTarget.id)
      if (selectedId === deleteTarget.id) setSelectedId(null)
    } else if (deleteTarget.type === 'voice') {
      removeClonedVoice(deleteTarget.id)
      if (selectedId === deleteTarget.id) setSelectedId(null)
    } else if (deleteTarget.type === 'clearAll') {
      clearHistory(); setSelectedId(null)
    } else if (deleteTarget.type === 'bulkTTS') {
      deleteTarget.ids.forEach(id => removeHistoryEntry(id))
      exitSelectMode()
    } else if (deleteTarget.type === 'bulkVoice') {
      deleteTarget.ids.forEach(name => removeClonedVoice(name))
      exitSelectMode()
    }
    setDeleteTarget(null)
  }

  // Replace the download function inside AudioPlayer
  async function download() {
    try {
      const res  = await fetch(src)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = label ? `${label}.mp3` : 'audio.mp3'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      window.open(src)   // fallback: open in new tab
    }
  }

  const deleteButtonStyle = {
    background: 'transparent', border: '1px solid transparent',
    color: t.labelColor, cursor: 'pointer',
    fontSize: '0.85rem', padding: '0.25rem 0.4rem',
    borderRadius: '6px', flexShrink: 0, transition: 'all 0.15s',
  }

  function Checkbox({ checked, onChange }) {
    return (
      <div onClick={(e) => { e.stopPropagation(); onChange() }} style={{
        width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
        border: checked ? '2px solid #7c3aed' : `2px solid ${isDark ? '#444' : '#ccc'}`,
        background: checked ? '#7c3aed' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.15s',
      }}>
        {checked && <span style={{ color: 'white', fontSize: '0.65rem', fontWeight: '700' }}>✓</span>}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 4rem)', margin: '-2rem', background: t.bg }}>

      {/* ── DELETE MODAL ── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: isDark ? '#13131f' : '#ffffff', border: `1px solid ${isDark ? '#2a2a4a' : '#e5e5e8'}`, borderRadius: '16px', padding: '2rem', width: '380px', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>🗑️</div>
            <div style={{ fontWeight: '700', fontSize: '1rem', color: t.textColor, marginBottom: '0.5rem' }}>
              {deleteTarget.type === 'clearAll'  ? 'Clear all history?' :
               deleteTarget.type === 'bulkTTS'   ? `Delete ${deleteTarget.ids.size} selected entries?` :
               deleteTarget.type === 'bulkVoice' ? `Delete ${deleteTarget.ids.size} selected voices?` :
               deleteTarget.type === 'voice'     ? `Delete "${deleteTarget.id}"?` : 'Delete this entry?'}
            </div>
            <div style={{ fontSize: '0.85rem', color: t.labelColor, marginBottom: '1.8rem', lineHeight: '1.6' }}>
              {deleteTarget.type === 'clearAll'  ? 'This will permanently remove all TTS history entries. This action cannot be undone.' :
               deleteTarget.type === 'bulkTTS'   ? `${deleteTarget.ids.size} generation${deleteTarget.ids.size > 1 ? 's' : ''} will be permanently deleted.` :
               deleteTarget.type === 'bulkVoice' ? `${deleteTarget.ids.size} voice${deleteTarget.ids.size > 1 ? 's' : ''} will be permanently removed.` :
               deleteTarget.type === 'voice'     ? `"${deleteTarget.id}" will be permanently removed from your library.` :
                                                   'This generation will be permanently deleted and cannot be recovered.'}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? '#2a2a4a' : '#e5e5e8'}`, background: 'transparent', color: t.textColor, fontSize: '0.88rem', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmDelete} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', fontSize: '0.88rem', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}>
                {deleteTarget.type === 'clearAll' ? 'Clear All' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CENTER ── */}
      <div style={{ flex: 6, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
        <div style={{ padding: '2.5rem 3rem 0' }}>

          {/* Title + Select button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: '700', color: t.textColor }}>History</div>
            {!selectMode
              ? <button onClick={enterSelectMode} style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: `1px solid ${t.rowBorder}`, background: 'transparent', color: t.labelColor, fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', fontFamily: "'Segoe UI', sans-serif" }}>Select</button>
              : <button onClick={exitSelectMode}  style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: `1px solid ${t.rowBorder}`, background: 'transparent', color: t.labelColor, fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', fontFamily: "'Segoe UI', sans-serif" }}>✕ Cancel</button>
            }
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${t.divider}`, marginBottom: '1.5rem' }}>
            {[{ key: 'tts', label: 'TTS History', count: history.length }, { key: 'voices', label: 'Cloned Voices', count: clonedVoices.length }].map(tab => (
              <button key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSelectedId(null); setSearch(''); exitSelectMode() }}
                style={{ background: 'transparent', border: 'none', borderBottom: activeTab === tab.key ? '2px solid #7c3aed' : '2px solid transparent', padding: '0.6rem 1.2rem', marginBottom: '-1px', color: activeTab === tab.key ? t.tabActive : t.tabInactive, fontWeight: activeTab === tab.key ? '600' : '400', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.15s', fontFamily: "'Segoe UI', sans-serif", display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {tab.label}
                <span style={{ background: activeTab === tab.key ? '#7c3aed22' : (isDark ? '#1e1e2e' : '#f0f0f3'), color: activeTab === tab.key ? '#a78bfa' : t.labelColor, padding: '0.1rem 0.5rem', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '600' }}>{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <span style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: t.labelColor, fontSize: '0.9rem' }}>🔍</span>
            <input type="text" placeholder={activeTab === 'tts' ? "Search by text or voice name..." : "Search cloned voices..."} value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 0.9rem 0.65rem 2.4rem', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '8px', color: t.textColor, fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Selection toolbar */}
          {selectMode && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.8rem', background: isDark ? '#13131f' : '#f9f9f9', border: `1px solid ${t.rowBorder}`, borderRadius: '8px', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }} onClick={toggleSelectAll}>
                <Checkbox checked={allChecked} onChange={toggleSelectAll} />
                <span style={{ fontSize: '0.84rem', color: t.textColor, fontWeight: '500' }}>{allChecked ? 'Deselect All' : 'Select All'}</span>
                {someChecked && <span style={{ fontSize: '0.78rem', color: t.labelColor }}>({checkedIds.size} selected)</span>}
              </div>
              {someChecked && (
                <button
                  onClick={() => setDeleteTarget(activeTab === 'tts' ? { type: 'bulkTTS', ids: new Set(checkedIds) } : { type: 'bulkVoice', ids: new Set(checkedIds) })}
                  style={{ padding: '0.4rem 0.9rem', borderRadius: '6px', border: '1px solid #ef444455', background: '#ef444415', color: '#ef4444', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', fontFamily: "'Segoe UI', sans-serif" }}
                  onMouseEnter={e => e.currentTarget.style.background = '#ef444425'}
                  onMouseLeave={e => e.currentTarget.style.background = '#ef444415'}
                >🗑 Delete {checkedIds.size} selected</button>
              )}
            </div>
          )}
        </div>

        {/* List */}
        <div style={{ padding: '0 3rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

          {/* TTS list */}
          {activeTab === 'tts' && (
            filteredTTS.length === 0 ? (
              <div style={{ textAlign: 'center', color: t.labelColor, fontSize: '0.88rem', paddingTop: '4rem' }}>
                {history.length === 0 ? "No generations yet. Go to Text to Speech and generate some audio!" : "No results match your search."}
              </div>
            ) : filteredTTS.map(entry => {
              const isChecked  = checkedIds.has(entry.id)
              const isSelected = selectedId === entry.id && !selectMode
              return (
                <div key={entry.id}
                  onClick={() => selectMode ? toggleCheck(entry.id) : setSelectedId(entry.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.85rem 1rem', background: isChecked ? t.rowChecked : isSelected ? t.rowSelected : t.rowBg, border: `1px solid ${isChecked ? t.rowCheckedBorder : isSelected ? t.rowSelectedBorder : t.rowBorder}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (!isSelected && !isChecked) e.currentTarget.style.background = t.rowHover }}
                  onMouseLeave={e => { if (!isSelected && !isChecked) e.currentTarget.style.background = t.rowBg }}
                >
                  {selectMode
                    ? <Checkbox checked={isChecked} onChange={() => toggleCheck(entry.id)} />
                    : <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, ${entry.voice?.color}cc, ${entry.voice?.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '0.85rem', flexShrink: 0 }}>{entry.voice?.name[0]}</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '500', fontSize: '0.88rem', color: t.textColor, marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{truncate(entry.text)}</div>
                    <div style={{ color: t.labelColor, fontSize: '0.74rem' }}>{entry.voice?.name} · {LANGUAGE_NAMES[entry.language] || entry.language} · {entry.speed}x · {formatDate(entry.timestamp)}</div>
                  </div>
                  {!selectMode && (
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'tts', id: entry.id }) }} title="Delete" style={deleteButtonStyle}
                      onMouseEnter={e => { e.currentTarget.style.background = '#ef444420'; e.currentTarget.style.borderColor = '#ef444455'; e.currentTarget.style.color = '#ef4444' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = t.labelColor }}>🗑</button>
                  )}
                </div>
              )
            })
          )}

          {/* Voices list */}
          {activeTab === 'voices' && (
            filteredVoices.length === 0 ? (
              <div style={{ textAlign: 'center', color: t.labelColor, fontSize: '0.88rem', paddingTop: '4rem' }}>
                {clonedVoices.length === 0 ? "No cloned voices yet. Go to Voices and clone your first voice!" : "No results match your search."}
              </div>
            ) : filteredVoices.map((v, i) => {
              const isChecked  = checkedIds.has(v.voice_id)
              const isSelected = selectedId === v.name && !selectMode
              return (
                <div key={i}
                  onClick={() => selectMode ? toggleCheck(v.voice_id) : setSelectedId(v.name)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.85rem 1rem', background: isChecked ? t.rowChecked : isSelected ? t.rowSelected : t.rowBg, border: `1px solid ${isChecked ? t.rowCheckedBorder : isSelected ? t.rowSelectedBorder : t.rowBorder}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (!isSelected && !isChecked) e.currentTarget.style.background = t.rowHover }}
                  onMouseLeave={e => { if (!isSelected && !isChecked) e.currentTarget.style.background = t.rowBg }}
                >
                  {selectMode
                    ? <Checkbox checked={isChecked} onChange={() => toggleCheck(v.voice_id)} />
                    : <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, ${v.color}cc, ${v.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '0.85rem', flexShrink: 0 }}>{v.name[0]}</div>
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '0.88rem', color: t.textColor }}>{v.name}</div>
                    <div style={{ color: t.labelColor, fontSize: '0.74rem' }}>Cloned voice · Available in Studio</div>
                  </div>
                  <div style={{ background: '#7c3aed18', color: '#a78bfa', padding: '0.15rem 0.5rem', borderRadius: '20px', fontSize: '0.72rem', border: '1px solid #7c3aed33', flexShrink: 0 }}>Custom</div>
                  {!selectMode && (
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'voice', id: v.voice_id }) }} title="Delete" style={deleteButtonStyle}
                      onMouseEnter={e => { e.currentTarget.style.background = '#ef444420'; e.currentTarget.style.borderColor = '#ef444455'; e.currentTarget.style.color = '#ef4444' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = t.labelColor }}>🗑</button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{ flex: 4, borderLeft: `1px solid ${t.panelBorder}`, padding: '2.5rem 1.8rem', display: 'flex', flexDirection: 'column', overflowY: 'auto', background: t.panelBg }}>

        {/* TTS detail */}
        {activeTab === 'tts' && selectedTTS && !selectMode && (
          <>
            <div style={{ fontSize: '0.95rem', fontWeight: '600', color: t.textColor, marginBottom: '1.5rem' }}>Generation Detail</div>

            <div style={{ marginBottom: '1.2rem' }}>
              <div style={{ fontSize: '0.78rem', color: t.labelColor, marginBottom: '0.5rem', fontWeight: '600', letterSpacing: '0.4px' }}>VOICE</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.7rem 0.9rem', background: t.rowBg, border: `1px solid ${t.rowBorder}`, borderRadius: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, ${selectedTTS.voice?.color}cc, ${selectedTTS.voice?.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '0.75rem', flexShrink: 0 }}>{selectedTTS.voice?.name[0]}</div>
                <span style={{ fontSize: '0.88rem', color: t.textColor, fontWeight: '500' }}>{selectedTTS.voice?.name}</span>
                {selectedTTS.voice?.type === 'cloned' && <span style={{ background: '#7c3aed18', color: '#a78bfa', padding: '0.1rem 0.4rem', borderRadius: '10px', fontSize: '0.7rem', border: '1px solid #7c3aed33' }}>Custom</span>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.7rem', marginBottom: '1.2rem' }}>
              <div style={{ flex: 1, padding: '0.65rem 0.9rem', background: t.rowBg, border: `1px solid ${t.rowBorder}`, borderRadius: '10px' }}>
                <div style={{ fontSize: '0.72rem', color: t.labelColor, marginBottom: '0.2rem' }}>LANGUAGE</div>
                <div style={{ fontSize: '0.85rem', color: t.textColor, fontWeight: '500' }}>{LANGUAGE_NAMES[selectedTTS.language] || selectedTTS.language}</div>
              </div>
              <div style={{ flex: 1, padding: '0.65rem 0.9rem', background: t.rowBg, border: `1px solid ${t.rowBorder}`, borderRadius: '10px' }}>
                <div style={{ fontSize: '0.72rem', color: t.labelColor, marginBottom: '0.2rem' }}>SPEED</div>
                <div style={{ fontSize: '0.85rem', color: t.textColor, fontWeight: '500' }}>{selectedTTS.speed}x</div>
              </div>
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <div style={{ fontSize: '0.78rem', color: t.labelColor, marginBottom: '0.5rem', fontWeight: '600', letterSpacing: '0.4px' }}>TEXT</div>
              <div style={{ padding: '0.9rem', background: t.rowBg, border: `1px solid ${t.rowBorder}`, borderRadius: '10px', fontSize: '0.85rem', color: t.textColor, lineHeight: '1.7', maxHeight: '180px', overflowY: 'auto' }}>{selectedTTS.text}</div>
            </div>

            {/* ── Custom audio player for TTS ── */}
            <div style={{ marginBottom: '1.2rem' }}>
              <div style={{ fontSize: '0.78rem', color: t.labelColor, marginBottom: '0.5rem', fontWeight: '600', letterSpacing: '0.4px' }}>AUDIO</div>
              <AudioPlayer
                src={selectedTTS.audioUrl}
                isDark={isDark}
                label={selectedTTS.voice?.name}
              />
            </div>

            <div style={{ fontSize: '0.74rem', color: t.labelColor }}>{formatDate(selectedTTS.timestamp)}</div>

            <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
              <div style={{ borderTop: `1px solid ${t.divider}`, marginBottom: '1.5rem' }} />
              <button onClick={() => setDeleteTarget({ type: 'tts', id: selectedTTS.id })}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`, background: 'transparent', color: '#ef4444', fontSize: '0.88rem', fontWeight: '600', cursor: 'pointer' }}>
                🗑 Delete Entry
              </button>
            </div>
          </>
        )}

        {/* Voice detail */}
        {activeTab === 'voices' && selectedVoice && !selectMode && (
          <>
            <div style={{ fontSize: '0.95rem', fontWeight: '600', color: t.textColor, marginBottom: '1.5rem' }}>Voice Detail</div>

            {/* Voice avatar card */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: t.rowBg, border: `1px solid ${t.rowBorder}`, borderRadius: '12px', marginBottom: '1.5rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, ${selectedVoice.color}cc, ${selectedVoice.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '1.1rem', flexShrink: 0 }}>{selectedVoice.name[0]}</div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '1rem', color: t.textColor }}>{selectedVoice.name}</div>
                <div style={{ color: t.labelColor, fontSize: '0.78rem' }}>Cloned voice · Available in Studio</div>
              </div>
            </div>

            {/* ── Custom audio player for cloned voice — always shown ── */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.78rem', color: t.labelColor, marginBottom: '0.5rem', fontWeight: '600', letterSpacing: '0.4px' }}>VOICE SAMPLE</div>
              <AudioPlayer
                src={getAudioUrl(selectedVoice)}
                isDark={isDark}
                accentColor={selectedVoice.color}
                label={selectedVoice.name}
              />
            </div>

            <div style={{ padding: '0.8rem 1rem', background: isDark ? '#0f2a1a' : '#f0fdf4', border: `1px solid ${isDark ? '#14532d' : '#bbf7d0'}`, borderRadius: '8px', fontSize: '0.82rem', color: isDark ? '#86efac' : '#16a34a', marginBottom: '1.5rem' }}>
              ✅ This voice is available in Text to Speech Studio
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
              <div style={{ borderTop: `1px solid ${t.divider}`, marginBottom: '1.5rem' }} />
              <button onClick={() => setDeleteTarget({ type: 'voice', id: selectedVoice.voice_id })}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`, background: 'transparent', color: '#ef4444', fontSize: '0.88rem', fontWeight: '600', cursor: 'pointer' }}>
                🗑 Delete Voice
              </button>
            </div>
          </>
        )}

        {/* Empty / select mode */}
        {((!selectedTTS && !selectedVoice) || selectMode) && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: t.labelColor, textAlign: 'center', gap: '0.5rem' }}>
            <div style={{ fontSize: '2rem' }}>{selectMode ? '☑️' : activeTab === 'tts' ? '🔊' : '🎙️'}</div>
            <div style={{ fontSize: '0.88rem' }}>
              {selectMode ? `${checkedIds.size} item${checkedIds.size !== 1 ? 's' : ''} selected` : activeTab === 'tts' ? 'Select a generation to see details' : 'Select a voice to see details'}
            </div>
            {selectMode && checkedIds.size === 0 && <div style={{ fontSize: '0.78rem', color: t.labelColor, marginTop: '0.25rem' }}>Check items in the list to select them</div>}
          </div>
        )}

        {/* Clear all */}
        {activeTab === 'tts' && history.length > 0 && !selectedTTS && !selectMode && (
          <div style={{ marginTop: 'auto' }}>
            <div style={{ borderTop: `1px solid ${t.divider}`, marginBottom: '1.5rem' }} />
            <button onClick={() => setDeleteTarget({ type: 'clearAll' })}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${t.rowBorder}`, background: 'transparent', color: t.labelColor, fontSize: '0.88rem', cursor: 'pointer' }}>
              Clear All History
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default History