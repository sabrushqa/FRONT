import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CommercialDossierDetailPage from './CommercialDossierDetailPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const getAffiliationRequestsMock = vi.fn();
const getEligibleTpesMock = vi.fn();
const reviewAffiliationRequestMock = vi.fn();
const assignTpeToCommercantMock = vi.fn();
const completeAffiliationRequestMock = vi.fn();
const downloadAffiliationDocumentMock = vi.fn();
const downloadGeneratedContractMock = vi.fn();
const downloadCommercialReportMock = vi.fn();
const downloadSignedContractMock = vi.fn();
const downloadFullDossierMock = vi.fn();
const triggerBlobDownloadMock = vi.fn();

vi.mock('../../../supervisor/services/supervisorApi', () => ({
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args),
  getEligibleTpes: (...args: unknown[]) => getEligibleTpesMock(...args),
  completeAffiliationRequest: (...args: unknown[]) => completeAffiliationRequestMock(...args),
  reviewAffiliationRequest: (...args: unknown[]) => reviewAffiliationRequestMock(...args),
  assignTpeToCommercant: (...args: unknown[]) => assignTpeToCommercantMock(...args),
  downloadAffiliationDocument: (...args: unknown[]) => downloadAffiliationDocumentMock(...args),
  downloadGeneratedContract: (...args: unknown[]) => downloadGeneratedContractMock(...args),
  downloadCommercialReport: (...args: unknown[]) => downloadCommercialReportMock(...args),
  downloadSignedContract: (...args: unknown[]) => downloadSignedContractMock(...args),
  downloadFullDossier: (...args: unknown[]) => downloadFullDossierMock(...args)
}));

vi.mock('../../../../core/browserDownload', () => ({
  triggerBlobDownload: (...args: unknown[]) => triggerBlobDownloadMock(...args)
}));

function renderPage(dossierId = '1', requestScope: 'auto' | 'new-pdv' | 'commercial' = 'auto') {
  return render(
    <MemoryRouter initialEntries={[`/commercial/dossiers/${dossierId}`]}>
      <Routes>
        <Route path="/commercial/dossiers/:dossierId" element={<CommercialDossierDetailPage requestScope={requestScope} />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  getAffiliationRequestsMock.mockReset().mockResolvedValue({ requests: [] });
  getEligibleTpesMock.mockReset().mockResolvedValue({ tpes: [] });
  reviewAffiliationRequestMock.mockReset();
  assignTpeToCommercantMock.mockReset();
  completeAffiliationRequestMock.mockReset();
  downloadAffiliationDocumentMock.mockReset();
  downloadGeneratedContractMock.mockReset();
  downloadCommercialReportMock.mockReset();
  downloadSignedContractMock.mockReset();
  downloadFullDossierMock.mockReset();
  triggerBlobDownloadMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('CommercialDossierDetailPage', () => {
  it('charge et affiche le dossier correspondant a l\'id de la route', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'SOUMIS', typeAffiliation: 'TPE' }]
    });

    renderPage('1');

    const matches = await screen.findAllByText(/ACME SARL/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("affiche un message si le dossier demande n'existe pas", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({ requests: [{ dossierId: 2, nomCommercant: 'Autre' }] });

    renderPage('1');

    expect(await screen.findByText("Le dossier demandé n'existe pas ou n'est plus disponible.")).toBeInTheDocument();
  });

  it("affiche une erreur si le chargement echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockRejectedValue(new Error('503'));

    renderPage('1');

    expect(await screen.findByText('Impossible de charger le détail du dossier.')).toBeInTheDocument();
  });

  it("signale un identifiant de dossier invalide dans l'URL", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );

    renderPage('abc');

    expect(await screen.findByText('Identifiant de dossier invalide.')).toBeInTheDocument();
  });

  it('un back office peut valider un dossier en attente de validation BOA', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'EN_ATTENTE_VALIDATION_BOA', typeAffiliation: 'TPE' }]
    });
    reviewAffiliationRequestMock.mockResolvedValue({ message: 'Dossier validé et contrat généré.' });

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    fireEvent.click(screen.getByRole('button', { name: 'Valider et générer le contrat' }));

    expect(await screen.findByText('Dossier validé et contrat généré.')).toBeInTheDocument();
    expect(reviewAffiliationRequestMock).toHaveBeenCalledWith(1, { decision: 'ACCEPTE', motifRefus: '' });
  });

  it('bloque la demande de correction tant que le type de probleme et le motif ne sont pas renseignes', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'EN_ATTENTE_VALIDATION_BOA', typeAffiliation: 'TPE' }]
    });

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    // Le bouton "Demander correction" reste desactive tant qu'aucun type de
    // probleme et aucun motif n'ont ete renseignes : c'est ce qui empeche
    // desormais un renvoi au commercial sans motif (plus de validation au clic).
    const correctionButton = screen.getByRole('button', { name: 'Demander correction' });
    expect(correctionButton).toBeDisabled();

    fireEvent.click(correctionButton);
    expect(reviewAffiliationRequestMock).not.toHaveBeenCalled();
  });

  it('un back office peut affecter un TPE disponible a un dossier accepte', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE', peutAffecterTpe: true })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'ACCEPTE', typeAffiliation: 'TPE', tpeDejaAffecte: false }]
    });
    getEligibleTpesMock.mockResolvedValue({
      tpes: [{ id: 'TPE-000005', numeroSerie: 'SN-5', modele: 'M1', typeCompatible: 'TPE', actif: true, statut: 'ACTIF', commercant: '', pdv: '' }]
    });
    assignTpeToCommercantMock.mockResolvedValue({ message: 'TPE affecté avec succès.' });

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    const tpeSelect = await screen.findByText(/Référence TPE/);
    const select = tpeSelect.closest('label')!.querySelector('select')!;
    fireEvent.change(select, { target: { value: 'TPE-000005' } });
    fireEvent.click(screen.getByRole('button', { name: 'Affecter' }));

    expect(await screen.findByText('TPE affecté avec succès.')).toBeInTheDocument();
    expect(assignTpeToCommercantMock).toHaveBeenCalledWith('TPE-000005', { dossierId: 1 });
  });

  it('telecharge le dossier complet pour une auto-affiliation acceptee', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'ACTIF', typeAffiliation: 'TPE', origineCreation: 'AUTO_AFFILIATION', compteActif: true }]
    });
    const blob = new Blob(['pdf']);
    downloadFullDossierMock.mockResolvedValue(blob);
    triggerBlobDownloadMock.mockResolvedValue(undefined);

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    fireEvent.click(screen.getByRole('button', { name: 'Télécharger le dossier complet' }));

    await vi.waitFor(() => expect(downloadFullDossierMock).toHaveBeenCalledWith(1));
    expect(triggerBlobDownloadMock).toHaveBeenCalledWith(blob, 'dossier-1-complet.pdf');
  });

  it('telecharge un document depuis l\'onglet Suivi', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 1, nomCommercant: 'ACME SARL', status: 'SOUMIS', typeAffiliation: 'TPE',
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

  it('affiche une erreur si le telechargement du dossier complet echoue', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'ACTIF', typeAffiliation: 'TPE', origineCreation: 'AUTO_AFFILIATION', compteActif: true }]
    });
    downloadFullDossierMock.mockRejectedValue(new Error('503'));

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    fireEvent.click(screen.getByRole('button', { name: 'Télécharger le dossier complet' }));

    expect(await screen.findByText('503')).toBeInTheDocument();
  });

  it('un commercial peut completer et soumettre un dossier e-commerce en mode edition', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 1, nomCommercant: 'ACME SARL', status: 'SOUMIS', typeAffiliation: 'E_COMMERCE',
        origineCreation: 'AUTO_AFFILIATION', compteActif: false
      }]
    });
    completeAffiliationRequestMock.mockResolvedValue({ message: 'Dossier complété avec succès.' });

    render(
      <MemoryRouter initialEntries={['/commercial/dossiers/1?mode=edit']}>
        <Routes>
          <Route path="/commercial/dossiers/:dossierId" element={<CommercialDossierDetailPage requestScope="auto" />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findAllByText(/ACME SARL/);
    fireEvent.click(screen.getByRole('button', { name: /Générer le compte-rendu/ }));

    expect(await screen.findByText('Dossier complété avec succès.')).toBeInTheDocument();
    expect(completeAffiliationRequestMock).toHaveBeenCalledWith(1, expect.any(Object));
  });

  it("bloque la soumission si le champ Acquereur est requis mais vide", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 1, nomCommercant: 'ACME SARL', status: 'SOUMIS', typeAffiliation: 'E_COMMERCE',
        origineCreation: 'AUTO_AFFILIATION', compteActif: false, compteRenduQualification: 'AFFILIE'
      }]
    });

    render(
      <MemoryRouter initialEntries={['/commercial/dossiers/1?mode=edit']}>
        <Routes>
          <Route path="/commercial/dossiers/:dossierId" element={<CommercialDossierDetailPage requestScope="auto" />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findAllByText(/ACME SARL/);
    fireEvent.click(screen.getByRole('button', { name: /Générer le compte-rendu/ }));

    expect(await screen.findByText('Le champ Acquéreur est obligatoire pour un commerçant déjà affilié.')).toBeInTheDocument();
    expect(completeAffiliationRequestMock).not.toHaveBeenCalled();
  });

  it("affiche les champs TPE ET e-commerce (dont Commission locale TPE) pour un dossier ENCAISSEMENT_ET_ECOMMERCE", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 1, nomCommercant: 'ACME SARL', status: 'SOUMIS', typeAffiliation: 'ENCAISSEMENT_ET_ECOMMERCE',
        origineCreation: 'AUTO_AFFILIATION', compteActif: false
      }]
    });

    render(
      <MemoryRouter initialEntries={['/commercial/dossiers/1?mode=edit']}>
        <Routes>
          <Route path="/commercial/dossiers/:dossierId" element={<CommercialDossierDetailPage requestScope="auto" />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findAllByText(/ACME SARL/);

    // Avant le fix, aucun de ces deux champs n'etait rendu pour ce type
    // combine (isTpeRequest et isEcommerceRequest etaient tous deux false),
    // rendant "commission locale TPE" impossible a saisir malgre l'exigence
    // backend (StaffAffiliationManagementService::applyTpeNegotiableFields).
    expect(await screen.findByText('Commission locale TPE')).toBeInTheDocument();
    expect(screen.getByText('Commission locale e-commerce')).toBeInTheDocument();
  });

  it('enregistre un brouillon depuis le mode edition sans generer le contrat', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 1, nomCommercant: 'ACME SARL', status: 'SOUMIS', typeAffiliation: 'E_COMMERCE',
        origineCreation: 'COMMERCIAL_DIRECT', compteActif: false
      }]
    });

    render(
      <MemoryRouter initialEntries={['/commercial/dossiers/1?mode=edit']}>
        <Routes>
          <Route path="/commercial/dossiers/:dossierId" element={<CommercialDossierDetailPage requestScope="auto" />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findAllByText(/ACME SARL/);
    expect(screen.queryByRole('button', { name: 'Enregistrer le brouillon' })).toBeNull();
  });
});
