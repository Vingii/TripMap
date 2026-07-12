// Shared HTTP helper for the API. Every call goes through `apiFetch`, which
// attaches the current bearer token (when present) so protected endpoints
// authenticate. The token is held in module state and kept in sync by the auth
// store, which also registers an unauthorized handler so any 401 drops the
// session and routes back to the login screen.

let authToken: string | null = null
let onUnauthorized: (() => void) | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

export function getAuthToken(): string | null {
  return authToken
}

/**
 * Register a callback invoked whenever an API call comes back 401. The auth
 * store uses this to clear the session and redirect to /login regardless of
 * which endpoint rejected the token.
 */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

export async function apiFetch(
  path: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
): Promise<Response> {
  const headers: Record<string, string> = { ...(init.headers ?? {}) }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }
  const response = await fetch(path, { ...init, headers })
  if (response.status === 401 && onUnauthorized) {
    onUnauthorized()
  }
  return response
}

export async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
  return (await response.json()) as T
}
