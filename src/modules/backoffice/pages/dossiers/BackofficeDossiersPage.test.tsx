import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BackofficeDossiersPage from './BackofficeDossiersPage';

const getAffiliationRequestsMock = vi.fn();

vi.mock('../../../supervisor/services/supervisorApi', () => ({
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args)
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <BackofficeDossiersPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  getAffiliationRequestsMock.mockReset();
});

describe('BackofficeDossiersPage', () => {
  it('ne montre que les dossiers auto-affiliation en attente de validation BOA', async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'AUTO_AFFILIATION', status: 'EN_ATTENTE_VALIDATION_BOA', nomCommercant: 'AVoir' },
        { dossierId: 2, origineCreation: 'AUTO_AFFILIATION', status: 'ACCEPTE', nomCommercant: 'DejaTraite' },
        { dossierId: 3, origineCreation: 'COMMERCIAL_DIRECT', status: 'EN_ATTENTE_VALIDATION_BOA', nomCommercant: 'PasConcerne' },
        { dossierId: 4, origineCreation: 'NOUVEAU_PDV', status: 'EN_ATTENTE_VALIDATION_BOA', nomCommercant: 'ExtensionNonPlus' }
      ]
    });

    renderPage();

    expect(await screen.findByText('AVoir')).toBeInTheDocument();
    expect(screen.queryByText('DejaTraite')).toBeNull();
    expect(screen.queryByText('PasConcerne')).toBeNull();
    expect(screen.queryByText('ExtensionNonPlus')).toBeNull();
  });

  it("affiche un message d'erreur si le chargement echoue", async () => {
    getAffiliationRequestsMock.mockRejectedValue(new Error('503'));
    renderPage();
    expect(await screen.findByText(/impossible/i)).toBeInTheDocument();
  });

  it('filtre par nom de commercant', async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'AUTO_AFFILIATION', status: 'EN_ATTENTE_VALIDATION_BOA', nomCommercant: 'Alpha SARL' },
        { dossierId: 2, origineCreation: 'AUTO_AFFILIATION', status: 'EN_ATTENTE_VALIDATION_BOA', nomCommercant: 'Beta SARL' }
      ]
    });

    renderPage();
    await screen.findByText('Alpha SARL');

    fireEvent.change(screen.getByPlaceholderText('Nom, email ou dossier'), { target: { value: 'Beta' } });

    expect(screen.queryByText('Alpha SARL')).toBeNull();
    expect(screen.getByText('Beta SARL')).toBeInTheDocument();
  });

  it('affiche les tuiles de resume et navigue vers le detail du dossier', async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'AUTO_AFFILIATION', status: 'EN_ATTENTE_VALIDATION_BOA', nomCommercant: 'Gamma SARL', nombreCorrections: 0 }
      ]
    });

    render(
      <MemoryRouter initialEntries={['/backoffice/dossiers']}>
        <Routes>
          <Route path="/backoffice/dossiers" element={<BackofficeDossiersPage />} />
          <Route path="/backoffice/dossiers/:id" element={<div>Page detail dossier</div>} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Gamma SARL');
    expect(screen.getByText('Total en attente')).toBeInTheDocument();
    expect(screen.getByText('Nouveaux dossiers')).toBeInTheDocument();
    expect(screen.getByText('À revalider')).toBeInTheDocument();

    const row = screen.getByText('Gamma SARL').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Consulter' }));

    expect(await screen.findByText(/Page detail dossier/)).toBeInTheDocument();
  });
});
