import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommercantRequestStatusPage from './CommercantRequestStatusPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const getLatestContractMock = vi.fn();
const downloadLatestContractMock = vi.fn();
const uploadSignedContractMock = vi.fn();
const verifyContractSignatureMock = vi.fn();
const triggerBlobDownloadMock = vi.fn();
const openBlobInNewTabMock = vi.fn();

vi.mock('../../services/commercantApi', () => ({
  getLatestContract: (...args: unknown[]) => getLatestContractMock(...args),
  downloadLatestContract: (...args: unknown[]) => downloadLatestContractMock(...args),
  uploadSignedContract: (...args: unknown[]) => uploadSignedContractMock(...args),
  verifyContractSignature: (...args: unknown[]) => verifyContractSignatureMock(...args)
}));

vi.mock('../../../../core/browserDownload', () => ({
  triggerBlobDownload: (...args: unknown[]) => triggerBlobDownloadMock(...args),
  openBlobInNewTab: (...args: unknown[]) => openBlobInNewTabMock(...args)
}));

beforeEach(() => {
  getLatestContractMock.mockReset().mockRejectedValue(new Error('no contract yet'));
  downloadLatestContractMock.mockReset();
  uploadSignedContractMock.mockReset();
  verifyContractSignatureMock.mockReset();
  triggerBlobDownloadMock.mockReset();
  openBlobInNewTabMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

function setContractSession(overrides: Partial<Record<string, unknown>> = {}) {
  useSessionStore.getState().setSession(
    normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', dossierStatus: 'CONTRAT_A_SIGNER' })
  );
  getLatestContractMock.mockResolvedValue({
    dossierId: 1, dossierStatus: 'CONTRAT_A_SIGNER', contractDisponible: true, contractFileName: 'contrat.pdf',
    contractGeneratedAt: '2026-07-01', signedContractDisponible: false, signedContractFileName: '',
    signedContractUploadedAt: null, commercialAttribue: 'Amine', ...overrides
  });
}

describe('CommercantRequestStatusPage', () => {
  it('affiche 100% et Accepté pour un dossier accepte', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', dossierStatus: 'ACCEPTE' })
    );
    render(<CommercantRequestStatusPage />);
    expect(await screen.findByText('100%')).toBeInTheDocument();
  });

  it('affiche le motif de refus pour un dossier refuse', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', dossierStatus: 'REFUSE', dossierMotifRefus: 'Documents incomplets' })
    );
    render(<CommercantRequestStatusPage />);
    expect(await screen.findByText('Motif de refus')).toBeInTheDocument();
    expect(screen.getByText('Documents incomplets')).toBeInTheDocument();
  });

  it("indique une progression a 40% pour un dossier soumis", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', dossierStatus: 'SOUMIS' })
    );
    render(<CommercantRequestStatusPage />);
    expect(await screen.findByText('40%')).toBeInTheDocument();
  });

  it('genere une reference de dossier basee sur le commercantId', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 42, role: 'COMMERCANT', dossierStatus: 'SOUMIS' })
    );
    render(<CommercantRequestStatusPage />);
    expect(await screen.findByText(/DOS-0042/)).toBeInTheDocument();
  });

  it('telecharge le contrat disponible', async () => {
    setContractSession();
    const blob = new Blob(['pdf']);
    downloadLatestContractMock.mockResolvedValue(blob);

    render(<CommercantRequestStatusPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Télécharger' }));

    await vi.waitFor(() => expect(downloadLatestContractMock).toHaveBeenCalled());
    expect(triggerBlobDownloadMock).toHaveBeenCalledWith(blob, 'contrat.pdf');
  });

  it('affiche une erreur si le telechargement du contrat echoue', async () => {
    setContractSession();
    downloadLatestContractMock.mockRejectedValue(new Error('503'));

    render(<CommercantRequestStatusPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Télécharger' }));

    expect(await screen.findByText('Téléchargement impossible.')).toBeInTheDocument();
  });

  it('verifie la signature du contrat depose', async () => {
    setContractSession();
    verifyContractSignatureMock.mockResolvedValue({ signed: true, message: 'Signature détectée' });

    render(<CommercantRequestStatusPage />);
    const file = new File(['contenu'], 'signe.pdf', { type: 'application/pdf' });
    const fileInput = await screen.findByLabelText('Déposer le contrat signé');
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: 'Vérifier la signature' }));

    expect(await screen.findByText('Signature détectée')).toBeInTheDocument();
    expect(verifyContractSignatureMock).toHaveBeenCalledWith(file);
  });

  it('envoie le contrat signe', async () => {
    setContractSession();
    uploadSignedContractMock.mockResolvedValue({ message: 'Contrat signé envoyé.' });

    render(<CommercantRequestStatusPage />);
    const file = new File(['contenu'], 'signe.pdf', { type: 'application/pdf' });
    const fileInput = await screen.findByLabelText('Déposer le contrat signé');
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(await screen.findByText('Contrat signé envoyé.')).toBeInTheDocument();
    expect(uploadSignedContractMock).toHaveBeenCalledWith(file);
  });
});
