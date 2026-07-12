// Runtime OIDC configuration, served by the backend from its own environment.
// Fetched before the SPA can start a login flow so the published image can be
// pointed at any Authentik provider via env vars — nothing is baked in at build
// time. This is a public endpoint, so it is called without a bearer token.

export interface ClientConfig {
  oidc_issuer: string
  oidc_client_id: string
}

export async function getClientConfig(): Promise<ClientConfig> {
  const response = await fetch('/api/config')
  if (!response.ok) {
    throw new Error(`Failed to load client config (${response.status})`)
  }
  return (await response.json()) as ClientConfig
}
