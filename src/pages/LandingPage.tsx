import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const heroLines = useRef<(HTMLDivElement | null)[]>([]);

  const [atlasState, setAtlasState] = useState<"idle" | "speaking" | "done">("idle");
  const [showText, setShowText] = useState(false);
  const [visibleWords, setVisibleWords] = useState(0);
  const orbRef = useRef<HTMLButtonElement>(null);

  const words = [
    "Hi", "Doctor.", "I'm", "Atlas.",
    "Which", "life", "are", "we",
    "saving", "today?"
  ];

  useEffect(() => {
    if (atlasState !== "speaking") {
      setVisibleWords(0);
      return;
    }
    
    const interval = setInterval(() => {
      setVisibleWords(prev => {
        if (prev >= words.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 200);
    
    return () => clearInterval(interval);
  }, [atlasState]);

  const handleOrbClick = async () => {
    if (atlasState !== "idle") return;

    setAtlasState("speaking");
    setShowText(true);

    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    const text = words.join(" ").replace(/Doctor\./, "Doctor.");
    let spoken = false;

    if (apiKey && apiKey.length > 10) {
      try {
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "xi-api-key": apiKey,
              "Accept": "audio/mpeg"
            },
            body: JSON.stringify({
              text,
              model_id: "eleven_turbo_v2",
              voice_settings: {
                stability: 0.4,
                similarity_boost: 0.8,
                style: 0.3,
                use_speaker_boost: true
              }
            })
          }
        );

        if (res.ok) {
          const reader = res.body?.getReader();
          const chunks: Uint8Array[] = [];
          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) chunks.push(value);
            }
          }
          const total = chunks.reduce((acc, c) => acc + c.length, 0);
          const merged = new Uint8Array(total);
          let offset = 0;
          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
          }
          const blob = new Blob([merged], { type: "audio/mpeg" });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.volume = 1.0;
          
          await new Promise<void>((resolve) => {
            audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
            audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
            audio.play().catch(() => resolve());
          });
          spoken = true;
        }
      } catch (e) {
        console.warn("ElevenLabs failed:", e);
      }
    }

    if (!spoken) {
      await new Promise<void>((resolve) => {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.85;
        u.pitch = 1.0;
        u.volume = 1.0;
        const voices = window.speechSynthesis.getVoices();
        const preferred =
          voices.find(v => v.name === "Google UK English Female") ||
          voices.find(v => v.name.includes("Google")) ||
          voices.find(v => v.lang.startsWith("en"));
        if (preferred) u.voice = preferred;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      });
    }

    setAtlasState("done");
    setTimeout(() => {
      setAtlasState("idle");
      setShowText(false);
    }, 3000);
  };

  useEffect(() => {
    // Lenis Smooth Scroll
    const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    const raf = (time: number) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);

    // Nav Background
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);

    // GSAP Animations
    gsap.fromTo(heroLines.current, 
      { y: 150, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 1.6, stagger: 0.15, ease: "power4.out", delay: 0.2 }
    );

    const revealEls = document.querySelectorAll('.reveal');
    revealEls.forEach((el) => {
      gsap.fromTo(el,
        { opacity: 0, y: 60 },
        {
          opacity: 1, y: 0, duration: 1.2, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 85%' }
        }
      );
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      lenis.destroy();
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <div className="bg-slate-50 text-slate-900 font-sans selection:bg-blue-600/30 overflow-x-hidden min-h-screen">
      <div className="noise-overlay pointer-events-none"></div>

      {/* Top Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 md:px-16 py-6 transition-all duration-500 ${scrolled ? 'bg-slate-50/90 backdrop-blur-2xl border-b border-slate-100 py-4' : 'bg-transparent'}`}>
        <div className="flex items-center gap-4">
          <img src="/vela-icon.png" alt="Vela" style={{ height: 36, width: "auto", objectFit: "contain" }} />
          <div className="w-[1px] h-6 bg-white/20 hidden md:block"></div>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-blue-600 hidden md:block">Clinical Intelligence</span>
        </div>
        <div className="hidden md:flex items-center gap-12">
          {['Capabilities', 'Architecture', 'Security'].map(link => (
            <a key={link} href={`#${link.toLowerCase()}`} className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500 hover:text-slate-900 transition-colors cursor-none">
              {link}
            </a>
          ))}
          <button type="button" onClick={() => navigate('/login')} className="bg-white text-black px-8 py-3 font-sans font-medium text-xs uppercase tracking-[0.15em] hover:bg-blue-600 transition-colors cursor-none focus:outline-none rounded-sm">
            Access System
          </button>
        </div>
        <div className="md:hidden">
          <span className="material-symbols-outlined text-slate-900 text-3xl">menu</span>
        </div>
      </nav>

      {/* Ultra-Premium Hero Section */}
      <section className="relative h-screen flex flex-col justify-center items-center text-center px-6 overflow-hidden">
        {/* Massive Background Orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-[#C8B89A]/20 via-[#0C0C0B]/0 to-transparent blur-[100px] opacity-70 animate-pulse pointer-events-none"></div>

        <div className="z-10 w-full max-w-6xl mt-12">
          <div className="inline-flex items-center gap-3 border border-slate-200 rounded-full px-5 py-2 mb-16 bg-slate-50 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-900/80">Vela OS 2.4 Active</span>
          </div>

          <div className="overflow-hidden mb-1 md:mb-2">
            <h1 ref={el => { heroLines.current[0] = el; }} className="font-serif italic text-7xl md:text-[160px] leading-[0.85] tracking-tight text-slate-900 drop-shadow-2xl">Every patient.</h1>
          </div>
          <div className="overflow-hidden mb-1 md:mb-2">
            <h1 ref={el => { heroLines.current[1] = el; }} className="font-serif italic text-7xl md:text-[160px] leading-[0.85] tracking-tight text-slate-900/80 drop-shadow-2xl">Every report.</h1>
          </div>
          <div className="overflow-hidden">
            <h1 ref={el => { heroLines.current[2] = el; }} className="font-serif italic text-7xl md:text-[160px] leading-[0.85] tracking-tight text-blue-600 drop-shadow-2xl">Every answer.</h1>
          </div>

          <div className="overflow-hidden mt-16 max-w-2xl mx-auto">
            <p ref={el => { heroLines.current[3] = el; }} className="font-sans text-xl md:text-2xl text-slate-500 leading-relaxed font-light">
              The unified clinical intelligence platform that transforms raw hospital data into immediate, actionable truth.
            </p>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 opacity-50">
          <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-slate-600">Explore Monolith</span>
          <div className="w-[1px] h-16 bg-gradient-to-b from-[#C8B89A] to-transparent"></div>
        </div>
      </section>

      {/* Stats Divider */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/10">
          <div className="flex-1 py-20 px-12 flex flex-col justify-center items-center text-center reveal">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-blue-600 mb-6">Inference Latency</span>
            <span className="font-serif italic text-7xl md:text-8xl">127<span className="text-4xl text-slate-400 ml-2">ms</span></span>
          </div>
          <div className="flex-1 py-20 px-12 flex flex-col justify-center items-center text-center reveal">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-blue-600 mb-6">Diagnostic Precision</span>
            <span className="font-serif italic text-7xl md:text-8xl">99.8<span className="text-4xl text-slate-400 ml-2">%</span></span>
          </div>
          <div className="flex-1 py-20 px-12 flex flex-col justify-center items-center text-center reveal">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-blue-600 mb-6">Data Architecture</span>
            <span className="font-serif italic text-7xl md:text-8xl">SOC-3</span>
          </div>
        </div>
      </section>

      {/* The Asymmetric Bento Layout */}
      <section id="capabilities" className="py-40 px-6 md:px-16 bg-[#F7F7F7] text-[#0C0C0B]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-24 text-center reveal max-w-4xl mx-auto">
            <h2 className="font-serif italic text-6xl md:text-8xl mb-8 leading-tight">The Clinical Monolith.</h2>
            <p className="font-sans text-xl md:text-2xl text-black/60 font-light leading-relaxed">Vela bridges the gap between fragmented legacy systems and immediate operational clarity, saving critical hours per shift.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 auto-rows-[340px]">
            {/* Massive Card 1 */}
            <div className="md:col-span-8 md:row-span-2 bg-white border border-black/5 p-12 md:p-16 flex flex-col justify-between relative overflow-hidden group reveal shadow-sm hover:shadow-xl transition-shadow duration-700">
              <div className="relative z-10 w-full md:w-2/3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-blue-600">Real-Time Synthesis</span>
                <h3 className="font-serif italic text-5xl md:text-6xl mt-6 leading-tight">10,000+ data points.<br/>One patient truth.</h3>
                <p className="font-sans text-black/50 text-lg mt-8 leading-relaxed">From blood work to pathology, Vela reads unstructured text and structures it into a unified chronological history instantly.</p>
              </div>
              
              {/* Fake UI Element */}
              <div className="absolute right-[-10%] bottom-[-5%] md:bottom-[-10%] w-[90%] md:w-[60%] bg-white shadow-2xl rounded-xl border border-black/10 overflow-hidden group-hover:-translate-y-4 group-hover:-translate-x-4 transition-transform duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)]">
                <div className="h-12 bg-[#F7F7F7] border-b border-black/5 flex items-center px-6">
                  <div className="flex gap-2.5"><div className="w-2.5 h-2.5 rounded-full bg-red-400"></div><div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div><div className="w-2.5 h-2.5 rounded-full bg-green-400"></div></div>
                </div>
                <div className="p-10">
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h4 className="font-sans font-medium text-xl">Rajesh Kumar</h4>
                      <p className="font-mono text-[11px] tracking-widest text-black/40 mt-2">ICU BED 4 • CRITICAL</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-3xl text-red-600">82/100</span>
                      <p className="font-mono text-[11px] tracking-widest text-black/40 mt-1">RISK SCORE</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-14 bg-red-50/50 border border-red-100 rounded-lg p-4 flex items-center justify-between">
                      <span className="font-mono text-[11px] tracking-wider text-red-900">POTASSIUM</span>
                      <span className="font-mono text-sm text-red-600 font-bold">2.8 mEq/L</span>
                    </div>
                    <div className="h-14 bg-slate-900/5 border border-black/5 rounded-lg p-4 flex items-center justify-between">
                      <span className="font-mono text-[11px] tracking-wider">CREATININE</span>
                      <span className="font-mono text-sm text-black">1.1 mg/dL</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Small Card 1 */}
            <div className="md:col-span-4 bg-slate-50 text-slate-900 p-12 flex flex-col justify-between reveal">
              <span className="material-symbols-outlined text-5xl text-blue-600">record_voice_over</span>
              <div>
                <h3 className="font-serif italic text-4xl mb-4 text-slate-900">Voice First.</h3>
                <p className="font-sans text-slate-500 text-base leading-relaxed">Dictate clinical notes instantly. Vela structures, tags, and stores them precisely where they belong.</p>
              </div>
            </div>

            {/* Small Card 2 */}
            <div className="md:col-span-4 bg-blue-600 p-12 flex flex-col justify-between reveal">
              <span className="material-symbols-outlined text-5xl text-[#0C0C0B]">emergency</span>
              <div>
                <h3 className="font-serif italic text-4xl mb-4 text-[#0C0C0B]">Zero Misses.</h3>
                <p className="font-sans text-black/70 text-base leading-relaxed">Critical anomalies are flagged autonomously across the entire hospital network the second lab results hit the server.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Meet Atlas Section */}
      <section className="py-48 bg-slate-50 px-6 text-center relative overflow-hidden">
        <style>{`
          @keyframes wordAppear {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulseRing {
            from { transform: scale(1); opacity: 0.6; }
            to { transform: scale(2.5); opacity: 0; }
          }
          @keyframes waveformBar {
            0%, 100% { height: 4px; }
            50% { height: 28px; }
          }
        `}</style>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#C8B89A]/10 via-[#0C0C0B] to-[#0C0C0B] opacity-50 pointer-events-none"></div>
        <div className="relative z-10 max-w-4xl mx-auto reveal mt-12">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-blue-600 mb-8 block">Meet Atlas</span>
          
          {showText ? (
            <div style={{
              fontSize: "clamp(24px, 4vw, 42px)",
              fontFamily: "'Instrument Serif', serif",
              color: "#FAFAF9",
              letterSpacing: "0.02em",
              lineHeight: 1.4,
              minHeight: 120,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "0.2em",
              alignItems: "center",
              marginBottom: 48
            }}>
              {words.slice(0, visibleWords).map((word, i) => (
                <span
                  key={i}
                  style={{
                    opacity: 1,
                    transform: "translateY(0)",
                    animation: "wordAppear 0.3s ease forwards",
                    display: "inline-block"
                  }}
                >
                  {word}
                </span>
              ))}
            </div>
          ) : (
            <>
              <h2 className="font-serif italic text-6xl md:text-9xl mb-12 text-slate-900">"Is Rajesh okay?"</h2>
              <p className="font-sans text-2xl text-slate-500 mb-20 max-w-2xl mx-auto leading-relaxed font-light">
                Atlas lives invisibly in the corner of your screen. Say its name and ask anything. The intelligence of a chief resident, instantly available.
              </p>
            </>
          )}

          <div className="relative inline-flex items-center justify-center group mb-2">
            <div className="absolute inset-0 bg-white/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
            
            {/* expanding ripple rings when speaking */}
            {atlasState === "speaking" && (
              <>
                {[0, 0.5, 1].map((delay, i) => (
                  <div key={i} style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: "1px solid rgba(200,184,154,0.4)",
                    animation: `pulseRing 1.5s infinite ${delay}s ease-out`
                  }} />
                ))}
              </>
            )}

            {/* Audio waveform bars when speaking */}
            {atlasState === "speaking" && (
              <div style={{ position: "absolute", top: "50%", left: "50%", pointerEvents: "none" }}>
                {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
                  <div key={deg} style={{
                    position: "absolute",
                    width: 3, height: 4,
                    background: "#C8B89A",
                    borderRadius: 2,
                    transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-88px)`,
                    animation: `waveformBar 0.8s infinite ${i * 0.1}s ease-in-out`
                  }} />
                ))}
              </div>
            )}

            <button 
              ref={orbRef}
              onClick={handleOrbClick}
              className="relative w-40 h-40 rounded-full flex items-center justify-center cursor-pointer transition-all duration-400 ease-[ease]"
              style={{
                background: atlasState === "speaking" ? "rgba(200,184,154,0.1)" : "rgba(255,255,255,0.05)",
                border: atlasState === "speaking" ? "1px solid #C8B89A" : "1px solid rgba(255,255,255,0.2)",
                boxShadow: atlasState === "speaking" 
                  ? "0 0 60px rgba(200,184,154,0.4), 0 0 120px rgba(200,184,154,0.15)"
                  : "none",
                transform: atlasState === "speaking" ? "scale(1.08)" : (atlasState === "idle" ? "scale(1)" : "scale(1)"),
                opacity: atlasState === "idle" ? 0.8 : 1
              }}
            >
              <span className="material-symbols-outlined text-6xl text-blue-600">mic</span>
            </button>
          </div>

          {/* HINT TEXT */}
          <div className="h-8">
            {atlasState === "idle" && (
              <p style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, color: "rgba(250,250,249,0.3)", letterSpacing: "0.12em", marginTop: 20, textAlign: "center" }}>
                CLICK TO MEET ATLAS
              </p>
            )}
            {atlasState === "speaking" && (
              <p style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, color: "#C8B89A", letterSpacing: "0.12em", marginTop: 20, textAlign: "center", animation: "pulse 1s infinite" }}>
                ATLAS IS SPEAKING
              </p>
            )}
            {atlasState === "done" && (
              <p style={{ fontFamily: "Geist Mono, monospace", fontSize: 11, color: "rgba(250,250,249,0.3)", letterSpacing: "0.12em", marginTop: 20, textAlign: "center" }}>
                PRESS SPACE TO TALK AFTER LOGIN
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Giant CTA */}
      <section className="py-48 bg-white text-[#0C0C0B] px-6 text-center relative">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-black/10 to-transparent"></div>
        <div className="max-w-5xl mx-auto reveal">
          <span className="material-symbols-outlined text-black/20 text-5xl mb-12 inline-block">ac_unit</span>
          <h2 className="font-serif italic text-7xl md:text-[130px] leading-[0.9] mb-16 tracking-tight">Step into the future.</h2>
          <button type="button" onClick={() => navigate('/login')} className="bg-slate-100 text-slate-900 px-16 py-6 font-sans uppercase tracking-[0.2em] text-sm hover:bg-blue-600 hover:text-white transition-colors duration-500 cursor-none rounded-sm focus:outline-none shadow-2xl">
            Launch Platform
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-100 pt-32 pb-12 px-8 md:px-16 text-slate-500">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-16 mb-24">
          <div className="md:col-span-2">
            <img src="/vela-icon.png" alt="Vela" style={{ height: 48, width: "auto", objectFit: "contain" }} className="mb-8" />
            <p className="font-sans text-base max-w-sm leading-relaxed font-light">The clinical intelligence layer for high-volume healthcare systems. Built with absolute precision.</p>
          </div>
          <div>
            <h4 className="font-mono text-[11px] uppercase tracking-[0.1em] text-slate-400 mb-8">Platform</h4>
            <ul className="space-y-5 text-sm font-sans">
              <li><a href="#" className="hover:text-slate-900 transition-colors cursor-none">Atlas Voice Engine</a></li>
              <li><a href="#" className="hover:text-slate-900 transition-colors cursor-none">Risk Telemetry</a></li>
              <li><a href="#" className="hover:text-slate-900 transition-colors cursor-none">Data Pipelines</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-mono text-[11px] uppercase tracking-[0.1em] text-slate-400 mb-8">System</h4>
            <ul className="space-y-5 text-sm font-sans">
              <li><a href="#" className="hover:text-slate-900 transition-colors cursor-none">SOC-3 Certification</a></li>
              <li><a href="#" className="hover:text-slate-900 transition-colors cursor-none">HIPAA Compliance</a></li>
              <li><a href="#" className="hover:text-slate-900 transition-colors cursor-none">API Documentation</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center pt-10 border-t border-slate-100">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">© 2026 Vela Medical Intelligence</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-blue-600 mt-6 md:mt-0 flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            System Nominal
          </span>
        </div>
      </footer>
    </div>
  );
}
