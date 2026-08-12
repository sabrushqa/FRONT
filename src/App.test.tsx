import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { useSessionStore } from './store/sessionStore';

vi.mock('./modules/auth/services/authApi', () => ({
  currentSessionWithToken: vi.fn(),
  verifyOtp: vi.fn(),
  requestPasswordReset: vi.fn(),
  activate: vi.fn()
}));

vi.mock('./core/keycloak', () => ({
  getKeycloakToken: vi.fn().mockResolvedValue(''),
  getKeycloakRefreshToken: vi.fn().mockReturnValue(''),
  getKeycloakTokenExpiresAt: vi.fn().mockReturnValue(null),
  keycloakLoginWithRedirect: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    isAxiosError: () => false,
    create: () => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
      },
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn()
    })
  }
}));

vi.mock('./core/components/QuartierCombobox', () => ({
  default: () => <div data-testid="quartier-combobox" />
}));

vi.mock('./core/components/PdvLocationPicker', () => ({
  default: () => <div data-testid="pdv-location-picker" />
}));

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('App', () => {
  it('redirige la racine vers /login', async () => {
    renderApp('/');
    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
  });

  it('redirige une route inconnue vers /login', async () => {
    renderApp('/une-route-qui-n-existe-pas');
    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
  });

  it('redirige vers /login un acces a un espace superviseur sans session', async () => {
    renderApp('/supervisor/overview');
    expect(await screen.findByLabelText('E-mail')).toBeInTheDocument();
  });

  it('redirige /inscription vers /register', async () => {
    renderApp('/inscription');
    expect(await screen.findByText('Informations générales')).toBeInTheDocument();
  });
});
