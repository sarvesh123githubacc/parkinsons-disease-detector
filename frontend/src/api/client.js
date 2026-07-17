import axios from 'axios'

const BASE_URL = 'http://localhost:8001'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Intercept to handle common errors
api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('[API Error]', err?.response?.data || err.message)
    return Promise.reject(err)
  }
)

export const uploadAudio = (file, onProgress) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/api/v1/analysis/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    },
  })
}

export const getReport       = (sessionId) => api.get(`/api/v1/analysis/report/${sessionId}`)
export const getFeatures     = (sessionId) => api.get(`/api/v1/analysis/features/${sessionId}`)
export const getModelResults = (sessionId) => api.get(`/api/v1/analysis/models/${sessionId}`)
export const getHealth       = ()          => api.get('/api/v1/health')
export const getModelHealth  = ()          => api.get('/api/v1/health/models')
export const getBiomarkers   = ()          => api.get('/api/v1/knowledge/biomarkers')
export const getParkinsonsInfo = ()        => api.get('/api/v1/knowledge/parkinsons')
export const getNextSteps    = (tier)      => api.get(`/api/v1/knowledge/next-steps/${tier}`)

export const createSSEStream = (sessionId) =>
  new EventSource(`${BASE_URL}/api/v1/analysis/stream/${sessionId}`)
