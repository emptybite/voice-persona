import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from './api'
import type { Profile } from './api'

type ChatMsg = {
  role: 'user' | 'assistant'
  text: string
}

const sessionId = () => `react-${Math.random().toString(16).slice(2, 10)}`

function App() {
  const [status, setStatus] = useState('Ready.')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [voices, setVoices] = useState<string[]>([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [currentSession, setCurrentSession] = useState(sessionId())
  const [loading, setLoading] = useState(false)

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  )

  async function loadAll() {
    setLoading(true)
    setStatus('Loading health, profiles, and model catalog...')
    try {
      await api.health()
      const [profileData, modelData] = await Promise.all([api.profiles(), api.ttsModels()])
      setProfiles(profileData)
      const initialProfile = profileData[0]?.id ?? ''
      if (!selectedProfileId && initialProfile) {
        setSelectedProfileId(initialProfile)
      }

      const modelList = modelData.models.length ? modelData.models : [modelData.default_model]
      setModels(modelList)
      const preferredModel = selectedModel || modelData.default_model || modelList[0] || ''
      setSelectedModel(preferredModel)

      const voiceData = await api.voices(preferredModel || undefined)
      setVoices(voiceData.voices)
      setSelectedVoice(voiceData.default_voice || voiceData.voices[0] || '')
      setStatus('Loaded successfully.')
    } catch (err) {
      setStatus(`Load failed: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  async function refreshVoices(modelOverride?: string) {
    const model = modelOverride ?? selectedModel
    if (!model) {
      setStatus('Select a TTS model first.')
      return
    }
    setStatus(`Loading voices for ${model}...`)
    try {
      const data = await api.voices(model)
      setVoices(data.voices)
      setSelectedVoice(data.default_voice || data.voices[0] || '')
      setStatus(`Loaded ${data.voices.length} voices.`)
    } catch (err) {
      setStatus(`Voice load failed: ${(err as Error).message}`)
    }
  }

  async function sendChat(ev: FormEvent) {
    ev.preventDefault()
    const content = message.trim()
    if (!selectedProfileId || !content) {
      setStatus('Select a profile and type a message.')
      return
    }

    setLoading(true)
    setMessages((prev) => [...prev, { role: 'user', text: content }])
    setMessage('')
    setStatus('Waiting for assistant reply...')

    try {
      const reply = await api.chat({
        profile_id: selectedProfileId,
        session_id: currentSession,
        user_message: content,
        temperature: 0.3,
      })
      setMessages((prev) => [...prev, { role: 'assistant', text: reply.assistant_message }])
      setStatus('Reply received.')
    } catch (err) {
      setStatus(`Chat failed: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="hero card">
        <p className="kicker">React Frontend</p>
        <h1>Voice Persona Studio</h1>
        <p>Modern React shell wired to your existing FastAPI routes.</p>
        <div className="hero-actions">
          <button onClick={() => void loadAll()} disabled={loading}>
            Load Data
          </button>
          <button
            className="ghost"
            onClick={() => {
              setCurrentSession(sessionId())
              setMessages([])
              setStatus('Started a new session.')
            }}
            disabled={loading}
          >
            New Session
          </button>
        </div>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Profile</h2>
          <label>Profile</label>
          <select
            value={selectedProfileId}
            onChange={(e) => {
              setSelectedProfileId(e.target.value)
              const profile = profiles.find((p) => p.id === e.target.value)
              if (profile) {
                setSelectedVoice(profile.voice.voice || '')
              }
            }}
          >
            <option value="">Select profile...</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <label>TTS Model</label>
          <select
            value={selectedModel}
            onChange={(e) => {
              setSelectedModel(e.target.value)
              void refreshVoices(e.target.value)
            }}
          >
            <option value="">Select model...</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <label>Voice</label>
          <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)}>
            <option value="">Select voice...</option>
            {voices.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <button className="ghost" onClick={() => void refreshVoices()} disabled={loading}>
            Refresh Voices
          </button>
        </section>

        <section className="card chat-card">
          <h2>Chat</h2>
          <p className="meta">
            Session: <code>{currentSession}</code>
          </p>

          <div className="chat-log">
            {messages.length === 0 ? <p className="meta">No messages yet.</p> : null}
            {messages.map((m, i) => (
              <div key={`${m.role}-${i}`} className={`bubble ${m.role}`}>
                <strong>{m.role === 'user' ? 'You' : 'Assistant'}</strong>
                <p>{m.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={sendChat} className="composer">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              rows={4}
            />
            <button type="submit" disabled={loading}>
              Send
            </button>
          </form>
        </section>

        <section className="card">
          <h2>Selected Profile</h2>
          {selectedProfile ? (
            <div className="meta-stack">
              <p>
                <strong>Name:</strong> {selectedProfile.name}
              </p>
              <p>
                <strong>Language:</strong> {selectedProfile.voice.language}
              </p>
              <p>
                <strong>Tone:</strong> {selectedProfile.voice.tone_prompt}
              </p>
              <p>
                <strong>Speed:</strong> {selectedProfile.voice.speed}
              </p>
            </div>
          ) : (
            <p className="meta">Load data to pick a profile.</p>
          )}
        </section>
      </main>

      <footer className="status card">
        <strong>Status:</strong> {status}
      </footer>
    </div>
  )
}

export default App
