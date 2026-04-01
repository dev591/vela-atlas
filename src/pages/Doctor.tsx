import { API_URL } from "../utils/config";
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import DoctorSidebar from '../components/DoctorSidebar'
import { getUser } from '../utils/auth'
import toast, { Toaster } from 'react-hot-toast'
import { socket } from '../hooks/useSocket'
import Atlas from '../components/Atlas/Atlas'

type Ticket = {
  id: string; 
  ticket_number: string; 
  patient_id: string; 
  patient_name: string; 
  status: string; 
  created_at: string; 
  queue_position: number;
  notes?: string;
}

type Patient = { id: string; name: string; risk_score: number; ward: string; room: string; vela_id: string; documents?: any[] }

export default function Doctor() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [queue, setQueue] = useState<Ticket[]>([])
  const [emergency, setEmergency] = useState<Patient[]>([])
  const [nextLoading, setNextLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const navigate = useNavigate()

  const fetchQueue = async () => {
    try {
      const res = await fetch(`${API_URL}/api/receptionist/queue`)
      const data = await res.json()
      if (res.ok && data.status === 'success') {
        setQueue(data.queue || [])
      }
    } catch {
      toast.error('Could not load queue')
    }
  }

  const fetchEmergency = async () => {
    try {
      const res = await fetch(`${API_URL}/api/patients/emergency`)
      const data = await res.json()
      if (res.ok && data.status === 'success') {
        setEmergency(data.patients || [])
      }
    } catch {
      toast.error('Could not load emergency patients')
    }
  }

  useEffect(() => {
    Promise.all([fetchQueue(), fetchEmergency()])

    const queueTimer = setInterval(fetchQueue, 20000)
    const emergencyTimer = setInterval(fetchEmergency, 20000)
    return () => {
      clearInterval(queueTimer)
      clearInterval(emergencyTimer)
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    gsap.fromTo('.stat-card', 
      { y: 30, opacity: 0 }, 
      { y: 0, opacity: 1, stagger: 0.1, duration: 1, ease: 'power4.out', delay: 0.2 }
    )
  }, []) 

  const speakWithElevenLabs = async (text: string) => {
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY
    const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"
    if (!apiKey || apiKey.length < 10) {
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 0.88; u.pitch = 1.05; u.volume = 1.0
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
      return
    }
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "xi-api-key": apiKey, "Accept": "audio/mpeg" },
          body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2",
            voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true }
          })
        }
      )
      if (!res.ok) throw new Error("ElevenLabs failed")
      const reader = res.body?.getReader()
      const chunks: Uint8Array[] = []
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) chunks.push(value)
        }
      }
      const total = chunks.reduce((acc, c) => acc + c.length, 0)
      const merged = new Uint8Array(total)
      let offset = 0
      for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length }
      const blob = new Blob([merged], { type: "audio/mpeg" })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.volume = 1.0
      audio.onended = () => URL.revokeObjectURL(url)
      audio.play().catch(() => {
        URL.revokeObjectURL(url)
        const u = new SpeechSynthesisUtterance(text)
        u.rate = 0.88
        window.speechSynthesis.speak(u)
      })
    } catch {
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 0.88; u.volume = 1.0
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    }
  }

  const callNext = async () => {
    setNextLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/doctor/next-patient`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department: 'General' })
      })
      const data = await res.json()
      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'No patients')

      if (!data.patient) {
        toast('No patients waiting in queue', { icon: 'ℹ️' })
        return
      }

      if (data.atlas_summary) {
        speakWithElevenLabs(data.atlas_summary)
      }

      if (data.patient?.id) {
        navigate(`/patients/${data.patient.id}`)
        ;(window as any).setAtlasPatient(data.patient.id)
      }
      fetchQueue()
      fetchEmergency()
    } catch (err: any) {
      toast.error(err.message || 'Next patient call failed')
    } finally {
      setNextLoading(false)
    }
  }

  const markComplete = async (ticketId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/tickets/${ticketId}/complete`, {
        method: 'PUT',
      })
      const data = await res.json()
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to mark ticket complete')
      }
      toast.success('Ticket marked as complete')
      fetchQueue()
      fetchEmergency()
    } catch (err: any) {
      toast.error(err.message || 'Error completing ticket')
    }
  }

  useEffect(() => {
    if (!socket) return

    const handlePatientCompleted = () => {
      fetchQueue()
      fetchEmergency()
    }

    const handleLabUpdate = (data: any) => {
      toast.success(`Lab Order for ${data.patient_name || 'Patient'}: ${data.status.toUpperCase()}`, { icon: '🧪' })
    }

    const handleReportSubmitted = (data: any) => {
      toast.success(`New Lab Report: ${data.patient_name || 'Patient'}`, { 
        icon: '📊',
        duration: 8000
      })
      // Speak alert for doctor
      const u = new SpeechSynthesisUtterance(`New lab results are available for review for patient ${data.patient_name || 'unknown'}.`);
      window.speechSynthesis.speak(u);
      
      fetchQueue()
      fetchEmergency()
    }

    const handleAdmissionConfirmed = (data: any) => {
      toast.success(`Admission Confirmed: ${data.patient_name || 'Patient'} assigned to ${data.ward_name}`, { 
        icon: '🏥',
        duration: 6000
      });
      const u = new SpeechSynthesisUtterance(`Patient ${data.patient_name || 'unknown'} has been admitted to ${data.ward_name}.`);
      window.speechSynthesis.speak(u);
    }

    socket.on('patient_completed', handlePatientCompleted)
    socket.on('lab_update', handleLabUpdate)
    socket.on('report_submitted', handleReportSubmitted)
    socket.on('admission_confirmed', handleAdmissionConfirmed)

    return () => {
      socket.off('patient_completed', handlePatientCompleted)
      socket.off('lab_update', handleLabUpdate)
      socket.off('report_submitted', handleReportSubmitted)
      socket.off('admission_confirmed', handleAdmissionConfirmed)
    }
  }, [])

  const greeting = () => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  }

  const waitingNow = queue.filter((t) => t.status === 'waiting').length
  const inProgress = queue.filter((t) => t.status === 'in-progress').length
  const completed = queue.filter((t) => t.status === 'completed').length
  const highRisk = emergency.length

  const user = getUser()

  const getDateLabel = () => {
    const date = new Date()
    return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-600/30">
      <div className="noise-overlay pointer-events-none z-0"></div>
      
      {/* Assuming DoctorSidebar has its own z-index handling */}
      <DoctorSidebar onExpandChange={setSidebarExpanded} />
      
      <main ref={containerRef} className="flex-1 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] relative z-10 px-12 py-16"
        style={{ marginLeft: sidebarExpanded ? '280px' : '80px' }}>
        
        <Toaster position="top-right" toastOptions={{
          style: { background: '#FAFAF9', color: '#0C0C0B', fontFamily: 'Geist Mono', fontSize: '12px', borderRadius: '4px' }
        }}/>
        
        {/* Header Section */}
        <header className="flex justify-between items-end mb-16 border-b border-slate-200 pb-8">
          <div>
            <h1 className="font-serif italic text-6xl md:text-7xl font-light m-0 leading-none text-slate-900">
              {greeting()},<br/>Dr. {user?.name?.split(' ')[1] || 'Doctor'}.
            </h1>
            <div className="font-mono text-[10px] text-slate-500 mt-8 tracking-[0.2em] uppercase max-w-sm leading-relaxed">
              {getDateLabel()} <span className="mx-3 text-blue-600">•</span> General Practice
              <br/>
              Operational dashboard active. All systems nominal.
            </div>
          </div>

          <button
            type="button"
            onClick={callNext}
            disabled={nextLoading}
            className={`font-mono text-xs uppercase tracking-[0.2em] bg-[#FAFAF9] text-[#0C0C0B] px-8 py-4 border-none flex items-center gap-4 transition-all duration-300 cursor-none hover:bg-blue-600 ${nextLoading ? 'opacity-70 cursor-wait' : ''}`}
            onMouseEnter={e => !nextLoading && (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => !nextLoading && (e.currentTarget.style.transform = 'translateY(0)')}
          >
            {nextLoading ? (
              <>
                <span className="w-3 h-3 border-2 border-black/20 border-t-current rounded-full animate-spin"></span>
                Calling Next...
              </>
            ) : (
              <>
                Next Patient
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </>
            )}
          </button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-6 mb-16">
          {[
            { label: 'WAITING NOW', value: waitingNow, trend: '+2 since 9am' },
            { label: 'IN PROGRESS', value: inProgress, trend: 'On schedule' },
            { label: 'HIGH RISK', value: highRisk, trend: 'Requires attention', alert: highRisk > 0 },
            { label: 'COMPLETED', value: completed, trend: '85% efficiency' }
          ].map((stat, i) => (
            <div key={i} className="stat-card bg-slate-50 border border-slate-100 p-8 flex flex-col justify-between h-48 relative overflow-hidden group hover:bg-slate-100 transition-colors duration-500">
              {stat.alert && <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50"></div>}
              <div className={`font-mono text-[10px] uppercase tracking-[0.2em] ${stat.alert ? 'text-red-400' : 'text-blue-600'}`}>
                {stat.label}
              </div>
              <div className={`font-serif italic text-6xl md:text-[80px] leading-none my-4 ${stat.alert ? 'text-red-50' : 'text-slate-900'}`}>
                {stat.value}
              </div>
              <div className="font-sans text-xs text-slate-500 flex items-center gap-3 font-light">
                {stat.alert && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>}
                {stat.trend}
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-[1.8fr_1.2fr] gap-12">
          {/* Queue Section */}
          <section>
            <div className="flex justify-between items-end mb-8 border-b border-slate-200 pb-4">
              <h2 className="font-serif italic text-4xl m-0 text-slate-900">Patient Queue</h2>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-blue-600">
                {queue.length} Total
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {queue.length === 0 ? (
                <div className="p-16 text-center border border-slate-100 bg-slate-50 text-slate-500">
                  <div className="font-serif italic text-3xl mb-4 text-slate-500">No active patients</div>
                  <div className="font-sans text-sm font-light">The waiting room is currently empty</div>
                </div>
              ) : queue.map((t, idx) => {
                const nowMinutes = Math.floor((new Date().getTime() - new Date(t.created_at).getTime()) / 60000)
                const isWaiting = t.status === 'waiting'
                
                return (
                  <div 
                    key={t.id || idx}
                    onClick={() => navigate(`/patients/${t.patient_id}`)}
                    className="bg-transparent border border-slate-200 p-6 md:p-8 cursor-none transition-all duration-300 flex items-center gap-8 relative overflow-hidden group hover:border-blue-600/50 hover:bg-blue-600/5"
                  >
                    {/* Status Indicator Stripe */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${isWaiting ? 'bg-blue-600/50' : 'bg-[#FAFAF9]'}`} />

                    <div className="font-mono text-3xl md:text-4xl text-slate-400 w-12 text-center group-hover:text-slate-500 transition-colors">
                      {String(t.queue_position).padStart(2, '0')}
                    </div>

                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex flex-col">
                          <div className="font-serif italic text-3xl md:text-4xl text-slate-900 flex items-center gap-4">
                            {t.patient_name}
                            {t.notes?.includes('Appointment Arrival') && (
                              <span className="font-mono text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded-full not-italic tracking-[0.2em] font-bold">APPOINTMENT</span>
                            )}
                          </div>
                          {t.notes && (
                            <p className="text-sm font-sans text-slate-500 italic mt-1 font-light break-words max-w-2xl">
                              "{t.notes.replace('Appointment Arrival:', '').trim()}"
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          {!isWaiting && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                markComplete(t.id)
                              }}
                              className="bg-transparent border border-slate-300 text-slate-500 px-4 py-2 font-mono text-[10px] uppercase tracking-widest cursor-none hover:bg-white hover:text-black transition-colors"
                            >
                              Complete
                            </button>
                          )}
                          <div className={`font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 border ${
                            isWaiting 
                              ? 'text-blue-600 border-blue-600/30 bg-blue-600/5' 
                              : 'text-black border-slate-300 bg-white'
                          }`}>
                            {isWaiting ? `WAITING ${nowMinutes}m` : 'IN PROGRESS'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-6 font-mono text-xs text-slate-500 uppercase tracking-widest mt-4">
                        <span>ID {t.patient_id.slice(0,8)}</span>
                        <span>TKT {t.ticket_number}</span>
                      </div>
                    </div>

                    <div className="text-slate-400 text-2xl group-hover:text-slate-900 group-hover:translate-x-2 transition-all hidden md:block">
                      <span className="material-symbols-outlined">chevron_right</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Emergency / Risk Section */}
          <section>
            <div className="flex justify-between items-end mb-8 border-b border-slate-200 pb-4">
              <h2 className={`font-serif italic text-4xl m-0 ${highRisk > 0 ? 'text-red-400/90' : 'text-slate-900'}`}>Priority Attention</h2>
              {highRisk > 0 && (
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.6)]" />
              )}
            </div>

            <div className="flex flex-col gap-4">
              {highRisk === 0 ? (
                <div className="p-12 text-center border border-slate-100 bg-slate-50">
                  <div className="font-sans text-sm text-slate-500 font-light">
                    No critical patients at this moment.
                  </div>
                </div>
              ) : emergency.map((p) => (
                <div key={p.id} 
                  onClick={() => navigate(`/patients/${p.id}`)}
                  className="bg-red-950/20 border border-red-500/20 p-8 cursor-none transition-transform duration-300 hover:-translate-y-1 hover:border-red-500/40 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent pointer-events-none"></div>
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div>
                      <div className="font-serif italic text-3xl md:text-4xl text-slate-900">
                        {p.name}
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mt-3">
                        {p.vela_id} <span className="mx-2">•</span> {p.ward}
                      </div>
                    </div>
                    <div className="font-mono text-2xl font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 flex items-center gap-3">
                      <span className="text-[10px] font-normal uppercase tracking-widest text-red-400/70">RISK</span>
                      {p.risk_score}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 relative z-10">
                    {(p.documents?.[0]?.critical_flags || []).slice(0,3).map((flag: string, idx: number) => (
                      <span key={idx} className="bg-red-500/10 text-red-200 border border-red-500/20 font-mono text-[10px] uppercase tracking-wider px-3 py-1">
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Floating Atlas Assistant */}
        <div className="fixed bottom-12 right-12 z-[100]">
          <Atlas />
        </div>

      </main>
    </div>
  )
}
