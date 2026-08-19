import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SupervisorAffiliationListPage from './SupervisorAffiliationListPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const getAffiliationRequestsMock = vi.fn();
const getOverviewMock = vi.fn();
const assignAffiliationToCommercialeMock = vi.fn();

vi.mock('../../services/supervisorApi', () => ({
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args),
  getOverview: (...args: unknown[]) => getOverviewMock(...args),
  assignAffiliationToCommerciale: (...args: unknown[]) => assignAffiliationToCommercialeMock(...args)
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <SupervisorAffiliationListPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  getAffiliationRequestsMock.mockReset().mockResolvedValue({ requests: [] });
  getOverviewMock.mockReset().mockResolvedValue({ backOffices: [], commerciales: [], commercants: [] });
  assignAffiliationToCommercialeMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('SupervisorAffiliationListPage', () => {
  it('exclut les demandes commerciales directes de la liste auto-affiliation', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'AUTO', nomCommercant: 'Auto SARL', status: 'SOUMIS' },
        { dossierId: 2, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'Direct SARL', status: 'BROUILLON' }
      ]
    });

    renderPage();

    expect(await screen.findByText('Auto SARL')).toBeInTheDocument();
    expect(screen.queryByText('Direct SARL')).toBeNull();
  });

  it("filtre par defaut sur les affiliations validees pour un role commercial", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'AUTO', nomCommercant: 'Actif SARL', status: 'ACTIF' },
        { dossierId: 2, origineCreation: 'AUTO', nomCommercant: 'Soumis SARL', status: 'SOUMIS' }
      ]
    });

    renderPage();

    expect(await screen.findByText('Actif SARL')).toBeInTheDocument();
    expect(screen.queryByText('Soumis SARL')).toBeNull();
  });

  it('filtre par recherche texte sur le nom du commercant', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'AUTO', nomCommercant: 'Alpha SARL', status: 'SOUMIS' },
        { dossierId: 2, origineCreation: 'AUTO', nomCommercant: 'Beta SARL', status: 'SOUMIS' }
      ]
    });

    renderPage();
    await screen.findByText('Alpha SARL');

    fireEvent.change(screen.getByPlaceholderText('Nom du commerçant, ville, e-mail ou numéro de dossier'), {
      target: { value: 'Beta' }
    });

    expect(screen.queryByText('Alpha SARL')).toBeNull();
    expect(screen.getByText('Beta SARL')).toBeInTheDocument();
  });

  it("n'affiche pas la liste pour un role sans acces (ex. commercant)", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT' })
    );

    renderPage();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getAffiliationRequestsMock).not.toHaveBeenCalled();
  });

  it("affiche un message d'erreur si le chargement echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockRejectedValue(new Error('503'));

    renderPage();
    expect(await screen.findByText('Impossible de charger la liste des dossiers.')).toBeInTheDocument();
  });

  it('assigne un dossier en attente a une commerciale de la meme region', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, origineCreation: 'AUTO', nomCommercant: 'ACME SARL', status: 'EN_ATTENTE_ASSIGNATION', region: 'Casablanca' }]
    });
    getOverviewMock.mockResolvedValue({
      backOffices: [],
      commerciales: [{ id: 9, nom: 'Alaoui', prenom: 'Amine', region: 'Casablanca', email: '', matricule: '', telephone: '', active: true }],
      commercants: []
    });
    assignAffiliationToCommercialeMock.mockResolvedValue({ message: 'Dossier assigné' });

    renderPage();
    await screen.findByText('ACME SARL');

    fireEvent.click(screen.getByRole('button', { name: 'Assigner' }));
    const row = screen.getByText('ACME SARL').closest('tr')!;
    const select = within(row).getByRole('combobox');
    fireEvent.change(select, { target: { value: '9' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Confirmer' }));

    await vi.waitFor(() => expect(assignAffiliationToCommercialeMock).toHaveBeenCalledWith(1, { commercialeId: 9 }));
  });

  it("annule l'assignation en cours sans appeler l'API", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, origineCreation: 'AUTO', nomCommercant: 'ACME SARL', status: 'EN_ATTENTE_ASSIGNATION', region: 'Casablanca' }]
    });

    renderPage();
    await screen.findByText('ACME SARL');

    fireEvent.click(screen.getByRole('button', { name: 'Assigner' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.getByRole('button', { name: 'Assigner' })).toBeInTheDocument();
    expect(assignAffiliationToCommercialeMock).not.toHaveBeenCalled();
  });

  it('filtre par statut, region et ville, puis reinitialise', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'AUTO', nomCommercant: 'Alpha SARL', status: 'ACTIF', region: 'Casablanca-Settat', ville: 'Casablanca' },
        { dossierId: 2, origineCreation: 'AUTO', nomCommercant: 'Beta SARL', status: 'SOUMIS', region: 'Rabat-Salé', ville: 'Rabat' }
      ]
    });

    renderPage();
    await screen.findByText('Alpha SARL');
    expect(screen.getByText('Beta SARL')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Validés/ }));
    expect(screen.getByText('Alpha SARL')).toBeInTheDocument();
    expect(screen.queryByText('Beta SARL')).toBeNull();

    const resetButton = screen.getByRole('button', { name: 'Réinitialiser' });
    expect(resetButton).not.toBeDisabled();
    fireEvent.click(resetButton);
    expect(screen.getByText('Alpha SARL')).toBeInTheDocument();
    expect(screen.getByText('Beta SARL')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Région'), { target: { value: 'Casablanca-Settat' } });
    expect(screen.getByText('Alpha SARL')).toBeInTheDocument();
    expect(screen.queryByText('Beta SARL')).toBeNull();
  });

  it('filtre par statut d\'assignation (non assignees / assignees)', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'AUTO', nomCommercant: 'Alpha SARL', status: 'EN_ATTENTE_ASSIGNATION', region: 'Casablanca-Settat', commercialAttribue: '' },
        { dossierId: 2, origineCreation: 'AUTO', nomCommercant: 'Beta SARL', status: 'SOUMIS', region: 'Casablanca-Settat', commercialAttribue: 'Amine Alaoui' }
      ]
    });

    renderPage();
    await screen.findByText('Alpha SARL');

    fireEvent.click(screen.getByRole('button', { name: /Non assignées/ }));
    expect(screen.getByText('Alpha SARL')).toBeInTheDocument();
    expect(screen.queryByText('Beta SARL')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Assignées/ }));
    expect(screen.queryByText('Alpha SARL')).toBeNull();
    expect(screen.getByText('Beta SARL')).toBeInTheDocument();
  });

  it('ouvre une fenetre d\'impression pour un dossier', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, origineCreation: 'AUTO', nomCommercant: 'Alpha SARL', status: 'SOUMIS' }]
    });
    const writeSpy = vi.fn();
    const closeSpy = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({
      document: { write: writeSpy, close: closeSpy }
    } as unknown as Window);

    renderPage();
    await screen.findByText('Alpha SARL');

    fireEvent.click(screen.getByRole('button', { name: 'Imprimer le dossier' }));

    expect(openSpy).toHaveBeenCalledWith('', '_blank', 'width=980,height=720');
    expect(writeSpy).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();

    openSpy.mockRestore();
  });

  it('pagine la liste avec plus de resultats que la taille de page', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    const requests = Array.from({ length: 10 }, (_, i) => ({
      dossierId: i + 1, origineCreation: 'AUTO', status: 'SOUMIS', nomCommercant: `Commercant${i}`
    }));
    getAffiliationRequestsMock.mockResolvedValue({ requests });

    renderPage();
    // Tri par dossierId decroissant : Commercant9 (dossierId 10) apparait en premier.
    await screen.findByText('Commercant9');
    expect(screen.queryByText('Commercant0')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(await screen.findByText('Commercant0')).toBeInTheDocument();
  });

  it("affiche une erreur si l'assignation echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, origineCreation: 'AUTO', nomCommercant: 'ACME SARL', status: 'EN_ATTENTE_ASSIGNATION', region: 'Casablanca' }]
    });
    getOverviewMock.mockResolvedValue({
      backOffices: [],
      commerciales: [{ id: 9, nom: 'Alaoui', prenom: 'Amine', region: 'Casablanca', email: '', matricule: '', telephone: '', active: true }],
      commercants: []
    });
    assignAffiliationToCommercialeMock.mockRejectedValue({});

    renderPage();
    await screen.findByText('ACME SARL');

    fireEvent.click(screen.getByRole('button', { name: 'Assigner' }));
    const row = screen.getByText('ACME SARL').closest('tr')!;
    fireEvent.change(within(row).getByRole('combobox'), { target: { value: '9' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByText("Impossible d'assigner ce dossier au commercial sélectionné.")).toBeInTheDocument();
  });
});
