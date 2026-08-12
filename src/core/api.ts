import axios from 'axios';
import { getSessionStore } from '../store/sessionStore';
import { refreshAccessToken } from './keycloak';

const api = axios.create();

// Keycloak access tokens are short-lived by design (realm accessTokenLifespan) -
// refresh a bit before they actually expire using the refresh_token, which is
// tied to the much longer SSO session. Without this, every request made after
// the access token dies would 401 and force a full re-login.
const REFRESH_BUFFER_MS = 30_000;
let refreshPromise: Promise<string> | null = null;

async function ensureFreshToken(currentToken: string): Promise<string> {
  const store = getSessionStore();
  const session = store.session;
  const expiresAt = session?.tokenExpiresAt ? new Date(session.tokenExpiresAt).getTime() : null;
  if (expiresAt === null || expiresAt - Date.now() > REFRESH_BUFFER_MS) {
    return currentToken;
  }

  const refreshToken = store.getRefreshToken();
  if (!refreshToken) {
    return currentToken;
  }

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(refreshToken)
      .then((refreshed) => {
        store.updateTokens(refreshed.accessToken, refreshed.refreshToken, refreshed.tokenExpiresAt);
        return refreshed.accessToken;
      })
      .catch(() => currentToken)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.request.use(async (config) => {
  const store = getSessionStore();
  const token = store.getAccessToken();

  if (!token || config.headers['Authorization']) {
    return config;
  }

  // Skip public auth endpoints
  const url = (config.url ?? '').toLowerCase();
  const isPublic =
    url.endsWith('/api/auth/login') ||
    url.endsWith('/api/auth/login/verify-otp') ||
    url.endsWith('/api/auth/activate') ||
    url.endsWith('/api/auth/password-reset/request') ||
    url.endsWith('/api/auth/password-reset/confirm');

  if (isPublic) {
    return config;
  }

  const freshToken = await ensureFreshToken(token);

  // Check expiry again after the refresh attempt: if it's still stale (refresh
  // token itself expired, Keycloak unreachable, etc.) there is nothing left to
  // try - drop the session and send the user back to the login screen.
  const session = store.session;
  if (session?.tokenExpiresAt && new Date(session.tokenExpiresAt).getTime() < Date.now()) {
    store.clearSession();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return config;
  }

  config.headers['Authorization'] = `Bearer ${freshToken}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const store = getSessionStore();
      store.clearSession();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
