import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SupervisorDashboard from './SupervisorDashboard';
import { useSessionStore } from '../../store/sessionStore';
import type { DrawerItem, SummaryTile } from '../workspace/WorkspaceDashboard';

const getOverviewMock = vi.fn();
const getAffiliationRequestsMock = vi.fn();
const getNotificationsMock = vi.fn();
const markAllNotificationsAsReadMock = vi.fn();
const currentSessionMock = vi.fn();

vi.mock('./services/supervisorApi', () => ({
  getOverview: (...args: unknown[]) => getOverviewMock(...args),
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args),
  getNotifications: (...args: unknown[]) => getNotificationsMock(...args),
  markAllNotificationsAsRead: (...args: unknown[]) => markAllNotificationsAsReadMock(...args)
}));

vi.mock('../auth/services/authApi', () => ({
  currentSession: (...args: unknown[]) => currentSessionMock(...args)
}));

vi.mock('../workspace/WorkspaceDashboard', () => ({
  default: (props: { summaryTiles: SummaryTile[]; primaryDrawerItems: DrawerItem[]; errorMessage: string; isLoading: boolean }) => (
    <div data-testid="workspace-dashboard">
      <div data-testid="error-message">{props.errorMessage}</div>
      <div data-testid="is-loading">{String(props.isLoading)}</div>
      <ul data-testid="summary-tiles">
        {props.summaryTiles.map((t) => (
          <li key={t.label}>{`${t.label}:${t.value}`}</li>
        ))}
      </ul>
      <ul data-testid="drawer-items">
        {props.primaryDrawerItems.map((d) => (
          <li key={d.route}>{d.label}</li>
        ))}
      </ul>
    </div>
  )
}));

function renderDashboard(initialPath = '/supervisor/overview') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SupervisorDashboard />
    </MemoryRouter>
  );
}

beforeEach(() => {
  getOverviewMock.mockReset();
  getAffiliationRequestsMock.mockReset().mockResolvedValue({ requests: [] });
  getNotificationsMock.mockReset().mockResolvedValue({ notifications: [], unreadCount: 0 });
  markAllNotificationsAsReadMock.mockReset();
  currentSessionMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('SupervisorDashboard - chargement de session', () => {
  it('charge la session pour un superviseur sans dupliquer les tuiles (deja affichees par la page overview dediee)', async () => {
    currentSessionMock.mockResolvedValue({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' });
    getOverviewMock.mockResolvedValue({
      backOffices: [{ id: 1 }],
      commerciales: [{ id: 1 }, { id: 2 }],
      commercants: [{ id: 1 }, { id: 2 }, { id: 3 }]
    });

    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(screen.getByTestId('error-message').textContent).toBe('');
    // La route /supervisor/overview affiche ses propres cartes (SupervisorOverviewPage) :
    // SupervisorDashboard ne doit pas rendre de tuiles resumees en double pour ce role.
    expect(screen.getByTestId('summary-tiles').children.length).toBe(0);
  });

  it('affiche les tuiles de statut d\'affiliation pour un role commercial (sans gestion staff)', async () => {
    currentSessionMock.mockResolvedValue({ utilisateurId: 2, commercantId: 2, role: 'COMMERCIAL' });
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ status: 'SOUMIS' }, { status: 'ACTIF' }, { status: 'ABANDONNE' }, { status: 'ACTIF' }]
    });

    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(screen.getByText('À compléter:1')).toBeInTheDocument();
    expect(screen.getByText('Refusés:1')).toBeInTheDocument();
  });

  it('affiche les elements du menu reserves aux superviseurs uniquement pour ce role', async () => {
    currentSessionMock.mockResolvedValue({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' });
    getOverviewMock.mockResolvedValue({ backOffices: [], commerciales: [], commercants: [] });

    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(screen.getByText('Stock TPE')).toBeInTheDocument();
    expect(screen.getByText('Réclamations TPE')).toBeInTheDocument();
  });

  it("n'affiche pas les elements reserves au superviseur pour un role commercial", async () => {
    currentSessionMock.mockResolvedValue({ utilisateurId: 2, commercantId: 2, role: 'COMMERCIAL' });

    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(screen.queryByText('Stock TPE')).toBeNull();
  });

  it('efface la session et affiche un message d\'erreur si le chargement de session echoue', async () => {
    // Ne pas pre-remplir le store : SupervisorDashboard court-circuite l'appel a
    // currentSession() quand une session existe deja (evite un aller-retour /me
    // inutile), donc il faut partir d'un store vide pour exercer ce chemin d'erreur.
    currentSessionMock.mockRejectedValue(new Error('401'));

    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('error-message').textContent).toBe('Votre session équipe est indisponible.'));
    expect(useSessionStore.getState().session).toBeNull();
  });
});
