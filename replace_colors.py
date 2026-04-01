import os
import re

def update_file(path, replacements):
    with open(path, 'r') as f:
        content = f.read()
    
    for old, new in replacements:
        content = content.replace(old, new)
        
    with open(path, 'w') as f:
        f.write(content)

# PatientPortal.tsx
update_file('src/pages/PatientPortal.tsx', [
    ('bg-[#050505]', 'bg-[#F8FAFC]'),
    ('text-[var(--cream)]', 'text-slate-900'),
    ('bg-[#0a0a0a]/80', 'bg-white/80'),
    ('bg-[#0a0a0a]/60', 'bg-white/60'),
    ('bg-[#0a0a0a]/95', 'bg-white/95'),
    ('bg-[#0a0a0a]', 'bg-white'),
    ('border-white/10', 'border-slate-200'),
    ('border-white/5', 'border-slate-100'),
    ('text-white/60', 'text-slate-500'),
    ('text-white/40', 'text-slate-500'),
    ('text-white/30', 'text-slate-400'),
    ('text-white/20', 'text-slate-400'),
    ('text-white', 'text-slate-900'),
    ('bg-white/5', 'bg-slate-50'),
    ('placeholder:text-white/20', 'placeholder:text-slate-400'),
    ('orb-glow', 'orb-glow-light'),
    ('glass-orb', 'glass-orb-light'),
    ('border-emerald-500/30', 'border-emerald-500/50'),
    ('bg-emerald-500/10', 'bg-emerald-50'),
    ('var(--med-blue)', '#2563EB'),
    ('hover:bg-[#1a3b5c]', 'hover:bg-blue-700'),
    ('bg-[#0a1014]', 'bg-white'),
    ('HeroCanvas', 'div'), # Just to mock it out or let's keep it but it might be dark. Keep HeroCanvas.
    ('<HeroCanvas />', '{/* <HeroCanvas /> */}'), # Hide dark canvas for clean look
])

# Login.tsx
update_file('src/pages/Login.tsx', [
    ('bg-[#0C0C0B]', 'bg-[#F8FAFC]'),
    ('text-[#F7F7F7]', 'text-slate-900'),
    ('text-[#C8B89A]', 'text-blue-600'),
    ('bg-[#C8B89A]', 'bg-blue-600'),
    ('border-[#C8B89A]', 'border-blue-600'),
    ('from-[#C8B89A]', 'from-blue-600'),
    ('text-white/60', 'text-slate-500'),
    ('text-white/50', 'text-slate-500'),
    ('text-white/40', 'text-slate-500'),
    ('text-white/30', 'text-slate-400'),
    ('text-white/20', 'text-slate-400'),
    ('text-white/10', 'text-slate-200'),
    ('text-white', 'text-slate-900'),
    ('text-[#FAFAF9]', 'text-slate-900'),
    ('border-white/20', 'border-slate-300'),
    ('border-white/10', 'border-slate-200'),
    ('bg-white/5', 'bg-white'),
    ('bg-white/10', 'bg-slate-50'),
    ('bg-white/20', 'bg-slate-300'),
    ('bg-transparent', 'bg-transparent'),
    ('from-[#1a1c1c]', 'from-blue-600'),
    ('to-[#000000]', 'to-blue-700'),
    ('placeholder-white/20', 'placeholder-slate-400'),
    ('objectFit: "contain"', 'objectFit: "contain", filter: "brightness(0.2)"'),
])

# index.css
update_file('src/index.css', [
    ('var(--bg), #1A1A1A', 'var(--bg, #F8FAFC)'),
    ('var(--text), #0C0C0B', 'var(--text, #0F172A)'),
    ('background: #1A1A1A;', 'background: #2563EB;'),
    ('rgba(255, 255, 255, 0.05)', 'rgba(0, 0, 0, 0.05)'),
    ('rgba(200, 184, 154, 0.15)', 'rgba(37, 99, 235, 0.1)'),
    ('rgba(200, 184, 154, 0.4)', 'rgba(37, 99, 235, 0.2)'),
])

print("Replacements complete.")
