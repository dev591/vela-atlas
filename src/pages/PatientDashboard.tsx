import { API_URL } from "../utils/config";
import { Activity, Calendar, Download, FileText, Pill, User, X, MapPin, Mic, CalendarPlus, ChevronRight, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { QRCodeSVG } from 'qrcode.react';
// @googlemaps/js-api-loader used via dynamic import inside loadMap
import useSocket from "../hooks/useSocket";

const PatientDashboard = () => {
  const [patient, setPatient] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  // const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home"); 
  const navigate = useNavigate();

  // Find Care State
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [symptoms, setSymptoms] = useState("");
  const [isListeningFindCare, setIsListeningFindCare] = useState(false);
  const [isTriageLoading, setIsTriageLoading] = useState(false);
  const [triageResult, setTriageResult] = useState<any>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [mapObj, setMapObj] = useState<any>(null);
  const [mapLibrary, _setMapLibrary] = useState<any>(null);
  const mapRef = useRef<HTMLDivElement>(null);       // DOM container for map
  const googleRef = useRef<any>(null);               // google namespace ref
  const mapInstanceRef = useRef<any>(null);          // map instance ref
  const userLocationRef = useRef<{lat: number, lng: number} | null>(null); // stable location ref
  
  // Initialize Google Maps options — replaced by loadMap below
  // (setOptions kept for type compat but not used for Places)

  // Booking Modal
  const [bookingHospital, setBookingHospital] = useState<any>(null);
  const [selectedHospital, setSelectedHospital] = useState<any>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [networkHospitals, setNetworkHospitals] = useState<any[]>([]);
  const [bookingNetworkHospitalId, setBookingNetworkHospitalId] = useState<string | null>(null);

  // Atlas State
  const [atlasListening, setAtlasListening] = useState(false);
  const [atlasResponse, setAtlasResponse] = useState("I am Atlas. Hold the mic to speak to me.");
  const recognitionRef = useRef<any>(null);

  // Appointments & Queue Tracking
  const [appointments, setAppointments] = useState<any[]>([]);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [labHistory, setLabHistory] = useState<any[]>([]);
  const [activeLabOrder, setActiveLabOrder] = useState<any>(null);
  const [isLabLoading, setIsLabLoading] = useState(false);
  const [reassessing, setReassessing] = useState<string | null>(null);
  const [activeAdmission, setActiveAdmission] = useState<any>(null);
  const [patientHistory, setPatientHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const socket = useSocket();

  useEffect(() => {
    const fetchPatientData = async () => {
      const velaId = localStorage.getItem("vela_vela_id");
      if (!velaId) {
        navigate("/portal");
        return;
      }
      try {
        const res = await axios.get(`${API_URL}/api/receptionist/lookup/${velaId}`);
        const p = res.data.patient;
        setPatient(p);
        setDocuments(res.data.documents || []);
        setMedications(res.data.medications || []);
        localStorage.setItem("vela_patient", JSON.stringify(p));

        // Fetch Appointments
        const aptRes = await axios.get(`${API_URL}/api/appointments/patient/${p.id}`);
        setAppointments(aptRes.data.appointments || []);

        // Fetch Lab History
        fetchLabHistory(p.id);

        // Fetch Active Admission
        fetchActiveAdmission(p.id);

        // Check for arrived appointment/live queue
        const arrivedApt = (aptRes.data.appointments || []).find((a: any) => a.status === 'arrived');
        if (arrivedApt) {
            const qRes = await axios.get(`${API_URL}/api/appointments/queue/${arrivedApt.id}`);
            if (qRes.data.status === 'success') {
                setQueueStatus(qRes.data);
            }
        }
      } catch (err) {
        toast.error("Could not load your records");
      } finally {
        setLoading(false);
      }
    };
    fetchPatientData();
  }, [navigate]);

  const fetchActiveAdmission = async (patientId: string) => {
    try {
      const res = await axios.get(`${API_URL}/api/admissions/patient/${patientId}`);
      if (res.data.status === 'success') {
        setActiveAdmission(res.data.admission);
      }
    } catch (err) {
      console.error("Admission fetch error", err);
    }
  };

  const fetchLabHistory = async (patientId: string) => {
    setIsLabLoading(true);
    try {
        const res = await axios.get(`${API_URL}/api/lab/patient/${patientId}`);
        const history = res.data?.history || [];
        setLabHistory(history);
        
        // Check for active (non-completed) lab order for live tracking
        if (Array.isArray(history)) {
          const active = history.find((h: any) => h.status !== 'completed' && h.status !== 'cancelled');
          if (active) {
              axios.get(`${API_URL}/api/lab/queue/${patientId}`)
                  .then(qRes => setActiveLabOrder({ ...active, queue: qRes.data }))
                  .catch(console.error);
          } else {
              setActiveLabOrder(null);
          }
        }
    } catch (err) {
        console.error("Lab fetch error", err);
    } finally {
        setIsLabLoading(false);
    }
  };

  const fetchPatientHistory = async (patientId: string) => {
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/history/patient/${patientId}`);
      if (res.data?.status === 'success') {
        setPatientHistory(res.data?.history || []);
      }
    } catch (err) {
      console.error("History fetch error", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "find-care") return;

    // Fetch Vela network hospitals
    axios.get(`${API_URL}/api/network/hospitals`)
      .then(r => { if (r.data.status === 'success') setNetworkHospitals(r.data.hospitals); })
      .catch(console.error);

    // Load Google Maps + init map + get location — using setOptions/importLibrary API
    const loadMap = async () => {
      try {
        const key = import.meta.env.VITE_GOOGLE_MAPS_KEY || "";
        if (!key) { console.error("[Maps] VITE_GOOGLE_MAPS_KEY missing"); return; }
        console.log("[Maps] Key exists:", !!key, key.slice(0, 8));

        // Use the functional API (Loader class removed in newer versions)
        const { setOptions: gmSetOptions, importLibrary } = await import("@googlemaps/js-api-loader");
        gmSetOptions({ apiKey: key, version: "weekly", libraries: ["places", "geometry"] });

        // Load all required libraries — places MUST be loaded before PlacesService
        const { Map } = await importLibrary("maps") as any;
        await importLibrary("places") as any;   // loads PlacesService
        const { Marker } = await importLibrary("marker") as any;

        // google namespace is now available on window
        const google = (window as any).google;
        if (!google) { console.error("[Maps] window.google not available after load"); return; }
        googleRef.current = google;
        console.log("[Maps] Google loaded, places available:", !!google.maps.places);

        // Get user location
        const getLoc = (): Promise<{lat: number, lng: number}> =>
          new Promise(resolve => {
            navigator.geolocation.getCurrentPosition(
              pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              () => resolve({ lat: 17.3850, lng: 78.4867 })
            );
          });

        const loc = await getLoc();
        setLocation(loc);
        userLocationRef.current = loc;
        console.log("[Maps] Location:", loc);

        // Init map — wait for DOM ref
        if (!mapRef.current) { console.error("[Maps] mapRef not ready"); return; }

        const map = new Map(mapRef.current, {
          center: loc,
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
            { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
          ]
        });
        mapInstanceRef.current = map;
        setMapObj(map);

        new Marker({ position: loc, map, title: "You are here" });
        console.log("[Maps] Map ready");
      } catch (err) {
        console.error("[Maps] Error:", err);
      }
    };

    loadMap();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "history" && patient?.id) {
      fetchPatientHistory(patient.id);
    }
  }, [activeTab, patient]);

  const initVoice = (onResult: (text: string) => void, onEnd: () => void) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Speech recognition not supported in this browser");
      onEnd();
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e: any) => onResult(e.results[0][0].transcript);
    recognition.onerror = () => onEnd();
    recognition.onend = () => onEnd();
    recognition.start();
    return recognition;
  };

  useEffect(() => {
    if (!socket) return;

    socket.on("queue_updated", (_data) => {
        // If our arrived appointment was updated
        const arrivedApt = appointments.find((a: any) => a.status === 'arrived');
        if (arrivedApt) {
            axios.get(`${API_URL}/api/appointments/queue/${arrivedApt.id}`)
                .then(res => setQueueStatus(res.data))
                .catch(console.error);
        }
    });

    socket.on("lab_update", (data) => {
        if (data.patient_id === patient?.id) {
            fetchLabHistory(patient.id);
            toast.success(`Lab Status: ${data.status.toUpperCase()}`);
        }
    });

    socket.on("report_submitted", (data) => {
        if (data.patient_id === patient?.id) {
            fetchLabHistory(patient.id);
            toast.success("New Lab Report Available!", { icon: '📊' });
            // Speak alert
            const u = new SpeechSynthesisUtterance("A new lab report has been submitted and analysed. You can view it in your tests and reports tab.");
            window.speechSynthesis.speak(u);
        }
    });

    socket.on("next_patient", (data) => {
        if (data.patient_id === patient?.id) {
            toast.success("It's your turn! Please proceed to the consultation room.", { duration: 10000 });
            // Speak alert
            const u = new SpeechSynthesisUtterance("It is your turn. Please proceed to the consultation room.");
            window.speechSynthesis.speak(u);
        }
    });

    return () => {
        socket.off("queue_updated");
        socket.off("lab_update");
        socket.off("report_submitted");
        socket.off("next_patient");
    };
  }, [socket, patient, appointments]);

  const handleSymptomsVoice = () => {
    if (isListeningFindCare) {
      recognitionRef.current?.stop();
    } else {
      setIsListeningFindCare(true);
      recognitionRef.current = initVoice(
        (text) => {
          setSymptoms(text);
          triggerTriage(text);
        },
        () => setIsListeningFindCare(false)
      );
    }
  };

  const searchHospitals = (keyword: string) => {
    // Fallback to window.google if ref not set (e.g. map loaded on previous visit)
    const g = googleRef.current || (window as any).google;
    const mapInst = mapInstanceRef.current;
    const loc = userLocationRef.current;
    console.log("[FindCare] searchHospitals", keyword, !!g, !!mapInst, loc);
    if (!g || !mapInst || !loc) {
      console.error("[FindCare] Not ready to search — map or location missing");
      return;
    }
    setHospitals([]);
    const service = new g.maps.places.PlacesService(mapInst);
    service.nearbySearch({
      location: loc,
      radius: 5000,
      keyword: keyword,
      type: "hospital"
    }, (results: any[], status: any) => {
      console.log("[FindCare] Results:", status, results?.length);
      if (status === g.maps.places.PlacesServiceStatus.OK && results) {
        results.forEach((place, i) => {
          new g.maps.Marker({
            position: place.geometry?.location,
            map: mapInst,
            title: place.name,
            label: { text: String(i + 1), color: "white", fontWeight: "bold", fontSize: "12px" },
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              scale: 16, fillColor: "#0F766E", fillOpacity: 1,
              strokeColor: "white", strokeWeight: 2
            }
          });
        });
        if (results.length > 0) {
          mapInst.panTo(results[0].geometry?.location);
          mapInst.setZoom(13);
        }
        setHospitals(results.slice(0, 6));
      } else {
        console.error("[FindCare] Search failed:", status);
      }
    });
  };

  const triggerTriage = async (text: string) => {
    if (!text.trim()) return;
    setIsTriageLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/symptom/triage`, { symptoms: text });
      const triage = res.data.result;
      setTriageResult(triage);

      if (triage.red_flag) {
        setIsTriageLoading(false);
        return;
      }

      // Call searchHospitals directly — no more mapLibrary dependency
      searchHospitals(triage.search_keyword);
    } catch(err) {
      toast.error("Triage analysis failed.");
    } finally {
      setIsTriageLoading(false);
    }
  };

  const bookAppointment = async () => {
    if (!bookingDate || !bookingTime) {
      toast.error("Date and Time are required");
      return;
    }
    try {
      if (bookingNetworkHospitalId) {
        // Network hospital booking
        await axios.post(`${API_URL}/api/network/appointments/book`, {
          patient_id: patient?.id,
          hospital_id: bookingNetworkHospitalId,
          patient_name: patient?.name || "",
          vela_id: patient?.vela_id || "",
          date: bookingDate,
          time: bookingTime
        });
        toast.success(`Appointment booked at ${bookingHospital?.name}. The receptionist has been notified.`);
        setBookingNetworkHospitalId(null);
      } else {
        await axios.post(`${API_URL}/api/appointments/book`, {
          patient_id: patient?.id,
          hospital_name: bookingHospital.name,
          hospital_address: bookingHospital.vicinity,
          date: bookingDate,
          time: bookingTime,
          checklist: {
            reports: true,
            medications: true,
            allergies: true,
            history: true
          }
        });
        toast.success("Appointment Confirmed");
      }
      setBookingHospital(null);
    } catch(err) {
      toast.error("Booking failed. Please try again.");
    }
  };

  const startAtlasVoice = () => {
    setAtlasListening(true);
    setAtlasResponse("Listening...");
    recognitionRef.current = initVoice(
      async (text) => {
        setAtlasListening(false);
        setAtlasResponse("Processing...");
        try {
          const res = await axios.post(`${API_URL}/api/voice/query`, {
            query: text,
            patient_id: patient?.id,
            session_id: "patient_session_1"
          });
          setAtlasResponse(res.data.answer);
        } catch(err) {
          setAtlasResponse("Sorry, I could not reach the server.");
        }
      },
      () => setAtlasListening(false)
    );
  };

  if (loading) {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center font-sans">
            <div className="w-8 h-8 relative mb-6">
                <div className="absolute inset-0 rounded-full border-t-2 border-blue-600 animate-spin"></div>
                <div className="absolute inset-2 rounded-full border-r-2 border-slate-300 animate-reverse-spin"></div>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-blue-600">Synchronizing</span>
        </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await axios.put(`${API_URL}/api/patient/update/${patient.id}`, editForm);
      if (res.data.status === "success") {
        setPatient(res.data.patient);
        localStorage.setItem("vela_patient", JSON.stringify(res.data.patient));
        toast.success("Profile updated successfully");
        setIsEditModalOpen(false);
      }
    } catch (err) {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const renderEditModal = () => {
    if (!isEditModalOpen) return null;
    return (
      <div className="fixed inset-0 z-[300] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-slate-900">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-serif italic text-2xl text-[#134E4A]">Edit Profile</h3>
            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
          </div>
          <form id="editForm" onSubmit={handleSaveProfile} className="p-6 overflow-y-auto space-y-6 styled-scrollbar">
             {/* Personal */}
             <div className="space-y-4">
                <h4 className="font-mono text-[10px] text-[#0F766E] uppercase tracking-widest border-b border-slate-100 pb-1">Personal Info</h4>
                <div className="grid grid-cols-2 gap-4">
                   <div><label className="block text-xs text-slate-500 mb-1">Full Name</label><input required className="w-full border border-slate-200 p-2 rounded text-sm bg-white text-[#134E4A] focus:outline-none focus:border-[#0F766E]" value={editForm.name || ""} onChange={e=>setEditForm({...editForm, name: e.target.value})} /></div>
                   <div><label className="block text-xs text-slate-500 mb-1">Date of Birth</label><input type="date" className="w-full border border-slate-200 p-2 rounded text-sm bg-white text-[#134E4A] focus:outline-none focus:border-[#0F766E]" value={editForm.date_of_birth || ""} onChange={e=>setEditForm({...editForm, date_of_birth: e.target.value})} /></div>
                   <div><label className="block text-xs text-slate-500 mb-1">Gender</label><select className="w-full border border-slate-200 p-2 rounded text-sm bg-white text-[#134E4A] focus:outline-none focus:border-[#0F766E]" value={editForm.gender || ""} onChange={e=>setEditForm({...editForm, gender: e.target.value})}><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></div>
                   <div><label className="block text-xs text-slate-500 mb-1">Blood Group</label><select className="w-full border border-slate-200 p-2 rounded text-sm bg-white text-[#134E4A] focus:outline-none focus:border-[#0F766E]" value={editForm.blood_group || ""} onChange={e=>setEditForm({...editForm, blood_group: e.target.value})}><option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="AB+">AB+</option><option value="AB-">AB-</option><option value="O+">O+</option><option value="O-">O-</option></select></div>
                </div>
             </div>
             {/* Contact */}
             <div className="space-y-4">
                <h4 className="font-mono text-[10px] text-[#0F766E] uppercase tracking-widest border-b border-slate-100 pb-1">Contact</h4>
                <div className="grid grid-cols-2 gap-4">
                   <div><label className="block text-xs text-slate-500 mb-1">Phone</label><input required className="w-full border border-slate-200 p-2 rounded text-sm bg-white text-[#134E4A] focus:outline-none focus:border-[#0F766E]" value={editForm.phone || ""} onChange={e=>setEditForm({...editForm, phone: e.target.value})} /></div>
                   <div><label className="block text-xs text-slate-500 mb-1">Email</label><input required type="email" className="w-full border border-slate-200 p-2 rounded text-sm bg-white text-[#134E4A] focus:outline-none focus:border-[#0F766E]" value={editForm.email || ""} onChange={e=>setEditForm({...editForm, email: e.target.value})} /></div>
                </div>
             </div>
             {/* Medical */}
             <div className="space-y-4">
                <h4 className="font-mono text-[10px] text-[#0F766E] uppercase tracking-widest border-b border-slate-100 pb-1">Medical</h4>
                <div className="grid grid-cols-2 gap-4">
                   <div><label className="block text-xs text-slate-500 mb-1">Height (cm)</label><input type="number" className="w-full border border-slate-200 p-2 rounded text-sm bg-white text-[#134E4A] focus:outline-none focus:border-[#0F766E]" value={editForm.height || ""} onChange={e=>setEditForm({...editForm, height: e.target.value})} /></div>
                   <div><label className="block text-xs text-slate-500 mb-1">Weight (kg)</label><input type="number" className="w-full border border-slate-200 p-2 rounded text-sm bg-white text-[#134E4A] focus:outline-none focus:border-[#0F766E]" value={editForm.weight || ""} onChange={e=>setEditForm({...editForm, weight: e.target.value})} /></div>
                </div>
                <div><label className="block text-xs text-slate-500 mb-1">Allergies (comma separated)</label><textarea rows={2} className="w-full border border-slate-200 p-2 rounded text-sm bg-white text-[#134E4A] focus:outline-none focus:border-[#0F766E] resize-none" value={editForm.allergies || ""} onChange={e=>setEditForm({...editForm, allergies: e.target.value})} /></div>
                <div><label className="block text-xs text-slate-500 mb-1">Existing Conditions (comma separated)</label><textarea rows={2} className="w-full border border-slate-200 p-2 rounded text-sm bg-white text-[#134E4A] focus:outline-none focus:border-[#0F766E] resize-none" value={editForm.existing_conditions || ""} onChange={e=>setEditForm({...editForm, existing_conditions: e.target.value})} /></div>
             </div>
             {/* Emergency */}
             <div className="space-y-4">
                <h4 className="font-mono text-[10px] text-[#0F766E] uppercase tracking-widest border-b border-slate-100 pb-1">Emergency & Insurance</h4>
                <div className="grid grid-cols-2 gap-4">
                   <div><label className="block text-xs text-slate-500 mb-1">Emergency Contact Name</label><input className="w-full border border-slate-200 p-2 rounded text-sm bg-white text-[#134E4A] focus:outline-none focus:border-[#0F766E]" value={editForm.emergency_contact_name || ""} onChange={e=>setEditForm({...editForm, emergency_contact_name: e.target.value})} /></div>
                   <div><label className="block text-xs text-slate-500 mb-1">Emergency Contact Phone</label><input className="w-full border border-slate-200 p-2 rounded text-sm bg-white text-[#134E4A] focus:outline-none focus:border-[#0F766E]" value={editForm.emergency_contact_phone || ""} onChange={e=>setEditForm({...editForm, emergency_contact_phone: e.target.value})} /></div>
                   <div><label className="block text-xs text-slate-500 mb-1">Emergency Contact Relation</label><select className="w-full border border-slate-200 p-2 rounded text-sm bg-white text-[#134E4A] focus:outline-none focus:border-[#0F766E]" value={editForm.emergency_contact_relation || ""} onChange={e=>setEditForm({...editForm, emergency_contact_relation: e.target.value})}><option value="">Select</option><option value="Spouse">Spouse</option><option value="Parent">Parent</option><option value="Child">Child</option><option value="Sibling">Sibling</option><option value="Other">Other</option></select></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                   <div><label className="block text-xs text-slate-500 mb-1">Insurance Provider</label><input className="w-full border border-slate-200 p-2 rounded text-sm bg-white text-[#134E4A] focus:outline-none focus:border-[#0F766E]" value={editForm.insurance_provider || ""} onChange={e=>setEditForm({...editForm, insurance_provider: e.target.value})} /></div>
                   <div><label className="block text-xs text-slate-500 mb-1">Insurance ID</label><input className="w-full border border-slate-200 p-2 rounded text-sm bg-white text-[#134E4A] focus:outline-none focus:border-[#0F766E]" value={editForm.insurance_id || ""} onChange={e=>setEditForm({...editForm, insurance_id: e.target.value})} /></div>
                </div>
             </div>
          </form>
          <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
              <button disabled={isSaving} onClick={() => setIsEditModalOpen(false)} className="px-5 py-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors">Cancel</button>
              <button disabled={isSaving} type="submit" form="editForm" className="px-5 py-2 bg-[#0F766E] hover:bg-[#065F46] text-white rounded-lg text-sm font-medium transition-colors">{isSaving ? 'Saving...' : 'Save Profile'}</button>
          </div>
        </div>
      </div>
    );
  };

  // --- RENDERS ---

  const renderHome = () => (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {activeAdmission ? (
        <div className="relative overflow-hidden rounded-[40px] p-8 md:p-12 text-white shadow-2xl" style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}>
           <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 blur-[100px] -mr-32 -mt-32"></div>
           
           {/* ADMISSION HEADER */}
           <div className="flex justify-between items-start mb-12 relative z-10">
              <div>
                 <div className="flex items-center gap-3 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-blue-400 font-bold">Admission Professional</span>
                 </div>
                 <h2 className="font-serif italic text-5xl md:text-6xl text-white tracking-tight">Active Inpatient</h2>
              </div>
              <div className="text-center group">
                 <div className="bg-white p-4 rounded-3xl shadow-2xl transition-transform group-hover:scale-105 duration-500">
                    <QRCodeSVG value={activeAdmission.admission_qr} size={120} bgColor="#FFFFFF" fgColor="#0F172A" level="H" />
                 </div>
                 <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/40 mt-4 font-bold">Ward Access Token</div>
              </div>
           </div>

           {/* ADMISSION BODY */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
              <div className="space-y-8">
                 <div>
                    <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-white/30 mb-2">Location Allocation</span>
                    <div className="text-3xl font-serif italic">{activeAdmission.ward_name} <span className="text-blue-500">#{activeAdmission.bed_number}</span></div>
                 </div>
                 <div className="flex gap-12">
                    <div>
                       <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-white/30 mb-1">Room Class</span>
                       <span className="text-lg">{activeAdmission.room_type}</span>
                    </div>
                    <div>
                        <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-white/30 mb-1">Stay Duration</span>
                        <span className="text-lg font-mono">{Math.floor((new Date().getTime() - new Date(activeAdmission.admitted_at).getTime()) / (1000 * 60 * 60 * 24)) + 1} Days</span>
                    </div>
                 </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 flex flex-col justify-center">
                 <div className="flex items-center gap-3 mb-4">
                    <User className="text-blue-500" size={20} />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-white/60">Patient Identity</span>
                 </div>
                 <div className="text-2xl font-bold mb-1 tracking-tight">{patient?.name}</div>
                 <div className="font-mono text-sm text-blue-400 tracking-wider uppercase">{patient?.vela_id}</div>
              </div>
           </div>

           {/* BUTTONS */}
           <div className="mt-12 flex gap-4 relative z-10">
              <button 
                onClick={() => { navigator.clipboard.writeText(activeAdmission.admission_qr); toast.success("Code Copied!"); }}
                className="bg-white text-black px-8 py-3.5 rounded-2xl font-mono text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-blue-50 transition-all shadow-xl shadow-black/20"
              >
                Copy QR String
              </button>
           </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-[20px] p-8 md:p-12 text-white shadow-xl" style={{ background: "linear-gradient(135deg, #0F766E 0%, #065F46 100%)" }}>
           {/* TOP ROW */}
           <div className="flex justify-between items-start mb-8 relative z-10">
              <div>
                 <img src="/vela-icon.png" alt="VELA" className="h-5 mb-2" style={{ filter: "brightness(10)" }} />
                 <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/60">VELA HEALTH</div>
              </div>
              <div className="text-center">
                 <div className="bg-white p-2 rounded-lg inline-block shadow-sm">
                    <QRCodeSVG value={patient?.vela_id || ""} size={72} bgColor="#FFFFFF" fgColor="#0F766E" level="M" />
                 </div>
                 <div className="font-mono text-[8px] uppercase tracking-widest text-white/50 mt-1">Scan to share</div>
              </div>
           </div>
           {/* ID */}
           <div className="relative z-10">
              <h2 className="font-serif italic text-5xl md:text-[52px] text-white tracking-[0.06em] leading-none">{patient?.vela_id}</h2>
              <p className="font-sans font-light text-lg text-white/80 mt-2">{patient?.name}</p>
           </div>
           {/* BOTTOM ROW */}
           <div className="flex bg-white/5 border border-white/10 rounded-xl mt-8 relative z-10 overflow-hidden">
              <div className="flex-1 p-4 border-r border-white/10">
                 <span className="block font-mono text-[9px] uppercase tracking-[0.08em] text-white/45 mb-1">Blood Group</span>
                 <span className="font-medium text-[13px] text-white">{patient?.blood_group || "--"}</span>
              </div>
              <div className="flex-1 p-4 border-r border-white/10">
                 <span className="block font-mono text-[9px] uppercase tracking-[0.08em] text-white/45 mb-1">Age</span>
                 <span className="font-medium text-[13px] text-white">{patient?.age || "--"}</span>
              </div>
              <div className="flex-1 p-4 border-r border-white/10">
                 <span className="block font-mono text-[9px] uppercase tracking-[0.08em] text-white/45 mb-1">Gender</span>
                 <span className="font-medium text-[13px] text-white">{patient?.gender || "--"}</span>
              </div>
              <div className="flex-1 p-4">
                 <span className="block font-mono text-[9px] uppercase tracking-[0.08em] text-white/45 mb-1">Phone</span>
                 <span className="font-medium text-[13px] text-white">{patient?.phone || "--"}</span>
              </div>
           </div>
           {/* Copy button */}
           <button onClick={() => { navigator.clipboard.writeText(patient?.vela_id || ""); toast.success("Copied!"); }} className="absolute bottom-4 right-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-md px-3 py-1.5 font-mono text-[10px] text-white transition-colors z-20">Copy VELA ID</button>
        </div>
      )}

      {!activeAdmission && patientHistory.length > 0 && patientHistory[0].event_type === 'discharge' && (
        <div className="bg-amber-50 border border-amber-200 rounded-[20px] p-8 flex items-center justify-between animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-amber-600 shadow-sm">
                    <CheckCircle size={32} strokeWidth={1.5} />
                </div>
                <div>
                    <h4 className="font-serif italic text-2xl text-slate-900">Recently Discharged</h4>
                    <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest">Recovery in progress · Follow instructions</p>
                </div>
            </div>
            <button 
                onClick={() => setActiveTab('history')}
                className="bg-amber-600 text-white px-8 py-3 rounded-xl font-mono text-[10px] uppercase tracking-widest hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20"
            >
                View Summary
            </button>
        </div>
      )}

      {queueStatus && (
        <div className="bg-blue-600 rounded-[20px] p-8 text-white shadow-xl animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/80">Live Queue Tracking</span>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.1em] bg-white/20 px-3 py-1 rounded-full">
                    Arrived at {queueStatus.department}
                </div>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="text-center md:text-left">
                    <div className="font-serif italic text-6xl md:text-8xl mb-2">{queueStatus.queue_position}</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">Position in Queue</div>
                </div>
                
                <div className="flex-1 w-full space-y-4">
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-white transition-all duration-1000 ease-out"
                            style={{ width: `${Math.max(10, 100 - (queueStatus.queue_position * 10))}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest text-white/50">
                        <span>Check-in</span>
                        <span>{queueStatus.wait_minutes}m Wait Est.</span>
                        <span>Consultation</span>
                    </div>
                </div>

                <div className="bg-white/10 p-6 rounded-2xl flex flex-col items-center justify-center border border-white/10 min-w-[140px]">
                    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-white/50 mb-2">Ticket ID</span>
                    <span className="font-mono text-lg font-bold">{queueStatus.ticket_number}</span>
                </div>
            </div>
        </div>
      )}

      <div>
         <div className="flex justify-between items-center mb-6">
            <h3 className="font-serif italic text-2xl text-[#134E4A]">My Profile</h3>
            <button onClick={() => { setEditForm(patient || {}); setIsEditModalOpen(true); }} className="text-[#0F766E] border border-[#0F766E]/20 hover:bg-[#0F766E]/5 px-4 py-1.5 rounded-full text-xs font-medium transition-colors">Edit</button>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1 */}
            <div className="bg-white border text-center text-left p-6 md:p-6 p-6 rounded-xl shadow-sm border-slate-200">
               <span className="block font-mono text-[10px] text-[#0F766E] uppercase tracking-widest mb-4">PERSONAL</span>
               <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-slate-500 text-sm">Name</span><span className="text-slate-900 font-medium text-sm">{patient?.name || "--"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 text-sm">Age / DOB</span><span className="text-slate-900 font-medium text-sm">{patient?.age || "--"} / {patient?.date_of_birth || "--"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 text-sm">Gender</span><span className="text-slate-900 font-medium text-sm">{patient?.gender || "--"}</span></div>
               </div>
            </div>
            {/* Card 2 */}
            <div className="bg-white border p-6 rounded-xl shadow-sm border-slate-200">
               <span className="block font-mono text-[10px] text-[#0F766E] uppercase tracking-widest mb-4">MEDICAL</span>
               <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-slate-500 text-sm">Blood</span><span className="text-slate-900 font-medium text-sm">{patient?.blood_group || "--"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 text-sm">Height / Weight</span><span className="text-slate-900 font-medium text-sm">{patient?.height ? `${patient.height}cm` : "--"} / {patient?.weight ? `${patient.weight}kg` : "--"}</span></div>
                  <div className="mt-4 pt-4 border-t border-slate-100">
                     <span className="block text-xs font-medium text-slate-700 mb-2">Allergies</span>
                     <div className="flex flex-wrap gap-1">
                        {patient?.allergies ? patient.allergies.split(",").map((a:string, i:number)=><span key={i} className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-[10px]">{a.trim()}</span>) : <span className="text-xs text-slate-400">None</span>}
                     </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-700">
                     <span className="block text-xs font-medium mb-1">Conditions</span>
                     {patient?.existing_conditions ? patient.existing_conditions.split(",").map((a:string, i:number)=><span key={i} className="inline-block bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] mr-1 mb-1">{a.trim()}</span>) : <span className="text-xs text-slate-400">None</span>}
                  </div>
               </div>
            </div>
            {/* Card 3 */}
            <div className="bg-white border p-6 rounded-xl shadow-sm border-slate-200">
               <span className="block font-mono text-[10px] text-[#0F766E] uppercase tracking-widest mb-4">CONTACT</span>
               <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-slate-500 text-sm">Phone</span><span className="text-slate-900 font-medium text-sm">{patient?.phone || "--"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 text-sm">Email</span><span className="text-slate-900 font-medium text-sm">{patient?.email || "--"}</span></div>
               </div>
            </div>
            {/* Card 4 */}
            <div className="bg-red-50/40 border border-red-500/15 p-6 rounded-xl shadow-sm">
               <span className="block font-mono text-[10px] text-red-600 uppercase tracking-widest mb-4">EMERGENCY CONTACT</span>
               {patient?.emergency_contact_name ? (
                 <>
                   <div className="text-slate-900 font-semibold text-lg">{patient.emergency_contact_name}</div>
                   <div className="text-slate-600 text-sm mb-4">{patient.emergency_contact_relation || "Contact"} • {patient.emergency_contact_phone}</div>
                   {patient.emergency_contact_phone && (
                      <a href={`tel:${patient.emergency_contact_phone}`} className="inline-block bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors">Call</a>
                   )}
                 </>
               ) : (
                 <span className="text-sm text-slate-400">No emergency contact on file.</span>
               )}
            </div>
         </div>
      </div>
    </div>
  );

  const handleReassess = async (orderId: string) => {
    setReassessing(orderId);
    try {
        const res = await axios.post(`${API_URL}/api/reassess/request`, { order_id: orderId });
        if (res.data.status === 'success') {
            toast.success("Reassessment request sent to Lab.");
            fetchLabHistory(patient.id);
        } else {
            toast.error(res.data.message);
        }
    } catch (err: any) {
        toast.error(err.response?.data?.detail || "Request failed");
    } finally {
        setReassessing(null);
    }
  };

  const renderReports = () => (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="flex justify-between items-end">
        <div>
            <h2 className="text-4xl font-serif italic text-slate-900 mb-2">Tests & Reports</h2>
            <p className="text-slate-500 font-light">Real-time diagnostic tracking and clinical intelligence.</p>
        </div>
        <button onClick={() => fetchLabHistory(patient.id)} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 transition-all">
            <Activity size={18} />
        </button>
      </div>

      {activeLabOrder && (
          <div className="bg-slate-900 rounded-[32px] p-10 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] -mr-32 -mt-32"></div>
              
              <div className="relative z-10">
                  <div className="flex justify-between items-start mb-10">
                      <div>
                          <div className="flex items-center gap-3 mb-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-blue-400">Active Test Stream</span>
                          </div>
                          <h3 className="text-4xl font-serif italic">{activeLabOrder.test_type}</h3>
                      </div>
                      <div className="text-right">
                          <div className="font-mono text-[32px] leading-none mb-1 text-blue-400">#{activeLabOrder.queue?.position || '--'}</div>
                          <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">Lab Queue</div>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                      <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                          <span className="block font-mono text-[9px] uppercase tracking-widest text-white/40 mb-3">Status</span>
                          <div className="font-mono text-xs uppercase tracking-widest text-blue-400 font-bold">{activeLabOrder.status.replace('_', ' ')}</div>
                      </div>
                      <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                          <span className="block font-mono text-[9px] uppercase tracking-widest text-white/40 mb-3">Estimate</span>
                          <div className="font-mono text-xs uppercase tracking-widest">~{activeLabOrder.queue?.wait_minutes || '20'} MIN WAIT</div>
                      </div>
                      <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                          <span className="block font-mono text-[9px] uppercase tracking-widest text-white/40 mb-3">Doctor</span>
                          <div className="font-mono text-xs uppercase tracking-widest">DR. {activeLabOrder.doctor_name || 'WEST'}</div>
                      </div>
                  </div>

                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <div 
                          className="h-full bg-blue-500 transition-all duration-1000"
                          style={{ width: 
                              activeLabOrder.status === 'pending_payment' ? '10%' :
                              activeLabOrder.status === 'paid' ? '30%' :
                              activeLabOrder.status === 'accepted' ? '50%' :
                              activeLabOrder.status === 'in_progress' ? '80%' : '5%'
                          }}
                      ></div>
                  </div>
              </div>
          </div>
      )}

      <div className="space-y-6">
        <h3 className="font-serif italic text-2xl text-slate-900 border-b border-slate-100 pb-4">Diagnostic History</h3>
        
        {isLabLoading ? (
            <div className="py-20 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-slate-400">Decrypting clinical records...</div>
        ) : labHistory.length === 0 ? (
            <div className="p-20 border border-slate-200 border-dashed text-center flex flex-col items-center rounded-3xl bg-white">
                <FileText className="text-slate-200 mb-4" size={48} strokeWidth={1} />
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">No diagnostic records found</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 gap-6">
                {labHistory.map((report) => (
                    <div key={report.id} className="bg-white border border-slate-200 rounded-[32px] overflow-hidden hover:shadow-2xl hover:shadow-slate-200/50 transition-all group">
                        <div className="p-8 md:p-10">
                            <div className="flex justify-between items-start mb-8">
                                <div className="flex items-center gap-6">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${
                                        report.report?.risk_score === 'HIGH' ? 'bg-red-50 border-red-100 text-red-600' :
                                        report.report?.risk_score === 'MEDIUM' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                                        'bg-emerald-50 border-emerald-100 text-emerald-600'
                                    }`}>
                                        <Activity size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-3xl font-serif italic text-slate-900">{report.test_type}</h4>
                                        <div className="flex gap-4 mt-1 font-mono text-[9px] text-slate-400 uppercase tracking-widest">
                                            <span>{new Date(report.created_at).toLocaleDateString()}</span>
                                            <span>•</span>
                                            <span>Dr. {report.doctor_name || 'West'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-mono text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full border ${
                                        report.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                                    }`}>
                                        {report.status}
                                    </div>
                                </div>
                            </div>

                            {report.report && (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                                    <div className="lg:col-span-4 bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                        <div className="flex items-center gap-2 mb-6 text-slate-500">
                                            <AlertCircle size={14} />
                                            <span className="font-mono text-[10px] uppercase tracking-widest">Risk Assessment</span>
                                        </div>
                                        <div className="text-center">
                                            <div className={`text-6xl font-serif italic mb-2 ${
                                                report.report.risk_score === 'HIGH' ? 'text-red-600' :
                                                report.report.risk_score === 'MEDIUM' ? 'text-amber-600' :
                                                'text-emerald-600'
                                            }`}>
                                                {report.report.risk_score}
                                            </div>
                                            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400">Clinical Risk Grade</div>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-8 space-y-6">
                                        <div className="font-mono text-[9px] uppercase tracking-widest text-[#0F766E] flex items-center gap-2">
                                            <Mic size={12} /> Atlas AI Analysis
                                        </div>
                                        <p className="text-sm text-slate-800 leading-relaxed italic font-light">
                                            {report.report.analysis || "Analysis pending..."}
                                        </p>
                                        
                                        <div className="flex gap-4 pt-4">
                                            <button 
                                                onClick={() => handleReassess(report.id)}
                                                disabled={reassessing === report.id || report.reassess_count >= 3}
                                                className="px-6 py-3 border border-slate-200 rounded-xl font-mono text-[9px] text-slate-500 uppercase tracking-widest hover:border-blue-600 hover:text-blue-600 transition-all disabled:opacity-50"
                                            >
                                                {reassessing === report.id ? 'Requesting...' : `Request Reassess (${report.reassess_count || 0}/3)`}
                                            </button>
                                            <button className="px-6 py-3 bg-slate-900 text-white rounded-xl font-mono text-[9px] uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2">
                                                <Download size={14} /> Download PDF
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Manual Uploads / Scans */}
      <div className="pt-12 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-8">
              <FileText size={18} className="text-slate-400" />
              <h3 className="font-serif italic text-2xl text-slate-800">Clinical Registry</h3>
          </div>
          
          {documents.length === 0 ? (
              <div className="p-12 border border-slate-100 border-dashed text-center rounded-2xl bg-white/50">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-slate-400">No manual scans in record</p>
              </div>
          ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {documents.map((doc) => (
                      <div key={doc.id} className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col justify-between h-36 hover:border-blue-200 transition-all shadow-sm">
                          <div className="flex justify-between items-start">
                              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                                  <FileText size={16} />
                              </div>
                              <button className="text-slate-300 hover:text-blue-600 transition-colors">
                                  <Download size={16} />
                              </button>
                          </div>
                          <div>
                              <h4 className="text-slate-800 font-sans font-medium text-sm truncate mb-1">{doc.filename}</h4>
                              <p className="text-[9px] text-slate-400 font-mono uppercase tracking-widest">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>
    </div>
  );

  const renderMedications = () => (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <h2 className="text-4xl font-serif italic text-slate-900 mb-2">Active Prescriptions</h2>
      <p className="text-slate-500 font-light mb-12">Manage your current medications and protocols.</p>

      {medications.length === 0 ? (
            <div className="p-20 border border-slate-200 border-dashed text-center flex flex-col items-center rounded-xl">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 text-slate-400">
                  <Pill size={24} strokeWidth={1} />
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">No active medications</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 gap-4">
               {medications.map((med) => (
                  <div key={med.id} className="bg-[#121212] border border-slate-200 p-6 flex items-center justify-between group rounded-xl">
                      <div className="flex items-center gap-6">
                           <div className="w-12 h-12 border border-[#0F766E]/30 flex items-center justify-center text-[#0F766E] bg-[#0F766E]/5">
                              <Pill size={20} strokeWidth={1.5} />
                           </div>
                           <div>
                              <h4 className="text-2xl font-serif italic text-slate-900 mb-1">{med.name}</h4>
                              <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-slate-500">{med.dosage} - {med.frequency}</p>
                           </div>
                      </div>
                      <div className="text-right">
                          <div className="text-[9px] font-mono tracking-[0.2em] uppercase text-[#0F766E] border border-[#0F766E]/30 px-3 py-1 bg-[#0F766E]/10 rounded-full">
                              Active
                          </div>
                      </div>
                  </div>
               ))}
          </div>
      )}
    </div>
  );

  const renderEmergencyModal = () => {
    if (!triageResult?.red_flag) return null;
    return (
      <div className="fixed inset-0 z-[200] bg-red-600 flex flex-col items-center justify-center text-white text-center p-8 animate-in fade-in duration-300">
        <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center mb-10 animate-pulse">
            <Activity size={64} strokeWidth={1} />
        </div>
        <h1 className="text-5xl md:text-7xl font-serif italic mb-6">Medical Emergency</h1>
        <p className="text-xl md:text-2xl font-light max-w-2xl mb-12">
           Based on your symptoms, please go to the emergency room immediately or call emergency services.
        </p>
        <div className="flex gap-6">
          <a href="tel:112" className="bg-white text-red-600 px-12 py-5 font-sans font-bold text-lg uppercase tracking-widest rounded-full hover:scale-105 transition-transform">
             Call 112
          </a>
          <button onClick={() => setTriageResult(null)} className="bg-transparent border border-slate-300 text-slate-900 px-12 py-5 font-sans font-bold text-lg uppercase tracking-widest rounded-full hover:bg-slate-100 transition-colors">
             Dismiss
          </button>
        </div>
      </div>
    );
  };

  const renderBookingModal = () => {
    if (!bookingHospital) return null;
    return (
      <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-[#0F172A] border border-white/10 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-10">
          <div className="p-8 pb-6 border-b border-white/10">
            <h3 className="font-serif italic text-3xl mb-1 text-white">{bookingHospital.name}</h3>
            <p className="font-mono text-[10px] text-white/50 uppercase tracking-widest">{bookingHospital.vicinity}</p>
          </div>
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-widest text-blue-400 mb-2">Select Date</label>
                <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} className="w-full p-3 rounded-lg text-sm focus:outline-none font-sans" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#FAFAF9', colorScheme: 'dark' } as React.CSSProperties} />
              </div>
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-widest text-blue-400 mb-2">Select Time</label>
                <input type="time" value={bookingTime} onChange={e => setBookingTime(e.target.value)} className="w-full p-3 rounded-lg text-sm focus:outline-none font-sans" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#FAFAF9', colorScheme: 'dark' } as React.CSSProperties} />
              </div>
            </div>
            
            <div className="bg-white/5 p-5 border border-white/10 rounded-xl">
               <div className="flex items-center gap-2 mb-4">
                  <AlertCircle size={14} className="text-blue-400" />
                  <span className="block font-mono text-[9px] uppercase tracking-widest text-white/50">Secure Medical Transfer</span>
               </div>
               <div className="space-y-3 font-sans text-sm text-white/80">
                 <div className="flex items-center gap-3"><CheckCircle size={14} className="text-emerald-500" /> All medical reports</div>
                 <div className="flex items-center gap-3"><CheckCircle size={14} className="text-emerald-500" /> Active medications</div>
                 <div className="flex items-center gap-3"><CheckCircle size={14} className="text-emerald-500" /> Documented allergies</div>
                 <div className="flex items-center gap-3"><CheckCircle size={14} className="text-emerald-500" /> Past visit history</div>
               </div>
            </div>
            
            <div className="flex gap-4 pt-4">
               <button type="button" onClick={bookAppointment} className="flex-1 bg-white hover:bg-blue-600 hover:text-white border border-white/20 text-slate-900 py-4 rounded-xl font-mono text-xs tracking-widest uppercase transition-colors">
                 Confirm Appointment
               </button>
               <button type="button" onClick={() => setBookingHospital(null)} className="w-16 flex items-center justify-center border border-white/20 bg-white/5 text-white/60 hover:text-white rounded-xl transition-colors">
                  <X size={20} />
               </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Haversine distance in km
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const renderFindCare = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 h-full flex flex-col">
      {renderEmergencyModal()}
      {renderBookingModal()}
      
      <div className="flex-none">
        <h2 className="text-4xl font-serif italic text-slate-900 mb-2">Find Care</h2>
        <p className="text-slate-500 font-light mb-8">AI-guided triage and intelligent facility routing.</p>

        {/* Input Area */}
        <div className="relative mb-6">
           <input 
             type="text" 
             value={symptoms}
             onChange={e => setSymptoms(e.target.value)}
             onKeyDown={e => e.key === "Enter" && triggerTriage(symptoms)}
             placeholder="Describe your symptoms..."
             className="symptom-input w-full py-5 pl-6 pr-16 rounded-xl text-lg font-sans focus:outline-none transition-colors"
             style={{
               width: "100%",
               padding: "14px 16px",
               paddingRight: 56,
               background: "white",
               border: "1px solid rgba(15,118,110,0.3)",
               borderRadius: 10,
               fontFamily: "Geist, sans-serif",
               fontSize: 15,
               color: "#134E4A",
               outline: "none",
               boxSizing: "border-box"
             }}
           />
           <button 
             onClick={handleSymptomsVoice}
             className={`absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all ${isListeningFindCare ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-blue-600'}`}
           >
              <Mic size={18} />
           </button>
        </div>

        {isTriageLoading && (
           <div className="text-center py-4 font-mono text-[10px] uppercase tracking-widest text-blue-600 animate-pulse">
              Analyzing Clinical Path...
           </div>
        )}

        {/* Triage Result Card */}
        {triageResult && !triageResult.red_flag && (
           <div style={{
             background: "rgba(15,118,110,0.06)",
             border: "1px solid rgba(15,118,110,0.2)",
             borderRadius: 12,
             padding: "16px 20px",
             marginBottom: 24,
             display: "flex",
             flexDirection: "column",
             gap: 8
           }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                 <span style={{
                   fontFamily: "Geist Mono, monospace",
                   fontSize: 11,
                   color: "#0F766E",
                   border: "1px solid rgba(15,118,110,0.3)",
                   padding: "3px 10px",
                   borderRadius: 100,
                   background: "rgba(15,118,110,0.08)",
                   fontWeight: 600,
                   letterSpacing: "0.05em"
                 }}>
                   {triageResult.specialist_type || triageResult.specialist}
                 </span>
                 <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                   {triageResult.urgency === 'routine' && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", display: "inline-block" }}></span>}
                   {triageResult.urgency === 'urgent' && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B", display: "inline-block" }}></span>}
                   {triageResult.urgency === 'emergency' && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", display: "inline-block", animation: "pulse 1s infinite" }}></span>}
                   <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 10, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.1em" }}>{triageResult.urgency}</span>
                 </div>
              </div>
              <p style={{ fontFamily: "Geist, sans-serif", fontSize: 14, color: "#134E4A", lineHeight: 1.6, margin: 0 }}>{triageResult.explanation}</p>
           </div>
        )}
      </div>

      <div className="flex-1 min-h-[400px] grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
         {/* Map View */}
         <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(15,118,110,0.15)" }}>
            <div ref={mapRef} style={{ width: "100%", height: 400 }} />
         </div>

         {/* Hospitals List */}
         <div className="bg-transparent overflow-y-auto styled-scrollbar pr-2" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {hospitals.length === 0 ? (
                <div className="h-full flex items-center justify-center border border-slate-100 border-dashed rounded-xl" style={{ minHeight: 200 }}>
                   <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">Awaiting search...</p>
                </div>
            ) : (
                hospitals.map((h, i) => {
                  const lat = h.geometry?.location?.lat?.();
                  const lng = h.geometry?.location?.lng?.();
                  const dist = location && lat && lng ? calculateDistance(location.lat, location.lng, lat, lng) : null;
                  const isOpen = h.opening_hours?.isOpen?.();
                  const isSelected = selectedHospital?.place_id === h.place_id;
                  const registeredIds = new Set(networkHospitals.map((n: any) => n.place_id));
                  const isOnVela = registeredIds.has(h.place_id);
                  const velaRecord = isOnVela ? networkHospitals.find((n: any) => n.place_id === h.place_id) : null;
                  return (
                    <div
                      key={h.place_id || i}
                      onClick={() => setSelectedHospital(h)}
                      style={{
                        background: isSelected ? "rgba(15,118,110,0.08)" : "white",
                        border: isSelected ? "1px solid #0F766E" : isOnVela ? "1px solid rgba(200,184,154,0.4)" : "1px solid rgba(15,118,110,0.15)",
                        borderRadius: 12,
                        padding: 16,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        position: "relative"
                      }}
                    >
                      {/* ON VELA badge */}
                      {isOnVela && (
                        <div style={{
                          position: "absolute", top: 10, right: 10,
                          fontFamily: "Geist Mono, monospace", fontSize: 10,
                          color: "#C8B89A", fontWeight: 700,
                          border: "1px solid rgba(200,184,154,0.5)",
                          borderRadius: 100, padding: "2px 8px",
                          background: "rgba(200,184,154,0.08)",
                          letterSpacing: "0.05em"
                        }}>✦ ON VELA</div>
                      )}

                      {/* Index number */}
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: "#0F766E", color: "white",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "Geist Mono, monospace", fontSize: 12, fontWeight: 600,
                        flexShrink: 0, marginTop: 2
                      }}>{i + 1}</div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0, paddingRight: isOnVela ? 80 : 0 }}>
                        <p style={{ fontFamily: "Geist, sans-serif", fontWeight: 600, fontSize: 14, color: "#134E4A", marginBottom: 3, lineHeight: 1.3 }}>{h.name}</p>
                        <p style={{ fontFamily: "Geist, sans-serif", fontSize: 12, color: "#6B6B6B", marginBottom: 8, lineHeight: 1.4 }}>{h.vicinity}</p>
                        {isOnVela && velaRecord?.specializations?.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                            {velaRecord.specializations.map((s: string, si: number) => (
                              <span key={si} style={{ fontFamily: "Geist, sans-serif", fontSize: 10, color: "#0F766E", background: "rgba(15,118,110,0.08)", borderRadius: 100, padding: "2px 7px" }}>{s}</span>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          {dist !== null && (
                            <span style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, color: "#0F766E" }}>
                              📍 {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
                            </span>
                          )}
                          {h.rating && (
                            <span style={{ fontFamily: "Geist, sans-serif", fontSize: 11, color: "#6B6B6B" }}>
                              ⭐ {h.rating}{h.user_ratings_total ? ` (${h.user_ratings_total})` : ""}
                            </span>
                          )}
                          {h.opening_hours && (
                            <span style={{
                              fontFamily: "Geist Mono, monospace", fontSize: 10,
                              color: isOpen ? "#22C55E" : "#EF4444",
                              background: isOpen ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                              padding: "2px 8px", borderRadius: 100
                            }}>
                              {isOpen ? "Open" : "Closed"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Book button — only for Vela hospitals */}
                      {isOnVela ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedHospital(h);
                            setBookingHospital({ ...h, name: velaRecord?.name || h.name, vicinity: velaRecord?.address || h.vicinity });
                            setBookingNetworkHospitalId(velaRecord?.id || null);
                          }}
                          style={{
                            background: "#C8B89A", color: "#0C0C0B", border: "none",
                            borderRadius: 8, padding: "8px 14px",
                            fontFamily: "Geist Mono, monospace", fontSize: 10,
                            fontWeight: 700, cursor: "pointer", flexShrink: 0,
                            letterSpacing: "0.05em", textTransform: "uppercase",
                            transition: "background 0.2s", marginTop: 2
                          }}
                        >
                          Book
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedHospital(h); setBookingHospital(h); setBookingNetworkHospitalId(null); }}
                          style={{
                            background: "#0F766E", color: "white", border: "none",
                            borderRadius: 8, padding: "8px 14px",
                            fontFamily: "Geist Mono, monospace", fontSize: 10,
                            fontWeight: 600, cursor: "pointer", flexShrink: 0,
                            letterSpacing: "0.05em", textTransform: "uppercase",
                            transition: "background 0.2s"
                          }}
                        >
                          Book
                        </button>
                      )}
                    </div>
                  );
                })
            )}
         </div>
      </div>
    </div>
  );

  const renderAppointments = () => (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="flex justify-between items-end">
        <div>
           <h2 className="text-4xl font-serif italic text-slate-900 mb-2">Appointments</h2>
           <p className="text-slate-500 font-light">Track your scheduled visits and historical journey.</p>
        </div>
        <button className="bg-[#0F766E] text-white px-6 py-3 rounded-xl font-mono text-[10px] uppercase tracking-widest hover:bg-[#065F46] transition-all flex items-center gap-2 shadow-lg shadow-[#0F766E]/20" onClick={() => setActiveTab('find-care')}>
           <CalendarPlus size={16} /> New Booking
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
         {appointments.length === 0 ? (
            <div className="p-20 border border-slate-200 border-dashed text-center flex flex-col items-center rounded-xl bg-white">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 text-slate-400 bg-slate-50">
                    <CalendarPlus size={24} strokeWidth={1} />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">No upcoming appointments</p>
                <button onClick={() => setActiveTab('find-care')} className="mt-4 text-[#0F766E] text-xs font-medium hover:underline">Schedule your first visit</button>
            </div>
         ) : (
            appointments.map((apt) => (
                <div key={apt.id} className="bg-white border border-slate-200 p-8 rounded-2xl flex items-center justify-between group hover:border-[#0F766E]/30 transition-all shadow-sm">
                    <div className="flex items-center gap-8">
                        <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center justify-center">
                            <span className="font-serif italic text-2xl text-slate-900">{apt.appointment_time.split(':')[0]}</span>
                            <span className="font-mono text-[8px] text-[#0F766E] font-bold uppercase">{apt.appointment_time.split(':')[1]} {parseInt(apt.appointment_time.split(':')[0]) >= 12 ? 'PM' : 'AM'}</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h4 className="text-2xl font-serif italic text-slate-900">{apt.hospital_name}</h4>
                                <span className={`font-mono text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                                    apt.status === 'scheduled' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                    apt.status === 'arrived' ? 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse' :
                                    'bg-slate-50 text-slate-400 border-slate-100'
                                }`}>
                                    {apt.status}
                                </span>
                            </div>
                            <div className="flex gap-4 font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                                <span className="flex items-center gap-1.5"><Clock size={12}/> {apt.appointment_date}</span>
                                <span className="flex items-center gap-1.5"><User size={12}/> {apt.doctor_name || 'General Physician'}</span>
                            </div>
                        </div>
                    </div>
                    {apt.status === 'scheduled' && (
                        <div className="flex items-center gap-3">
                            <button className="p-3 text-slate-400 hover:text-red-500 transition-colors"><X size={18}/></button>
                            <button className="bg-white border border-slate-200 text-slate-900 px-6 py-3 rounded-xl font-mono text-[9px] uppercase tracking-widest hover:border-[#0F766E] transition-all">Details</button>
                        </div>
                    )}
                    {apt.status === 'arrived' && (
                        <div className="flex items-center gap-2 text-emerald-600 font-mono text-[9px] uppercase tracking-widest font-bold">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                            Check-in Complete
                        </div>
                    )}
                </div>
            ))
         )}
      </div>
      
      {appointments.some(a => a.status === 'completed') && (
          <div className="pt-12 border-t border-slate-200">
             <h3 className="font-serif italic text-2xl mb-6 text-slate-900">Historical Timeline</h3>
             <div className="space-y-4">
                 {appointments.filter(a => a.status === 'completed').map(apt => (
                     <div key={apt.id} className="flex gap-6 items-start opacity-70">
                         <div className="w-1 bg-slate-200 self-stretch rounded-full" />
                         <div className="pb-4">
                             <div className="font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-1">{apt.appointment_date}</div>
                             <div className="font-sans text-sm text-slate-900 font-medium">{apt.hospital_name} · Consultation Completed</div>
                         </div>
                     </div>
                 ))}
             </div>
          </div>
      )}
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div>
            <h2 className="text-4xl font-serif italic text-slate-900 mb-2">Health Journey</h2>
            <p className="text-slate-500 font-light">A complete chronological record of your care at VELA.</p>
        </div>

        {historyLoading ? (
            <div className="py-20 text-center font-mono text-[10px] text-slate-400 uppercase tracking-widest">Retrieving Timeline...</div>
        ) : patientHistory.length === 0 ? (
            <div className="p-20 border border-slate-200 border-dashed text-center flex flex-col items-center rounded-3xl bg-white">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">No medical history recorded yet</p>
            </div>
        ) : (
            <div className="relative space-y-12">
                <div className="absolute left-8 top-0 bottom-0 w-[1px] bg-slate-200 z-0"></div>
                
                {patientHistory.map((visit, i) => (
                    <div key={i} className="relative z-10 flex gap-12 group cursor-pointer" onClick={() => setSelectedVisit(visit)}>
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl transition-all group-hover:scale-110 ${
                            visit.event_type === 'discharge' ? 'bg-emerald-600 text-white shadow-emerald-600/20' :
                            visit.event_type === 'admission' ? 'bg-blue-600 text-white shadow-blue-600/20' :
                            'bg-slate-900 text-white shadow-slate-900/20'
                        }`}>
                            {visit.event_type === 'discharge' ? <CheckCircle size={24} /> :
                             visit.event_type === 'admission' ? <Activity size={24} /> :
                             <FileText size={24} />}
                        </div>
                        
                        <div className="flex-1 bg-white border border-slate-100 p-8 rounded-[32px] group-hover:border-blue-600/30 transition-all shadow-sm hover:shadow-xl">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-1">{visit.date}</div>
                                    <h4 className="font-serif italic text-3xl text-slate-900">{visit.title}</h4>
                                </div>
                                <span className="font-mono text-[10px] text-blue-600 font-bold uppercase tracking-widest">{visit.event_type}</span>
                            </div>
                            <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 italic">"{visit.summary}"</p>
                            
                            <div className="mt-6 pt-6 border-t border-slate-50 flex items-center gap-4 text-xs text-slate-400 font-mono uppercase tracking-widest">
                                <span>Facility: {visit.hospital_id || 'VELA CENTRAL'}</span>
                                {visit.doctor_name && (
                                    <>
                                        <span className="text-slate-200">|</span>
                                        <span>Care: Dr. {visit.doctor_name}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* Visit Details Modal */}
        {selectedVisit && (
            <div className="fixed inset-0 bg-[#080808]/90 backdrop-blur-xl z-[200] flex items-center justify-center p-6 animate-in fade-in duration-500">
                <div className="w-full max-w-3xl bg-white rounded-[40px] shadow-2xl overflow-hidden relative border border-slate-100 flex flex-col max-h-[85vh]">
                    <button onClick={() => setSelectedVisit(null)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 z-10 transition-colors">
                        <X size={24} />
                    </button>

                    <div className="p-12 overflow-y-auto custom-scrollbar">
                        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-blue-600 mb-4 font-bold">Clinical Record</div>
                        <h2 className="font-serif italic text-5xl text-slate-900 mb-2">{selectedVisit.title}</h2>
                        <div className="font-mono text-[11px] text-slate-400 uppercase tracking-widest mb-12">{selectedVisit.date} · Facility ID: {selectedVisit.hospital_id}</div>

                        <div className="space-y-12">
                            {selectedVisit.details?.discharge_summary && (
                                <section>
                                    <h3 className="font-serif italic text-2xl text-slate-900 mb-4">Medical Discharge Summary</h3>
                                    <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap italic">
                                        {selectedVisit.details.discharge_summary}
                                    </div>
                                </section>
                            )}

                            {selectedVisit.details?.final_diagnosis && (
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                                        <div className="font-mono text-[9px] uppercase tracking-widest text-blue-600 mb-2">Final Diagnosis</div>
                                        <div className="font-serif italic text-xl text-slate-900">{selectedVisit.details.final_diagnosis}</div>
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className="font-mono text-[9px] uppercase tracking-widest text-slate-400 mb-2">Follow-up Date</div>
                                        <div className="font-serif italic text-xl text-slate-900">{selectedVisit.details.follow_up_date || 'None Scheduled'}</div>
                                    </div>
                                </div>
                            )}

                            {selectedVisit.details?.total_cost && (
                                <section className="p-8 bg-slate-900 rounded-[32px] text-white">
                                    <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-50 mb-6 font-bold">Stay Billing Overview</h4>
                                    <div className="space-y-4 mb-8">
                                        <div className="flex justify-between text-xs opacity-70">
                                            <span>Accommodation & Services</span>
                                            <span className="font-mono font-bold">₹{selectedVisit.details.room_cost?.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs opacity-70">
                                            <span>Laboratory & Diagnostics</span>
                                            <span className="font-mono font-bold">₹{selectedVisit.details.test_cost?.toLocaleString()}</span>
                                        </div>
                                        <div className="h-[1px] bg-white/10"></div>
                                        <div className="flex justify-between items-center pt-2">
                                            <span className="font-mono text-[11px] uppercase tracking-widest text-blue-400 font-bold">Total Settled</span>
                                            <span className="font-serif italic text-3xl">₹{selectedVisit.details.total_cost?.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <CheckCircle size={14} className="text-emerald-500" />
                                        <span className="font-mono text-[8px] uppercase tracking-[0.2em] opacity-40">Payment Confirmed · VELA Ledger Veridified</span>
                                    </div>
                                </section>
                            )}

                            {selectedVisit.details?.follow_up_instructions && (
                                <section className="pb-8">
                                    <h3 className="font-serif italic text-2xl text-slate-900 mb-4">Recovery Instructions</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed font-light">{selectedVisit.details.follow_up_instructions}</p>
                                </section>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );

  const renderAtlas = () => (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000 h-full flex flex-col items-center justify-center text-center">
       <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-blue-600 mb-4 block">Atlas Patient Companion</span>
       <h2 className="text-4xl font-serif italic text-slate-900 mb-12 max-w-lg leading-tight">Your personal medical intelligence, available instantly.</h2>
       
       <button 
           onMouseDown={startAtlasVoice}
           onMouseUp={() => { setAtlasListening(false); recognitionRef.current?.stop(); }}
           onMouseLeave={() => { setAtlasListening(false); recognitionRef.current?.stop(); }}
           onTouchStart={startAtlasVoice}
           onTouchEnd={() => { setAtlasListening(false); recognitionRef.current?.stop(); }}
           className={`relative w-40 h-40 rounded-full flex items-center justify-center transition-all duration-500 mb-16 shadow-2xl ${atlasListening ? 'bg-blue-600/10 border border-blue-600 scale-105' : 'bg-slate-50 border border-slate-300'}`}
       >
          {atlasListening && <div className="absolute inset-0 rounded-full border border-blue-600 animate-ping opacity-20"></div>}
          <Mic size={48} strokeWidth={1} className={atlasListening ? 'text-blue-600' : 'text-slate-500'} />
       </button>

       <p className="font-sans text-xl text-slate-900/80 font-light max-w-2xl h-24 flex items-center justify-center">"{atlasResponse}"</p>

       <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
          <span className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-full font-sans text-sm text-slate-500">"When is my next checkup?"</span>
          <span className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-full font-sans text-sm text-slate-500">"What did my last blood test mean?"</span>
          <span className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-full font-sans text-sm text-slate-500">"Should I take my medication with food?"</span>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600/30 flex font-sans overflow-hidden">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }}></div>

      {renderEditModal()}
      
      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 h-screen w-24 border-r border-slate-200 bg-slate-50/90 backdrop-blur-3xl z-50 flex flex-col items-center py-10">
        <div className="w-12 h-12 flex items-center justify-center mb-12">
             <img src="/vela-icon.png" alt="Vela" style={{ height: 32, width: "auto", filter: "brightness(0.5)" }} />
        </div>

        <nav className="flex flex-col gap-8 w-full">
            {[
              { id: 'home', icon: User },
              { id: 'reports', icon: Activity },
              { id: 'medications', icon: Pill },
              { id: 'history', icon: FileText },
              { id: 'find-care', icon: MapPin },
              { id: 'appointments', icon: Calendar },
              { id: 'atlas', icon: Mic }
            ].map(tab => (
              <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative w-full h-12 flex items-center justify-center transition-colors ${activeTab === tab.id ? 'text-slate-900' : 'text-slate-400 hover:text-slate-500'}`}
              >
                  <tab.icon size={22} strokeWidth={1.5} />
                  {activeTab === tab.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-blue-600" />}
              </button>
            ))}
        </nav>

        <div className="mt-auto">
             <button 
                onClick={() => { localStorage.clear(); navigate("/portal"); }}
                className="w-12 h-12 border border-slate-200 hover:border-red-500/50 hover:bg-red-500/10 text-slate-400 hover:text-red-400 flex items-center justify-center transition-all rounded-xl"
            >
                <X size={20} strokeWidth={1.5} />
            </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-24 p-8 md:p-16 max-w-[1400px] mx-auto w-full relative z-10 overflow-y-auto h-screen styled-scrollbar">
        {/* Header */}
        <header className="flex items-end justify-between mb-12 border-b border-slate-200 pb-8 fade-in-up">
            <div>
                <h1 className="text-5xl md:text-6xl font-serif italic text-slate-900 mb-4 leading-none tracking-tight">
                    Welcome back,<br/><span className="text-slate-900/80">{patient?.name?.split(" ")[0]}</span>.
                </h1>
                <div className="flex items-center gap-4 text-[10px] text-slate-500 font-mono uppercase tracking-[0.2em]">
                    <span>{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
            </div>
            <div className="hidden md:flex items-center gap-4">
                 <div className="border border-slate-200 bg-[#121212] px-6 py-3 flex items-center gap-3 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[9px] font-mono tracking-[0.2em] text-slate-500 uppercase">Network Synced</span>
                </div>
            </div>
        </header>

        <div className={activeTab === 'home' ? 'block' : 'hidden'}>
          {renderHome()}
        </div>
        <div className={activeTab === 'reports' ? 'block' : 'hidden'}>
          {renderReports()}
        </div>
        <div className={activeTab === 'medications' ? 'block' : 'hidden'}>
          {renderMedications()}
        </div>
        <div className={activeTab === 'find-care' ? 'block' : 'hidden'}>
          {renderFindCare()}
        </div>
        <div className={activeTab === 'appointments' ? 'block' : 'hidden'}>
          {renderAppointments()}
        </div>
        <div className={activeTab === 'atlas' ? 'block' : 'hidden'}>
          {renderAtlas()}
        </div>
        <div className={activeTab === 'history' ? 'block' : 'hidden'}>
          {renderHistory()}
        </div>
        
      </main>
    </div>
  );
};

export default PatientDashboard;
