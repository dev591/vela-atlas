import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAtlas } from "../../hooks/useAtlas"
import AtlasOrb from "./AtlasOrb"
import AtlasAnswerCard from "./AtlasAnswerCard"

interface Props {
  currentPatientId?: string
  userRole?: string | null
}

export default function Atlas({ currentPatientId, userRole }: Props) {
  const navigate = useNavigate()
  const { state, question, answer, showAnswer, errorMsg, setShowAnswer, stop, ask } = useAtlas(currentPatientId, userRole)
  const [query, setQuery] = useState("")

  useEffect(() => {
    const handler = (e: any) => {
      navigate(e.detail.path)
    }
    window.addEventListener("atlas_navigate", handler)
    return () => window.removeEventListener("atlas_navigate", handler)
  }, [navigate])

  return (
    <div style={{ position: "fixed", bottom: 32, right: 32, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 16 }}>
      {showAnswer && (
        <AtlasAnswerCard
          question={question}
          answer={answer}
          onClose={() => setShowAnswer(false)}
        />
      )}
      <AtlasOrb state={state} onStop={() => stop()} />

      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4, alignSelf: 'stretch' }}>
        Type message if voice fails (or say hey atlas).
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, width: 320 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { ask && ask(query); setQuery('') } }}
          placeholder="Ask Atlas (type if voice fails)"
          style={{ flex: 1, borderRadius: 8, border: '1px solid var(--border)', padding: '8px 10px', background: 'var(--bg)', color: 'var(--text-primary)' }}
        />
        <button
          type="button"
          onClick={() => { if (query.trim()) { ask && ask(query.trim()); setQuery('') } }}
          style={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--accent)', color: '#fff', padding: '8px 12px', cursor: 'pointer' }}
        >
          Send
        </button>
      </div>

      {errorMsg && (
        <div style={{
          background: "var(--danger-light)",
          border: "1px solid var(--danger-border)",
          borderRadius: 8,
          padding: "10px 14px",
          color: "var(--danger)",
          fontFamily: "'Geist', sans-serif",
          fontSize: 13,
          whiteSpace: "nowrap"
        }}>
          {errorMsg}
        </div>
      )}
    </div>
  )
}
