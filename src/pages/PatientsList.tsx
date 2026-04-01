import { API_URL } from "../utils/config";
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DoctorSidebar from '../components/DoctorSidebar'
import { Activity, Clock, Search, Users } from 'lucide-react'

type Patient = {
  id: string
  name: string
  vela_id: string
  age: number
  gender: string
  ward: string
  room: string
  risk_score: number
  status: string
  updated_at: string
}

export default function PatientsList() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<'risk_desc' | 'risk_asc' | 'name' | 'recent'>('risk_desc')
  const navigate = useNavigate()

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const res = await fetch(`${API_URL}/api/patients/list`)
        const data = await res.json()
        if (res.ok && data.status === 'success') setPatients(data.patients || [])
      } catch {
        // ignore
      }
    }
    fetchPatients()
  }, [])

  const filtered = useMemo(() => {
    let arr = patients.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    if (sortMode === 'risk_desc') arr = [...arr].sort((a, b) => b.risk_score - a.risk_score)
    if (sortMode === 'risk_asc') arr = [...arr].sort((a, b) => a.risk_score - b.risk_score)
    if (sortMode === 'name') arr = [...arr].sort((a, b) => a.name.localeCompare(b.name))
    if (sortMode === 'recent') arr = [...arr].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return arr
  }, [patients, search, sortMode])

  const getRiskColor = (score: number) => {
    if (score <= 40) return 'bg-[#166534] text-[#DCFCE7]'
    if (score <= 70) return 'bg-[#B45309] text-[#FEF3C7]'
    return 'bg-[#991B1B] text-[#FEE2E2]'
  }

  return (
    <div className="flex min-h-screen bg-[#FAFAF9]">
      <DoctorSidebar onExpandChange={setSidebarExpanded} />
      
      <main 
        className={`flex-1 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] p-8 ${
          sidebarExpanded ? 'ml-[260px]' : 'ml-[72px]'
        }`}
      >
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="font-serif text-5xl text-[#1A1A1A] mb-3 tracking-tight">All Patients</h1>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 px-3 py-1 bg-white border border-[#E8E6E1] rounded-full">
                <Users size={14} className="text-[#6B6B6B]" />
                <span className="font-mono text-xs font-medium text-[#1A1A1A]">{filtered.length} Total</span>
              </span>
              <span className="flex items-center gap-2 px-3 py-1 bg-white border border-[#E8E6E1] rounded-full">
                <Activity size={14} className="text-[#6B6B6B]" />
                <span className="font-mono text-xs font-medium text-[#1A1A1A]">
                  {patients.filter(p => p.risk_score > 70).length} Critical
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
             <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] group-focus-within:text-[#1A1A1A] transition-colors" size={16} />
                <input 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  placeholder="Search by name or ID..." 
                  className="w-full md:w-64 pl-10 pr-4 py-2.5 bg-white border border-[#E8E6E1] rounded-lg text-sm text-[#1A1A1A] placeholder-[#9CA3AF] focus:outline-none focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A] transition-all"
                />
             </div>
             
             <div className="flex bg-white border border-[#E8E6E1] rounded-lg p-1 gap-1">
                {[
                  { key: 'risk_desc', label: 'High Risk' },
                  { key: 'recent', label: 'Recent' },
                  { key: 'name', label: 'A-Z' }
                ].map((mode) => (
                  <button
                    key={mode.key}
                    onClick={() => setSortMode(mode.key as any)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      sortMode === mode.key 
                        ? 'bg-white text-slate-900 shadow-sm' 
                        : 'text-[#6B6B6B] hover:bg-[#F5F4F0] hover:text-[#1A1A1A]'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
             </div>
          </div>
        </header>

        <div className="bg-white border border-[#E8E6E1] rounded-xl shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 p-4 border-b border-[#E8E6E1] bg-[#FAFAF9]/50">
            <div className="font-mono text-xs text-[#6B6B6B] uppercase tracking-wider pl-2">Patient Details</div>
            <div className="font-mono text-xs text-[#6B6B6B] uppercase tracking-wider">Status</div>
            <div className="font-mono text-xs text-[#6B6B6B] uppercase tracking-wider">Location</div>
            <div className="font-mono text-xs text-[#6B6B6B] uppercase tracking-wider">Last Update</div>
            <div className="font-mono text-xs text-[#6B6B6B] uppercase tracking-wider text-right pr-2">Risk Score</div>
          </div>

          <div className="divide-y divide-[#E8E6E1]">
            {filtered.map((patient) => {
              const riskColor = getRiskColor(patient.risk_score)
              return (
                <div
                  key={patient.id}
                  onClick={() => navigate(`/patients/${patient.id}`)}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 p-4 items-center hover:bg-[#FAFAF9] cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-4 pl-2">
                    <div className="w-10 h-10 rounded-full bg-[#F5F4F0] border border-[#E8E6E1] flex items-center justify-center text-[#1A1A1A] font-serif shrink-0 group-hover:border-[#1A1A1A] group-hover:bg-white transition-all">
                      {patient.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-sans font-medium text-[#1A1A1A] text-[15px]">{patient.name}</div>
                      <div className="font-mono text-xs text-[#6B6B6B] mt-0.5">{patient.vela_id}</div>
                    </div>
                  </div>

                  <div>
                     <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-mono font-medium border ${
                        patient.status === 'admitted' ? 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]' :
                        patient.status === 'critical' ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]' :
                        'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]'
                     }`}>
                        {patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}
                     </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="font-sans text-sm text-[#1A1A1A]">{patient.ward}</span>
                    <span className="font-mono text-xs text-[#6B6B6B]">Room {patient.room}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[#6B6B6B]">
                    <Clock size={12} />
                    <span className="font-mono text-xs">
                       {new Date(patient.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="flex justify-end pr-2">
                    <div className="flex items-center gap-3">
                       <span className="font-mono text-xs text-[#6B6B6B] opacity-0 group-hover:opacity-100 transition-opacity">
                          View
                       </span>
                       <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-sm font-bold ${
                         riskColor
                       }`}>
                          {patient.risk_score}
                       </div>
                    </div>
                  </div>
                </div>
              )
            })}
             {filtered.length === 0 && (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#F5F4F0] flex items-center justify-center mx-auto mb-4">
                     <Search className="text-[#6B6B6B]" size={20} />
                  </div>
                  <h3 className="font-serif text-xl text-[#1A1A1A] mb-1">No patients found</h3>
                  <p className="font-sans text-[#6B6B6B]">Try adjusting your search criteria</p>
                </div>
             )}
          </div>
        </div>
      </main>
    </div>
  )
}
