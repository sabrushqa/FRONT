import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommercialOverviewPage from './CommercialOverviewPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const chartConstructorMock = vi.fn();
vi.mock('chart.js/auto', () => ({
  default: vi.fn().mockImplementation(function ChartMock(_ctx: unknown, config: unknown) {
    chartConstructorMock(config);
    return { destroy: vi.fn() };
  })
}));

const getOverviewMock = vi.fn();
const getAffiliationRequestsMock = vi.fn();

vi.mock('../../../supervisor/services/supervisorApi', () => ({
  getOverview: (...args: unknown[]) => getOverviewMock(...args),
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args)
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <CommercialOverviewPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  getOverviewMock.mockReset().mockResolvedValue({ backOffices: [], commerciales: [], commercants: [] });
  getAffiliationRequestsMock.mockReset().mockResolvedValue({ requests: [] });
  chartConstructorMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('CommercialOverviewPage - role superviseur', () => {
  it('affiche les tuiles de pilotage staff pour un superviseur', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getOverviewMock.mockResolvedValue({
      backOffices: [{ id: 1 }],
      commerciales: [{ id: 1 }, { id: 2 }],
      commercants: []
    });

    renderPage();

    expect(await screen.findByText('Back office')).toBeInTheDocument();
    expect(screen.getByText('Commerciales')).toBeInTheDocument();
  });

  it("n'appelle pas getOverview pour un role commercial (pas de gestion staff)", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL', profile: { region: '' } })
    );

    renderPage();

    await waitFor(() => expect(getAffiliationRequestsMock).toHaveBeenCalled());
    expect(getOverviewMock).not.toHaveBeenCalled();
  });

  it("ne filtre pas les dossiers auto par region pour un back office (uniquement pour le commercial)", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { status: 'ACCEPTE', region: 'Casablanca' },
        { status: 'ACCEPTE', region: 'Rabat' }
      ]
    });

    renderPage();

    expect(await screen.findByText('Affiliations validées')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('2').length).toBeGreaterThan(0));
  });

  it("affiche un message d'erreur si le chargement echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getOverviewMock.mockRejectedValue(new Error('503'));

    renderPage();

    expect(await screen.findByText('Les indicateurs de la page overview sont indisponibles.')).toBeInTheDocument();
  });
});

describe('CommercialOverviewPage - role commercial (graphes dashboard)', () => {
  it('affiche les 4 graphes du dashboard commercial sans erreur', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL',
        nom: 'Amine Alaoui', email: 'amine@lc.ma', profile: { region: 'Casablanca-Settat' }
      })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        // Prospection directe possedee par la commerciale connectee : validee TPE.
        {
          dossierId: 1, origineCreation: 'COMMERCIAL_DIRECT', status: 'ACCEPTE',
          typeAffiliation: 'TPE', commercialAttribue: 'Amine Alaoui', dateSoumission: new Date().toISOString()
        },
        // Prospection directe en negociation, meme commerciale.
        {
          dossierId: 2, origineCreation: 'COMMERCIAL_DIRECT', status: 'SOUMIS', prospectStatus: 'EN_NEGOCIATION',
          typeAffiliation: 'E_COMMERCE', commercialAttribue: 'Amine Alaoui', dateSoumission: new Date().toISOString()
        },
        // Auto-affiliation assignee a la commerciale : a corriger.
        {
          dossierId: 3, origineCreation: 'AUTO_AFFILIATION', status: 'INCOMPLET',
          typeAffiliation: 'TPE', commercialAttribue: 'Amine Alaoui', region: 'Casablanca-Settat',
          dateSoumission: new Date().toISOString()
        }
      ]
    });

    renderPage();

    expect(await screen.findByText('Prospections converties')).toBeInTheDocument();
    expect(screen.getByText('Prospection directe par semaine')).toBeInTheDocument();
    expect(screen.getByText('Auto-affiliation par semaine')).toBeInTheDocument();
    expect(screen.getByText('Auto-affiliation convertie par mois')).toBeInTheDocument();
  });

  it('calcule et affiche les quatre indicateurs prioritaires en haut du dashboard', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL',
        nom: 'Amine Alaoui', email: 'amine@lc.ma', profile: { region: 'Casablanca-Settat' }
      })
    );
    const today = new Date();
    const dossierCreatedAt = new Date(today);
    dossierCreatedAt.setDate(dossierCreatedAt.getDate() - 3);
    const createdAt = new Date(today);
    createdAt.setDate(createdAt.getDate() - 2);
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        {
          dossierId: 1, origineCreation: 'COMMERCIAL_DIRECT', status: 'ACCEPTE',
          commercialAttribue: 'Amine Alaoui', dateCreation: dossierCreatedAt.toISOString(),
          dateSoumission: createdAt.toISOString(),
          dateTraitementBackOffice: today.toISOString()
        },
        {
          dossierId: 2, origineCreation: 'COMMERCIAL_DIRECT', status: 'SOUMIS',
          commercialAttribue: 'Amine Alaoui', dateSoumission: today.toISOString()
        }
      ]
    });

    renderPage();

    expect(await screen.findByText('Taux de conversion des prospections')).toBeInTheDocument();
    expect(screen.getByText('50 %')).toBeInTheDocument();
    expect(screen.getByText('Commerçants affiliés ce mois')).toBeInTheDocument();
    expect(screen.getByText('Dossiers en attente')).toBeInTheDocument();
    expect(screen.getByText('3 j')).toBeInTheDocument();
  });

  it('le filtre annee est dynamique : changer l\'annee recalcule le graphe auto-affiliation convertie', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL',
        nom: 'Amine Alaoui', email: 'amine@lc.ma', profile: { region: 'Casablanca-Settat' }
      })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        // Auto-affiliation convertie en 2024, assignee a la commerciale connectee.
        {
          dossierId: 1, origineCreation: 'AUTO_AFFILIATION', status: 'ACCEPTE',
          typeAffiliation: 'TPE', commercialAttribue: 'Amine Alaoui', region: 'Casablanca-Settat',
          dateSoumission: '2024-03-15'
        }
      ]
    });

    renderPage();
    await screen.findByText('Auto-affiliation convertie par mois');

    const yearSelect = screen.getByLabelText('Année') as HTMLSelectElement;
    expect(yearSelect.value).toBe(String(new Date().getFullYear()));
    // La liste couvre l'annee courante +/- 2, meme sans dossier sur ces annees-la
    // (permet de consulter l'historique proche ou de preparer une annee a venir).
    const currentYear = new Date().getFullYear();
    const optionValues = Array.from(yearSelect.options).map((o) => o.value);
    [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2].forEach((year) => {
      expect(optionValues).toContain(String(year));
    });

    const callsBefore = chartConstructorMock.mock.calls.length;
    fireEvent.change(yearSelect, { target: { value: '2024' } });

    await waitFor(() => expect(chartConstructorMock.mock.calls.length).toBeGreaterThan(callsBefore));
    // Le graphe "converti par mois" est le dernier construit ; en 2024 il doit
    // desormais compter le dossier TPE converti en mars.
    const lastCallConfig = chartConstructorMock.mock.calls[chartConstructorMock.mock.calls.length - 1][0] as {
      data: { labels: string[]; datasets: { label: string; data: number[] }[] };
    };
    expect(lastCallConfig.data.labels).toHaveLength(12);
    const tpeDataset = lastCallConfig.data.datasets.find((d) => d.label === 'TPE');
    expect(tpeDataset?.data.some((v) => v > 0)).toBe(true);
  });
});
