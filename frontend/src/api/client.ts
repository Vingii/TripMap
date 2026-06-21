// Shared HTTP helper for the API. Every call goes through `apiFetch`, which
// attaches the current bearer token (when present) so protected endpoints
// authenticate. The token is held in module state and kept in sync by the auth
// store; the SPA login flow that obtains it lands in a later task.

let authToken: string | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

export function getAuthToken(): string | null {
  return authToken
}

export async function apiFetch(
  path: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
): Promise<Response> {
  const headers: Record<string, string> = { ...(init.headers ?? {}) }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }
  return fetch(path, { ...init, headers })
}

export async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
  return (await response.json()) as T
}
