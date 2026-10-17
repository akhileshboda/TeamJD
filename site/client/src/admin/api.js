// Dashboard API client. Every error message is shown to Jake as-is, so failures
// that never reach the server get a plain-English message too.

export const SIGNED_OUT_EVENT = 'jd-admin:signed-out'
const NETWORK_MESSAGE = 'Could not reach the server. Check your connection and try again.'
const POLL_INTERVAL_MS = 1500
const CHUNK_RETRIES = 3

export async function adminRequest(path, { method = 'GET', json, body, headers } = {}) {
  let response
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: json ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: json ? JSON.stringify(json) : body,
    })
  } catch {
    throw new Error(NETWORK_MESSAGE)
  }

  if (response.status === 204) return null
  const data = await response.json().catch(() => null)
  if (response.status === 401 && data?.code === 'SIGNED_OUT') {
    window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
  }
  if (!response.ok) {
    const error = new Error(data?.error || 'Something went wrong. Please try again.')
    error.status = response.status
    error.fields = data?.fields
    throw error
  }
  return data
}

export const getSession = () => adminRequest('/api/admin/auth/session')
export const requestCode = (email) => adminRequest('/api/admin/auth/code', { method: 'POST', json: { email } })
export const verifyCode = (email, code) => adminRequest('/api/admin/auth/verify', { method: 'POST', json: { email, code } })
export const signOut = () => adminRequest('/api/admin/auth/logout', { method: 'POST' })
export const getStats = (range) => adminRequest(`/api/admin/stats?range=${encodeURIComponent(range)}`)

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function sendChunk(uploadId, index, chunk) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await adminRequest(`/api/admin/uploads/${uploadId}/chunks/${index}`, {
        method: 'PUT',
        body: chunk,
        headers: { 'Content-Type': 'application/octet-stream' },
      })
    } catch (error) {
      // Client errors are final; only retry dropped connections and server hiccups.
      if (attempt >= CHUNK_RETRIES || (error.status && error.status < 500)) throw error
      await wait(1000 * attempt)
    }
  }
}

export async function uploadMedia(startPath, file, { onProgress = () => {} } = {}) {
  const { uploadId, chunkBytes } = await adminRequest(startPath, {
    method: 'POST',
    json: { fileName: file.name, size: file.size },
  })

  for (let offset = 0, index = 0; offset < file.size; offset += chunkBytes, index += 1) {
    await sendChunk(uploadId, index, file.slice(offset, offset + chunkBytes))
    onProgress({ phase: 'uploading', fraction: Math.min(1, (offset + chunkBytes) / file.size) })
  }

  onProgress({ phase: 'processing' })
  const { jobId } = await adminRequest(`/api/admin/uploads/${uploadId}/complete`, { method: 'POST', json: {} })

  for (;;) {
    await wait(POLL_INTERVAL_MS)
    const job = await adminRequest(`/api/admin/jobs/${jobId}`)
    if (job.status === 'done') return job
    if (job.status === 'failed') throw new Error(job.error)
  }
}
