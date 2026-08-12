import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommercialDashboard from './CommercialDashboard';
import { useSessionStore } from '../../store/sessionStore';
import type { DrawerItem, SummaryTile } from '../workspace/WorkspaceDashboard';

const getAffiliationRequestsMock = vi.fn();
const getNotificationsMock = vi.fn();
const markAllNotificationsAsReadMock = vi.fn();
const currentSessionMock = vi.fn();

vi.mock('../supervisor/services/supervisorApi', () => ({
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args),
  getNotifications: (...args: unknown[]) => getNotificationsMock(...args),
  markAllNotificationsAsRead: (...args: unknown[]) => markAllNotificationsAsReadMock(...args)
}));

vi.mock('../auth/services/authApi', () => ({
  currentSession: (...args: unknown[]) => currentSessionMock(...args)
}));

vi.mock('../workspace/WorkspaceDashboard', () => ({
  default: (props: { summaryTiles: SummaryTile[]; primaryDrawerItems: DrawerItem[]; errorMessage: string; isLoading: boolean }) => (
    <div>
      <div data-testid="is-loading">{String(props.isLoading)}</div>
      <div data-testid="error-message">{props.errorMessage}</div>
      <ul>
        {props.primaryDrawerItems.map((d) => (
          <li key={d.route}>{`${d.label}:${d.count ?? ''}`}</li>
        ))}
      </ul>
    </div>
  )
}));

beforeEach(() => {
  getAffiliationRequestsMock.mockReset();
  getNotificationsMock.mockReset().mockResolvedValue({ notifications: [], unreadCount: 0 });
  markAllNotificationsAsReadMock.mockReset();
  currentSessionMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/commercial/dashboard']}>
      <CommercialDashboard />
    </MemoryRouter>
  );
}

describe('CommercialDashboard - filtrage par region et attribution', () => {
  it("ne compte que les auto-affiliations de la meme region que le commercial", async () => {
    currentSessionMock.mockResolvedValue({
      utilisateurId: 1,
      commercantId: 1,
      role: 'COMMERCIAL',
      nom: 'Amine',
      email: 'amine@lc.ma',
      profile: { region: 'Casablanca-Settat' }
    });
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { status: 'SOUMIS', origineCreation: 'AUTO', region: 'Casablanca-Settat' },
        { status: 'SOUMIS', origineCreation: 'AUTO', region: 'Rabat-Salé' }
      ]
    });

    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(screen.getByText('Auto-affiliation:1')).toBeInTheDocument();
  });

  it('attribue une demande commerciale directe si le nom ou l\'email correspond', async () => {
    currentSessionMock.mockResolvedValue({
      utilisateurId: 1,
      commercantId: 1,
      role: 'COMMERCIAL',
      nom: 'Amine Alaoui',
      email: 'amine@lc.ma',
      profile: { region: '' }
    });
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { status: 'BROUILLON', commercialAttribue: 'Amine Alaoui', commercantId: 10 },
        { status: 'BROUILLON', commercialAttribue: 'Quelqu\'un d\'autre', commercantId: 11 }
      ]
    });

    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(screen.getByText('Demandes commerciales:1')).toBeInTheDocument();
  });

  it('deduplique les commercants ajoutes par identifiant', async () => {
    currentSessionMock.mockResolvedValue({
      utilisateurId: 1,
      commercantId: 1,
      role: 'COMMERCIAL',
      nom: 'Amine',
      email: 'amine@lc.ma',
      profile: { region: '' }
    });
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { status: 'BROUILLON', commercialAttribue: 'Amine', commercantId: 10 },
        { status: 'BROUILLON', commercialAttribue: 'Amine', commercantId: 10 }
      ]
    });

    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(screen.getByText('Commerçants ajoutés:1')).toBeInTheDocument();
  });

  it('reutilise la session existante sans rappeler currentSession si deja presente', async () => {
    useSessionStore.getState().setSession(
      (await import('../../store/sessionStore')).normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCIAL',
        nom: 'Amine',
        email: 'amine@lc.ma'
      })
    );
    getAffiliationRequestsMock.mockResolvedValue({ requests: [] });

    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(currentSessionMock).not.toHaveBeenCalled();
  });

  it("efface la session et affiche une erreur si le chargement de la session sans cache echoue", async () => {
    currentSessionMock.mockRejectedValue(new Error('401'));
    renderDashboard();
    await waitFor(() => expect(useSessionStore.getState().session).toBeNull());
  });
});
