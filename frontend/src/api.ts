export type EndpointHealth = {
  service: string
  base_url: string
  endpoint: string
  configured: boolean
}

export type HealthResponse = {
  lm_studio: EndpointHealth
  whisper: EndpointHealth
  tts: EndpointHealth
}

export type Profile = {
  id: string
  name: string
  system_prompt: string
  voice: {
    voice: string
    tone_prompt: string
    language: string
    speed: number
  }
}

export type TtsModelCatalog = {
  mode: 'remote'
  default_model: string | null
  models: string[]
}

export type VoiceItem = {
  voice_id: string
  name: string
}

export type VoiceCatalog = {
  mode: 'remote'
  default_voice: string | null
  voices: string[]
  voice_items: VoiceItem[]
  tts_model: string | null
  supports_tone_prompt: boolean
  supports_speed: boolean
}

export type ChatRequest = {
  profile_id: string
  session_id: string
  user_message: string
  temperature: number
}

export type ChatResponse = {
  profile_id: string
  session_id: string
  assistant_message: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  } | null
}

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init)
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.detail) {
        detail = `${detail} - ${body.detail}`
      }
    } catch {
      // Ignore JSON parse failures and keep status text context.
    }
    throw new Error(detail)
  }
  return (await res.json()) as T
}

export const api = {
  health: () => request<HealthResponse>('/health'),
  profiles: () => request<Profile[]>('/v1/profiles'),
  ttsModels: () => request<TtsModelCatalog>('/v1/tts/models'),
  voices: (model?: string) =>
    request<VoiceCatalog>(`/v1/voices${model ? `?model=${encodeURIComponent(model)}` : ''}`),
  chat: (payload: ChatRequest) =>
    request<ChatResponse>('/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
}
