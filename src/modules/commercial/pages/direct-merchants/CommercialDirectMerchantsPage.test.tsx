import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommercialDirectMerchantsPage from './CommercialDirectMerchantsPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

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
});
