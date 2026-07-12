// Thin wrapper around oidc-client-ts. The UserManager is created lazily from
// the backend's runtime config (see api/config.ts) rather than build-time env,
// so a single published image works against any Authentik provider.
//
// Tokens are kept in an in-memory store: nothing OIDC-related is written to
// localStorage/sessionStorage, which is the XSS-hardening trade-off behind the
// in-memory requirement. The cost is that no token survives a hard reload, so
// the session is re-established on load via silent renew (a hidden iframe using
// the existing Authentik session cookie, or a refresh token within a session).

import {
  InMemoryWebStorage,
  UserManager,
  WebStorageStateStore,
  type UserManagerSettings,
} from 'oidc-client-ts'
import { getClientConfig } from '../api/config'

// The SPA route that completes both the interactive login redirect and the
// silent-renew iframe. Kept in sync with the router's callback route.
export const CALLBACK_PATH = '/auth/callback'

let manager: UserManager | null = null
let configured = false

/**
 * Fetch runtime config and build the UserManager. Idempotent: subsequent calls
 * return the result of the first. Resolves to whether OIDC is configured — the
 * backend returns empty issuer/client id when no provider is wired up, in which
 * case the app runs unauthenticated and the login view explains the situation.
 */
export async function initOidc(): Promise<boolean> {
  if (manager) return configured

  let issuer = ''
  let clientId = ''
  try {
    const cfg = await getClientConfig()
    issuer = cfg.oidc_issuer
    clientId = cfg.oidc_client_id
  } catch {
    // Backend unreachable or misconfigured — treat as unconfigured.
    return false
  }

  if (!issuer || !clientId) return false

  const origin = window.location.origin
  const settings: UserManagerSettings = {
    authority: issuer,
    client_id: clientId,
    redirect_uri: `${origin}${CALLBACK_PATH}`,
    silent_redirect_uri: `${origin}${CALLBACK_PATH}`,
    response_type: 'code',
    scope: 'openid profile email offline_access',
    automaticSilentRenew: true,
    // In-memory only: tokens never touch web storage.
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    // We rely on silent renew, not the check-session iframe.
    monitorSession: false,
  }

  manager = new UserManager(settings)
  configured = true
  return true
}

export function isOidcConfigured(): boolean {
  return configured
}

export function getUserManager(): UserManager {
  if (!manager) {
    throw new Error('OIDC is not configured; call initOidc() first')
  }
  return manager
}
