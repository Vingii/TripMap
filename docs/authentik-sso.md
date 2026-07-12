# Authentik SSO setup

TripMap delegates authentication to your own [Authentik](https://goauthentik.io/)
OIDC provider. The backend never sees a password or a client secret: it verifies
the bearer JWT on every protected request against the provider's public JWKS,
checking the signature, the issuer (`iss`), and the audience (`aud`). This guide
covers the one-time provider/application setup in Authentik and the environment
variables TripMap needs to trust the tokens it issues.

The in-browser login flow that obtains a token for the SPA is delivered
separately (TM-26); this document is about wiring the backend to Authentik and
verifying token verification works end to end.

## 1. Create the OAuth2/OpenID provider

In the Authentik admin interface, go to **Applications → Providers → Create** and
choose **OAuth2/OpenID Provider**. Configure it as follows:

| Setting | Value |
| --- | --- |
| **Name** | `TripMap` (or any label) |
| **Client type** | **Public** — Authorization Code + PKCE, no client secret |
| **Client ID** | Keep the generated value, or set a memorable one (e.g. `tripmap`). This becomes `OIDC_AUDIENCE`. |
| **Redirect URIs** | One line per environment (see below) |
| **Signing Key** | An **RS256** key — select a certificate backed by an RSA key pair |
| **Scopes** | `openid`, `email`, `profile` |

### Client type: public + PKCE

TripMap is a single-page app with no confidential backend channel to Authentik,
so the provider must be a **public** client using Authorization Code flow with
PKCE. There is **no client secret** — the backend authenticates requests purely
by verifying the token signature and claims, so a shared secret would serve no
purpose. (This supersedes any earlier `OIDC_CLIENT_SECRET` note.)

### Signing key: must be RS256

The backend verifies tokens with `RS256` only (PyJWT with the `crypto` extra).
Pick a signing certificate backed by an **RSA** key pair. A symmetric (HS256) or
EC signing key will fail verification with a 401, even when everything else is
correct.

### Redirect URIs

Add one redirect URI per environment the SPA runs from. For example:

```
https://tripmap.example.com/auth/callback
http://localhost:5173/auth/callback
```

Adjust the paths to match the SPA callback route once TM-26 lands; the host and
scheme are what matter for the provider today.

## 2. Create the application

Go to **Applications → Applications → Create** and bind it to the provider:

| Setting | Value |
| --- | --- |
| **Name** | `TripMap` |
| **Slug** | `tripmap` — this appears in the issuer URL, so keep it stable |
| **Provider** | The provider created in step 1 |

Then grant access under the application's **Policy / Group / User Bindings** (or
via Authentik's global policy engine) so the users or groups who should reach
TripMap are authorized. Users without a binding will authenticate against
Authentik but be denied the application.

## 3. Configure TripMap's environment

TripMap reads three OIDC variables (see [`.env.example`](../.env.example)). Set
them in the deployment's `.env`:

| Variable | Value | Notes |
| --- | --- | --- |
| `OIDC_ISSUER` | The provider's issuer URL, **with a trailing slash** | e.g. `https://auth.example.com/application/o/tripmap/` |
| `OIDC_AUDIENCE` | The provider's **Client ID** | Must equal the token's `aud` claim |
| `OIDC_JWKS_URL` | Leave **blank** | Auto-discovered from the issuer; only set it to override discovery |

The issuer URL is per-application: Authentik shows it (and the matching JWKS,
authorize, and token endpoints) on the provider's page and at
`{issuer}/.well-known/openid-configuration`. The audience **must** equal the
provider's Client ID — a mismatch is the most common cause of a 401.

When `OIDC_ISSUER` / `OIDC_AUDIENCE` are unset (e.g. local dev with no IdP),
every protected request returns 401 by design; `GET /api/health` stays public.

## 4. Verify end to end

Confirm token verification works against the real provider:

1. **Public endpoint** — no auth needed:

   ```sh
   curl -i https://tripmap.example.com/api/health
   # → 200 {"status":"ok"}
   ```

2. **Missing token** — protected endpoint rejects:

   ```sh
   curl -i https://tripmap.example.com/api/me
   # → 401  (WWW-Authenticate: Bearer)
   ```

3. **Valid token** — obtain an access token from Authentik for the TripMap
   application (via the SPA once TM-26 lands, or with a manual
   Authorization-Code-+-PKCE exchange / Authentik's API token flow for testing),
   then:

   ```sh
   curl -i -H "Authorization: Bearer $TOKEN" https://tripmap.example.com/api/me
   # → 200  {"id": "...", "email": "...", "display_name": "...", ...}
   ```

   On first success the backend creates a `User` row from the token's `sub`,
   `email`, and `name` / `preferred_username` claims; subsequent requests refresh
   those fields when they change.

4. **Invalid token** — a garbage or expired token returns 401:

   ```sh
   curl -i -H "Authorization: Bearer not-a-real-token" https://tripmap.example.com/api/me
   # → 401
   ```

### Troubleshooting a 401 with a "valid-looking" token

Decode the access token (e.g. paste it into a JWT decoder or run
`python -c 'import jwt,sys; print(jwt.decode(sys.argv[1], options={"verify_signature": False}))' "$TOKEN"`)
and confirm:

- `iss` exactly matches `OIDC_ISSUER` (including the trailing slash).
- `aud` exactly matches `OIDC_AUDIENCE` (the Client ID). Authentik may need the
  application added to the token's audience — check the provider's scope/audience
  settings if `aud` is missing or wrong.
- The token is signed with `RS256` (`alg` in the JWT header), not `HS256`.
