const VALID_CREDENTIALS = [
  { email: "doctor@vela.ai", password: "vela2025", name: "Dr. Arjun Mehta", role: "Senior Physician", ward: "ICU" },
  { email: "admin@vela.ai", password: "vela2025", name: "Dr. Priya Singh", role: "Head of Medicine", ward: "General" }
]

const RECEPTIONIST_CREDENTIALS = { email: "reception@vela.ai", password: "vela2025", name: "Anjali Rao", role: "Receptionist" }
const PATIENT_CREDENTIALS = { velaId: "VLA-0001", password: "patient2025", name: "Aarav Sharma", role: "Patient" }
const HOSPITAL_MANAGER_CREDENTIALS = { email: "manager@vela.ai", password: "vela2025", name: "Executive Manager", role: "Hospital Manager" }

export function login(email: string, password: string): boolean {
  const match = VALID_CREDENTIALS.find(c => c.email === email && c.password === password)
  if (match) {
    localStorage.setItem("vela_user", JSON.stringify(match))
    localStorage.setItem("vela_auth", "true")
    localStorage.setItem("vela_role", "doctor")
    return true
  }
  return false
}

export function getUser() {
  const u = localStorage.getItem("vela_user")
  return u ? JSON.parse(u) : null
}

export function logout() {
  localStorage.removeItem("vela_user")
  localStorage.removeItem("vela_auth")
  localStorage.removeItem("vela_role")
  localStorage.removeItem("vela_patient_id")
  localStorage.removeItem("vela_hospital_id")
}

export function isAuthenticated(): boolean {
  return localStorage.getItem("vela_auth") === "true"
}

export function receptionistLogin(email: string, password: string): boolean {
  if (email === RECEPTIONIST_CREDENTIALS.email && password === RECEPTIONIST_CREDENTIALS.password) {
    localStorage.setItem("vela_user", JSON.stringify(RECEPTIONIST_CREDENTIALS))
    localStorage.setItem("vela_auth", "true")
    localStorage.setItem("vela_role", "receptionist")
    return true
  }
  return false
}

export function patientLogin(velaId: string, password: string): boolean {
  if (velaId === PATIENT_CREDENTIALS.velaId && password === PATIENT_CREDENTIALS.password) {
    localStorage.setItem("vela_user", JSON.stringify({ name: PATIENT_CREDENTIALS.name, role: PATIENT_CREDENTIALS.role }))
    localStorage.setItem("vela_auth", "true")
    localStorage.setItem("vela_role", "patient")
    localStorage.setItem("vela_patient_id", PATIENT_CREDENTIALS.velaId)
    return true
  }
  return false
}

export function getPatientVelaId(): string | null {
  return localStorage.getItem("vela_patient_id")
}

export function managerLogin(email: string, password: string): boolean {
  if (email === HOSPITAL_MANAGER_CREDENTIALS.email && password === HOSPITAL_MANAGER_CREDENTIALS.password) {
    localStorage.setItem("vela_user", JSON.stringify(HOSPITAL_MANAGER_CREDENTIALS))
    localStorage.setItem("vela_auth", "true")
    localStorage.setItem("vela_role", "hospital_manager")
    return true
  }
  return false
}

const LAB_CREDENTIALS = { email: "lab@vela.ai", password: "lab2025", name: "Diagnostic Lead", role: "Lab Controller" }

export function labLogin(email: string, password: string): boolean {
  if (email === LAB_CREDENTIALS.email && password === LAB_CREDENTIALS.password) {
    localStorage.setItem("vela_user", JSON.stringify(LAB_CREDENTIALS))
    localStorage.setItem("vela_auth", "true")
    localStorage.setItem("vela_role", "lab_controller")
    return true
  }
  return false
}

import { API_URL } from './config'

export async function networkReceptionistLogin(email: string, password: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/network/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (data.status === 'success') {
      localStorage.setItem('vela_user', JSON.stringify({ name: data.receptionist_name, role: 'Receptionist', hospital_name: data.hospital_name }))
      localStorage.setItem('vela_auth', 'true')
      localStorage.setItem('vela_role', 'receptionist')
      localStorage.setItem('vela_hospital_id', data.hospital_id)
      return true
    }
    return false
  } catch {
    return false
  }
}
