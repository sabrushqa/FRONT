import { describe, it, expect, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();
const keycloakLogoutMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../core/api', () => ({
  default: { get: (...args: unknown[]) => getMock(...args), post: (...args: unknown[]) => postMock(...args) }
}));

vi.mock('../../../core/keycloak', () => ({
  keycloakLogout: (...args: unknown[]) => keycloakLogoutMock(...args)
}));

import * as authApi from './authApi';

const BASE = 'http://127.0.0.1:8000/api/auth';

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  keycloakLogoutMock.mockClear();
});

describe('login', () => {
  it('poste les identifiants et renvoie la reponse (challenge ou session)', async () => {
    postMock.mockResolvedValue({ data: { challengeId: 'c1', otpRequired: true } });
    const result = await authApi.login({ email: 'a@b.com', password: 'secret' });
    expect(postMock).toHaveBeenCalledWith(`${BASE}/login`, { email: 'a@b.com', password: 'secret' });
    expect(result).toEqual({ challengeId: 'c1', otpRequired: true });
  });
});

describe('verifyOtp', () => {
  it('poste le challengeId et le code otp', async () => {
    postMock.mockResolvedValue({ data: { utilisateurId: 1 } });
    await authApi.verifyOtp({ challengeId: 'c1', otp: '123456' });
    expect(postMock).toHaveBeenCalledWith(`${BASE}/login/verify-otp`, { challengeId: 'c1', otp: '123456' });
  });
});

describe('activate', () => {
  it('poste les identifiants d\'activation', async () => {
    const payload = { email: 'a@b.com', temporaryPassword: 'temp', newPassword: 'new' };
    postMock.mockResolvedValue({ data: { message: 'active' } });
    await authApi.activate(payload);
    expect(postMock).toHaveBeenCalledWith(`${BASE}/activate`, payload);
  });
});

describe('requestPasswordReset / confirmPasswordReset', () => {
  it('demande une reinitialisation par email', async () => {
    postMock.mockResolvedValue({ data: { message: 'ok', expiresAt: '', deliveryHint: '' } });
    await authApi.requestPasswordReset({ email: 'a@b.com' });
    expect(postMock).toHaveBeenCalledWith(`${BASE}/password-reset/request`, { email: 'a@b.com' });
  });

  it('confirme la reinitialisation avec le code et le nouveau mot de passe', async () => {
    const payload = { email: 'a@b.com', code: '000000', newPassword: 'new' };
    postMock.mockResolvedValue({ data: { message: 'ok' } });
    await authApi.confirmPasswordReset(payload);
    expect(postMock).toHaveBeenCalledWith(`${BASE}/password-reset/confirm`, payload);
  });
});

describe('currentSession / currentSessionWithToken', () => {
  it('recupere la session courante', async () => {
    getMock.mockResolvedValue({ data: { utilisateurId: 1 } });
    await authApi.currentSession();
    expect(getMock).toHaveBeenCalledWith(`${BASE}/me`);
  });

  it('recupere la session avec un token explicite en en-tete', async () => {
    getMock.mockResolvedValue({ data: { utilisateurId: 1 } });
    await authApi.currentSessionWithToken('my-token');
    expect(getMock).toHaveBeenCalledWith(`${BASE}/me`, { headers: { Authorization: 'Bearer my-token' } });
  });
});

describe('logout', () => {
  it('appelle keycloakLogout et renvoie un message de confirmation', async () => {
    const result = await authApi.logout();
    expect(keycloakLogoutMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ message: 'Vous avez été déconnecté.' });
  });
});
