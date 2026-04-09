import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import mapboxgl from 'mapbox-gl';
import toast from 'react-hot-toast';
import { API_URL } from '../utils/config';
import VelaOnboardingWizard from '../components/VelaOnboardingWizard';

export default function VelaOwner() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [showTC, setShowTC] = useState(false);
  const [showOnboarderInfo, setShowOnboarderInfo] = useState(false);
  const [onboarderName, setOnboarderName] = useState('');
  const [selectedPin, setSelectedPin] = useState<any>(null);
  const [viewingHospital, setViewingHospital] = useState<any>(null);
  const [newCredentials, setNewCredentials] = useState<any>(null);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const statsRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // Hospital search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<any>(null);

  useEffect(() => {
    if (localStorage.getItem('vela_owner') === 'true') setAuthed(true);
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchStats();
    fetchHospitals();
  }, [authed]);

  useEffect(() => {
    if (!authed || !stats) return;
    const targets = [
      { ref: statsRefs.current[0], val: stats.total_hospitals },
      { ref: statsRefs.current[1], val: stats.total_staff },
      { ref: statsRefs.current[2], val: stats.total_patients_today },
      { ref: statsRefs.current[3], val: stats.total_atlas_queries_today },
    ];
    targets.forEach(({ ref, val }) => {
      if (!ref) return;
      gsap.fromTo(ref, { innerText: 0 }, { innerText: val, duration: 2, snap: { innerText: 1 }, ease: 'power1.out' });
    });
  }, [stats, authed]);

  useEffect(() => {
    if (!authed || !mapRef.current || mapInstance.current) return;
    const token = import.meta.env.VITE_MAPBOX_TOKEN || '';
    if (!token) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [78.9629, 20.5937],
      zoom: 4.5,
    });
    mapInstance.current = map;
    map.on('load', () => addHospitalMarkers(map));
  }, [authed, hospitals]);

  const addHospitalMarkers = (map: mapboxgl.Map) => {
    hospitals.forEach(h => {
      if (!h.latitude || !h.longitude) return;
      const el = document.createElement('div');
      el.style.cssText = 'width:32px;height:32px;background:#C8B89A;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#0C0C0B;font-size:13px;font-weight:900;cursor:pointer;box-shadow:0 0 12px rgba(200,184,154,0.6);';
      el.innerHTML = 'V';
      new mapboxgl.Marker({ element: el })
        .setLngLat([h.longitude, h.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<div style="font-family:Geist,sans-serif;padding:4px"><strong>${h.name}</strong><br/><span style="font-size:11px;color:#6B6B6B">${h.city}, ${h.state}</span><br/><span style="font-size:10px;color:#0F766E">${h.staff_count} staff · ${h.active_staff} online</span></div>`))
        .addTo(map);
    });
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/owner/stats`);
      const data = await res.json();
      if (data.status === 'success') setStats(data);
    } catch {}
  };

  const fetchHospitals = async () => {
    try {
      const res = await fetch(`${API_URL}/api/owner/hospitals`);
      const data = await res.json();
      if (data.status === 'success') setHospitals(data.hospitals);
    } catch {}
  };

  // Search any hospital in the world — tries Mapbox then Nominatim fallback
  const searchHospitals = async (query: string) => {
    if (!query.trim() || query.length < 3) { setSearchResults([]); return; }
    setSearching(true);
    try {
      // Primary: Nominatim (OpenStreetMap) — best hospital coverage worldwide, free
      const nominatimRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=1&extratags=1`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'VelaHealth/1.0' } }
      );
      const nominatimData = await nominatimRes.json();

      if (nominatimData && nominatimData.length > 0) {
        const results = nominatimData.map((r: any) => ({
          name: r.namedetails?.name || r.display_name.split(',')[0],
          address: r.display_name,
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          place_id: `osm_${r.osm_id}`,
          city: r.address?.city || r.address?.town || r.address?.village || r.address?.county || '',
          state: r.address?.state || '',
          country: r.address?.country || '',
          type: r.type || r.class || '',
        }));
        setSearchResults(results);
        return;
      }

      // Fallback: Mapbox Geocoding
      const token = import.meta.env.VITE_MAPBOX_TOKEN || '';
      if (token) {
        const mapboxRes = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=8&access_token=${token}`
        );
        const mapboxData = await mapboxRes.json();
        const results = (mapboxData.features || []).map((f: any) => ({
          name: f.text,
          address: f.place_name,
          lat: f.center[1],
          lng: f.center[0],
          place_id: f.id,
          city: f.context?.find((c: any) => c.id.startsWith('place'))?.text || '',
          state: f.context?.find((c: any) => c.id.startsWith('region'))?.text || '',
          country: f.context?.find((c: any) => c.id.startsWith('country'))?.text || '',
        }));
        setSearchResults(results);
      }
    } catch (err) {
      console.error('Search error:', err);
      toast.error('Search failed. Check your connection.');
    } finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    clearTimeout(searchTimeout.current);
    if (val.length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(() => searchHospitals(val), 500);
  };

  const handleSelectResult = (result: any) => {
    setSelectedPin(result);
    setSearchQuery(result.name);
    setSearchResults([]);
    // Fly map to selected hospital
    if (mapInstance.current) {
      mapInstance.current.flyTo({ center: [result.lng, result.lat], zoom: 14, duration: 1200 });
      new mapboxgl.Marker({ color: '#C8B89A' })
        .setLngLat([result.lng, result.lat])
        .setPopup(new mapboxgl.Popup().setHTML(`<strong>${result.name}</strong><br/>${result.address}`))
        .addTo(mapInstance.current);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/owner/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.status === 'success') {
        localStorage.setItem('vela_auth', 'true');
        localStorage.setItem('vela_role', 'vela_owner');
        localStorage.setItem('vela_owner', 'true');
        setAuthed(true);
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Backend not reachable');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectOnboard = async () => {
    if (!selectedPin) return;
    setIsOnboarding(true);
    try {
      const res = await fetch(`${API_URL}/api/owner/onboard-hospital`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedPin.name,
          address: selectedPin.address,
          city: selectedPin.city,
          state: selectedPin.state,
          latitude: selectedPin.lat,
          longitude: selectedPin.lng,
          mapbox_place_id: selectedPin.place_id,
          manager_name: onboarderName,
          specializations: [], // Manager will fill this later
          total_beds: 100 // Default
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setNewCredentials(data);
        fetchHospitals();
        fetchStats();
      } else {
        toast.error(data.message || 'Onboarding failed');
      }
    } catch {
      toast.error('Connection failed');
    } finally {
      setIsOnboarding(false);
    }
  };

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: '#0C0C0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Geist, sans-serif' }}>
        <div style={{ width: 360, padding: 48, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,184,154,0.2)', borderRadius: 20, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: '#C8B89A', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 24 }}>VELA COMMAND CENTER</div>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 72, color: '#C8B89A', lineHeight: 1, marginBottom: 8 }}>V</div>
          <h1 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 28, color: '#FAFAF9', marginBottom: 32 }}>Owner Access</h1>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 16px', color: '#FAFAF9', fontFamily: 'Geist, sans-serif', fontSize: 14, outline: 'none' }} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 16px', color: '#FAFAF9', fontFamily: 'Geist, sans-serif', fontSize: 14, outline: 'none' }} />
            <button type="submit" disabled={loading}
              style={{ background: '#C8B89A', color: '#0C0C0B', border: 'none', borderRadius: 8, padding: '14px', fontFamily: 'Geist, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Authenticating...' : 'Authenticate'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0C0C0B', color: '#FAFAF9', fontFamily: 'Geist, sans-serif' }}>
      {/* Success Credentials Modal */}
      {newCredentials && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 480, width: '100%', background: '#121211', border: '1px solid #C8B89A', borderRadius: 24, padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
            <h1 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 40, color: '#C8B89A', marginBottom: 8 }}>Hospital Active</h1>
            <p style={{ color: 'rgba(250,250,249,0.4)', marginBottom: 32 }}>Onboarding complete. Share these owner-generated credentials with the manager.</p>
            
            <div style={{ background: 'rgba(200,184,154,0.06)', border: '1px solid rgba(200,184,154,0.3)', borderRadius: 16, padding: 28, marginBottom: 32, textAlign: 'left' }}>
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: '#C8B89A', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 16 }}>Manager Credentials</div>
              
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: 'rgba(250,250,249,0.4)', marginBottom: 2 }}>MANAGER EMAIL</div>
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 13, color: '#FAFAF9' }}>{newCredentials.manager_email}</div>
              </div>
              
              <div>
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: 'rgba(250,250,249,0.4)', marginBottom: 2 }}>INITIAL PASSWORD</div>
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 13, color: '#FAFAF9' }}>{newCredentials.manager_password}</div>
              </div>
            </div>

            <button type="button" onClick={() => { setNewCredentials(null); setOnboarderName(''); setSelectedPin(null); }} 
              style={{ width: '100%', padding: '16px', borderRadius: 12, border: 'none', color: '#0C0C0B', cursor: 'pointer', background: '#C8B89A', fontWeight: 700, fontSize: 14 }}>
              Close & View Network
            </button>
          </div>
        </div>
      )}

      {/* Terms & Conditions Modal */}
      {showTC && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 640, width: '100%', background: '#121211', border: '1px solid rgba(200,184,154,0.3)', borderRadius: 24, padding: 48, maxHeight: '90vh', overflowY: 'auto' }}>
            <h1 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 40, color: '#C8B89A', marginBottom: 16 }}>Network Terms</h1>
            <div style={{ color: 'rgba(250,250,249,0.5)', fontSize: 14, lineHeight: 1.6, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p>By onboarding this hospital to the Vela Network, you acknowledge that you are initiating a clinical synchronization process. All data will be handled as per HIPAA and global healthcare standards.</p>
              <p>The Vela Command Center provides AI-driven diagnostics through the Atlas engine. Medical decisions must be validated by licensed professionals. Vela is an assistive intelligence layer, not a replacement for human clinical judgement.</p>
              <p>Hospitals on the network are granted access to real-time predictive analytics, bed management systems, and cross-facility clinical intelligence.</p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={() => setShowTC(false)} style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', color: '#FAFAF9', cursor: 'pointer', background: 'transparent' }}>Cancel</button>
              <button type="button" onClick={() => { setShowTC(false); setShowOnboarderInfo(true); }} style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', color: '#0C0C0B', cursor: 'pointer', background: '#C8B89A', fontWeight: 700 }}>I Agree & Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarder Info Modal */}
      {showOnboarderInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 480, width: '100%', background: '#121211', border: '1px solid rgba(200,184,154,0.3)', borderRadius: 24, padding: 48 }}>
            <h1 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 32, color: '#FAFAF9', marginBottom: 8 }}>Internal Records</h1>
            <p style={{ color: 'rgba(250,250,249,0.4)', marginBottom: 32, fontSize: 14 }}>Please identify yourself as the onboarding official.</p>
            <div style={{ marginBottom: 32 }}>
              <label style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: 'rgba(250,250,249,0.3)', textTransform: 'uppercase', letterSpacing: '0.2em', display: 'block', marginBottom: 8 }}>Your Full Name</label>
              <input 
                type="text" 
                value={onboarderName} 
                onChange={e => setOnboarderName(e.target.value)} 
                placeholder="Dev Chalana"
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 20px', color: '#FAFAF9', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={() => setShowOnboarderInfo(false)} style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', color: '#FAFAF9', cursor: 'pointer', background: 'transparent' }}>Back</button>
              <button 
                type="button" 
                disabled={!onboarderName.trim() || isOnboarding}
                onClick={() => { setShowOnboarderInfo(false); handleDirectOnboard(); }} 
                style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', color: '#0C0C0B', cursor: 'pointer', background: '#C8B89A', fontWeight: 700, opacity: onboarderName.trim() && !isOnboarding ? 1 : 0.5 }}
              >
                {isOnboarding ? 'Onboarding...' : 'Onboard Hospital →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hospital Details Modal */}
      {viewingHospital && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 520, width: '100%', background: '#121211', border: '1px solid rgba(200,184,154,0.3)', borderRadius: 24, padding: 48 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
              <div>
                <h1 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 36, color: '#FAFAF9', marginBottom: 4 }}>{viewingHospital.name}</h1>
                <p style={{ color: 'rgba(250,250,249,0.4)', fontSize: 13 }}>ID: {viewingHospital.id}</p>
              </div>
              <button type="button" onClick={() => setViewingHospital(null)} style={{ background: 'none', border: 'none', color: 'rgba(250,250,249,0.3)', cursor: 'pointer', fontSize: 24 }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, marginBottom: 40 }}>
              <div>
                <label style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: 'rgba(250,250,249,0.3)', textTransform: 'uppercase', letterSpacing: '0.2em', display: 'block', marginBottom: 4 }}>Manager name</label>
                <div style={{ color: '#FAFAF9', fontSize: 15 }}>{viewingHospital.manager_name}</div>
              </div>
              <div>
                <label style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: 'rgba(250,250,249,0.3)', textTransform: 'uppercase', letterSpacing: '0.2em', display: 'block', marginBottom: 4 }}>Total Beds</label>
                <div style={{ color: '#FAFAF9', fontSize: 15 }}>{viewingHospital.total_beds}</div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: 'rgba(250,250,249,0.3)', textTransform: 'uppercase', letterSpacing: '0.2em', display: 'block', marginBottom: 4 }}>Manager Email</label>
                <div style={{ color: '#C8B89A', fontSize: 14, fontFamily: 'Geist Mono, monospace' }}>{viewingHospital.manager_email}</div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: 'rgba(250,250,249,0.3)', textTransform: 'uppercase', letterSpacing: '0.2em', display: 'block', marginBottom: 4 }}>Manager password</label>
                <div style={{ color: '#FAFAF9', fontSize: 14, fontFamily: 'Geist Mono, monospace', background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: 8, marginTop: 4 }}>{viewingHospital.manager_password}</div>
              </div>
            </div>

            <button type="button" onClick={() => { setViewingHospital(null); navigate(`/hospital-manager`); }} style={{ width: '100%', padding: '16px', borderRadius: 12, border: 'none', color: '#0C0C0B', cursor: 'pointer', background: '#C8B89A', fontWeight: 700, fontSize: 14 }}>Access Manager Dashboard</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '24px 48px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 28, color: '#C8B89A' }}>V</div>
          <div>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: '#C8B89A', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Vela Command Center</div>
            <div style={{ fontFamily: 'Geist, sans-serif', fontSize: 13, color: 'rgba(250,250,249,0.4)' }}>Dev Chalana · Owner</div>
          </div>
        </div>
        <button type="button" onClick={() => { setSelectedPin(null); setShowTC(true); }}
          style={{ background: '#C8B89A', color: '#0C0C0B', border: 'none', borderRadius: 10, padding: '10px 24px', fontFamily: 'Geist, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Onboard Hospital
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ padding: '24px 48px 0', position: 'relative' }}>
        <div style={{ position: 'relative', maxWidth: 600 }}>
          <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(250,250,249,0.3)', fontSize: 18, pointerEvents: 'none' }}>🔍</div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search any hospital worldwide... (e.g. Apollo Hospital, AIIMS Delhi, Max Healthcare)"
            style={{
              width: '100%', padding: '14px 16px 14px 48px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, color: '#FAFAF9', fontFamily: 'Geist, sans-serif', fontSize: 15,
              outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.2s'
            }}
            onFocus={e => e.target.style.borderColor = '#C8B89A'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
          />
          {searching && (
            <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, border: '2px solid #C8B89A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          )}
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 48, right: 48, maxWidth: 600, background: '#1a1a1a', border: '1px solid rgba(200,184,154,0.2)', borderRadius: 12, overflow: 'hidden', zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', marginTop: 4 }}>
            {searchResults.map((r, i) => (
              <div key={i}
                onClick={() => handleSelectResult(r)}
                style={{ padding: '14px 20px', cursor: 'pointer', borderBottom: i < searchResults.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,184,154,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontFamily: 'Geist, sans-serif', fontWeight: 600, fontSize: 14, color: '#FAFAF9', marginBottom: 2 }}>{r.name}</div>
                <div style={{ fontFamily: 'Geist, sans-serif', fontSize: 12, color: 'rgba(250,250,249,0.4)' }}>{r.address}</div>
              </div>
            ))}
          </div>
        )}

        {/* Selected hospital — Onboard button */}
        {selectedPin && searchResults.length === 0 && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(200,184,154,0.08)', border: '1px solid rgba(200,184,154,0.25)', borderRadius: 12, padding: '14px 20px', maxWidth: 600 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Geist, sans-serif', fontWeight: 600, fontSize: 15, color: '#FAFAF9', marginBottom: 2 }}>{selectedPin.name}</div>
              <div style={{ fontFamily: 'Geist, sans-serif', fontSize: 12, color: 'rgba(250,250,249,0.5)' }}>{selectedPin.address}</div>
            </div>
            <button type="button"
              onClick={() => setShowTC(true)}
              style={{ background: '#C8B89A', color: '#0C0C0B', border: 'none', borderRadius: 8, padding: '10px 20px', fontFamily: 'Geist, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ✦ Onboard on Vela
            </button>
            <button type="button" onClick={() => { setSelectedPin(null); setSearchQuery(''); }}
              style={{ background: 'none', border: 'none', color: 'rgba(250,250,249,0.3)', cursor: 'pointer', fontSize: 18, padding: 4 }}>✕</button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '32px 48px 0' }}>
        {[
          { label: 'Total Hospitals', color: '#22C55E', idx: 0 },
          { label: 'Staff on Network', color: '#0F766E', idx: 1 },
          { label: 'Patients Today', color: '#FAFAF9', idx: 2 },
          { label: 'Atlas Queries Today', color: '#C8B89A', idx: 3 },
        ].map(({ label, color, idx }) => (
          <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24 }}>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'rgba(250,250,249,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{label}</div>
            <span ref={el => { statsRefs.current[idx] = el; }} style={{ fontFamily: 'Instrument Serif, serif', fontSize: 48, color, lineHeight: 1 }}>0</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <div style={{ margin: '32px 48px', borderRadius: 16, overflow: 'hidden', height: 400, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      </div>

      <div style={{ padding: '0 48px 48px' }}>
        <h2 style={{ fontFamily: 'Instrument Serif, serif', fontSize: 32, marginBottom: 24, color: '#C8B89A' }}>Vela Hospitals</h2>
        {hospitals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 16, color: 'rgba(250,250,249,0.3)', fontFamily: 'Geist Mono, monospace', fontSize: 12 }}>
            No hospitals onboarded yet. Click "+ Onboard Hospital" to add the first one.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {hospitals.map(h => (
              <div key={h.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24, cursor: 'pointer', transition: 'all 0.3s' }} 
                onClick={() => setViewingHospital(h)}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(200,184,154,0.4)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: 'Geist, sans-serif', fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{h.name}</div>
                    <div style={{ fontFamily: 'Geist, sans-serif', fontSize: 12, color: 'rgba(250,250,249,0.4)' }}>{h.city}, {h.state}</div>
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${h.health_score > 70 ? '#22C55E' : '#F59E0B'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Geist Mono, monospace', fontSize: 11, color: h.health_score > 70 ? '#22C55E' : '#F59E0B', fontWeight: 700 }}>
                    {h.health_score || 0}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
                  <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'rgba(250,250,249,0.4)' }}>
                    <span style={{ color: '#FAFAF9', fontWeight: 600 }}>{h.staff_count}</span> staff
                  </div>
                  <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'rgba(250,250,249,0.4)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: h.active_staff > 0 ? '#22C55E' : '#6B6B6B', display: 'inline-block' }} />
                    <span style={{ color: h.active_staff > 0 ? '#22C55E' : 'rgba(250,250,249,0.4)', fontWeight: 600 }}>{h.active_staff}</span> online
                  </div>
                </div>

                <div style={{ background: 'rgba(200,184,154,0.04)', border: '1px solid rgba(200,184,154,0.15)', borderRadius: 12, padding: 16, marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                    <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: 'rgba(250,250,249,0.3)', textTransform: 'uppercase' }}>Manager ID</div>
                    <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: '#C8B89A', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(h.manager_email); toast.success('Email copied'); }}>
                      {h.manager_email} <span style={{ fontSize: 10 }}>📋</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: 'rgba(250,250,249,0.3)', textTransform: 'uppercase' }}>Initial Pass</div>
                    <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: '#FAFAF9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(h.manager_password); toast.success('Password copied'); }}>
                      {h.manager_password} <span style={{ fontSize: 10 }}>📋</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
