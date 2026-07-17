import { useState, useRef, useCallback } from 'react'
import { createSSEStream } from '../api/client'

/**
 * Event types from backend:
 *   agent_start        { agent, message }
 *   agent_done         { agent, message, duration }
 *   agent_error        { agent, message }
 *   quality_failed     { message, details }
 *   pipeline_complete  { report }
 */

const STEP_AGENTS = [
  'audio_validator',
  'feature_extractor',
  'ml_ensemble',
  'result_interpreter',
  'knowledge_retriever',
  'report_generator',
]

const STEP_LABELS = {
  audio_validator:   'Validating Audio Quality',
  feature_extractor: 'Extracting Voice Features',
  ml_ensemble:       'Running ML Models',
  result_interpreter:'Interpreting Results',
  knowledge_retriever:'Retrieving Medical Knowledge',
  report_generator:  'Generating Final Report',
}

function buildInitialSteps() {
  return STEP_AGENTS.map((id) => ({
    id,
    label: STEP_LABELS[id],
    status: 'pending', // pending | running | done | error
    message: '',
    duration: null,
  }))
}

export function useSSE(sessionId) {
  const [steps, setSteps] = useState(buildInitialSteps())
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const [qualityFailed, setQualityFailed] = useState(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const esRef = useRef(null)

  const updateStep = useCallback((agentId, patch) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === agentId ? { ...s, ...patch } : s))
    )
  }, [])

  const startStream = useCallback(() => {
    if (!sessionId) return
    if (esRef.current) esRef.current.close()

    // Reset state
    setSteps(buildInitialSteps())
    setReport(null)
    setError(null)
    setQualityFailed(null)
    setIsStreaming(true)

    const es = createSSEStream(sessionId)
    esRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const { type } = data

        if (type === 'agent_start') {
          updateStep(data.agent, { status: 'running', message: data.message || '' })
        } else if (type === 'agent_done') {
          updateStep(data.agent, {
            status: 'done',
            message: data.message || '',
            duration: data.duration ?? null,
          })
        } else if (type === 'agent_error') {
          updateStep(data.agent, { status: 'error', message: data.message || 'An error occurred' })
          setError(data.message || 'Pipeline error')
          setIsStreaming(false)
          es.close()
        } else if (type === 'quality_failed') {
          const issuesList = data.issues || []
          const errMsg = issuesList.join(' ') || data.message || 'Audio Quality Check Failed'
          setQualityFailed({ message: errMsg, details: data.details || null })
          setIsStreaming(false)
          es.close()
        } else if (type === 'pipeline_complete') {
          setReport(data.report)
          setIsStreaming(false)
          es.close()
        }
      } catch (e) {
        console.warn('[SSE parse error]', e)
      }
    }

    es.onerror = () => {
      setError('Connection to analysis server lost. Please try again.')
      setIsStreaming(false)
      es.close()
    }
  }, [sessionId, updateStep])

  const stopStream = useCallback(() => {
    esRef.current?.close()
    setIsStreaming(false)
  }, [])

  const reset = useCallback(() => {
    esRef.current?.close()
    setSteps(buildInitialSteps())
    setReport(null)
    setError(null)
    setQualityFailed(null)
    setIsStreaming(false)
  }, [])

  return { steps, report, error, qualityFailed, isStreaming, startStream, stopStream, reset }
}
