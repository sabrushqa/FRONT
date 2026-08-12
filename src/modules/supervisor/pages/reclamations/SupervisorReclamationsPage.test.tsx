import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SupervisorReclamationsPage from './SupervisorReclamationsPage';
import { resolveRegionKey } from '../../../../core/moroccoGeoData';

const getReclamationsMock = vi.fn();
const getOverviewMock = vi.fn();

vi.mock('../../../backoffice/services/reclamationsApi', () => ({
  getReclamations: (...args: unknown[]) => getReclamationsMock(...args)
}));

vi.mock('../../services/supervisorApi', () => ({
  getOverview: (...args: unknown[]) => getOverviewMock(...args)
}));

function item(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    idReclamation: 1, referenceChat: null, typeProbleme: 'MATERIEL', description: 'Panne', statut: 'EN_COURS',
    priorite: 'HAUTE', dateCreation: '2026-07-01', dateResolution: null, commentaire: null, tpeId: null,
    tpeNumeroSerie: null, tpeModele: null, commercantId: null, commercantNom: 'ACME', region: 'Casablanca',
    typeAffiliation: null, backOfficeTraitant: null, backOfficeId: null, backOfficeUtilisateurId: null,
    dureeTraitementJours: null, ...overrides
  };
}

beforeEach(() => {
  getReclamationsMock.mockReset();
  getOverviewMock.mockReset().mockResolvedValue({ backOffices: [], commerciales: [], commercants: [] });
});

describe('SupervisorReclamationsPage', () => {
  it('affiche toutes les reclamations toutes regions confondues', async () => {
    getReclamationsMock.mockResolvedValue([
      item({ idReclamation: 1, commercantNom: 'Casa Corp', region: 'Casablanca' }),
      item({ idReclamation: 2, commercantNom: 'Rabat Corp', region: 'Rabat' })
    ]);

    render(<SupervisorReclamationsPage />);
    expect(await screen.findByText('Casa Corp')).toBeInTheDocument();
    expect(screen.getByText('Rabat Corp')).toBeInTheDocument();
  });

  it('filtre par region', async () => {
    getReclamationsMock.mockResolvedValue([
      item({ idReclamation: 1, commercantNom: 'Casa Corp', region: 'Casablanca' }),
      item({ idReclamation: 2, commercantNom: 'Rabat Corp', region: 'Rabat' })
    ]);

    render(<SupervisorReclamationsPage />);
    await screen.findByText('Casa Corp');

    const rabatKey = resolveRegionKey('Rabat');
    const regionSelect = screen.getAllByRole('combobox').find((el) =>
      Array.from((el as HTMLSelectElement).options).some((o) => o.value === rabatKey)
    ) as HTMLSelectElement;
    fireEvent.change(regionSelect, { target: { value: rabatKey } });

    expect(screen.queryByText('Casa Corp')).toBeNull();
    expect(screen.getByText('Rabat Corp')).toBeInTheDocument();
  });

  it('le menu Region propose toujours les 12 regions + non renseignee, meme sans donnees', async () => {
    getReclamationsMock.mockResolvedValue([]);

    render(<SupervisorReclamationsPage />);
    await screen.findByText('Aucune réclamation ne correspond aux filtres.');

    const regionSelect = screen.getByLabelText('Région') as HTMLSelectElement;
    // 12 regions officielles + "non renseignee" + l'option "Toutes" = 14
    expect(regionSelect.options.length).toBe(14);
  });

  it("le menu Type d'affiliation propose toujours toutes les valeurs, meme sans donnees", async () => {
    getReclamationsMock.mockResolvedValue([]);

    render(<SupervisorReclamationsPage />);
    await screen.findByText('Aucune réclamation ne correspond aux filtres.');

    const typeSelect = screen.getByLabelText("Type d'affiliation") as HTMLSelectElement;
    // 5 valeurs de l'enum TypeAffiliation + l'option "Tous"
    expect(typeSelect.options.length).toBe(6);
  });

  it('le menu BOA propose tous les back-offices existants, meme sans reclamation traitee', async () => {
    getReclamationsMock.mockResolvedValue([]);
    getOverviewMock.mockResolvedValue({
      backOffices: [
        { id: 1, utilisateurId: 1, nom: 'Alami', prenom: 'Sara', email: 's@x.com', matricule: 'BO1', service: 'S', role: 'BACK_OFFICE', active: true, dateCreation: null, dateActivation: null },
        { id: 2, utilisateurId: 2, nom: 'Idrissi', prenom: 'Yassine', email: 'y@x.com', matricule: 'BO2', service: 'S', role: 'BACK_OFFICE', active: false, dateCreation: null, dateActivation: null }
      ],
      commerciales: [],
      commercants: []
    });

    render(<SupervisorReclamationsPage />);
    await screen.findByText('Aucune réclamation ne correspond aux filtres.');

    const boaSelect = await screen.findByLabelText('BOA (traitée par)') as HTMLSelectElement;
    expect(await screen.findByRole('option', { name: 'Sara Alami' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Yassine Idrissi' })).toBeInTheDocument();
    expect(boaSelect.options.length).toBe(3);
  });

  it("affiche un message d'erreur si le chargement echoue", async () => {
    getReclamationsMock.mockRejectedValue(new Error('503'));
    render(<SupervisorReclamationsPage />);
    expect(await screen.findByText(/impossible/i)).toBeInTheDocument();
  });
});
