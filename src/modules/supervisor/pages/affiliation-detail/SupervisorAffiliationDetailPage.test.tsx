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
const forwardAffiliationToBackOfficeMock = vi.fn();
const downloadGeneratedContractMock = vi.fn();
const downloadSignedContractMock = vi.fn();

vi.mock('../../services/supervisorApi', () => ({
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args),
  completeAffiliationRequest: vi.fn(),
  reviewAffiliationRequest: (...args: unknown[]) => reviewAffiliationRequestMock(...args),
  forwardAffiliationToBackOffice: (...args: unknown[]) => forwardAffiliationToBackOfficeMock(...args),
  downloadAffiliationDocument: (...args: unknown[]) => downloadAffiliationDocumentMock(...args),
  downloadFullDossier: (...args: unknown[]) => downloadFullDossierMock(...args),
  downloadGeneratedContract: (...args: unknown[]) => downloadGeneratedContractMock(...args),
  downloadSignedContract: (...args: unknown[]) => downloadSignedContractMock(...args),
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
  forwardAffiliationToBackOfficeMock.mockReset();
  downloadGeneratedContractMock.mockReset();
  downloadSignedContractMock.mockReset();
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

  it("affiche le nombre de demandes d'extension rattachees au dossier principal", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'SOUMIS', nombreDemandesExtention: 3 }]
    });

    renderPage('1');

    expect(await screen.findByText(/Nombre de demandes d'extension/)).toBeInTheDocument();
    expect(await screen.findByText('3')).toBeInTheDocument();
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

  it('un back office peut demander une correction avec un type de probleme et un motif renseignes', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'EN_ATTENTE_VALIDATION_BOA' }]
    });
    reviewAffiliationRequestMock.mockResolvedValue({ message: 'Dossier renvoyé pour correction.' });

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    fireEvent.click(screen.getByText('Type de problème').closest('section')!.querySelector('button')!);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Autre' }));
    fireEvent.change(
      screen.getByPlaceholderText('Expliquer clairement ce qui doit être corrigé avant renvoi au commercial...'),
      { target: { value: 'Pièce illisible, merci de la reprendre.' } }
    );

    const correctionButton = screen.getByRole('button', { name: 'Demander correction' });
    expect(correctionButton).not.toBeDisabled();
    fireEvent.click(correctionButton);

    expect(await screen.findByText('Dossier renvoyé pour correction.')).toBeInTheDocument();
    expect(reviewAffiliationRequestMock).toHaveBeenCalledWith(1, {
      decision: 'CORRECTION',
      motifRefus: expect.stringContaining('Pièce illisible, merci de la reprendre.')
    });
  });

  it("un commercial peut convertir un dossier accepte en affiliation (transmission au back office)", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'ACCEPTE' }]
    });
    forwardAffiliationToBackOfficeMock.mockResolvedValue({ message: 'Dossier transmis au back office.' });

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    fireEvent.click(screen.getByRole('button', { name: 'Convertir en affiliation' }));

    expect(await screen.findByText('Dossier transmis au back office.')).toBeInTheDocument();
    expect(forwardAffiliationToBackOfficeMock).toHaveBeenCalledWith(1);
  });

  it("affiche une erreur si la conversion en affiliation echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'ACCEPTE' }]
    });
    forwardAffiliationToBackOfficeMock.mockRejectedValue({});

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    fireEvent.click(screen.getByRole('button', { name: 'Convertir en affiliation' }));

    expect(await screen.findByText('Impossible de convertir ce dossier en affiliation.')).toBeInTheDocument();
  });

  it("telecharge le contrat genere et le contrat signe depuis l'onglet Contrat", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 1, nomCommercant: 'ACME SARL', status: 'ACTIF',
        contractDisponible: true, contractFileName: 'contrat-1.pdf',
        signedContractDisponible: true, signedContractFileName: 'contrat-1-signe.pdf'
      }]
    });
    const contractBlob = new Blob(['contrat']);
    const signedBlob = new Blob(['signe']);
    downloadGeneratedContractMock.mockResolvedValue(contractBlob);
    downloadSignedContractMock.mockResolvedValue(signedBlob);

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    fireEvent.click(screen.getByRole('button', { name: 'Contrat' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Télécharger le contrat' }));

    await vi.waitFor(() => expect(downloadGeneratedContractMock).toHaveBeenCalledWith(1));
    expect(triggerBlobDownloadMock).toHaveBeenCalledWith(contractBlob, 'contrat-1.pdf');

    fireEvent.click(screen.getByRole('button', { name: 'Télécharger le contrat signé' }));

    await vi.waitFor(() => expect(downloadSignedContractMock).toHaveBeenCalledWith(1));
    expect(triggerBlobDownloadMock).toHaveBeenCalledWith(signedBlob, 'contrat-1-signe.pdf');
  });

  it("affiche une erreur si le telechargement du dossier complet echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'ACTIF', origineCreation: 'AUTO_AFFILIATION', compteActif: true }]
    });
    downloadFullDossierMock.mockRejectedValue(new Error('503'));

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    fireEvent.click(screen.getByRole('button', { name: 'Télécharger le dossier complet' }));

    expect(await screen.findByText('503')).toBeInTheDocument();
  });
});
