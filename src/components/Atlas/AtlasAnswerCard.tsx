import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AtlasAnswerCardProps {
  question: string;
  answer: string;
  onClose: () => void;
}

export default function AtlasAnswerCard({ question, answer, onClose }: AtlasAnswerCardProps) {
  const [timeLeft, setTimeLeft] = useState(12);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const timestamp = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 10, opacity: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          bottom: 80,
          right: 0,
          width: 340,
          borderRadius: 16,
          background: '#0D1524',
          border: '1px solid rgba(59,130,246,0.25)',
          padding: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          zIndex: 10000
        }}
      >
        {/* Top Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6' }}
            />
            <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: '#3B82F6', letterSpacing: '0.1em' }}>ATLAS</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(250,250,249,0.4)', padding: 0, lineHeight: 1 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Question */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontFamily: 'Geist, sans-serif', fontSize: 11, color: 'rgba(250,250,249,0.4)', marginBottom: 4 }}>You asked:</p>
          <p style={{ fontFamily: 'Geist, sans-serif', fontSize: 13, color: 'rgba(250,250,249,0.65)', fontStyle: 'italic', lineHeight: 1.5 }}>"{question}"</p>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '12px 0' }} />

        {/* Answer */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <p style={{
            fontFamily: 'Geist, sans-serif',
            fontSize: 14,
            color: '#FAFAF9',
            lineHeight: 1.7,
            display: !expanded ? '-webkit-box' : 'block',
            WebkitLineClamp: !expanded ? 5 : undefined,
            WebkitBoxOrient: !expanded ? 'vertical' : undefined,
            overflow: !expanded ? 'hidden' : 'visible'
          } as React.CSSProperties}>
            {answer}
          </p>
          {!expanded && answer.length > 200 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              style={{ fontFamily: 'Geist, sans-serif', fontSize: 12, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginTop: 4 }}
            >
              Show more
            </button>
          )}
        </div>

        {/* Disclaimer */}
        <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, marginBottom: 12 }}>
          <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, color: 'rgba(250,250,249,0.3)', letterSpacing: '0.05em' }}>
            AI-generated. Verify with source document.
          </p>
        </div>

        {/* Bottom Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'rgba(250,250,249,0.3)' }}>{timestamp}</span>
          <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'rgba(250,250,249,0.3)' }}>Auto-close in {timeLeft}s</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
