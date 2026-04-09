import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import { login, receptionistLogin, managerLogin, labLogin, networkReceptionistLogin } from '../utils/auth'

type Role = 'doctor' | 'receptionist' | 'hospital_manager' | 'lab_controller'

const roleDetails: Record<Role, { 
  label: string; 
  description: string; 
  badge: string; 
  demoId?: string;
  demoEmail?: string; 
  demoPassword: string; 
  route: string; 
  features: string[];
  image: string;
  stats: { label: string; value: string; trend?: 'up' | 'down' }[];
}> = {
  doctor: {
    label: 'Doctor',
    description: 'Clinical AI command center for physicians',
    badge: 'PHYSICIAN',
    demoEmail: 'doctor@vela.ai',
    demoPassword: 'vela2025',
    route: '/dashboard',
    features: ['Real-time patient monitoring', 'Atlas voice interface', 'Risk scoring & alerts'],
    image: '/assets/login/doctor.png',
    stats: [
      { label: 'ACTIVE PATIENTS', value: '42' },
      { label: 'RISK ALERTS', value: '04', trend: 'down' },
      { label: 'PENDING REVIEWS', value: '12' }
    ]
  },
  receptionist: {
    label: 'Receptionist',
    description: 'Patient intake and queue management',
    badge: 'FRONT DESK',
    demoEmail: 'reception@vela.ai',
    demoPassword: 'vela2025',
    route: '/receptionist',
    features: ['Patient registration', 'Queue management', 'Document upload'],
    image: '/assets/login/receptionist.png',
    stats: [
      { label: 'IN QUEUE', value: '18' },
      { label: 'NEW REGISTRATIONS', value: '12' },
      { label: 'AVG WAIT TIME', value: '8m' }
    ]
  },
  hospital_manager: {
    label: 'Hospital Manager',
    description: 'Executive facility oversight and live analytics',
    badge: 'MANAGER',
    demoEmail: 'manager@vela.ai',
    demoPassword: 'vela2025',
    route: '/hospital-manager',
    features: ['Live analytics', 'Hospital wards view', 'Staff management'],
    image: '/assets/login/manager.png',
    stats: [
      { label: 'BED OCCUPANCY', value: '88%', trend: 'up' },
      { label: 'STAFF ACTIVE', value: '242' },
      { label: 'ER THROUGHPUT', value: '92%' }
    ]
  },
  lab_controller: {
    label: 'Lab Controller',
    description: 'Diagnostic automation and report management',
    badge: 'DIAGNOSTICS',
    demoEmail: 'lab@vela.ai',
    demoPassword: 'lab2025',
    route: '/lab-controller',
    features: ['Real-time test queue', 'AI-driven reporting', 'Payment verification'],
    image: '/assets/login/lab.png',
    stats: [
      { label: 'SAMPLES PENDING', value: '112' },
      { label: 'AI PROCESSING', value: '98%' },
      { label: 'REPORT ACCURACY', value: '99.9%' }
    ]
  }
}

export default function Login() {
  const [step, setStep] = useState<'select' | 'form'>('select')
  const [role, setRole] = useState<Role>('doctor')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null)

  const navigate = useNavigate()
  const pageRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (pageRef.current) {
      gsap.fromTo(pageRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 1, ease: 'power2.out' }
      );
    }
  }, []);

  useEffect(() => {
    if (step === 'form') {
      gsap.fromTo(leftRef.current,
        { xPercent: -50, opacity: 0 },
        { xPercent: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }
      );
      gsap.fromTo(rightRef.current,
        { xPercent: 50, opacity: 0 },
        { xPercent: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }
      );
    }
  }, [step]);

  // Transition between roles
  useEffect(() => {
    if (step === 'form' && imageRef.current) {
      gsap.fromTo(imageRef.current,
        { scale: 1.1, opacity: 0.8 },
        { scale: 1, opacity: 1, duration: 1.2, ease: 'power2.out' }
      );
    }
  }, [role, step]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) return setError('Email is required')
    if (!password.trim()) return setError('Password is required')

    setLoading(true)
    // Network receptionist emails are async — handle separately
    if (role === 'receptionist' && /^reception\..+@vela\.health$/.test(email.trim())) {
      networkReceptionistLogin(email.trim(), password).then(success => {
        if (success) {
          navigate(roleDetails[role].route)
        } else {
          setError('Invalid credentials for ' + roleDetails[role].label)
          setLoading(false)
        }
      })
      return
    }
    // Check vela_staff table for hospital staff
    fetch('http://localhost:8000/api/staff/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password })
    }).then(r => r.json()).then(data => {
      if (data.status === 'success') {
        localStorage.setItem('vela_auth', 'true')
        localStorage.setItem('vela_role', data.role)
        localStorage.setItem('vela_hospital_id', data.hospital_id || '')
        localStorage.setItem('vela_hospital_name', data.hospital_name || '')
        localStorage.setItem('vela_staff_id', data.staff_id || '')
        localStorage.setItem('vela_staff_name', data.name || '')
        localStorage.setItem('vela_user', JSON.stringify({ name: data.name, role: data.role }))
        const dest = data.role === 'doctor' ? '/dashboard' : data.role === 'receptionist' ? '/receptionist' : '/lab-controller'
        navigate(dest)
        return
      }
      // Fall through to hardcoded credentials
      window.setTimeout(() => {
        let success = false
        if (role === 'doctor') success = login(email.trim(), password)
        else if (role === 'receptionist') success = receptionistLogin(email.trim(), password)
        else if (role === 'hospital_manager') {
          // ONLY check vela_hospitals table — no hardcoded fallback
          // Credentials come from Vela onboarding, not hardcoded
          fetch('http://localhost:8000/api/manager/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), password })
          }).then(r => r.json()).then(mData => {
            if (mData.status === 'success') {
              localStorage.setItem('vela_auth', 'true')
              localStorage.setItem('vela_role', 'hospital_manager')
              localStorage.setItem('vela_hospital_id', mData.hospital_id || '')
              localStorage.setItem('vela_hospital_name', mData.hospital_name || '')
              localStorage.setItem('vela_user', JSON.stringify({ name: mData.manager_name, role: 'Hospital Manager' }))
              if (!mData.walkthrough_done) {
                localStorage.setItem('vela_walkthrough_done', 'false')
                navigate('/walkthrough')
              } else {
                navigate('/hospital-manager')
              }
            } else {
              // Also try hardcoded demo manager as fallback
              const demoOk = managerLogin(email.trim(), password)
              if (demoOk) navigate(roleDetails[role].route)
              else { setError('Invalid credentials. Contact Vela to get your hospital onboarded.'); setLoading(false) }
            }
          }).catch(() => {
            const demoOk = managerLogin(email.trim(), password)
            if (demoOk) navigate(roleDetails[role].route)
            else { setError('Backend not reachable. Is the server running?'); setLoading(false) }
          })
          return
        }
        else if (role === 'lab_controller') success = labLogin(email.trim(), password)
        if (success) navigate(roleDetails[role].route)
        else { setError('Invalid credentials for ' + roleDetails[role].label); setLoading(false) }
      }, 800)
    }).catch(() => {
      window.setTimeout(() => {
        let success = false
        if (role === 'doctor') success = login(email.trim(), password)
        else if (role === 'receptionist') success = receptionistLogin(email.trim(), password)
        else if (role === 'hospital_manager') success = managerLogin(email.trim(), password)
        else if (role === 'lab_controller') success = labLogin(email.trim(), password)
        if (success) navigate(roleDetails[role].route)
        else { setError('Invalid credentials for ' + roleDetails[role].label); setLoading(false) }
      }, 800)
    })
  }

  const copyValue = (value: string, type: 'email' | 'password') => {
    navigator.clipboard.writeText(value)
    setCopiedField(type)
    window.setTimeout(() => setCopiedField(null), 1500)
  }

  const selected = roleDetails[role]

  return (
    <div ref={pageRef} className="bg-black text-white font-sans antialiased min-h-screen flex flex-col justify-center items-center overflow-hidden relative">
      <main className="z-10 w-full h-screen flex flex-col items-center">
        {step === 'select' ? (
          <div className="flex flex-col items-center justify-center h-full px-8 max-w-7xl w-full">
            <header className="mb-20 text-center">
              <img src="/vela-icon.png" alt="Vela" className="h-10 mx-auto mb-8 invert filter brightness-200" />
              <h1 className="text-4xl font-light tracking-[0.3em] text-white uppercase mb-4">Identity Verification</h1>
              <p className="text-white/40 font-mono text-xs uppercase tracking-widest">Select your operational clearance</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full">
              {(Object.keys(roleDetails) as Role[]).map(r => {
                let icon = 'person';
                if (r === 'doctor') icon = 'medical_services';
                if (r === 'receptionist') icon = 'desk';
                if (r === 'hospital_manager') icon = 'location_city';
                if (r === 'lab_controller') icon = 'biotech';
                
                return (
                  <button key={r} type="button" onClick={() => { setRole(r); setStep('form'); setError(''); }} 
                    className="group relative bg-[#111] border border-white/5 p-12 flex flex-col items-center transition-all duration-500 hover:bg-white/10 hover:border-white/20 text-center cursor-none focus:outline-none overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    
                    <div className="relative mb-8 text-white/40 group-hover:text-white transition-colors duration-500">
                      <span className="material-symbols-outlined text-4xl group-hover:scale-110 transition-transform duration-500">
                        {icon}
                      </span>
                    </div>

                    <h2 className="relative font-serif italic text-3xl mb-2 text-white/90">{roleDetails[r].label}</h2>
                    <p className="relative font-sans text-[10px] uppercase tracking-widest text-white/40">{roleDetails[r].description}</p>
                    
                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-1 or duration-300">
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </div>
                  </button>
                )
              })}

              {/* Patient — one-click demo login */}
              <button
                type="button"
                onClick={async () => {
                  // Seed demo patient then log in instantly
                  try {
                    await fetch('http://localhost:8000/api/demo/seed-patient', { method: 'POST' }).catch(() => {})
                    const res = await fetch('http://localhost:8000/api/patient/by-email/patient@vela.ai')
                    const data = await res.json()
                    if (data.patient) {
                      localStorage.setItem('vela_auth', 'true')
                      localStorage.setItem('vela_role', 'patient')
                      localStorage.setItem('vela_vela_id', data.patient.vela_id)
                      localStorage.setItem('vela_patient', JSON.stringify(data.patient))
                      localStorage.setItem('vela_email', 'patient@vela.ai')
                      navigate('/patient-dashboard')
                    } else {
                      navigate('/portal')
                    }
                  } catch {
                    navigate('/portal')
                  }
                }}
                className="group relative bg-[#111] border border-emerald-500/20 p-12 flex flex-col items-center transition-all duration-500 hover:bg-emerald-500/10 hover:border-emerald-500/40 text-center cursor-none focus:outline-none overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute top-3 right-3 font-mono text-[8px] text-emerald-500/60 uppercase tracking-widest">Demo</div>

                <div className="relative mb-8 text-emerald-500/50 group-hover:text-emerald-400 transition-colors duration-500">
                  <span className="material-symbols-outlined text-4xl group-hover:scale-110 transition-transform duration-500">
                    person
                  </span>
                </div>

                <h2 className="relative font-serif italic text-3xl mb-2 text-white/90">Patient</h2>
                <p className="relative font-sans text-[10px] uppercase tracking-widest text-white/40">Personal health dashboard</p>
              </button>
            </div>
            <p className="text-white/20 font-mono text-[10px] uppercase tracking-widest mt-8 text-center">
              Hospital staff? Use your assigned login credentials
            </p>
          </div>
        ) : (
          <div className="w-full h-screen flex flex-col md:flex-row divide-x divide-white/5">
            {/* Left Image Section */}
            <div ref={leftRef} className="hidden md:flex relative w-1/2 h-full overflow-hidden bg-black flex-col justify-end p-12">
              <img 
                ref={imageRef}
                src={selected.image} 
                alt={selected.label}
                className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-luminosity"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
              
              <div className="relative z-10 max-w-lg">
                <div className={`font-mono text-[10px] tracking-[0.4em] uppercase mb-4 filter drop-shadow-md ${role === 'hospital_manager' ? 'text-[#C8B89A]' : 'text-blue-400'}`}>
                  {role === 'hospital_manager' ? 'VELA NETWORK' : selected.badge + ' STATUS'}
                </div>
                <h2 className="font-serif italic text-6xl text-white mb-8">
                  {role === 'hospital_manager' ? 'Hospital Manager' : selected.label + ' Command'}
                </h2>
                {role === 'hospital_manager' && (
                  <p className="font-sans text-white/50 text-lg mb-8 leading-relaxed">
                    Your hospital is part of India's most intelligent healthcare network. Use the credentials provided by Vela to access your dashboard.
                  </p>
                )}
                
                <div className="grid grid-cols-3 gap-8 border-t border-white/10 pt-8 mt-8">
                  {selected.stats.map((stat, idx) => (
                    <div key={idx}>
                      <div className="font-mono text-[9px] text-white/40 tracking-widest uppercase mb-1">{stat.label}</div>
                      <div className="text-2xl font-light flex items-center gap-2">
                        {stat.value}
                        {stat.trend && (
                          <span className={`material-symbols-outlined text-xs ${stat.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                            {stat.trend === 'up' ? 'trending_up' : 'trending_down'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Log Overlay */}
              <div className="absolute top-12 left-12 font-mono text-[9px] text-white/20 uppercase tracking-[0.2em] space-y-2 pointer-events-none">
                <div>SYSTEM // VELA-OS 2.4.0</div>
                <div>SECURE CONNECTION // ESTABLISHED</div>
                <div>ACCESS NODE // {selected.label.toUpperCase().replace(' ', '_')}</div>
              </div>
            </div>

            {/* Right Form Section */}
            <div ref={rightRef} className="w-full md:w-1/2 h-full bg-black flex flex-col justify-center items-center p-12 relative">
              <button type="button" onClick={() => { setStep('select'); setError(''); }}
                className="absolute top-12 left-12 text-white/40 hover:text-white transition-colors text-[10px] font-mono uppercase tracking-[0.3em] flex items-center gap-3 cursor-none bg-transparent border-none p-0"
              >
                <span className="material-symbols-outlined text-sm">west</span>
                Switch Identity
              </button>

              <div className="w-full max-w-sm">
                <header className="mb-12">
                   <img src="/vela-icon.png" alt="Vela" className="h-8 mb-8 invert opacity-80" />
                   {role === 'hospital_manager' ? (
                     <>
                       <h1 className="text-3xl font-light tracking-widest">HOSPITAL ACCESS</h1>
                       <div className="h-px w-12 bg-[#C8B89A] mt-4"></div>
                       <p className="text-white/30 font-mono text-[10px] uppercase tracking-widest mt-4">Enter credentials provided by Vela</p>
                     </>
                   ) : (
                     <>
                       <h1 className="text-3xl font-light tracking-widest grayscale-0">AUTHENTICATE</h1>
                       <div className="h-px w-12 bg-blue-500 mt-4"></div>
                     </>
                   )}
                </header>

                <form onSubmit={handleLogin} className="flex flex-col gap-8">
                  <div className="group">
                    <label className="font-mono text-[9px] text-white/40 tracking-widest mb-2 block uppercase group-focus-within:text-blue-400 transition-colors">
                      {role === 'hospital_manager' ? 'MANAGER EMAIL' : 'ORGANIZATION EMAIL'}
                    </label>
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      type="email"
                      placeholder={role === 'hospital_manager' ? 'manager@hospital.vela.health' : (selected.demoEmail || 'you@vela.ai')}
                      className="w-full bg-transparent border-b border-white/10 focus:border-blue-500 text-white font-sans text-sm pb-4 outline-none transition-all placeholder-white/10"
                    />
                  </div>

                  <div className="group">
                    <label className="font-mono text-[9px] text-white/40 tracking-widest mb-2 block uppercase group-focus-within:text-blue-400 transition-colors">SECURE PASSWORD</label>
                    <div className="relative">
                      <input
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="w-full bg-transparent border-b border-white/10 focus:border-blue-500 text-white font-sans text-sm pb-4 pr-12 outline-none transition-all placeholder-white/10"
                      />
                      <button type="button" onClick={() => setShowPassword(v => !v)}
                        className="absolute right-0 top-0 bottom-4 flex items-center justify-center text-[9px] font-mono tracking-widest text-white/30 hover:text-blue-400 bg-transparent border-none cursor-none"
                      >
                        {showPassword ? 'CONCEAL' : 'REVEAL'}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 font-mono text-[10px] p-4 uppercase tracking-tighter">
                      AUTHENTICATION_FAILURE: {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading}
                    className={`mt-4 w-full font-mono text-[11px] uppercase tracking-[0.3em] font-bold py-5 transition-all duration-500 cursor-none focus:outline-none relative overflow-hidden group ${role === 'hospital_manager' ? 'bg-[#C8B89A] text-black hover:bg-[#b8a88a]' : 'bg-white text-black hover:bg-blue-500 hover:text-white'} ${loading ? 'opacity-50 grayscale' : 'opacity-100'}`}
                  >
                    <span className="relative z-10">{loading ? 'VERIFYING...' : 'INITIATE_SESSION'}</span>
                    {role !== 'hospital_manager' && <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>}
                  </button>
                </form>

                {/* Hospital Manager — Contact Vela instead of demo creds */}
                {role === 'hospital_manager' ? (
                  <div className="mt-12 pt-8 border-t border-white/5">
                    <p className="font-mono text-[10px] text-white/30 uppercase tracking-widest mb-4">Don't have credentials?</p>
                    <div className="bg-[#C8B89A]/10 border border-[#C8B89A]/20 rounded-xl p-5">
                      <p className="font-sans text-sm text-white/60 leading-relaxed mb-3">
                        Your hospital needs to be onboarded on the Vela network first.
                      </p>
                      <a href="mailto:dev@vela.ai" className="font-mono text-[11px] text-[#C8B89A] uppercase tracking-widest hover:text-white transition-colors cursor-none">
                        Contact Vela → dev@vela.ai
                      </a>
                    </div>
                  </div>
                ) : (
                  /* Demo Credentials for other roles */
                  <div className="mt-16 pt-8 border-t border-white/5 opacity-40 hover:opacity-100 transition-opacity duration-500">
                    <div className="font-mono text-[9px] text-white/40 tracking-widest mb-6 uppercase">DEMO_CREDENTIALS</div>
                    <div className="flex flex-col gap-4">
                      {([
                        { label: 'Email', value: selected.demoEmail || '', type: 'email' as const },
                        { label: 'PASS', value: selected.demoPassword, type: 'password' as const }
                      ]).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between group">
                            <span className="font-mono text-[10px] text-white/30 group-hover:text-white/60 transition-colors">
                              {item.label}: <strong className="text-white font-normal select-all ml-2">{item.value}</strong>
                            </span>
                            <button type="button" onClick={() => copyValue(item.value, item.type)}
                                className={`font-mono text-[9px] tracking-widest uppercase cursor-none transition-colors ${copiedField === item.type ? 'text-green-400' : 'text-white/20 group-hover:text-blue-400'}`}
                            >{copiedField === item.type ? 'SUCCESS' : 'COPY'}</button>
                          </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="absolute bottom-12 right-12 flex items-center gap-4 opacity-10 pointer-events-none">
                <span className="material-symbols-outlined text-sm">lock</span>
                <span className="font-mono text-[9px] tracking-tighter">RSA_AES_256_ACTIVE</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Atlas Orb Background Element */}
      <div className="fixed -bottom-24 -right-24 w-96 h-96 bg-blue-600/5 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="fixed -top-24 -left-24 w-96 h-96 bg-blue-900/5 rounded-full blur-[100px] pointer-events-none z-0"></div>
    </div>
  )
}
