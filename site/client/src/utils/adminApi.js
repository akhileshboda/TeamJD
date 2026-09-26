// Media-manager API client. Every error message is shown to Jake as-is, so failures that
// never reach the server (network drop, expired Cloudflare Access session) get one too.

const SESSION_MESSAGE = 'Your sign-in may have expired. Reload the page to sign in again.'
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
    // An expired Access session redirects cross-origin, which fetch reports as a network error.
    throw new Error(SESSION_MESSAGE)
  }

  const data = await response.json().catch(() => null)
  if (!response.ok || !data) {
    const error = new Error(data?.error || SESSION_MESSAGE)
    error.status = response.status
    throw error
  }
  return data
}

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

export async function uploadMedia(slotId, file, { onProgress = () => {} } = {}) {
  const { uploadId, chunkBytes } = await adminRequest(`/api/admin/slots/${slotId}/uploads`, {
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
