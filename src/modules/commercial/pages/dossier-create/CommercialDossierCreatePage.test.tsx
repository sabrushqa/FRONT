import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CommercialDossierCreatePage from './CommercialDossierCreatePage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const createCommercialDraftMock = vi.fn();

vi.mock('../../../supervisor/services/supervisorApi', () => ({
  createCommercialDraft: (...args: unknown[]) => createCommercialDraftMock(...args),
  saveCommercialDraft: vi.fn(),
  getAffiliationRequests: vi.fn().mockResolvedValue({ requests: [] })
}));

vi.mock('../../../../core/api', () => ({
  default: { get: vi.fn(), post: vi.fn() }
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

beforeEach(() => {
  createCommercialDraftMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

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
