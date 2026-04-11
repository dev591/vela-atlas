import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import gsap from "gsap";
import { PlusCircle, Key, ArrowRight, Loader2, ArrowLeft, Eye, EyeOff, Activity, ShieldCheck, Heart } from "lucide-react";
import { supabase } from "../utils/supabase";
import { API_URL } from "../utils/config";

const PatientPortal = () => {
  const [mode, setMode] = useState<null | "register" | "login">(null);
  const [loading, setLoading] = useState(false);
  const [velaId, setVelaId] = useState(""); 
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "",
    blood_group: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    allergies: "",
    existing_conditions: "",
  });

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode && formRef.current) {
      gsap.fromTo(formRef.current, 
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }
      );
    }
  }, [mode]);

  const validateRegister = () => {
    if (!form.name || !form.age || !form.gender || !form.phone || !form.email || !form.password || !form.confirmPassword) {
      toast.error("Please fill in all required fields.");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      toast.error("Please enter a valid email address.");
      return false;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return false;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match.");
      return false;
    }
    return true;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRegister()) return;
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            name: form.name,
            role: "patient"
          }
        }
      });

      if (authError) throw new Error(authError.message);

      const res = await axios.post(`${API_URL}/api/receptionist/register`, {
        name: form.name,
        age: form.age,
        gender: form.gender,
        blood_group: form.blood_group,
        allergies: form.allergies,
        existing_conditions: form.existing_conditions,
        emergency_contact: form.phone,
        language: "English",
        registered_by: "patient_self",
        email: form.email,
        phone: form.phone
      });

      const newVelaId = res.data.vela_id || res.data.patient?.vela_id;
      if (!newVelaId) throw new Error("No VELA ID returned from server.");

      localStorage.setItem("vela_auth", "true");
      localStorage.setItem("vela_role", "patient");
      localStorage.setItem("vela_vela_id", newVelaId);
      localStorage.setItem("vela_patient", JSON.stringify(res.data.patient));
      localStorage.setItem("vela_email", form.email);

      setVelaId(newVelaId);
      toast.success(`Welcome to Vela, ${form.name}!`);

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) {
      toast.error("Email and password are required.");
      return;
    }
    setLoading(true);

    // DEMO BYPASS
    if (loginForm.email === "patient@vela.health" && loginForm.password === "demo123") {
      const demoPatient = {
        vela_id: "VLA-DEMO-001",
        name: "Demo Patient",
        email: "patient@vela.health",
        age: 30,
        gender: "Male"
      };
      localStorage.setItem("vela_auth", "true");
      localStorage.setItem("vela_role", "patient");
      localStorage.setItem("vela_vela_id", demoPatient.vela_id);
      localStorage.setItem("vela_patient", JSON.stringify(demoPatient));
      localStorage.setItem("vela_email", loginForm.email);
      setLoading(false);
      toast.success("Identity Verified (Demo)");
      navigate("/patient-dashboard");
      return;
    }

    // Demo patient shortcut — seed if needed then log in
    const DEMO_EMAIL = "patient@vela.ai";
    const DEMO_PASS = "vela2025";

    try {
      // For demo patient, seed the account if it doesn't exist
      if (loginForm.email === DEMO_EMAIL && loginForm.password === DEMO_PASS) {
        await axios.post(`${API_URL}/api/demo/seed-patient`).catch(() => {});
      }

      // Try Supabase Auth first
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: loginForm.password
      });

      // If Supabase Auth fails, fall back to DB lookup (handles receptionist-registered patients + demo)
      if (authError) {
        const res = await axios.get(`${API_URL}/api/patient/by-email/${loginForm.email}`);
        if (!res.data.patient) {
          throw new Error("No account found with this email. Please register first.");
        }
        const patientData = res.data.patient;
        localStorage.setItem("vela_auth", "true");
        localStorage.setItem("vela_role", "patient");
        localStorage.setItem("vela_vela_id", patientData.vela_id);
        localStorage.setItem("vela_patient", JSON.stringify(patientData));
        localStorage.setItem("vela_email", loginForm.email);
        toast.success("Login successful!");
        navigate("/patient-dashboard");
        return;
      }

      const res = await axios.get(`${API_URL}/api/patient/by-email/${loginForm.email}`);
      const patientData = res.data.patient;
      if (!patientData) throw new Error("Patient record not found.");

      localStorage.setItem("vela_auth", "true");
      localStorage.setItem("vela_role", "patient");
      localStorage.setItem("vela_vela_id", patientData.vela_id);
      localStorage.setItem("vela_patient", JSON.stringify(patientData));
      localStorage.setItem("vela_email", loginForm.email);
      toast.success("Login successful!");
      navigate("/patient-dashboard");

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!loginForm.email) {
      toast.error("Please enter your email.");
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(loginForm.email, {
        redirectTo: "https://velahealth.in/portal"
      });
      if (error) throw new Error(error.message);
      toast.success("Reset link sent.");
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  };

  if (velaId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[#0F766E]/20 blur-[100px] pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-md p-12 bg-[#111] border border-white/5 rounded-[32px] shadow-2xl text-center backdrop-blur-3xl">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-8">
                <ShieldCheck className="text-emerald-400" size={40} />
            </div>
            <h1 className="text-4xl font-serif italic text-white mb-3">Identity Secured</h1>
            <p className="text-white/40 mb-10 font-light text-sm tracking-wide">Your secure digital health vault is now active.</p>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-10 text-left relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-3 font-mono font-bold">VELA_UNIVERSAL_ID</p>
                <div className="flex items-baseline gap-4">
                    <span className="text-4xl font-mono text-emerald-400 tracking-wider font-bold">{velaId}</span>
                </div>
                <p className="text-[10px] text-white/20 mt-4 leading-relaxed uppercase tracking-tighter italic">This ID is your unique key to any VELA enabled facility.</p>
                <button 
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(velaId);
                    toast.success("VELA ID copied!");
                  }}
                  className="mt-6 text-emerald-400/60 font-mono text-[10px] uppercase tracking-widest hover:text-white transition-colors border-none bg-transparent p-0 flex items-center gap-2"
                >
                  [ COPY_KEY_HEX ] <ArrowRight size={10} />
                </button>
            </div>

            <button 
                onClick={() => navigate("/patient-dashboard")}
                className="w-full py-5 bg-white hover:bg-emerald-500 hover:text-white text-black rounded-xl font-mono text-xs font-bold tracking-[0.2em] transition-all flex items-center justify-center gap-3 uppercase shadow-lg shadow-emerald-500/5"
            >
                Enter Dashboard <ArrowRight size={16} />
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center relative font-sans overflow-x-hidden">
      
      {/* Background Graphic */}
      <div className="absolute inset-0 z-0">
        <img src="/assets/login/patient.png" alt="" className="w-full h-full object-cover opacity-40 mix-blend-luminosity grayscale" />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/40 to-black"></div>
      </div>

      {/* HEADER */}
      <div className="text-center py-20 relative z-10 w-full">
        <img src="/vela-icon.png" alt="VELA" className="h-10 mx-auto mb-6 invert grayscale opacity-80" />
        <h1 className="text-[12px] font-bold text-white mb-2 font-mono tracking-[0.5em] uppercase">Vela Identity Service</h1>
        <p className="text-[10px] font-light text-white/30 uppercase tracking-[0.2em]">Patient Terminal // Node_Auth_01</p>
      </div>

      <div className="w-full max-w-7xl px-6 relative z-10 flex-1 flex items-center justify-center pb-20">
        {mode === null ? (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
            
            {/* NEW PATIENT CARD */}
            <div 
              onClick={() => setMode("register")}
              className="bg-[#111]/80 backdrop-blur-xl border border-white/5 rounded-[32px] p-12 text-center cursor-none hover:bg-white/10 hover:border-white/20 hover:-translate-y-2 transition-all duration-500 group flex flex-col items-center justify-between min-h-[400px]"
            >
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-blue-500/5 border border-blue-500/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                    <PlusCircle size={40} className="text-blue-400/60 group-hover:text-blue-400" strokeWidth={1} />
                </div>
                <h2 className="font-serif italic text-4xl text-white mb-4">New Profile</h2>
                <p className="text-sm font-light text-white/40 max-w-[240px] leading-relaxed uppercase tracking-widest text-[10px]">Initialize your digital health record on the VELA network.</p>
              </div>

              <button className="bg-white text-black text-[11px] font-bold py-4 px-10 rounded-full mt-10 hover:bg-blue-500 hover:text-white transition-all flex items-center gap-3 uppercase tracking-widest cursor-none">
                Register <ArrowRight size={14} />
              </button>
            </div>

            {/* EXISTING PATIENT CARD */}
            <div 
              onClick={() => setMode("login")}
              className="bg-[#111]/80 backdrop-blur-xl border border-white/5 rounded-[32px] p-12 text-center cursor-none hover:bg-white/10 hover:border-white/20 hover:-translate-y-2 transition-all duration-500 group flex flex-col items-center justify-between min-h-[400px]"
            >
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                    <Key size={40} className="text-emerald-400/60 group-hover:text-emerald-400" strokeWidth={1} />
                </div>
                <h2 className="font-serif italic text-4xl text-white mb-4">Existing Access</h2>
                <p className="text-sm font-light text-white/40 max-w-[240px] leading-relaxed uppercase tracking-widest text-[10px]">Securely sign in to view your records and medications.</p>
              </div>

              <button className="bg-white text-black text-[11px] font-bold py-4 px-10 rounded-full mt-10 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-3 uppercase tracking-widest cursor-none">
                Login <ArrowRight size={14} />
              </button>
            </div>

          </div>
        ) : mode === "login" ? (
          
          <div ref={formRef} className="w-full max-w-sm mx-auto relative opacity-0">
            <button 
              onClick={() => setMode(null)}
              className="text-white/30 hover:text-white flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors mb-10 cursor-none"
            >
              <ArrowLeft size={16} /> Back
            </button>
            
            <header className="mb-12">
               <h2 className="font-serif italic text-5xl text-white mb-4">Welcome Back</h2>
                <div className="h-px w-12 bg-emerald-500"></div>
            </header>
            
            <form onSubmit={handleLogin} className="flex flex-col gap-10">
                <div className="group">
                  <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-3 group-focus-within:text-emerald-400 transition-colors">CREDENTIAL_EMAIL</label>
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={e => setLoginForm({...loginForm, email: e.target.value})}
                    className="w-full border-b border-white/10 pb-4 bg-transparent text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder-white/5"
                    placeholder="user@network.id"
                  />
                </div>
                <div className="group">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] group-focus-within:text-emerald-400 transition-colors">SECURE_PASS</label>
                    <button type="button" onClick={handleForgotPassword} className="text-[9px] text-white/20 hover:text-white uppercase tracking-widest">Forgot?</button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={loginForm.password}
                      onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                      className="w-full border-b border-white/10 pb-4 bg-transparent text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors pr-10 placeholder-white/5"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-0 bottom-4 text-white/20 hover:text-emerald-400 transition-colors cursor-none">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-white hover:bg-emerald-500 hover:text-white text-black py-5 rounded-xl font-bold text-[11px] uppercase tracking-[0.3em] transition-all mt-6 flex items-center justify-center shadow-lg cursor-none"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : "INITIATE_VAULT_DECRYPT"}
                </button>
            </form>

            {/* Demo Credentials */}
            <div style={{ marginTop: 32, padding: '16px 20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
              <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: 'rgba(250,250,249,0.3)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 10 }}>Demo Credentials</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'rgba(250,250,249,0.5)' }}>Email: <strong style={{ color: '#FAFAF9' }}>patient@vela.ai</strong></span>
                <button type="button" onClick={() => { setLoginForm({ email: 'patient@vela.ai', password: 'vela2025' }); }} style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: '#22C55E', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Autofill</button>
              </div>
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'rgba(250,250,249,0.5)' }}>Pass: <strong style={{ color: '#FAFAF9' }}>vela2025</strong></div>
            </div>
          </div>

        ) : (
          
          <div ref={formRef} className="w-full max-w-xl mx-auto relative opacity-0">
            <button 
              onClick={() => setMode(null)}
              className="text-white/30 hover:text-white flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors mb-10 cursor-none"
            >
              <ArrowLeft size={16} /> Back
            </button>

            <header className="mb-12">
               <h2 className="font-serif italic text-5xl text-white mb-4">Create Identity</h2>
                <div className="h-px w-12 bg-blue-500"></div>
            </header>
            
            <form onSubmit={handleRegister} className="bg-[#111]/80 backdrop-blur-2xl border border-white/5 rounded-[40px] p-12 shadow-2xl">
              <div className="font-mono text-[10px] text-blue-400 tracking-[0.3em] mb-10 uppercase font-bold flex items-center gap-3">
                  <ShieldCheck size={14} /> System Registration Protocol
              </div>
              
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="group">
                    <label className="block text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mb-3 group-focus-within:text-blue-400 transition-colors">FULL_NAME *</label>
                    <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border-b border-white/10 pb-3 bg-transparent text-sm text-white focus:outline-none focus:border-blue-500 transition-colors" />
                  </div>
                  <div className="group">
                    <label className="block text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mb-3 group-focus-within:text-blue-400 transition-colors">AGE_VAL *</label>
                    <input type="number" required value={form.age} onChange={e => setForm({...form, age: e.target.value})} className="w-full border-b border-white/10 pb-3 bg-transparent text-sm text-white focus:outline-none focus:border-blue-500 transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="group">
                    <label className="block text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mb-3 group-focus-within:text-blue-400 transition-colors">GENDER *</label>
                    <select required value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className="w-full border-b border-white/10 pb-3 bg-transparent text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-none">
                      <option value="" className="bg-black">Select</option>
                      <option value="Male" className="bg-black">Male</option>
                      <option value="Female" className="bg-black">Female</option>
                      <option value="Other" className="bg-black">Other</option>
                    </select>
                  </div>
                  <div className="group">
                    <label className="block text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mb-3 group-focus-within:text-blue-400 transition-colors">BLOOD_GRP</label>
                    <select value={form.blood_group} onChange={e => setForm({...form, blood_group: e.target.value})} className="w-full border-b border-white/10 pb-3 bg-transparent text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-none">
                      <option value="" className="bg-black">Select</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg} className="bg-black">{bg}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="group">
                    <label className="block text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mb-3 group-focus-within:text-blue-400 transition-colors">CONTACT_TEL *</label>
                    <input type="tel" required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full border-b border-white/10 pb-3 bg-transparent text-sm text-white focus:outline-none focus:border-blue-500 transition-colors" />
                  </div>
                  <div className="group">
                    <label className="block text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mb-3 group-focus-within:text-blue-400 transition-colors">EMAIL_ADDR *</label>
                    <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full border-b border-white/10 pb-3 bg-transparent text-sm text-white focus:outline-none focus:border-blue-500 transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="group relative">
                    <label className="block text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mb-3 group-focus-within:text-blue-400 transition-colors">PASS_NEW *</label>
                    <input type={showPassword ? "text" : "password"} required value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full border-b border-white/10 pb-3 bg-transparent text-sm text-white focus:outline-none focus:border-blue-500 transition-colors pr-8" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-0 bottom-3 text-white/20 hover:text-blue-400 transition-colors cursor-none">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <div className="group relative">
                    <label className="block text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mb-3 group-focus-within:text-blue-400 transition-colors">PASS_CONFIRM *</label>
                    <input type={showConfirmPassword ? "text" : "password"} required value={form.confirmPassword} onChange={e => setForm({...form, confirmPassword: e.target.value})} className="w-full border-b border-white/10 pb-3 bg-transparent text-sm text-white focus:outline-none focus:border-blue-500 transition-colors pr-8" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-0 bottom-3 text-white/20 hover:text-blue-400 transition-colors cursor-none">
                      {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-10">
                   <div className="font-mono text-[10px] text-white/20 tracking-[0.3em] mb-8 uppercase font-bold">Additional Metadata</div>
                   <div className="space-y-8">
                      <div className="group">
                        <label className="block text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mb-3 group-focus-within:text-blue-400 transition-colors">ALLERGY_LOG</label>
                        <textarea rows={2} value={form.allergies} onChange={e => setForm({...form, allergies: e.target.value})} className="w-full border-b border-white/10 pb-2 bg-transparent text-sm text-white focus:outline-none focus:border-blue-500 resize-none placeholder-white/5" placeholder="None specified"></textarea>
                      </div>
                      <div className="group">
                        <label className="block text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mb-3 group-focus-within:text-blue-400 transition-colors">EXISTING_CONDITIONS_LOG</label>
                        <textarea rows={2} value={form.existing_conditions} onChange={e => setForm({...form, existing_conditions: e.target.value})} className="w-full border-b border-white/10 pb-2 bg-transparent text-sm text-white focus:outline-none focus:border-blue-500 resize-none placeholder-white/5" placeholder="None specified"></textarea>
                      </div>
                   </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-white hover:bg-blue-500 hover:text-white text-black py-5 rounded-2xl font-bold text-[11px] uppercase tracking-[0.3em] transition-all mt-10 flex items-center justify-center cursor-none"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : "GENERATE_SECURITY_IDENTITY"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="py-12 relative z-10 w-full flex justify-center opacity-20 hover:opacity-100 transition-opacity">
         <div className="flex items-center gap-8 font-mono text-[8px] uppercase tracking-widest text-white/60">
            <div className="flex items-center gap-2"><Activity size={10} /> Network Status: Stable</div>
            <div className="flex items-center gap-2"><ShieldCheck size={10} /> Encryption: AES-256-GCM</div>
            <div className="flex items-center gap-2"><Heart size={10} /> Health Node Active</div>
         </div>
      </div>

    </div>
  );
};
export default PatientPortal;