import { API_URL } from "../utils/config";
import React, { useEffect, useState, useRef } from 'react'
import { gsap } from 'gsap'
import toast from 'react-hot-toast'
import useSocket from '../hooks/useSocket'
import { getUser, logout } from '../utils/auth'
import { 
  Users, 
  FileText, 
  Clock, 
  Activity,
  Calendar,
  Settings,
  LogOut,
  Monitor,
  Camera,
  Bell,
  CheckCircle2,
  UserPlus,
  X,
  CreditCard,
  Stethoscope,
  ShieldAlert
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react'
import { Html5QrcodeScanner } from 'html5-qrcode'

type Patient = {
  id: string; name: string; age: number; gender: string; blood_group: string; ward: string; room: string; doctor: string; status: string; risk_score: number; vela_id: string | null; diagnosis: string; registered_by: string; atlas_analysis?: string; atlas_confidence?: string; [key: string]: any
}

type Admission = {
  id: string; patient_id: string; bed_id: string; ward_id: string; status: string; room_type: string; admission_qr: string; admitted_at: string; diagnosis: string; admission_reason: string; recommended_by: string; patients?: Patient; beds?: { bed_number: string }; wards?: { name: string }
}

type RoomType = {
  id: string; name: string; cost_per_day: number; amenities: string[]
}

type QueueItem = {
  id: string;
  ticket_number: string;
  patient_id: string;
  patient_name: string;
  status: string;
  department: string;
  created_at: string;
  wait_minutes?: number;
  notes?: string;
  queue_position?: number;
}

export default function Receptionist() {
  const socket = useSocket()
  
  const containerRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const queueRef = useRef<HTMLDivElement>(null)

  const [activeTab, setActiveTab] = useState<'register' | 'lookup' | 'appointments' | 'tests' | 'admissions' | 'queue'>('register')
  const [sidebarExpanded, setSidebarExpanded] = useState(false)

  const [registerForm, setRegisterForm] = useState({
    name: '', age: '', gender: 'Male', blood_group: '', height: '', weight: '', allergies: '', existing_conditions: '', emergency_contact: '', language: 'English', ward: 'General', room: '', doctor: '', diagnosis: '', registered_by: 'receptionist'
  })

  const [registering, setRegistering] = useState(false)
  const [registeredPatient, setRegisteredPatient] = useState<Patient | null>(null)

  const [lookupId, setLookupId] = useState('')
  const [lookupPatient, setLookupPatient] = useState<Patient | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [isScanning, setIsScanning] = useState(false)

  const [queue, setQueue] = useState<QueueItem[]>([])
  const [queueLoading, setQueueLoading] = useState(false)

  const [ticketNotes, setTicketNotes] = useState('')
  const [ticketDepartment, setTicketDepartment] = useState('General')
  const [ticketCreating, setTicketCreating] = useState(false)

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [dragOver, setDragOver] = useState(false)

  // Phase 1: Appointments & Notifications
  const [appointments, setAppointments] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [appointmentsLoading, setAppointmentsLoading] = useState(false)
  const [testOrders, setTestOrders] = useState<any[]>([])
  const [testLoading, setTestLoading] = useState(false)
  const [selectedTestOrder, setSelectedTestOrder] = useState<any>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  // Phase 3: Admissions
  const [activeAdmissions, setActiveAdmissions] = useState<Admission[]>([])
  const [recommendedAdmissions, setRecommendedAdmissions] = useState<any[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [wards, setWards] = useState<any[]>([])
  const [admissionsLoading, setAdmissionsLoading] = useState(false)
  
  const [showAdmissionModal, setShowAdmissionModal] = useState(false)
  const [selectedRecommendation, setSelectedRecommendation] = useState<any>(null)
  const [admissionForm, setAdmissionForm] = useState({
      ward_id: '',
      bed_id: '',
      room_type: 'General Ward',
      diagnosis: '',
      reason: ''
  })
  const [confirmingAdmission, setConfirmingAdmission] = useState(false)
  const [successAdmission, setSuccessAdmission] = useState<any>(null)

  // Phase 4: Discharge
  const [showDischargeModal, setShowDischargeModal] = useState(false)
  const [selectedDischargeAdmission, setSelectedDischargeAdmission] = useState<Admission | null>(null)
  const [dischargeSummary, setDischargeSummary] = useState('')
  const [_dischargeLoading, setDischargeLoading] = useState(false)
  const [dischargeData, setDischargeData] = useState<any>(null)
  const [dischargeConfirmed, setDischargeConfirmed] = useState(false)
  const [followUpDate, setFollowUpDate] = useState('')
  const [followUpInstructions, setFollowUpInstructions] = useState('')
  const [finalDiagnosis, setFinalDiagnosis] = useState('')
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [processLoading, setProcessLoading] = useState(false)

  const user = getUser()
  const hospitalId = localStorage.getItem("vela_hospital_id")

  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedApt, setSelectedApt] = useState<any>(null)
  const [doctorStats, setDoctorStats] = useState<any[]>([])
  const [triageLevel, setTriageLevel] = useState('Routine')
  const [assigning, setAssigning] = useState(false)

  const fetchDoctorStats = async () => {
    try {
      if (!hospitalId) return
      const res = await fetch(`${API_URL}/api/receptionist/doctors-status?hospital_id=${hospitalId}`)
      const data = await res.json()
      if (data.status === 'success') setDoctorStats(data.doctors)
    } catch (err) {
      console.error(err)
    }
  }

  const handleOpenAssign = (apt: any) => {
    setSelectedApt(apt)
    fetchDoctorStats()
    setShowAssignModal(true)
  }

  const handleAssignSubmit = async (doctorId: string) => {
    setAssigning(true)
    try {
      const res = await fetch(`${API_URL}/api/receptionist/assign-doctor`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: selectedApt.id,
          doctor_id: doctorId,
          triage_level: triageLevel
        })
      })
      const data = await res.json()
      if (data.status === 'success') {
        toast.success(`Patient assigned. Ticket: ${data.ticket.ticket_number}`)
        setShowAssignModal(false)
        fetchAppointments()
        fetchQueue()
      } else throw new Error(data.message)
    } catch (err: any) {
      toast.error(err.message || "Assignment failed")
    } finally {
      setAssigning(false)
    }
  }

  const fetchQueue = async () => {
    setQueueLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/receptionist/queue`)
      if (!res.ok) throw new Error('Could not load queue')
      const data = await res.json()
      if (data.status === 'success' && Array.isArray(data.queue)) {
        setQueue(data.queue)
      }
    } catch (err: any) {
      console.error(err)
      toast.error('Queue sync failed')
    } finally {
      setQueueLoading(false)
    }
  }

  const fetchAppointments = async () => {
    setAppointmentsLoading(true)
    try {
      if (hospitalId) {
        const res = await fetch(`${API_URL}/api/network/appointments?hospital_id=${hospitalId}`)
        const data = await res.json()
        if (data.status === 'success') setAppointments(data.appointments)
      } else {
        const res = await fetch(`${API_URL}/api/appointments/today`)
        const data = await res.json()
        if (data.status === 'success') setAppointments(data.appointments)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setAppointmentsLoading(false)
    }
  }

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_URL}/api/notifications/receptionist`)
      const data = await res.json()
      if (data.status === 'success') setNotifications(data.notifications)
    } catch (err) {
      console.error(err)
    }
  }

  const markNotificationRead = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/notifications/${id}/read`, { method: 'PUT' })
      fetchNotifications()
    } catch (err) {
      console.error(err)
    }
  }

  const handleMarkArrived = async (aptId: string) => {
    try {
      if (hospitalId) {
        const res = await fetch(`${API_URL}/api/network/appointments/${aptId}/arrive`, { method: 'PATCH' })
        const data = await res.json()
        if (data.status === 'success') {
          toast.success('Patient marked as arrived')
          fetchAppointments()
        } else throw new Error(data.message)
      } else {
        const res = await fetch(`${API_URL}/api/appointments/${aptId}/arrive`, { method: 'POST' })
        const data = await res.json()
        if (data.status === 'success') {
          toast.success(`Patient marked as arrived. Queue Pos: ${data.queue_position}`)
          fetchAppointments()
          fetchQueue()
        } else throw new Error(data.message)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to mark arrival")
    }
  }

  const fetchTestOrders = async () => {
    setTestLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/lab/orders/pending-payment`)
      const data = await res.json()
      if (data.status === 'success') setTestOrders(data.orders)
    } catch (err) {
      console.error(err)
    } finally {
      setTestLoading(false)
    }
  }

  const handleConfirmPayment = async (orderId: string, amount: number) => {
    try {
      const res = await fetch(`${API_URL}/api/lab/orders/${orderId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      })
      const data = await res.json()
      if (data.status === 'success') {
        toast.success(`Payment confirmed. Queue Pos: ${data.queue_position}`)
        setShowPaymentModal(false)
        fetchTestOrders()
      }
    } catch (err) {
      toast.error("Failed to confirm payment")
    }
  }

  const fetchAdmissions = async () => {
      setAdmissionsLoading(true)
      try {
          const [admRes, roomRes, wardRes] = await Promise.all([
              fetch(`${API_URL}/api/admissions/active`),
              fetch(`${API_URL}/api/room-types`),
              fetch(`${API_URL}/api/wards`)
          ])
          const [admData, roomData, wardData] = await Promise.all([
              admRes.json(), roomRes.json(), wardRes.json()
          ])
          if (admData.status === 'success') setActiveAdmissions(admData.admissions)
          if (roomData.status === 'success') setRoomTypes(roomData.room_types)
          if (wardData.status === 'success') setWards(wardData.wards)
      } catch (err) {
          console.error(err)
      } finally {
          setAdmissionsLoading(false)
      }
  }

  const handleConfirmAdmission = async () => {
      if (!selectedRecommendation || !admissionForm.ward_id || !admissionForm.bed_id) {
          toast.error("Please select ward and bed")
          return
      }

      setConfirmingAdmission(true)
      try {
          const selectedWard = wards.find(w => w.id === admissionForm.ward_id)
          const selectedBed = selectedWard?.beds.find((b: any) => b.id === admissionForm.bed_id)

          const res = await fetch(`${API_URL}/api/admissions/confirm`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  patient_id: selectedRecommendation.patient_id,
                  bed_id: admissionForm.bed_id,
                  ward_id: admissionForm.ward_id,
                  ward_name: selectedWard?.name,
                  bed_number: selectedBed?.bed_number,
                  room_type: admissionForm.room_type,
                  admission_reason: admissionForm.reason || selectedRecommendation.reason,
                  diagnosis: admissionForm.diagnosis || selectedRecommendation.reason,
                  recommended_by: selectedRecommendation.recommended_by || 'Atlas AI',
                  admitted_by: user?.name
              })
          })
          const data = await res.json()
          if (data.status === 'success') {
              setSuccessAdmission(data)
              toast.success("Patient Admitted Successfully")
              setShowAdmissionModal(false)
              fetchAdmissions()
              setRecommendedAdmissions(prev => prev.filter(r => r.patient_id !== selectedRecommendation.patient_id))
          }
      } catch (err) {
          toast.error("Admission failed")
      } finally {
          setConfirmingAdmission(false)
      }
  }

  const handleInitiateDischarge = async (admission: Admission) => {
      setSelectedDischargeAdmission(admission)
      setDischargeLoading(true)
      setShowDischargeModal(true)
      setDischargeConfirmed(false)
      setDischargeSummary('')
      setFollowUpDate('')
      setFollowUpInstructions('')
      
      try {
          const res = await fetch(`${API_URL}/api/admissions/${admission.id}/cost`)
          const data = await res.json()
          if (data.status === 'success') {
              setDischargeData(data)
              setPaymentAmount(data.total)
              setFinalDiagnosis(admission.diagnosis)
          }
      } catch (err) {
          toast.error("Failed to fetch billing data")
      } finally {
          setDischargeLoading(false)
      }
  }

  const handleGenerateSummary = async () => {
      if (!selectedDischargeAdmission) return
      setProcessLoading(true)
      try {
          const res = await fetch(`${API_URL}/api/discharge/summary/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ admission_id: selectedDischargeAdmission.id })
          })
          const data = await res.json()
          if (data.status === 'success') {
              setDischargeSummary(data.discharge_summary)
              setDischargeData((prev: any) => ({ ...prev, ...data }))
              toast.success("Atlas Summary Generated")
          } else {
              toast.error(data.message || "AI Summary generation failed")
          }
      } catch (err) {
          toast.error("AI Summary generation failed")
      } finally {
          setProcessLoading(false)
      }
  }

  const handleConfirmDischarge = async () => {
      if (!selectedDischargeAdmission || !dischargeSummary) {
          toast.error("Please generate discharge summary")
          return
      }

      setProcessLoading(true)
      try {
          const res = await fetch(`${API_URL}/api/discharge/confirm`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  admission_id: selectedDischargeAdmission.id,
                  patient_id: selectedDischargeAdmission.patient_id,
                  discharge_summary: dischargeSummary,
                  final_diagnosis: finalDiagnosis,
                  follow_up_date: followUpDate,
                  follow_up_instructions: followUpInstructions,
                  medications_on_discharge: dischargeData?.medications || [],
                  total_days: dischargeData?.days,
                  room_cost: dischargeData?.room_cost,
                  test_cost: dischargeData?.test_cost,
                  total_cost: dischargeData?.total,
                  payment_amount: paymentAmount,
                  discharged_by: user?.name
              })
          })
          const data = await res.json()
          if (data.status === 'success') {
              toast.success("Patient Discharged Successfully")
              setDischargeConfirmed(true)
              fetchAdmissions()
          } else {
              toast.error(data.message || "Discharge failed")
          }
      } catch (err) {
          toast.error("Discharge processing failed")
      } finally {
          setProcessLoading(false)
      }
  }

  const handlePrint = (_type: 'summary' | 'receipt') => {
      window.print()
  }

  useEffect(() => {
    const ctx = gsap.context(() => {
        gsap.fromTo('.fade-in-up', 
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 1, stagger: 0.1, ease: 'power4.out', delay: 0.2 }
        )
    }, containerRef)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      )
      scanner.render(async (decodedText) => {
        scanner.clear()
        setIsScanning(false)
        const vId = decodedText.trim()
        setLookupId(vId)
        setLookupLoading(true)
        try {
            const res = await fetch(`${API_URL}/api/receptionist/lookup/${encodeURIComponent(vId)}`)
            const data = await res.json()
            if (!res.ok || data.status !== 'success') throw new Error('Patient not found')
            setLookupPatient(data.patient)
            toast.success(`Found ${data.patient.name}`)
        } catch (err: any) {
            toast.error(err.message)
            setLookupPatient(null)
        } finally {
            setLookupLoading(false)
        }
      }, () => {})
      return () => {
         scanner.clear().catch(e => console.log(e))
      }
    }
  }, [isScanning])

  useEffect(() => {
    fetchQueue()
    fetchAppointments()
    fetchNotifications()
    const interval = setInterval(() => {
        fetchQueue()
        fetchAppointments()
        fetchNotifications()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (activeTab === 'tests') fetchTestOrders()
    if (activeTab === 'admissions') fetchAdmissions()
    if (activeTab === 'queue') fetchQueue()
  }, [activeTab])

  useEffect(() => {
    if (!socket) return

    socket.on('test_ordered', (data: any) => {
      toast(`New test order for ${data.patient_name}`, { icon: '🔬' })
      if (activeTab === 'tests') fetchTestOrders()
      fetchNotifications()
    })

        socket.on('admission_recommended', (data: any) => {
            setRecommendedAdmissions(prev => {
                // Avoid duplicates
                if (prev.some(r => r.patient_id === data.patient_id)) return prev
                return [data, ...prev]
            })
            toast(`AI Recommends Admission: ${data.patient_name}`, { 
                icon: '🏥',
                duration: 6000
            })
            fetchNotifications()
        })

        socket.on('discharge_recommended', (data: any) => {
            toast(`Discharge Recommended: ${data.patient_name}`, { 
                icon: '🏠',
                duration: 6000,
                style: { border: '1px solid #f59e0b' }
            })
            fetchNotifications()
            if (activeTab === 'admissions') fetchAdmissions()
        })

    return () => {
      socket.off('test_ordered')
      socket.off('admission_recommended')
    }
  }, [socket, activeTab])

  useEffect(() => {
    if (!socket) return

    const refreshQueue = () => fetchQueue()

    const nextPatientHandler = (data: any) => {
        if (data?.atlas_summary) {
            toast('Next patient called', { icon: '📢' })
        }
        fetchQueue()
    }

    socket.on('queue_updated', refreshQueue)
    socket.on('patient_registered', refreshQueue)
    socket.on('patient_completed', refreshQueue)
    socket.on('next_patient', nextPatientHandler)
    socket.on('new_notification', (data: any) => {
        if (data.role === 'receptionist') {
            fetchNotifications()
            toast('New update received', { icon: '🔔' })
        }
    })

    // Network hospital room — join and listen for new appointments
    if (hospitalId) {
      socket.emit('join_room', { room: `hospital_${hospitalId}` })
      socket.on('new_appointment', (data: any) => {
        toast(`New appointment: ${data.patient_name} on ${data.date} at ${data.time}`, { icon: '📅', duration: 8000 })
        fetchAppointments()
      })
    }

    return () => {
        socket.off('queue_updated', refreshQueue)
        socket.off('patient_registered', refreshQueue)
        socket.off('patient_completed', refreshQueue)
        socket.off('next_patient', nextPatientHandler)
        socket.off('new_notification')
        if (hospitalId) socket.off('new_appointment')
    }
  }, [socket])

  const handleRegisterChange = (key: string, value: string) => {
    setRegisterForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleRegisterSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!registerForm.name || !registerForm.age || !registerForm.gender) {
      toast.error('Required fields missing')
      return
    }

    setRegistering(true)
    try {
      const res = await fetch(`${API_URL}/api/receptionist/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm)
      })

      const data = await res.json()
      if (!res.ok || data.status !== 'success') throw new Error(data.message)

      const patient: Patient = data.patient
      setRegisteredPatient(patient)
      toast.success(`Registered ${patient.name}`)
      
      setRegisterForm(prev => ({
        ...prev, name: '', age: '', gender: 'Male', blood_group: '', height: '', weight: '', allergies: '', existing_conditions: '', emergency_contact: '', diagnosis: '', room: '', doctor: ''
      }))
      fetchQueue()
    } catch (err: any) {
      toast.error(err.message || 'Registration failed')
    } finally {
      setRegistering(false)
    }
  }

  const handleLookup = async () => {
    if (!lookupId.trim()) return
    setLookupLoading(true)
    try {
        const res = await fetch(`${API_URL}/api/receptionist/lookup/${encodeURIComponent(lookupId.trim())}`)
        const data = await res.json()
        if (!res.ok || data.status !== 'success') throw new Error('Patient not found')
        setLookupPatient(data.patient)
        toast.success(`Found ${data.patient.name}`)
    } catch (err: any) {
        toast.error(err.message)
        setLookupPatient(null)
    } finally {
        setLookupLoading(false)
    }
  }

  const handleCreateTicket = async () => {
    const patient = lookupPatient || registeredPatient
    if (!patient?.vela_id) {
        toast.error('No patient selected')
        return
    }

    setTicketCreating(true)
    try {
        const res = await fetch(`${API_URL}/api/receptionist/ticket/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vela_id: patient.vela_id,
                department: ticketDepartment,
                notes: ticketNotes
            })
        })
        const data = await res.json()
        if (!res.ok || data.status !== 'success') throw new Error(data.message)

        toast.success(`Ticket #${data.ticket_number} created`)
        setTicketNotes('')
        fetchQueue()
        if (registeredPatient) setRegisteredPatient(null)
        if (lookupPatient) setLookupPatient(null)
        setLookupId('')
    } catch (err: any) {
        toast.error(err.message || 'Ticket creation failed')
    } finally {
        setTicketCreating(false)
    }
  }

  const handleUpload = async () => {
      if (!uploadFile || !lookupPatient) return
      setUploading(true)
      setUploadResult(null)

      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("patient_id", lookupPatient.id)

      try {
          const res = await fetch(`${API_URL}/api/upload/document`, {
              method: "POST",
              body: formData
          })
          const data = await res.json()
          setUploadResult(data)
          setUploadFile(null)
          toast.success("Document analyzed")
      } catch {
          toast.error("Upload failed")
      } finally {
          setUploading(false)
      }
  }

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-600/30">
      <div className="noise-overlay pointer-events-none z-0"></div>
      
      
      <aside 
        className={`${sidebarExpanded ? 'w-[280px]' : 'w-[80px]'} fixed left-0 top-0 h-full bg-[#080808] border-r border-slate-100 z-50 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col justify-between py-8 group`}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        <div className="flex flex-col gap-4 px-4">
          <div className="flex items-center gap-4 px-3 mb-12 h-10">
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
               <img src="/vela-icon.png" alt="Vela" style={{ height: 36, width: "auto", filter: "brightness(0.2)" }} />
            </div>
            <span className={`font-serif italic text-3xl tracking-wide whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}`}>
                VELA
            </span>
          </div>
          
          {[
            { label: 'Console', icon: Monitor, active: activeTab === 'register' || activeTab === 'lookup', onClick: () => setActiveTab('register') },
            { label: 'Queue', icon: Users, active: activeTab === 'queue', onClick: () => setActiveTab('queue') },
            { label: 'Admissions', icon: Activity, active: activeTab === 'admissions', onClick: () => setActiveTab('admissions') },
            { label: 'Appointments', icon: Calendar, active: activeTab === 'appointments', onClick: () => setActiveTab('appointments') },
            { label: 'Tests & Payments', icon: CreditCard, active: activeTab === 'tests', onClick: () => setActiveTab('tests') },
            { label: 'Settings', icon: Settings },
          ].map((item, i) => (
            <button 
              key={i} 
              onClick={item.onClick}
              className={`flex items-center gap-5 p-4 rounded-sm transition-all duration-300 ${item.active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
            >
              <item.icon size={22} strokeWidth={1.5} />
              <span className={`font-mono text-[10px] uppercase tracking-[0.2em] whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>

        <div className="px-4">
           <button type="button" onClick={logout} className="w-full flex items-center gap-5 p-4 rounded-sm text-slate-500 hover:text-white hover:bg-red-500/20 transition-all duration-300">
             <LogOut size={22} strokeWidth={1.5} />
             <span className={`font-mono text-[10px] uppercase tracking-[0.2em] whitespace-nowrap overflow-hidden transition-all duration-300 ${sidebarExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}`}>
                Logout
             </span>
           </button>
        </div>
      </aside>

      <main 
        ref={containerRef}
        className="flex-1 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] relative z-10"
        style={{ marginLeft: sidebarExpanded ? '280px' : '80px' }}
      >
        <div className="max-w-[1600px] mx-auto p-12 lg:p-16">
            
            <header className="flex justify-between items-end mb-16 border-b border-slate-200 pb-8 fade-in-up">
                <div>
                    <h1 className="font-serif italic text-6xl md:text-7xl text-slate-900 m-0 leading-none font-light">
                        {user?.name || 'Reception'}
                    </h1>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500 mt-6">
                        {formatDate()} <span className="mx-3 text-blue-600">•</span> Front Desk Operational
                    </div>
                </div>
                <div className="flex gap-8 items-center bg-slate-50 border border-slate-100 px-8 py-4">
                    <div className="text-right">
                        <div className="font-serif italic text-5xl text-slate-900 leading-none mb-2">{queue.filter(q => q.status === 'waiting').length}</div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-blue-600">Waiting</div>
                    </div>
                    <div className="w-[1px] h-12 bg-slate-100 self-center"></div>
                    <div className="text-right">
                        <div className="font-serif italic text-5xl text-slate-900 leading-none mb-2">{queue.filter(q => q.status === 'in-progress').length}</div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-blue-600">Consulting</div>
                    </div>
                    <div className="w-[1px] h-12 bg-slate-100 self-center mx-4"></div>
                    <div className="relative">
                        <button 
                            type="button"
                            onClick={() => setShowNotifications(!showNotifications)}
                            className={`p-3 rounded-full transition-all ${notifications.some(n => !n.is_read) ? 'bg-blue-50 text-blue-600 animate-pulse' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                        >
                            <Bell size={24} />
                            {notifications.some(n => !n.is_read) && (
                                <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></span>
                            )}
                        </button>

                        {showNotifications && (
                            <div className="absolute right-0 mt-4 w-[320px] bg-white border border-slate-200 shadow-2xl z-[100] rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-4">
                                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-900">Notifications</span>
                                    <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-900"><X size={14} /></button>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 font-mono text-[10px] uppercase tracking-widest">No alerts</div>
                                    ) : (
                                        notifications.map((n) => (
                                            <div 
                                                key={n.id} 
                                                className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${!n.is_read ? 'bg-blue-50/30' : ''}`}
                                                onClick={() => markNotificationRead(n.id)}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-bold text-xs text-slate-900">{n.title}</span>
                                                    <span className="text-[9px] text-slate-400 font-mono">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p className="text-[11px] text-slate-500 leading-relaxed font-light">{n.message}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-12 gap-12">
                
                <div className="col-span-12 lg:col-span-7 fade-in-up">
                    <div className="sticky top-12">
                        <div className="flex border-b border-slate-200 mb-12">
                            <button 
                                onClick={() => setActiveTab('admissions')}
                                className={`pb-4 px-4 font-mono text-[10px] uppercase tracking-[0.2em] mr-8 transition-colors ${activeTab === 'admissions' ? 'border-b border-blue-600 text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Admissions
                            </button>
                            <button 
                                onClick={() => setActiveTab('register')}
                                className={`pb-4 px-4 font-mono text-[10px] uppercase tracking-[0.2em] mr-8 transition-colors ${activeTab === 'register' ? 'border-b border-blue-600 text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Register Patient
                            </button>
                            <button 
                                onClick={() => setActiveTab('lookup')}
                                className={`pb-4 px-4 font-mono text-[10px] uppercase tracking-[0.2em] mr-8 transition-colors ${activeTab === 'lookup' ? 'border-b border-blue-600 text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Directory & Triage
                            </button>
                            <button 
                                onClick={() => setActiveTab('appointments')}
                                className={`pb-4 px-4 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors mr-8 ${activeTab === 'appointments' ? 'border-b border-blue-600 text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Appointments
                            </button>
                            <button 
                                onClick={() => setActiveTab('tests')}
                                className={`pb-4 px-4 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${activeTab === 'tests' ? 'border-b border-blue-600 text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Tests & Payments
                            </button>
                        </div>

                        {activeTab === 'register' && (
                            <form ref={formRef} onSubmit={handleRegisterSubmit} className="grid grid-cols-2 gap-x-8 gap-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="col-span-2 mb-2">
                                    <h3 className="font-serif italic text-3xl text-slate-900 font-light">Registration Details</h3>
                                </div>
                                <Input label="Full Name" value={registerForm.name} onChange={e => handleRegisterChange('name', e.target.value)} required />
                                <div className="grid grid-cols-2 gap-6">
                                    <Input label="Age" type="number" value={registerForm.age} onChange={e => handleRegisterChange('age', e.target.value)} required />
                                    <div>
                                        <label className="block font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-2 ml-1">Gender</label>
                                        <select 
                                            value={registerForm.gender} 
                                            onChange={e => handleRegisterChange('gender', e.target.value)}
                                            className="w-full bg-transparent border-b border-slate-300 rounded-none px-2 py-3 font-sans text-slate-900 focus:outline-none focus:border-slate-300 transition-colors appearance-none"
                                        >
                                            <option className="bg-slate-50">Male</option>
                                            <option className="bg-slate-50">Female</option>
                                            <option className="bg-slate-50">Other</option>
                                        </select>
                                    </div>
                                </div>
                                <Input label="Blood Type" value={registerForm.blood_group} onChange={e => handleRegisterChange('blood_group', e.target.value)} placeholder="e.g. O+" />
                                <Input label="Emergency Contact" value={registerForm.emergency_contact} onChange={e => handleRegisterChange('emergency_contact', e.target.value)} />
                                
                                <div className="col-span-2 mt-8 mb-2">
                                    <h3 className="font-serif italic text-3xl text-slate-900 font-light">Medical Context</h3>
                                </div>
                                <Input label="Allergies" value={registerForm.allergies} onChange={e => handleRegisterChange('allergies', e.target.value)} className="col-span-2" />
                                <Input label="Existing Conditions" value={registerForm.existing_conditions} onChange={e => handleRegisterChange('existing_conditions', e.target.value)} className="col-span-2" />
        
                                <div className="col-span-2 mt-12 flex items-center justify-between border-t border-slate-200 pt-8">
                                    {registeredPatient && (
                                       <div className="font-mono text-xs text-slate-900 flex items-center gap-3">
                                           <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                           System ID: {registeredPatient.vela_id}
                                       </div>
                                    )}
                                    <button 
                                        type="submit" 
                                        disabled={registering}
                                        className="ml-auto bg-blue-600 text-white px-12 py-4 text-xs hover:bg-blue-700 disabled:opacity-50 transition-all uppercase tracking-[0.2em] font-mono shadow-lg shadow-blue-500/20 rounded-lg"
                                    >
                                        {registering ? 'Processing...' : 'Generate Record'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {activeTab === 'queue' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-serif italic text-4xl text-slate-900 font-light">Live Queue</h3>
                                    <div className="flex items-center gap-4">
                                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-blue-600">
                                            {queue.filter(q => q.status === 'waiting').length} Waiting · {queue.filter(q => q.status === 'in-progress').length} In Progress
                                        </span>
                                        <button onClick={fetchQueue} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                                            <span className="material-symbols-outlined text-base">refresh</span>
                                        </button>
                                    </div>
                                </div>

                                {queueLoading ? (
                                    <div className="p-16 text-center">
                                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                        <p className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">Syncing queue...</p>
                                    </div>
                                ) : queue.length === 0 ? (
                                    <div className="p-16 border border-slate-100 bg-slate-50/50 rounded-3xl text-center">
                                        <p className="font-serif italic text-2xl text-slate-400 mb-2">Queue is empty</p>
                                        <p className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">No patients waiting</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {queue.map((item, idx) => {
                                            const waitMins = Math.floor((new Date().getTime() - new Date(item.created_at).getTime()) / 60000)
                                            const isWaiting = item.status === 'waiting'
                                            return (
                                                <div key={item.id || idx} className={`flex items-center gap-6 p-6 border rounded-2xl transition-all ${isWaiting ? 'border-blue-100 bg-blue-50/30' : 'border-slate-100 bg-white'}`}>
                                                    <div className="font-mono text-3xl text-slate-300 w-10 text-center font-bold">
                                                        {String(item.queue_position || idx + 1).padStart(2, '0')}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-serif italic text-2xl text-slate-900 mb-1">{item.patient_name}</div>
                                                        <div className="flex gap-4 font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                                                            <span>TKT {item.ticket_number}</span>
                                                            <span>{item.department || 'General'}</span>
                                                            {item.notes && <span className="text-slate-500 normal-case not-italic font-sans text-xs truncate max-w-[200px]">{item.notes}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full border ${isWaiting ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-slate-500 border-slate-200 bg-slate-50'}`}>
                                                            {isWaiting ? `${waitMins}m wait` : 'In Progress'}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'admissions' && (
                            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div>
                                    <h3 className="font-serif italic text-4xl text-slate-900 font-light mb-8">Admission Intelligence</h3>
                                    
                                    {recommendedAdmissions.length === 0 ? (
                                        <div className="p-12 border border-slate-100 bg-slate-50/50 rounded-3xl text-center">
                                            <p className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">No pending AI recommendations</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-6">
                                            {recommendedAdmissions.map((rec, i) => (
                                                <div key={i} className="bg-white border-2 border-blue-600/20 p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 px-4 py-2 bg-blue-600 text-white font-mono text-[9px] uppercase tracking-widest rounded-bl-xl">Atlas Recommendation</div>
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div>
                                                            <h4 className="font-serif italic text-3xl text-slate-900 mb-2">{rec.patient_name}</h4>
                                                            <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-3">
                                                                Ward: <span className="text-blue-600 font-bold">{rec.ward_type}</span>
                                                                <span className="text-slate-200">|</span>
                                                                Priority: <span className={rec.priority === 'urgent' ? 'text-red-500 font-bold' : 'text-amber-500 font-bold'}>{rec.priority}</span>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedRecommendation(rec)
                                                                setAdmissionForm(prev => ({ ...prev, room_type: rec.ward_type === 'ICU' ? 'ICU Bed' : 'General Ward' }))
                                                                setShowAdmissionModal(true)
                                                            }}
                                                            className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg"
                                                        >
                                                            Confirm Admission
                                                        </button>
                                                    </div>
                                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                                        <p className="text-xs text-slate-600 leading-relaxed italic">"{rec.reason}"</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <h3 className="font-serif italic text-4xl text-slate-900 font-light mb-8">Active Inpatients</h3>
                                    {admissionsLoading ? (
                                        <div className="py-20 text-center font-mono text-[10px] text-slate-400 uppercase tracking-widest">Syncing Ward Records...</div>
                                    ) : activeAdmissions.length === 0 ? (
                                        <div className="p-12 border border-slate-100 bg-slate-50/50 rounded-3xl text-center">
                                            <p className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">No active admissions</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-4">
                                            {activeAdmissions.map((adm) => (
                                                <div key={adm.id} className="bg-white border border-slate-100 p-6 rounded-2xl flex items-center justify-between hover:bg-slate-50 transition-all">
                                                    <div className="flex items-center gap-6">
                                                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold font-mono text-lg">
                                                            {adm.beds?.bed_number || '00'}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-serif italic text-xl text-slate-900">{adm.patients?.name}</h4>
                                                            <p className="font-mono text-[9px] text-slate-400 uppercase tracking-widest">{adm.wards?.name} <span className="mx-2">•</span> {adm.room_type}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <div className="text-right">
                                                            <div className="font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-1">Stay Duration</div>
                                                            <div className="font-serif italic text-xl text-slate-900">
                                                                {Math.max(1, Math.ceil((new Date().getTime() - new Date(adm.admitted_at).getTime()) / (1000 * 3600 * 24)))} Days
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleInitiateDischarge(adm)}
                                                            className="px-6 py-2 bg-slate-900 text-white rounded-lg text-[9px] font-mono uppercase tracking-widest hover:bg-amber-600 transition-all flex items-center gap-2"
                                                        >
                                                            <LogOut size={14} />
                                                            Discharge
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'lookup' && (
                            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex gap-6 items-end">
                                    <div className="flex-1">
                                         <Input label="Directory Search (VELA ID)" value={lookupId} onChange={e => setLookupId(e.target.value)} placeholder="VLA-..." autoFocus />
                                    </div>
                                    <button 
                                        onClick={handleLookup}
                                        disabled={lookupLoading || !lookupId}
                                        className="h-[50px] px-10 border border-slate-300 text-slate-900 hover:bg-white transition-colors uppercase font-mono text-[10px] tracking-[0.2em] disabled:opacity-50 rounded-lg"
                                    >
                                        {lookupLoading ? 'Scanning...' : 'Search'}
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setIsScanning(!isScanning)}
                                        className="h-[50px] px-6 border border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors uppercase font-mono text-[10px] tracking-[0.2em] flex flex-col justify-center items-center rounded-lg"
                                    >
                                        <Camera size={18} className="mb-0.5" />
                                        Scan QR
                                    </button>
                                </div>

                                {isScanning && (
                                    <div className="bg-slate-100 p-8 rounded-2xl animate-in fade-in duration-300">
                                       <div id="qr-reader" className="max-w-[400px] mx-auto overflow-hidden rounded-xl border border-slate-300 shadow-sm bg-white" />
                                       <button onClick={() => setIsScanning(false)} className="mt-4 text-center block w-full text-xs text-slate-500 hover:text-slate-900 uppercase font-mono">Cancel Scanning</button>
                                    </div>
                                )}

                                {(lookupPatient || registeredPatient) && (
                                    <div className="bg-white border border-slate-200 p-10 rounded-3xl shadow-sm relative overflow-hidden group">
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-10 border-b border-slate-100 pb-8">
                                                <div>
                                                    <h3 className="font-serif italic text-4xl mb-3 text-slate-900">{(lookupPatient || registeredPatient)?.name}</h3>
                                                    <p className="font-mono text-[10px] text-blue-600 tracking-widest uppercase mb-1">
                                                        {(lookupPatient || registeredPatient)?.vela_id} <span className="mx-2">•</span> Age {(lookupPatient || registeredPatient)?.age}
                                                    </p>
                                                    <div className="space-y-1 mt-4">
                                                        <p className="text-xs text-slate-500">Phone: {(lookupPatient || registeredPatient)?.phone || 'N/A'}</p>
                                                        <p className="text-xs text-slate-500 uppercase">Emergency: {(lookupPatient || registeredPatient)?.emergency_contact_name || 'N/A'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-4">
                                                     <div className="bg-slate-50 border border-slate-100 p-4 flex flex-col items-center shadow-sm rounded-2xl">
                                                         <QRCodeSVG value={(lookupPatient || registeredPatient)?.vela_id || ""} size={96} bgColor="#F8FAFC" fgColor="#0F172A" />
                                                         <span className="text-[8px] uppercase tracking-widest font-mono text-slate-400 mt-3">Patient QR</span>
                                                     </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                                                <div>
                                                    <label className="block font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">Clinical Notes</label>
                                                    <textarea 
                                                        value={ticketNotes}
                                                        onChange={e => setTicketNotes(e.target.value)}
                                                        className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-blue-600 min-h-[120px] resize-none transition-colors"
                                                        placeholder="Enter symptoms or reason for visit..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">Priority Routing</label>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {['General', 'Cardiology', 'Neurology', 'Emergency'].map(dept => (
                                                            <button 
                                                                key={dept}
                                                                onClick={() => setTicketDepartment(dept)}
                                                                className={`text-center px-4 py-3 text-[10px] uppercase tracking-[0.1em] border rounded-xl transition-all ${ticketDepartment === dept ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/10' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-200'}`}
                                                            >
                                                                {dept}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <button 
                                                onClick={handleCreateTicket}
                                                disabled={ticketCreating}
                                                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-mono text-[11px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
                                            >
                                                {ticketCreating ? 'Generating Ticket...' : 'Check-in Patient'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* File Upload */}
                                {lookupPatient && (
                                    <div className="pt-10 border-t border-slate-200">
                                        <div className="flex items-center gap-3 mb-6">
                                            <FileText className="text-blue-600" size={20} />
                                            <h3 className="font-serif italic text-3xl text-slate-900 font-light">Document Ingestion</h3>
                                        </div>
                                        <div 
                                            className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer ${dragOver ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/50'}`}
                                            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                                            onDragLeave={() => setDragOver(false)}
                                            onDrop={(e) => {
                                                e.preventDefault(); setDragOver(false);
                                                const file = e.dataTransfer.files[0];
                                                if (file) setUploadFile(file);
                                            }}
                                            onClick={() => document.getElementById('file-upload')?.click()}
                                        >
                                            <input type="file" id="file-upload" className="hidden" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                                            {uploadFile ? (
                                                <div className="flex items-center justify-center gap-4 text-blue-600">
                                                    <CheckCircle2 size={24} />
                                                    <span className="font-mono text-sm tracking-widest font-bold">{uploadFile.name}</span>
                                                    <button onClick={(e) => {e.stopPropagation(); setUploadFile(null)}} className="ml-4 p-2 bg-slate-200 text-slate-600 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors"><X size={14}/></button>
                                                </div>
                                            ) : (
                                                <div className="text-slate-400">
                                                    <div className="font-mono text-xs uppercase tracking-[0.2em] mb-2 text-slate-900">Drop Clinical Logs</div>
                                                    <div className="text-xs font-light">Scanned reports, prescriptions, or imaging data (PDF/IMG)</div>
                                                </div>
                                            )}
                                        </div>
                                        {uploadFile && (
                                            <button 
                                                onClick={handleUpload}
                                                disabled={uploading}
                                                className="mt-6 w-full bg-blue-600 text-white py-4 rounded-2xl font-mono text-[11px] uppercase tracking-[0.2em] hover:bg-blue-700 transition-all"
                                            >
                                                {uploading ? 'Analyzing Pathology...' : 'Ingest & Cross-Reference'}
                                            </button>
                                        )}
                                        {uploadResult && (
                                            <div className="mt-6 p-6 border border-slate-200 bg-slate-50 rounded-2xl font-mono text-xs text-slate-900/80 tracking-wide border-l-4 border-l-blue-600">
                                                Analysis Complete. Intelligence Link ID: {uploadResult.risk_id}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'appointments' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-serif italic text-3xl text-slate-900 font-light">Today's Appointments</h3>
                                    <span className="font-mono text-[10px] text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">{appointments.length} Scheduled</span>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    {appointmentsLoading ? (
                                        <div className="py-20 text-center font-mono text-[10px] text-slate-400 uppercase tracking-widest">Synchronizing Registry...</div>
                                    ) : appointments.length === 0 ? (
                                        <div className="py-20 border border-slate-100 bg-slate-50 flex flex-col items-center justify-center rounded-3xl">
                                            <Calendar className="text-slate-200 mb-4" size={48} strokeWidth={1} />
                                            <p className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">No appointments for today</p>
                                        </div>
                                    ) : (
                                        appointments.map((apt) => (
                                            <div key={apt.id} className="bg-white border border-slate-200 p-6 rounded-3xl hover:border-blue-600/30 hover:shadow-xl hover:shadow-blue-500/5 transition-all flex items-center justify-between group">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center">
                                                        <span className="font-mono text-xl font-bold text-slate-900">{(apt.appointment_time || apt.time || '00:00').split(':')[0]}</span>
                                                        <span className="font-mono text-[8px] text-slate-400 uppercase font-bold">{(apt.appointment_time || apt.time || '00:00').split(':')[1]} {parseInt((apt.appointment_time || apt.time || '00:00').split(':')[0]) >= 12 ? 'PM' : 'AM'}</span>
                                                    </div>
                                                    <div>
                                                        <h4 className="font-serif italic text-2xl text-slate-900 group-hover:text-blue-600 transition-colors">
                                                            {apt.patients?.name || apt.patient_name || 'Anonymous Patient'}
                                                            {apt.vela_id && <span className="ml-3 font-mono text-[9px] text-blue-600 uppercase tracking-widest border border-blue-600/20 px-2 py-0.5 rounded-full">Vela Network</span>}
                                                        </h4>
                                                        <div className="flex gap-4 mt-1">
                                                            <span className="font-mono text-[9px] text-slate-400 uppercase tracking-widest flex items-center gap-1"><Clock size={10}/> {apt.appointment_time || apt.time}</span>
                                                            <span className="font-mono text-[9px] text-slate-400 uppercase tracking-widest flex items-center gap-1"><UserPlus size={10}/> {apt.doctor_name || 'General Admission'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                    <div className="flex gap-3">
                                                        {(apt.status === 'scheduled' || apt.status === 'pending') ? (
                                                            <button 
                                                                onClick={() => handleMarkArrived(apt.id)}
                                                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                                                            >
                                                                <CheckCircle2 size={14} /> Mark Arrived
                                                            </button>
                                                        ) : apt.status === 'arrived' ? (
                                                            <button 
                                                                onClick={() => handleOpenAssign(apt)}
                                                                className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-mono uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
                                                            >
                                                                <Stethoscope size={14} /> Assign Doctor
                                                            </button>
                                                        ) : (
                                                            <div className="px-6 py-3 border border-slate-100 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-mono uppercase tracking-widest flex items-center gap-2">
                                                                <CheckCircle2 size={14} className="text-green-500" /> Handled
                                                            </div>
                                                        )}
                                                    </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'tests' && (
                            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-serif italic text-4xl text-slate-900 font-light">Diagnostic Fees</h3>
                                    <button onClick={fetchTestOrders} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 transition-all">
                                        <Activity size={18} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 gap-6">
                                    {testLoading ? (
                                        <div className="text-center py-20 text-slate-300 font-mono text-[10px] uppercase tracking-widest">Scanning Clearinghouse...</div>
                                    ) : testOrders.length === 0 ? (
                                        <div className="text-center py-20 border border-slate-100 bg-slate-50 rounded-3xl">
                                            <div className="font-serif italic text-2xl text-slate-400">All accounts cleared</div>
                                            <div className="font-mono text-[9px] uppercase tracking-widest text-slate-300 mt-2">No pending lab payments</div>
                                        </div>
                                    ) : (
                                        testOrders.map((order) => (
                                            <div key={order.id} className="bg-white border border-slate-200 p-8 rounded-3xl hover:border-blue-600/20 hover:shadow-xl hover:shadow-blue-500/5 transition-all flex items-center justify-between group">
                                                <div className="flex items-center gap-8">
                                                    <div className="w-16 h-16 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                                                        <CreditCard size={28} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-serif italic text-3xl text-slate-900">{order.patients?.name}</h4>
                                                        <div className="flex gap-4 mt-2">
                                                            <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">{order.test_type}</span>
                                                            <span className="font-mono text-[10px] text-blue-600 font-bold uppercase tracking-widest">DR. {order.doctor_name || 'WEST'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-10">
                                                    <div className="text-right">
                                                        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-1">Standard Fee</div>
                                                        <div className="text-3xl font-mono font-bold text-slate-900">₹{TEST_PRICES[order.test_type] || 500}</div>
                                                    </div>
                                                    <button 
                                                        onClick={() => { setSelectedTestOrder(order); setShowPaymentModal(true); }}
                                                        className="px-8 py-4 bg-slate-900 text-white rounded-xl font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-blue-600 transition-all shadow-lg"
                                                    >
                                                        Collect Payment
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                              {/* Right Column: Visual Queue */}
                <div className="col-span-12 lg:col-span-5 fade-in-up" ref={queueRef}>
                    <div className="sticky top-12 bg-transparent min-h-[800px] border-l border-slate-200 pl-12 lg:pl-16">
                        <div className="flex items-center justify-between mb-12">
                            <h3 className="font-serif italic text-4xl text-slate-900 font-light">Visual Queue</h3>
                            <button onClick={fetchQueue} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 hover:border-blue-400 transition-all rounded-full shadow-sm">
                                <Activity size={18} className="text-blue-600" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            {queueLoading ? (
                                <div className="text-center py-32 text-slate-300 font-mono text-xs uppercase tracking-[0.2em]">Synchronizing...</div>
                            ) : queue.length === 0 ? (
                                <div className="text-center py-32 border border-slate-100 bg-slate-50 text-slate-400 rounded-3xl">
                                    <Clock size={40} className="mx-auto mb-6 opacity-30" />
                                    <div className="font-serif italic text-3xl mb-2 text-slate-400">Operational calm</div>
                                    <div className="font-mono text-[10px] uppercase tracking-[0.2em]">No active triage tickets</div>
                                </div>
                            ) : (
                                queue.map((item, idx) => (
                                    <div 
                                        key={idx}
                                        className="relative bg-white border border-slate-200 p-8 rounded-3xl hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all flex flex-col justify-between overflow-hidden group"
                                    >
                                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${item.status === 'in-progress' ? 'bg-blue-600' : 'bg-slate-200'}`} />

                                        <div className="flex justify-between items-start mb-6 w-full">
                                            <div className="flex gap-6 items-start">
                                                <span className="font-mono text-4xl text-slate-200 group-hover:text-blue-100 transition-colors">
                                                    {String(idx + 1).padStart(2, '0')}
                                                </span>
                                                <div className="flex flex-col">
                                                    <span className="font-serif italic text-3xl text-slate-900 mb-2">{item.patient_name}</span>
                                                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-blue-600 font-bold">{item.department} ROUTINE</span>
                                                </div>
                                            </div>
                                            <div className="shrink-0">
                                                <div className={`font-mono text-[9px] uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border ${
                                                    item.status === 'in-progress' 
                                                    ? 'bg-blue-50 text-blue-600 border-blue-200' 
                                                    : 'bg-slate-50 text-slate-400 border-slate-100'
                                                }`}>
                                                    {item.status.replace('-', ' ')}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-end border-t border-slate-50 pt-4">
                                            <div className="text-slate-400 text-[9px] font-mono tracking-widest uppercase">
                                                Ticket: {item.ticket_number} • {item.wait_minutes}m
                                            </div>
                                            {item.notes && (
                                                <div className="text-xs font-sans text-slate-400 italic max-w-[200px] truncate">
                                                    "{item.notes}"
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Discharge Modal */}
        {showDischargeModal && selectedDischargeAdmission && (
            <div className="fixed inset-0 bg-[#080808]/95 backdrop-blur-xl z-[200] flex items-center justify-center p-6 animate-in fade-in duration-500">
                <div className="w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden relative border border-slate-100 flex flex-col max-h-[90vh]">
                    <button onClick={() => setShowDischargeModal(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 z-10">
                        <X size={24} />
                    </button>

                    <div className="grid grid-cols-12 h-full overflow-hidden">
                        {/* Left Info Panel */}
                        <div className="col-span-12 lg:col-span-4 bg-slate-50 p-10 border-r border-slate-100 flex flex-col justify-between">
                            <div>
                                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-blue-600 mb-6 font-bold">Patient Clearance</div>
                                <h2 className="font-serif italic text-5xl text-slate-900 mb-1">{selectedDischargeAdmission.patients?.name}</h2>
                                <p className="font-mono text-[11px] text-slate-400 uppercase tracking-widest mb-8">{selectedDischargeAdmission.patients?.vela_id}</p>
                                
                                <div className="space-y-6">
                                    <div className="p-4 bg-white rounded-2xl border border-slate-100">
                                        <div className="font-mono text-[9px] uppercase tracking-widest text-slate-400 mb-1">Ward Location</div>
                                        <div className="font-serif italic text-lg text-slate-900">{selectedDischargeAdmission.wards?.name} • Bed {selectedDischargeAdmission.beds?.bed_number}</div>
                                    </div>
                                    <div className="p-4 bg-white rounded-2xl border border-slate-100">
                                        <div className="font-mono text-[9px] uppercase tracking-widest text-slate-400 mb-1">Stay Duration</div>
                                        <div className="font-serif italic text-lg text-slate-900">{dischargeData?.days || '...'} Days</div>
                                    </div>
                                    <div className="p-4 bg-white rounded-2xl border border-slate-100">
                                        <div className="font-mono text-[9px] uppercase tracking-widest text-slate-400 mb-1">Current Diagnosis</div>
                                        <div className="text-xs text-slate-600 leading-relaxed italic line-clamp-2">{selectedDischargeAdmission.diagnosis}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12 p-8 bg-blue-600 rounded-3xl text-white shadow-xl shadow-blue-500/20">
                                <div className="font-mono text-[9px] uppercase tracking-widest opacity-70 mb-2">Final Billing Amount</div>
                                <div className="font-serif italic text-4xl mb-1">₹{paymentAmount.toLocaleString()}</div>
                                <div className="font-mono text-[8px] uppercase tracking-widest opacity-50 italic">Calculated by VELA Ledger</div>
                            </div>
                        </div>

                        {/* Right Content Area */}
                        <div className="col-span-12 lg:col-span-8 p-10 flex flex-col h-full overflow-hidden">
                            {!dischargeConfirmed ? (
                                <div className="flex flex-col h-full overflow-hidden">
                                    <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                                        {/* Step 1: Summary Generation */}
                                        <div className="mb-10">
                                            <div className="flex justify-between items-center mb-6">
                                                <h3 className="font-serif italic text-3xl text-slate-900">Medical Summary</h3>
                                                <button 
                                                    onClick={handleGenerateSummary}
                                                    disabled={processLoading}
                                                    className="px-6 py-2 bg-slate-900 text-white rounded-full text-[10px] font-mono uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2"
                                                >
                                                    {dischargeSummary ? 'Regenerate Atlas' : 'Generate Atlas Summary'}
                                                </button>
                                            </div>
                                            
                                            {dischargeSummary ? (
                                                <textarea 
                                                    value={dischargeSummary}
                                                    onChange={(e) => setDischargeSummary(e.target.value)}
                                                    className="w-full h-48 bg-slate-50 border border-slate-100 rounded-2xl p-6 font-sans text-xs leading-relaxed text-slate-700 focus:outline-none focus:ring-2 ring-blue-500/10 resize-none transition-all"
                                                />
                                            ) : (
                                                <div className="h-48 border-2 border-dashed border-slate-100 rounded-2xl flex items-center justify-center bg-slate-50/50">
                                                    {processLoading ? (
                                                        <div className="text-center">
                                                            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                                            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-400">Atlas is analyzing lab reports & notes...</p>
                                                        </div>
                                                    ) : (
                                                        <p className="font-mono text-[9px] uppercase tracking-widest text-slate-400 italic">Click generate to start AI analysis</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Step 2: Review & Instructions */}
                                        <div className="grid grid-cols-2 gap-6 mb-10">
                                            <div className="col-span-2">
                                                <Input 
                                                    label="Final Diagnosis confirmed by Doctor" 
                                                    value={finalDiagnosis} 
                                                    onChange={(e) => setFinalDiagnosis(e.target.value)} 
                                                />
                                            </div>
                                            <div>
                                                <Input 
                                                    label="Follow-up Date" 
                                                    type="date"
                                                    value={followUpDate} 
                                                    onChange={(e) => setFollowUpDate(e.target.value)} 
                                                />
                                            </div>
                                            <div>
                                                <label className="block font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-2 ml-1">Payment Method</label>
                                                <select 
                                                    value={paymentMethod}
                                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                                    className="w-full bg-slate-50 border-b border-slate-200 px-2 py-3 font-sans text-xs text-slate-900 focus:outline-none focus:border-blue-500 transition-all"
                                                >
                                                    <option>Cash</option>
                                                    <option>Card</option>
                                                    <option>UPI</option>
                                                    <option>Insurance</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-2 ml-1">Follow-up Instructions</label>
                                                <textarea 
                                                    value={followUpInstructions}
                                                    onChange={(e) => setFollowUpInstructions(e.target.value)}
                                                    className="w-full h-24 bg-slate-50 border border-slate-100 rounded-2xl p-4 font-sans text-xs text-slate-700 focus:outline-none ring-blue-500/10 transition-all"
                                                    placeholder="Medication timing, diet restrictions, etc."
                                                />
                                            </div>
                                        </div>

                                        {/* Step 3: Cost Breakdown */}
                                        <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100">
                                            <h4 className="font-mono text-[10px] uppercase tracking-widest text-slate-900 font-bold mb-6 flex items-center gap-2">
                                                <FileText size={14} className="text-blue-600" />
                                                Billing Breakdown
                                            </h4>
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500">Room: {selectedDischargeAdmission.room_type} ({dischargeData?.days} days)</span>
                                                    <span className="font-mono font-bold">₹{dischargeData?.room_cost?.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500">Laboratory & Diagnostic Tests</span>
                                                    <span className="font-mono font-bold">₹{dischargeData?.test_cost?.toLocaleString()}</span>
                                                </div>
                                                <div className="h-[1px] bg-slate-200 mt-2"></div>
                                                <div className="flex justify-between items-center">
                                                    <span className="font-mono text-[10px] uppercase tracking-widest text-slate-900 font-bold">Total Stay & Treatment Cost</span>
                                                    <span className="font-serif italic text-2xl text-slate-900">₹{dischargeData?.total?.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-8 border-t border-slate-100 flex items-center justify-between mt-auto">
                                        <div className="flex items-center gap-4">
                                            <span className="w-3 h-3 rounded-full bg-blue-600 animate-pulse"></span>
                                            <span className="font-mono text-[9px] uppercase tracking-widest text-slate-400">Ledger Status: Balanced</span>
                                        </div>
                                        <button 
                                            onClick={handleConfirmDischarge}
                                            disabled={processLoading || !dischargeSummary}
                                            className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-mono text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                                        >
                                            {processLoading ? 'Processing Clearance...' : 'Confirm Final Discharge'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-12 text-center h-full animate-in zoom-in duration-500">
                                    <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-8">
                                        <CheckCircle2 size={48} strokeWidth={1.5} />
                                    </div>
                                    <h3 className="font-serif italic text-5xl text-slate-900 mb-4">Clearance Successful</h3>
                                    <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest mb-12 max-w-sm mx-auto leading-relaxed">
                                        Patient {selectedDischargeAdmission.patients?.name} has been marked as discharged. Ward and billing records are synced.
                                    </p>
                                    
                                    <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                                        <button 
                                            onClick={() => handlePrint('summary')}
                                            className="flex flex-col items-center gap-4 p-6 bg-slate-50 border border-slate-100 rounded-3xl hover:bg-white hover:border-blue-600/30 hover:shadow-xl transition-all group"
                                        >
                                            <div className="p-3 bg-white rounded-xl text-slate-400 group-hover:text-blue-600 transition-colors shadow-sm">
                                                <FileText size={20} />
                                            </div>
                                            <span className="font-mono text-[9px] uppercase tracking-widest text-slate-600">Print Summary</span>
                                        </button>
                                        <button 
                                            onClick={() => handlePrint('receipt')}
                                            className="flex flex-col items-center gap-4 p-6 bg-slate-50 border border-slate-100 rounded-3xl hover:bg-white hover:border-blue-600/30 hover:shadow-xl transition-all group"
                                        >
                                            <div className="p-3 bg-white rounded-xl text-slate-400 group-hover:text-blue-600 transition-colors shadow-sm">
                                                <CreditCard size={20} />
                                            </div>
                                            <span className="font-mono text-[9px] uppercase tracking-widest text-slate-600">Print Receipt</span>
                                        </button>
                                    </div>

                                    <button 
                                        onClick={() => setShowDischargeModal(false)}
                                        className="mt-12 font-mono text-[10px] uppercase tracking-widest text-blue-600 hover:text-blue-700 font-bold"
                                    >
                                        Complete & Exit →
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        <style>{`
            @media print {
                body * { visibility: hidden; }
                .print-content, .print-content * { visibility: visible; }
                .print-content { position: absolute; left: 0; top: 0; width: 100%; }
            }
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
            .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
        `}</style>
      </main>
        {/* PAYMENT MODAL */}
        {showPaymentModal && selectedTestOrder && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in transition-all">
             <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                   <div>
                      <h3 className="font-serif italic text-3xl text-slate-900 mb-1">Compute Fees</h3>
                      <p className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">{selectedTestOrder.patients?.name}</p>
                   </div>
                   <button onClick={() => setShowPaymentModal(false)} className="p-2 text-slate-400 hover:text-slate-900"><X size={20} /></button>
                </div>
                
                <div className="p-8 space-y-6">
                   <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm font-medium text-slate-600 border-b border-slate-50 pb-3">
                         <span>Diagnostic Tool</span>
                         <span>Estimated Fee</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                         <span className="text-slate-900">{selectedTestOrder.test_type}</span>
                         <span className="font-mono text-blue-600">₹{TEST_PRICES[selectedTestOrder.test_type] || 500}</span>
                      </div>

                      <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                         <span className="font-serif text-2xl text-slate-900">Total Due</span>
                         <div className="text-right">
                            <span className="text-3xl font-mono font-bold text-slate-900">₹{TEST_PRICES[selectedTestOrder.test_type] || 500}</span>
                            <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Tax Integrated</div>
                         </div>
                      </div>
                   </div>

                   <button 
                      onClick={() => handleConfirmPayment(selectedTestOrder.id, TEST_PRICES[selectedTestOrder.test_type] || 500)}
                      className="w-full py-5 bg-blue-600 text-white font-mono text-[12px] font-bold uppercase tracking-[0.3em] hover:bg-blue-700 rounded-2xl transition-all shadow-xl shadow-blue-500/30 active:scale-[0.98]"
                   >
                      Confirm Collection
                   </button>
                   <p className="text-center text-[10px] font-mono text-slate-400 uppercase tracking-[0.1em]">Print Receipt Auto-Queued</p>
                </div>
             </div>
          </div>
        )}

        {/* ADMISSION MODAL */}
        {showAdmissionModal && selectedRecommendation && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in transition-all">
                <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
                    <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <div>
                            <h3 className="font-serif italic text-3xl text-slate-900 mb-1">Confirm Admission</h3>
                            <p className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">Allocating resources for {selectedRecommendation.patient_name}</p>
                        </div>
                        <button onClick={() => setShowAdmissionModal(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><X size={24} /></button>
                    </div>

                    <div className="p-10 space-y-8">
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <label className="block font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">Select Ward</label>
                                <select 
                                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-blue-600 transition-all appearance-none"
                                    value={admissionForm.ward_id}
                                    onChange={(e) => setAdmissionForm(prev => ({ ...prev, ward_id: e.target.value, bed_id: '' }))}
                                >
                                    <option value="">Select a Ward</option>
                                    {wards.map(w => (
                                        <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">Select Bed</label>
                                <select 
                                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-blue-600 transition-all appearance-none disabled:opacity-50"
                                    value={admissionForm.bed_id}
                                    disabled={!admissionForm.ward_id}
                                    onChange={(e) => setAdmissionForm(prev => ({ ...prev, bed_id: e.target.value }))}
                                >
                                    <option value="">Select a Bed</option>
                                    {wards.find(w => w.id === admissionForm.ward_id)?.beds
                                        .filter((b: any) => b.status === 'available')
                                        .map((b: any) => (
                                            <option key={b.id} value={b.id}>Bed {b.bed_number}</option>
                                        ))
                                    }
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <label className="block font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">Room Type</label>
                                <select 
                                    className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-blue-600 transition-all appearance-none"
                                    value={admissionForm.room_type}
                                    onChange={(e) => setAdmissionForm(prev => ({ ...prev, room_type: e.target.value }))}
                                >
                                    {roomTypes.map(r => (
                                        <option key={r.id} value={r.name}>{r.name} - ₹{r.cost_per_day}/day</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col justify-end">
                                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                    <span className="font-mono text-[10px] text-blue-400 uppercase tracking-widest mr-2">Estimated Rate:</span>
                                    <span className="font-mono text-lg font-bold text-blue-600">₹{roomTypes.find(r => r.name === admissionForm.room_type)?.cost_per_day || 0}</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <Input label="Final Diagnosis" value={admissionForm.diagnosis} onChange={(e) => setAdmissionForm(prev => ({ ...prev, diagnosis: e.target.value }))} placeholder={selectedRecommendation.reason} />
                        </div>

                        <button 
                            onClick={handleConfirmAdmission}
                            disabled={confirmingAdmission || !admissionForm.bed_id}
                            className="w-full py-5 bg-blue-600 text-white font-mono text-[12px] font-bold uppercase tracking-[0.3em] hover:bg-blue-700 rounded-2xl transition-all shadow-xl shadow-blue-500/30 disabled:opacity-50"
                        >
                            {confirmingAdmission ? 'Confirming with Central Registry...' : 'Finalize Admission'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* SUCCESS MODAL with QR */}
        {successAdmission && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-[#080808]/90 backdrop-blur-xl animate-in fade-in transition-all">
                <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl p-12 text-center relative animate-in zoom-in-95 duration-500">
                    <button onClick={() => setSuccessAdmission(null)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-colors"><X size={24} /></button>
                    
                    <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                        <CheckCircle2 size={40} />
                    </div>

                    <h3 className="font-serif italic text-4xl text-slate-900 mb-2">Admission Confirmed</h3>
                    <p className="font-mono text-[10px] text-slate-400 uppercase tracking-[0.2em] mb-10">Patient lifecycle synchronized</p>

                    <div className="bg-slate-50 p-10 rounded-[32px] mb-10 border border-slate-100 flex flex-col items-center">
                        <div className="p-4 bg-white rounded-2xl shadow-sm mb-6">
                            <QRCodeSVG value={successAdmission.admission_qr} size={180} />
                        </div>
                        <div className="font-mono text-xl font-bold text-slate-900 tracking-wider">
                            {successAdmission.admission_qr}
                        </div>
                        <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-2">{successAdmission.ward_name} <span className="mx-2">•</span> BED {successAdmission.bed_number}</p>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed max-w-[280px] mx-auto mb-8 font-light italic">
                        The patient record is now active in the ward database. Scan this code at any ward terminal for clinical history.
                    </p>

                    <button 
                        onClick={() => {
                            setSuccessAdmission(null)
                            setActiveTab('admissions')
                        }}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-mono text-[11px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all"
                    >
                        Back to Console
                    </button>
                </div>
            </div>
        )}
        {/* ── ASSIGN DOCTOR MODAL ── */}
        {showAssignModal && selectedApt && (
            <div className="fixed inset-0 bg-[#080808]/90 backdrop-blur-xl z-[200] flex items-center justify-center p-8 animate-in fade-in duration-500">
                <div className="bg-white max-w-4xl w-full rounded-[40px] overflow-hidden shadow-2xl border border-white/20 animate-in slide-in-from-bottom-12 duration-700">
                    <div className="p-12 border-b border-slate-100 flex justify-between items-start">
                        <div>
                            <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-blue-600 font-bold mb-4 block">Deployment Console</span>
                            <h2 className="font-serif italic text-5xl text-slate-900 m-0">Assign Specialist</h2>
                            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mt-4">
                                Patient: <span className="text-slate-900 font-bold font-sans normal-case">{selectedApt.patients?.name || selectedApt.patient_name}</span>
                                <span className="mx-4 text-slate-200">|</span>
                                VELA ID: <span className="text-blue-600 font-bold">{selectedApt.vela_id || 'LOCAL-REG'}</span>
                            </p>
                        </div>
                        <button onClick={() => setShowAssignModal(false)} className="p-4 hover:bg-slate-50 rounded-full transition-colors">
                            <X size={32} strokeWidth={1} text-slate-300 />
                        </button>
                    </div>

                    <div className="p-12 max-h-[60vh] overflow-y-auto">
                        <div className="mb-12">
                            <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-6 block">Triage Level & Priority</label>
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { id: 'Routine', color: 'bg-emerald-50 text-emerald-600', active: 'bg-emerald-600 text-white' },
                                    { id: 'Stable', color: 'bg-blue-50 text-blue-600', active: 'bg-blue-600 text-white' },
                                    { id: 'Urgent', color: 'bg-rose-50 text-rose-600', active: 'bg-rose-600 text-white' }
                                ].map(level => (
                                    <button
                                        key={level.id}
                                        onClick={() => setTriageLevel(level.id)}
                                        className={`px-8 py-5 rounded-2xl font-mono text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 border border-transparent ${triageLevel === level.id ? level.active : 'bg-slate-50 text-slate-400 hover:border-slate-200'}`}
                                    >
                                        {level.id === 'Urgent' && <ShieldAlert size={16} />}
                                        {level.id}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-6 block">Available Medical Personnel</label>
                            <div className="grid grid-cols-1 gap-4">
                                {doctorStats.length === 0 ? (
                                    <div className="py-20 text-center border border-slate-100 border-dashed rounded-[32px]">
                                        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">No personnel currently listed as active in registry</p>
                                    </div>
                                ) : (
                                    doctorStats.map(doc => (
                                        <div key={doc.id} className="p-8 border border-slate-100 rounded-[32px] flex items-center justify-between hover:border-blue-600/30 transition-all bg-slate-50/30 group">
                                            <div className="flex items-center gap-8">
                                                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-300">
                                                    <Stethoscope size={28} />
                                                </div>
                                                <div>
                                                    <h3 className="font-serif italic text-3xl text-slate-900 group-hover:text-blue-600 transition-all">Dr. {doc.name}</h3>
                                                    <div className="flex gap-4 items-center mt-2">
                                                        <span className="font-mono text-[9px] uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{doc.specialization}</span>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${doc.online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-200'}`}></span>
                                                        <span className="font-mono text-[9px] uppercase tracking-widest text-slate-400">{doc.online ? 'Online' : 'Offline'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-12">
                                                <div className="flex gap-8">
                                                    <div className="text-center">
                                                        <div className="font-serif italic text-4xl text-slate-900 leading-none">{doc.waiting_count}</div>
                                                        <div className="font-mono text-[9px] uppercase tracking-widest text-slate-400 mt-2">Waiting</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="font-serif italic text-4xl text-slate-900 leading-none">{doc.consulting_count}</div>
                                                        <div className="font-mono text-[9px] uppercase tracking-widest text-slate-400 mt-2">Inside</div>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleAssignSubmit(doc.id)}
                                                    disabled={assigning}
                                                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-mono text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10"
                                                >
                                                    {assigning ? '...' : 'Assign'}
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

    </div>
  )
}

const TEST_PRICES: Record<string, number> = {
  "Blood CBC": 200,
  "Lipid Profile": 400,
  "Blood Sugar": 150,
  "Kidney Function": 500,
  "Liver Function": 600,
  "Thyroid": 400,
  "Urine Routine": 100,
  "ECG": 300,
  "X-Ray": 500,
  "MRI": 3000,
  "CT Scan": 2500,
  "Ultrasound": 800
};

function Input({ label, className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
    return (
        <div className={className}>
            <label className="block font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-2 ml-1">{label}</label>
            <input 
                {...props}
                className="w-full bg-transparent border-b border-slate-300 rounded-none px-2 py-3 font-sans text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-300 transition-colors"
                autoComplete="off"
            />
        </div>
    )
}
