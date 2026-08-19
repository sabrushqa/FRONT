import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommercantPdvRequestPage from './CommercantPdvRequestPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const requestNewPdvProductMock = vi.fn();
const getLatestContractMock = vi.fn();
const downloadLatestContractMock = vi.fn();
const uploadSignedContractMock = vi.fn();
const verifyContractSignatureMock = vi.fn();

vi.mock('../../services/commercantApi', () => ({
  requestNewPdvProduct: (...args: unknown[]) => requestNewPdvProductMock(...args),
  getLatestContract: (...args: unknown[]) => getLatestContractMock(...args),
  downloadLatestContract: (...args: unknown[]) => downloadLatestContractMock(...args),
  uploadSignedContract: (...args: unknown[]) => uploadSignedContractMock(...args),
  verifyContractSignature: (...args: unknown[]) => verifyContractSignatureMock(...args)
}));

vi.mock('../../../../core/components/QuartierCombobox', () => ({
  default: () => <div data-testid="quartier-combobox" />
}));

vi.mock('../../../../core/components/PdvLocationPicker', () => ({
  default: () => <div data-testid="pdv-location-picker" />
}));

beforeEach(() => {
  requestNewPdvProductMock.mockReset();
  getLatestContractMock.mockReset().mockRejectedValue(new Error('no dossier'));
  downloadLatestContractMock.mockReset();
  uploadSignedContractMock.mockReset();
  verifyContractSignatureMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
  useSessionStore.getState().setActiveAffiliationProfile('ENCAISSEMENT');
});

describe('CommercantPdvRequestPage', () => {
  it('bloque la soumission si des champs obligatoires manquent (TPE)', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'ENCAISSEMENT' })
    );
    render(<CommercantPdvRequestPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Soumettre la demande' }));

    expect(screen.getAllByText(/Veuillez remplir/).length).toBeGreaterThan(0);
    expect(requestNewPdvProductMock).not.toHaveBeenCalled();
  });

  it('affiche un avertissement d\'acces restreint pour un sous-commercant', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SOUS_COMMERCANT', typeAffiliation: 'ENCAISSEMENT' })
    );
    render(<CommercantPdvRequestPage />);

    expect(screen.getByText('Cette page est disponible uniquement pour le compte commerçant principal.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Soumettre la demande' })).toBeNull();
  });

  it("un commercant e-commerce n'a aucune nouvelle demande disponible", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'E_COMMERCE' })
    );

    render(<CommercantPdvRequestPage />);

    expect(screen.getByText(/Aucune nouvelle demande n'est disponible pour un compte e-commerce/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Soumettre la demande' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'TPE' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'E-commerce' })).toBeNull();
  });

  it("propose le choix \"point de vente existant\" et soumet sans champs d'adresse", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'ENCAISSEMENT',
        pdvs: [
          { id: 7, nom: 'Boutique Maarif', ville: 'Casablanca', statut: 'ACTIF', adresse: '', telephone: '', email: '', codePostal: '', dateCreation: '', sousCommercantId: null, sousCommercant: '', sousCommercantEmail: '', sousCommercantStatut: '', sousCommercantActive: null },
          { id: 8, nom: 'Boutique en attente', ville: 'Rabat', statut: 'EN_VERIFICATION', adresse: '', telephone: '', email: '', codePostal: '', dateCreation: '', sousCommercantId: null, sousCommercant: '', sousCommercantEmail: '', sousCommercantStatut: '', sousCommercantActive: null }
        ]
      })
    );
    requestNewPdvProductMock.mockResolvedValue({ message: 'Demande envoyée avec succès' });

    render(<CommercantPdvRequestPage />);
    fireEvent.click(screen.getByRole('button', { name: 'PDV existant, juste des TPE' }));

    // Seul le PDV ACTIF doit etre propose dans le picker (pas celui EN_VERIFICATION,
    // qui apparait par ailleurs dans "Demandes en cours" — pas le meme element).
    const pdvSelect = screen.getByLabelText(/Point de vente \*/i);
    const optionLabels = Array.from(pdvSelect.querySelectorAll('option')).map((o) => o.textContent);
    expect(optionLabels.some((label) => label?.includes('Boutique Maarif'))).toBe(true);
    expect(optionLabels.some((label) => label?.includes('Boutique en attente'))).toBe(false);
    expect(screen.queryByLabelText(/Nom du point de vente/i)).toBeNull();

    fireEvent.change(pdvSelect, { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText(/Nombre de TPE/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/Équipement/i), { target: { value: 'TPEAutonome' } });
    fireEvent.change(screen.getByLabelText(/Connectivité/i), { target: { value: 'Fixe' } });
    fireEvent.click(screen.getByRole('button', { name: 'Soumettre la demande' }));

    expect(await screen.findByText('Demande envoyée avec succès')).toBeInTheDocument();
    expect(requestNewPdvProductMock).toHaveBeenCalledWith(
      expect.objectContaining({ existingPdvId: 7, nom: '' })
    );
  });

  it("n'envoie jamais existingPdvId quand le mode \"nouveau point de vente\" est utilisé", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'ENCAISSEMENT',
        pdvs: [{ id: 7, nom: 'Boutique Maarif', ville: 'Casablanca', statut: 'ACTIF', adresse: '', telephone: '', email: '', codePostal: '', dateCreation: '', sousCommercantId: null, sousCommercant: '', sousCommercantEmail: '', sousCommercantStatut: '', sousCommercantActive: null }]
      })
    );
    requestNewPdvProductMock.mockResolvedValue({ message: 'Demande envoyée avec succès' });

    render(<CommercantPdvRequestPage />);
    fireEvent.change(screen.getByLabelText(/Nom du point de vente/i), { target: { value: 'Nouvelle boutique' } });
    fireEvent.change(screen.getByLabelText(/Ville/i), { target: { value: 'Casablanca' } });
    fireEvent.change(screen.getByLabelText(/Téléphone/i), { target: { value: '0600000000' } });
    fireEvent.change(screen.getByLabelText(/Adresse/i), { target: { value: '1 rue Test' } });
    fireEvent.change(screen.getByLabelText(/Nombre de TPE/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/Équipement/i), { target: { value: 'TPEAutonome' } });
    fireEvent.change(screen.getByLabelText(/Connectivité/i), { target: { value: 'Fixe' } });
    fireEvent.click(screen.getByRole('button', { name: 'Soumettre la demande' }));

    expect(await screen.findByText('Demande envoyée avec succès')).toBeInTheDocument();
    expect(requestNewPdvProductMock).toHaveBeenCalledWith(
      expect.objectContaining({ existingPdvId: null, nom: 'Nouvelle boutique' })
    );
  });

  it("commercant combine bascule sur E-commerce : aucune nouvelle demande disponible", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'ENCAISSEMENT_ET_ECOMMERCE' })
    );
    useSessionStore.getState().setActiveAffiliationProfile('E_COMMERCE');

    render(<CommercantPdvRequestPage />);

    expect(screen.getByText(/Aucune nouvelle demande n'est disponible pour un compte e-commerce/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'TPE' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'E-commerce' })).toBeNull();
  });

  it('commercant combine bascule sur Encaissement : propose TPE/SoftPOS, pas e-commerce', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'ENCAISSEMENT_ET_ECOMMERCE' })
    );
    useSessionStore.getState().setActiveAffiliationProfile('ENCAISSEMENT');

    render(<CommercantPdvRequestPage />);

    expect(screen.getByText('Nouvelle demande')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TPE' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'E-commerce' })).toBeNull();
  });

  it("n'affiche aucun bloc contrat quand la derniere demande est deja acceptee (rien en attente)", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'ENCAISSEMENT' })
    );
    getLatestContractMock.mockResolvedValue({
      dossierId: 1, dossierStatus: 'ACCEPTE', contractDisponible: true, contractFileName: 'contrat.pdf',
      contractGeneratedAt: '2026-08-01', signedContractDisponible: true, signedContractFileName: 'contrat-signe.pdf',
      signedContractUploadedAt: '2026-08-02', commercialAttribue: 'A. Dupont'
    });

    render(<CommercantPdvRequestPage />);

    expect(await screen.findByText('Point de vente')).toBeInTheDocument();
    expect(screen.queryByText('Contrat de votre demande')).toBeNull();
  });

  it("affiche le contrat de l'extension en attente de signature et permet de le deposer signe", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'ENCAISSEMENT' })
    );
    getLatestContractMock.mockResolvedValue({
      dossierId: 7, dossierStatus: 'CONTRAT_A_SIGNER', contractDisponible: true, contractFileName: 'contrat-pdv.pdf',
      contractGeneratedAt: '2026-08-10', signedContractDisponible: false, signedContractFileName: '',
      signedContractUploadedAt: null, commercialAttribue: 'A. Dupont'
    });
    uploadSignedContractMock.mockResolvedValue({ message: 'Contrat signé envoyé.' });

    render(<CommercantPdvRequestPage />);

    expect(await screen.findByText('Contrat de votre demande')).toBeInTheDocument();
    expect(screen.getByText('Dossier #0007')).toBeInTheDocument();
    expect(screen.getByText('Contrat à signer')).toBeInTheDocument();

    const file = new File(['x'], 'contrat-signe.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByText('Déposer le contrat signé').closest('label')!.querySelector('input')!;
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /^Envoyer$/ }));

    expect(await screen.findByText('Contrat signé envoyé.')).toBeInTheDocument();
    expect(uploadSignedContractMock).toHaveBeenCalledWith(file);
  });

  it("n'affiche pas les actions de depot tant que le contrat n'est pas encore genere", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'ENCAISSEMENT' })
    );
    getLatestContractMock.mockResolvedValue({
      dossierId: 8, dossierStatus: 'SOUMIS', contractDisponible: false, contractFileName: '',
      contractGeneratedAt: null, signedContractDisponible: false, signedContractFileName: '',
      signedContractUploadedAt: null, commercialAttribue: ''
    });

    render(<CommercantPdvRequestPage />);

    expect(await screen.findByText('Contrat de votre demande')).toBeInTheDocument();
    expect(screen.getByText(/en attente de validation par le back office/)).toBeInTheDocument();
    expect(screen.queryByText('Déposer le contrat signé')).toBeNull();
  });

  it('ouvre le contrat dans un nouvel onglet au clic sur "Voir"', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'ENCAISSEMENT' })
    );
    getLatestContractMock.mockResolvedValue({
      dossierId: 7, dossierStatus: 'CONTRAT_A_SIGNER', contractDisponible: true, contractFileName: 'contrat-pdv.pdf',
      contractGeneratedAt: '2026-08-10', signedContractDisponible: false, signedContractFileName: '',
      signedContractUploadedAt: null, commercialAttribue: 'A. Dupont'
    });
    const blob = new Blob(['pdf']);
    downloadLatestContractMock.mockResolvedValue(blob);
    const fakeTab = { close: vi.fn(), location: { href: '' } };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeTab as unknown as Window);

    render(<CommercantPdvRequestPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Voir' }));

    await vi.waitFor(() => expect(downloadLatestContractMock).toHaveBeenCalled());
    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    openSpy.mockRestore();
  });

  it("affiche une erreur si l'ouverture du contrat echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'ENCAISSEMENT' })
    );
    getLatestContractMock.mockResolvedValue({
      dossierId: 7, dossierStatus: 'CONTRAT_A_SIGNER', contractDisponible: true, contractFileName: 'contrat-pdv.pdf',
      contractGeneratedAt: '2026-08-10', signedContractDisponible: false, signedContractFileName: '',
      signedContractUploadedAt: null, commercialAttribue: 'A. Dupont'
    });
    downloadLatestContractMock.mockRejectedValue(new Error('503'));
    const fakeTab = { close: vi.fn() };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeTab as unknown as Window);

    render(<CommercantPdvRequestPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Voir' }));

    expect(await screen.findByText('Ouverture impossible.')).toBeInTheDocument();
    expect(fakeTab.close).toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('telecharge le contrat au clic sur "Télécharger"', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'ENCAISSEMENT' })
    );
    getLatestContractMock.mockResolvedValue({
      dossierId: 7, dossierStatus: 'CONTRAT_A_SIGNER', contractDisponible: true, contractFileName: 'contrat-pdv.pdf',
      contractGeneratedAt: '2026-08-10', signedContractDisponible: false, signedContractFileName: '',
      signedContractUploadedAt: null, commercialAttribue: 'A. Dupont'
    });
    downloadLatestContractMock.mockResolvedValue(new Blob(['pdf']));

    render(<CommercantPdvRequestPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Télécharger' }));

    await vi.waitFor(() => expect(downloadLatestContractMock).toHaveBeenCalled());
    expect(screen.queryByText('Téléchargement impossible.')).toBeNull();
  });

  it("affiche une erreur si le telechargement du contrat echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'ENCAISSEMENT' })
    );
    getLatestContractMock.mockResolvedValue({
      dossierId: 7, dossierStatus: 'CONTRAT_A_SIGNER', contractDisponible: true, contractFileName: 'contrat-pdv.pdf',
      contractGeneratedAt: '2026-08-10', signedContractDisponible: false, signedContractFileName: '',
      signedContractUploadedAt: null, commercialAttribue: 'A. Dupont'
    });
    downloadLatestContractMock.mockRejectedValue(new Error('503'));

    render(<CommercantPdvRequestPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Télécharger' }));

    expect(await screen.findByText('Téléchargement impossible.')).toBeInTheDocument();
  });

  it("verifie la signature du contrat depose et affiche une erreur si la verification echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'ENCAISSEMENT' })
    );
    getLatestContractMock.mockResolvedValue({
      dossierId: 7, dossierStatus: 'CONTRAT_A_SIGNER', contractDisponible: true, contractFileName: 'contrat-pdv.pdf',
      contractGeneratedAt: '2026-08-10', signedContractDisponible: false, signedContractFileName: '',
      signedContractUploadedAt: null, commercialAttribue: 'A. Dupont'
    });
    verifyContractSignatureMock.mockRejectedValue(new Error('503'));

    render(<CommercantPdvRequestPage />);
    await screen.findByText('Contrat de votre demande');

    const file = new File(['x'], 'contrat-signe.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByText('Déposer le contrat signé').closest('label')!.querySelector('input')!;
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /^Vérifier/ }));

    expect(await screen.findByText('Vérification impossible. Veuillez réessayer.')).toBeInTheDocument();
  });

  it("affiche une erreur si l'envoi du contrat signe echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'ENCAISSEMENT' })
    );
    getLatestContractMock.mockResolvedValue({
      dossierId: 7, dossierStatus: 'CONTRAT_A_SIGNER', contractDisponible: true, contractFileName: 'contrat-pdv.pdf',
      contractGeneratedAt: '2026-08-10', signedContractDisponible: false, signedContractFileName: '',
      signedContractUploadedAt: null, commercialAttribue: 'A. Dupont'
    });
    uploadSignedContractMock.mockRejectedValue({ response: { data: { message: 'Fichier invalide.' } } });

    render(<CommercantPdvRequestPage />);
    await screen.findByText('Contrat de votre demande');

    const file = new File(['x'], 'contrat-signe.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByText('Déposer le contrat signé').closest('label')!.querySelector('input')!;
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /^Envoyer$/ }));

    expect(await screen.findByText('Fichier invalide.')).toBeInTheDocument();
  });

  it('demande un nombre de SoftPOS (plafonne a 10) et un modele, soumet correctement', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'ENCAISSEMENT' })
    );
    requestNewPdvProductMock.mockResolvedValue({ message: 'Demande envoyée avec succès' });

    render(<CommercantPdvRequestPage />);
    fireEvent.click(screen.getByRole('button', { name: 'SoftPOS' }));

    // Les champs TPE disparaissent, ceux du SoftPOS apparaissent.
    expect(screen.queryByLabelText(/Équipement/i)).toBeNull();
    const quantityField = screen.getByLabelText('Nombre *');
    expect(quantityField).toBeInTheDocument();

    fireEvent.change(quantityField, { target: { value: '25' } });
    expect(quantityField).toHaveValue(10);

    fireEvent.click(screen.getByRole('button', { name: 'Soumettre la demande' }));
    expect(screen.getAllByText(/Veuillez remplir/).length).toBeGreaterThan(0);
    expect(requestNewPdvProductMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Nom du point de vente *'), { target: { value: 'Boutique SoftPOS' } });
    fireEvent.change(screen.getByLabelText(/^Ville/i), { target: { value: 'Casablanca' } });
    fireEvent.change(screen.getByLabelText(/Téléphone/i), { target: { value: '0600000000' } });
    fireEvent.change(screen.getByLabelText(/Adresse/i), { target: { value: '1 rue Test' } });
    fireEvent.change(screen.getByLabelText('Modèle *'), { target: { value: 'SoftPOS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Soumettre la demande' }));

    expect(await screen.findByText('Demande envoyée avec succès')).toBeInTheDocument();
    expect(requestNewPdvProductMock).toHaveBeenCalledWith(
      expect.objectContaining({ typeAffiliation: 'SOFTPOS', nombreQrSoftpos: '10', modeleQrSoftpos: 'SoftPOS' })
    );
  });
});
