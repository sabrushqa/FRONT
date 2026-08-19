import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BackofficeHistoryPage from './BackofficeHistoryPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const getAffiliationRequestsMock = vi.fn();

vi.mock('../../../supervisor/services/supervisorApi', () => ({
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args)
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <BackofficeHistoryPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  getAffiliationRequestsMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
  useSessionStore.getState().setSession(
    normalizeUserSessionResponse({ utilisateurId: 42, commercantId: 1, role: 'BACK_OFFICE' })
  );
});

describe('BackofficeHistoryPage', () => {
  it("n'affiche que les dossiers traites par le back office connecte", async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, status: 'ACCEPTE', backOfficeUtilisateurId: 42, nomCommercant: 'MienDossier' },
        { dossierId: 2, status: 'ACCEPTE', backOfficeUtilisateurId: 99, nomCommercant: 'AutreAgent' },
        { dossierId: 3, status: 'SOUMIS', backOfficeUtilisateurId: 42, nomCommercant: 'PasTraite' }
      ]
    });

    renderPage();

    expect(await screen.findByText('MienDossier')).toBeInTheDocument();
    expect(screen.queryByText('AutreAgent')).toBeNull();
    expect(screen.queryByText('PasTraite')).toBeNull();
  });

  it('filtre par recherche texte sur le nom du commercant', async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, status: 'ACCEPTE', backOfficeUtilisateurId: 42, nomCommercant: 'Alpha SARL' },
        { dossierId: 2, status: 'ABANDONNE', backOfficeUtilisateurId: 42, nomCommercant: 'Beta SARL' }
      ]
    });

    renderPage();
    await screen.findByText('Alpha SARL');

    fireEvent.change(screen.getByPlaceholderText('Nom, email, région ou dossier'), { target: { value: 'Beta' } });
    expect(screen.queryByText('Alpha SARL')).toBeNull();
    expect(screen.getByText('Beta SARL')).toBeInTheDocument();
  });

  it("filtre par origine 'Extension' pour n'afficher que les demandes NOUVEAU_PDV", async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, status: 'ACCEPTE', backOfficeUtilisateurId: 42, nomCommercant: 'DossierAuto', origineCreation: 'AUTO_AFFILIATION' },
        { dossierId: 2, status: 'ACCEPTE', backOfficeUtilisateurId: 42, nomCommercant: 'DossierExtension', origineCreation: 'NOUVEAU_PDV' },
        { dossierId: 3, status: 'ABANDONNE', backOfficeUtilisateurId: 42, nomCommercant: 'AutreExtension', origineCreation: 'NOUVEAU_PDV' }
      ]
    });

    renderPage();
    await screen.findByText('DossierAuto');

    fireEvent.change(screen.getByLabelText('Origine'), { target: { value: 'extension' } });

    expect(screen.queryByText('DossierAuto')).toBeNull();
    expect(screen.getByText('DossierExtension')).toBeInTheDocument();
    expect(screen.getByText('AutreExtension')).toBeInTheDocument();
  });

  it("affiche un message d'erreur si le chargement echoue", async () => {
    getAffiliationRequestsMock.mockRejectedValue(new Error('503'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Impossible de charger l'historique des dossiers traités.")).toBeInTheDocument()
    );
  });
});
