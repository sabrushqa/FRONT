import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CommercantDashboard from './CommercantDashboard';
import { useSessionStore, normalizeUserSessionResponse } from '../../store/sessionStore';
import type { DrawerItem } from '../workspace/WorkspaceDashboard';

const currentSessionMock = vi.fn();

vi.mock('../auth/services/authApi', () => ({
  currentSession: (...args: unknown[]) => currentSessionMock(...args)
}));

// Sans ce mock, l'effet de la cloche de notifications (CommercantDashboard::
// loadNotifications) declenche un vrai appel axios non mocke a chaque test
// ou le workspace est deverrouille — resolu/rejete de facon asynchrone,
// potentiellement APRES la fin du test qui l'a declenche, ce qui polluait
// les assertions des tests suivants (setState sur un composant deja
// demonte/re-render inattendu).
const getMerchantNotificationsMock = vi.fn().mockResolvedValue({ unreadCount: 0, notifications: [] });
const markMerchantNotificationsAsReadMock = vi.fn().mockResolvedValue({ unreadCount: 0, notifications: [] });

vi.mock('./services/commercantApi', () => ({
  getMerchantNotifications: (...args: unknown[]) => getMerchantNotificationsMock(...args),
  markMerchantNotificationsAsRead: (...args: unknown[]) => markMerchantNotificationsAsReadMock(...args)
}));

vi.mock('../workspace/WorkspaceDashboard', () => ({
  default: (props: {
    primaryDrawerItems: DrawerItem[];
    isLoading: boolean;
    headerExtra?: React.ReactNode;
    notificationItems?: { notificationId: number; title: string }[];
    unseenNotificationCount?: number;
  }) => (
    <div>
      <div data-testid="is-loading">{String(props.isLoading)}</div>
      <div data-testid="header-extra">{props.headerExtra}</div>
      <div data-testid="unseen-count">{props.unseenNotificationCount ?? 0}</div>
      <ul data-testid="notifications">
        {(props.notificationItems ?? []).map((n) => (
          <li key={n.notificationId}>{n.title}</li>
        ))}
      </ul>
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
  getMerchantNotificationsMock.mockReset().mockResolvedValue({ unreadCount: 0, notifications: [] });
  markMerchantNotificationsAsReadMock.mockReset().mockResolvedValue({ unreadCount: 0, notifications: [] });
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
    // Sous-commercants n'est propose que pour le canal encaissement (TPE) —
    // cf. CommercantSubCommercantsPage.tsx.
    expect(screen.queryByText('Sous-commerçants')).toBeNull();
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
    // Le chat/reclamations (backend deja scope au PDV du sous-commercant)
    // doit etre accessible depuis la navigation, pas seulement par URL directe.
    expect(screen.getByText('Réclamations')).toBeInTheDocument();
    expect(screen.getByText('Mes réclamations')).toBeInTheDocument();
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

  it('rafraichit toujours la session en arriere-plan meme quand une session est deja en cache (extension approuvee entretemps)', async () => {
    // Simule un commerçant qui etait deja connecte (session en cache) au
    // moment ou le back-office valide sa demande d'extension et affecte un
    // TPE : sans le correctif, currentSession() n'etait jamais rappele et le
    // nouveau PDV/TPE restaient invisibles jusqu'a une deconnexion complete.
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', workspaceUnlocked: true,
        typeAffiliation: 'ENCAISSEMENT',
        summary: { totalTransactions: 0, totalPdvs: 1, totalTpes: 1, totalSousCommercants: 0 }
      })
    );
    currentSessionMock.mockResolvedValue({
      utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', workspaceUnlocked: true,
      typeAffiliation: 'ENCAISSEMENT',
      summary: { totalTransactions: 0, totalPdvs: 2, totalTpes: 2, totalSousCommercants: 0 }
    });

    renderDashboard();

    await waitFor(() => expect(currentSessionMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(useSessionStore.getState().session?.summary.totalPdvs).toBe(2)
    );
    expect(useSessionStore.getState().session?.summary.totalTpes).toBe(2);
  });

  it('conserve la session en cache si le rafraichissement en arriere-plan echoue (pas de deconnexion intempestive)', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', workspaceUnlocked: true,
        typeAffiliation: 'ENCAISSEMENT'
      })
    );
    currentSessionMock.mockRejectedValue(new Error('network down'));

    renderDashboard();

    await waitFor(() => expect(currentSessionMock).toHaveBeenCalledTimes(1));
    expect(useSessionStore.getState().session).not.toBeNull();
  });

  it('charge les notifications (contrat de nouveau PDV) une fois le workspace deverrouille', async () => {
    currentSessionMock.mockResolvedValue({
      utilisateurId: 1,
      commercantId: 1,
      role: 'COMMERCANT',
      workspaceUnlocked: true,
      typeAffiliation: 'ENCAISSEMENT'
    });
    getMerchantNotificationsMock.mockResolvedValue({
      unreadCount: 1,
      notifications: [{
        notificationId: 42,
        dossierId: 7,
        message: 'Votre contrat de nouveau point de vente est disponible.',
        type: 'CONTRAT_GENERE',
        dateEnvoi: '2026-08-17',
        read: false
      }]
    });

    renderDashboard('/commercant/dashboard');

    expect(await screen.findByText('Votre contrat de nouveau point de vente est disponible.')).toBeInTheDocument();
    expect(screen.getByTestId('unseen-count').textContent).toBe('1');
  });

  it('ne charge pas les notifications pour un sous-commercant ni tant que le workspace est verrouille', async () => {
    currentSessionMock.mockResolvedValue({
      utilisateurId: 2,
      commercantId: 1,
      role: 'SOUS_COMMERCANT',
      workspaceUnlocked: true,
      typeAffiliation: 'ENCAISSEMENT'
    });

    renderDashboard('/commercant/dashboard');

    await waitFor(() => expect(screen.getByTestId('is-loading').textContent).toBe('false'));
    expect(getMerchantNotificationsMock).not.toHaveBeenCalled();
  });
});
