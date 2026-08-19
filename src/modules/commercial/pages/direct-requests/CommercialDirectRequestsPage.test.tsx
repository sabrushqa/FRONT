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

  it("ferme le panneau d'interaction au clic sur le bouton de fond — un vrai <button> (accessibilite clavier native, Sonar S1082/S6819/S6842)", async () => {
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

    const backdrop = screen.getByLabelText("Fermer le panneau d'interaction");
    // Un <button> HTML est nativement operable au clavier (Entree/Espace) par
    // le navigateur lui-meme — pas besoin de le retester ici, contrairement a
    // un role="button" simule sur un element non-interactif.
    expect(backdrop.tagName).toBe('BUTTON');

    fireEvent.click(backdrop);
    expect(screen.queryByText(/Dossier #7/)).toBeNull();
  });

  it("un clic a l'interieur du dialogue ne ferme pas le panneau (dialogue et bouton de fond sont des freres, pas parent/enfant)", async () => {
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

    fireEvent.click(screen.getByText('Interaction prospection'));
    expect(screen.getByText(/Dossier #7/)).toBeInTheDocument();
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

  it('filtre par statut, puis reinitialise les filtres', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'Alpha SARL', status: 'BROUILLON' },
        { dossierId: 2, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'Beta SARL', status: 'SOUMIS' }
      ]
    });

    renderPage('supervisor');
    await screen.findByText('Alpha SARL');
    expect(screen.getByText('Beta SARL')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Brouillons/ }));
    expect(screen.getByText('Alpha SARL')).toBeInTheDocument();
    expect(screen.queryByText('Beta SARL')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    expect(screen.getByText('Alpha SARL')).toBeInTheDocument();
    expect(screen.getByText('Beta SARL')).toBeInTheDocument();
  });

  it('filtre par region', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [
        { dossierId: 1, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'Alpha SARL', status: 'SOUMIS', region: 'Casablanca-Settat' },
        { dossierId: 2, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'Beta SARL', status: 'SOUMIS', region: 'Rabat-Salé' }
      ]
    });

    renderPage('supervisor');
    await screen.findByText('Alpha SARL');

    fireEvent.change(screen.getByLabelText('Région'), { target: { value: 'Casablanca-Settat' } });
    expect(screen.getByText('Alpha SARL')).toBeInTheDocument();
    expect(screen.queryByText('Beta SARL')).toBeNull();
  });

  it("affiche une erreur si aucune adresse e-mail n'est disponible pour renvoyer un complement", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL', nom: 'Amine Alaoui', email: 'amine@lc.ma'
      })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{
        dossierId: 9, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'ACorriger SARL',
        commercialAttribue: 'Amine Alaoui', status: 'INCOMPLET', email: ''
      }]
    });

    renderPage();
    await screen.findByText('ACorriger SARL');

    fireEvent.click(screen.getByRole('button', { name: 'Email' }));

    expect(await screen.findByText("Aucune adresse e-mail commerçant n'est disponible pour ce dossier.")).toBeInTheDocument();
  });

  it('exige une date de relance quand le statut du prospect est "À relancer"', async () => {
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

    fireEvent.change(screen.getByPlaceholderText('Répondu, RDV confirmé, pas intéressé...'), {
      target: { value: 'Rappeler plus tard' }
    });
    fireEvent.change(screen.getByLabelText('Statut du prospect'), { target: { value: 'A_RELANCER' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer interaction/ }));

    expect(await screen.findByText('Champ obligatoire manquant : Date de relance.')).toBeInTheDocument();
    expect(addCommercialInteractionMock).not.toHaveBeenCalled();
  });

  it('exige un motif quand le prospect est marque "Abandonné", puis enregistre avec succes et affiche la sync calendrier', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL', nom: 'Amine Alaoui', email: 'amine@lc.ma'
      })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 7, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'MonProspect', commercialAttribue: 'Amine Alaoui', status: 'SOUMIS' }]
    });
    addCommercialInteractionMock.mockResolvedValue({ interactions: [], googleCalendarSynced: true });

    renderPage();
    await screen.findByText('MonProspect');

    fireEvent.click(screen.getByRole('button', { name: 'Interaction' }));
    await screen.findByText(/Dossier #7/);

    fireEvent.change(screen.getByPlaceholderText('Répondu, RDV confirmé, pas intéressé...'), {
      target: { value: 'Ne repond plus' }
    });
    fireEvent.change(screen.getByLabelText('Statut du prospect'), { target: { value: 'ABANDONNE' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer interaction/ }));

    expect(await screen.findByText('Champ obligatoire manquant : Motif d’abandon.')).toBeInTheDocument();
    expect(addCommercialInteractionMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Motif d’abandon'), { target: { value: 'Ne repond plus depuis 3 semaines' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer interaction/ }));

    expect(await screen.findByText('Interaction commerciale enregistrée et ajoutée à Google Calendar.')).toBeInTheDocument();
  });

  it("affiche une erreur si le chargement de l'historique d'interactions echoue", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL', nom: 'Amine Alaoui', email: 'amine@lc.ma'
      })
    );
    getAffiliationRequestsMock.mockResolvedValue({
      requests: [{ dossierId: 7, origineCreation: 'COMMERCIAL_DIRECT', nomCommercant: 'MonProspect', commercialAttribue: 'Amine Alaoui', status: 'SOUMIS' }]
    });
    getCommercialInteractionsMock.mockRejectedValue(new Error('503'));

    renderPage();
    await screen.findByText('MonProspect');

    fireEvent.click(screen.getByRole('button', { name: 'Interaction' }));

    expect(await screen.findByText("Impossible de charger l'historique commercial.")).toBeInTheDocument();
  });
});
