import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CommercantOverviewPage from './CommercantOverviewPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const chartConfigs: any[] = [];

vi.mock('chart.js', () => ({
  Chart: Object.assign(
    vi.fn().mockImplementation(function ChartMock(_canvas: unknown, config: any) {
      chartConfigs.push(config);
      return { destroy: vi.fn() };
    }),
    { register: vi.fn() }
  ),
  registerables: []
}));

beforeEach(() => {
  chartConfigs.length = 0;
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('CommercantOverviewPage', () => {
  it('affiche un etat vide sans transactions/tpes/pdvs', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT' })
    );
    render(<CommercantOverviewPage />);
    expect(screen.getByText('Aucune donnée disponible')).toBeInTheDocument();
  });

  it('affiche les graphiques PDV/TPE pour un profil encaissement avec des donnees', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        typeAffiliation: 'ENCAISSEMENT',
        transactions: [{ id: 1, dateTransaction: '2026-07-01', pdv: 'PDV1', tpe: 'TPE1' } as never],
        tpes: [{ id: 1, numeroSerie: 'TPE1', modele: 'M1', statut: 'ACTIF', typeConnexion: 'GPRS', pdvId: 1, pdv: 'PDV1' } as never],
        pdvs: [{ id: 1, nom: 'PDV1' } as never]
      })
    );
    render(<CommercantOverviewPage />);
    expect(screen.getByText('Par point de vente')).toBeInTheDocument();
    expect(screen.getByText('Transactions par TPE')).toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  it("masque les graphiques PDV/TPE pour un profil e-commerce", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        typeAffiliation: 'E_COMMERCE',
        transactions: [{ id: 1, dateTransaction: '2026-07-01', pdv: '', tpe: '' } as never]
      })
    );
    render(<CommercantOverviewPage />);
    expect(screen.queryByText('Par point de vente')).toBeNull();
    expect(screen.getByText('Transactions par mois')).toBeInTheDocument();
  });

  it('affiche la carte des canaux e-commerce si un site marchand est renseigne', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        typeAffiliation: 'E_COMMERCE',
        profile: { typeAffiliation: 'E_COMMERCE', siteMarchandUrl: 'https://boutique.ma' }
      })
    );
    render(<CommercantOverviewPage />);
    expect(screen.getByText('Vos canaux e-commerce')).toBeInTheDocument();
    expect(screen.getByText('https://boutique.ma')).toBeInTheDocument();
  });

  it('adapte les libelles pour un sous-commercant', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'SOUS_COMMERCANT',
        typeAffiliation: 'ENCAISSEMENT',
        transactions: [{ id: 1, dateTransaction: '2026-07-01', pdv: 'PDV1', tpe: 'TPE1' } as never]
      })
    );
    render(<CommercantOverviewPage />);
    expect(screen.getByText('Transactions de vos TPE affectés')).toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 100));
    const monthlyConfig = chartConfigs.find((c) => c.data.datasets[0].label === 'Transactions');
    expect(monthlyConfig.data.datasets[0].borderColor).toBe('#59bfe0');
  });

  it("n'inclut que les transactions du canal actif (TPE) pour un profil combine dans l'espace Encaissement TPE", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        typeAffiliation: 'ENCAISSEMENT_ET_ECOMMERCE',
        transactions: [
          { id: 1, canal: 'TPE', dateTransaction: '2026-07-01', pdv: 'PDV1', tpe: 'TPE1' } as never,
          { id: 2, canal: 'ECOMMERCE', dateTransaction: '2026-07-02', pdv: '', tpe: 'boutique.ma' } as never
        ],
        tpes: [{ id: 1, numeroSerie: 'TPE1', modele: 'M1', statut: 'ACTIF', typeConnexion: 'GPRS', pdvId: 1, pdv: 'PDV1' } as never],
        pdvs: [{ id: 1, nom: 'PDV1' } as never]
      })
    );
    // activeAffiliationProfile par defaut = 'ENCAISSEMENT' (voir sessionStore.ts) :
    // c'est l'espace "Encaissement TPE" qu'on verifie ici.
    render(<CommercantOverviewPage />);

    await new Promise((resolve) => setTimeout(resolve, 100));
    const monthlyConfig = chartConfigs.find((c) => c.data.datasets[0].label === 'Transactions');
    // Un seul point de donnees doit compter (la transaction TPE) : si la
    // transaction e-commerce est mal incluse, le total sur juillet 2026 vaut 2.
    const julyIndex = monthlyConfig.data.labels.findIndex((l: string) => l.includes('juil'));
    expect(monthlyConfig.data.datasets[0].data[julyIndex]).toBe(1);

    const pdvConfig = chartConfigs.find((c) => c.type === 'doughnut');
    expect(pdvConfig.data.labels).toEqual(['PDV1']);
    expect(pdvConfig.data.labels).not.toContain('Autre');
  });

  it("garde l'accent orange pour un commercant principal (pas sous-commercant)", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        typeAffiliation: 'ENCAISSEMENT',
        transactions: [{ id: 1, dateTransaction: '2026-07-01', pdv: 'PDV1', tpe: 'TPE1' } as never]
      })
    );
    render(<CommercantOverviewPage />);

    await new Promise((resolve) => setTimeout(resolve, 100));
    const monthlyConfig = chartConfigs.find((c) => c.data.datasets[0].label === 'Transactions');
    expect(monthlyConfig.data.datasets[0].borderColor).toBe('#F97316');
  });
});
