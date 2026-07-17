import { motion } from 'framer-motion'
import { AlertTriangle, ShieldCheck, TrendingUp, Activity, ArrowRight, Printer, Share2 } from 'lucide-react'
import ConfidenceGauge from './ConfidenceGauge'
import ModelTable from './ModelTable'
import FeatureChart from './FeatureChart'
import KnowledgePanel from './KnowledgePanel'

const TIER_CONFIG = {
  low:      { label: 'Low Risk — Likely Healthy',              color: 'var(--color-safe)',     bg: 'rgba(34,211,238,0.07)',     border: 'rgba(34,211,238,0.2)',  Icon: ShieldCheck },
  moderate: { label: 'Moderate Risk — Further Evaluation Advised', color: 'var(--color-moderate)', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.25)', Icon: Activity },
  high:     { label: 'High Risk — Specialist Consultation Recommended', color: 'var(--color-high)', bg: 'rgba(249,115,22,0.07)', border: 'rgba(249,115,22,0.25)', Icon: TrendingUp },
  critical: { label: 'Critical Risk — Immediate Medical Attention Advised', color: 'var(--color-critical)', bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.3)', Icon: AlertTriangle },
}

function Section({ title, children, style = {} }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 'var(--radius-lg)', padding: '1.5rem',
      ...style,
    }}>
      {title && (
        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}

export default function ReportCard({ report, onPrint }) {
  if (!report) return null

  const tier    = (report.risk_tier ?? report.tier ?? 'low').toLowerCase()
  const cfg     = TIER_CONFIG[tier] ?? TIER_CONFIG.low
  const TierIcon = cfg.Icon

  const confidence   = report.confidence_pct ? report.confidence_pct / 100 : (report.confidence_score ?? report.confidence ?? 0)
  
  // Extract text summary to avoid passing raw object to React which crashes the UI
  const interpretation = typeof report.interpretation === 'string'
    ? report.interpretation
    : (report.plain_summary ?? report.interpretation?.summary ?? report.summary ?? '')

  const nextSteps    = report.next_steps ?? report.recommendations ?? []

  // Ensure models is always an array of objects
  const rawModels    = report.model_results ?? report.models ?? []
  let models = []
  if (Array.isArray(rawModels)) {
    models = rawModels
  } else if (rawModels && typeof rawModels === 'object') {
    models = Object.entries(rawModels).map(([key, val]) => ({
      model_id: key,
      ...val
    }))
  }

  const features     = report.interpretation?.anomalous_features ?? report.anomalous_features ?? report.features ?? []
  const sessionId    = report.session_id ?? ''
  const parkinsonsInfo = report.parkinsons_info ?? null

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'NeuroVoice Report', text: `Risk: ${tier} | Confidence: ${Math.round(confidence * 100)}%`, url: window.location.href })
    } else {
      await navigator.clipboard.writeText(window.location.href)
      alert('Report URL copied to clipboard.')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
    >
      {/* ── Verdict Banner ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '1rem',
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '12px',
            background: `${cfg.color}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${cfg.color}40`,
          }}>
            <TierIcon size={24} color={cfg.color} />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Analysis Result
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: cfg.color, marginTop: 2 }}>
              {cfg.label}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" style={{ padding: '0.5rem 0.875rem', fontSize: '0.8rem' }} onClick={handleShare}>
            <Share2 size={14} /> Share
          </button>
          <button className="btn btn-secondary" style={{ padding: '0.5rem 0.875rem', fontSize: '0.8rem' }} onClick={() => window.print()}>
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* ── Top Grid: Gauge + Models ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1.25rem', alignItems: 'start' }}>
        <Section style={{ display: 'flex', justifyContent: 'center', minWidth: 240 }}>
          <ConfidenceGauge confidence={Math.round(confidence * 100)} tier={tier} />
        </Section>
        <Section title="Model Agreement">
          <ModelTable models={models} />
        </Section>
      </div>

      {/* ── Interpretation ── */}
      {interpretation && (
        <Section title="AI Interpretation">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {interpretation}
          </p>
        </Section>
      )}

      {/* ── Feature Chart ── */}
      {features.length > 0 && (
        <Section title="Voice Feature Analysis">
          <FeatureChart features={features} />
        </Section>
      )}

      {/* ── Next Steps ── */}
      {nextSteps.length > 0 && (
        <Section title="Recommended Next Steps">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {nextSteps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                  padding: '0.875rem', borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-light)',
                }}>
                  {i + 1}
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {typeof step === 'string' ? step : step.description ?? step.step ?? JSON.stringify(step)}
                </p>
              </motion.div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Knowledge Panel ── */}
      <Section title="Medical Context">
        <KnowledgePanel features={features} interpretation={interpretation} parkinsonsInfo={parkinsonsInfo} />
      </Section>

      {/* ── Disclaimer ── */}
      <div style={{
        padding: '1rem', borderRadius: 'var(--radius-md)',
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
        fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.6, textAlign: 'center',
      }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Medical Disclaimer:</strong>{' '}
        This AI-generated analysis is intended for educational and research purposes only. It does not constitute medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional before making any medical decisions. Session ID: {sessionId}
      </div>
    </motion.div>
  )
}
