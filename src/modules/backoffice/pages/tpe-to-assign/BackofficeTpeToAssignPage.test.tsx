import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BackofficeTpeToAssignPage from './BackofficeTpeToAssignPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const getAffiliationRequestsMock = vi.fn();

vi.mock('../../../supervisor/services/supervisorApi', () => ({
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args)
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <BackofficeTpeToAssignPage />
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

describe('BackofficeTpeToAssignPage', () => {
  it("n'affiche que les dossiers ACCEPTE du back office connecte dont le TPE n'est pas encore affecte", async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        {
          dossierId: 1, status: 'ACCEPTE', backOfficeUtilisateurId: 42, nomCommercant: 'AttendTpe',
          typeAffiliation: 'TPE', tpeDejaAffecte: false
        },
        {
          dossierId: 2, status: 'ACCEPTE', backOfficeUtilisateurId: 42, nomCommercant: 'DejaAffecte',
          typeAffiliation: 'TPE', tpeDejaAffecte: true
        },
        {
          dossierId: 3, status: 'ACCEPTE', backOfficeUtilisateurId: 99, nomCommercant: 'AutreAgent',
          typeAffiliation: 'TPE', tpeDejaAffecte: false
        },
        {
          dossierId: 4, status: 'EN_ATTENTE_VALIDATION_BOA', backOfficeUtilisateurId: 42, nomCommercant: 'PasEncoreAccepte',
          typeAffiliation: 'TPE', tpeDejaAffecte: false
        }
      ]
    });

    renderPage();

    expect(await screen.findByText('AttendTpe')).toBeInTheDocument();
    expect(screen.queryByText('DejaAffecte')).toBeNull();
    expect(screen.queryByText('AutreAgent')).toBeNull();
    expect(screen.queryByText('PasEncoreAccepte')).toBeNull();
  });

  it('affiche un dossier E_COMMERCE en attente de site e-commerce', async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        {
          dossierId: 1, status: 'ACCEPTE', backOfficeUtilisateurId: 42, nomCommercant: 'Boutique Ecom',
          typeAffiliation: 'E_COMMERCE', tpeDejaAffecte: false, ecommerceSiteDejaAffecte: false
        }
      ]
    });

    renderPage();

    expect(await screen.findByText('Boutique Ecom')).toBeInTheDocument();
    expect(screen.getAllByText('Site e-commerce').length).toBeGreaterThan(0);
  });

  it('affiche "TPE/SoftPOS/QR + Site e-commerce" pour un dossier ENCAISSEMENT_ET_ECOMMERCE dont rien n\'est encore affecte', async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        {
          dossierId: 1, status: 'ACCEPTE', backOfficeUtilisateurId: 42, nomCommercant: 'Boutique Combinee',
          typeAffiliation: 'ENCAISSEMENT_ET_ECOMMERCE', tpeDejaAffecte: false, ecommerceSiteDejaAffecte: false
        }
      ]
    });

    renderPage();

    expect(await screen.findByText('Boutique Combinee')).toBeInTheDocument();
    expect(screen.getByText('TPE/SoftPOS/QR + Site e-commerce')).toBeInTheDocument();
  });

  it('ne montre plus un dossier ENCAISSEMENT_ET_ECOMMERCE une fois les deux affectations faites', async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        {
          dossierId: 1, status: 'ACCEPTE', backOfficeUtilisateurId: 42, nomCommercant: 'Boutique Terminee',
          typeAffiliation: 'ENCAISSEMENT_ET_ECOMMERCE', tpeDejaAffecte: true, ecommerceSiteDejaAffecte: true
        }
      ]
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/Aucun dossier en attente d'affectation/)).toBeInTheDocument()
    );
    expect(screen.queryByText('Boutique Terminee')).toBeNull();
  });

  it("le filtre Origine ne montre que les extensions (NOUVEAU_PDV)", async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        {
          dossierId: 1, status: 'ACCEPTE', backOfficeUtilisateurId: 42, nomCommercant: 'DossierAuto',
          typeAffiliation: 'TPE', tpeDejaAffecte: false, origineCreation: 'AUTO_AFFILIATION'
        },
        {
          dossierId: 2, status: 'ACCEPTE', backOfficeUtilisateurId: 42, nomCommercant: 'DossierExtension',
          typeAffiliation: 'TPE', tpeDejaAffecte: false, origineCreation: 'NOUVEAU_PDV'
        }
      ]
    });

    renderPage();
    await screen.findByText('DossierAuto');

    fireEvent.change(screen.getByLabelText('Origine'), { target: { value: 'extension' } });

    expect(screen.queryByText('DossierAuto')).toBeNull();
    expect(screen.getByText('DossierExtension')).toBeInTheDocument();
  });

  it("affiche un message d'erreur si le chargement echoue", async () => {
    getAffiliationRequestsMock.mockRejectedValue(new Error('503'));
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText("Impossible de charger la liste des dossiers en attente d'affectation.")
      ).toBeInTheDocument()
    );
  });
});
