import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SupervisorActivityConversionPage from './SupervisorActivityConversionPage';
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
    origineCreation: 'AUTO_AFFILIATION',
    typeAffiliation: 'TPE',
    typeCommercant: 'PERSONNE_PHYSIQUE',
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

describe('SupervisorActivityConversionPage', () => {
  it('affiche les 3 sections fusionnees : conversion, volume du mois et segmentation', async () => {
    render(<SupervisorActivityConversionPage />);

    expect(await screen.findByText('Auto-affiliation vs prospection directe')).toBeInTheDocument();
    expect(screen.getByText('Demandes reçues ce mois-ci')).toBeInTheDocument();
    expect(screen.getByText('Type d’affiliation et nature de personne')).toBeInTheDocument();
  });

  it("affiche un message d'erreur si le chargement echoue", async () => {
    getAffiliationRequestsMock.mockRejectedValue(new Error('503'));
    render(<SupervisorActivityConversionPage />);
    expect(await screen.findByText('Les indicateurs superviseur sont indisponibles.')).toBeInTheDocument();
  });

  it('affiche les graphes de prospection directe du mois (statut et region) quand des prospections existent', async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        request(),
        request({
          dossierId: 2,
          origineCreation: 'COMMERCIAL_DIRECT',
          status: 'SOUMIS',
          prospectStatus: 'CONTACTE',
          region: 'Casablanca-Settat',
          dateSoumission: new Date().toISOString()
        })
      ]
    });

    render(<SupervisorActivityConversionPage />);

    expect(await screen.findByText('Nombre de prospections par statut')).toBeInTheDocument();
    expect(screen.getByText('Nombre de prospections par région')).toBeInTheDocument();

    screen.getAllByRole('button', { name: /Excel/ }).forEach((button) => fireEvent.click(button));
    expect(downloadExcelMock).toHaveBeenCalled();
  });

  it('propose un bouton Excel sur chacun des 6 graphiques et declenche bien un export au clic pour chacun', async () => {
    render(<SupervisorActivityConversionPage />);
    await screen.findByText('Auto-affiliation vs prospection directe');

    const exportButtons = screen.getAllByRole('button', { name: /Excel/ });
    expect(exportButtons).toHaveLength(6);

    const expectedFileNames = [
      'activite-conversion-par-origine',
      'activite-conversion-auto-affiliation-mensuel',
      'activite-conversion-prospection-statut',
      'activite-conversion-prospection-region',
      'activite-conversion-segmentation-type-affiliation',
      'activite-conversion-segmentation-nature-commercant'
    ];
    exportButtons.forEach((button, index) => {
      downloadExcelMock.mockClear();
      fireEvent.click(button);
      expect(downloadExcelMock).toHaveBeenCalledTimes(1);
      expect(downloadExcelMock.mock.calls[0][0]).toBe(expectedFileNames[index]);
    });
  });
});
