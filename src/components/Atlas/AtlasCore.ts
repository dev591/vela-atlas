import { API_URL } from "../../utils/config";

export type AtlasState =
  | "sleeping"
  | "waking"
  | "listening"
  | "processing"
  | "speaking"
  | "error"

interface Callbacks {
  onState: (s: AtlasState) => void
  onAnswer: (q: string, a: string) => void
  onError: (msg: string) => void
  userRole?: string
}

class AtlasCore {
  private recognition: any = null
  private isSpeaking = false
  private state: AtlasState = "sleeping"
  private patientId?: string
  private userRole: string = "doctor"
  private callbacks: Callbacks
  private SR: any = null
  private isHoldingSpace = false

  constructor(cb: Callbacks) {
    this.callbacks = cb
    this.userRole = cb.userRole || "doctor"
  }

  private setState(s: AtlasState) {
    this.state = s
    this.callbacks.onState(s)
  }

  init() {
    const SR = (window as any).SpeechRecognition
              || (window as any).webkitSpeechRecognition

    if (!SR) {
      this.callbacks.onError("Use Chrome for voice")
      return
    }

    this.SR = SR
    this.setupSpacebar()
    this.setState("sleeping")
  }

  private setupSpacebar() {
    window.addEventListener("keydown", (e) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      const isInput = tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (e.target as HTMLElement).isContentEditable
      if (
        e.code === "Space" &&
        !isInput &&
        !this.isHoldingSpace &&
        !this.isSpeaking
      ) {
        e.preventDefault()
        e.stopPropagation()
        this.isHoldingSpace = true
        this.startListening()
      }
    })

    window.addEventListener("keyup", (e) => {
      if (e.code === "Space" && this.isHoldingSpace) {
        e.preventDefault()
        this.isHoldingSpace = false
        this.stopListening()
      }
    })
  }

  private startListening() {
    if (this.isSpeaking) return
    
    const recognition = new this.SR()
    recognition.lang = "en-US"
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    
    recognition.onstart = () => {
      this.setState("listening")
      console.log("[Atlas] listening started")
    }
    
    recognition.onresult = (e: any) => {
      const raw = e.results[0][0].transcript.trim().toLowerCase()
      console.log("[Atlas] heard:", raw)
      
      const query = raw
        .replace(/hey atlas[,\s]*/gi, "")
        .replace(/hateless[,\s]*/gi, "")
        .replace(/hatless[,\s]*/gi, "")
        .replace(/^atlas[,\s]*/gi, "")
        .trim()
      
      if (query.length > 1) {
        this.sendQuery(query)
      } else {
        this.setState("sleeping")
      }
    }
    
    recognition.onerror = (e: any) => {
      console.log("[Atlas] error:", e.error)
      if (e.error === "not-allowed") {
        this.callbacks.onError("Microphone blocked. Allow in Chrome settings.")
      }
      this.setState("sleeping")
    }
    
    recognition.onend = () => {
      console.log("[Atlas] recognition ended")
      if (this.state === "listening") {
        this.setState("sleeping")
      }
    }
    
    this.recognition = recognition
    
    try {
      recognition.start()
      this.playWakeSound()
    } catch(e) {
      console.error("[Atlas] could not start:", e)
      this.setState("sleeping")
    }
  }

  private stopListening() {
    if (this.recognition && this.state === "listening") {
      console.log("[Atlas] stopping — processing query")
      this.setState("processing")
      try {
        this.recognition.stop()
      } catch {}
    }
  }

  // FIX 3 — Two-tone rising wake sound, 140ms total
  private playWakeSound() {
    try {
      const ctx = new window.AudioContext()

      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.frequency.setValueAtTime(600, ctx.currentTime)
      osc1.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.06)
      gain1.gain.setValueAtTime(0.08, ctx.currentTime)
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
      osc1.start(ctx.currentTime)
      osc1.stop(ctx.currentTime + 0.08)

      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.frequency.setValueAtTime(900, ctx.currentTime + 0.05)
      osc2.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.12)
      gain2.gain.setValueAtTime(0.06, ctx.currentTime + 0.05)
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14)
      osc2.start(ctx.currentTime + 0.05)
      osc2.stop(ctx.currentTime + 0.14)
    } catch {}
  }

  // FIX 4 — Auto retry once, 15s timeout
  private async sendQuery(query: string, retryCount = 0) {
    this.setState("processing")
    try { this.recognition?.abort() } catch {}

    try {
      const res = await fetch(`${API_URL}/api/voice/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          patient_id: this.patientId || undefined,
          session_id: "doctor_session_1",
          user_role: this.userRole || "doctor"
        }),
        signal: AbortSignal.timeout(15000)
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      const answer = data?.answer || "I couldn't get a response right now."
      this.callbacks.onAnswer(query, answer)
      await this.speakAnswer(query, answer, data)
    } catch (err: any) {
      console.error("[Atlas] Query failed:", err)
      if (retryCount < 1 && err.name !== "TimeoutError") {
        console.log("[Atlas] Retrying once...")
        await new Promise(r => setTimeout(r, 500))
        return this.sendQuery(query, retryCount + 1)
      }
      this.callbacks.onError("Atlas is unavailable. Is the backend running?")
      this.setState("sleeping")
    }
  }

  // FIX 1 — ElevenLabs streaming with optimize_streaming_latency: 3
  private async speakAnswer(_question: string, answer: string, fullResponse: any) {
    this.isSpeaking = true
    this.setState("speaking")

    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY
    const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"
    let spoken = false

    if (apiKey && apiKey.length > 10) {
      try {
        const r = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "xi-api-key": apiKey,
              "Accept": "audio/mpeg"
            },
            body: JSON.stringify({
              text: answer,
              model_id: "eleven_turbo_v2",
              voice_settings: {
                stability: 0.4,
                similarity_boost: 0.8,
                style: 0.1,
                use_speaker_boost: false
              },
              optimize_streaming_latency: 3
            })
          }
        )

        if (r.ok && r.body) {
          // Stream chunks into array then play — fastest approach
          const reader = r.body.getReader()
          const chunks: Uint8Array[] = []
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value) chunks.push(value)
          }
          const total = chunks.reduce((acc, c) => acc + c.length, 0)
          const merged = new Uint8Array(total)
          let offset = 0
          for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length }

          const blob = new Blob([merged], { type: "audio/mpeg" })
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          audio.volume = 1.0

          spoken = await new Promise<boolean>((resolve) => {
            audio.onended = () => { URL.revokeObjectURL(url); resolve(true) }
            audio.onerror = () => { URL.revokeObjectURL(url); resolve(false) }
            audio.play().catch(() => { URL.revokeObjectURL(url); resolve(false) })
          })
        }
      } catch (e) {
        console.warn("[Atlas] ElevenLabs error", e)
        spoken = false
      }
    }

    if (!spoken) {
      console.log("[Atlas] Using browser TTS")
      await new Promise<void>((resolve) => {
        window.speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(answer)
        u.rate = 0.88
        u.pitch = 1.05
        u.volume = 1.0
        const voices = window.speechSynthesis.getVoices()
        const preferred = voices.find((v: SpeechSynthesisVoice) => v.lang.startsWith("en"))
        if (preferred) u.voice = preferred
        u.onend = () => resolve()
        u.onerror = () => resolve()
        window.speechSynthesis.speak(u)
      })
    }

    if (fullResponse?.intent === "navigate_reports" && fullResponse?.patient) {
      window.dispatchEvent(new CustomEvent("atlas_navigate", {
        detail: { path: `/patients/${fullResponse.patient.id}`, tab: "reports" }
      }))
    }
    if (fullResponse?.intent === "navigate_patient" && fullResponse?.patient) {
      window.dispatchEvent(new CustomEvent("atlas_navigate", {
        detail: { path: `/patients/${fullResponse.patient.id}`, tab: "summary" }
      }))
    }

    this.isSpeaking = false
    this.setState("sleeping")
  }

  setPatientId(id: string | undefined) {
    this.patientId = id
  }

  ask(query: string) {
    const trimmed = query?.toString().trim()
    if (!trimmed) return
    this.setState("processing")
    try { this.recognition?.abort() } catch {}
    this.sendQuery(trimmed)
  }

  stop() {
    this.isSpeaking = false
    if (this.recognition) {
      try { this.recognition.abort() } catch {}
    }
    this.setState("sleeping")
  }

  destroy() {
    if (this.recognition) {
      try { this.recognition.abort() } catch {}
    }
    window.speechSynthesis.cancel()
  }
}

export default AtlasCore
