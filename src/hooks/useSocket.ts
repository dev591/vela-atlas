import { SOCKET_URL } from "../utils/config";
import { useEffect } from "react"
import { io } from "socket.io-client"
import toast from "react-hot-toast"

export const socket = io(SOCKET_URL)

export default function useSocket() {
  useEffect(() => {
    socket.on("risk_alert", (data) => {
      toast.error(
        `RISK ALERT — ${data.patient_name} · Score: ${data.risk_score}/100\n${data.summary}`,
        { duration: 10000, style: { fontFamily: "Geist Mono", fontSize: "13px" } }
      )
      const utterance = new SpeechSynthesisUtterance(
        `Risk alert. ${data.patient_name}. Risk score ${data.risk_score}. ${data.summary}`
      )
      utterance.rate = 1.1
      utterance.volume = 1
      window.speechSynthesis.speak(utterance)
    })

    socket.on("deterioration_alert", (data) => {
      toast(`DETERIORATION — ${data.summary}`,
        { duration: 10000, icon: "⚠️", style: { fontFamily: "Geist Mono", fontSize: "13px" } }
      )
    })

    socket.on("medication_warning", (data) => {
      toast(`MEDICATION WARNING — ${data.medication} · Risk: ${data.risk_level.toUpperCase()}`,
        { duration: 12000, icon: "💊", style: { fontFamily: "Geist Mono", fontSize: "13px" } }
      )
    })

    socket.on("recommendations_ready", () => {
      toast.success(`Recommendations ready for patient`,
        { duration: 4000, style: { fontFamily: "Geist Mono", fontSize: "13px" } }
      )
    })

    socket.on("next_patient", (data) => {
      if (data.atlas_summary) {
        window.speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(data.atlas_summary)
        u.rate = 0.92; u.volume = 1.0
        const voices = window.speechSynthesis.getVoices()
        const preferred = voices.find((v: SpeechSynthesisVoice) =>
          v.name.includes("Google UK English Male") ||
          v.name.includes("Google US English") ||
          v.name.includes("Daniel")
        )
        if (preferred) u.voice = preferred
        window.speechSynthesis.speak(u)
      }
      toast.success(`Next: ${data.patient_name}`, { duration: 5000 })
      window.dispatchEvent(new CustomEvent("navigate_to_patient", { detail: { patient_id: data.patient_id } }))
    })

    const handlePatientCompleted = (data: any) => {
      toast.success(`Consultation completed: ${data.patient_name || ''}`)
      window.dispatchEvent(new CustomEvent("patient_completed", { detail: data }))
    }
    socket.on("patient_completed", handlePatientCompleted)

    socket.on("patient_registered", (data: any) => {
      toast.success(`New patient registered: ${data.patient_name || ''}`, { icon: "🆕", duration: 4000 })
    })

    socket.on("atlas_analysis_ready", (data: any) => {
      toast.success(`Atlas analysis ready for ${data.patient_name || 'patient'}`, { icon: "🧠", duration: 5000 })
    })

    socket.on("lab_report_submitted", (data: any) => {
      toast.success(`Lab report submitted: ${data.patient_name || ''}`, { icon: "📊", duration: 6000 })
    })

    socket.on("patient_admitted_qr", (data: any) => {
      toast.success(`${data.patient_name || 'Patient'} admitted — QR generated`, { icon: "🏥", duration: 6000 })
    })

    socket.on("patient_discharged", (data: any) => {
      toast(`${data.patient_name || 'Patient'} discharged`, { icon: "🏠", duration: 5000 })
    })

    socket.on("bed_status_changed", (data: any) => {
      toast(`Bed ${data.bed_number || ''} status: ${data.status || ''}`, { icon: "🛏", duration: 4000 })
    })

    socket.on("discharge_recommended", (data: any) => {
      toast(`Discharge recommended: ${data.patient_name || ''}`, { icon: "📋", duration: 6000 })
    })

    socket.on("admission_recommended", (data: any) => {
      toast(`Admission recommended: ${data.patient_name || ''}`, { icon: "🏥", duration: 6000 })
    })

    socket.on("test_ordered", (data: any) => {
      toast(`Test ordered for ${data.patient_name || ''}`, { icon: "🔬", duration: 4000 })
    })

    socket.on("payment_confirmed", (data: any) => {
      toast.success(`Payment confirmed: ${data.patient_name || ''}`, { icon: "💳", duration: 4000 })
    })

    socket.on("queue_updated", () => {
      window.dispatchEvent(new CustomEvent("vela_queue_updated"))
    })

    socket.on("queue_position_updated", (data: any) => {
      window.dispatchEvent(new CustomEvent("vela_queue_position_updated", { detail: data }))
    })

    socket.on("new_appointment", (data: any) => {
      toast(`New appointment: ${data.patient_name || ''}`, { icon: "📅", duration: 4000 })
    })

    socket.on("appointment_approved", (data: any) => {
      toast.success(`Appointment approved: ${data.patient_name || ''}`, { icon: "✅", duration: 4000 })
    })

    return () => {
      socket.off("risk_alert")
      socket.off("deterioration_alert")
      socket.off("medication_warning")
      socket.off("recommendations_ready")
      socket.off("next_patient")
      socket.off("patient_completed", handlePatientCompleted)
      socket.off("patient_registered")
      socket.off("atlas_analysis_ready")
      socket.off("lab_report_submitted")
      socket.off("patient_admitted_qr")
      socket.off("patient_discharged")
      socket.off("bed_status_changed")
      socket.off("discharge_recommended")
      socket.off("admission_recommended")
      socket.off("test_ordered")
      socket.off("payment_confirmed")
      socket.off("queue_updated")
      socket.off("queue_position_updated")
      socket.off("new_appointment")
      socket.off("appointment_approved")
    }
  }, [])

  return socket
}
