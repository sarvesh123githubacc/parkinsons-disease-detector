import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { useSSE } from '../hooks/useSSE'
import PipelineTracker from '../components/PipelineTracker'
import ReportCard from '../components/ReportCard'
import { getReport } from '../api/client'

export default function ReportPage() {
  const { sessionId } = useParams()
  const navigate      = useNavigate()
  const reportRef     = useRef(null)

  const { steps, report: sseReport, error, qualityFailed, isStreaming, startStream } = useSSE(sessionId)
  const [apiReport, setApiReport]   = useState(null)
  const [loadingApi, setLoadingApi] = useState(false)
  const [apiError, setApiError]     = useState(null)

  // On mount: try fetching existing report first, fall back to SSE
  useEffect(() => {
    if (!sessionId) return

    const tryFetchReport = async () => {
      setLoadingApi(true)
      try {
        const res = await getReport(sessionId)
        if (res.data) {
          setApiReport(res.data)
        }
      } catch {
        // Not ready yet — start SSE streaming
        startStream()
      } finally {
        setLoadingApi(false)
      }
    }
    tryFetchReport()
  }, [sessionId])

  // Scroll to report when ready
  const finalReport = apiReport ?? sseReport
  useEffect(() => {
    if (finalReport && reportRef.current) {
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200)
    }
  }, [finalReport])

  return (
    <div className="page">
      <div className="container" style={{ padding: '2rem 1.5rem' }}>
        {/* Back button */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}>
          <button className="btn btn-ghost" style={{ marginBottom: '1.5rem' }} onClick={() => navigate('/')}>
            <ArrowLeft size={15} /> Back to Analysis
          </button>
        </motion.div>

        <AnimatePresence mode="wait">

          {/* Loading API report */}
          {loadingApi && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '4rem 0', color: 'var(--text-muted)' }}>
              <Loader2 size={36} color="var(--accent-light)" style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: '0.9rem' }}>Loading your report…</p>
            </motion.div>
          )}

          {/* SSE streaming state */}
          {!loadingApi && !finalReport && !error && (
            <motion.div key="streaming" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.5fr)', gap: '2rem', alignItems: 'start' }}>
                <div className="card" style={{ padding: '2rem', position: 'sticky', top: '80px' }}>
                  <PipelineTracker steps={steps} />
                  {isStreaming && (
                    <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                      AI agents are working on your analysis…
                    </div>
                  )}
                </div>

                <div style={{ padding: '1rem 0' }}>
                  <div style={{
                    background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
                    borderRadius: 'var(--radius-lg)', padding: '2.5rem',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center',
                  }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: '50%',
                      background: 'rgba(99,102,241,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      animation: 'glow-pulse 2s ease-in-out infinite',
                    }}>
                      <Loader2 size={28} color="var(--accent-light)" style={{ animation: 'spin 1.5s linear infinite' }} />
                    </div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Analyzing Your Voice</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: 380 }}>
                      Our AI ensemble is extracting acoustic biomarkers and generating your diagnostic report. This typically takes 15–30 seconds.
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {['7 ML Models', '22 Biomarkers', 'Medical KB', 'LLM Report'].map((t) => (
                        <span key={t} className="badge badge-accent" style={{ fontSize: '0.72rem' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {!loadingApi && (error || qualityFailed) && !finalReport && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem 0', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={24} color="var(--color-critical)" />
              </div>
              <h2 style={{ fontSize: '1.1rem' }}>Analysis Failed</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {qualityFailed?.message ?? error ?? 'An unexpected error occurred.'}
              </p>
              <button className="btn btn-primary" onClick={() => navigate('/')}>
                <ArrowLeft size={15} /> Try Again
              </button>
            </motion.div>
          )}

          {/* Report ready */}
          {finalReport && (
            <motion.div key="report" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              ref={reportRef}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Parkinson's Screening Report</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 4 }}>
                  Session ID: {sessionId} · Generated by NeuroVoice AI
                </p>
              </div>
              <ReportCard report={finalReport} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
