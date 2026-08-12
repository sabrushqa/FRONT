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
});
