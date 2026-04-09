import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Toaster } from "react-hot-toast";
import Login from "./pages/Login";
import LandingPage from "./pages/LandingPage";
import ProtectedRoute from "./components/ProtectedRoute";
import Atlas from "./components/Atlas/Atlas";
import useSocket from "./hooks/useSocket";
import Receptionist from './pages/Receptionist';
import Doctor from "./pages/Doctor"
import PatientDetail from "./pages/PatientDetail"
import PatientsList from "./pages/PatientsList"
import Emergency from "./pages/Emergency"
import AddPatient from "./pages/AddPatient"
import Handover from "./pages/Handover"
import PatientPortal from "./pages/PatientPortal";
import PatientDashboard from "./pages/PatientDashboard";
import QRScan from "./pages/QRScan";
import HospitalManager from "./pages/HospitalManager";
import LabController from "./pages/LabController";
import WardScan from "./pages/WardScan";
import VelaOwner from "./pages/VelaOwner";
import ManagerWalkthrough from "./pages/ManagerWalkthrough";
// import { isAuthenticated, getUser } from "./utils/auth";

function AtlasWrapper({ currentPatientId }: { currentPatientId?: string }) {
  const location = useLocation();
  const hiddenPaths = ['/', '/login', '/portal', '/patient-dashboard', '/ward-scan'];
  
  // Also hide on dynamic scan routes
  if (hiddenPaths.includes(location.pathname)) return null;
  if (location.pathname.startsWith('/scan/')) return null;

  const role = localStorage.getItem("vela_role");
  const auth = localStorage.getItem("vela_auth");
  const showAtlas = auth === "true" && 
    (role === "doctor" || role === "receptionist");

  if (!showAtlas) return null;

  return <Atlas currentPatientId={currentPatientId} />;
}

function App() {
  useSocket();
  const [currentPatientId, setCurrentPatientId] = useState<string | undefined>();
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (window as any).setAtlasPatient = setCurrentPatientId;
  }, []);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let rx = 0, ry = 0;
    let animId: number;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    let mouseX = 0, mouseY = 0;

    const animate = () => {
      rx = lerp(rx, mouseX, 0.12);
      ry = lerp(ry, mouseY, 0.12);
      ring.style.transform = `translate(${rx - 14}px, ${ry - 14}px)`;
      animId = requestAnimationFrame(animate);
    };

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.transform = `translate(${e.clientX - 2.5}px, ${e.clientY - 2.5}px)`;
    };

    const onDown = () => dot.classList.add('click');
    const onUp = () => dot.classList.remove('click');

    // Expanded interactive selectors
    const interactiveSelectors = 'a, button, [role="button"], input, select, textarea, label, [data-clickable="true"]';

    const addHover = (e: Event) => {
      const el = e.target as Element;
      if (el.closest(interactiveSelectors)) {
        dot.classList.add('hover');
        ring.classList.add('hover');
      }
    };

    const removeHover = (e: Event) => {
      const el = e.target as Element;
      if (el.closest(interactiveSelectors)) {
        dot.classList.remove('hover');
        ring.classList.remove('hover');
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('mouseover', addHover);
    document.addEventListener('mouseout', removeHover);
    animId = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('mouseover', addHover);
      document.removeEventListener('mouseout', removeHover);
      cancelAnimationFrame(animId);
    };
  }, []);

  useEffect(() => {
    const stopSpace = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        const tag = (e.target as HTMLElement).tagName
        if (tag !== "INPUT" && 
            tag !== "TEXTAREA" && 
            tag !== "SELECT") {
          e.preventDefault()
        }
      }
    }
    window.addEventListener("keydown", stopSpace)
    return () => 
      window.removeEventListener("keydown", stopSpace)
  }, [])

  return (
    <BrowserRouter>
      {/* Noise grain overlay */}
      <div
        style={{
          position: "fixed",
          top: 0, left: 0,
          width: "100%", height: "100%",
          pointerEvents: "none",
          zIndex: 99990,
          opacity: 0.025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px"
        }}
      />

      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />

      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#121211',
            color: '#FAFAF9',
            fontFamily: "'Geist', sans-serif",
            border: '1px solid rgba(200,184,154,0.3)',
            borderRadius: '12px',
            fontSize: '14px',
            padding: '12px 24px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          },
          success: {
            iconTheme: {
              primary: 'var(--success)',
              secondary: 'var(--success-light)',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--danger)',
              secondary: 'var(--danger-light)',
            },
          },
        }}
      />
      
      <AtlasWrapper currentPatientId={currentPatientId} />

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Doctor /></ProtectedRoute>} />
        <Route path="/receptionist" element={<ProtectedRoute><Receptionist /></ProtectedRoute>} />
        <Route path="/patients" element={<ProtectedRoute><PatientsList /></ProtectedRoute>} />
        <Route path="/patients/add" element={<ProtectedRoute><AddPatient /></ProtectedRoute>} />
        <Route path="/patients/:id" element={<ProtectedRoute><PatientDetail /></ProtectedRoute>} />
        <Route path="/emergency" element={<ProtectedRoute><Emergency /></ProtectedRoute>} />
        <Route path="/handover" element={<ProtectedRoute><Handover /></ProtectedRoute>} />
        <Route path="/portal" element={<PatientPortal />} />
        <Route path="/patient-dashboard" element={<ProtectedRoute><PatientDashboard /></ProtectedRoute>} />
        <Route path="/scan/:velaId" element={<QRScan />} />
        <Route path="/hospital-manager" element={<ProtectedRoute><HospitalManager /></ProtectedRoute>} />
        <Route path="/lab-controller" element={<ProtectedRoute><LabController /></ProtectedRoute>} />
        <Route path="/ward-scan" element={<WardScan />} />
        <Route path="/vela-owner" element={<VelaOwner />} />
        <Route path="/walkthrough" element={<ManagerWalkthrough />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
