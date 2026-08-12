import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SupervisorAffiliationDetailPage from './SupervisorAffiliationDetailPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const getAffiliationRequestsMock = vi.fn();
const reviewAffiliationRequestMock = vi.fn();
const downloadAffiliationDocumentMock = vi.fn();
const downloadFullDossierMock = vi.fn();
const triggerBlobDownloadMock = vi.fn();

vi.mock('../../services/supervisorApi', () => ({
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args),
  completeAffiliationRequest: vi.fn(),
  reviewAffiliationRequest: (...args: unknown[]) => reviewAffiliationRequestMock(...args),
  forwardAffiliationToBackOffice: vi.fn(),
  downloadAffiliationDocument: (...args: unknown[]) => downloadAffiliationDocumentMock(...args),
  downloadFullDossier: (...args: unknown[]) => downloadFullDossierMock(...args),
  downloadGeneratedContract: vi.fn(),
  downloadSignedContract: vi.fn(),
  downloadCommercialReport: vi.fn()
}));

vi.mock('../../../../core/browserDownload', () => ({
  triggerBlobDownload: (...args: unknown[]) => triggerBlobDownloadMock(...args)
}));

function renderPage(dossierId = '1') {
  return render(
    <MemoryRouter initialEntries={[`/supervisor/affiliation-requests/${dossierId}`]}>
      <Routes>
        <Route path="/supervisor/affiliation-requests/:dossierId" element={<SupervisorAffiliationDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  getAffiliationRequestsMock.mockReset().mockResolvedValue({ requests: [] });
  reviewAffiliationRequestMock.mockReset();
  downloadAffiliationDocumentMock.mockReset();
  downloadFullDossierMock.mockReset();
  triggerBlobDownloadMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('SupervisorAffiliationDetailPage', () => {
  it('affiche le dossier correspondant a l\'id de la route', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'SOUMIS' }]
    });

    renderPage('1');

    const matches = await screen.findAllByText(/ACME SARL/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("affiche un message si le dossier n'existe pas", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({ requests: [{ dossierId: 99 }] });

    renderPage('1');

    expect(await screen.findByText("Le dossier demandé n'existe pas ou n'est plus disponible.")).toBeInTheDocument();
  });

  it("refuse l'acces pour un role commercant", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT' })
    );

    renderPage('1');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getAffiliationRequestsMock).not.toHaveBeenCalled();
  });

  it('un back office peut valider un dossier en verification', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'EN_ATTENTE_VALIDATION_BOA' }]
    });
    reviewAffiliationRequestMock.mockResolvedValue({ message: 'Dossier validé.' });

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    fireEvent.click(screen.getByRole('button', { name: 'Valider' }));

    expect(await screen.findByText('Dossier validé.')).toBeInTheDocument();
    expect(reviewAffiliationRequestMock).toHaveBeenCalledWith(1, { decision: 'ACCEPTE', motifRefus: '' });
  });

  it('bloque la demande de correction tant que le type de probleme et le motif ne sont pas renseignes', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'EN_ATTENTE_VALIDATION_BOA' }]
    });

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    // Le bouton "Demander correction" reste desactive tant qu'aucun type de
    // probleme et aucun motif n'ont ete renseignes : c'est ce qui empeche
    // desormais un refus sans motif (plus de validation au clic).
    const correctionButton = screen.getByRole('button', { name: 'Demander correction' });
    expect(correctionButton).toBeDisabled();

    fireEvent.click(correctionButton);
    expect(reviewAffiliationRequestMock).not.toHaveBeenCalled();
  });

  it("n'affiche pas les actions de validation pour un dossier qui n'est pas en verification", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'SOUMIS' }]
    });

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    expect(screen.queryByRole('button', { name: 'Valider' })).toBeNull();
  });

  it("affiche les champs TPE ET e-commerce (dont Commission locale TPE) pour un dossier ENCAISSEMENT_ET_ECOMMERCE en edition", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 1, nomCommercant: 'ACME SARL', status: 'SOUMIS',
        typeAffiliation: 'ENCAISSEMENT_ET_ECOMMERCE', origineCreation: 'AUTO_AFFILIATION', compteActif: false
      }]
    });

    render(
      <MemoryRouter initialEntries={['/supervisor/affiliation-requests/1?mode=edit']}>
        <Routes>
          <Route path="/supervisor/affiliation-requests/:dossierId" element={<SupervisorAffiliationDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findAllByText(/ACME SARL/);

    expect(await screen.findByText('Commission locale TPE')).toBeInTheDocument();
    expect(screen.getByText('Commission locale e-commerce')).toBeInTheDocument();
  });

  it('telecharge le dossier complet pour une auto-affiliation acceptee', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'ACTIF', origineCreation: 'AUTO_AFFILIATION', compteActif: true }]
    });
    const blob = new Blob(['pdf']);
    downloadFullDossierMock.mockResolvedValue(blob);

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    fireEvent.click(screen.getByRole('button', { name: 'Télécharger le dossier complet' }));

    await vi.waitFor(() => expect(downloadFullDossierMock).toHaveBeenCalledWith(1));
    expect(triggerBlobDownloadMock).toHaveBeenCalledWith(blob, 'dossier-1-complet.pdf');
  });

  it("telecharge un document depuis l'onglet Suivi", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 1, nomCommercant: 'ACME SARL', status: 'SOUMIS',
        documents: [{ documentId: 9, typeDocument: 'CIN', fileName: 'cin.pdf', downloadable: true }]
      }]
    });
    const blob = new Blob(['pdf']);
    downloadAffiliationDocumentMock.mockResolvedValue(blob);

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    fireEvent.click(screen.getByRole('button', { name: /Suivi/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Télécharger' }));

    await vi.waitFor(() => expect(downloadAffiliationDocumentMock).toHaveBeenCalledWith(1, 9));
    expect(triggerBlobDownloadMock).toHaveBeenCalledWith(blob, 'cin.pdf');
  });
});
