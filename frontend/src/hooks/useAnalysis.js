import { useState, useCallback } from 'react'
import { uploadAudio } from '../api/client'

export function useAnalysis() {
  const [sessionId, setSessionId]         = useState(null)
  const [uploading, setUploading]         = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError]     = useState(null)

  const upload = useCallback(async (file) => {
    setUploading(true)
    setUploadError(null)
    setUploadProgress(0)
    try {
      const res = await uploadAudio(file, setUploadProgress)
      const id  = res.data.session_id
      setSessionId(id)
      return id
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || 'Upload failed'
      setUploadError(msg)
      return null
    } finally {
      setUploading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setSessionId(null)
    setUploading(false)
    setUploadProgress(0)
    setUploadError(null)
  }, [])

  return { sessionId, uploading, uploadProgress, uploadError, upload, reset }
}
