import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Mic, MicOff, Square, RefreshCcw, AlertCircle, CheckCircle2, File as FileIcon, Loader2 } from 'lucide-react'

const MAX_FILE_SIZE_MB = 50
const ACCEPTED_TYPES   = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/flac', 'audio/x-wav']
const ACCEPTED_EXT     = '.wav,.mp3,.mp4,.ogg,.webm,.flac,.m4a'

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function formatDuration(sec) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2,'0')}`
}

/* ─ Animated waveform bars for recording ─ */
function WaveformBars({ active }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '32px' }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} style={{
          width: 3, borderRadius: 2,
          background: active ? '#EF4444' : '#475569',
          height: active ? `${20 + Math.random() * 24}px` : '6px',
          animation: active ? `wave ${0.4 + (i % 5) * 0.1}s ease-in-out ${(i * 0.05).toFixed(2)}s infinite alternate` : 'none',
          transition: 'height 0.15s',
        }} />
      ))}
    </div>
  )
}

function bufferToWav(buffer, sampleRate) {
  const numChannels = 1
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = buffer.length * bytesPerSample
  const bufferWav = new ArrayBuffer(44 + dataSize)
  const view = new DataView(bufferWav)

  function writeString(s, offset) {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }

  writeString('RIFF', 0)
  view.setUint32(4, 36 + dataSize, true)
  writeString('WAVE', 8)
  writeString('fmt ', 12)
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString('data', 36)
  view.setUint32(40, dataSize, true)

  const pcm = new Int16Array(bufferWav, 44)
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return new Blob([bufferWav], { type: 'audio/wav' })
}

export default function AudioUploader({ onSessionId, qualityFailed, uploading, uploadProgress, uploadError, onUpload }) {
  const [dragging, setDragging]     = useState(false)
  const [file, setFile]             = useState(null)
  const [fileError, setFileError]   = useState(null)
  const [recording, setRecording]   = useState(false)
  const [recDuration, setRecDuration] = useState(0)
  const [recBlob, setRecBlob]       = useState(null)

  const inputRef     = useRef(null)
  const audioCtxRef  = useRef(null)
  const streamRef    = useRef(null)
  const sourceRef    = useRef(null)
  const processorRef = useRef(null)
  const chunksRef    = useRef([])
  const timerRef     = useRef(null)
  const sampleRateRef = useRef(44100)  // store actual ctx.sampleRate

  /* --- File validation --- */
  const validateFile = (f) => {
    if (!f) return 'No file selected'
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) return `File too large (max ${MAX_FILE_SIZE_MB} MB)`
    if (!ACCEPTED_TYPES.includes(f.type) && !f.name.match(/\.(wav|mp3|mp4|ogg|webm|flac|m4a)$/i)) {
      return 'Unsupported file type. Use WAV, MP3, FLAC, OGG, or WebM.'
    }
    return null
  }

  const selectFile = (f) => {
    const err = validateFile(f)
    setFileError(err)
    if (!err) { setFile(f); setRecBlob(null) }
  }

  /* --- Drag & Drop --- */
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = ()  => setDragging(false)
  const onDrop      = (e) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) selectFile(f)
  }

  /* --- Recording --- */
  const startRecording = async () => {
    setFileError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setFileError('Microphone not supported. Use Chrome/Firefox on localhost or HTTPS.')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      // Resume context to ensure it runs and captures audio
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }
      sampleRateRef.current = ctx.sampleRate   // save BEFORE any close
      audioCtxRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source

      const processor = ctx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      chunksRef.current = []

      processor.onaudioprocess = (e) => {
        chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)))
      }
      source.connect(processor)
      processor.connect(ctx.destination)

      setRecording(true)
      setRecDuration(0)
      timerRef.current = setInterval(() => setRecDuration((d) => d + 1), 1000)
    } catch (e) {
      // Clean up stream tracks immediately if initialization fails
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setFileError('Microphone access denied. Click the 🔒 icon in your browser address bar to allow it.')
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        setFileError('No microphone found. Please connect a microphone and try again.')
      } else {
        setFileError(`Could not start recording: ${e.message}`)
      }
    }
  }

  const stopRecording = () => {
    clearInterval(timerRef.current)
    
    // 1. Stop mic tracks first to release browser recording indicator immediately
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop())
      } catch (e) {
        console.error('Error stopping tracks:', e)
      }
      streamRef.current = null
    }

    // 2. Disconnect source node
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect()
      } catch (e) {
        console.error('Error disconnecting source:', e)
      }
      sourceRef.current = null
    }

    // 3. Disconnect ScriptProcessor
    if (processorRef.current) {
      try {
        processorRef.current.disconnect()
      } catch (e) {
        console.error('Error disconnecting processor:', e)
      }
      processorRef.current = null
    }

    // 4. Close audio context
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close()
      } catch (e) {
        console.error('Error closing audio context:', e)
      }
      audioCtxRef.current = null
    }

    // 5. Build WAV from captured PCM chunks
    try {
      const sr = sampleRateRef.current
      const chunks = chunksRef.current
      if (chunks.length > 0) {
        const totalSamples = chunks.reduce((acc, c) => acc + c.length, 0)
        const flat = new Float32Array(totalSamples)
        let offset = 0
        for (const chunk of chunks) { flat.set(chunk, offset); offset += chunk.length }
        const blob = bufferToWav(flat, sr)
        setRecBlob(blob)
        setFile(new File([blob], `recording-${Date.now()}.wav`, { type: 'audio/wav' }))
      } else {
        setFileError('No audio captured. Please try recording again.')
      }
    } catch (err) {
      console.error('WAV generation error:', err)
      setFileError('Error saving recording. Please try again.')
    } finally {
      setRecording(false)   // always reset UI state
    }
  }

  useEffect(() => () => {
    clearInterval(timerRef.current)
    processorRef.current?.disconnect()
    audioCtxRef.current?.close()
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  /* --- Upload --- */
  const handleUpload = () => {
    if (file) onUpload(file)
  }

  /* --- Drag zone style --- */
  const dropZoneStyle = {
    border: `2px dashed ${dragging ? 'var(--accent)' : file ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.12)'}`,
    borderRadius: 'var(--radius-lg)',
    background: dragging
      ? 'rgba(99,102,241,0.08)'
      : file
        ? 'rgba(99,102,241,0.04)'
        : 'rgba(255,255,255,0.02)',
    padding: '2.5rem 2rem',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    position: 'relative',
  }

  const err = fileError || uploadError

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Quality failed banner */}
      <AnimatePresence>
        {qualityFailed && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
              background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)',
              borderRadius: 'var(--radius-md)', padding: '1rem',
            }}>
            <AlertCircle size={18} color="var(--color-high)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-high)', fontSize: '0.875rem' }}>Audio Quality Check Failed</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 3 }}>{qualityFailed.message}</div>
              {qualityFailed.details && (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4 }}>{qualityFailed.details}</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drop zone */}
      <div
        style={dropZoneStyle}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !file && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept={ACCEPTED_EXT} style={{ display: 'none' }}
          onChange={(e) => selectFile(e.target.files?.[0])} />

        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(99,102,241,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}>
                <Upload size={28} color="var(--accent-light)" />
              </div>
              <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
                Drop your voice recording here
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                WAV, MP3, FLAC, OGG · Max {MAX_FILE_SIZE_MB}MB · 5–30 sec recommended
              </div>
            </motion.div>
          ) : (
            <motion.div key="file" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '10px', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {recBlob ? <Mic size={22} color="var(--accent-light)" /> : <FileIcon size={22} color="var(--accent-light)" />}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{file.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{formatBytes(file.size)}{recBlob ? ` · ${formatDuration(recDuration)}` : ''}</div>
                </div>
                <button className="btn btn-ghost" style={{ padding: '0.4rem' }} onClick={(e) => { e.stopPropagation(); setFile(null); setRecBlob(null); setFileError(null) }}>
                  <RefreshCcw size={15} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Separator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>OR RECORD LIVE</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>

      {/* Microphone section */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
        background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '1.5rem',
      }}>
        {recording ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                color: 'var(--color-critical)', fontWeight: 600, fontSize: '0.875rem',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-critical)', animation: 'pulse 1s infinite' }} />
                Recording · {formatDuration(recDuration)}
              </div>
              <WaveformBars active={true} />
            </div>
            <button className="btn btn-danger" onClick={stopRecording}>
              <Square size={14} fill="currentColor" /> Stop Recording
            </button>
          </>
        ) : (
          <>
            <WaveformBars active={false} />
            <button className="btn btn-secondary" onClick={startRecording}>
              <Mic size={15} /> Start Recording
            </button>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Speak sustained "ahh" for 5–10 seconds for best results
            </div>
          </>
        )}
      </div>

      {/* Error */}
      <AnimatePresence>
        {err && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--color-critical)', fontSize: '0.8rem' }}>
            <AlertCircle size={14} />
            {err}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress */}
      {uploading && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
            <span>Uploading…</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* Upload button */}
      <button
        id="upload-analyze-btn"
        className="btn btn-primary btn-lg"
        disabled={!file || uploading || recording}
        onClick={handleUpload}
        style={{ width: '100%', marginTop: '0.5rem', fontSize: '1rem', padding: '0.9rem' }}
      >
        {uploading
          ? <><Loader2 size={18} className="animate-spin" /> Uploading…</>
          : <><CheckCircle2 size={18} /> Analyze Voice Sample</>
        }
      </button>

      <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Your audio is analyzed locally and not stored beyond this session. For research and educational purposes only.
      </p>
    </div>
  )
}
