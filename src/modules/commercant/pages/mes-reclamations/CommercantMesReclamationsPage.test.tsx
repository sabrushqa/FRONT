import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommercantMesReclamationsPage from './CommercantMesReclamationsPage';

const getMyReclamationsMock = vi.fn();
const fetchMyReclamationPdfBlobMock = vi.fn();
const openBlobInNewTabMock = vi.fn();
const triggerBlobDownloadMock = vi.fn();

vi.mock('../../services/commercantApi', () => ({
  getMyReclamations: (...args: unknown[]) => getMyReclamationsMock(...args),
  fetchMyReclamationPdfBlob: (...args: unknown[]) => fetchMyReclamationPdfBlobMock(...args)
}));

vi.mock('../../../../core/browserDownload', () => ({
  openBlobInNewTab: (...args: unknown[]) => openBlobInNewTabMock(...args),
  triggerBlobDownload: (...args: unknown[]) => triggerBlobDownloadMock(...args)
}));

beforeEach(() => {
  getMyReclamationsMock.mockReset();
  fetchMyReclamationPdfBlobMock.mockReset();
  openBlobInNewTabMock.mockReset();
  triggerBlobDownloadMock.mockReset();
});

function item(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    idReclamation: 1, referenceChat: 'TPE-ABC', typeProbleme: 'MATERIEL',
    description: 'Le TPE ne s\'allume plus.', statut: 'EN_COURS', priorite: 'HAUTE',
    dateCreation: '2026-08-01', dateResolution: null, commentaire: null,
    tpeNumeroSerie: null, tpeModele: null, tpeReference: null,
    resumeCourt: 'Panne matérielle', ...overrides
  };
}

describe('CommercantMesReclamationsPage', () => {
  it('affiche les réclamations non traitées par défaut', async () => {
    getMyReclamationsMock.mockResolvedValue([
      item({ idReclamation: 1, statut: 'EN_COURS' }),
      item({ idReclamation: 2, statut: 'RESOLU' }),
    ]);

    render(<CommercantMesReclamationsPage />);

    expect(await screen.findByText('Panne matérielle')).toBeInTheDocument();
    expect(screen.queryByText('#2')).toBeNull(); // la resolue n'est pas dans "non traitées"
  });

  it("affiche un message quand aucune réclamation n'est en cours", async () => {
    getMyReclamationsMock.mockResolvedValue([item({ statut: 'RESOLU' })]);

    render(<CommercantMesReclamationsPage />);

    expect(await screen.findByText(/Aucune réclamation en cours/)).toBeInTheDocument();
  });

  it("bascule vers l'historique et affiche les réclamations closes", async () => {
    getMyReclamationsMock.mockResolvedValue([
      item({ idReclamation: 1, statut: 'EN_COURS' }),
      item({ idReclamation: 2, statut: 'RESOLU', resumeCourt: 'Problème résolu' }),
    ]);

    render(<CommercantMesReclamationsPage />);
    await screen.findByText('#1');

    fireEvent.change(screen.getByLabelText('Affichage'), { target: { value: 'historique' } });

    expect(await screen.findByText('#2')).toBeInTheDocument();
    expect(screen.queryByText('#1')).toBeNull();
  });

  it('ouvre la fiche PDF au clic sur Voir / Imprimer', async () => {
    getMyReclamationsMock.mockResolvedValue([item()]);
    const blob = new Blob(['pdf']);
    fetchMyReclamationPdfBlobMock.mockResolvedValue(blob);

    render(<CommercantMesReclamationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Voir / Imprimer' }));

    expect(fetchMyReclamationPdfBlobMock).toHaveBeenCalledWith(1);
    await screen.findByText('Panne matérielle'); // laisse le temps a l'appel async de se resoudre
    expect(openBlobInNewTabMock).toHaveBeenCalled();
  });

  it('télécharge la fiche PDF au clic sur Télécharger', async () => {
    getMyReclamationsMock.mockResolvedValue([item({ idReclamation: 1, referenceChat: 'TPE-XYZ' })]);
    const blob = new Blob(['pdf']);
    fetchMyReclamationPdfBlobMock.mockResolvedValue(blob);

    render(<CommercantMesReclamationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Télécharger' }));

    expect(fetchMyReclamationPdfBlobMock).toHaveBeenCalledWith(1);
    await screen.findByText('Panne matérielle');
    expect(triggerBlobDownloadMock).toHaveBeenCalledWith(blob, 'reclamation-TPE-XYZ.pdf');
  });

  it('affiche une erreur si le téléchargement échoue', async () => {
    getMyReclamationsMock.mockResolvedValue([item({ idReclamation: 1 })]);
    fetchMyReclamationPdfBlobMock.mockRejectedValue(new Error('503'));

    render(<CommercantMesReclamationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Télécharger' }));

    expect(await screen.findByText('Téléchargement impossible pour la réclamation #1.')).toBeInTheDocument();
  });

  it("affiche une erreur si l'ouverture de la fiche PDF échoue", async () => {
    getMyReclamationsMock.mockResolvedValue([item({ idReclamation: 1 })]);
    fetchMyReclamationPdfBlobMock.mockRejectedValue(new Error('503'));

    render(<CommercantMesReclamationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Voir / Imprimer' }));

    expect(await screen.findByText("Impossible d'ouvrir la fiche PDF de la réclamation #1.")).toBeInTheDocument();
  });

  it('affiche une erreur si le chargement échoue', async () => {
    getMyReclamationsMock.mockRejectedValue(new Error('503'));

    render(<CommercantMesReclamationsPage />);
    expect(await screen.findByText('Impossible de charger vos réclamations.')).toBeInTheDocument();
  });
});
