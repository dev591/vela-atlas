import os
import glob
import re

def fix_white_text(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
        
    original = content

    # 1. Broadly replace white text with dark slate text
    replacements = {
        'text-white': 'text-slate-900',
        'text-white/90': 'text-slate-800',
        'text-white/80': 'text-slate-700',
        'text-white/70': 'text-slate-600',
        'text-white/60': 'text-slate-500',
        'text-white/50': 'text-slate-500',
        'text-white/40': 'text-slate-400',
        'text-white/30': 'text-slate-400',
        'text-white/20': 'text-slate-300',
        'text-white/10': 'text-slate-200',
        'placeholder-white/20': 'placeholder-slate-400',
        'border-white/30': 'border-slate-300',
        'border-white': 'border-slate-300',
        'focus:border-white': 'focus:border-blue-500',
        'hover:text-white': 'hover:text-slate-900',
        'hover:border-white/40': 'hover:border-slate-400',
    }
    
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    # 2. Restore text-white for buttons / dark backgrounds specifically
    # Example: "bg-blue-600 hover:bg-blue-700 text-slate-900" -> "... text-white"
    def restore_white(match):
        return match.group(0).replace('text-slate-900', 'text-white')

    # bg-blue-*** followed by text-slate-***
    content = re.sub(r'bg-(?:blue|red|emerald|slate)-(?:600|700|800|900|500)[^"\'`]*?text-slate-90[0-9]', restore_white, content)
    # text-slate-*** followed by bg-blue-***
    content = re.sub(r'text-slate-90[0-9][^"\'`]*?bg-(?:blue|red|emerald|slate)-(?:600|700|800|900|500)', restore_white, content)

    # Some hardcoded checks
    content = content.replace('bg-transparent border-b border-slate-300 rounded-none px-2 py-3 font-sans text-slate-900', 'bg-transparent border-b border-slate-300 rounded-none px-2 py-3 font-sans text-slate-900')


    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed white text in {filepath}")

for directory in ['src/pages', 'src/components']:
    for root, dirs, files in os.walk(os.path.join('/Users/devchalana135/Downloads/vela', directory)):
        for file in files:
            if file.endswith('.tsx'):
                fix_white_text(os.path.join(root, file))

print("Pass 2 complete.")
