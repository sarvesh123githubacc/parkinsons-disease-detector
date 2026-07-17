import { useEffect, useRef, useState } from 'react'

const TIER_CONFIG = {
  low:      { label: 'Low Risk',      color: 'var(--color-safe)',     stroke: '#22D3EE', badge: 'badge-safe' },
  moderate: { label: 'Moderate Risk', color: 'var(--color-moderate)', stroke: '#F59E0B', badge: 'badge-moderate' },
  high:     { label: 'High Risk',     color: 'var(--color-high)',     stroke: '#F97316', badge: 'badge-high' },
  critical: { label: 'Critical Risk', color: 'var(--color-critical)', stroke: '#EF4444', badge: 'badge-critical' },
}

const RADIUS  = 90
const STROKE  = 12
const CIRCUM  = 2 * Math.PI * RADIUS

export default function ConfidenceGauge({ confidence = 0, tier = 'low' }) {
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.low
  const [animated, setAnimated] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    const target = Math.min(100, Math.max(0, confidence))
    const start  = performance.now()
    const duration = 1200

    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setAnimated(eased * target)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [confidence])

  const offset = CIRCUM - (animated / 100) * CIRCUM
  const size   = (RADIUS + STROKE + 12) * 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx={size / 2} cy={size / 2} r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={STROKE}
          />
          {/* Glow layer */}
          <circle
            cx={size / 2} cy={size / 2} r={RADIUS}
            fill="none"
            stroke={cfg.stroke}
            strokeWidth={STROKE + 6}
            strokeOpacity="0.15"
            strokeDasharray={CIRCUM}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'none', filter: 'blur(4px)' }}
          />
          {/* Main fill */}
          <circle
            cx={size / 2} cy={size / 2} r={RADIUS}
            fill="none"
            stroke={cfg.stroke}
            strokeWidth={STROKE}
            strokeDasharray={CIRCUM}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>

        {/* Center content */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '0.25rem',
        }}>
          <div style={{
            fontSize: '2.6rem', fontWeight: 800,
            color: cfg.color,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {Math.round(animated)}%
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'center', maxWidth: 90 }}>
            Parkinson's Likelihood
          </div>
          <span className={`badge ${cfg.badge}`} style={{ marginTop: '0.25rem', fontSize: '0.65rem' }}>
            {cfg.label}
          </span>
        </div>
      </div>
    </div>
  )
}
