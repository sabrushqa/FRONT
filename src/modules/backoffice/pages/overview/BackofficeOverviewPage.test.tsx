import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BackofficeOverviewPage from './BackofficeOverviewPage';
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

function sumDataset(config: any, datasetLabel: string): number {
  const dataset = config.data.datasets.find((d: any) => d.label === datasetLabel);
  return dataset ? dataset.data.reduce((a: number, b: number) => a + b, 0) : 0;
}

const getAffiliationRequestsMock = vi.fn();
const getReclamationsMock = vi.fn();

vi.mock('../../../supervisor/services/supervisorApi', () => ({
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args)
}));

vi.mock('../../services/reclamationsApi', () => ({
  getReclamations: (...args: unknown[]) => getReclamationsMock(...args)
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <BackofficeOverviewPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  chartConfigs.length = 0;
  getAffiliationRequestsMock.mockReset().mockResolvedValue({ requests: [] });
  getReclamationsMock.mockReset().mockResolvedValue([]);
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('BackofficeOverviewPage', () => {
  it('affiche uniquement les 4 graphes de pilotage (aucune autre carte)', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, status: 'EN_ATTENTE_VALIDATION_BOA', typeAffiliation: 'TPE', dateSoumission: new Date().toISOString() }
      ]
    });
    getReclamationsMock.mockResolvedValue([
      { idReclamation: 1, typeProbleme: 'MATERIEL', statut: 'RESOLU', dateCreation: new Date().toISOString(), dateResolution: new Date().toISOString() }
    ]);

    renderPage();

    expect(await screen.findByText('Mes demandes à traiter par semaine')).toBeInTheDocument();
    expect(screen.getByText('Mes réclamations reçues par semaine')).toBeInTheDocument();
    expect(screen.getByText('Mes demandes déjà validées')).toBeInTheDocument();
    expect(screen.getByText('Mes réclamations traitées par semaine')).toBeInTheDocument();

    // Les anciennes cartes (donuts, alertes, graphe par jour) ont ete retirees.
    expect(screen.queryByText('Auto-Affiliation')).toBeNull();
    expect(screen.queryByText('Prospection')).toBeNull();
    expect(screen.queryByText('Volume par jour et par état')).toBeNull();
  });

  it("ne charge pas les dossiers si peutValiderDossiers est false, mais garde les graphes reclamations", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE', peutValiderDossiers: false })
    );

    renderPage();

    expect(await screen.findByText('Mes réclamations reçues par semaine')).toBeInTheDocument();
    expect(getAffiliationRequestsMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Mes demandes à traiter par semaine')).toBeNull();
    expect(screen.queryByText('Mes demandes déjà validées')).toBeNull();
  });

  it("ne charge pas les reclamations si peutGererReclamations est false, mais garde les graphes dossiers", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE', peutGererReclamations: false })
    );

    renderPage();

    expect(await screen.findByText('Mes demandes à traiter par semaine')).toBeInTheDocument();
    expect(getReclamationsMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Mes réclamations reçues par semaine')).toBeNull();
    expect(screen.queryByText('Mes réclamations traitées par semaine')).toBeNull();
  });

  it('propose 2026/2027/2028 dans le filtre annee et navigue via le bouton Explorer', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );

    render(
      <MemoryRouter initialEntries={['/backoffice/overview']}>
        <Routes>
          <Route path="/backoffice/overview" element={<BackofficeOverviewPage />} />
          <Route path="/backoffice/dossiers" element={<div>Page dossiers</div>} />
        </Routes>
      </MemoryRouter>
    );

    const yearSelect = await screen.findByLabelText('Année') as HTMLSelectElement;
    const optionValues = Array.from(yearSelect.options).map((o) => o.value);
    ['2026', '2027', '2028'].forEach((year) => expect(optionValues).toContain(year));

    const exploreButtons = screen.getAllByRole('button', { name: 'Explorer' });
    fireEvent.click(exploreButtons[0]);

    expect(await screen.findByText('Page dossiers')).toBeInTheDocument();
  });

  it("affiche un message d'erreur si le chargement des dossiers echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockRejectedValue(new Error('503'));

    renderPage();

    expect(await screen.findByText(/impossible de charger les indicateurs/i)).toBeInTheDocument();
  });

  it("compte les dossiers en attente de validation dans 'a traiter' meme sans back-office assigne (file commune)", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    const today = new Date().toISOString();
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        // Dossier fraichement soumis : pas encore de back-office assigne
        // (backOffice remis a null par le backend a chaque soumission), mais
        // doit tout de meme apparaitre dans "mes demandes a traiter".
        { dossierId: 1, status: 'EN_ATTENTE_VALIDATION_BOA', typeAffiliation: 'TPE', dateSoumission: today, backOfficeUtilisateurId: null, backOfficeTraitant: null }
      ]
    });

    renderPage();
    await screen.findByText('Mes demandes à traiter par semaine');

    const weeklyRequestsConfig = chartConfigs[0];
    expect(sumDataset(weeklyRequestsConfig, 'TPE')).toBe(1);
  });

  it("compte les reclamations non resolues dans 'reçues' meme sans back-office assigne, mais exclut celles resolues par un autre BOA", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    const today = new Date().toISOString();
    getReclamationsMock.mockResolvedValue([
      // Reclamation fraichement recue, pas encore prise en charge : doit
      // apparaitre (file commune, visible par tous les BOA).
      { idReclamation: 1, typeProbleme: 'MATERIEL', statut: 'EN_ATTENTE', dateCreation: today, backOfficeUtilisateurId: null, backOfficeTraitant: null },
      // Reclamation deja resolue par un AUTRE back-office : ne doit pas
      // apparaitre dans "mes reclamations reçues".
      { idReclamation: 2, typeProbleme: 'MATERIEL', statut: 'RESOLU', dateCreation: today, dateResolution: today, backOfficeUtilisateurId: 999, backOfficeTraitant: 'autre.boa@lanacash.com' }
    ]);

    renderPage();
    await screen.findByText('Mes réclamations reçues par semaine');

    const weeklyReclamationsConfig = chartConfigs[1];
    expect(sumDataset(weeklyReclamationsConfig, 'Matériel')).toBe(1);
  });

  it("affiche l'alerte pour un dossier ACCEPTE, non e-commerce, sans TPE affecte", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, status: 'ACCEPTE', typeAffiliation: 'TPE', tpeDejaAffecte: false, dateSoumission: new Date().toISOString() }
      ]
    });

    renderPage();

    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(screen.getByText(/dossier a une affectation en attente/i)).toBeInTheDocument();
  });

  it("affiche l'alerte pour un dossier E_COMMERCE ACCEPTE dont le site n'est pas encore affecte", async () => {
    // Depuis assignEcommerceSiteToCommercant, un dossier E_COMMERCE a lui
    // aussi besoin d'une affectation manuelle par le BOA — il ne doit plus
    // etre exclu de ce compteur (needsManualAssignment).
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        {
          dossierId: 1, status: 'ACCEPTE', typeAffiliation: 'E_COMMERCE',
          ecommerceSiteDejaAffecte: false, dateSoumission: new Date().toISOString()
        }
      ]
    });

    renderPage();

    expect(await screen.findByText('1')).toBeInTheDocument();
  });

  it("n'affiche pas l'alerte quand tout est deja affecte, ou le contrat pas encore signe/depose", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    const today = new Date().toISOString();
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, status: 'ACCEPTE', typeAffiliation: 'E_COMMERCE', ecommerceSiteDejaAffecte: true, dateSoumission: today },
        { dossierId: 2, status: 'ACCEPTE', typeAffiliation: 'TPE', tpeDejaAffecte: true, dateSoumission: today },
        { dossierId: 3, status: 'SOUMIS', typeAffiliation: 'TPE', tpeDejaAffecte: false, dateSoumission: today },
        // CONTRAT_A_SIGNER = contrat genere/envoye, PAS encore signe/depose —
        // ne doit pas declencher l'alerte (voir CommercialDossierDetailPage::
        // canAssignTpe, meme regle stricte sur ACCEPTE).
        { dossierId: 4, status: 'CONTRAT_A_SIGNER', typeAffiliation: 'TPE', tpeDejaAffecte: false, dateSoumission: today }
      ]
    });

    renderPage();
    await screen.findByText('Mes demandes à traiter par semaine');

    expect(screen.queryByText(/affectation en attente/i)).toBeNull();
  });

  it("navigue vers /backoffice/tpe-a-affecter au clic sur l'alerte", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, status: 'ACCEPTE', typeAffiliation: 'SOFTPOS', tpeDejaAffecte: false, dateSoumission: new Date().toISOString() }
      ]
    });

    render(
      <MemoryRouter initialEntries={['/backoffice/overview']}>
        <Routes>
          <Route path="/backoffice/overview" element={<BackofficeOverviewPage />} />
          <Route path="/backoffice/tpe-a-affecter" element={<div>Page TPE à affecter</div>} />
        </Routes>
      </MemoryRouter>
    );

    const alert = await screen.findByText(/dossier a une affectation en attente/i);
    fireEvent.click(alert);

    expect(await screen.findByText('Page TPE à affecter')).toBeInTheDocument();
  });
});
