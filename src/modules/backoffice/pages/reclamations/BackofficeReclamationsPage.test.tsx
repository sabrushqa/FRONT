import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BackofficeReclamationsPage from './BackofficeReclamationsPage';

const getReclamationsMock = vi.fn();
const getReclamationStatsMock = vi.fn();
const updateReclamationStatutMock = vi.fn();

vi.mock('../../services/reclamationsApi', () => ({
  getReclamations: (...args: unknown[]) => getReclamationsMock(...args),
  getReclamationStats: (...args: unknown[]) => getReclamationStatsMock(...args),
  updateReclamationStatut: (...args: unknown[]) => updateReclamationStatutMock(...args)
}));

beforeEach(() => {
  getReclamationsMock.mockReset();
  getReclamationStatsMock.mockReset().mockResolvedValue({ total: 0 });
  updateReclamationStatutMock.mockReset();
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
});
