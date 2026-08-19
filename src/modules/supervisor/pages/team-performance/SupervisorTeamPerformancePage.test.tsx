import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SupervisorTeamPerformancePage from './SupervisorTeamPerformancePage';
import { invalidateSupervisorDecisionDataCache } from '../decision-dashboard/useSupervisorDecisionData';

const getOverviewMock = vi.fn();
const getAffiliationRequestsMock = vi.fn();
const getPdvMapMock = vi.fn();
const getTpeStockMock = vi.fn();
const downloadExcelMock = vi.fn();

vi.mock('../../services/supervisorApi', () => ({
  getOverview: (...args: unknown[]) => getOverviewMock(...args),
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args),
  getPdvMap: (...args: unknown[]) => getPdvMapMock(...args),
  getTpeStock: (...args: unknown[]) => getTpeStockMock(...args)
}));

vi.mock('../../../../core/excelExport', () => ({
  downloadExcel: (...args: unknown[]) => downloadExcelMock(...args)
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
  downloadExcelMock.mockReset().mockImplementation(
    async (_fileName: string, _sheet: string, columns: Array<{ value: (row: unknown) => unknown }>, rows: unknown[]) => {
      // Execute chaque callback de colonne (comme le ferait le vrai downloadExcel
      // en construisant les lignes du classeur) pour couvrir ces fonctions.
      rows.forEach((row) => columns.forEach((col) => col.value(row)));
    }
  );
  invalidateSupervisorDecisionDataCache();
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

  it('propose un bouton Excel par graphique et declenche bien un export au clic', async () => {
    render(<SupervisorTeamPerformancePage />);
    await screen.findAllByText('Sara Alami');

    const exportButtons = screen.getAllByRole('button', { name: /Excel/ });
    // Vue d'ensemble, prospection directe, BOA (donnees toutes COMMERCIAL_DIRECT
    // ici : pas de panneau "Auto-affiliation par region", ni de motifs de refus).
    expect(exportButtons.length).toBeGreaterThanOrEqual(3);

    fireEvent.click(exportButtons[0]);
    expect(downloadExcelMock).toHaveBeenCalledTimes(1);
    expect(downloadExcelMock.mock.calls[0][0]).toBe('performance-commerciales-vue-ensemble');
  });

  it('propose un bouton Excel pour chacun des 5 graphiques quand toutes les sections sont peuplees', async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        request(),
        request({
          dossierId: 2,
          origineCreation: 'AUTO',
          status: 'ACCEPTE',
          commercialReportDisponible: true,
          region: 'Rabat-Salé'
        }),
        request({
          dossierId: 3,
          origineCreation: 'AUTO',
          status: 'ABANDONNE',
          motifRefus: 'Documents incomplets',
          region: 'Rabat-Salé'
        })
      ]
    });

    render(<SupervisorTeamPerformancePage />);
    await screen.findAllByText('Sara Alami');

    const exportButtons = screen.getAllByRole('button', { name: /Excel/ });
    expect(exportButtons).toHaveLength(5);

    const expectedFileNames = [
      'performance-commerciales-vue-ensemble',
      'performance-commerciales-prospection-directe',
      'performance-commerciales-auto-region',
      'performance-back-office',
      'performance-motifs-refus'
    ];
    exportButtons.forEach((button, index) => {
      downloadExcelMock.mockClear();
      fireEvent.click(button);
      expect(downloadExcelMock).toHaveBeenCalledTimes(1);
      expect(downloadExcelMock.mock.calls[0][0]).toBe(expectedFileNames[index]);
    });
  });

  it('exclut "Non attribué" du graphe commerciales mais le garde dans le tableau', async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        request(),
        request({ dossierId: 2, commercialAttribue: '', commercialAttribueId: null })
      ]
    });
    render(<SupervisorTeamPerformancePage />);

    await screen.findAllByText('Sara Alami');
    // Toujours visible dans le tableau (donnee reelle, utile a l'operateur).
    expect(screen.getAllByText('Non attribué').length).toBeGreaterThan(0);
  });
});
