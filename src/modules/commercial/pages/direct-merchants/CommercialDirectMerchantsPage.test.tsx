import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import CommercialDirectMerchantsPage from './CommercialDirectMerchantsPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

function DossierPagePlaceholder() {
  const location = useLocation();
  return <div>Page dossier{location.pathname}</div>;
}

const getAffiliationRequestsMock = vi.fn();

vi.mock('../../../supervisor/services/supervisorApi', () => ({
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args)
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <CommercialDirectMerchantsPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  getAffiliationRequestsMock.mockReset().mockResolvedValue({ requests: [] });
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('CommercialDirectMerchantsPage', () => {
  it('deduplique les commercants ajoutes par identifiant en gardant le dossier le plus recent', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'COMMERCIAL_DIRECT', commercantId: 10, nomCommercant: 'ACME v1' },
        { dossierId: 2, origineCreation: 'COMMERCIAL_DIRECT', commercantId: 10, nomCommercant: 'ACME v2' }
      ]
    });

    renderPage();

    expect(await screen.findByText('ACME v2')).toBeInTheDocument();
    expect(screen.queryByText('ACME v1')).toBeNull();
  });

  it('exclut les demandes qui ne sont pas des ajouts directs commerciaux', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, origineCreation: 'AUTO', commercantId: 5, nomCommercant: 'AutoAffilie' }]
    });

    renderPage();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText('AutoAffilie')).toBeNull();
  });

  it("n'appelle pas l'API pour un role sans acces", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );

    renderPage();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getAffiliationRequestsMock).not.toHaveBeenCalled();
  });

  it("affiche une erreur si le chargement echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockRejectedValue(new Error('503'));

    renderPage();

    expect(await screen.findByText(/Impossible de charger les commerçants ajoutés/)).toBeInTheDocument();
  });

  it("filtre par type d'affiliation et reinitialise", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'COMMERCIAL_DIRECT', commercantId: 1, nomCommercant: 'Alpha', typeAffiliation: 'TPE', status: 'SOUMIS' },
        { dossierId: 2, origineCreation: 'COMMERCIAL_DIRECT', commercantId: 2, nomCommercant: 'Beta', typeAffiliation: 'E_COMMERCE', status: 'SOUMIS' }
      ]
    });

    renderPage();
    await screen.findByText('Alpha');

    fireEvent.change(screen.getByLabelText("Type d'affiliation"), { target: { value: 'TPE' } });
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('affiche les libelles de statut et d\'action selon l\'etat du dossier (brouillon, abandonne, visite a planifier)', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'COMMERCIAL_DIRECT', commercantId: 1, nomCommercant: 'Brouillon SARL', status: 'BROUILLON' },
        { dossierId: 2, origineCreation: 'COMMERCIAL_DIRECT', commercantId: 2, nomCommercant: 'Abandon SARL', status: 'ABANDONNE' },
        { dossierId: 3, origineCreation: 'COMMERCIAL_DIRECT', commercantId: 3, nomCommercant: 'ARelancer SARL', status: 'ACTIF', compteRenduDateVisite: null }
      ]
    });

    renderPage();
    await screen.findByText('Brouillon SARL');

    expect(screen.getByText('Brouillon')).toBeInTheDocument();
    expect(screen.getByText('Compléter le brouillon')).toBeInTheDocument();
    expect(screen.getByText('Relancer après abandon')).toBeInTheDocument();
    expect(screen.getByText('Visite à planifier')).toBeInTheDocument();
    // Seul le dossier BROUILLON (ou SOUMIS) propose "Compléter".
    expect(screen.getAllByRole('button', { name: 'Compléter' })).toHaveLength(1);
  });

  it('ouvre le dossier et propose de le completer', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 7, origineCreation: 'COMMERCIAL_DIRECT', commercantId: 7, nomCommercant: 'ACME', status: 'SOUMIS' }]
    });

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<CommercialDirectMerchantsPage />} />
          <Route path="/commercial/demandes-commerciales/:id" element={<DossierPagePlaceholder />} />
          <Route path="/commercial/demandes-commerciales/:id/continue" element={<DossierPagePlaceholder />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('ACME');
    fireEvent.click(screen.getByRole('button', { name: 'Compléter' }));

    expect(await screen.findByText('Page dossier/commercial/demandes-commerciales/7/continue')).toBeInTheDocument();
  });

  it('ouvre une relance et une visite par mailto sans planter', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 7, origineCreation: 'COMMERCIAL_DIRECT', commercantId: 7, nomCommercant: 'ACME', email: 'acme@x.ma', status: 'ACTIF' }]
    });

    renderPage();
    await screen.findByText('ACME');

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Relancer' }))).not.toThrow();
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Visite' }))).not.toThrow();
  });
});
