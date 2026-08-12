import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import SupervisorTeamPerformancePage from './SupervisorTeamPerformancePage';

const getOverviewMock = vi.fn();
const getAffiliationRequestsMock = vi.fn();
const getPdvMapMock = vi.fn();
const getTpeStockMock = vi.fn();

vi.mock('../../services/supervisorApi', () => ({
  getOverview: (...args: unknown[]) => getOverviewMock(...args),
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args),
  getPdvMap: (...args: unknown[]) => getPdvMapMock(...args),
  getTpeStock: (...args: unknown[]) => getTpeStockMock(...args)
}));

function request(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    dossierId: 1,
    status: 'ACCEPTE',
    compteActif: true,
    origineCreation: 'COMMERCIAL_DIRECT',
    commercialAttribue: 'Sara Alami',
    commercialAttribueId: 1,
    region: 'Casablanca-Settat',
    prospectStatus: 'CONVERTI',
    backOfficeTraitant: 'Yassine Idrissi',
    dateSoumission: new Date().toISOString(),
    ...overrides
  };
}

beforeEach(() => {
  getOverviewMock.mockReset().mockResolvedValue({ backOffices: [], commerciales: [], commercants: [] });
  getAffiliationRequestsMock.mockReset().mockResolvedValue({ requests: [request()] });
  getPdvMapMock.mockReset().mockResolvedValue({ pdvs: [] });
  getTpeStockMock.mockReset().mockResolvedValue({ tpes: [] });
});

describe('SupervisorTeamPerformancePage', () => {
  it('affiche la section Commerciales (vue globale, prospection directe, auto-affiliation par region) et Back office', async () => {
    render(<SupervisorTeamPerformancePage />);

    expect(await screen.findByText('Suivi par commerciale, toutes origines')).toBeInTheDocument();
    expect(screen.getAllByText('Sara Alami').length).toBeGreaterThan(0);
    expect(screen.getByText('Traitement, décisions et retours')).toBeInTheDocument();
  });

  it("affiche un message d'erreur si le chargement echoue", async () => {
    getAffiliationRequestsMock.mockRejectedValue(new Error('503'));
    render(<SupervisorTeamPerformancePage />);
    expect(await screen.findByText('Les indicateurs superviseur sont indisponibles.')).toBeInTheDocument();
  });

  it('affiche un etat vide pour les commerciales quand il n\'y a aucune demande', async () => {
    getAffiliationRequestsMock.mockResolvedValue({ requests: [] });
    render(<SupervisorTeamPerformancePage />);
    expect(await screen.findByText('Aucune performance commerciale')).toBeInTheDocument();
  });
});
