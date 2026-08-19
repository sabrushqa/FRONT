import Keycloak from 'keycloak-js';
import { stripTrailingSlashes } from './url';

type LanaCashWindow = Window & {
  __LANACASH_CONFIG__?: {
    keycloakUrl?: string;
    keycloakRealm?: string;
    keycloakClientId?: string;
  };
};

function resolveConfig(): { url: string; realm: string; clientId: string } {
  const config = (window as LanaCashWindow).__LANACASH_CONFIG__;
  const url = stripTrailingSlashes(config?.keycloakUrl || 'http://localhost:8088');
  return {
    url,
    realm: config?.keycloakRealm || 'PFE26',
    clientId: config?.keycloakClientId || 'portail-affiliation'
  };
}

let keycloakInstance: Keycloak | null = null;
let initPromise: Promise<boolean> | null = null;

// Max time to wait for the silent SSO check. If the Keycloak server is
// unreachable the silent-check-sso iframe never posts back, which would leave
// init() pending forever and freeze the login UI. Resolve to "not authenticated"
// after this delay so the form stays usable.
const KEYCLOAK_INIT_TIMEOUT_MS = 8000;

export async function initKeycloak(): Promise<boolean> {
  if (initPromise) return initPromise;

  const config = resolveConfig();
  keycloakInstance = new Keycloak({
    url: config.url,
    realm: config.realm,
    clientId: config.clientId
  });

  const init = keycloakInstance.init({
    onLoad: 'check-sso',
    pkceMethod: 'S256',
    silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
    checkLoginIframe: false
  });

  const timeout = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), KEYCLOAK_INIT_TIMEOUT_MS);
  });

  initPromise = Promise.race([init, timeout]).catch(() => false);

  return initPromise;
}

export async function keycloakLoginWithRedirect(loginHint = ''): Promise<void> {
  await initKeycloak();
  await keycloakInstance?.login({
    redirectUri: `${window.location.origin}/login`,
    loginHint: loginHint.trim() || undefined,
    acr: { values: ['1'], essential: true }
  });
}

export async function getKeycloakToken(): Promise<string> {
  await initKeycloak();
  if (!keycloakInstance?.token) return '';

  try {
    await keycloakInstance.updateToken(30);
  } catch {
    return '';
  }
  return keycloakInstance.token ?? '';
}

export function getKeycloakRefreshToken(): string {
  return keycloakInstance?.refreshToken ?? '';
}

export function getKeycloakTokenExpiresAt(): string | null {
  const exp = keycloakInstance?.tokenParsed?.exp;
  return typeof exp === 'number' ? new Date(exp * 1000).toISOString() : null;
}

export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
}

// Keycloak access tokens are short-lived (realm accessTokenLifespan, e.g. 5 min)
// by design - the refresh_token (tied to the much longer SSO session) is what
// keeps the user silently logged in. Called directly by the axios interceptor
// when a stored token is close to expiring, so a session stays alive across an
// entire browsing session instead of forcing a full re-login every few minutes.
export async function refreshAccessToken(refreshToken: string): Promise<RefreshedTokens> {
  const config = resolveConfig();
  const url = `${config.url}/realms/${encodeURIComponent(config.realm)}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    refresh_token: refreshToken
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!response.ok) {
    throw new Error('Le rafraîchissement du token Keycloak a échoué.');
  }

  const data = (await response.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  const expiresInSeconds = typeof data.expires_in === 'number' ? data.expires_in : 300;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    tokenExpiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString()
  };
}

export async function keycloakLogout(): Promise<void> {
  if (keycloakInstance?.authenticated) {
    await keycloakInstance.logout({
      redirectUri: `${window.location.origin}/login`
    });
    return;
  }

  const refreshToken = window.sessionStorage.getItem('userRefreshToken');
  if (!refreshToken) return;

  const config = resolveConfig();
  const logoutUrl = `${config.url}/realms/${encodeURIComponent(config.realm)}/protocol/openid-connect/logout`;
  const body = new URLSearchParams({
    client_id: config.clientId,
    refresh_token: refreshToken
  });

  try {
    await fetch(logoutUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
  } catch {
    // Ignore errors — local session can still be cleared
  }
}
