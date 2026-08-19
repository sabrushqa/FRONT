import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommercialCalendarPage from './CommercialCalendarPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const getAffiliationRequestsMock = vi.fn();
const getGoogleCalendarStatusMock = vi.fn();
const beginGoogleCalendarAuthorizationMock = vi.fn();
const completeGoogleCalendarAuthorizationMock = vi.fn();
const getMicrosoftCalendarStatusMock = vi.fn();
const beginMicrosoftCalendarAuthorizationMock = vi.fn();
const completeMicrosoftCalendarAuthorizationMock = vi.fn();

vi.mock('../../../supervisor/services/supervisorApi', () => ({
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args),
  getGoogleCalendarStatus: (...args: unknown[]) => getGoogleCalendarStatusMock(...args),
  beginGoogleCalendarAuthorization: (...args: unknown[]) => beginGoogleCalendarAuthorizationMock(...args),
  completeGoogleCalendarAuthorization: (...args: unknown[]) => completeGoogleCalendarAuthorizationMock(...args),
  getMicrosoftCalendarStatus: (...args: unknown[]) => getMicrosoftCalendarStatusMock(...args),
  beginMicrosoftCalendarAuthorization: (...args: unknown[]) => beginMicrosoftCalendarAuthorizationMock(...args),
  completeMicrosoftCalendarAuthorization: (...args: unknown[]) => completeMicrosoftCalendarAuthorizationMock(...args)
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <CommercialCalendarPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  getAffiliationRequestsMock.mockReset().mockResolvedValue({ requests: [] });
  getGoogleCalendarStatusMock.mockReset().mockResolvedValue({
    configured: true,
    connected: false,
    message: 'Connectez Google Calendar.'
  });
  beginGoogleCalendarAuthorizationMock.mockReset();
  completeGoogleCalendarAuthorizationMock.mockReset();
  getMicrosoftCalendarStatusMock.mockReset().mockResolvedValue({
    configured: true,
    connected: false,
    message: 'Connectez Outlook Calendar.'
  });
  beginMicrosoftCalendarAuthorizationMock.mockReset();
  completeMicrosoftCalendarAuthorizationMock.mockReset();
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  useSessionStore.getState().clearSession();
});

function todayIso(): string {
  return new Date().toISOString();
}

describe('CommercialCalendarPage', () => {
  it("n'affiche que les prospections directes du mois courant en vue agenda", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        {
          dossierId: 1, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'Prospect Ce Mois',
          prochaineRelanceCommerciale: todayIso(), prochaineRelanceType: 'APPEL'
        },
        {
          dossierId: 2, origineCreation: 'AUTO', nomCommercant: 'PasProspection',
          prochaineRelanceCommerciale: todayIso(), prochaineRelanceType: 'APPEL'
        }
      ]
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Agenda' }));

    expect(await screen.findByText('Prospect Ce Mois')).toBeInTheDocument();
    expect(screen.queryByText('PasProspection')).toBeNull();
  });

  it('filtre les evenements par type', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'Appel Prevu', prochaineRelanceCommerciale: todayIso(), prochaineRelanceType: 'APPEL' },
        { dossierId: 2, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'Visite Prevue', prochaineRelanceCommerciale: todayIso(), prochaineRelanceType: 'VISITE' }
      ]
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Agenda' }));
    await screen.findByText('Appel Prevu');

    const filterButton = screen.getAllByText('Appel').map((el) => el.closest('button.type-filter')).find(Boolean)!;
    fireEvent.click(filterButton);

    expect(screen.getByText('Appel Prevu')).toBeInTheDocument();
    expect(screen.queryByText('Visite Prevue')).toBeNull();
  });

  it("affiche un etat vide quand aucun evenement n'est planifie ce mois-ci", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Agenda' }));

    expect(await screen.findByText('Aucune tâche planifiée ce mois-ci')).toBeInTheDocument();
  });

  it("affiche un message d'erreur si le chargement echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockRejectedValue(new Error('503'));

    renderPage();
    expect(await screen.findByText('Impossible de charger le calendrier commercial.')).toBeInTheDocument();
  });

  it('propose la connexion Google Calendar au commercial', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );

    render(
      <StrictMode>
        <MemoryRouter>
          <CommercialCalendarPage />
        </MemoryRouter>
      </StrictMode>
    );

    expect(await screen.findByRole('button', { name: 'Connecter Google' })).toBeEnabled();
    expect(getGoogleCalendarStatusMock).toHaveBeenCalled();
  });

  it("explique pourquoi la connexion Google Calendar est indisponible", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getGoogleCalendarStatusMock.mockResolvedValue({
      configured: false,
      connected: false,
      message: 'Google Calendar doit être configuré par l’administrateur.'
    });

    renderPage();

    expect(await screen.findByText('Google Calendar doit être configuré par l’administrateur.'))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connecter Google' })).toBeDisabled();
  });

  it('propose la connexion Outlook Calendar au commercial', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );

    renderPage();

    expect(await screen.findByRole('button', { name: 'Connecter Outlook' })).toBeEnabled();
    expect(getMicrosoftCalendarStatusMock).toHaveBeenCalled();
  });

  it('traite le retour OAuth Microsoft sans le confondre avec Google', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    completeMicrosoftCalendarAuthorizationMock.mockResolvedValue({
      configured: true,
      connected: true,
      message: 'Outlook Calendar est connecté.'
    });
    window.history.replaceState(
      {},
      '',
      '/commercial/calendrier?code=microsoft-code&state=microsoft.random-state'
    );

    renderPage();

    expect(await screen.findByText('Outlook Calendar est maintenant connecté.')).toBeInTheDocument();
    expect(completeMicrosoftCalendarAuthorizationMock)
      .toHaveBeenCalledWith('microsoft-code', 'microsoft.random-state');
    expect(completeGoogleCalendarAuthorizationMock).not.toHaveBeenCalled();
  });

  it("explique pourquoi la connexion Outlook Calendar est indisponible", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getMicrosoftCalendarStatusMock.mockResolvedValue({
      configured: false,
      connected: false,
      message: 'Outlook Calendar doit être configuré par l’administrateur.'
    });

    renderPage();

    expect(await screen.findByText('Outlook Calendar doit être configuré par l’administrateur.'))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connecter Outlook' })).toBeDisabled();
  });

  it("affiche un message d'annulation quand l'utilisateur refuse la connexion Google", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    window.history.replaceState({}, '', '/commercial/calendrier?error=access_denied&state=google.xyz');

    renderPage();

    expect(await screen.findByText('Connexion Google Calendar annulée.')).toBeInTheDocument();
  });

  it("affiche un message d'annulation quand l'utilisateur refuse la connexion Outlook", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    window.history.replaceState({}, '', '/commercial/calendrier?error=access_denied&state=microsoft.xyz');

    renderPage();

    expect(await screen.findByText('Connexion Outlook Calendar annulée.')).toBeInTheDocument();
  });

  it("affiche une erreur si la conversion du retour Google echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    completeGoogleCalendarAuthorizationMock.mockRejectedValue(new Error('503'));
    window.history.replaceState({}, '', '/commercial/calendrier?code=google-code&state=google.random-state');

    renderPage();

    expect(await screen.findByText('Impossible de connecter Google Calendar. Veuillez réessayer.')).toBeInTheDocument();
  });

  it('demarre la connexion Google Calendar et redirige vers son URL d\'autorisation', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    beginGoogleCalendarAuthorizationMock.mockResolvedValue({ authorizationUrl: 'https://accounts.google.com/oauth' });
    const assignSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, assign: assignSpy }
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Connecter Google' }));

    await vi.waitFor(() => expect(assignSpy).toHaveBeenCalledWith('https://accounts.google.com/oauth'));
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it("affiche une erreur si le demarrage de la connexion Google echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    beginGoogleCalendarAuthorizationMock.mockRejectedValue(new Error('503'));

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Connecter Google' }));

    expect(await screen.findByText('Impossible de démarrer la connexion Google Calendar.')).toBeInTheDocument();
  });

  it("affiche une erreur si le demarrage de la connexion Outlook echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    beginMicrosoftCalendarAuthorizationMock.mockRejectedValue(new Error('503'));

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Connecter Outlook' }));

    expect(await screen.findByText('Impossible de démarrer la connexion Outlook Calendar.')).toBeInTheDocument();
  });

  it('navigue au mois precedent, suivant, puis revient a aujourd\'hui', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );

    renderPage();
    await screen.findByRole('button', { name: 'Connecter Google' });
    const heading = document.querySelector('h1')!;
    const initialLabel = heading.textContent;

    fireEvent.click(screen.getByRole('button', { name: 'Mois précédent' }));
    expect(document.querySelector('h1')!.textContent).not.toBe(initialLabel);

    fireEvent.click(screen.getByRole('button', { name: 'Mois suivant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mois suivant' }));
    expect(document.querySelector('h1')!.textContent).not.toBe(initialLabel);

    fireEvent.click(screen.getByRole('button', { name: "Aujourd'hui" }));
    expect(document.querySelector('h1')!.textContent).toBe(initialLabel);
  });
});
