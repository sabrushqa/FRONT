import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import { useSessionStore } from '../../store/sessionStore';

const currentSessionWithTokenMock = vi.fn();
const verifyOtpMock = vi.fn();
const getKeycloakTokenMock = vi.fn();
const getKeycloakRefreshTokenMock = vi.fn().mockReturnValue('refresh-token');
const getKeycloakTokenExpiresAtMock = vi.fn().mockReturnValue(null);
const keycloakLoginWithRedirectMock = vi.fn();

vi.mock('./services/authApi', () => ({
  currentSessionWithToken: (...args: unknown[]) => currentSessionWithTokenMock(...args),
  verifyOtp: (...args: unknown[]) => verifyOtpMock(...args)
}));

vi.mock('../../core/keycloak', () => ({
  getKeycloakToken: (...args: unknown[]) => getKeycloakTokenMock(...args),
  getKeycloakRefreshToken: (...args: unknown[]) => getKeycloakRefreshTokenMock(...args),
  getKeycloakTokenExpiresAt: (...args: unknown[]) => getKeycloakTokenExpiresAtMock(...args),
  keycloakLoginWithRedirect: (...args: unknown[]) => keycloakLoginWithRedirectMock(...args)
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

beforeEach(() => {
  currentSessionWithTokenMock.mockReset();
  verifyOtpMock.mockReset();
  getKeycloakTokenMock.mockReset().mockResolvedValue('');
  keycloakLoginWithRedirectMock.mockReset().mockResolvedValue(undefined);
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('Login - au montage', () => {
  it("n'affiche aucune erreur si aucune session SSO Keycloak n'est active", async () => {
    renderLogin();
    await waitFor(() => expect(getKeycloakTokenMock).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it("recupere la session et redirige si un token Keycloak SSO est deja present", async () => {
    getKeycloakTokenMock.mockResolvedValue('sso-token');
    currentSessionWithTokenMock.mockResolvedValue({
      utilisateurId: 1,
      commercantId: 1,
      role: 'COMMERCANT',
      message: 'Bienvenue'
    });

    renderLogin();

    await waitFor(() => expect(currentSessionWithTokenMock).toHaveBeenCalledWith('sso-token'));
    await waitFor(() => expect(useSessionStore.getState().session?.role).toBe('COMMERCANT'));
  });

  it('affiche un message d\'erreur si Keycloak est totalement inaccessible', async () => {
    getKeycloakTokenMock.mockRejectedValue(new Error('unreachable'));
    renderLogin();
    expect(await screen.findByText(/Keycloak est inaccessible/i)).toBeInTheDocument();
  });
});

describe('Login - soumission du formulaire', () => {
  it('saisit un email et declenche la redirection Keycloak', async () => {
    renderLogin();
    await waitFor(() => expect(getKeycloakTokenMock).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: '  user@example.com  ' } });
    fireEvent.click(screen.getByRole('button', { name: /se connecter avec keycloak/i }));

    await waitFor(() => expect(keycloakLoginWithRedirectMock).toHaveBeenCalledWith('user@example.com'));
  });

  it('affiche une erreur si la redirection Keycloak echoue', async () => {
    keycloakLoginWithRedirectMock.mockRejectedValue(new Error('down'));
    renderLogin();
    await waitFor(() => expect(getKeycloakTokenMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /se connecter avec keycloak/i }));

    expect(await screen.findByText(/Redirection vers Keycloak impossible/i)).toBeInTheDocument();
  });
});

describe('Login - liens secondaires', () => {
  it('appelle onForgotPassword au clic sur "Mot de passe oublié ?"', async () => {
    const onForgotPassword = vi.fn();
    render(
      <MemoryRouter>
        <Login onForgotPassword={onForgotPassword} />
      </MemoryRouter>
    );
    await waitFor(() => expect(getKeycloakTokenMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Mot de passe oublié ?' }));
    expect(onForgotPassword).toHaveBeenCalledTimes(1);
  });

  it('appelle onActivateAccount au clic sur "Activer mon compte"', async () => {
    const onActivateAccount = vi.fn();
    render(
      <MemoryRouter>
        <Login onActivateAccount={onActivateAccount} />
      </MemoryRouter>
    );
    await waitFor(() => expect(getKeycloakTokenMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Activer mon compte' }));
    expect(onActivateAccount).toHaveBeenCalledTimes(1);
  });

  it('appelle onSwitchMode au clic sur "Devenir client"', async () => {
    const onSwitchMode = vi.fn();
    render(
      <MemoryRouter>
        <Login onSwitchMode={onSwitchMode} />
      </MemoryRouter>
    );
    await waitFor(() => expect(getKeycloakTokenMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Devenir client' }));
    expect(onSwitchMode).toHaveBeenCalledTimes(1);
  });

  it('permet de cocher "Se souvenir de moi"', async () => {
    renderLogin();
    await waitFor(() => expect(getKeycloakTokenMock).toHaveBeenCalled());

    const checkbox = screen.getByLabelText('Se souvenir de moi') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });
});
