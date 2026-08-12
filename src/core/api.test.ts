import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeUserSessionResponse, useSessionStore } from '../store/sessionStore';
import api from './api';

vi.mock('./keycloak', () => ({
  refreshAccessToken: vi.fn()
}));

type RequestHandler = { fulfilled: (c: { headers: Record<string, string>; url: string }) => Promise<unknown> };
type ResponseHandler = { fulfilled: (r: unknown) => unknown; rejected: (e: unknown) => Promise<unknown> };

function requestHandler(): RequestHandler {
  return (api.interceptors.request as unknown as { handlers: RequestHandler[] }).handlers[0];
}

function responseHandler(): ResponseHandler {
  return (api.interceptors.response as unknown as { handlers: ResponseHandler[] }).handlers[0];
}

function resetStore() {
  window.sessionStorage.clear();
  window.localStorage.clear();
  useSessionStore.getState().clearSession();
}

describe('api request interceptor', () => {
  beforeEach(resetStore);
  afterEach(() => vi.restoreAllMocks());

  it("n'ajoute pas d'en-tete Authorization si aucun token n'est present", async () => {
    const config = await requestHandler().fulfilled({ headers: {}, url: '/api/dossiers' });
    expect((config as { headers: Record<string, string> }).headers['Authorization']).toBeUndefined();
  });

  it('ajoute Bearer <token> pour un endpoint prive quand un token existe et n\'expire pas bientot', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        accessToken: 'valid-token',
        tokenExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString()
      })
    );

    const config = await requestHandler().fulfilled({ headers: {}, url: '/api/dossiers' });
    expect((config as { headers: Record<string, string> }).headers['Authorization']).toBe('Bearer valid-token');
  });

  it("n'ajoute pas de token sur les endpoints publics d'authentification", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        accessToken: 'valid-token',
        tokenExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString()
      })
    );

    const config = await requestHandler().fulfilled({ headers: {}, url: '/api/auth/login' });
    expect((config as { headers: Record<string, string> }).headers['Authorization']).toBeUndefined();
  });

  it('ne remplace pas un en-tete Authorization deja present', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', accessToken: 'valid-token' })
    );

    const config = await requestHandler().fulfilled({
      headers: { Authorization: 'Bearer custom' },
      url: '/api/dossiers'
    });
    expect((config as { headers: Record<string, string> }).headers['Authorization']).toBe('Bearer custom');
  });

  it('efface la session si le token est expire et non rafraichissable', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        accessToken: 'expired-token',
        tokenExpiresAt: new Date(Date.now() - 60_000).toISOString()
      })
    );

    await requestHandler().fulfilled({ headers: {}, url: '/api/dossiers' });
    expect(useSessionStore.getState().session).toBeNull();
  });
});

describe('api response interceptor', () => {
  beforeEach(resetStore);
  afterEach(() => vi.restoreAllMocks());

  it('laisse passer une reponse reussie', () => {
    const response = { status: 200, data: { ok: true } };
    expect(responseHandler().fulfilled(response)).toBe(response);
  });

  it('efface la session sur une erreur 401 et rejette la promesse', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', accessToken: 'x' })
    );

    await expect(responseHandler().rejected({ response: { status: 401 } })).rejects.toBeDefined();
    expect(useSessionStore.getState().session).toBeNull();
  });

  it('conserve la session sur une erreur non-401', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', accessToken: 'x' })
    );

    await expect(responseHandler().rejected({ response: { status: 500 } })).rejects.toBeDefined();
    expect(useSessionStore.getState().session).not.toBeNull();
  });
});
