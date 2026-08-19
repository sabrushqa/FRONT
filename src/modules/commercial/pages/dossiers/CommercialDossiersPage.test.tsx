import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommercialDossiersPage from './CommercialDossiersPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const getAffiliationRequestsMock = vi.fn();

vi.mock('../../../supervisor/services/supervisorApi', () => ({
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args)
}));

function renderPage(requestScope: 'auto' | 'new-pdv' = 'auto') {
  return render(
    <MemoryRouter>
      <CommercialDossiersPage requestScope={requestScope} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  getAffiliationRequestsMock.mockReset().mockResolvedValue({ requests: [] });
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('CommercialDossiersPage', () => {
  it('scope auto: montre les dossiers auto-affiliation, exclut prospections et extension pour un commercial', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'AUTO', status: 'ACTIF', nomCommercant: 'Auto SARL' },
        { dossierId: 2, origineCreation: 'COMMERCIAL_DIRECT', status: 'BROUILLON', nomCommercant: 'Direct SARL' },
        { dossierId: 3, origineCreation: 'NOUVEAU_PDV', status: 'ACTIF', nomCommercant: 'Extension SARL' }
      ]
    });

    renderPage('auto');

    expect(await screen.findByText('Auto SARL')).toBeInTheDocument();
    expect(screen.queryByText('Direct SARL')).toBeNull();
    expect(screen.queryByText('Extension SARL')).toBeNull();
  });

  it("scope new-pdv: ne montre que les demandes d'extension", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'AUTO', status: 'ACTIF', nomCommercant: 'Auto SARL' },
        { dossierId: 3, origineCreation: 'NOUVEAU_PDV', status: 'SOUMIS', nomCommercant: 'Extension SARL' }
      ]
    });

    renderPage('new-pdv');

    expect(await screen.findByText('Extension SARL')).toBeInTheDocument();
    expect(screen.queryByText('Auto SARL')).toBeNull();
  });

  it("un superviseur en scope new-pdv ne voit que les demandes d'extension, quel que soit leur statut", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'AUTO', status: 'ACTIF', nomCommercant: 'Auto SARL' },
        { dossierId: 2, origineCreation: 'COMMERCIAL_DIRECT', status: 'BROUILLON', nomCommercant: 'Direct SARL' },
        { dossierId: 3, origineCreation: 'NOUVEAU_PDV', status: 'ACCEPTE', nomCommercant: 'Extension SARL' }
      ]
    });

    renderPage('new-pdv');

    expect(await screen.findByText('Extension SARL')).toBeInTheDocument();
    expect(screen.queryByText('Auto SARL')).toBeNull();
    expect(screen.queryByText('Direct SARL')).toBeNull();
  });

  it('un back office en scope auto ne voit que les dossiers auto en attente de validation BOA', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'AUTO', status: 'EN_ATTENTE_VALIDATION_BOA', nomCommercant: 'AVoir' },
        { dossierId: 2, origineCreation: 'AUTO', status: 'ACTIF', nomCommercant: 'DejaTraite' }
      ]
    });

    renderPage('auto');

    expect(await screen.findByText('AVoir')).toBeInTheDocument();
    expect(screen.queryByText('DejaTraite')).toBeNull();
  });

  it("un back office en scope new-pdv ne voit plus une extension une fois le TPE reellement affecte — elle bascule en Historique", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'NOUVEAU_PDV', status: 'EN_ATTENTE_VALIDATION_BOA', nomCommercant: 'ExtensionEnCours' },
        { dossierId: 2, origineCreation: 'NOUVEAU_PDV', status: 'ACCEPTE', typeAffiliation: 'TPE', tpeDejaAffecte: true, nomCommercant: 'ExtensionTpeAffecte' }
      ]
    });

    renderPage('new-pdv');

    expect(await screen.findByText('ExtensionEnCours')).toBeInTheDocument();
    expect(screen.queryByText('ExtensionTpeAffecte')).toBeNull();
  });

  it("un back office en scope new-pdv voit toujours une extension ACCEPTE (contrat signe) tant que le TPE n'est pas affecte", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 3, origineCreation: 'NOUVEAU_PDV', status: 'ACCEPTE', typeAffiliation: 'TPE', tpeDejaAffecte: false, nomCommercant: 'ExtensionTpeEnAttente' }
      ]
    });

    renderPage('new-pdv');

    expect(await screen.findByText('ExtensionTpeEnAttente')).toBeInTheDocument();
  });

  it('un back office en scope new-pdv ne voit plus une extension e-commerce ACCEPTE (pas de TPE necessaire)', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 4, origineCreation: 'NOUVEAU_PDV', status: 'ACCEPTE', typeAffiliation: 'E_COMMERCE', tpeDejaAffecte: false, nomCommercant: 'ExtensionEcommerceFinie' }
      ]
    });

    renderPage('new-pdv');

    expect(await screen.findByText("Aucune demande d'extension rattachée à votre back office.")).toBeInTheDocument();
    expect(screen.queryByText('ExtensionEcommerceFinie')).toBeNull();
  });

  it('filtre par recherche texte', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'AUTO', status: 'SOUMIS', nomCommercant: 'Alpha SARL' },
        { dossierId: 2, origineCreation: 'AUTO', status: 'SOUMIS', nomCommercant: 'Beta SARL' }
      ]
    });

    renderPage('auto');
    await screen.findByText('Alpha SARL');

    fireEvent.change(screen.getByPlaceholderText('Nom du commerçant, ville, e-mail ou numéro de dossier'), {
      target: { value: 'Beta' }
    });

    expect(screen.queryByText('Alpha SARL')).toBeNull();
    expect(screen.getByText('Beta SARL')).toBeInTheDocument();
  });

  it('filtre par statut via les boutons de filtre, puis reinitialise', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'AUTO', status: 'INCOMPLET', nomCommercant: 'Alpha SARL' },
        { dossierId: 2, origineCreation: 'AUTO', status: 'ACTIF', nomCommercant: 'Beta SARL' }
      ]
    });

    renderPage('auto');
    await screen.findByText('Alpha SARL');
    expect(screen.getByText('Beta SARL')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /À corriger/ }));
    expect(screen.getByText('Alpha SARL')).toBeInTheDocument();
    expect(screen.queryByText('Beta SARL')).toBeNull();

    const resetButton = screen.getByRole('button', { name: 'Réinitialiser' });
    expect(resetButton).not.toBeDisabled();
    fireEvent.click(resetButton);
    expect(screen.getByText('Alpha SARL')).toBeInTheDocument();
    expect(screen.getByText('Beta SARL')).toBeInTheDocument();
  });

  it("filtre par type d'affiliation et par plage de dates", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'AUTO', status: 'SOUMIS', nomCommercant: 'Alpha SARL', typeAffiliation: 'TPE', dateSoumission: '2026-01-10' },
        { dossierId: 2, origineCreation: 'AUTO', status: 'SOUMIS', nomCommercant: 'Beta SARL', typeAffiliation: 'E_COMMERCE', dateSoumission: '2026-06-10' }
      ]
    });

    renderPage('auto');
    await screen.findByText('Alpha SARL');

    fireEvent.change(screen.getByLabelText('Type d’affiliation'), { target: { value: 'TPE' } });
    expect(screen.getByText('Alpha SARL')).toBeInTheDocument();
    expect(screen.queryByText('Beta SARL')).toBeNull();

    fireEvent.change(screen.getByLabelText('Type d’affiliation'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Date début'), { target: { value: '2026-05-01' } });
    expect(screen.queryByText('Alpha SARL')).toBeNull();
    expect(screen.getByText('Beta SARL')).toBeInTheDocument();
  });

  it("affiche une erreur si aucune adresse e-mail n'est disponible pour renvoyer un complement", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, origineCreation: 'AUTO', status: 'INCOMPLET', nomCommercant: 'Alpha SARL', email: '' }]
    });

    renderPage('auto');
    fireEvent.click(await screen.findByRole('button', { name: /À corriger/ }));
    await screen.findByText('Alpha SARL');

    fireEvent.click(screen.getByRole('button', { name: 'Email' }));

    await vi.waitFor(() =>
      expect(screen.getAllByText("Aucune adresse e-mail commerçant n'est disponible pour ce dossier.").length).toBeGreaterThan(0)
    );
  });

  it('ouvre un mailto de complement quand une adresse e-mail est disponible', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, origineCreation: 'AUTO', status: 'INCOMPLET', nomCommercant: 'Alpha SARL', email: 'alpha@sarl.ma' }]
    });

    renderPage('auto');
    fireEvent.click(await screen.findByRole('button', { name: /À corriger/ }));
    await screen.findByText('Alpha SARL');

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Email' }))).not.toThrow();
    expect(screen.queryAllByText("Aucune adresse e-mail commerçant n'est disponible pour ce dossier.")).toHaveLength(0);
  });

  it('ouvre une fenetre d\'impression pour un dossier', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, origineCreation: 'AUTO', status: 'SOUMIS', nomCommercant: 'Alpha SARL' }]
    });
    const writeSpy = vi.fn();
    const closeSpy = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({
      document: { write: writeSpy, close: closeSpy }
    } as unknown as Window);

    renderPage('auto');
    await screen.findByText('Alpha SARL');

    fireEvent.click(screen.getByRole('button', { name: 'Imprimer le dossier' }));

    expect(openSpy).toHaveBeenCalledWith('', '_blank', 'width=980,height=720');
    expect(writeSpy).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();

    openSpy.mockRestore();
  });

  it("ne plante pas si la fenetre d'impression est bloquee par le navigateur", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, origineCreation: 'AUTO', status: 'SOUMIS', nomCommercant: 'Alpha SARL' }]
    });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    renderPage('auto');
    await screen.findByText('Alpha SARL');

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Imprimer le dossier' }))).not.toThrow();

    openSpy.mockRestore();
  });

  it('pagine la liste des dossiers avec plus de resultats que la taille de page', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    const requests = Array.from({ length: 10 }, (_, i) => ({
      dossierId: i + 1, origineCreation: 'AUTO', status: 'SOUMIS', nomCommercant: `Commercant${i}`
    }));
    getAffiliationRequestsMock.mockResolvedValue({ requests });

    renderPage('auto');
    // Tri par dossierId decroissant (le plus recent d'abord) : dossierId 10..3
    // (Commercant9..Commercant2) sur la page 1, dossierId 2..1 sur la page 2.
    await screen.findByText('Commercant9');
    expect(screen.queryByText('Commercant0')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(await screen.findByText('Commercant0')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Précédent' }));
    expect(await screen.findByText('Commercant9')).toBeInTheDocument();
  });
});
