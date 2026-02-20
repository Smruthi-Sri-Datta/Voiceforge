import { useState } from 'react'

function Studio() {
  const [text, setText] = useState("")
  const [voice, setVoice] = useState("Ana Florence")
  const [audioUrl, setAudioUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  const voices = ["Ana Florence", "Claribel Dervla", "Daisy Studious", "Gracie Wise"]

  async function generateAudio() {
    setLoading(true)
    const response = await fetch("http://localhost:8000/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speaker: voice })
    })
    const data = await response.json()
    setAudioUrl(`http://localhost:8000/api/audio/${data.file}`)
    setLoading(false)
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>VoiceForge Studio</h1>
      <textarea
        rows={5}
        style={{ width: "100%", marginTop: "1rem" }}
        placeholder="Type your text here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <select value={voice} onChange={(e) => setVoice(e.target.value)}>
        {voices.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <button onClick={generateAudio} disabled={loading}>
        {loading ? "Generating..." : "Generate Audio"}
      </button>
      {audioUrl && <audio controls src={audioUrl} style={{ marginTop: "1rem", display: "block" }} />}
    </div>
  )
}

export default Studio