import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AtlasState } from './AtlasCore';

interface AtlasOrbProps {
  state: AtlasState
  onStop: () => void
}

export default function AtlasOrb({ state, onStop }: AtlasOrbProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Define visual properties based on state
  const getConfig = () => {
    switch (state) {
      case 'sleeping':
        return {
          bg: 'radial-gradient(circle at 35% 35%, #2D2D2D, #0C0C0B)',
          border: '1px solid rgba(200,184,154,0.25)',
          shadow: '0 0 0 rgba(0,0,0,0)',
          scaleAnim: { scale: [1, 1.02, 1], transition: { duration: 4, repeat: Infinity, ease: "easeInOut" } }
        };
      case 'waking':
      case 'listening':
        return {
          bg: 'radial-gradient(circle at 35% 35%, #0C0C0B, #0C0C0B)',
          border: '1px solid var(--accent)',
          shadow: '0 0 40px rgba(200,184,154,0.15)',
          scaleAnim: { scale: [1, 1.05, 1], transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" } }
        };
      case 'processing':
        return {
          bg: 'radial-gradient(circle at 35% 35%, #0C0C0B, #0C0C0B)',
          border: '1px solid var(--text)',
          shadow: '0 0 20px rgba(255,255,255,0.05)',
          scaleAnim: { rotate: 360, transition: { duration: 8, repeat: Infinity, ease: "linear" } }
        };
      case 'speaking':
        return {
          bg: 'radial-gradient(circle at 35% 35%, #2D2D2D, #0C0C0B)',
          border: '1px solid var(--accent)',
          shadow: '0 0 30px rgba(200,184,154,0.1)',
          scaleAnim: { scale: [1, 1.1, 1], transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" } }
        };
      case 'error':
        return {
          bg: 'radial-gradient(circle at 35% 35%, #2D1A1A, #0C0C0B)',
          border: '1px solid var(--danger)',
          shadow: '0 0 20px rgba(139,32,32,0.2)',
          scaleAnim: { x: [0, -2, 2, -2, 0], transition: { duration: 0.4 } }
        };
      default:
        // Fallback same as sleeping
        return {
            bg: 'radial-gradient(circle at 35% 35%, #2D2D2D, #0C0C0B)',
            border: '1px solid rgba(200,184,154,0.25)',
            shadow: '0 0 0 rgba(0,0,0,0)',
            scaleAnim: { scale: 1 }
        };
    }
  };

  const config = getConfig();

  return (
    <div 
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onStop} // Allow stopping/interaction
    >
      {/* Tooltip */}
      <AnimatePresence>
        {state === 'sleeping' && isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute', top: -48, whiteSpace: 'nowrap',
              padding: '6px 12px', borderRadius: 4,
              color: 'var(--text-inverse)', fontSize: 13, fontFamily: "'Geist', sans-serif",
              background: 'var(--text)', border: '1px solid var(--border-dark)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)', pointerEvents: 'none'
            }}
          >
            Say "Hey Atlas" or press Space
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
            animate={config.scaleAnim as any} // Cast to any to avoid complex framer-motion type issues
            style={{
                width: 48, height: 48, borderRadius: '50%',
                background: config.bg,
                border: config.border,
                boxShadow: config.shadow,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
        >
            {/* Inner Icon */}
            {state === 'listening' ? (
                <div style={{ width: 8, height: 8, background: 'var(--accent)', borderRadius: '50%' }} />
            ) : state === 'speaking' ? (
                 <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                        <motion.div key={i}
                            animate={{ height: [4, 12, 4] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                            style={{ width: 2, background: 'var(--accent)', borderRadius: 1 }}
                        />
                    ))}
                 </div>
            ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={state === 'error' ? 'var(--danger)' : 'rgba(255,255,255,0.4)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
            )}
        </motion.div>
      </div>
    </div>
  );
}
