import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Shield, BarChart2, Cpu, ArrowRight, Activity } from 'lucide-react'
import AudioUploader from '../components/AudioUploader'
import PipelineTracker from '../components/PipelineTracker'
import { useAnalysis } from '../hooks/useAnalysis'
import { useSSE } from '../hooks/useSSE'

/* ─── Animated neural SVG background ─── */
function NeuralBackground() {
  const nodes = [
    { cx: 80,  cy: 60  }, { cx: 240, cy: 40  }, { cx: 160, cy: 120 },
    { cx: 320, cy: 100 }, { cx: 400, cy: 50  }, { cx: 60,  cy: 180 },
    { cx: 200, cy: 200 }, { cx: 360, cy: 180 }, { cx: 480, cy: 140 },
    { cx: 130, cy: 280 }, { cx: 290, cy: 260 }, { cx: 440, cy: 240 },
  ]
  const edges = [
    [0,2],[1,2],[2,3],[3,4],[2,6],[5,6],[6,7],[7,8],[6,9],[9,10],[10,11],
    [0,5],[3,7],[4,8],[1,3],[5,9],
  ]
  return (
    <svg
      viewBox="0 0 560 320"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.25, pointerEvents: 'none' }}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="nodeglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#6366F1" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
        </radialGradient>
      </defs>
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].cx} y1={nodes[a].cy}
          x2={nodes[b].cx} y2={nodes[b].cy}
          stroke="url(#nodeglow)" strokeWidth="0.8" strokeOpacity="0.5"
        />
      ))}
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.cx} cy={n.cy} r="4"
          fill="#6366F1"
          opacity="0.7"
          style={{ animation: `pulse ${1.5 + (i % 4) * 0.3}s ease-in-out ${(i * 0.2) % 1.5}s infinite` }}
        />
      ))}
    </svg>
  )
}

/* ─── Waveform SVG decoration ─── */
function WaveformSVG() {
  const points = Array.from({ length: 60 }, (_, i) => {
    const x = (i / 59) * 100
    const y = 50 + Math.sin(i * 0.4) * (15 + Math.sin(i * 0.2) * 10)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none"
      style={{ width: '100%', height: 60, opacity: 0.3 }}>
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="0.8" />
    </svg>
  )
}

const FEATURE_PILLS = [
  { icon: Cpu,       text: '7 ML Models'       },
  { icon: BarChart2, text: '22 Voice Biomarkers'},
  { icon: Zap,       text: '~95% Accuracy'      },
  { icon: Shield,    text: 'Privacy First'      },
]

const PROCESS_STEPS = [
  { n: '01', title: 'Upload Audio', desc: 'Provide a 5–30 second voice sample (sustained vowel "ahh" or continuous speech)' },
  { n: '02', title: 'AI Analysis', desc: '7 specialized ML models extract 22 acoustic biomarkers and vote on the result' },
  { n: '03', title: 'Full Report', desc: 'Receive a detailed clinical-grade report with confidence scores and next steps' },
]

export default function UploadPage() {
  const navigate  = useNavigate()
  const { sessionId, uploading, uploadProgress, uploadError, upload } = useAnalysis()
  const { steps, report, error, qualityFailed, isStreaming, startStream, reset } = useSSE(sessionId)
  const reportRef = useRef(null)
  const [phase, setPhase] = useState('upload') // upload | streaming | done

  // After upload succeeds → start SSE
  useEffect(() => {
    if (sessionId && phase === 'upload') {
      setPhase('streaming')
      startStream()
    }
  }, [sessionId])

  // When report arrives → navigate
  useEffect(() => {
    if (report) {
      setTimeout(() => navigate(`/report/${sessionId}`), 600)
    }
  }, [report])

  const handleUpload = async (file) => {
    const id = await upload(file)
    if (!id) return
    // sessionId set in hook, useEffect will fire
  }

  const handleRetry = () => {
    reset()
    setPhase('upload')
  }

  return (
    <div className="page">
      {/* ─── Hero ─── */}
      <section style={{
        position: 'relative', overflow: 'hidden', minHeight: '520px',
        background: 'linear-gradient(160deg, #0A0F1E 0%, #0F1832 50%, #0A0F1E 100%)',
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        {/* Gradient blobs */}
        <div style={{ position: 'absolute', top: '-80px', left: '-80px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-60px', right: '-60px', width: '350px', height: '350px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <NeuralBackground />

        <div className="container" style={{ position: 'relative', zIndex: 1, padding: '3rem 1.5rem' }}>
          <div style={{ maxWidth: 640 }}>
            {/* Eyebrow */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <span className="badge badge-accent" style={{ marginBottom: '1.25rem', display: 'inline-flex' }}>
                <Activity size={12} /> AI-Powered Neurological Screening
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', fontWeight: 800, lineHeight: 1.15, marginBottom: '1rem' }}>
              Voice Analysis for{' '}
              <span style={{ background: 'linear-gradient(135deg, #6366F1, #C084FC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Parkinson's
              </span>{' '}
              Screening
            </motion.h1>

            {/* Subtitle */}
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1.75rem' }}>
              Upload a short voice recording and receive an AI-generated diagnostic report powered by an ensemble of 7 specialized machine learning models analyzing 22 acoustic biomarkers.
            </motion.p>

            {/* Pill features */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
              {FEATURE_PILLS.map(({ icon: Icon, text }) => (
                <div key={text} style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.35rem 0.875rem', borderRadius: '999px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '0.8rem', color: 'var(--text-secondary)',
                }}>
                  <Icon size={13} color="var(--accent-light)" />
                  {text}
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Main content ─── */}
      <section className="section">
        <div className="container" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.9fr)', gap: '2rem', alignItems: 'start' }}>

          {/* LEFT: Uploader or Pipeline */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
            <div className="card" style={{ padding: '2rem' }}>
              <AnimatePresence mode="wait">
                {phase === 'upload' ? (
                  <motion.div key="uploader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.375rem' }}>
                      Upload Voice Sample
                    </h2>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                      Speak a sustained "ahh" vowel for 5–10 seconds into a quiet microphone
                    </p>
                    <AudioUploader
                      uploading={uploading}
                      uploadProgress={uploadProgress}
                      uploadError={uploadError}
                      qualityFailed={qualityFailed}
                      onUpload={handleUpload}
                    />
                  </motion.div>
                ) : (
                  <motion.div key="tracker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <PipelineTracker steps={steps} />

                    {/* Error state */}
                    <AnimatePresence>
                      {(error || qualityFailed) && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          style={{ marginTop: '1.5rem' }}>
                          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleRetry}>
                            Try Again with Different Recording
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* RIGHT: How it works */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>How it works</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {PROCESS_STEPS.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '10px', flexShrink: 0,
                    background: 'rgba(99,102,241,0.15)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-light)',
                  }}>
                    {s.n}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>{s.title}</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Waveform decoration */}
            <div style={{ marginTop: '2rem', padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <WaveformSVG />
              <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Sample acoustic waveform — 22 features extracted per recording
              </p>
            </div>

            {/* Disclaimer */}
            <p style={{ marginTop: '1.5rem', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.6, padding: '0.875rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Research Use Only.</strong>{' '}
              This tool is designed for research and educational purposes. It is not FDA-approved and should not replace professional medical evaluation. All data processed in this session is not stored permanently.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
