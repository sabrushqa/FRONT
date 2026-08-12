import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import CommercialDirectRequestsPage from './CommercialDirectRequestsPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

function ContinuePagePlaceholder() {
  const location = useLocation();
  return <div>Page continue{location.search}</div>;
}

const getAffiliationRequestsMock = vi.fn();
const getCommercialInteractionsMock = vi.fn();
const addCommercialInteractionMock = vi.fn();

vi.mock('../../../supervisor/services/supervisorApi', () => ({
  getAffiliationRequests: (...args: unknown[]) => getAffiliationRequestsMock(...args),
  getCommercialInteractions: (...args: unknown[]) => getCommercialInteractionsMock(...args),
  addCommercialInteraction: (...args: unknown[]) => addCommercialInteractionMock(...args)
}));

function renderPage(scope?: 'supervisor' | 'commercial') {
  return render(
    <MemoryRouter>
      <CommercialDirectRequestsPage scope={scope} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  getAffiliationRequestsMock.mockReset().mockResolvedValue({ requests: [] });
  getCommercialInteractionsMock.mockReset().mockResolvedValue({ interactions: [] });
  addCommercialInteractionMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('CommercialDirectRequestsPage', () => {
  it('exclut les demandes qui ne sont pas des prospections directes', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'Direct SARL', status: 'SOUMIS' },
        { dossierId: 2, origineCreation: 'AUTO', nomCommercant: 'Auto SARL', status: 'SOUMIS' }
      ]
    });

    renderPage('supervisor');

    expect(await screen.findByText('Direct SARL')).toBeInTheDocument();
    expect(screen.queryByText('Auto SARL')).toBeNull();
  });

  it("un commercial ne voit que les prospections qui lui sont attribuees", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL', nom: 'Amine Alaoui', email: 'amine@lc.ma'
      })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'MonProspect', commercialAttribue: 'Amine Alaoui', status: 'SOUMIS' },
        { dossierId: 2, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'AutreProspect', commercialAttribue: 'Quelqu Un Dautre', status: 'SOUMIS' }
      ]
    });

    renderPage();

    expect(await screen.findByText('MonProspect')).toBeInTheDocument();
    expect(screen.queryByText('AutreProspect')).toBeNull();
  });

  it('un superviseur voit toutes les prospections directes sans filtre par attribution', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'ProspectA', commercialAttribue: 'X', status: 'SOUMIS' },
        { dossierId: 2, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'ProspectB', commercialAttribue: 'Y', status: 'SOUMIS' }
      ]
    });

    renderPage('supervisor');

    expect(await screen.findByText('ProspectA')).toBeInTheDocument();
    expect(screen.getByText('ProspectB')).toBeInTheDocument();
  });

  it('filtre par recherche texte', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'Alpha SARL', status: 'SOUMIS' },
        { dossierId: 2, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'Beta SARL', status: 'SOUMIS' }
      ]
    });

    renderPage('supervisor');
    await screen.findByText('Alpha SARL');

    fireEvent.change(screen.getByPlaceholderText('Nom, e-mail, téléphone, ville ou dossier'), {
      target: { value: 'Beta' }
    });

    expect(screen.queryByText('Alpha SARL')).toBeNull();
    expect(screen.getByText('Beta SARL')).toBeInTheDocument();
  });

  it("affiche un message d'erreur si le chargement echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockRejectedValue(new Error('503'));

    renderPage('supervisor');
    expect(await screen.findByText('Impossible de charger les demandes commerciales.')).toBeInTheDocument();
  });

  it('enregistre une interaction commerciale depuis le panneau de suivi', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL', nom: 'Amine Alaoui', email: 'amine@lc.ma'
      })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 7, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'MonProspect', commercialAttribue: 'Amine Alaoui', status: 'SOUMIS' }]
    });
    addCommercialInteractionMock.mockResolvedValue({ interactions: [] });

    renderPage();
    await screen.findByText('MonProspect');

    fireEvent.click(screen.getByRole('button', { name: 'Interaction' }));
    await screen.findByText(/Dossier #7/);

    fireEvent.change(screen.getByPlaceholderText('Répondu, RDV confirmé, pas intéressé...'), {
      target: { value: 'Client interesse, rappel prevu' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer interaction/ }));

    expect(await screen.findByText('Interaction commerciale enregistrée.')).toBeInTheDocument();
    expect(addCommercialInteractionMock).toHaveBeenCalledWith(7, expect.objectContaining({ resultat: 'Client interesse, rappel prevu' }));
  });

  it('bloque l\'enregistrement si le resultat est vide', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL', nom: 'Amine Alaoui', email: 'amine@lc.ma'
      })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 7, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'MonProspect', commercialAttribue: 'Amine Alaoui', status: 'SOUMIS' }]
    });

    renderPage();
    await screen.findByText('MonProspect');

    fireEvent.click(screen.getByRole('button', { name: 'Interaction' }));
    await screen.findByText(/Dossier #7/);
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer interaction/ }));

    expect(await screen.findByText('Champ obligatoire manquant : Résultat.')).toBeInTheDocument();
    expect(addCommercialInteractionMock).not.toHaveBeenCalled();
  });

  it('passe ?correction=1 en reprenant un dossier direct renvoye "a corriger" (sinon tous les champs restent editables)', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL', nom: 'Amine Alaoui', email: 'amine@lc.ma'
      })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 9, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'ACorriger SARL',
        commercialAttribue: 'Amine Alaoui', status: 'INCOMPLET'
      }]
    });

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<CommercialDirectRequestsPage />} />
          <Route path="/commercial/demandes-commerciales/:id/continue" element={<ContinuePagePlaceholder />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('ACorriger SARL');
    fireEvent.click(screen.getByRole('button', { name: 'Corriger' }));

    expect(await screen.findByText('Page continue?correction=1')).toBeInTheDocument();
  });

  it('ne passe pas le flag de correction pour un brouillon (formulaire entierement editable)', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL', nom: 'Amine Alaoui', email: 'amine@lc.ma'
      })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 10, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'Brouillon SARL',
        commercialAttribue: 'Amine Alaoui', status: 'BROUILLON'
      }]
    });

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<CommercialDirectRequestsPage />} />
          <Route path="/commercial/demandes-commerciales/:id/continue" element={<ContinuePagePlaceholder />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Brouillon SARL');
    fireEvent.click(screen.getByRole('button', { name: 'Continuer brouillon' }));

    expect(await screen.findByText('Page continue')).toBeInTheDocument();
  });
});
