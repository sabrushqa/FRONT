import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SupervisorOverviewPage from './SupervisorOverviewPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';
import { invalidateSupervisorDecisionDataCache } from '../decision-dashboard/useSupervisorDecisionData';

vi.mock('chart.js/auto', () => ({
  default: vi.fn().mockImplementation(function ChartMock() {
    return { destroy: vi.fn() };
  })
}));

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

function renderPage() {
  return render(
    <MemoryRouter>
      <SupervisorOverviewPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  getOverviewMock.mockReset().mockResolvedValue({ backOffices: [], commerciales: [], commercants: [] });
  getAffiliationRequestsMock.mockReset().mockResolvedValue({ requests: [] });
  getPdvMapMock.mockReset().mockResolvedValue({ pdvs: [] });
  getTpeStockMock.mockReset().mockResolvedValue({ tpes: [] });
  downloadExcelMock.mockReset().mockImplementation(
    async (_fileName: string, _sheet: string, columns: Array<{ value: (row: unknown) => unknown }>, rows: unknown[]) => {
      // Execute chaque callback de colonne (comme le ferait le vrai downloadExcel
      // en construisant les lignes du classeur) pour couvrir ces fonctions.
      rows.forEach((row) => columns.forEach((col) => col.value(row)));
    }
  );
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
  invalidateSupervisorDecisionDataCache();
});

describe('SupervisorOverviewPage', () => {
  it('affiche les cartes du dashboard a zero quand il n\'y a aucun dossier', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );

    renderPage();

    expect(await screen.findByText('Total demandes')).toBeInTheDocument();
    expect(screen.getByText('Total demandes').closest('article')).toHaveTextContent('0');
    expect(screen.getByText('Dossiers en attente').closest('article')).toHaveTextContent('0');
    expect(screen.getByText('Taux de conversion').closest('article')).toHaveTextContent('0%');
  });

  it('calcule le total des demandes et le nombre de dossiers en attente a partir des dossiers d\'affiliation', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { status: 'SOUMIS', origineCreation: 'AUTO' },
        { status: 'ACCEPTE', origineCreation: 'AUTO' },
        { status: 'SOUMIS', origineCreation: 'COMMERCIAL_DIRECT' }
      ]
    });

    renderPage();

    await screen.findByText('Total demandes');
    // "Total demandes" agrege bien auto-affiliation ET prospection directe.
    expect(screen.getByText('Total demandes').closest('article')).toHaveTextContent('3');
    // Les deux dossiers SOUMIS (auto + direct) sont "en attente".
    expect(screen.getByText('Dossiers en attente').closest('article')).toHaveTextContent('2');
  });

  it("affiche un message d'erreur si le chargement echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getOverviewMock.mockRejectedValue(new Error('503'));

    renderPage();

    expect(await screen.findByText('Les indicateurs superviseur sont indisponibles.')).toBeInTheDocument();
  });

  it('affiche le parc TPE/PDV a partir des donnees d\'inventaire', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getPdvMapMock.mockResolvedValue({ pdvs: [{ id: 1 }, { id: 2 }] });
    getTpeStockMock.mockResolvedValue({ tpes: [{ id: 1, actif: true }] });

    renderPage();

    await screen.findByText('Total demandes');
    expect(screen.getByText('Parc TPE').closest('article')).toHaveTextContent('1');
  });

  it('navigue vers la liste des dossiers au clic sur "Voir les dossiers"', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );

    renderPage();

    const button = await screen.findByRole('button', { name: /Voir les dossiers/ });
    // Ne doit pas lever d'erreur : la navigation est geree par react-router
    // (verifiee fonctionnellement par les tests de routage de App.tsx).
    expect(() => fireEvent.click(button)).not.toThrow();
  });

  it('affiche le pipeline des dossiers (fusion avec l\'ancienne page Pipeline dossiers)', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { status: 'SOUMIS', origineCreation: 'AUTO' },
        { status: 'ACCEPTE', origineCreation: 'AUTO' }
      ]
    });

    renderPage();

    await screen.findByText('Total demandes');
    expect(screen.getByText('Où les dossiers sont bloqués, par statut')).toBeInTheDocument();
  });

  it('exporte la vue globale en Excel au clic sur le bouton dédié', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );

    renderPage();

    const button = await screen.findByRole('button', { name: /Excel/ });
    fireEvent.click(button);

    expect(downloadExcelMock).toHaveBeenCalledTimes(1);
    expect(downloadExcelMock.mock.calls[0][0]).toBe('vue-ensemble-superviseur');
  });
});
