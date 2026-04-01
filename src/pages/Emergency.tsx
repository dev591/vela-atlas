import { API_URL } from "../utils/config";
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import DoctorSidebar from '../components/DoctorSidebar'
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'

type Patient = { id: string; name: string; vela_id: string; risk_score: number; ward: string; room: string; };

export default function Emergency() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [patients, setPatients] = useState<Patient[]>([])
  const navigate = useNavigate()

  const fetchEmergency = async () => {
    try {
      const res = await fetch(`${API_URL}/api/patients/emergency`)
      const data = await res.json()
      if (res.ok && data.status === 'success') setPatients(data.patients || [])
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchEmergency()
    const timer = setInterval(fetchEmergency, 15000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (patients.length > 0) {
      gsap.fromTo('.emergency-card', 
        { y: 20, opacity: 0 }, 
        { y: 0, opacity: 1, stagger: 0.1, duration: 0.5, ease: 'power2.out' }
      )
    }
  }, [patients])

  return (
    <div className="flex min-h-screen bg-[#FAFAF9]">
      <DoctorSidebar onExpandChange={setSidebarExpanded} />
      
      <main 
        className={`flex-1 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] p-8 ${
          sidebarExpanded ? 'ml-[260px]' : 'ml-[72px]'
        }`}
      >
        <header className="mb-12">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-3 h-3 rounded-full bg-[#EF4444] animate-pulse" />
            <h1 className="font-serif text-5xl text-[#1A1A1A] tracking-tight">Emergency</h1>
          </div>
          <p className="font-sans text-[#6B6B6B] text-lg max-w-2xl">
            High-risk patients requiring immediate attention or constant monitoring.
          </p>
        </header>

        {patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-24 border border-dashed border-[#E8E6E1] rounded-2xl bg-[#FAFAF9]">
            <div className="w-16 h-16 rounded-full bg-[#DCFCE7] flex items-center justify-center mb-6">
              <CheckCircle className="text-[#166534]" size={32} />
            </div>
            <h2 className="font-serif text-3xl text-[#1A1A1A] mb-2">All Clear</h2>
            <p className="font-sans text-[#6B6B6B]">No critical patients require attention at this moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {patients.map((p) => (
              <div 
                key={p.id} 
                className="emergency-card group bg-white border border-[#E8E6E1] hover:border-[#EF4444] rounded-xl p-6 cursor-pointer transition-all duration-300 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(239,68,68,0.1)] relative overflow-hidden" 
                onClick={() => navigate(`/patients/${p.id}`)}
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-[#EF4444]" />
                
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-sans font-semibold text-lg text-[#1A1A1A] group-hover:text-[#EF4444] transition-colors">{p.name}</h3>
                    <div className="font-mono text-xs text-[#6B6B6B] mt-1">{p.vela_id}</div>
                  </div>
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#FEF2F2] text-[#B91C1C] font-mono font-bold text-sm border border-[#FECACA]">
                    {p.risk_score}
                  </div>
                </div>
                
                <div className="space-y-3 mb-6">
                   <div className="flex items-center justify-between text-sm">
                      <span className="text-[#6B6B6B]">Location</span>
                      <span className="font-medium text-[#1A1A1A]">{p.ward} · {p.room}</span>
                   </div>
                   <div className="flex items-center justify-between text-sm">
                      <span className="text-[#6B6B6B]">Status</span>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#FEF2F2] text-[#B91C1C] text-xs font-medium uppercase tracking-wide border border-[#FECACA]">
                        <AlertTriangle size={10} /> Critical
                      </span>
                   </div>
                </div>

                <div className="pt-4 border-t border-[#E8E6E1] flex items-center justify-between text-sm">
                   <span className="text-[#6B6B6B] flex items-center gap-1.5">
                      <Clock size={14} /> 2m ago
                   </span>
                   <span className="font-medium text-[#1A1A1A] group-hover:translate-x-1 transition-transform">View Patient →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
