from pydantic import BaseModel


class ClientConfig(BaseModel):
    """Public runtime configuration the SPA needs before it can authenticate.

    Served so the published Docker image can be pointed at any Authentik
    provider purely through the backend's environment — the SPA is built once
    and reads these values at runtime rather than baking them in at build time.
    """

    oidc_issuer: str
    # For a public client the OAuth2 client ID and the token audience are the
    # same value, so the SPA derives its client ID from ``OIDC_AUDIENCE``.
    oidc_client_id: str
    # Local-dev only: when true the SPA auto-authenticates as a fixed user and
    # skips the OIDC flow entirely (mirrors the backend's DEV_AUTH).
    dev_auth: bool = False
