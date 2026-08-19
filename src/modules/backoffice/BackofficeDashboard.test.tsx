import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BackofficeDashboard from './BackofficeDashboard';
import { useSessionStore } from '../../store/sessionStore';
import type { DrawerItem, SummaryTile } from '../workspace/WorkspaceDashboard';

const getAffiliationRequestsMock = vi.fn();
const getReclamationStatsMock = vi.fn();
const currentSessionMock = vi.fn();
const getNotificationsMock = vi.fn();
const markAllNotificationsAsReadMock = vi.fn();

vi.mock('../supervisor/services/supervisorApi', () => ({
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args),
  getNotifications: (...args: unknown[]) => getNotificationsMock(...args),
  markAllNotificationsAsRead: (...args: unknown[]) => markAllNotificationsAsReadMock(...args)
}));

vi.mock('./services/reclamationsApi', () => ({
  getReclamationStats: (...args: unknown[]) => getReclamationStatsMock(...args)
}));

vi.mock('../auth/services/authApi', () => ({
  currentSession: (...args: unknown[]) => currentSessionMock(...args)
}));

vi.mock('../workspace/WorkspaceDashboard', () => ({
  default: (props: {
    summaryTiles: SummaryTile[];
    primaryDrawerItems: DrawerItem[];
    errorMessage: string;
    isLoading: boolean;
    notificationItems?: { notificationId: number; title: string; route: string }[];
    unseenNotificationCount?: number;
  }) => (
    <div>
      <div data-testid="is-loading">{String(props.isLoading)}</div>
      <div data-testid="error-message">{props.errorMessage}</div>
      <div data-testid="unseen-count">{props.unseenNotificationCount ?? 0}</div>
      <ul data-testid="notifications">
        {(props.notificationItems ?? []).map((n) => (
          <li key={n.notificationId}>{`${n.title}|${n.route}`}</li>
        ))}
      </ul>
      <ul>
        {props.summaryTiles.map((t) => (
          <li key={t.label}>{`${t.label}:${t.value}`}</li>
        ))}
        {props.primaryDrawerItems.map((d) => (
          <li key={d.route}>{d.label}</li>
        ))}
      </ul>
    </div>
  )
}));

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/backoffice/dashboard']}>
      <BackofficeDashboard />
    </MemoryRouter>
  );
}

beforeEach(() => {
  getAffiliationRequestsMock.mockReset().mockResolvedValue({ requests: [] });
  getReclamationStatsMock.mockReset().mockResolvedValue({ EN_COURS: 0, EN_ATTENTE: 0 });
  currentSessionMock.mockReset();
  getNotificationsMock.mockReset().mockResolvedValue({ unreadCount: 0, notifications: [] });
  markAllNotificationsAsReadMock.mockReset().mockResolvedValue({ unreadCount: 0, notifications: [] });
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('BackofficeDashboard', () => {
  it('ne compte que les dossiers auto en attente de validation BOA', async () => {
    currentSessionMock.mockResolvedValue({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' });
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { status: 'EN_ATTENTE_VALIDATION_BOA', origineCreation: 'AUTO' },
        { status: 'ACTIF', origineCreation: 'AUTO' }
      ]
    });

    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(screen.getByText('Dossier Auto-affiliation')).toBeInTheDocument();
  });

  it('additionne EN_COURS et EN_ATTENTE pour les reclamations actives', async () => {
    currentSessionMock.mockResolvedValue({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' });
    getReclamationStatsMock.mockResolvedValue({ EN_COURS: 3, EN_ATTENTE: 2 });

    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(screen.getByText('Réclamations à traiter:5')).toBeInTheDocument();
  });

  it("n'appelle pas getReclamationStats si peutGererReclamations est false", async () => {
    currentSessionMock.mockResolvedValue({
      utilisateurId: 1,
      commercantId: 1,
      role: 'BACK_OFFICE',
      peutGererReclamations: false
    });

    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(getReclamationStatsMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Réclamations TPE')).toBeNull();
  });

  it("masque les elements dossiers si peutValiderDossiers est false", async () => {
    currentSessionMock.mockResolvedValue({
      utilisateurId: 1,
      commercantId: 1,
      role: 'BACK_OFFICE',
      peutValiderDossiers: false
    });

    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(screen.queryByText('Dossier Auto-affiliation')).toBeNull();
  });

  it('affiche un avertissement si les stats de reclamations echouent sans faire echouer tout le chargement', async () => {
    currentSessionMock.mockResolvedValue({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' });
    getReclamationStatsMock.mockRejectedValue(new Error('503'));

    renderDashboard();

    await waitFor(() =>
      expect(screen.getByTestId('error-message').textContent).toBe(
        'Le nombre de réclamations actives est momentanément indisponible.'
      )
    );
  });

  it("route une notification DOSSIER_TPE_A_AFFECTER (affiliation initiale) vers la liste tpe-a-affecter, pas vers le dossier precis", async () => {
    currentSessionMock.mockResolvedValue({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' });
    getNotificationsMock.mockResolvedValue({
      unreadCount: 1,
      notifications: [{
        notificationId: 1,
        dossierId: 42,
        message: 'Le contrat du dossier #42 a été signé — une référence TPE doit être affectée.',
        type: 'DOSSIER_TPE_A_AFFECTER',
        dateEnvoi: '2026-08-18',
        read: false,
        isNewPdvRequest: false
      }]
    });

    renderDashboard();

    expect(await screen.findByText(/\/backoffice\/tpe-a-affecter$/)).toBeInTheDocument();
    expect(screen.getByTestId('unseen-count').textContent).toBe('1');
  });

  it("route une notification DOSSIER_TPE_A_AFFECTER d'extension (NOUVEAU_PDV) vers la meme liste tpe-a-affecter", async () => {
    currentSessionMock.mockResolvedValue({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' });
    getNotificationsMock.mockResolvedValue({
      unreadCount: 1,
      notifications: [{
        notificationId: 2,
        dossierId: 43,
        message: 'Le contrat du dossier #43 a été signé — une référence TPE doit être affectée.',
        type: 'DOSSIER_TPE_A_AFFECTER',
        dateEnvoi: '2026-08-18',
        read: false,
        isNewPdvRequest: true
      }]
    });

    renderDashboard();

    expect(await screen.findByText(/\/backoffice\/tpe-a-affecter$/)).toBeInTheDocument();
  });

  it("route une notification d'un autre type (ex. DOSSIER_A_VALIDER_BOA) vers le dossier precis, comportement inchange", async () => {
    currentSessionMock.mockResolvedValue({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' });
    getNotificationsMock.mockResolvedValue({
      unreadCount: 1,
      notifications: [{
        notificationId: 3,
        dossierId: 44,
        message: 'Un dossier est pret pour validation.',
        type: 'DOSSIER_A_VALIDER_BOA',
        dateEnvoi: '2026-08-18',
        read: false,
        isNewPdvRequest: false
      }]
    });

    renderDashboard();

    expect(await screen.findByText(/dossiers\/44$/)).toBeInTheDocument();
  });
});
