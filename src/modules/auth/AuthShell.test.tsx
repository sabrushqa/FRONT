import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthShell from './AuthShell';

vi.mock('./services/authApi', () => ({
  currentSessionWithToken: vi.fn(),
  verifyOtp: vi.fn(),
  requestPasswordReset: vi.fn(),
  activate: vi.fn()
}));

vi.mock('../../core/keycloak', () => ({
  getKeycloakToken: vi.fn().mockResolvedValue(''),
  getKeycloakRefreshToken: vi.fn().mockReturnValue(''),
  getKeycloakTokenExpiresAt: vi.fn().mockReturnValue(null),
  keycloakLoginWithRedirect: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('axios', () => ({
  default: { post: vi.fn(), isAxiosError: () => false }
}));

vi.mock('../../core/components/QuartierCombobox', () => ({
  default: () => <div data-testid="quartier-combobox" />
}));

vi.mock('../../core/components/PdvLocationPicker', () => ({
  default: () => <div data-testid="pdv-location-picker" />
}));

function renderShell(mode: 'login' | 'register' | 'forgot' | 'activate') {
  return render(
    <MemoryRouter>
      <AuthShell mode={mode} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('AuthShell', () => {
  it('affiche le formulaire de connexion en mode login', () => {
    renderShell('login');
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByText('Se connecter avec Keycloak')).toBeInTheDocument();
  });

  it('affiche le formulaire d\'inscription en mode register', () => {
    renderShell('register');
    expect(screen.getByText("Informations générales")).toBeInTheDocument();
  });

  it('affiche le formulaire de mot de passe oublie en mode forgot', () => {
    renderShell('forgot');
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.queryByText('Connexion')).toBeNull();
  });

  it('affiche le formulaire d\'activation en mode activate', () => {
    renderShell('activate');
    expect(screen.getByLabelText('Mot de passe temporaire')).toBeInTheDocument();
  });

  it('bascule le theme et le persiste en localStorage', () => {
    renderShell('login');
    fireEvent.click(screen.getByLabelText('Mode sombre'));
    expect(window.localStorage.getItem('app-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
