import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CommercialDossierCreatePage from './CommercialDossierCreatePage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const createCommercialDraftMock = vi.fn();
const getAffiliationRequestsMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock('../../../supervisor/services/supervisorApi', () => ({
  createCommercialDraft: (...args: unknown[]) => createCommercialDraftMock(...args),
  saveCommercialDraft: vi.fn(),
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args)
}));

vi.mock('../../../../core/api', () => ({
  default: { get: vi.fn(), post: (...args: unknown[]) => apiPostMock(...args) }
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/commercial/dossiers/new']}>
      <Routes>
        <Route path="/commercial/dossiers/new" element={<CommercialDossierCreatePage />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderEditPage(dossierId: number | string) {
  return render(
    <MemoryRouter initialEntries={[`/commercial/dossiers/${dossierId}/continue`]}>
      <Routes>
        <Route path="/commercial/dossiers/:dossierId/continue" element={<CommercialDossierCreatePage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  createCommercialDraftMock.mockReset();
  getAffiliationRequestsMock.mockReset();
  getAffiliationRequestsMock.mockResolvedValue({ requests: [] });
  apiPostMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

function setCommercialSession() {
  useSessionStore.getState().setSession(
    normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
  );
}

function fillRequiredStepDonnees() {
  fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Doe' } });
  fireEvent.change(screen.getByLabelText('Activité'), { target: { value: 'Commerce' } });
  fireEvent.change(screen.getByLabelText('Secteur'), { target: { value: 'Alimentation' } });
}

describe('CommercialDossierCreatePage', () => {
  it("refuse l'acces pour un role non commercial", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    renderPage();
    expect(screen.getByText('Cette création de demande est réservée au poste commercial.')).toBeInTheDocument();
  });

  it("affiche le premier onglet 'Donnees' pour un commercial", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    renderPage();
    expect(screen.getByText('Données')).toBeInTheDocument();
  });

  it('bloque la soumission finale si des champs obligatoires manquent', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    renderPage();

    const submitButtons = screen.getAllByRole('button').filter((btn) => /enregistrer|soumettre|créer/i.test(btn.textContent ?? ''));
    expect(submitButtons.length).toBeGreaterThan(0);
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    expect(screen.getByText('Données')).toBeInTheDocument();
  });

  it('passe a l\'onglet Negociable au clic sur son onglet', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Négociable/ }));

    expect(screen.getByText('Champs négociables')).toBeInTheDocument();
  });

  it('enregistre un brouillon avec des donnees partielles (pas de blocage sur les champs obligatoires)', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    createCommercialDraftMock.mockResolvedValue({ dossierId: 42, message: 'Brouillon enregistré.' });

    renderPage();
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Doe' } });

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer brouillon' }));

    await vi.waitFor(() => expect(createCommercialDraftMock).toHaveBeenCalled());
  });

  it("affiche une indication de champ manquant tant que le dossier n'est pas complet", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    renderPage();

    expect(screen.getByText(/Veuillez remplir/)).toBeInTheDocument();
  });

  it('genere des cartes de point de vente selon le nombre saisi (type TPE)', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    renderPage();

    fireEvent.change(screen.getByLabelText("Type d'affiliation"), { target: { value: 'TPE' } });
    fireEvent.change(screen.getByLabelText('Nombre points de vente'), { target: { value: '2' } });

    expect(screen.getByText('Point de vente 1')).toBeInTheDocument();
    expect(screen.getByText('Point de vente 2')).toBeInTheDocument();
  });

  it("n'affiche pas de champ nombre de points de vente pour une affiliation e-commerce", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    renderPage();

    fireEvent.change(screen.getByLabelText("Type d'affiliation"), { target: { value: 'E_COMMERCE' } });

    expect(screen.getByLabelText('Nombre points de vente')).toBeDisabled();
    expect(screen.getByLabelText('Mode service e-commerce')).toBeInTheDocument();
  });

  it("permet de choisir TPE et e-commerce dans une meme demande", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    renderPage();

    fireEvent.change(screen.getByLabelText("Type d'affiliation"), {
      target: { value: 'ENCAISSEMENT_ET_ECOMMERCE' }
    });

    expect(screen.getByRole('option', { name: 'TPE + E-commerce' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre points de vente')).not.toBeDisabled();
    expect(screen.getByLabelText('Mode de mise à disposition TPE')).toBeInTheDocument();
    expect(screen.getByLabelText('Mode service e-commerce')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Négociable/ }));

    expect(screen.getByLabelText('Commission locale TPE')).toBeInTheDocument();
    expect(screen.getByLabelText('Commission locale e-commerce')).toBeInTheDocument();
  });

  it('affiche la liste des documents requis pour une personne morale', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    renderPage();

    fireEvent.change(screen.getByLabelText('Type commerçant'), { target: { value: 'PERSONNE_MORALE' } });
    fireEvent.click(screen.getByRole('button', { name: /Documents/ }));

    expect(screen.getByText('Statuts')).toBeInTheDocument();
    expect(screen.getByText('RC')).toBeInTheDocument();
    expect(screen.getByText('ICE')).toBeInTheDocument();
  });

  it('affiche la liste des documents requis pour une personne physique', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Documents/ }));

    expect(screen.getByText('CIN')).toBeInTheDocument();
    expect(screen.getAllByText('RIB').length).toBeGreaterThan(0);
  });
});

describe('CommercialDossierCreatePage - mode edition (continuer un brouillon)', () => {
  beforeEach(() => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
  });

  it('charge et pre-remplit le formulaire depuis le brouillon commercial correspondant', async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        {
          dossierId: 123,
          typeCommercant: 'PERSONNE_PHYSIQUE',
          typeAffiliation: 'TPE',
          nom: 'Alaoui',
          prenom: 'Amine',
          email: 'amine.alaoui@example.com',
          telephone: '0600000000',
          adresse: '12 rue des Fleurs',
          ville: 'Casablanca',
          nombrePointsVente: 1,
          origineCreation: 'COMMERCIAL_DIRECT',
          status: 'BROUILLON',
          documents: []
        }
      ]
    });

    renderEditPage(123);

    expect(await screen.findByDisplayValue('Alaoui')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Amine')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('amine.alaoui@example.com').length).toBeGreaterThan(0);
  });

  it("affiche un message si aucun brouillon ne correspond a l'identifiant demande", async () => {
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 999, typeCommercant: 'PERSONNE_PHYSIQUE', typeAffiliation: 'TPE', documents: [] }]
    });

    renderEditPage(123);

    expect(await screen.findByText('Ce brouillon commercial est introuvable.')).toBeInTheDocument();
  });

  it('affiche un message d\'erreur si le chargement du brouillon echoue', async () => {
    getAffiliationRequestsMock.mockRejectedValue({});

    renderEditPage(123);

    expect(await screen.findByText('Impossible de charger le brouillon commercial.')).toBeInTheDocument();
  });

  it("ne charge aucun brouillon pour la route de creation (pas d'identifiant)", () => {
    renderPage();

    expect(getAffiliationRequestsMock).not.toHaveBeenCalled();
  });
});


function docFileInput(label: string): HTMLInputElement {
  const title = screen.getAllByText(label).find((el) => el.className === 'document-title')!;
  return title.closest('label')!.querySelector('input[type="file"]')!;
}

function ribTextInput(): HTMLInputElement {
  const label = screen.getAllByText('RIB').find((el) => el.tagName === 'SPAN' && el.parentElement?.tagName === 'LABEL' && el.parentElement.className.includes('form-group'))!;
  return label.closest('label')!.querySelector('input')! as HTMLInputElement;
}

describe('CommercialDossierCreatePage - documents et extraction RIB', () => {
  it('extrait automatiquement le RIB depuis l\'IBAN quand le document RIB est deposé', async () => {
    setCommercialSession();
    apiPostMock.mockResolvedValue({ data: { ribExtraction: { iban: 'MA64011519000001205000534921' } } });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Documents/ }));

    const ribInput = docFileInput('RIB');
    fireEvent.change(ribInput, { target: { files: [new File(['x'], 'rib.png', { type: 'image/png' })] } });

    expect(await screen.findByText('RIB extrait automatiquement.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('MA64011519000001205000534921')).toBeInTheDocument();
  });

  it('remplace le RIB deja saisi par le RIB extrait du nouveau document depose (le champ est reinitialise a chaque depot)', async () => {
    setCommercialSession();
    apiPostMock.mockResolvedValue({ data: { ribExtraction: { rib: '011519000001205000534921' } } });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Documents/ }));
    fireEvent.change(ribTextInput(), { target: { value: '999999999999999999999999' } });

    const ribInput = docFileInput('RIB');
    fireEvent.change(ribInput, { target: { files: [new File(['x'], 'rib.png', { type: 'image/png' })] } });

    expect(await screen.findByText('RIB extrait automatiquement.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('011519000001205000534921')).toBeInTheDocument();
  });

  it("indique que le RIB n'a pas ete extrait quand l'API ne retourne aucune donnee exploitable", async () => {
    setCommercialSession();
    apiPostMock.mockResolvedValue({ data: {} });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Documents/ }));

    const ribInput = docFileInput('RIB');
    fireEvent.change(ribInput, { target: { files: [new File(['x'], 'rib.png', { type: 'image/png' })] } });

    expect(await screen.findByText('Document importé. RIB non extrait automatiquement.')).toBeInTheDocument();
  });

  it("affiche un message si l'extraction RIB echoue (API indisponible)", async () => {
    setCommercialSession();
    apiPostMock.mockRejectedValue(new Error('503'));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Documents/ }));

    const ribInput = docFileInput('RIB');
    fireEvent.change(ribInput, { target: { files: [new File(['x'], 'rib.png', { type: 'image/png' })] } });

    expect(await screen.findByText('Document importé. Extraction RIB indisponible.')).toBeInTheDocument();
  });

  it("importe un document non-RIB sans appeler l'API de validation", async () => {
    setCommercialSession();

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Documents/ }));

    const cinInput = docFileInput('CIN');
    fireEvent.change(cinInput, { target: { files: [new File(['x'], 'cin.pdf', { type: 'application/pdf' })] } });

    expect(await screen.findByText('Document importé sans vérification automatique.')).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it('retire un document deja importe quand la selection de fichier est annulee', async () => {
    setCommercialSession();

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Documents/ }));

    const cinInput = docFileInput('CIN');
    fireEvent.change(cinInput, { target: { files: [new File(['x'], 'cin.pdf', { type: 'application/pdf' })] } });
    await screen.findByText('cin.pdf');

    fireEvent.change(cinInput, { target: { files: [] } });

    expect(screen.queryByText('cin.pdf')).toBeNull();
    expect(screen.getAllByText('Aucun fichier').length).toBeGreaterThan(0);
  });

  it('rejette un fichier qui depasse la taille totale autorisee', async () => {
    setCommercialSession();

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Documents/ }));

    const oversized = new File([new Uint8Array(11 * 1024 * 1024)], 'gros.pdf', { type: 'application/pdf' });
    const cinInput = docFileInput('CIN');
    fireEvent.change(cinInput, { target: { files: [oversized] } });

    expect(await screen.findByText(/dépasse/)).toBeInTheDocument();
    expect(screen.queryByText('gros.pdf')).toBeNull();
  });
});
