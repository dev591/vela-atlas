import { API_URL } from "../utils/config";
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DoctorSidebar from '../components/DoctorSidebar'
import { getUser } from '../utils/auth'
import toast, { Toaster } from 'react-hot-toast'
import Atlas from '../components/Atlas/Atlas'

type Patient = {
  id: string
  name: string
  age: number
  gender: string
  blood_group: string
  ward: string
  room: string
  doctor: string
  status: string
  risk_score: number
  vela_id: string
  allergies: string
  existing_conditions: string
}

type DocumentItem = {
  id: string
  filename: string
  report_date: string
  risk_score: number
  summary: string
  critical_flags: string[]
  values: Array<{ test: string; result: string; unit: string; status: string; reference: string }>
}

type Medication = {
  id: string
  name: string
  dosage: string
  frequency: string
  prescribed_by: string
  start_date: string
  notes: string
}

type NoteItem = {
  id: string
  content: string
  created_by: string
  created_at: string
}

type ReminderItem = {
  id: string
  message: string
  due_time: string
  is_done: boolean
}

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [reminders, setReminders] = useState<ReminderItem[]>([])
  const [activeTab, setActiveTab] = useState<'summary' | 'reports' | 'medications' | 'notes'>('summary')
  const [newNote, setNewNote] = useState('')
  const [newReminder, setNewReminder] = useState('')
  const [newReminderDue, setNewReminderDue] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [reportResult, setReportResult] = useState<DocumentItem | null>(null)

  useEffect(() => {
    ;(window as any).setAtlasPatient(id)
    const fetchData = async () => {
      if (!id) return
      try {
        const res = await fetch(`${API_URL}/api/patients/${id}`)
        const data = await res.json()
        if (res.ok && data.status === 'success') {
          setPatient(data.patient)
          setDocuments(data.documents || [])
          setMedications(data.medications || [])
          setNotes(data.notes || [])
          setReminders(data.reminders || [])
        }
      } catch {
        toast.error('Failed to load patient details')
      }
    }
    fetchData()

    return () => {
      ;(window as any).setAtlasPatient(undefined)
    }
  }, [id])

  const markReminderDone = async (reminderId: string) => {
    try {
      await fetch(`${API_URL}/api/reminders/${reminderId}/done`, { method: 'PUT' })
      setReminders((prev) => prev.map((r) => (r.id === reminderId ? { ...r, is_done: true } : r)))
    } catch {
      toast.error('Could not mark reminder done')
    }
  }

  const addNote = async () => {
    if (!newNote.trim() || !id) return
    try {
      const res = await fetch(`${API_URL}/api/notes/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: id, content: newNote, created_by: getUser()?.name || 'Unknown' })
      })
      const data = await res.json()
      if (res.ok && data.status === 'success') {
        setNotes((prev) => [data.note, ...prev])
        setNewNote('')
      }
    } catch {
      toast.error('Could not add note')
    }
  }

  const addReminder = async () => {
    if (!newReminder.trim() || !newReminderDue || !id) return
    try {
      const res = await fetch(`${API_URL}/api/reminders/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: id, message: newReminder, due_time: newReminderDue, is_done: false })
      })
      const data = await res.json()
      if (res.ok && data.status === 'success') {
        setReminders((prev) => [data.reminder, ...prev])
        setNewReminder('')
        setNewReminderDue('')
      }
    } catch {
      toast.error('Could not add reminder')
    }
  }

  const uploadDocument = async (file: File) => {
    if (!id) return
    const formData = new FormData()
    formData.append('patient_id', id)
    formData.append('file', file)

    setUploadStatus('Uploading')
    try {
      const res = await fetch(`${API_URL}/api/upload/document`, { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok && data.status === 'success') {
        setReportResult(data.document)
        setUploadStatus('Done')
        writeToConsole('Report uploaded')
      } else {
        setUploadStatus('Failed')
        toast.error('Upload failed')
      }
    } catch {
      setUploadStatus('Failed')
      toast.error('Upload failed')
    }
  }

  // const handoverGenerate = async () => {
  //   if (!id) return
  //   try {
  //     const res = await fetch(`${API_URL}/api/patients/${id}/handover`, {
  //       method: 'POST'
  //     })
  //     const data = await res.json()
  //     if (res.ok && data.status === 'success') {
  //       toast.success('Handover report generated')
  //     }
  //   } catch {
  //     toast.error('Failed to generate handover')
  //   }
  // }

  const completeConsultation = async () => {
    if (!id) return
    try {
      const res = await fetch(`${API_URL}/api/tickets/${id}/complete`, {
        method: 'PUT',
      })
      const data = await res.json()
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to complete consultation')
      }
      toast.success('Consultation completed successfully')
      navigate('/doctor')
    } catch (err: any) {
      toast.error(err.message || 'Error completing consultation')
    }
  }

  const writeToConsole = (msg: string) => {
    console.log(msg)
  }

  if (!patient) return <div>Loading...</div>

  const riskColor = patient.risk_score <= 40 ? 'var(--success-color)' : patient.risk_score <= 70 ? 'var(--warning-color)' : 'var(--error-color)'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-primary)' }}>
      <DoctorSidebar onExpandChange={setSidebarExpanded} />
      
      <main style={{ 
        flex: 1, 
        marginLeft: sidebarExpanded ? '280px' : '80px', 
        transition: 'margin-left 0.4s cubic-bezier(0.16, 1, 0.3, 1)', 
        padding: '48px',
        position: 'relative'
      }}>
        <Toaster position="top-right" />

        {/* Back Navigation */}
        <button 
          onClick={() => navigate('/doctor')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontFamily: 'Geist Mono, monospace',
            fontSize: 12,
            cursor: 'pointer',
            padding: 0,
            marginBottom: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          ← Back to Dashboard
        </button>

        {/* Patient Header Card */}
        <div style={{ 
          background: 'var(--surface-color)', 
          border: '1px solid var(--border-color)', 
          borderRadius: 8, 
          padding: 32, 
          marginBottom: 32, 
          display: 'flex', 
          alignItems: 'flex-start', 
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', gap: 32 }}>
            <div style={{ 
              width: 96, 
              height: 96, 
              borderRadius: '50%', 
              background: 'var(--bg-color)', 
              border: '1px solid var(--border-color)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: 'var(--text-secondary)', 
              fontFamily: 'Instrument Serif, serif', 
              fontSize: 40 
            }}>
              {patient.name.split(' ').map((n, i) => i < 2 ? n[0] : '').join('')}
            </div>
            
            <div>
              <h1 style={{ 
                fontFamily: 'Instrument Serif, serif', 
                fontSize: 48, 
                fontWeight: 400,
                color: 'var(--text-primary)',
                margin: '0 0 8px 0',
                lineHeight: 1
              }}>
                {patient.name}
              </h1>
              
              <div style={{ 
                fontFamily: 'Geist Mono, monospace', 
                fontSize: 14, 
                color: 'var(--primary-color)',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                <span>{patient.vela_id}</span>
                <span style={{ width: 4, height: 4, background: 'currentColor', borderRadius: '50%' }} />
                <span>{patient.ward} • {patient.room}</span>
              </div>

              <div style={{ 
                fontFamily: 'Geist, sans-serif', 
                fontSize: 15, 
                color: 'var(--text-secondary)',
                display: 'flex',
                gap: 24
              }}>
                <div>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 13, display: 'block', marginBottom: 2 }}>AGE/SEX</span>
                  {patient.age} / {patient.gender}
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 13, display: 'block', marginBottom: 2 }}>BLOOD</span>
                  {patient.blood_group}
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 13, display: 'block', marginBottom: 2 }}>DOCTOR</span>
                  {patient.doctor}
                </div>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ 
              fontFamily: 'Instrument Serif, serif', 
              fontSize: 80, 
              color: riskColor,
              lineHeight: 1,
              marginBottom: 4
            }}>
              {patient.risk_score}
            </div>
            <div style={{ 
              fontFamily: 'Geist Mono, monospace', 
              fontSize: 12, 
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Vela Risk Score
            </div>
          </div>
        </div>

        {/* Custom Tabs */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--border-color)', 
          marginBottom: 32 
        }}>
          {['summary', 'reports', 'medications', 'notes'].map((tab) => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab as any)} 
              style={{
                padding: '16px 24px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'Geist Mono, monospace',
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)',
                boxShadow: activeTab === tab ? 'inset 0 -1px 0 0 var(--text-primary)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ minHeight: 400 }}>
          {activeTab === 'summary' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
              <section className="card-panel" style={{ 
                background: 'var(--surface-color)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 8, 
                padding: 24 
              }}>
                <h3 style={{ 
                  fontFamily: 'Instrument Serif, serif', 
                  fontSize: 24, 
                  fontWeight: 400, 
                  margin: '0 0 24px 0',
                  color: 'var(--text-primary)'
                }}>Clinical Reminders</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {reminders.map((r, idx) => (
                    <div key={r.id || `reminder-${idx}`} style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start', 
                      gap: 12, 
                      padding: 12, 
                      borderRadius: 6,
                      background: r.is_done ? 'rgba(0,0,0,0.03)' : 'var(--bg-color)', 
                      border: '1px solid var(--border-color)',
                      opacity: r.is_done ? 0.6 : 1
                    }}>
                      <input 
                        type="checkbox" 
                        checked={r.is_done} 
                        onChange={() => markReminderDone(r.id)} 
                        style={{ marginTop: 4, cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          textDecoration: r.is_done ? 'line-through' : 'none',
                          fontFamily: 'Geist, sans-serif',
                          color: 'var(--text-primary)',
                          fontSize: 14
                        }}>
                          {r.message}
                        </div>
                        <div style={{ 
                          fontFamily: 'Geist Mono, monospace', 
                          fontSize: 11, 
                          color: 'var(--text-tertiary)',
                          marginTop: 4
                        }}>
                          Due: {new Date(r.due_time).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px dashed var(--border-color)' }}>
                  <input 
                    value={newReminder} 
                    onChange={(e) => setNewReminder(e.target.value)} 
                    placeholder="New reminder..." 
                    style={{ 
                      width: '100%', 
                      padding: 12, 
                      background: 'var(--bg-color)',
                      border: '1px solid var(--border-color)', 
                      borderRadius: 4, 
                      marginBottom: 8,
                      fontFamily: 'Geist, sans-serif'
                    }} 
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                      type="datetime-local" 
                      value={newReminderDue} 
                      onChange={(e) => setNewReminderDue(e.target.value)} 
                      style={{ 
                        flex: 1, 
                        padding: 12, 
                        background: 'var(--bg-color)',
                        border: '1px solid var(--border-color)', 
                        borderRadius: 4,
                        fontFamily: 'Geist Mono, monospace',
                        fontSize: 12
                      }} 
                    />
                    <button 
                      onClick={addReminder} 
                      style={{ 
                        background: 'var(--primary-color)', 
                        color: 'var(--bg-color)', 
                        padding: '0 20px', 
                        border: 'none', 
                        borderRadius: 4,
                        fontFamily: 'Geist, sans-serif',
                        cursor: 'pointer'
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </section>

              <section className="card-panel" style={{ 
                background: 'var(--surface-color)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 8, 
                padding: 24 
              }}>
                <h3 style={{ 
                  fontFamily: 'Instrument Serif, serif', 
                  fontSize: 24, 
                  fontWeight: 400, 
                  margin: '0 0 24px 0',
                  color: 'var(--text-primary)'
                }}>Actions</h3>
                
                <button 
                  onClick={completeConsultation} 
                  style={{ 
                    width: '100%', 
                    background: 'var(--success-color)', 
                    color: 'var(--bg-color)', 
                    padding: '16px', 
                    border: 'none', 
                    borderRadius: 6,
                    fontFamily: 'Geist Mono, monospace',
                    fontSize: 14,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  ✓ Complete Consultation
                </button>

                <p style={{ 
                  fontFamily: 'Geist, sans-serif', 
                  fontSize: 14, 
                  color: 'var(--text-secondary)', 
                  marginTop: 24, 
                  lineHeight: 1.5 
                }}>
                  Completing this consultation will update the patient's status, archive this session's notes, and move to the next patient in queue.
                </p>
              </section>
            </div>
          )}

          {activeTab === 'reports' && (
            <section style={{ 
              background: 'var(--surface-color)', 
              border: '1px solid var(--border-color)', 
              borderRadius: 8, 
              padding: 32 
            }}>
               <div style={{ 
                 border: '1px dashed var(--border-color)', 
                 borderRadius: 8, 
                 padding: 32,
                 textAlign: 'center',
                 marginBottom: 32
               }}>
                <label style={{ 
                  display: 'inline-block', 
                  cursor: 'pointer',
                  padding: '12px 24px',
                  background: 'var(--bg-color)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 4,
                  fontFamily: 'Geist, sans-serif',
                  fontSize: 14,
                  transition: 'all 0.2s ease'
                }}>
                  <span>+ Upload Report PDF/Image</span>
                  <input type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && uploadDocument(e.target.files[0])} />
                </label>
                {uploadStatus && <div style={{ marginTop: 12, fontFamily: 'Geist Mono, monospace', fontSize: 12 }}>{uploadStatus}</div>}
              </div>

              {reportResult && (
                <div style={{ 
                  background: 'var(--bg-color)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 8, 
                  padding: 24,
                  marginBottom: 32
                }}>
                  <div style={{ 
                    fontFamily: 'Geist Mono, monospace', 
                    fontWeight: 600, 
                    color: 'var(--primary-color)',
                    borderBottom: '1px solid var(--border-color)',
                    paddingBottom: 12,
                    marginBottom: 16
                  }}>
                    ANALYSIS: {reportResult.filename}
                  </div>
                  <div style={{ 
                    fontFamily: 'Geist, sans-serif', 
                    fontSize: 14, 
                    lineHeight: 1.6,
                    marginBottom: 24,
                    color: 'var(--text-secondary)'
                  }}>
                    {reportResult.summary}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, borderBottom: '1px solid var(--border-color)', paddingBottom: 8, marginBottom: 8, fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    <div>TEST</div><div>RESULT</div><div>UNIT</div><div>STATUS</div><div>REFERENCE</div>
                  </div>
                  
                  {reportResult.values.map((v, i) => (
                    <div key={i} style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(5, 1fr)', 
                      gap: 12, 
                      padding: '8px 0', 
                      borderBottom: '1px solid rgba(0,0,0,0.05)',
                      fontFamily: 'Geist Mono, monospace',
                      fontSize: 13
                    }}>
                      <div style={{ fontWeight: 500 }}>{v.test}</div>
                      <div>{v.result}</div>
                      <div style={{ color: 'var(--text-tertiary)' }}>{v.unit}</div>
                      <div style={{ 
                        color: v.status === 'normal' ? 'var(--success-color)' : v.status === 'high' || v.status === 'low' ? 'var(--error-color)' : 'var(--warning-color)',
                        fontWeight: 600 
                      }}>
                        {v.status.toUpperCase()}
                      </div>
                      <div style={{ color: 'var(--text-tertiary)' }}>{v.reference}</div>
                    </div>
                  ))}
                </div>
              )}

              <h4 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 24, fontWeight: 400, margin: '0 0 16px 0' }}>Report History</h4>
              <div style={{ display: 'grid', gap: 12 }}>
                {documents.map((d) => (
                  <div key={d.id} style={{ 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 6, 
                    padding: 16, 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    background: 'var(--bg-color)'
                  }}>
                    <div>
                      <div style={{ fontFamily: 'Geist, sans-serif', fontWeight: 500 }}>{d.filename}</div>
                      <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                        {new Date(d.report_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ 
                      fontFamily: 'Geist Mono, monospace', 
                      fontSize: 13,
                      padding: '4px 8px',
                      background: 'var(--surface-color)',
                      borderRadius: 4,
                      border: '1px solid var(--border-color)'
                    }}>
                      Risk Score: {d.risk_score}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'medications' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 32 }}>
              <section style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 24 }}>
                <h4 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 24, fontWeight: 400, margin: '0 0 24px 0' }}>
                  Current Medications
                </h4>
                <div style={{ display: 'grid', gap: 12 }}>
                  {medications.map((m) => (
                    <div key={m.id} style={{ 
                      padding: 16, 
                      background: 'var(--bg-color)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: 6 
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ fontFamily: 'Geist, sans-serif', fontWeight: 600, fontSize: 16 }}>{m.name}</div>
                        <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12, color: 'var(--text-tertiary)' }}>ID: {m.id.slice(0,6)}</div>
                      </div>
                      <div style={{ fontFamily: 'Geist, sans-serif', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        {m.dosage} • {m.frequency}
                      </div>
                      <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--text-tertiary)' }}>
                        Prescribed by {m.prescribed_by} on {new Date(m.start_date).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              
              <section style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 24 }}>
                <h4 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 24, fontWeight: 400, margin: '0 0 24px 0' }}>Quick Notes</h4>
                <textarea 
                  value={newNote} 
                  onChange={(e) => setNewNote(e.target.value)} 
                  placeholder="Add a medication note..."
                  style={{ 
                    width: '100%', 
                    minHeight: 120, 
                    background: 'var(--bg-color)',
                    border: '1px solid var(--border-color)', 
                    borderRadius: 6, 
                    padding: 12,
                    fontFamily: 'Geist, sans-serif',
                    marginBottom: 12,
                    resize: 'vertical'
                  }} 
                />
                <button 
                  onClick={addNote}
                  style={{ 
                    width: '100%', 
                    background: 'var(--primary-color)', 
                    color: 'var(--bg-color)', 
                    padding: '12px', 
                    border: 'none', 
                    borderRadius: 4,
                    fontFamily: 'Geist, sans-serif',
                    cursor: 'pointer'
                  }}
                >
                  Save Note
                </button>
              </section>
            </div>
          )}

          {activeTab === 'notes' && (
            <section style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 24 }}>
              <div style={{ marginBottom: 32 }}>
                <textarea 
                  value={newNote} 
                  onChange={(e) => setNewNote(e.target.value)} 
                  placeholder="Enter clinical observations..." 
                  style={{ 
                    width: '100%', 
                    minHeight: 120, 
                    background: 'var(--bg-color)',
                    border: '1px solid var(--border-color)', 
                    borderRadius: 6, 
                    padding: 16,
                    fontFamily: 'Geist, sans-serif',
                    marginBottom: 12,
                    resize: 'vertical',
                    fontSize: 15
                  }} 
                />
                <div style={{ textAlign: 'right' }}>
                  <button 
                    onClick={addNote} 
                    style={{ 
                      background: 'var(--primary-color)', 
                      color: 'var(--bg-color)', 
                      padding: '12px 24px', 
                      border: 'none', 
                      borderRadius: 4,
                      fontFamily: 'Geist, sans-serif',
                      cursor: 'pointer'
                    }}
                  >
                    Add Observation
                  </button>
                </div>
              </div>
              
              <h4 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 24, fontWeight: 400, margin: '0 0 24px 0' }}>History</h4>
              <div style={{ display: 'grid', gap: 16 }}>
                {notes.map((n) => (
                  <div key={n.id} style={{ 
                    background: 'var(--bg-color)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 8, 
                    padding: 20 
                  }}>
                    <div style={{ fontFamily: 'Geist, sans-serif', fontSize: 15, lineHeight: 1.6, marginBottom: 12 }}>
                      {n.content}
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      borderTop: '1px solid var(--border-color)', 
                      paddingTop: 12,
                      fontFamily: 'Geist Mono, monospace', 
                      fontSize: 11, 
                      color: 'var(--text-tertiary)' 
                    }}>
                      <span>{n.created_by}</span>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
        
        {/* Floating Atlas Assistant */}
        <div style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 100 }}>
          <Atlas />
        </div>
      </main>
    </div>
  )
}
