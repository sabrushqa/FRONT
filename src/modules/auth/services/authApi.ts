import api from '../../../core/api';
import { resolveBackendApiUrl } from '../../../core/apiUrl';
import { keycloakLogout } from '../../../core/keycloak';
import type { UserSessionResponse } from '../../../store/sessionStore';

const BASE_URL = resolveBackendApiUrl('/api/auth');

export interface LoginChallengeResponse {
  challengeId: string;
  otpRequired: boolean;
  message: string;
  expiresAt: string;
  otpDeliveryHint: string;
  devOtpPreview?: string | null;
}

export interface PasswordResetChallengeResponse {
  message: string;
  expiresAt: string;
  deliveryHint: string;
}

export interface PasswordResetResponse {
  message: string;
}

export interface ActivationResponse {
  message: string;
}

export type LoginResponse = LoginChallengeResponse | UserSessionResponse;
export type ActivateResponse = ActivationResponse | UserSessionResponse;

export async function login(payload: { email: string; password: string }): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>(`${BASE_URL}/login`, payload);
  return res.data;
}

export async function verifyOtp(payload: { challengeId: string; otp: string }): Promise<UserSessionResponse> {
  const res = await api.post<UserSessionResponse>(`${BASE_URL}/login/verify-otp`, payload);
  return res.data;
}

export async function activate(payload: {
  email: string;
  temporaryPassword: string;
  newPassword: string;
}): Promise<ActivateResponse> {
  const res = await api.post<ActivateResponse>(`${BASE_URL}/activate`, payload);
  return res.data;
}

export async function requestPasswordReset(payload: { email: string }): Promise<PasswordResetChallengeResponse> {
  const res = await api.post<PasswordResetChallengeResponse>(`${BASE_URL}/password-reset/request`, payload);
  return res.data;
}

export async function confirmPasswordReset(payload: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<PasswordResetResponse> {
  const res = await api.post<PasswordResetResponse>(`${BASE_URL}/password-reset/confirm`, payload);
  return res.data;
}

export async function currentSession(): Promise<UserSessionResponse> {
  const res = await api.get<UserSessionResponse>(`${BASE_URL}/me`);
  return res.data;
}

export async function currentSessionWithToken(accessToken: string): Promise<UserSessionResponse> {
  const res = await api.get<UserSessionResponse>(`${BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return res.data;
}

export async function logout(): Promise<{ message: string }> {
  await keycloakLogout();
  return { message: 'Vous avez été déconnecté.' };
}
