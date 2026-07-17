import { CheckCircle2, XCircle, Minus, Star } from 'lucide-react'

const MODEL_META = {
  xgboost:       { displayName: 'XGBoost',          isPrimary: true  },
  random_forest: { displayName: 'Random Forest',    isPrimary: false },
  svm:           { displayName: 'Support Vector Machine', isPrimary: false },
  logistic:      { displayName: 'Logistic Regression',   isPrimary: false },
  gradient_boost:{ displayName: 'Gradient Boosting', isPrimary: false },
  knn:           { displayName: 'K-Nearest Neighbors',   isPrimary: false },
  neural_net:    { displayName: 'Neural Network',    isPrimary: false },
}

function PredCell({ prediction }) {
  if (prediction === null || prediction === undefined) {
    return <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
  }
  const isPD = prediction === 1 || prediction === true || String(prediction).toLowerCase() === 'parkinson\'s'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
      {isPD
        ? <XCircle size={14} color="var(--color-critical)" />
        : <CheckCircle2 size={14} color="var(--color-safe)" />
      }
      <span style={{
        fontSize: '0.8rem', fontWeight: 600,
        color: isPD ? 'var(--color-critical)' : 'var(--color-safe)',
      }}>
        {isPD ? "Parkinson's" : 'Healthy'}
      </span>
    </div>
  )
}

function ConfBar({ value }) {
  const pct = Math.round((value ?? 0) * 100)
  const color = pct >= 70 ? 'var(--color-critical)' : pct >= 50 ? 'var(--color-moderate)' : 'var(--color-safe)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 100 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', minWidth: 30 }}>
        {pct}%
      </span>
    </div>
  )
}

export default function ModelTable({ models = [] }) {
  if (!models.length) return (
    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '1rem 0' }}>No model results available.</div>
  )

  const pdCount = models.filter((m) => m.prediction === 1 || m.prediction === true).length
  const total   = models.length

  return (
    <div>
      <div style={{ marginBottom: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Model Agreement</h4>
        <span className={`badge ${pdCount > total / 2 ? 'badge-critical' : 'badge-safe'}`} style={{ fontSize: '0.7rem' }}>
          {pdCount}/{total} predict Parkinson's
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Model', 'Prediction', 'Confidence', 'Agreement'].map((h) => (
                <th key={h} style={{
                  padding: '0.5rem 0.75rem', textAlign: 'left',
                  color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.72rem',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {models.map((m, i) => {
              const meta    = MODEL_META[m.model_id] ?? MODEL_META[m.model_name?.toLowerCase().replace(/\s+/g,'_')] ?? { displayName: m.model_name ?? m.model_id }
              const isPD    = m.prediction === 1 || m.prediction === true
              const agreesPrimary = models.find((x) => MODEL_META[x.model_id]?.isPrimary)?.prediction === m.prediction

              return (
                <tr key={i} style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: meta.isPrimary ? 'rgba(99,102,241,0.07)' : 'transparent',
                  transition: 'background 0.2s',
                }}>
                  <td style={{ padding: '0.625rem 0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {meta.isPrimary && <Star size={12} color="var(--accent-light)" fill="var(--accent-light)" />}
                      <span style={{ fontWeight: meta.isPrimary ? 700 : 500, color: meta.isPrimary ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {meta.displayName}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '0.625rem 0.75rem' }}>
                    <PredCell prediction={m.prediction} />
                  </td>
                  <td style={{ padding: '0.625rem 0.75rem', minWidth: 130 }}>
                    <ConfBar value={m.confidence ?? m.probability} />
                  </td>
                  <td style={{ padding: '0.625rem 0.75rem' }}>
                    {agreesPrimary
                      ? <CheckCircle2 size={15} color="var(--color-safe)" />
                      : <Minus size={15} color="var(--text-muted)" />
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
          {/* Summary row */}
          <tfoot>
            <tr style={{ borderTop: '1px solid var(--border)' }}>
              <td colSpan={4} style={{ padding: '0.625rem 0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  <span>Ensemble vote:</span>
                  <span style={{
                    fontWeight: 700,
                    color: pdCount > total / 2 ? 'var(--color-critical)' : 'var(--color-safe)',
                  }}>
                    {pdCount > total / 2 ? "Parkinson's Detected" : 'Likely Healthy'}
                  </span>
                  <span>({pdCount} of {total} models)</span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
