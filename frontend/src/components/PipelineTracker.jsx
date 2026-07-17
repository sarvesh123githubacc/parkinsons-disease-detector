import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, Cpu, BarChart2, BookOpen, Database, FileText,
  CheckCircle2, XCircle, Loader2, Clock, AlertTriangle,
} from 'lucide-react'

const ICONS = {
  audio_validator:    ShieldCheck,
  feature_extractor:  Cpu,
  ml_ensemble:        BarChart2,
  result_interpreter: BookOpen,
  knowledge_retriever:Database,
  report_generator:   FileText,
}

const STATUS_COLORS = {
  pending: 'var(--text-muted)',
  running: 'var(--accent-light)',
  done:    'var(--color-safe)',
  error:   'var(--color-critical)',
}

function StepIcon({ id, status }) {
  const Icon = ICONS[id] || Cpu
  const color = STATUS_COLORS[status] ?? 'var(--text-muted)'
  return (
    <div style={{
      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: status === 'pending'
        ? 'rgba(255,255,255,0.04)'
        : status === 'running'
          ? 'rgba(99,102,241,0.15)'
          : status === 'done'
            ? 'rgba(34,211,238,0.1)'
            : 'rgba(239,68,68,0.1)',
      border: `1px solid ${
        status === 'pending' ? 'var(--border)' :
        status === 'running' ? 'rgba(99,102,241,0.4)' :
        status === 'done'    ? 'rgba(34,211,238,0.3)' :
                               'rgba(239,68,68,0.3)'
      }`,
      transition: 'all 0.3s ease',
      position: 'relative',
    }}>
      {status === 'running' ? (
        <Loader2 size={20} color={color} style={{ animation: 'spin 1s linear infinite' }} />
      ) : status === 'done' ? (
        <CheckCircle2 size={20} color={color} />
      ) : status === 'error' ? (
        <XCircle size={20} color={color} />
      ) : (
        <Icon size={20} color={color} />
      )}
    </div>
  )
}

function ConnectorLine({ done }) {
  return (
    <div style={{
      width: 2, height: 32, marginLeft: 21, flexShrink: 0,
      background: done ? 'var(--color-safe)' : 'var(--border)',
      transition: 'background 0.4s ease',
      borderRadius: '1px',
    }} />
  )
}

export default function PipelineTracker({ steps }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Analysis Pipeline</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
          AI agents processing your voice sample…
        </p>
      </div>

      {steps.map((step, idx) => (
        <div key={step.id}>
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.08, duration: 0.35 }}
            style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}
          >
            <StepIcon id={step.id} status={step.status} />

            <div style={{ flex: 1, paddingBottom: '0.25rem' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                marginTop: '0.625rem',
              }}>
                <span style={{
                  fontWeight: 600, fontSize: '0.875rem',
                  color: step.status === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)',
                  transition: 'color 0.3s',
                }}>
                  {step.label}
                </span>
                {step.status === 'running' && (
                  <motion.span
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ fontSize: '0.7rem', color: 'var(--accent-light)', fontWeight: 500 }}
                  >
                    Processing…
                  </motion.span>
                )}
                {step.duration != null && step.status === 'done' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <Clock size={10} /> {step.duration.toFixed(1)}s
                  </span>
                )}
              </div>

              <AnimatePresence>
                {step.message && (step.status === 'done' || step.status === 'error') && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <p style={{
                      fontSize: '0.75rem', marginTop: '0.25rem',
                      color: step.status === 'error' ? 'var(--color-critical)' : 'var(--text-muted)',
                      lineHeight: 1.5,
                    }}>
                      {step.status === 'error' && <AlertTriangle size={11} style={{ marginRight: 4, display: 'inline' }} />}
                      {step.message}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {idx < steps.length - 1 && <ConnectorLine done={step.status === 'done'} />}
        </div>
      ))}
    </div>
  )
}
