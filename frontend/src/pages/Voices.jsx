import { useState, useRef } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useVoices } from '../context/VoicesContext'
import { useAuth } from '../context/AuthContext'

const ALLOWED_FORMATS = ['audio/wav', 'audio/mpeg', 'audio/mp3']
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

async function analyzeVoice(audioUrl) {
  const response = await fetch(audioUrl)
  const arrayBuffer = await response.arrayBuffer()
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  await audioCtx.close()
  const channelData = audioBuffer.getChannelData(0)
  const sampleRate = audioBuffer.sampleRate
  let sumSquares = 0
  for (let i = 0; i < channelData.length; i++) sumSquares += channelData[i] ** 2
  const rms = Math.sqrt(sumSquares / channelData.length)
  let zeroCrossings = 0
  for (let i = 1; i < channelData.length; i++) {
    if ((channelData[i] >= 0) !== (channelData[i - 1] >= 0)) zeroCrossings++
  }
  const zcr = zeroCrossings / channelData.length
  let peak = 0
  for (let i = 0; i < channelData.length; i++) {
    if (Math.abs(channelData[i]) > peak) peak = Math.abs(channelData[i])
  }
  const frameSize = Math.floor(sampleRate * 0.02)
  const frameEnergies = []
  for (let i = 0; i + frameSize < channelData.length; i += frameSize) {
    let e = 0
    for (let j = i; j < i + frameSize; j++) e += channelData[j] ** 2
    frameEnergies.push(Math.sqrt(e / frameSize))
  }
  const avgEnergy = frameEnergies.reduce((a, b) => a + b, 0) / frameEnergies.length
  const energyVariance = frameEnergies.reduce((a, b) => a + (b - avgEnergy) ** 2, 0) / frameEnergies.length
  const dynamism = Math.sqrt(energyVariance)
  return { rms, zcr, peak, duration: audioBuffer.duration, dynamism }
}

function generatePoeticDescription(name, metrics) {
  const { rms, zcr, peak, dynamism } = metrics
  const isLoud       = rms > 0.08
  const isBright     = zcr > 0.08
  const isDynamic    = dynamism > 0.04
  const isControlled = peak < 0.7
  const presenceLine = isLoud ? "Your voice fills the room before you finish your first word." : "Your voice draws people closer — quiet, but impossible to ignore."
  const toneLine     = isBright ? "There's a crisp, glass-like clarity to your tone — each syllable lands clean and precise." : "Your tone carries a warmth that settles like late afternoon light — rich and unhurried."
  const dynamismLine = isDynamic ? "The energy in your voice moves like a conversation you never want to end — alive, shifting, present." : "There's a steadiness to how you speak, a groundedness that makes people feel safe listening."
  const controlLine  = isControlled ? "Even at full expression, your voice stays measured — the kind of control that takes years to earn." : "Your voice doesn't hold back. It peaks boldly, unafraid of being heard."
  const closingOptions = [
    `In another life, ${name} would narrate documentaries about things that actually matter.`,
    `The kind of voice that sounds different on recordings — better, somehow, more real.`,
    `People probably ask you to repeat things. Not because they didn't hear you — because they wanted to again.`,
    `If your voice had a color, it wouldn't be one word. It would be a gradient.`,
  ]
  const closingIndex = Math.floor((rms * 100 + zcr * 100) % closingOptions.length)
  return { presenceLine, toneLine, dynamismLine, controlLine, closing: closingOptions[closingIndex] }
}

function getAudioUrl(v) {
  return v.audio_url || v.previewUrl || `${BACKEND}/api/audio/${v.voice_id}.wav`
}

function Voices() {
  const { isDark } = useTheme()
  const { clonedVoices, addClonedVoice, removeClonedVoice, DEFAULT_VOICES } = useVoices()
  const { useGuestCredit, authFetch } = useAuth()   // ← credit gate

  const [uploading, setUploading]             = useState(false)
  const [dragOver, setDragOver]               = useState(false)
  const [error, setError]                     = useState(null)
  const [success, setSuccess]                 = useState(null)
  const [voiceName, setVoiceName]             = useState("")
  const [uploadedFile, setUploadedFile]       = useState(null)
  const [pendingFile, setPendingFile]         = useState(null)

  const [recording, setRecording]             = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef   = useRef([])
  const timerRef         = useRef(null)

  const [previewingVoice, setPreviewingVoice] = useState(null)
  const [previewUrls, setPreviewUrls]         = useState({})
  const [playingVoice, setPlayingVoice]       = useState(null)
  const [analyzingVoice, setAnalyzingVoice]   = useState(null)
  const [analysisResults, setAnalysisResults] = useState({})
  const [expandedAnalysis, setExpandedAnalysis] = useState(null)
  const [deleteTarget, setDeleteTarget]       = useState(null)

  const t = {
    bg:             isDark ? '#0d0d14' : '#ffffff',
    panelBg:        isDark ? '#0d0d14' : '#ffffff',
    panelBorder:    isDark ? '#1e1e2e' : '#e5e5e8',
    textColor:      isDark ? '#e2e8f0' : '#111118',
    labelColor:     isDark ? '#666'    : '#888',
    divider:        isDark ? '#1e1e2e' : '#efefef',
    uploadBg:       isDark ? '#13131f' : '#fafafa',
    uploadBorder:   isDark ? '#2a2a3a' : '#d5d5d8',
    uploadHoverBorder: '#7c3aed',
    inputBg:        isDark ? '#13131f' : '#ffffff',
    inputBorder:    isDark ? '#2a2a4a' : '#d5d5d8',
    rowBg:          isDark ? '#13131f' : '#f9f9f9',
    rowBorder:      isDark ? '#1e1e2e' : '#e5e5e8',
    analysisBg:     isDark ? '#0e0e1c' : '#faf8ff',
    analysisBorder: isDark ? '#2a2040' : '#e0d8ff',
  }

  function validateFile(file) {
    if (!ALLOWED_FORMATS.includes(file.type)) return "Only .wav or .mp3 files are allowed."
    if (file.size > 5 * 1024 * 1024) return "File too large. Maximum size is 5MB."
    return null
  }

  async function handleUpload(file) {
    setError(null); setSuccess(null)
    const validationError = validateFile(file)
    if (validationError) { setError(validationError); return }
    if (!voiceName.trim()) {
      setPendingFile(file); setUploadedFile(file)
      setError("Please give your voice a name, then click Add Voice.")
      return
    }

    // ── FREEMIUM GATE: consume 1 clone credit if guest ──
    if (!useGuestCredit('clone')) return   // modal opened automatically

    setPendingFile(null); setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await authFetch(`${BACKEND}/api/clone-voice`, { method: "POST", body: formData })
      const data = await response.json()
      const previewUrl = URL.createObjectURL(file)
      addClonedVoice({
        name: voiceName.trim(),
        color: `hsl(${Math.random() * 360}, 70%, 55%)`,
        type: "cloned",
        voice_id: data.voice_id,
        previewUrl,
      })
      setVoiceName(""); setUploadedFile(null)
      setSuccess(`"${voiceName}" cloned successfully! You can now use it in the Studio.`)
    } catch {
      setError("Upload failed. Make sure the backend is running.")
    }
    setUploading(false)
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) { setUploadedFile(file); setError(null); handleUpload(file) }
  }

  function handleFileInput(e) {
    const file = e.target.files[0]
    if (file) { setUploadedFile(file); setError(null); handleUpload(file) }
    e.target.value = ''
  }

  function handleAddVoiceClick() {
    if (pendingFile) handleUpload(pendingFile)
    else document.getElementById('voice-upload').click()
  }

  async function startRecording() {
    setError(null); setSuccess(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        const file = new File([blob], 'recorded_voice.wav', { type: 'audio/wav' })
        setUploadedFile(file); setError(null); handleUpload(file)
        stream.getTracks().forEach(track => track.stop())
        clearInterval(timerRef.current); setRecordingSeconds(0)
      }
      mediaRecorder.start(); setRecording(true); setRecordingSeconds(0)
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => { if (prev >= 30) { stopRecording(); return prev } return prev + 1 })
      }, 1000)
    } catch {
      setError("Microphone access denied. Please allow microphone permissions.")
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) { mediaRecorderRef.current.stop(); setRecording(false) }
  }

  async function previewDefaultVoice(vName) {
    if (previewUrls[vName]) { setPreviewingVoice(vName); return }
    setPreviewingVoice(vName)
    try {
      const response = await authFetch(`${BACKEND}/api/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `Hi, I'm ${vName}. How can I help you today?`, speaker: vName, language: "en", speed: 1.0 })
      })
      const data = await response.json()
      setPreviewUrls(prev => ({ ...prev, [vName]: `${BACKEND}/api/audio/${data.file}` }))
    } catch {
      setPreviewingVoice(null)
      setError("Preview failed. Make sure the backend is running.")
    }
  }

  async function handleAnalyze(v) {
    if (expandedAnalysis === v.name) { setExpandedAnalysis(null); return }
    if (analysisResults[v.name]) { setExpandedAnalysis(v.name); return }
    setAnalyzingVoice(v.name)
    try {
      const metrics = await analyzeVoice(getAudioUrl(v))
      const poetic  = generatePoeticDescription(v.name, metrics)
      setAnalysisResults(prev => ({ ...prev, [v.name]: poetic }))
      setExpandedAnalysis(v.name)
    } catch {
      setError("Analysis failed. Please try again.")
    }
    setAnalyzingVoice(null)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    removeClonedVoice(deleteTarget)
    setAnalysisResults(prev => { const n = { ...prev }; delete n[deleteTarget]; return n })
    if (expandedAnalysis === deleteTarget) setExpandedAnalysis(null)
    if (playingVoice === deleteTarget) setPlayingVoice(null)
    setDeleteTarget(null)
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 4rem)', margin: '-2rem', background: t.bg }}>

      {/* Delete modal */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: isDark ? '#13131f' : '#ffffff', border: `1px solid ${isDark ? '#2a2a4a' : '#e5e5e8'}`, borderRadius: '16px', padding: '2rem', width: '360px', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>🗑️</div>
            <div style={{ fontWeight: '700', fontSize: '1rem', color: t.textColor, marginBottom: '0.5rem' }}>Delete "{deleteTarget}"?</div>
            <div style={{ fontSize: '0.85rem', color: t.labelColor, marginBottom: '1.8rem', lineHeight: '1.6' }}>This voice will be permanently removed from your library and will no longer appear in the Studio or History.</div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: `1px solid ${isDark ? '#2a2a4a' : '#e5e5e8'}`, background: 'transparent', color: t.textColor, fontSize: '0.88rem', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmDelete} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', fontSize: '0.88rem', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}>Delete Voice</button>
            </div>
          </div>
        </div>
      )}

      {/* CENTER */}
      <div style={{ flex: 6, display: 'flex', flexDirection: 'column', padding: '2.5rem 3rem', minWidth: 0, overflowY: 'auto' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: '600', color: t.textColor, marginBottom: '1.5rem' }}>Voices</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !recording && document.getElementById('voice-upload').click()}
            style={{ flex: 1, minHeight: '320px', border: `1.5px dashed ${dragOver ? t.uploadHoverBorder : recording ? '#ef4444' : t.uploadBorder}`, borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: recording ? 'default' : 'pointer', background: dragOver ? (isDark ? '#1a1a2e' : '#f5f0ff') : recording ? (isDark ? '#2a1a1a' : '#fff5f5') : t.uploadBg, transition: 'all 0.2s ease', gap: '0.8rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: recording ? '#ef444422' : (isDark ? '#1e1e2e' : '#f0f0f3'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
              {recording ? '🔴' : uploadedFile ? '✅' : '📁'}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: '600', fontSize: '0.95rem', color: recording ? '#ef4444' : t.textColor, marginBottom: '0.3rem' }}>
                {recording ? `Recording... ${recordingSeconds}s / 30s` : uploading ? "Uploading & cloning voice..." : uploadedFile ? `✓ ${uploadedFile.name}` : "Click to upload, or drag and drop"}
              </div>
              <div style={{ color: t.labelColor, fontSize: '0.82rem' }}>{recording ? "Click Stop when done" : ".wav or .mp3 • 6–30 seconds • max 5MB"}</div>
            </div>
            {!uploading && !recording && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', width: '200px' }}>
                  <div style={{ flex: 1, height: '1px', background: t.divider }} />
                  <span style={{ color: t.labelColor, fontSize: '0.8rem' }}>or</span>
                  <div style={{ flex: 1, height: '1px', background: t.divider }} />
                </div>
                <button onClick={(e) => { e.stopPropagation(); startRecording() }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.2rem', background: 'transparent', border: `1px solid ${t.uploadBorder}`, borderRadius: '20px', color: t.textColor, fontSize: '0.85rem', cursor: 'pointer', fontFamily: "'Segoe UI', sans-serif" }}>
                  🎙️ Record audio
                </button>
              </>
            )}
            {recording && (
              <button onClick={(e) => { e.stopPropagation(); stopRecording() }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.4rem', background: '#ef4444', border: 'none', borderRadius: '20px', color: 'white', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>
                ⏹ Stop Recording
              </button>
            )}
            <input id="voice-upload" type="file" accept=".wav,.mp3,audio/wav,audio/mpeg" style={{ display: 'none' }} onChange={handleFileInput} />
          </div>

          {error   && <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: isDark ? '#2a1a1a' : '#fff5f5', border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}`, borderRadius: '8px', color: '#ef4444', fontSize: '0.85rem' }}>⚠️ {error}</div>}
          {success && <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: isDark ? '#0f2a1a' : '#f0fdf4', border: `1px solid ${isDark ? '#14532d' : '#bbf7d0'}`, borderRadius: '8px', color: '#22c55e', fontSize: '0.85rem' }}>✅ {success}</div>}

          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderTop: `1px solid ${t.divider}`, color: t.labelColor, fontSize: '0.8rem' }}>
            <span>{clonedVoices.length} cloned voice{clonedVoices.length !== 1 ? 's' : ''}</span>
            <span>XTTS v2 • Up to 30s sample</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex: 4, borderLeft: `1px solid ${t.panelBorder}`, padding: '2.5rem 1.8rem', display: 'flex', flexDirection: 'column', overflowY: 'auto', background: t.panelBg }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: '600', color: t.textColor, marginBottom: '0.8rem' }}>Voice Name</div>
          <input type="text" placeholder="e.g. My Voice, John Narrator..."
            value={voiceName}
            onChange={(e) => { setVoiceName(e.target.value); if (e.target.value.trim()) setError(null) }}
            style={{ width: '100%', padding: '0.7rem 0.9rem', background: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: '8px', color: t.textColor, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <div style={{ borderTop: `1px solid ${t.divider}`, marginBottom: '1.5rem' }} />

        {/* Cloned voices list */}
        {clonedVoices.length > 0 && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: '600', color: t.textColor, marginBottom: '0.8rem' }}>Your Cloned Voices</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {clonedVoices.map((v, i) => (
                  <div key={i}>
                    <div style={{ background: t.rowBg, border: `1px solid ${expandedAnalysis === v.name ? t.analysisBorder : t.rowBorder}`, borderRadius: expandedAnalysis === v.name ? '10px 10px 0 0' : '10px', padding: '0.75rem 0.9rem', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, ${v.color}cc, ${v.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '0.82rem', flexShrink: 0 }}>{v.name[0]}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '600', fontSize: '0.88rem', color: t.textColor }}>{v.name}</div>
                          <div style={{ color: t.labelColor, fontSize: '0.74rem' }}>Cloned voice</div>
                        </div>
                        <div style={{ background: '#7c3aed18', color: '#a78bfa', padding: '0.15rem 0.5rem', borderRadius: '20px', fontSize: '0.7rem', border: '1px solid #7c3aed33', flexShrink: 0 }}>Custom</div>
                        <button onClick={() => setPlayingVoice(playingVoice === v.name ? null : v.name)} title={playingVoice === v.name ? "Hide player" : "Play"}
                          style={{ width: '30px', height: '30px', borderRadius: '50%', background: playingVoice === v.name ? '#7c3aed22' : 'transparent', border: `1px solid ${playingVoice === v.name ? '#7c3aed55' : t.rowBorder}`, color: playingVoice === v.name ? '#a78bfa' : t.textColor, cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                          {playingVoice === v.name ? '■' : '▶'}
                        </button>
                        <button onClick={() => handleAnalyze(v)} disabled={analyzingVoice === v.name} title="Analyze your voice"
                          style={{ width: '30px', height: '30px', borderRadius: '50%', background: expandedAnalysis === v.name ? '#7c3aed22' : 'transparent', border: `1px solid ${expandedAnalysis === v.name ? '#7c3aed55' : t.rowBorder}`, color: expandedAnalysis === v.name ? '#a78bfa' : t.textColor, cursor: analyzingVoice === v.name ? 'wait' : 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                          {analyzingVoice === v.name ? '⏳' : '✨'}
                        </button>
                        <button onClick={() => setDeleteTarget(v.voice_id)} title="Delete voice"
                          style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'transparent', border: `1px solid ${t.rowBorder}`, color: t.labelColor, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#ef444422'; e.currentTarget.style.borderColor = '#ef444455'; e.currentTarget.style.color = '#ef4444' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = t.rowBorder; e.currentTarget.style.color = t.labelColor }}>🗑</button>
                      </div>
                      {playingVoice === v.name && (
                        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: `1px solid ${t.divider}` }}>
                          <audio controls autoPlay src={getAudioUrl(v)} style={{ width: '100%', height: '32px' }} />
                        </div>
                      )}
                    </div>
                    {expandedAnalysis === v.name && analysisResults[v.name] && (() => {
                      const p = analysisResults[v.name]
                      return (
                        <div style={{ background: t.analysisBg, border: `1px solid ${t.analysisBorder}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '1.2rem 1rem' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#a78bfa', letterSpacing: '0.8px', marginBottom: '0.9rem', textTransform: 'uppercase' }}>✨ Voice Analysis — {v.name}</div>
                          {[p.presenceLine, p.toneLine, p.dynamismLine, p.controlLine].map((line, idx) => (
                            <div key={idx} style={{ fontSize: '0.82rem', color: t.textColor, lineHeight: '1.7', marginBottom: '0.6rem', paddingLeft: '0.8rem', borderLeft: `2px solid ${['#a78bfa', '#7c3aed', '#c084fc', '#818cf8'][idx]}` }}>{line}</div>
                          ))}
                          <div style={{ marginTop: '0.8rem', padding: '0.75rem', background: isDark ? '#1a1a2e' : '#f0ecff', borderRadius: '8px', fontSize: '0.8rem', color: '#a78bfa', fontStyle: 'italic', lineHeight: '1.6' }}>"{p.closing}"</div>
                        </div>
                      )
                    })()}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${t.divider}`, marginBottom: '1.5rem' }} />
          </>
        )}

        {/* Default voices */}
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: '600', color: t.textColor, marginBottom: '0.8rem' }}>Default Voices</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {DEFAULT_VOICES.map((v, i) => (
              <div key={i} style={{ background: t.rowBg, border: `1px solid ${t.rowBorder}`, borderRadius: '10px', padding: '0.7rem 0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, ${v.color}cc, ${v.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '0.8rem', flexShrink: 0 }}>{v.name[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '0.88rem', color: t.textColor }}>{v.name}</div>
                    <div style={{ color: t.labelColor, fontSize: '0.74rem' }}>Default voice</div>
                  </div>
                  <button onClick={() => previewDefaultVoice(v.name)} disabled={previewingVoice === v.name && !previewUrls[v.name]}
                    style={{ background: 'transparent', border: `1px solid ${t.rowBorder}`, borderRadius: '20px', color: t.textColor, padding: '0.25rem 0.75rem', fontSize: '0.78rem', cursor: previewingVoice === v.name && !previewUrls[v.name] ? 'not-allowed' : 'pointer', flexShrink: 0, transition: 'all 0.15s' }}>
                    {previewingVoice === v.name && !previewUrls[v.name] ? '⏳ Loading...' : '▶ Preview'}
                  </button>
                </div>
                {previewUrls[v.name] && previewingVoice === v.name && (
                  <div style={{ marginTop: '0.7rem' }}>
                    <audio controls autoPlay src={previewUrls[v.name]} style={{ width: '100%', height: '32px' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add Voice button */}
        <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
          <div style={{ borderTop: `1px solid ${t.divider}`, marginBottom: '1.5rem' }} />
          {pendingFile && !voiceName.trim() && (
            <div style={{ marginBottom: '0.8rem', fontSize: '0.8rem', color: '#a78bfa', textAlign: 'center' }}>
              📎 "{pendingFile.name}" ready — enter a name above then click Add Voice
            </div>
          )}
          <button onClick={handleAddVoiceClick} disabled={uploading || recording}
            style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: 'none', fontSize: '0.9rem', fontWeight: '700', cursor: uploading || recording ? 'not-allowed' : 'pointer', background: uploading || recording ? (isDark ? '#1e1e2e' : '#e5e5e8') : 'linear-gradient(135deg, #7c3aed, #a855f7)', color: uploading || recording ? (isDark ? '#444' : '#aaa') : 'white', boxShadow: uploading || recording ? 'none' : '0 4px 16px rgba(124,58,237,0.3)', transition: 'all 0.2s ease' }}>
            {uploading ? "⏳ Cloning voice..." : recording ? "🔴 Recording..." : pendingFile ? "🎤 Add Voice (file ready)" : "🎤 Add Voice"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Voices