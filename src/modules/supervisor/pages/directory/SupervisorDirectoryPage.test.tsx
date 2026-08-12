import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SupervisorDirectoryPage from './SupervisorDirectoryPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const getOverviewMock = vi.fn();
const deactivateBackOfficeMock = vi.fn();

vi.mock('../../services/supervisorApi', () => ({
  getOverview: (...args: unknown[]) => getOverviewMock(...args),
  deactivateBackOffice: (...args: unknown[]) => deactivateBackOfficeMock(...args),
  sendBackOfficeActivation: vi.fn(),
  deactivateCommerciale: vi.fn(),
  sendCommercialeActivation: vi.fn(),
  deactivateCommercant: vi.fn(),
  sendCommercantActivation: vi.fn()
}));

function renderPage(directoryType: 'backOffices' | 'commerciales' | 'commercants' = 'backOffices') {
  return render(
    <MemoryRouter>
      <SupervisorDirectoryPage directoryType={directoryType} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  getOverviewMock.mockReset().mockResolvedValue({ backOffices: [], commerciales: [], commercants: [] });
  deactivateBackOfficeMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
  useSessionStore.getState().setSession(
    normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
  );
});

describe('SupervisorDirectoryPage', () => {
  it('affiche les back offices', async () => {
    getOverviewMock.mockResolvedValue({
      backOffices: [{ id: 1, nom: 'Doe', prenom: 'John', email: 'j@d.com', active: true }],
      commerciales: [],
      commercants: []
    });

    renderPage('backOffices');
    expect(await screen.findByText('John Doe')).toBeInTheDocument();
  });

  it('desactive un back office et rafraichit la liste sans effacer le message', async () => {
    getOverviewMock.mockResolvedValue({
      backOffices: [{ id: 1, nom: 'Doe', prenom: 'John', email: 'j@d.com', active: true }],
      commerciales: [],
      commercants: []
    });
    deactivateBackOfficeMock.mockResolvedValue({ message: 'Compte désactivé' });

    renderPage('backOffices');
    fireEvent.click(await screen.findByRole('button', { name: 'Désactiver' }));

    expect(await screen.findByText('Compte désactivé')).toBeInTheDocument();
  });

  it("n'appelle pas getOverview pour un role sans gestion staff", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    renderPage('backOffices');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getOverviewMock).not.toHaveBeenCalled();
  });

  it("affiche un message d'erreur si le chargement echoue", async () => {
    getOverviewMock.mockRejectedValue(new Error('503'));
    renderPage('commercants');
    expect(await screen.findByText('Impossible de charger cette liste.')).toBeInTheDocument();
  });
});
