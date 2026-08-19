import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CommercialDossierDetailPage from './CommercialDossierDetailPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const getAffiliationRequestsMock = vi.fn();
const getEligibleTpesMock = vi.fn();
const reviewAffiliationRequestMock = vi.fn();
const assignTpeToCommercantMock = vi.fn();
const assignEcommerceSiteToCommercantMock = vi.fn();
const completeAffiliationRequestMock = vi.fn();
const downloadAffiliationDocumentMock = vi.fn();
const downloadGeneratedContractMock = vi.fn();
const downloadCommercialReportMock = vi.fn();
const downloadSignedContractMock = vi.fn();
const downloadFullDossierMock = vi.fn();
const triggerBlobDownloadMock = vi.fn();
const abandonAffiliationRequestMock = vi.fn();

vi.mock('../../../supervisor/services/supervisorApi', () => ({
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args),
  getEligibleTpes: (...args: unknown[]) => getEligibleTpesMock(...args),
  completeAffiliationRequest: (...args: unknown[]) => completeAffiliationRequestMock(...args),
  reviewAffiliationRequest: (...args: unknown[]) => reviewAffiliationRequestMock(...args),
  assignTpeToCommercant: (...args: unknown[]) => assignTpeToCommercantMock(...args),
  assignEcommerceSiteToCommercant: (...args: unknown[]) => assignEcommerceSiteToCommercantMock(...args),
  downloadAffiliationDocument: (...args: unknown[]) => downloadAffiliationDocumentMock(...args),
  downloadGeneratedContract: (...args: unknown[]) => downloadGeneratedContractMock(...args),
  downloadCommercialReport: (...args: unknown[]) => downloadCommercialReportMock(...args),
  downloadSignedContract: (...args: unknown[]) => downloadSignedContractMock(...args),
  downloadFullDossier: (...args: unknown[]) => downloadFullDossierMock(...args),
  abandonAffiliationRequest: (...args: unknown[]) => abandonAffiliationRequestMock(...args)
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
  assignEcommerceSiteToCommercantMock.mockReset();
  completeAffiliationRequestMock.mockReset();
  downloadAffiliationDocumentMock.mockReset();
  downloadGeneratedContractMock.mockReset();
  downloadCommercialReportMock.mockReset();
  downloadSignedContractMock.mockReset();
  downloadFullDossierMock.mockReset();
  triggerBlobDownloadMock.mockReset();
  abandonAffiliationRequestMock.mockReset();
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

  it('affiche le nombre de TPE demande en haut du bloc Affecter un TPE', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE', peutAffecterTpe: true })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 5, nomCommercant: 'ACME SARL', status: 'ACCEPTE', typeAffiliation: 'TPE',
        tpeDejaAffecte: false, nombreTpe: 3
      }]
    });
    getEligibleTpesMock.mockResolvedValue({ tpes: [] });

    renderPage('5');
    await screen.findAllByText(/ACME SARL/);
    await screen.findByText('Affecter un TPE');

    const requestedCountLabel = screen.getByText(/Nombre demandé dans le dossier/i);
    expect(requestedCountLabel).toBeInTheDocument();
    expect(requestedCountLabel.parentElement).toHaveTextContent('3');
  });

  it("affiche \"Point de vente existant\" (pas \"Nouveau point de vente\") quand l'extension reutilise un PDV deja existant", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 12, nomCommercant: 'ACME SARL', status: 'ACCEPTE', typeAffiliation: 'TPE',
        origineCreation: 'NOUVEAU_PDV', tpeDejaAffecte: true,
        requestedPdvNom: 'Boutique Maarif', requestedPdvVille: 'Casablanca', requestedPdvStatut: 'ACTIF',
        requestedPdvDejaExistant: true
      }]
    });

    renderPage('12', 'new-pdv');
    await screen.findAllByText(/ACME SARL/);

    expect(await screen.findByText('Point de vente existant — TPE seulement')).toBeInTheDocument();
    expect(screen.queryByText('Nouveau point de vente')).toBeNull();
  });

  it("affiche \"Nouveau point de vente\" quand l'extension cree reellement un nouveau PDV", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 13, nomCommercant: 'ACME SARL', status: 'ACCEPTE', typeAffiliation: 'TPE',
        origineCreation: 'NOUVEAU_PDV', tpeDejaAffecte: true,
        requestedPdvNom: 'Nouvelle boutique', requestedPdvVille: 'Rabat', requestedPdvStatut: 'EN_VERIFICATION',
        requestedPdvDejaExistant: false
      }]
    });

    renderPage('13', 'new-pdv');
    await screen.findAllByText(/ACME SARL/);

    expect(await screen.findByText('Nouveau point de vente')).toBeInTheDocument();
    expect(screen.queryByText('Point de vente existant — TPE seulement')).toBeNull();
  });

  it("un back office peut affecter un TPE a une demande d'extension (NOUVEAU_PDV), meme mecanisme que l'affiliation initiale", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE', peutAffecterTpe: true })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 9, nomCommercant: 'ACME SARL', status: 'ACCEPTE', typeAffiliation: 'SOFTPOS',
        origineCreation: 'NOUVEAU_PDV', tpeDejaAffecte: false
      }]
    });
    getEligibleTpesMock.mockResolvedValue({
      tpes: [{ id: 'SOFT-000009', numeroSerie: 'SN-9', modele: 'SoftPOS', typeCompatible: 'SOFTPOS', actif: true, statut: 'ACTIF', commercant: '', pdv: '' }]
    });
    assignTpeToCommercantMock.mockResolvedValue({ message: 'TPE affecté avec succès.' });

    renderPage('9', 'new-pdv');
    await screen.findAllByText(/ACME SARL/);

    const tpeSelect = await screen.findByText(/Référence TPE/);
    const select = tpeSelect.closest('label')!.querySelector('select')!;
    fireEvent.change(select, { target: { value: 'SOFT-000009' } });
    fireEvent.click(screen.getByRole('button', { name: 'Affecter' }));

    expect(await screen.findByText('TPE affecté avec succès.')).toBeInTheDocument();
    expect(assignTpeToCommercantMock).toHaveBeenCalledWith('SOFT-000009', { dossierId: 9 });
  });

  it("un back office peut affecter un site e-commerce a une demande d'extension E_COMMERCE (NOUVEAU_PDV)", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE', peutAffecterTpe: true })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 10, nomCommercant: 'ACME SARL', status: 'ACCEPTE', typeAffiliation: 'E_COMMERCE',
        origineCreation: 'NOUVEAU_PDV', ecommerceSiteDejaAffecte: false
      }]
    });
    assignEcommerceSiteToCommercantMock.mockResolvedValue({
      message: 'Le site e-commerce ECOM-000099 a été affecté au commerçant du dossier validé.'
    });

    renderPage('10', 'new-pdv');
    await screen.findAllByText(/ACME SARL/);

    const urlInput = screen.getByPlaceholderText('https://...');
    fireEvent.change(urlInput, { target: { value: 'https://nouvelle-boutique.example.ma' } });
    fireEvent.click(screen.getByRole('button', { name: 'Affecter' }));

    expect(await screen.findByText(/ECOM-000099/)).toBeInTheDocument();
    expect(assignEcommerceSiteToCommercantMock).toHaveBeenCalledWith({
      dossierId: 10,
      url: 'https://nouvelle-boutique.example.ma'
    });
  });

  it("une extension ENCAISSEMENT_ET_ECOMMERCE donne acces aux deux blocs (TPE et site e-commerce), meme mecanisme que l'affiliation initiale", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE', peutAffecterTpe: true })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 11, nomCommercant: 'ACME SARL', status: 'ACCEPTE', typeAffiliation: 'ENCAISSEMENT_ET_ECOMMERCE',
        origineCreation: 'NOUVEAU_PDV', tpeDejaAffecte: false, ecommerceSiteDejaAffecte: false
      }]
    });
    getEligibleTpesMock.mockResolvedValue({ tpes: [] });

    renderPage('11', 'new-pdv');
    await screen.findAllByText(/ACME SARL/);

    expect(await screen.findByText('Affecter un TPE')).toBeInTheDocument();
    expect(screen.getByText('Affecter un site e-commerce')).toBeInTheDocument();
  });

  it("ne propose pas d'affecter un TPE tant que le contrat n'est pas signe et depose (CONTRAT_A_SIGNER)", async () => {
    // Le backend (getEligibleTpesForDossier / validateTpeAssignment) refuse
    // toute affectation avant ACCEPTE — le bloc ne doit donc pas s'afficher au
    // statut CONTRAT_A_SIGNER, sous peine de montrer a tort "Aucun TPE
    // disponible pour ce type de dossier" alors que la vraie raison est que le
    // commercant n'a pas encore signe/depose son contrat.
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE', peutAffecterTpe: true })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 2, nomCommercant: 'ACME SARL', status: 'CONTRAT_A_SIGNER', typeAffiliation: 'TPE',
        tpeDejaAffecte: false
      }]
    });

    renderPage('2');
    await screen.findAllByText(/ACME SARL/);

    expect(screen.queryByText('Affecter un TPE')).toBeNull();
    expect(getEligibleTpesMock).not.toHaveBeenCalled();
  });

  it('un dossier ENCAISSEMENT_ET_ECOMMERCE donne acces aux deux blocs a la fois (TPE et site e-commerce)', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE', peutAffecterTpe: true })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 3, nomCommercant: 'ACME SARL', status: 'ACCEPTE', typeAffiliation: 'ENCAISSEMENT_ET_ECOMMERCE',
        tpeDejaAffecte: false, ecommerceSiteDejaAffecte: false
      }]
    });
    getEligibleTpesMock.mockResolvedValue({ tpes: [] });

    renderPage('3');
    await screen.findAllByText(/ACME SARL/);

    expect(await screen.findByText('Affecter un TPE')).toBeInTheDocument();
    expect(screen.getByText('Affecter un site e-commerce')).toBeInTheDocument();
  });

  it("affecte un site e-commerce sans identifiant fourni par l'utilisateur (genere par switch-monetique-service)", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE', peutAffecterTpe: true })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 4, nomCommercant: 'ACME SARL', status: 'ACCEPTE', typeAffiliation: 'E_COMMERCE',
        ecommerceSiteDejaAffecte: false
      }]
    });
    assignEcommerceSiteToCommercantMock.mockResolvedValue({
      message: 'Le site e-commerce ECOM-000042 a été affecté au commerçant du dossier validé.'
    });

    renderPage('4');
    await screen.findAllByText(/ACME SARL/);

    const urlInput = screen.getByPlaceholderText('https://...');
    fireEvent.change(urlInput, { target: { value: 'https://boutique.example.ma' } });
    fireEvent.click(screen.getByRole('button', { name: 'Affecter' }));

    expect(await screen.findByText(/ECOM-000042/)).toBeInTheDocument();
    expect(assignEcommerceSiteToCommercantMock).toHaveBeenCalledWith({
      dossierId: 4,
      url: 'https://boutique.example.ma'
    });
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

  it('un back office peut demander une correction avec un type de probleme et un motif renseignes', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'EN_ATTENTE_VALIDATION_BOA', typeAffiliation: 'TPE' }]
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

  it('un commercial peut abandonner un dossier incomplet avec un motif', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'INCOMPLET', typeAffiliation: 'TPE' }]
    });
    abandonAffiliationRequestMock.mockResolvedValue({ message: 'Dossier abandonné.' });

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    const abandonButton = screen.getByRole('button', { name: 'Marquer abandonné' });
    expect(abandonButton).toBeDisabled();

    fireEvent.change(
      screen.getByPlaceholderText('Exemple: commerçant injoignable après relances, documents non transmis...'),
      { target: { value: 'Commerçant injoignable après 3 relances.' } }
    );
    expect(abandonButton).not.toBeDisabled();
    fireEvent.click(abandonButton);

    expect(await screen.findByText('Dossier abandonné.')).toBeInTheDocument();
    expect(abandonAffiliationRequestMock).toHaveBeenCalledWith(1, { motif: 'Commerçant injoignable après 3 relances.' });
  });

  it("affiche un message d'erreur si l'abandon du dossier echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 1, nomCommercant: 'ACME SARL', status: 'INCOMPLET', typeAffiliation: 'TPE' }]
    });
    abandonAffiliationRequestMock.mockRejectedValue({});

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    fireEvent.change(
      screen.getByPlaceholderText('Exemple: commerçant injoignable après relances, documents non transmis...'),
      { target: { value: 'Motif quelconque.' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Marquer abandonné' }));

    expect(await screen.findByText("Impossible d'abandonner ce dossier.")).toBeInTheDocument();
  });

  it('telecharge le contrat genere et le contrat signe depuis l\'onglet Contrat', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 1, nomCommercant: 'ACME SARL', status: 'ACTIF', typeAffiliation: 'TPE',
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

  it("affiche une erreur si le telechargement du contrat echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 1, nomCommercant: 'ACME SARL', status: 'ACTIF', typeAffiliation: 'TPE',
        contractDisponible: true, contractFileName: 'contrat-1.pdf'
      }]
    });
    downloadGeneratedContractMock.mockRejectedValue(new Error('503'));

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    fireEvent.click(screen.getByRole('button', { name: 'Contrat' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Télécharger le contrat' }));

    expect(await screen.findByText('503')).toBeInTheDocument();
  });

  it('telecharge le compte-rendu commercial depuis l\'onglet Suivi', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 1, nomCommercant: 'ACME SARL', status: 'ACTIF', typeAffiliation: 'TPE',
        commercialReportDisponible: true
      }]
    });
    const blob = new Blob(['rapport']);
    downloadCommercialReportMock.mockResolvedValue(blob);

    renderPage('1');
    await screen.findAllByText(/ACME SARL/);

    fireEvent.click(screen.getByRole('button', { name: /Suivi/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Télécharger le compte rendu' }));

    await vi.waitFor(() => expect(downloadCommercialReportMock).toHaveBeenCalledWith(1));
    expect(triggerBlobDownloadMock).toHaveBeenCalledWith(blob, `compte-rendu-1.pdf`);
  });
});
