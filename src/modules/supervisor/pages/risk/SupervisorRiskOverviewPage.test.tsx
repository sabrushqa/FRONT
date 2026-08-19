import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SupervisorRiskOverviewPage from './SupervisorRiskOverviewPage';

const getRiskOverviewMock = vi.fn();
const downloadExcelMock = vi.fn();

vi.mock('../../services/supervisorApi', () => ({
  getRiskOverview: (...args: unknown[]) => getRiskOverviewMock(...args)
}));

vi.mock('../../../../core/excelExport', () => ({
  downloadExcel: (...args: unknown[]) => downloadExcelMock(...args)
}));

function fullResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    commercantsAnalyses: 42,
    commercantsIgnores: 3,
    scoreMoyen: 27,
    nombreRisqueEleve: 5,
    nombreRisqueMoyen: 8,
    nombreRisqueFaible: 29,
    donneesTransactionnellesIndisponibles: false,
    commercants: [
      {
        commercantId: 1,
        nom: 'Boulangerie Al Amal',
        secteur: 'Alimentation',
        region: 'Casablanca-Settat',
        typeAffiliation: 'TPE',
        scoreRisque: 78,
        niveauRisque: 'ELEVE',
        raisons: ['Chiffre d\'affaires en baisse', 'Taux de refus élevé'],
        actionRecommandee: 'Planifier une relance'
      },
      {
        commercantId: 2,
        nom: 'Pharmacie Centrale',
        secteur: 'Santé',
        region: 'Rabat-Salé',
        typeAffiliation: 'E_COMMERCE',
        scoreRisque: 55,
        niveauRisque: 'MOYEN',
        raisons: [],
        actionRecommandee: 'Surveiller'
      },
      {
        commercantId: 3,
        nom: 'Épicerie du coin',
        secteur: 'Alimentation',
        region: 'Casablanca-Settat',
        typeAffiliation: 'TPE',
        scoreRisque: 10,
        niveauRisque: 'FAIBLE',
        raisons: [],
        actionRecommandee: 'Aucune action'
      }
    ],
    secteursRisque: [
      { secteur: 'Alimentation', nombreCommercants: 12, scoreMoyen: 30, nombreRisqueEleve: 2 },
      { secteur: 'Santé', nombreCommercants: 6, scoreMoyen: 20, nombreRisqueEleve: 0 }
    ],
    canalPerformance: [
      { secteur: 'Alimentation', canal: 'TPE', nombreTransactions: 500, tauxRefus: 5 },
      { secteur: 'Alimentation', canal: 'ECOMMERCE', nombreTransactions: 80, tauxRefus: 25 }
    ],
    usageTpeParSecteur: [
      { secteur: 'Alimentation', nombreTpeActifs: 20, transactionsTpe: 4000, transactionsParTpe: 200 },
      { secteur: 'Santé', nombreTpeActifs: 5, transactionsTpe: 50, transactionsParTpe: 10 }
    ],
    ...overrides
  };
}

beforeEach(() => {
  getRiskOverviewMock.mockReset();
  downloadExcelMock.mockReset().mockResolvedValue(undefined);
});

describe('SupervisorRiskOverviewPage', () => {
  it('affiche le spinner de chargement puis les KPI une fois les donnees recues', async () => {
    let resolvePromise: (value: unknown) => void = () => {};
    getRiskOverviewMock.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve; }));

    render(<SupervisorRiskOverviewPage />);
    expect(screen.getByText('Calcul des scores de risque en cours...')).toBeInTheDocument();

    resolvePromise(fullResponse());
    expect(await screen.findByText('Commerçants analysés')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it("affiche un message d'erreur si le chargement echoue", async () => {
    getRiskOverviewMock.mockRejectedValue(new Error('503'));
    render(<SupervisorRiskOverviewPage />);
    expect(await screen.findByText(/Impossible de charger l'analyse de risque/)).toBeInTheDocument();
  });

  it('avertit quand les donnees transactionnelles etaient indisponibles pendant le calcul', async () => {
    getRiskOverviewMock.mockResolvedValue(fullResponse({ donneesTransactionnellesIndisponibles: true }));
    render(<SupervisorRiskOverviewPage />);
    expect(await screen.findByText(/switch-monetique-service était injoignable/)).toBeInTheDocument();
  });

  it('affiche le nombre de commercants ignores quand il y en a', async () => {
    getRiskOverviewMock.mockResolvedValue(fullResponse({ commercantsIgnores: 3 }));
    render(<SupervisorRiskOverviewPage />);
    expect(await screen.findByText(/3 commerçants sans historique/)).toBeInTheDocument();
  });

  it('liste les commercants a risque moyen ou eleve dans le tableau de priorite, exclut les FAIBLE', async () => {
    getRiskOverviewMock.mockResolvedValue(fullResponse());
    render(<SupervisorRiskOverviewPage />);

    expect(await screen.findByText('Boulangerie Al Amal')).toBeInTheDocument();
    expect(screen.getByText('Pharmacie Centrale')).toBeInTheDocument();
    expect(screen.queryByText('Épicerie du coin')).toBeNull();
    expect(screen.getByText('2 sur 3')).toBeInTheDocument();
  });

  it('affiche les raisons du commercant a risque, ou "—" si aucune', async () => {
    getRiskOverviewMock.mockResolvedValue(fullResponse());
    render(<SupervisorRiskOverviewPage />);

    await screen.findByText('Boulangerie Al Amal');
    expect(screen.getByText('Chiffre d\'affaires en baisse')).toBeInTheDocument();
    expect(screen.getByText('Taux de refus élevé')).toBeInTheDocument();
  });

  it('affiche un etat vide quand aucun commercant n\'est en risque moyen/eleve', async () => {
    getRiskOverviewMock.mockResolvedValue(fullResponse({
      commercants: [
        { commercantId: 9, nom: 'Sans risque', secteur: 'X', region: 'Y', typeAffiliation: 'TPE', scoreRisque: 5, niveauRisque: 'FAIBLE', raisons: [], actionRecommandee: '' }
      ]
    }));
    render(<SupervisorRiskOverviewPage />);
    expect(await screen.findByText(/Aucun commerçant en risque moyen ou élevé/)).toBeInTheDocument();
  });

  it('affiche la comparaison TPE vs e-commerce par secteur, avec le nombre de secteurs comparables', async () => {
    getRiskOverviewMock.mockResolvedValue(fullResponse());
    render(<SupervisorRiskOverviewPage />);

    await screen.findByText('Performance par secteur : TPE vs e-commerce');
    expect(screen.getByText(/1 secteur avec/)).toBeInTheDocument();
    expect(screen.getByText(/95% approuvé/)).toBeInTheDocument();
    expect(screen.getByText(/75% approuvé/)).toBeInTheDocument();
  });

  it("affiche 'Pas de données' pour un canal absent d'un secteur", async () => {
    getRiskOverviewMock.mockResolvedValue(fullResponse({
      canalPerformance: [{ secteur: 'Alimentation', canal: 'TPE', nombreTransactions: 500, tauxRefus: 5 }]
    }));
    render(<SupervisorRiskOverviewPage />);

    await screen.findByText('Performance par secteur : TPE vs e-commerce');
    expect(screen.getByText('Pas de données')).toBeInTheDocument();
  });

  it('affiche les etats vides quand secteursRisque/canalPerformance/usageTpeParSecteur sont vides', async () => {
    getRiskOverviewMock.mockResolvedValue(fullResponse({
      secteursRisque: [],
      canalPerformance: [],
      usageTpeParSecteur: []
    }));
    render(<SupervisorRiskOverviewPage />);

    expect(await screen.findByText('Pas assez de données pour classer les secteurs.')).toBeInTheDocument();
    expect(screen.getByText(/Pas assez de transactions par canal/)).toBeInTheDocument();
    expect(screen.getByText('Aucun TPE actif avec historique exploitable pour le moment.')).toBeInTheDocument();
  });

  it('recharge les donnees au clic sur "Actualiser"', async () => {
    getRiskOverviewMock.mockResolvedValue(fullResponse());
    render(<SupervisorRiskOverviewPage />);

    await screen.findByText('Commerçants analysés');
    getRiskOverviewMock.mockClear();
    getRiskOverviewMock.mockResolvedValue(fullResponse({ commercantsAnalyses: 99 }));

    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));

    await waitFor(() => expect(getRiskOverviewMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('99')).toBeInTheDocument();
  });

  it("exporte les commercants analyses en Excel au clic sur \"Exporter en Excel\"", async () => {
    getRiskOverviewMock.mockResolvedValue(fullResponse());
    render(<SupervisorRiskOverviewPage />);

    const button = await screen.findByRole('button', { name: 'Exporter en Excel' });
    fireEvent.click(button);

    await waitFor(() => expect(downloadExcelMock).toHaveBeenCalledTimes(1));
    expect(downloadExcelMock.mock.calls[0][0]).toBe('risque-abandon-commercants');
    expect(downloadExcelMock.mock.calls[0][3]).toHaveLength(3);
  });

  it("le bouton d'export est desactive tant que les donnees ne sont pas chargees", async () => {
    let resolvePromise: (value: unknown) => void = () => {};
    getRiskOverviewMock.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve; }));

    render(<SupervisorRiskOverviewPage />);
    expect(screen.getByRole('button', { name: 'Exporter en Excel' })).toBeDisabled();

    resolvePromise(fullResponse());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exporter en Excel' })).toBeEnabled());
  });
});
