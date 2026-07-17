import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts'

function zColor(z) {
  const abs = Math.abs(z)
  if (abs < 1)    return '#22D3EE'
  if (abs < 2)    return '#F59E0B'
  if (abs < 3)    return '#F97316'
  return '#EF4444'
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload ?? {}
  return (
    <div style={{
      background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '10px', padding: '0.875rem 1rem',
      fontSize: '0.8rem', minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <div style={{ fontWeight: 700, color: '#F1F5F9', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
        {d.name}
      </div>
      {d.description && (
        <div style={{ color: '#94A3B8', marginBottom: '0.5rem', lineHeight: 1.4, fontSize: '0.75rem' }}>
          {d.description}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem' }}>
          <span style={{ color: '#64748B' }}>Your Value:</span>
          <span style={{ color: '#F1F5F9', fontWeight: 600 }}>{d.value?.toFixed?.(4) ?? d.value}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem' }}>
          <span style={{ color: '#64748B' }}>Z-Score:</span>
          <span style={{ color: zColor(d.z_score ?? 0), fontWeight: 600 }}>{(d.z_score ?? 0).toFixed(2)}</span>
        </div>
        {d.normal_range && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem' }}>
            <span style={{ color: '#64748B' }}>Normal Range:</span>
            <span style={{ color: '#94A3B8' }}>{d.normal_range}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function shortLabel(name = '') {
  // Trim long feature names for Y-axis
  const map = {
    'MDVP:Fo(Hz)':  'Avg Freq',
    'MDVP:Fhi(Hz)': 'Max Freq',
    'MDVP:Flo(Hz)': 'Min Freq',
    'MDVP:Jitter(%)':'Jitter%',
    'MDVP:Jitter(Abs)':'Jitter Abs',
    'MDVP:RAP':     'RAP',
    'MDVP:PPQ':     'PPQ',
    'Jitter:DDP':   'Jitter DDP',
    'MDVP:Shimmer': 'Shimmer',
    'MDVP:Shimmer(dB)':'Shimmer dB',
    'Shimmer:APQ3': 'APQ3',
    'Shimmer:APQ5': 'APQ5',
    'MDVP:APQ':     'APQ',
    'Shimmer:DDA':  'DDA',
    'NHR':          'NHR',
    'HNR':          'HNR',
    'RPDE':         'RPDE',
    'DFA':          'DFA',
    'spread1':      'Spread1',
    'spread2':      'Spread2',
    'D2':           'D2',
    'PPE':          'PPE',
  }
  return map[name] || (name.length > 14 ? name.slice(0, 12) + '…' : name)
}

export default function FeatureChart({ features = [] }) {
  if (!features.length) return (
    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
      No anomalous features detected.
    </div>
  )

  // Sort by absolute z-score descending, take top 10
  const sorted = [...features]
    .sort((a, b) => Math.abs(b.z_score ?? 0) - Math.abs(a.z_score ?? 0))
    .slice(0, 10)
    .map((f) => ({ ...f, name: shortLabel(f.feature_name ?? f.name) }))

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Anomalous Voice Features (Z-Score)</h4>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>
          Bars show deviation from healthy baseline. |z| &gt; 2 is clinically significant.
        </p>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(280, sorted.length * 34)}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis
            type="number"
            domain={['auto', 'auto']}
            tick={{ fill: '#475569', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            tickLine={false}
            label={{ value: 'Z-Score', position: 'insideBottom', offset: -2, fill: '#475569', fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={76}
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <ReferenceLine x={0} stroke="rgba(99,102,241,0.5)" strokeWidth={1.5} />
          <ReferenceLine x={2}  stroke="rgba(239,68,68,0.2)" strokeDasharray="4 4" />
          <ReferenceLine x={-2} stroke="rgba(239,68,68,0.2)" strokeDasharray="4 4" />
          <Bar dataKey="z_score" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {sorted.map((entry, idx) => (
              <Cell key={idx} fill={zColor(entry.z_score ?? 0)} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
