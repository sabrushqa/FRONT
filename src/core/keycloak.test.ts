import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function makeKeycloakMock(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    init: vi.fn().mockResolvedValue(true),
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    updateToken: vi.fn().mockResolvedValue(true),
    token: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    authenticated: false,
    tokenParsed: { exp: Math.floor(Date.now() / 1000) + 300 },
    ...overrides
  };
}

let currentMockInstance = makeKeycloakMock();

vi.mock('keycloak-js', () => ({
  default: vi.fn().mockImplementation(function KeycloakMock() {
    return currentMockInstance;
  })
}));

beforeEach(() => {
  currentMockInstance = makeKeycloakMock();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (window as Window & { __LANACASH_CONFIG__?: unknown }).__LANACASH_CONFIG__;
});

describe('refreshAccessToken', () => {
  it('renvoie les tokens rafraichis quand la reponse est ok', async () => {
    const { refreshAccessToken } = await import('./keycloak');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 120 })
      })
    );

    const result = await refreshAccessToken('old-refresh');

    expect(result.accessToken).toBe('new-access');
    expect(result.refreshToken).toBe('new-refresh');
    expect(new Date(result.tokenExpiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("reutilise le refresh token fourni si la reponse n'en renvoie pas de nouveau", async () => {
    const { refreshAccessToken } = await import('./keycloak');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'new-access' })
      })
    );

    const result = await refreshAccessToken('kept-refresh');
    expect(result.refreshToken).toBe('kept-refresh');
  });

  it("leve une erreur si la reponse n'est pas ok", async () => {
    const { refreshAccessToken } = await import('./keycloak');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    await expect(refreshAccessToken('old-refresh')).rejects.toThrow(
      'Le rafraîchissement du token Keycloak a échoué.'
    );
  });
});

describe('getKeycloakRefreshToken / getKeycloakTokenExpiresAt (avant initialisation)', () => {
  it('renvoie des valeurs vides quand aucune instance Keycloak n\'existe encore', async () => {
    const { getKeycloakRefreshToken, getKeycloakTokenExpiresAt } = await import('./keycloak');
    expect(getKeycloakRefreshToken()).toBe('');
    expect(getKeycloakTokenExpiresAt()).toBeNull();
  });
});

describe('keycloakLogout', () => {
  it("ne fait rien si aucune instance et aucun refresh token stocke", async () => {
    const { keycloakLogout } = await import('./keycloak');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    window.sessionStorage.clear();

    await keycloakLogout();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('appelle le endpoint de logout avec le refresh token stocke si aucune instance Keycloak', async () => {
    const { keycloakLogout } = await import('./keycloak');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    window.sessionStorage.setItem('userRefreshToken', 'stored-refresh');

    await keycloakLogout();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/protocol/openid-connect/logout'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it("n'echoue pas si l'appel fetch de logout rejette", async () => {
    const { keycloakLogout } = await import('./keycloak');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    window.sessionStorage.setItem('userRefreshToken', 'stored-refresh');

    await expect(keycloakLogout()).resolves.toBeUndefined();
  });
});

describe('initKeycloak', () => {
  it('resout true quand keycloak.init resout true', async () => {
    const { initKeycloak } = await import('./keycloak');
    const result = await initKeycloak();
    expect(result).toBe(true);
  });

  it('reutilise la meme promesse d\'initialisation sur des appels successifs', async () => {
    const { initKeycloak } = await import('./keycloak');
    const first = initKeycloak();
    const second = initKeycloak();
    expect(await first).toBe(await second);
  });

  it("resout false si l'initialisation Keycloak rejette", async () => {
    currentMockInstance = makeKeycloakMock({ init: vi.fn().mockRejectedValue(new Error('unreachable')) });
    const { initKeycloak } = await import('./keycloak');
    const result = await initKeycloak();
    expect(result).toBe(false);
  });
});

describe('keycloakLoginWithRedirect', () => {
  it("appelle login sur l'instance Keycloak avec un loginHint nettoye", async () => {
    const { keycloakLoginWithRedirect } = await import('./keycloak');
    await keycloakLoginWithRedirect('  user@example.com  ');
    expect(currentMockInstance.login).toHaveBeenCalledWith(
      expect.objectContaining({ loginHint: 'user@example.com' })
    );
  });

  it('omet loginHint quand il est vide', async () => {
    const { keycloakLoginWithRedirect } = await import('./keycloak');
    await keycloakLoginWithRedirect('   ');
    expect(currentMockInstance.login).toHaveBeenCalledWith(
      expect.objectContaining({ loginHint: undefined })
    );
  });
});

describe('getKeycloakToken', () => {
  it('renvoie le token courant apres un updateToken reussi', async () => {
    const { getKeycloakToken } = await import('./keycloak');
    const token = await getKeycloakToken();
    expect(token).toBe('mock-access-token');
  });

  it("renvoie une chaine vide si updateToken echoue", async () => {
    currentMockInstance = makeKeycloakMock({ updateToken: vi.fn().mockRejectedValue(new Error('expired')) });
    const { getKeycloakToken } = await import('./keycloak');
    const token = await getKeycloakToken();
    expect(token).toBe('');
  });
});
