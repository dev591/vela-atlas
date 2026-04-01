import os
import glob
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content

    # 1. Global safe replacements
    replacements = {
        'bg-[#0C0C0B]': 'bg-slate-50',
        'bg-[#050505]': 'bg-slate-50',
        'bg-[#0a0a0a]': 'bg-white',
        'bg-[#1A1A1A]': 'bg-white',
        'text-[#F7F7F7]': 'text-slate-900',
        'text-[#FAFAF9]': 'text-slate-900',
        'text-[var(--cream)]': 'text-slate-900',
        
        # Accents
        'text-[#C8B89A]': 'text-blue-600',
        'bg-[#C8B89A]': 'bg-blue-600',
        'border-[#C8B89A]': 'border-blue-600',
        
        # Borders and alphas
        'border-white/10': 'border-slate-200',
        'border-white/20': 'border-slate-300',
        'border-white/5': 'border-slate-100',
        
        'bg-white/5': 'bg-slate-50',
        'bg-white/10': 'bg-slate-100',
        
        'text-white/60': 'text-slate-500',
        'text-white/50': 'text-slate-500',
        'text-white/40': 'text-slate-500',
        'text-white/30': 'text-slate-400',
        'text-white/20': 'text-slate-400',
        'text-white/10': 'text-slate-300',

        # Specific background alpha darks
        'bg-[#0a0a0a]/60': 'bg-white/60',
        'bg-[#0a0a0a]/80': 'bg-white/80',
        'bg-[#0a0a0a]/90': 'bg-white/90',
        'bg-[#0a0a0a]/95': 'bg-white/95',
        'bg-[#0a0a0a]/40': 'bg-white/40',
        
        'bg-black/40': 'bg-slate-200/40',
        'bg-black': 'bg-slate-900',
    }

    for old, new in replacements.items():
        content = content.replace(old, new)
        
    # 2. Fix main root text colors (where a dark background was providing contrast to global text-white)
    # If we see `bg-slate-50 text-white`, it's bad. Replace with `bg-slate-50 text-slate-900`.
    content = re.sub(r'(bg-slate-50\s+[^"\'`]*?)text-white', r'\1text-slate-900', content)
    content = re.sub(r'(bg-slate-100\s+[^"\'`]*?)text-white', r'\1text-slate-900', content)
    content = re.sub(r'(bg-white\s+[^"\'`]*?)text-white', r'\1text-slate-900', content)
    
    # 3. Handle HeroCanvas references by hiding them so they dont clash
    content = content.replace('<HeroCanvas />', '{/* <HeroCanvas /> */}')

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")

# Process all tsx files
for directory in ['src/pages', 'src/components']:
    for root, dirs, files in os.walk(os.path.join('/Users/devchalana135/Downloads/vela', directory)):
        for file in files:
            if file.endswith('.tsx'):
                process_file(os.path.join(root, file))

print("Global replacement complete.")
