import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, Activity, Users, Settings, Plus, X, 
  Map as MapIcon, BarChart, Clock, 
  ChevronRight, Database, Brain, ArrowUpRight, ArrowDownRight,
  Stethoscope as _Stethoscope, Bed, Trash2 as Trash, Maximize2 as Maximize,
  Calendar
} from 'lucide-react';
import { io } from 'socket.io-client';
import { API_URL, SOCKET_URL } from '../utils/config';
import toast from 'react-hot-toast';
import VelaOnboardingWizard from '../components/VelaOnboardingWizard';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState, 
  Panel,
  Handle,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

// Removed top-level socket initialization to prevent execution crashes

interface NetworkHospital {
  id: string;
  name: string;
  address: string;
  place_id: string;
  lat: number;
  lng: number;
  specializations: string[];
  receptionist_email: string;
  receptionist_name: string;
  created_at: string;
}

interface NetworkAppointment {
  id: string;
  hospital_id: string;
  patient_id: string;
  patient_name: string;
  vela_id: string;
  date: string;
  time: string;
  status: 'pending' | 'arrived' | 'cancelled';
  created_at: string;
}

// --- CUSTOM NODES ---

const WardNode = ({ data }: { data: any }) => {
  const bgColor = data.color || '#0F172A';
  const beds = data.beds || [];
  const occupied = beds.filter((b: any) => b.status === 'occupied').length;
  const total = beds.length;
  const percentage = total > 0 ? (occupied / total) * 100 : 0;

  return (
    <div className="group relative bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-w-[280px]">
      <div className="h-2 w-full" style={{ backgroundColor: bgColor }}></div>
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 leading-tight">{data.name}</h3>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{data.type}</span>
          </div>
          <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-slate-100 transition-colors">
            <Maximize size={14} className="text-slate-400" />
          </div>
        </div>

        {/* Staff in Ward */}
        {data.staff && data.staff.length > 0 && (
          <div className="flex items-center gap-1 mb-4">
            <Users size={12} className="text-slate-400" />
            <div className="flex -space-x-2 overflow-hidden">
              {data.staff.map((s: any) => (
                <div key={s.id} title={`${s.name} (${s.role})`} className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold uppercase">
                  {s.name.charAt(0)}
                </div>
              ))}
            </div>
            <span className="text-[10px] font-semibold text-slate-500 ml-1">Assigned</span>
          </div>
        )}

        {/* Occupancy Bar */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-[11px] font-medium text-slate-600">
            <span>Occupancy</span>
            <span>{occupied}/{total} Beds</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-700" 
              style={{ 
                width: `${percentage}%`,
                backgroundColor: percentage > 80 ? '#EF4444' : percentage > 50 ? '#F59E0B' : '#10B981'
              }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {beds.slice(0, 4).map((bed: any) => (
            <div key={bed.id} className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-md border border-slate-100">
              <div className={`w-2 h-2 rounded-full ${bed.status === 'occupied' ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
              <span className="text-[10px] font-medium text-slate-700">{bed.bed_number}</span>
            </div>
          ))}
          {total > 4 && (
            <div className="col-span-2 text-center py-1 text-[10px] text-slate-500 font-medium">
              + {total - 4} more beds
            </div>
          )}
        </div>
      </div>
      
      <Handle type="target" position={Position.Top} className="!bg-slate-300 !w-2 !h-2 border-none" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-300 !w-2 !h-2 border-none" />
    </div>
  );
};

const nodeTypes = {
  wardNode: WardNode,
};

// --- COMPONENTS ---

export default function HospitalManager() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const socket = useMemo(() => io(SOCKET_URL), []);
  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'staff' | 'analytics' | 'config' | 'hospitals' | 'staff_mgmt' | 'command'>('overview');
  const [hospitalId, setHospitalId] = useState(localStorage.getItem('vela_hospital_id') || '');
  const [hospitalName, setHospitalName] = useState(localStorage.getItem('vela_hospital_name') || '');
  const [wards, setWards] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any>({ doctors: [], receptionists: [], lab_controllers: [] });
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [addStaffForm, setAddStaffForm] = useState({ name: '', role: 'doctor', specialization: '', ward_id: '' });
  const [addingStaff, setAddingStaff] = useState(false);
  const [newStaffCreds, setNewStaffCreds] = useState<any>(null);
  const [commandData, setCommandData] = useState<any>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchResult, setSearchResult] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  // Network Hospitals state
  const [hospitalNameInput, setHospitalNameInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedHospital, setVerifiedHospital] = useState<{ name: string; address: string; place_id: string; lat: number; lng: number } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [specializationInput, setSpecializationInput] = useState('');
  const [receptionistName, setReceptionistName] = useState('');
  const [registering, setRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string; hospital_name: string } | null>(null);
  useEffect(() => {
    if (localStorage.getItem('vela_manager_auth') === 'true') {
      setIsAuthed(true);
    }
  }, []);

  const handleManagerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/manager/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (data.status === 'success') {
        localStorage.setItem('vela_manager_auth', 'true');
        localStorage.setItem('vela_hospital_id', data.hospital_id);
        localStorage.setItem('vela_hospital_name', data.hospital_name);
        setHospitalId(data.hospital_id);
        setHospitalName(data.hospital_name);
        setIsAuthed(true);
        if (data.walkthrough_done === false) {
          setShowWizard(true);
        }
        toast.success(`Welcome, ${data.manager_name}`);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Connection failed');
    } finally {
      setLoginLoading(false);
    }
  };
  const [networkHospitals, setNetworkHospitals] = useState<NetworkHospital[]>([]);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null);
  
  // React Flow State
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, , onEdgesChange] = useEdgesState<any>([]);

  const fetchData = useCallback(async () => {
    try {
      const [ovRes, wardRes, staffRes] = await Promise.all([
        fetch(`${API_URL}/api/hospital/overview?hospital_id=${hospitalId}`),
        fetch(`${API_URL}/api/wards?hospital_id=${hospitalId}`),
        fetch(`${API_URL}/api/staff/list?hospital_id=${hospitalId}`)
      ]);

      const ov = await ovRes.json();
      const wrd = await wardRes.json();
      const stf = await staffRes.json();

      if (ov?.data) setOverview(ov.data);
      if (wrd?.wards) {
        setWards(wrd.wards);
        // Setup Nodes
        const flowNodes = wrd.wards.map((w: any, idx: number) => ({
          id: String(w.id),
          type: 'wardNode',
          position: { x: w.x || 100, y: w.y || (idx * 250) + 50 },
          data: { ...w },
          draggable: true,
        }));
        setNodes(flowNodes);
      }
      if (stf?.staff) setStaff(stf.staff);
      
      setLoading(false);
    } catch (err) {
      console.error("Fetch error:", err);
      setLoading(false); // Ensure loading is cleared even on error
    }
  }, [setNodes]);

  useEffect(() => {
    fetchData();

    socket.on('patient_admitted', (data) => {
      setActivity(prev => [{
        id: Date.now(),
        type: 'admission',
        message: `${data.patient_name} admitted to ${data.ward_name} (Bed ${data.bed_number})`,
        time: 'Just now',
        status: 'urgent'
      }, ...prev]);
      fetchData();
    });

    socket.on('patient_discharged', (data) => {
      setActivity(prev => [{
        id: Date.now(),
        type: 'discharge',
        message: `${data.patient_name} discharged from Bed ${data.bed_number}`,
        time: 'Just now',
        status: 'stable'
      }, ...prev]);
      fetchData();
    });

    socket.on('bed_status_changed', (data) => {
      setActivity(prev => [{
        id: Date.now(),
        type: 'status',
        message: `Bed ${data.bed_id} status changed to ${data.status}`,
        time: 'Just now',
        status: 'info'
      }, ...prev]);
      fetchData();
    });

    socket.on('atlas_analysis_updated', (data) => {
      setActivity(prev => [{
        id: Date.now(),
        type: 'ai',
        message: `Atlas AI updated analysis for patient ID ${data.patient_id.substring(0,8)}...`,
        time: 'Just now',
        status: 'ai'
      }, ...prev]);
      fetchData();
    });

    socket.on('queue_updated', (data) => {
      setActivity(prev => [{
        id: Date.now(),
        type: 'arrival',
        message: `${data.patient_name} has arrived for appointment`,
        time: 'Just now',
        status: 'stable'
      }, ...prev]);
      fetchData();
    });

    socket.on('lab_update', (data) => {
      setActivity(prev => [{
        id: Date.now(),
        type: 'lab',
        message: `Lab Status: ${data.patient_name} - ${data.status.toUpperCase()}`,
        time: 'Just now',
        status: 'info'
      }, ...prev]);
      fetchData();
    });

    socket.on('report_submitted', (data) => {
      setActivity(prev => [{
        id: Date.now(),
        type: 'report',
        message: `NEW REPORT: Diagnostic complete for ${data.patient_name}`,
        time: 'Just now',
        status: 'ai'
      }, ...prev]);
      fetchData();
    });

    return () => {
      socket.off('patient_admitted');
      socket.off('patient_discharged');
      socket.off('bed_status_changed');
      socket.off('atlas_analysis_updated');
      socket.off('queue_updated');
      socket.off('lab_update');
      socket.off('report_submitted');
    };
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'hospitals') {
      setNetworkLoading(true);
      fetch(`${API_URL}/api/network/hospitals`)
        .then(r => r.json())
        .then(d => { if (d.status === 'success') setNetworkHospitals(d.hospitals); })
        .catch(console.error)
        .finally(() => setNetworkLoading(false));
    }
    if (activeTab === 'staff_mgmt' && hospitalId) {
      fetch(`${API_URL}/api/manager/staff/${hospitalId}`)
        .then(r => r.json())
        .then(d => { if (d.status === 'success') setStaffList(d); })
        .catch(console.error);
    }
    if (activeTab === 'command' && hospitalId) {
      fetch(`${API_URL}/api/manager/command-center/${hospitalId}`)
        .then(r => r.json())
        .then(d => { if (d.status === 'success') setCommandData(d); })
        .catch(console.error);
    }
  }, [activeTab]);

  const onNodeDragStop = async (_event: any, node: any) => {
    try {
      await fetch(`${API_URL}/api/wards/${node.id}/position`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: node.position.x, y: node.position.y })
      });
    } catch (err) {
      console.error("Failed to save position:", err);
    }
  };

  const handleGlobalSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResult([]);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/patients/search?q=${query}`);
      const data = await res.json();
      setSearchResult(data.patients || []);
    } catch (err) {
      console.error("Search error:", err);
    }
  };

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500 animate-pulse">Synchronizing Hospital Core...</p>
      </div>
    </div>
  );

  if (!isAuthed) {
    return (
      <div style={{ minHeight: '100vh', background: '#0C0C0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Geist, sans-serif' }}>
        <div style={{ width: 400, padding: 48, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(200,184,154,0.15)', borderRadius: 24, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: '#C8B89A', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 24 }}>VELA HOSPITAL OS</div>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 64, color: '#C8B89A', lineHeight: 1, marginBottom: 12 }}>V</div>
          <h1 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 28, color: '#FAFAF9', marginBottom: 8 }}>Manager Portal</h1>
          <p style={{ color: 'rgba(250,250,249,0.4)', fontSize: 13, marginBottom: 32 }}>Enter your hospital credentials to begin synchronization.</p>
          <form onSubmit={handleManagerLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: 'rgba(250,250,249,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Manager ID / Email</label>
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="manager@hospital.vela.health" required
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 16px', color: '#FAFAF9', fontFamily: 'Geist, sans-serif', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <label style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: 'rgba(250,250,249,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Access Password</label>
              <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" required
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 16px', color: '#FAFAF9', fontFamily: 'Geist, sans-serif', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" disabled={loginLoading}
              style={{ background: '#C8B89A', color: '#0C0C0B', border: 'none', borderRadius: 10, padding: '14px', fontFamily: 'Geist, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 12, transition: 'all 0.2s', opacity: loginLoading ? 0.7 : 1 }}>
              {loginLoading ? 'Synchronizing...' : 'Initialize Session'}
            </button>
          </form>
          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ color: 'rgba(250,250,249,0.3)', fontSize: 11 }}>Secure biometric encrypted session. Unauthorized access is strictly logged by Atlas Engine.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[#F8FAFC] font-sans text-[#0F172A] selection:bg-blue-100 overflow-hidden">
      {showWizard && (
        <VelaOnboardingWizard 
          initialData={{ id: hospitalId, name: hospitalName }}
          onboarderName={hospitalName} // Manager name is usually retrieved but we'll use hospitalName for now or leave it to wizard to fetch
          onClose={() => { setShowWizard(false); fetchData(); }}
          isManagerSetup={true}
        />
      )}
      
      {/* ── LEFT SIDEBAR: COMMAND CENTER ── */}
      <div className="w-[320px] flex flex-col border-r border-slate-200 bg-white shadow-[1px_0_0_0_rgba(0,0,0,0.02)]">
        {/* Profile / Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <img src="/vela-icon.png" alt="Vela" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight">VELA COMMAND</h1>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> SYSTEM LIVE
              </p>
            </div>
          </div>

          {/* Global Search Interface */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Search patients, wards, staff..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              onFocus={() => setShowSearchModal(true)}
              onChange={(e) => handleGlobalSearch(e.target.value)}
              value={searchQuery}
            />
          </div>
        </div>

        {/* Real-time Activity Feed */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b border-slate-50">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Global Activity</span>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              <Clock size={10} /> Real-time
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 scrollbar-none">
            {activity.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-slate-400">
                <Activity size={24} className="mb-2 opacity-20" />
                <p className="text-[11px] font-medium">No system events yet</p>
              </div>
            ) : (
              activity.map((item) => (
                <div key={item.id} className="group relative flex gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:shadow-md hover:border-slate-200 transition-all duration-300">
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                    item.status === 'urgent' ? 'bg-red-500' : 
                    item.status === 'ai' ? 'bg-indigo-500' : 
                    item.status === 'stable' ? 'bg-green-500' : 'bg-blue-500'
                  } shadow-sm animate-pulse`}></div>
                  <div>
                    <p className="text-[12px] font-medium text-slate-800 leading-snug">{item.message}</p>
                    <span className="text-[10px] text-slate-400 font-medium">{item.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bottom Status */}
        <div className="p-4 bg-slate-50/50 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-indigo-600" />
              <span className="text-xs font-semibold text-slate-700">Atlas Analysis Engine</span>
            </div>
            <div className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">V2.4 LATEST</div>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed px-1">
            Processing live diagnostic data. Atlas is cross-referencing document trends for active cases.
          </p>
        </div>
      </div>

      {/* ── RIGHT MAIN: MODULE DISPLAY ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Top Tab Bar */}
        <header className="h-[72px] bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10 shadow-sm shadow-slate-900/5">
          <nav className="flex items-center gap-1">
            {[
              { id: 'overview', icon: BarChart, label: 'Performance' },
              { id: 'map', icon: MapIcon, label: 'Ward Map' },
              { id: 'staff', icon: Users, label: 'Personnel' },
              { id: 'analytics', icon: Activity, label: 'AI Trends' },
              { id: 'config', icon: Settings, label: 'System' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                  activeTab === tab.id 
                  ? 'bg-blue-50 text-blue-600 border border-blue-100 shadow-sm shadow-blue-100/50' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <tab.icon size={18} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                {tab.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setActiveTab('hospitals')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 20px', borderRadius: 12,
                fontSize: 14, fontWeight: 600,
                background: activeTab === 'hospitals' ? 'rgba(15,118,110,0.1)' : 'transparent',
                color: activeTab === 'hospitals' ? '#0F766E' : '#64748b',
                border: activeTab === 'hospitals' ? '1px solid rgba(15,118,110,0.25)' : '1px solid transparent',
                cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <Plus size={16} />
              Hospitals
            </button>
            <button type="button" onClick={() => setActiveTab('staff_mgmt')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600, background: activeTab === 'staff_mgmt' ? 'rgba(15,118,110,0.1)' : 'transparent', color: activeTab === 'staff_mgmt' ? '#0F766E' : '#64748b', border: activeTab === 'staff_mgmt' ? '1px solid rgba(15,118,110,0.25)' : '1px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
              <Users size={16} />
              Staff
            </button>
            <button type="button" onClick={() => setActiveTab('command')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600, background: activeTab === 'command' ? 'rgba(99,102,241,0.1)' : 'transparent', color: activeTab === 'command' ? '#6366f1' : '#64748b', border: activeTab === 'command' ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
              <Activity size={16} />
              Command
            </button>
          </nav>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold text-slate-800 tracking-tight">Dr. Sarah West</span>
              <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase italic">Medical Director</span>
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-slate-200 p-0.5 cursor-pointer hover:border-blue-400 transition-colors">
              <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold overflow-hidden">
                <img src="https://ui-avatars.com/api/?name=Dr+Sarah+West&background=f1f5f9&color=64748b" alt="Director" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC]/50 p-8 scroll-smooth">
          
          {activeTab === 'overview' && overview && (
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-6">
                {[
                  { label: 'Total Patients', value: overview.total_patients, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Active Inpatients', value: overview.active_inpatients, icon: Bed, color: 'text-indigo-600', bg: 'bg-indigo-50', total: overview.total_beds },
                  { label: 'Daily Admissions', value: overview.admissions_today, icon: ArrowUpRight, color: 'text-blue-500', bg: 'bg-blue-50/50' },
                  { label: 'Appointments Today', value: overview.appointments_today, icon: Calendar, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                ].map((stat: any, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
                        <stat.icon size={22} />
                      </div>
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">+4%</span>
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</h4>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-slate-900 leading-none">{stat.value}</span>
                        {stat.total && <span className="text-slate-400 font-bold text-sm">/ {stat.total}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Main Visuals Group */}
              <div className="grid grid-cols-3 gap-8">
                {/* Occupancy Chart */}
                <div className="col-span-2 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-10">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 leading-none mb-2">Facility Utilization</h3>
                      <p className="text-xs font-semibold text-slate-400">Total bed occupancy trend over the last 14 days</p>
                    </div>
                    <div className="p-2 border border-slate-200 rounded-xl">
                      <select className="bg-transparent text-[11px] font-bold text-slate-600 focus:outline-none pr-4">
                        <option>LAST 14 DAYS</option>
                        <option>LAST 30 DAYS</option>
                      </select>
                    </div>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[
                        { t: 'Mar 1', v: 45 }, { t: 'Mar 3', v: 52 }, { t: 'Mar 5', v: 48 }, 
                        { t: 'Mar 7', v: 61 }, { t: 'Mar 9', v: 58 }, { t: 'Mar 11', v: 72 }, 
                        { t: 'Mar 13', v: 68 }, { t: 'Mar 15', v: 75 }
                      ]}>
                        <defs>
                          <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="t" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                        />
                        <Area type="monotone" dataKey="v" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Risk Distribution */}
                <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 mb-6">Risk Profile Stratification</h3>
                  <div className="h-[240px] w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Critical', value: overview?.critical_patients || 0, color: '#EF4444' },
                            { name: 'Moderate', value: 12, color: '#F59E0B' },
                            { name: 'Stable', value: Math.max(0, (overview?.total_patients || 0) - (overview?.critical_patients || 0) - 12), color: '#10B981' },
                          ]}
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={8}
                          dataKey="value"
                        >
                          <Cell fill="#EF4444" stroke="none" />
                          <Cell fill="#F59E0B" stroke="none" />
                          <Cell fill="#10B981" stroke="none" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 mt-6">
                    {[
                      { l: 'Critical (Red)', c: 'bg-red-500', p: '12%' },
                      { l: 'Moderate (Amber)', c: 'bg-amber-500', p: '45%' },
                      { l: 'Stable (Green)', c: 'bg-green-500', p: '43%' }
                    ].map((row, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${row.c}`}></div>
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{row.l}</span>
                        </div>
                        <span className="text-[11px] font-black text-slate-900">{row.p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'map' && (
            <div className="h-full w-full bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeDragStop={onNodeDragStop}
                nodeTypes={nodeTypes}
                fitView
                className="bg-slate-50/50"
              >
                <Background color="#cbd5e1" gap={20} size={1} />
                <Controls className="!bg-white !border-slate-200 !shadow-lg rounded-xl overflow-hidden" />
                <Panel position="top-left" className="bg-white/80 backdrop-blur-md p-4 m-4 rounded-2xl border border-white shadow-xl shadow-slate-200/50">
                  <div className="flex items-center gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Hospital Layout Explorer</h4>
                      <p className="text-[10px] font-semibold text-slate-500">Drag wards to customize your administrative view</p>
                    </div>
                    <div className="h-10 w-[1px] bg-slate-200"></div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                      <Plus size={14} /> NEW WARD
                    </button>
                  </div>
                </Panel>
              </ReactFlow>
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Personnel Registry</h2>
                  <p className="text-sm font-medium text-slate-400">Manage medical staff and active duty permissions</p>
                </div>
                <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                  <Database size={18} /> ADD STAFF MEMBER
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {staff.map((s) => (
                  <div key={s.id} className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-between hover:border-blue-200 hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden ring-2 ring-slate-50">
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random`} alt={s.name} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{s.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded">{s.role}</span>
                          <span className="text-[10px] font-medium text-slate-400">ID: {s.id.substring(0,8)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-12">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</span>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${s.available ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {s.available ? 'ON DUTY' : 'OFF DUTY'}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Action</span>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500">
                            <Settings size={14} />
                          </button>
                          <button className="p-2 bg-rose-50 hover:bg-rose-100 rounded-lg text-rose-500">
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="max-w-7xl mx-auto space-y-8">
              <div className="flex items-center gap-3 p-6 bg-indigo-900 rounded-3xl text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                <div className="relative p-4 bg-white/20 rounded-2xl backdrop-blur-md">
                  <Brain size={32} className="text-white" />
                </div>
                <div className="relative">
                  <h2 className="text-xl font-black tracking-tight">Vela Atlas AI Core</h2>
                  <p className="text-sm font-medium text-indigo-100/80 max-w-xl">
                    Our neural analysis engine is cross-referencing discharge likelihood with real-time vitals and historical patient data. 
                    Prediction accuracy improved by 14% this week.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 mb-8 flex items-center gap-2">
                    <ArrowUpRight className="text-green-500" /> Patient Risk Trajectory
                  </h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={[
                        { t: '10 AM', v: 45 }, { t: '12 PM', v: 38 }, { t: '2 PM', v: 42 }, 
                        { t: '4 PM', v: 36 }, { t: '6 PM', v: 30 }, { t: '8 PM', v: 28 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                        <Tooltip />
                        <Line type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={4} dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 mb-8 flex items-center gap-2">
                    <ArrowDownRight className="text-blue-500" /> Discharge Efficiency
                  </h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={[
                        { t: 'Mon', v: 82 }, { t: 'Tue', v: 78 }, { t: 'Wed', v: 85 }, 
                        { t: 'Thu', v: 91 }, { t: 'Fri', v: 88 }, { t: 'Sat', v: 94 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                        <Tooltip />
                        <Line type="stepAfter" dataKey="v" stroke="#2dd4bf" strokeWidth={4} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'hospitals' && (
            <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32, padding: '8px 0' }}>

              {/* Credential Modal */}
              {credentials && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                  <div style={{ background: '#fff', borderRadius: 20, padding: 40, maxWidth: 480, width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '2px solid #22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>✓</div>
                    <h3 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 26, color: '#0F172A', marginBottom: 6 }}>Hospital Registered!</h3>
                    <p style={{ fontFamily: 'Geist, sans-serif', fontSize: 13, color: '#64748b', marginBottom: 28 }}>{credentials.hospital_name}</p>
                    <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 20, marginBottom: 20, textAlign: 'left' }}>
                      <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Receptionist Credentials</p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div>
                          <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>EMAIL</p>
                          <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 13, color: '#0F172A', fontWeight: 600 }}>{credentials.email}</p>
                        </div>
                        <button type="button" onClick={() => { navigator.clipboard.writeText(credentials.email); setCopiedField('email'); setTimeout(() => setCopiedField(null), 1500); }}
                          style={{ background: copiedField === 'email' ? '#22C55E' : '#0F766E', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontFamily: 'Geist Mono, monospace', fontSize: 10, cursor: 'pointer' }}>
                          {copiedField === 'email' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>PASSWORD</p>
                          <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 13, color: '#0F172A', fontWeight: 600 }}>{credentials.password}</p>
                        </div>
                        <button type="button" onClick={() => { navigator.clipboard.writeText(credentials.password); setCopiedField('password'); setTimeout(() => setCopiedField(null), 1500); }}
                          style={{ background: copiedField === 'password' ? '#22C55E' : '#0F766E', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontFamily: 'Geist Mono, monospace', fontSize: 10, cursor: 'pointer' }}>
                          {copiedField === 'password' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setCredentials(null); setVerifiedHospital(null); setSpecializations([]); setReceptionistName(''); setHospitalNameInput(''); setRegistrationError(null); }}
                      style={{ background: '#0F766E', color: 'white', border: 'none', borderRadius: 10, padding: '12px 32px', fontFamily: 'Geist, sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                      Done
                    </button>
                  </div>
                </div>
              )}

              {/* Registration Form */}
              <div style={{ background: 'white', borderRadius: 20, border: '1px solid #E2E8F0', padding: 32 }}>
                <h2 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 28, color: '#0F172A', marginBottom: 6 }}>Register Hospital</h2>
                <p style={{ fontFamily: 'Geist, sans-serif', fontSize: 14, color: '#64748b', marginBottom: 28 }}>Add a hospital to the Vela network and generate receptionist credentials.</p>

                {/* Verify */}
                <div style={{ marginBottom: 24 }}>
                  <label style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Hospital Name</label>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <input type="text" value={hospitalNameInput}
                      onChange={e => { setHospitalNameInput(e.target.value); setVerifyError(null); }}
                      placeholder="e.g. Apollo Hospital Hyderabad"
                      style={{ flex: 1, padding: '12px 16px', border: '1px solid #E2E8F0', borderRadius: 10, fontFamily: 'Geist, sans-serif', fontSize: 14, color: '#0F172A', outline: 'none' }} />
                    <button type="button" disabled={verifying || !hospitalNameInput.trim()}
                      onClick={async () => {
                        setVerifying(true); setVerifyError(null); setVerifiedHospital(null);
                        try {
                          const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
                          const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(hospitalNameInput)}&key=${key}`);
                          const data = await res.json();
                          if (data.results && data.results.length > 0) {
                            const r = data.results[0];
                            setVerifiedHospital({ name: r.name, address: r.formatted_address, place_id: r.place_id, lat: r.geometry.location.lat, lng: r.geometry.location.lng });
                          } else {
                            setVerifyError('Hospital not found on Google Maps. Please check the name and try again.');
                          }
                        } catch { setVerifyError('Hospital not found on Google Maps. Please check the name and try again.'); }
                        finally { setVerifying(false); }
                      }}
                      style={{ padding: '12px 20px', background: verifying || !hospitalNameInput.trim() ? '#94a3b8' : '#0F766E', color: 'white', border: 'none', borderRadius: 10, fontFamily: 'Geist, sans-serif', fontWeight: 600, fontSize: 13, cursor: verifying || !hospitalNameInput.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                      {verifying ? 'Verifying...' : '🔍 Verify on Google Maps'}
                    </button>
                  </div>
                  {verifyError && <p style={{ fontFamily: 'Geist, sans-serif', fontSize: 13, color: '#EF4444', marginTop: 8 }}>{verifyError}</p>}
                </div>

                {/* Verified Card */}
                {verifiedHospital && (
                  <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: 16, marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 18, color: '#22C55E' }}>✓</span>
                    <div>
                      <p style={{ fontFamily: 'Geist, sans-serif', fontWeight: 600, fontSize: 15, color: '#0F172A', marginBottom: 2 }}>{verifiedHospital.name}</p>
                      <p style={{ fontFamily: 'Geist, sans-serif', fontSize: 13, color: '#64748b', marginBottom: 4 }}>{verifiedHospital.address}</p>
                      <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: '#22C55E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>✓ Verified</span>
                    </div>
                  </div>
                )}

                {/* Specializations */}
                {verifiedHospital && (
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Specializations</label>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <input type="text" value={specializationInput} onChange={e => setSpecializationInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && specializationInput.trim()) { setSpecializations(p => [...p, specializationInput.trim()]); setSpecializationInput(''); e.preventDefault(); }}}
                        placeholder="e.g. Cardiology"
                        style={{ flex: 1, padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontSize: 14, color: '#0F172A', outline: 'none' }} />
                      <button type="button" onClick={() => { if (specializationInput.trim()) { setSpecializations(p => [...p, specializationInput.trim()]); setSpecializationInput(''); }}}
                        style={{ padding: '10px 18px', background: '#0F766E', color: 'white', border: 'none', borderRadius: 8, fontFamily: 'Geist, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Add</button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {specializations.map((s, i) => (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(15,118,110,0.1)', color: '#0F766E', border: '1px solid rgba(15,118,110,0.2)', borderRadius: 100, padding: '4px 12px', fontFamily: 'Geist, sans-serif', fontSize: 13, fontWeight: 500 }}>
                          {s}
                          <button type="button" onClick={() => setSpecializations(p => p.filter((_, j) => j !== i))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0F766E', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Receptionist Name */}
                {verifiedHospital && (
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>Receptionist Name</label>
                    <input type="text" value={receptionistName} onChange={e => setReceptionistName(e.target.value)} placeholder="e.g. Priya Sharma"
                      style={{ width: '100%', padding: '12px 16px', border: '1px solid #E2E8F0', borderRadius: 10, fontFamily: 'Geist, sans-serif', fontSize: 14, color: '#0F172A', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                )}

                {registrationError && <p style={{ fontFamily: 'Geist, sans-serif', fontSize: 13, color: '#EF4444', marginBottom: 16 }}>{registrationError}</p>}

                {verifiedHospital && (
                  <button type="button"
                    disabled={registering || specializations.length === 0 || !receptionistName.trim()}
                    onClick={async () => {
                      setRegistering(true); setRegistrationError(null);
                      try {
                        const res = await fetch(`${API_URL}/api/network/hospitals/register`, {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ ...verifiedHospital, specializations, receptionist_name: receptionistName })
                        });
                        const data = await res.json();
                        if (res.status === 409 || data.code === 'DUPLICATE_PLACE_ID') {
                          setRegistrationError('This hospital is already registered on the Vela network.');
                        } else if (data.status === 'success') {
                          setCredentials({ email: data.email, password: data.password, hospital_name: data.hospital_name });
                          setNetworkHospitals(p => [{ id: data.hospital_id, name: verifiedHospital.name, address: verifiedHospital.address, place_id: verifiedHospital.place_id, lat: verifiedHospital.lat, lng: verifiedHospital.lng, specializations, receptionist_email: data.email, receptionist_name: receptionistName, created_at: new Date().toISOString() }, ...p]);
                        } else {
                          setRegistrationError(data.message || 'Registration failed.');
                        }
                      } catch { setRegistrationError('Registration failed. Please try again.'); }
                      finally { setRegistering(false); }
                    }}
                    style={{ padding: '14px 32px', background: registering || specializations.length === 0 || !receptionistName.trim() ? '#94a3b8' : '#0F766E', color: 'white', border: 'none', borderRadius: 12, fontFamily: 'Geist, sans-serif', fontWeight: 700, fontSize: 15, cursor: registering || specializations.length === 0 || !receptionistName.trim() ? 'not-allowed' : 'pointer' }}>
                    {registering ? 'Registering...' : '+ Register Hospital'}
                  </button>
                )}
              </div>

              {/* Registered Hospitals List */}
              <div style={{ background: 'white', borderRadius: 20, border: '1px solid #E2E8F0', padding: 32 }}>
                <h3 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 22, color: '#0F172A', marginBottom: 20 }}>Vela Network Hospitals</h3>
                {networkLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[1,2,3].map(i => <div key={i} style={{ height: 64, background: '#F1F5F9', borderRadius: 10 }} />)}
                  </div>
                ) : networkHospitals.length === 0 ? (
                  <p style={{ fontFamily: 'Geist, sans-serif', fontSize: 14, color: '#94a3b8', textAlign: 'center', padding: '32px 0' }}>No hospitals registered yet. Use the form above to add the first hospital to the Vela network.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {networkHospitals.map(h => (
                      <div key={h.id} style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <p style={{ fontFamily: 'Geist, sans-serif', fontWeight: 600, fontSize: 15, color: '#0F172A' }}>{h.name}</p>
                            <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: '#C8B89A', fontWeight: 700, border: '1px solid rgba(200,184,154,0.4)', borderRadius: 100, padding: '2px 8px' }}>✦ ON VELA</span>
                          </div>
                          <p style={{ fontFamily: 'Geist, sans-serif', fontSize: 13, color: '#64748b', marginBottom: 6 }}>{h.address}</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                            {h.specializations.map((s, i) => <span key={i} style={{ fontFamily: 'Geist, sans-serif', fontSize: 11, color: '#0F766E', background: 'rgba(15,118,110,0.08)', borderRadius: 100, padding: '2px 8px' }}>{s}</span>)}
                          </div>
                          <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: '#94a3b8' }}>{h.receptionist_email}</p>
                        </div>
                        <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>{new Date(h.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STAFF MANAGEMENT TAB ── */}
          {activeTab === 'staff_mgmt' && (
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              {/* Add Staff Modal */}
              {showAddStaff && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
                  <div style={{ background: 'white', borderRadius: 20, padding: 40, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
                    <h3 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 24, color: '#0F172A', marginBottom: 24 }}>Add Staff Member</h3>
                    {newStaffCreds ? (
                      <div>
                        <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Staff Login Created</div>
                          <div style={{ fontFamily: 'Geist, sans-serif', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{newStaffCreds.name} — {newStaffCreds.role}</div>
                          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12, color: '#374151', marginBottom: 2 }}>{newStaffCreds.email}</div>
                          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12, color: '#374151' }}>{newStaffCreds.password}</div>
                        </div>
                        <button type="button" onClick={() => { setShowAddStaff(false); setNewStaffCreds(null); setAddStaffForm({ name: '', role: 'doctor', specialization: '' }); if (hospitalId) fetch(`${API_URL}/api/manager/staff/${hospitalId}`).then(r => r.json()).then(d => { if (d.status === 'success') setStaffList(d); }); }}
                          style={{ width: '100%', background: '#0F766E', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontFamily: 'Geist, sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Done</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                          <label style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Role</label>
                          <select value={addStaffForm.role} onChange={e => setAddStaffForm(f => ({ ...f, role: e.target.value }))}
                            style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 14px', fontFamily: 'Geist, sans-serif', fontSize: 14, color: '#0F172A', outline: 'none', background: 'white' }}>
                            <option value="doctor">Doctor</option>
                            <option value="receptionist">Receptionist</option>
                            <option value="lab_controller">Lab Controller</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Full Name</label>
                          <input value={addStaffForm.name} onChange={e => setAddStaffForm(f => ({ ...f, name: e.target.value }))} placeholder="Dr. Priya Sharma"
                            style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 14px', fontFamily: 'Geist, sans-serif', fontSize: 14, color: '#0F172A', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        {addStaffForm.role === 'doctor' && (
                          <div>
                            <label style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Specialization</label>
                            <input value={addStaffForm.specialization} onChange={e => setAddStaffForm(f => ({ ...f, specialization: e.target.value }))} placeholder="Cardiology"
                              style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 14px', fontFamily: 'Geist, sans-serif', fontSize: 14, color: '#0F172A', outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                        )}

                        <div>
                          <label style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Assign Ward area</label>
                          <select 
                            value={addStaffForm.ward_id} 
                            onChange={e => setAddStaffForm(f => ({ ...f, ward_id: e.target.value }))}
                            style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 14px', fontFamily: 'Geist, sans-serif', fontSize: 14, color: '#0F172A', outline: 'none', background: 'white' }}
                          >
                            <option value="">Floating / Unassigned</option>
                            {wards.map(w => (
                              <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
                            ))}
                          </select>
                          {addStaffForm.role === 'lab_controller' && !wards.some(w => w.type?.toLowerCase().includes('lab')) && (
                            <p style={{ marginTop: 6, fontSize: 11, color: '#EF4444', fontFamily: 'Geist, sans-serif' }}>⚠️ No Lab area detected. Add a Lab Ward first to hire controllers.</p>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                          <button type="button" onClick={() => setShowAddStaff(false)}
                            style={{ flex: 1, background: '#F1F5F9', border: 'none', borderRadius: 10, padding: '12px', fontFamily: 'Geist, sans-serif', fontSize: 14, cursor: 'pointer', color: '#374151' }}>Cancel</button>
                          <button 
                            type="button" 
                            disabled={addingStaff || !addStaffForm.name.trim() || (addStaffForm.role === 'lab_controller' && !wards.some(w => w.type?.toLowerCase().includes('lab')))} 
                            onClick={async () => {
                            setAddingStaff(true);
                            try {
                              const payload = {
                                ...addStaffForm,
                                hospital_id: hospitalId,
                                ward_id: addStaffForm.ward_id || null
                              };
                              const res = await fetch(`${API_URL}/api/manager/add-staff`, { 
                                method: 'POST', 
                                headers: { 'Content-Type': 'application/json' }, 
                                body: JSON.stringify(payload) 
                              });
                              const data = await res.json();
                              if (data.status === 'success') {
                                setNewStaffCreds(data);
                                toast.success('Staff member added successfully');
                                // Refresh list
                                if (hospitalId) {
                                  fetch(`${API_URL}/api/manager/staff/${hospitalId}`).then(r => r.json()).then(d => { if (d.status === 'success') setStaffList(d); });
                                }
                              } else {
                                toast.error(data.message || 'Failed to add staff');
                              }
                            } catch (err) {
                              toast.error('Connection failed');
                            } finally { setAddingStaff(false); }
                          }}
                            style={{ flex: 1, background: addingStaff || !addStaffForm.name.trim() ? '#94a3b8' : '#0F766E', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontFamily: 'Geist, sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                            {addingStaff ? 'Adding...' : 'Add to Team'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                <h2 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 32, color: '#0F172A' }}>Your Team</h2>
                <button type="button" onClick={() => setShowAddStaff(true)}
                  style={{ background: '#C8B89A', color: '#0C0C0B', border: 'none', borderRadius: 10, padding: '10px 24px', fontFamily: 'Geist, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  + Add Staff Member
                </button>
              </div>

              {(['doctors', 'receptionists', 'lab_controllers'] as const).map(group => {
                const members = staffList[group] || [];
                const label = group === 'doctors' ? 'Doctors' : group === 'receptionists' ? 'Receptionists' : 'Lab Controllers';
                return (
                  <div key={group} style={{ marginBottom: 32 }}>
                    <h3 style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 12 }}>{label} ({members.length})</h3>
                    {members.length === 0 ? (
                      <div style={{ padding: '20px', border: '1px dashed #E2E8F0', borderRadius: 12, textAlign: 'center', color: '#94a3b8', fontFamily: 'Geist, sans-serif', fontSize: 13 }}>No {label.toLowerCase()} added yet.</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                        {members.map((s: any) => (
                          <div key={s.id} style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#0F766E', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Instrument Serif, serif', fontSize: 18, fontWeight: 700 }}>
                                {s.name.charAt(0)}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontFamily: 'Geist, sans-serif', fontWeight: 600, fontSize: 15, color: '#0F172A' }}>{s.name}</div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  {s.specialization && <div style={{ fontFamily: 'Geist, sans-serif', fontSize: 12, color: '#C8B89A' }}>{s.specialization}</div>}
                                  <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: '#64748b', background: '#F1F5F9', padding: '1px 6px', borderRadius: 4 }}>{s.ward_name || 'Floating'}</div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.online ? '#22C55E' : '#94a3b8' }} />
                                <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: s.online ? '#22C55E' : '#94a3b8' }}>{s.online ? 'Online' : 'Offline'}</span>
                              </div>
                            </div>
                            <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: '#374151', marginBottom: 2 }}>{s.email}</div>
                              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>{revealedPasswords.has(s.id) ? s.password : '••••••••'}</span>
                                <button type="button" onClick={() => setRevealedPasswords(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Geist Mono, monospace', fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>
                                  {revealedPasswords.has(s.id) ? 'Hide' : 'Reveal'}
                                </button>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button type="button" onClick={() => { navigator.clipboard.writeText(s.email); }}
                                style={{ flex: 1, background: '#F1F5F9', border: 'none', borderRadius: 6, padding: '6px', fontFamily: 'Geist Mono, monospace', fontSize: 9, color: '#374151', cursor: 'pointer', textTransform: 'uppercase' }}>Copy Email</button>
                              <button type="button" onClick={() => { navigator.clipboard.writeText(s.password); }}
                                style={{ flex: 1, background: '#F1F5F9', border: 'none', borderRadius: 6, padding: '6px', fontFamily: 'Geist Mono, monospace', fontSize: 9, color: '#374151', cursor: 'pointer', textTransform: 'uppercase' }}>Copy Pass</button>
                              <button type="button" onClick={async () => { if (confirm(`Remove ${s.name}?`)) { await fetch(`${API_URL}/api/manager/staff/${s.id}`, { method: 'DELETE' }); if (hospitalId) fetch(`${API_URL}/api/manager/staff/${hospitalId}`).then(r => r.json()).then(d => { if (d.status === 'success') setStaffList(d); }); } }}
                                style={{ background: '#FEF2F2', border: 'none', borderRadius: 6, padding: '6px 10px', fontFamily: 'Geist Mono, monospace', fontSize: 9, color: '#EF4444', cursor: 'pointer', textTransform: 'uppercase' }}>Remove</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── COMMAND CENTER TAB ── */}
          {activeTab === 'command' && (
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              <h2 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 32, color: '#0F172A', marginBottom: 24 }}>Command Center</h2>

              {/* Staff Online */}
              <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, marginBottom: 20 }}>
                <h3 style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16 }}>Staff Online Now</h3>
                {!commandData || commandData.staff_online.length === 0 ? (
                  <p style={{ fontFamily: 'Geist, sans-serif', fontSize: 13, color: '#94a3b8' }}>No staff currently online.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {commandData.staff_online.map((s: any) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 100, padding: '6px 14px' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
                        <span style={{ fontFamily: 'Geist, sans-serif', fontSize: 13, color: '#166534', fontWeight: 500 }}>{s.name}</span>
                        <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: '#4ADE80' }}>{s.role}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Patient Flow */}
              <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, marginBottom: 20 }}>
                <h3 style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16 }}>Patient Flow</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Waiting', value: commandData?.patients_waiting ?? 0, color: '#3B82F6' },
                    { label: 'Consulting', value: commandData?.patients_in_consultation ?? 0, color: '#8B5CF6' },
                    { label: 'In Lab', value: commandData?.patients_in_lab ?? 0, color: '#F59E0B' },
                    { label: 'In Ward', value: commandData?.patients_in_ward ?? 0, color: '#0F766E' },
                    { label: 'Discharged', value: commandData?.discharged_today ?? 0, color: '#22C55E' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ textAlign: 'center', padding: 16, background: '#F8FAFC', borderRadius: 12 }}>
                      <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 36, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
                      <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Atlas Stats */}
              <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24 }}>
                <h3 style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16 }}>Atlas AI Today</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Total Queries', value: commandData?.atlas_queries_today ?? 0, color: '#C8B89A' },
                    { label: 'Critical Alerts', value: commandData?.critical_alerts_today ?? 0, color: '#EF4444' },
                    { label: 'Avg Response', value: '2.3s', color: '#22C55E' },
                    { label: 'Reports Analyzed', value: 0, color: '#3B82F6' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ textAlign: 'center', padding: 16, background: '#F8FAFC', borderRadius: 12 }}>
                      <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 32, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
                      <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── SEARCH RESULTS MODAL ── */}
      {showSearchModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm p-8 flex items-start justify-center pt-[15vh]">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Search size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 leading-none mb-1">Global Patient Intelligence</h2>
                  <p className="text-xs font-semibold text-slate-400">Search by Name, VELA ID, or Medical Condition</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowSearchModal(false); setSearchQuery(''); setSearchResult([]); }}
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4">
              <input 
                autoFocus
                type="text"
                placeholder="Type to search..."
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-lg font-medium focus:ring-0 placeholder:text-slate-300"
                value={searchQuery}
                onChange={(e) => handleGlobalSearch(e.target.value)}
              />
            </div>

            <div className="max-h-[500px] overflow-y-auto p-4 space-y-3">
              {searchResult.length > 0 ? (
                searchResult.map((p) => (
                  <div key={p.id} className="group p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 hover:shadow-md transition-all duration-300 flex items-center justify-between relative">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center font-bold text-blue-600 uppercase">
                        {p.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900 mb-0.5">{p.name}</h4>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">{p.vela_id}</span>
                          <span className="text-[10px] font-medium text-slate-400">Age: {p.age}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Atlas Score</div>
                        <div className={`text-base font-black ${
                          p.risk_score > 70 ? 'text-red-500' : p.risk_score > 40 ? 'text-amber-500' : 'text-green-500'
                        }`}>
                          {p.risk_score}/100
                        </div>
                      </div>
                      <button className="p-3 bg-slate-900 text-white rounded-xl hover:scale-105 transition-transform">
                        <ChevronRight size={18} />
                      </button>
                    </div>

                    {/* Quick AI Snapshot Hover */}
                    {p.atlas_analysis && (
                      <div className="absolute top-1/2 -translate-y-1/2 right-[105%] w-64 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain size={14} className="text-blue-400" />
                          <span className="text-[10px] font-bold tracking-widest uppercase">Atlas Snapshot</span>
                        </div>
                        <p className="text-[11px] font-medium leading-relaxed italic line-clamp-4">"{p.atlas_analysis}"</p>
                      </div>
                    )}
                  </div>
                ))
              ) : searchQuery.length >= 2 ? (
                <div className="h-40 flex flex-col items-center justify-center text-slate-400">
                  <Search size={32} className="mb-2 opacity-20" />
                  <p className="text-sm font-bold">No patients found matches "{searchQuery}"</p>
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-slate-400">
                  <Database size={32} className="mb-2 opacity-20" />
                  <p className="text-[11px] font-bold uppercase tracking-widest">Type to begin indexing database</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
