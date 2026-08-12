import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CommercantDashboard from './CommercantDashboard';
import { useSessionStore } from '../../store/sessionStore';
import type { DrawerItem } from '../workspace/WorkspaceDashboard';

const currentSessionMock = vi.fn();

vi.mock('../auth/services/authApi', () => ({
  currentSession: (...args: unknown[]) => currentSessionMock(...args)
}));

vi.mock('../workspace/WorkspaceDashboard', () => ({
  default: (props: { primaryDrawerItems: DrawerItem[]; isLoading: boolean; headerExtra?: React.ReactNode }) => (
    <div>
      <div data-testid="is-loading">{String(props.isLoading)}</div>
      <div data-testid="header-extra">{props.headerExtra}</div>
      <ul>
        {props.primaryDrawerItems.map((d) => (
          <li key={d.route}>{d.label}</li>
        ))}
      </ul>
    </div>
  )
}));

function renderDashboard(initialPath = '/commercant/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/commercant/*" element={<CommercantDashboard />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  currentSessionMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
  useSessionStore.setState({ activeAffiliationProfile: 'ENCAISSEMENT' });
});

describe('CommercantDashboard - verrouillage du workspace', () => {
  it("redirige vers etat-dossier si le workspace n'est pas deverrouille", async () => {
    currentSessionMock.mockResolvedValue({
      utilisateurId: 1,
      commercantId: 1,
      role: 'COMMERCANT',
      workspaceUnlocked: false
    });

    renderDashboard('/commercant/dashboard');

    await waitFor(() => expect(screen.getByText('État demande')).toBeInTheDocument());
  });

  it('affiche le menu complet quand le workspace est deverrouille', async () => {
    currentSessionMock.mockResolvedValue({
      utilisateurId: 1,
      commercantId: 1,
      role: 'COMMERCANT',
      workspaceUnlocked: true,
      typeAffiliation: 'ENCAISSEMENT'
    });

    renderDashboard('/commercant/dashboard');

    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(screen.getByText('Points de vente')).toBeInTheDocument();
    expect(screen.getByText('Terminaux TPE')).toBeInTheDocument();
  });

  it('masque les points de vente et TPE pour un profil e-commerce', async () => {
    currentSessionMock.mockResolvedValue({
      utilisateurId: 1,
      commercantId: 1,
      role: 'COMMERCANT',
      workspaceUnlocked: true,
      typeAffiliation: 'E_COMMERCE'
    });

    renderDashboard('/commercant/dashboard');

    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(screen.queryByText('Points de vente')).toBeNull();
    expect(screen.queryByText('Terminaux TPE')).toBeNull();
  });

  it('affiche un menu reduit pour un sous-commercant', async () => {
    currentSessionMock.mockResolvedValue({
      utilisateurId: 2,
      commercantId: 1,
      role: 'SOUS_COMMERCANT',
      workspaceUnlocked: true,
      typeAffiliation: 'ENCAISSEMENT'
    });

    renderDashboard('/commercant/dashboard');

    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(screen.getByText('Infos PDV')).toBeInTheDocument();
    expect(screen.queryByText('Sous-commerçants')).toBeNull();
  });

  it('affiche le selecteur de profil pour une affiliation combinee', async () => {
    currentSessionMock.mockResolvedValue({
      utilisateurId: 1,
      commercantId: 1,
      role: 'COMMERCANT',
      workspaceUnlocked: true,
      typeAffiliation: 'ENCAISSEMENT_ET_ECOMMERCE'
    });

    renderDashboard('/commercant/dashboard');

    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(screen.getByRole('radiogroup', { name: 'Profil affiché' })).toBeInTheDocument();
  });

  it("n'affiche pas le selecteur de profil pour une affiliation simple", async () => {
    currentSessionMock.mockResolvedValue({
      utilisateurId: 1,
      commercantId: 1,
      role: 'COMMERCANT',
      workspaceUnlocked: true,
      typeAffiliation: 'ENCAISSEMENT'
    });

    renderDashboard('/commercant/dashboard');

    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
});
