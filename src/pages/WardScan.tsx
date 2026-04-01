import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { 
  QrCode, 
  User, 
  Activity, 
  Clock, 
  ChevronLeft,
  ShieldAlert,
  Stethoscope,
  Heart
} from 'lucide-react';
import { API_URL } from '../utils/config';
import toast, { Toaster } from 'react-hot-toast';

interface PatientData {
  name: string;
  vela_id: string;
  age: number;
  gender: string;
  blood_group: string;
  allergies: string;
  existing_conditions: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  atlas_analysis: string;
  atlas_confidence: string;
  risk_score: number;
}

interface AdmissionData {
  admission_qr: string;
  admitted_at: string;
  room_type: string;
  ward_name: string;
  bed_number: string;
  recommended_by: string;
  diagnosis: string;
  patient: PatientData;
}

export default function WardScan() {
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [admissionData, setAdmissionData] = useState<AdmissionData | null>(null);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (scanning && !admissionData) {
      const scanner = new Html5QrcodeScanner(
        "ward-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scanner.render(onScanSuccess, onScanFailure);

      return () => {
        scanner.clear().catch(() => console.error("Failed to clear scanner"));
      };
    }
  }, [scanning, admissionData]);

  async function onScanSuccess(decodedText: string) {
    setScanning(false);
    fetchAdmissionData(decodedText);
  }

  function onScanFailure() {
    // Silent fail for common scan misses
  }

  const fetchAdmissionData = async (qrCode: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admissions/scan/${qrCode}`);
      const data = await res.json();
      
      if (data.status === 'success') {
        setAdmissionData(data.admission);
        toast.success("Patient Record Retrived");
      } else {
        toast.error(data.message || "Invalid QR Code");
        setScanning(true);
      }
    } catch (err) {
      toast.error("Network error");
      setScanning(true);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      fetchAdmissionData(manualCode.trim());
    }
  };

  if (admissionData) {
    const p = admissionData.patient;
    return (
      <div className="min-h-screen bg-[#080808] text-white font-sans selection:bg-blue-600/30">
        <Toaster position="top-center" />
        
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-white/5 sticky top-0 bg-[#080808]/80 backdrop-blur-xl z-50">
          <button 
            onClick={() => { setAdmissionData(null); setScanning(true); }}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-blue-500 mb-1">Ward Access Terminal</div>
            <div className="font-serif italic text-xl">Clinical Dashboard</div>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>

        <main className="p-6 pb-24 max-w-lg mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Critical Alerts */}
          {(p.allergies || p.risk_score > 7) && (
            <div className={`p-5 rounded-3xl border-2 flex items-start gap-4 ${p.risk_score > 7 ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
              <ShieldAlert className={p.risk_score > 7 ? 'text-red-500' : 'text-amber-500'} size={24} />
              <div>
                <h4 className="font-mono text-[10px] uppercase tracking-widest font-bold mb-1">Critical Alerts</h4>
                <p className="text-sm text-white/80 leading-relaxed italic">
                  {p.allergies ? `Allergies: ${p.allergies}` : 'High clinical risk detected.'}
                </p>
              </div>
            </div>
          )}

          {/* Patient Header */}
          <div className="text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/20 ring-4 ring-white/5">
              <User size={40} className="text-white" />
            </div>
            <h2 className="font-serif italic text-4xl mb-2">{p.name}</h2>
            <div className="font-mono text-[11px] text-white/40 uppercase tracking-[0.2em]">
              {p.vela_id} <span className="mx-2">•</span> Age {p.age} <span className="mx-2">•</span> {p.gender}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 p-5 rounded-[32px] text-center">
              <div className="flex items-center justify-center gap-2 text-blue-500 mb-3">
                <Heart size={16} />
                <span className="font-mono text-[9px] uppercase tracking-widest">Blood Type</span>
              </div>
              <div className="text-2xl font-mono font-bold">{p.blood_group || 'N/A'}</div>
            </div>
            <div className="bg-white/5 border border-white/10 p-5 rounded-[32px] text-center">
              <div className="flex items-center justify-center gap-2 text-emerald-500 mb-3">
                <Activity size={16} />
                <span className="font-mono text-[9px] uppercase tracking-widest">Risk Score</span>
              </div>
              <div className="text-2xl font-mono font-bold">{p.risk_score || 0}/10</div>
            </div>
          </div>

          {/* Location & Admission Info */}
          <div className="bg-white/5 border border-white/10 rounded-[32px] overflow-hidden">
             <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">Current Allocation</div>
                <div className="px-3 py-1 bg-blue-600 rounded-full font-mono text-[9px] uppercase tracking-widest">Active</div>
             </div>
             <div className="p-6 grid grid-cols-2 gap-8">
                <div>
                   <div className="font-mono text-[9px] text-white/30 uppercase tracking-widest mb-1">Ward / Bed</div>
                   <div className="text-lg font-bold">{admissionData.ward_name} <span className="text-blue-500">#{admissionData.bed_number}</span></div>
                </div>
                <div>
                   <div className="font-mono text-[9px] text-white/30 uppercase tracking-widest mb-1">Room Type</div>
                   <div className="text-sm">{admissionData.room_type}</div>
                </div>
             </div>
          </div>

          {/* Diagnosis & Atlas Insight */}
          <div className="space-y-4">
             <div className="flex items-center gap-3 ml-2">
                <Stethoscope size={18} className="text-blue-500" />
                <h3 className="font-serif italic text-2xl">Clinical Status</h3>
             </div>
             <div className="bg-white/5 border border-white/10 p-6 rounded-[32px] space-y-6">
                <div>
                   <label className="block font-mono text-[9px] uppercase tracking-widest text-white/30 mb-2">Primary Diagnosis</label>
                   <p className="text-sm leading-relaxed text-white/90">{admissionData.diagnosis || "No diagnosis provided"}</p>
                </div>
                {p.atlas_analysis && (
                   <div className="pt-6 border-t border-white/5">
                      <div className="flex items-center justify-between mb-3">
                        <label className="block font-mono text-[9px] uppercase tracking-widest text-blue-500">Atlas AI Insight</label>
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 font-mono text-[8px] uppercase rounded border border-blue-500/20">{p.atlas_confidence} CONFIDENCE</span>
                      </div>
                      <p className="text-xs leading-relaxed text-white/60 italic">
                         {p.atlas_analysis}
                      </p>
                   </div>
                )}
             </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-gradient-to-br from-red-500/20 to-transparent border border-red-500/20 p-6 rounded-[32px]">
             <div className="flex items-center gap-3 mb-4">
                <Clock size={18} className="text-red-500" />
                <h3 className="font-serif italic text-xl">Emergency Contact</h3>
             </div>
             <div className="flex justify-between items-center">
                <div>
                   <div className="font-bold text-sm mb-0.5">{p.emergency_contact_name || 'N/A'}</div>
                   <div className="font-mono text-[10px] text-white/40 tracking-widest font-bold">{p.emergency_contact_phone || 'N/A'}</div>
                </div>
                <a href={`tel:${p.emergency_contact_phone}`} className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                   <Activity size={20} />
                </a>
             </div>
          </div>

        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans flex flex-col items-center justify-center p-6 text-center">
      <Toaster position="top-center" />
      <div className="noise-overlay pointer-events-none opacity-20" />

      {loading ? (
        <div className="space-y-6 animate-pulse">
           <div className="w-20 h-20 border-t-2 border-blue-600 rounded-full mx-auto animate-spin" />
           <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">Decrypting Bio-Data...</p>
        </div>
      ) : (
        <div className="w-full max-w-md space-y-12 animate-in fade-in zoom-in-95 duration-700">
          <div>
            <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-8 ring-1 ring-blue-500/20 shadow-2xl shadow-blue-600/10">
               <QrCode size={32} />
            </div>
            <h1 className="font-serif italic text-5xl mb-4 tracking-tight">Ward Terminal</h1>
            <p className="font-mono text-[10px] text-white/40 uppercase tracking-[0.3em] max-w-[280px] mx-auto leading-loose">
              Scan patient admission QR for real-time clinical access
            </p>
          </div>

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-[#0F0F0F] border border-white/5 rounded-3xl overflow-hidden aspect-square flex flex-col">
               <div id="ward-reader" className="flex-1 w-full" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="font-mono text-[9px] uppercase tracking-widest text-white/20">or enter manual code</div>
            <form onSubmit={handleManualSubmit} className="flex gap-3">
              <input 
                type="text" 
                placeholder="ADM-XXXXXX"
                value={manualCode}
                onChange={e => setManualCode(e.target.value.toUpperCase())}
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-mono text-sm tracking-widest focus:outline-none focus:border-blue-600 transition-colors uppercase"
              />
              <button 
                type="submit"
                className="px-8 bg-blue-600 text-white rounded-2xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-shadow-blue-700 transition-all shadow-xl shadow-blue-500/20"
              >
                Go
              </button>
            </form>
          </div>

          <div className="pt-12 text-white/10">
             <div className="font-mono text-[8px] uppercase tracking-[0.5em] mb-4 font-bold">Encrypted VELA Link</div>
             <div className="flex justify-center gap-8">
                <Heart size={16} />
                <Activity size={16} />
                <ShieldAlert size={16} />
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
