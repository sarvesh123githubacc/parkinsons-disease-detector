import { Routes, Route, useLocation, Link, NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Brain, Activity, Home, FileText, Zap } from 'lucide-react'
import UploadPage from './pages/UploadPage'
import ReportPage from './pages/ReportPage'

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
  exit:    { opacity: 0, y: -12, transition: { duration: 0.2 } }
}

function Header() {
  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      background: 'rgba(10,15,30,0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(99,102,241,0.4)',
          }}>
            <Brain size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F1F5F9', lineHeight: 1 }}>NeuroVoice</div>
            <div style={{ fontSize: '0.65rem', color: '#6366F1', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1, marginTop: 2 }}>Parkinson's AI</div>
          </div>
        </Link>

        {/* Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <NavLink to="/" end
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.4rem 0.75rem', borderRadius: '8px',
              fontSize: '0.85rem', fontWeight: 500,
              color: isActive ? '#818CF8' : '#94A3B8',
              background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
              textDecoration: 'none',
              transition: 'all 0.2s',
            })}>
            <Home size={15} /> Analyze
          </NavLink>
        </nav>

        {/* Status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: '#22D3EE' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22D3EE', boxShadow: '0 0 8px #22D3EE', animation: 'pulse 2s infinite' }} />
          AI System Ready
        </div>
      </div>
    </header>
  )
}

export default function App() {
  const location = useLocation()
  return (
    <>
      <Header />
      <div style={{ paddingTop: '64px' }}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <UploadPage />
              </motion.div>
            } />
            <Route path="/report/:sessionId" element={
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <ReportPage />
              </motion.div>
            } />
          </Routes>
        </AnimatePresence>
      </div>
    </>
  )
}
