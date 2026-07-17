import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Brain, Mic2, ClipboardList } from 'lucide-react'

const PARKINSONS_INFO = `Parkinson's disease is a progressive neurological disorder affecting the dopamine-producing neurons in the substantia nigra region of the brain. It is the second most common neurodegenerative disorder after Alzheimer's disease, affecting over 10 million people worldwide.

The disease disrupts motor control, leading to tremors, rigidity, slowness of movement (bradykinesia), and postural instability. However, it also affects non-motor functions including speech, cognition, and autonomic function.

Early detection is critical: voice changes often appear before classic motor symptoms, making voice-based screening a promising non-invasive tool. Studies show that 90% of individuals with Parkinson's exhibit vocal abnormalities.`

const FEATURE_DESCRIPTIONS = {
  'MDVP:Jitter(%)': 'Cycle-to-cycle variation in fundamental frequency, expressed as a percentage. Elevated jitter indicates vocal instability.',
  'MDVP:Shimmer':   'Cycle-to-cycle variation in amplitude. Increased shimmer reflects reduced control of laryngeal muscles.',
  'HNR':            'Harmonics-to-Noise Ratio. A lower HNR suggests more turbulent, breathy voice quality.',
  'NHR':            'Noise-to-Harmonics Ratio. Higher values indicate more noise in the voice signal.',
  'RPDE':           'Recurrence Period Density Entropy. Measures the periodicity complexity of the voice signal.',
  'DFA':            'Detrended Fluctuation Analysis. Quantifies the fractal scaling in the voice signal.',
  'PPE':            'Pitch Period Entropy. Measures the impaired control of stable pitch periods.',
  'spread1':        'Nonlinear measure of fundamental frequency variation.',
  'spread2':        'Another nonlinear measure related to voice irregularity.',
  'D2':             'Correlation dimension — measures the complexity and dimensionality of the vocal signal.',
}

function AccordionSection({ icon: Icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.875rem 1rem', background: open ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
          border: 'none', cursor: 'pointer', transition: 'background 0.2s',
          color: 'var(--text-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={16} color="var(--accent-light)" />
          </div>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{title}</span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.22 }}>
          <ChevronDown size={16} color="var(--text-muted)" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function KnowledgePanel({ features = [], interpretation = '', parkinsonsInfo = null }) {
  const anomalous = features.filter((f) => Math.abs(f.z_score ?? 0) >= 1.5).slice(0, 8)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ marginBottom: '0.25rem' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Medical Context</h4>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>
          Educational information about your results
        </p>
      </div>

      {/* About PD */}
      <AccordionSection icon={Brain} title="About Parkinson's Disease" defaultOpen>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
          {parkinsonsInfo || PARKINSONS_INFO}
        </p>
      </AccordionSection>

      {/* Biomarkers */}
      <AccordionSection icon={Mic2} title="Your Voice Biomarkers Explained">
        {anomalous.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No significantly anomalous features found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {anomalous.map((f, i) => {
              const name = f.feature_name ?? f.name
              const desc = f.description || FEATURE_DESCRIPTIONS[name] || 'Voice feature related to vocal quality and control.'
              const z    = f.z_score ?? 0
              return (
                <div key={i} style={{
                  padding: '0.75rem', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{name}</span>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 600,
                      color: Math.abs(z) >= 3 ? 'var(--color-critical)' : Math.abs(z) >= 2 ? 'var(--color-high)' : 'var(--color-moderate)',
                    }}>
                      z = {z.toFixed(2)}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</p>
                </div>
              )
            })}
          </div>
        )}
      </AccordionSection>

      {/* Interpretation */}
      <AccordionSection icon={ClipboardList} title="What These Results Mean">
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          {interpretation ||
            'Voice-based screening is a non-invasive early detection tool. While AI models have high accuracy, these results should be interpreted by a qualified neurologist alongside a clinical examination, imaging studies, and medical history review. A positive screening result does not constitute a diagnosis.'
          }
        </p>
        <div style={{
          marginTop: '0.875rem', padding: '0.75rem', borderRadius: '8px',
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
          fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5,
        }}>
          <strong style={{ color: 'var(--accent-light)' }}>Important: </strong>
          This AI analysis is for screening purposes only. Always consult a neurologist or movement disorder specialist for diagnosis and treatment.
        </div>
      </AccordionSection>
    </div>
  )
}
