import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BackofficeCommercialRequestsPage from './BackofficeCommercialRequestsPage';

const getAffiliationRequestsMock = vi.fn();

vi.mock('../../../supervisor/services/supervisorApi', () => ({
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args)
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <BackofficeCommercialRequestsPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  getAffiliationRequestsMock.mockReset();
});

describe('BackofficeCommercialRequestsPage', () => {
  it('ne montre que les prospections/PDV en attente de validation BOA', async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'COMMERCIAL_DIRECT', status: 'EN_ATTENTE_VALIDATION_BOA', nomCommercant: 'AVoir' },
        { dossierId: 2, origineCreation: 'COMMERCIAL_DIRECT', status: 'ACCEPTE', nomCommercant: 'DejaTraite' },
        { dossierId: 3, origineCreation: 'AUTO', status: 'EN_ATTENTE_VALIDATION_BOA', nomCommercant: 'PasConcerne' }
      ]
    });

    renderPage();

    expect(await screen.findByText('AVoir')).toBeInTheDocument();
    expect(screen.queryByText('DejaTraite')).toBeNull();
    expect(screen.queryByText('PasConcerne')).toBeNull();
  });

  it("affiche un message d'erreur si le chargement echoue", async () => {
    getAffiliationRequestsMock.mockRejectedValue(new Error('503'));
    renderPage();
    expect(await screen.findByText(/impossible/i)).toBeInTheDocument();
  });

  it('filtre par nom de commercant', async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'COMMERCIAL_DIRECT', status: 'EN_ATTENTE_VALIDATION_BOA', nomCommercant: 'Alpha SARL' },
        { dossierId: 2, origineCreation: 'COMMERCIAL_DIRECT', status: 'EN_ATTENTE_VALIDATION_BOA', nomCommercant: 'Beta SARL' }
      ]
    });

    renderPage();
    await screen.findByText('Alpha SARL');

    fireEvent.change(screen.getByPlaceholderText('Nom, email ou dossier'), { target: { value: 'Beta' } });

    expect(screen.queryByText('Alpha SARL')).toBeNull();
    expect(screen.getByText('Beta SARL')).toBeInTheDocument();
  });

  it('filtre par region', async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'COMMERCIAL_DIRECT', status: 'EN_ATTENTE_VALIDATION_BOA', nomCommercant: 'Casa SARL', region: 'Casablanca-Settat' },
        { dossierId: 2, origineCreation: 'COMMERCIAL_DIRECT', status: 'EN_ATTENTE_VALIDATION_BOA', nomCommercant: 'Rabat SARL', region: 'Rabat-Salé-Kénitra' }
      ]
    });

    renderPage();
    await screen.findByText('Casa SARL');

    fireEvent.change(screen.getByLabelText('Région'), { target: { value: 'Rabat-Salé-Kénitra' } });

    expect(screen.queryByText('Casa SARL')).toBeNull();
    expect(screen.getByText('Rabat SARL')).toBeInTheDocument();
  });

  it("exclut les dossiers NOUVEAU_PDV (espace dedie) et navigue vers demandes-commerciales pour un dossier direct", async () => {
    // Cette page est reservee aux prospections commerciales directes : les
    // demandes d'extension (NOUVEAU_PDV) ont leur propre espace et ne doivent
    // jamais y apparaitre (cf. isCommercialProspectionToReview).
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'NOUVEAU_PDV', status: 'EN_ATTENTE_VALIDATION_BOA', nomCommercant: 'Extension SARL' },
        { dossierId: 2, origineCreation: 'COMMERCIAL_DIRECT', status: 'EN_ATTENTE_VALIDATION_BOA', nomCommercant: 'Direct SARL' }
      ]
    });

    render(
      <MemoryRouter initialEntries={['/backoffice/demandes-commerciales']}>
        <Routes>
          <Route path="/backoffice/demandes-commerciales" element={<BackofficeCommercialRequestsPage />} />
          <Route path="/backoffice/demande-extention/:id" element={<div>Page extension</div>} />
          <Route path="/backoffice/demandes-commerciales/:id" element={<div>Page demande commerciale</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Direct SARL');
    expect(screen.queryByText('Extension SARL')).toBeNull();

    const row = screen.getByText('Direct SARL').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Consulter' }));

    expect(await screen.findByText(/Page demande commerciale/)).toBeInTheDocument();
  });
});
