import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BackofficeReclamationsPage from './BackofficeReclamationsPage';

const getReclamationsMock = vi.fn();
const getReclamationStatsMock = vi.fn();
const updateReclamationStatutMock = vi.fn();
const fetchReclamationPdfBlobMock = vi.fn();

vi.mock('../../services/reclamationsApi', () => ({
  getReclamations: (...args: unknown[]) => getReclamationsMock(...args),
  getReclamationStats: (...args: unknown[]) => getReclamationStatsMock(...args),
  updateReclamationStatut: (...args: unknown[]) => updateReclamationStatutMock(...args),
  fetchReclamationPdfBlob: (...args: unknown[]) => fetchReclamationPdfBlobMock(...args)
}));

beforeEach(() => {
  getReclamationsMock.mockReset();
  getReclamationStatsMock.mockReset().mockResolvedValue({ total: 0 });
  updateReclamationStatutMock.mockReset();
  fetchReclamationPdfBlobMock.mockReset();
});

function item(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    idReclamation: 1, referenceChat: null, typeProbleme: 'MATERIEL', description: 'Panne', statut: 'EN_COURS',
    priorite: 'HAUTE', dateCreation: '2026-07-01', dateResolution: null, commentaire: null, tpeId: null,
    tpeNumeroSerie: null, tpeModele: null, commercantId: null, commercantNom: 'ACME', region: null,
    typeAffiliation: null, backOfficeTraitant: null, backOfficeId: null, backOfficeUtilisateurId: null,
    dureeTraitementJours: null, ...overrides
  };
}

describe('BackofficeReclamationsPage', () => {
  it('fusionne et trie les reclamations EN_COURS et EN_ATTENTE par id decroissant', async () => {
    getReclamationsMock.mockImplementation((params: { statut: string }) =>
      Promise.resolve(params.statut === 'EN_COURS' ? [item({ idReclamation: 1 })] : [item({ idReclamation: 2 })])
    );

    render(<BackofficeReclamationsPage />);

    const rows = await screen.findAllByText('ACME');
    expect(rows.length).toBe(2);
  });

  it('marque une reclamation comme resolue', async () => {
    getReclamationsMock.mockImplementation((params: { statut: string }) =>
      Promise.resolve(params.statut === 'EN_COURS' ? [item()] : [])
    );
    updateReclamationStatutMock.mockResolvedValue({ ...item(), statut: 'RESOLU' });

    render(<BackofficeReclamationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Résoudre' }));

    expect(await screen.findByText(/marquée comme résolue/)).toBeInTheDocument();
    expect(updateReclamationStatutMock).toHaveBeenCalledWith(1, 'RESOLU');
  });

  it('filtre par recherche texte', async () => {
    getReclamationsMock.mockImplementation((params: { statut: string }) =>
      Promise.resolve(
        params.statut === 'EN_COURS'
          ? [
              item({ idReclamation: 1, commercantNom: 'ACME', description: 'Panne ecran' }),
              item({ idReclamation: 2, commercantNom: 'Beta', description: 'Souci reseau' })
            ]
          : []
      )
    );

    render(<BackofficeReclamationsPage />);
    await screen.findAllByText(/ACME|Beta/);

    fireEvent.change(screen.getByPlaceholderText('Description, TPE, réf...'), { target: { value: 'reseau' } });
    expect(screen.queryByText('ACME')).toBeNull();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it("affiche une erreur si le chargement echoue", async () => {
    getReclamationsMock.mockRejectedValue(new Error('503'));
    getReclamationStatsMock.mockRejectedValue(new Error('503'));

    render(<BackofficeReclamationsPage />);
    expect(await screen.findByText('Impossible de charger les réclamations.')).toBeInTheDocument();
  });

  it('marque une reclamation comme escaladee', async () => {
    getReclamationsMock.mockImplementation((params: { statut: string }) =>
      Promise.resolve(params.statut === 'EN_COURS' ? [item()] : [])
    );
    updateReclamationStatutMock.mockResolvedValue({ ...item(), statut: 'ESCALADE' });

    render(<BackofficeReclamationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Escalader' }));

    expect(await screen.findByText(/marquée comme escaladée/)).toBeInTheDocument();
    expect(updateReclamationStatutMock).toHaveBeenCalledWith(1, 'ESCALADE');
  });

  it("affiche une erreur si la mise a jour du statut echoue", async () => {
    getReclamationsMock.mockImplementation((params: { statut: string }) =>
      Promise.resolve(params.statut === 'EN_COURS' ? [item()] : [])
    );
    updateReclamationStatutMock.mockRejectedValue(new Error('503'));

    render(<BackofficeReclamationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Résoudre' }));

    expect(await screen.findByText('Impossible de mettre à jour la réclamation #1.')).toBeInTheDocument();
  });

  it('filtre par priorite et par type de probleme', async () => {
    getReclamationsMock.mockImplementation((params: { statut: string }) =>
      Promise.resolve(
        params.statut === 'EN_COURS'
          ? [
              item({ idReclamation: 1, commercantNom: 'ACME', priorite: 'CRITIQUE', typeProbleme: 'MATERIEL' }),
              item({ idReclamation: 2, commercantNom: 'Beta', priorite: 'BASSE', typeProbleme: 'RESEAU' })
            ]
          : []
      )
    );

    render(<BackofficeReclamationsPage />);
    await screen.findAllByText(/ACME|Beta/);

    fireEvent.change(screen.getByRole('combobox', { name: /Priorité/ }), { target: { value: 'CRITIQUE' } });
    expect(screen.getByText('ACME')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).toBeNull();

    fireEvent.change(screen.getByRole('combobox', { name: /Priorité/ }), { target: { value: 'all' } });
    fireEvent.change(screen.getByRole('combobox', { name: /^Type/ }), { target: { value: 'RESEAU' } });
    expect(screen.queryByText('ACME')).toBeNull();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('ouvre la fiche PDF au clic sur "Voir / Imprimer"', async () => {
    getReclamationsMock.mockImplementation((params: { statut: string }) =>
      Promise.resolve(params.statut === 'EN_COURS' ? [item()] : [])
    );
    fetchReclamationPdfBlobMock.mockResolvedValue(new Blob(['pdf']));
    const fakeTab = { close: vi.fn(), location: { href: '' } };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeTab as unknown as Window);

    render(<BackofficeReclamationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Voir / Imprimer' }));

    await waitFor(() => expect(fetchReclamationPdfBlobMock).toHaveBeenCalledWith(1));
    expect(screen.queryByText(/Impossible d'ouvrir la fiche PDF/)).toBeNull();
    openSpy.mockRestore();
  });

  it("affiche une erreur si l'ouverture de la fiche PDF echoue", async () => {
    getReclamationsMock.mockImplementation((params: { statut: string }) =>
      Promise.resolve(params.statut === 'EN_COURS' ? [item()] : [])
    );
    fetchReclamationPdfBlobMock.mockRejectedValue(new Error('503'));
    const fakeTab = { close: vi.fn(), location: { href: '' } };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeTab as unknown as Window);

    render(<BackofficeReclamationsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Voir / Imprimer' }));

    expect(await screen.findByText("Impossible d'ouvrir la fiche PDF de la réclamation #1.")).toBeInTheDocument();
    expect(fakeTab.close).toHaveBeenCalled();
    openSpy.mockRestore();
  });
});
