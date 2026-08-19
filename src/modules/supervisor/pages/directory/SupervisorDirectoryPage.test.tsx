import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SupervisorDirectoryPage from './SupervisorDirectoryPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const getOverviewMock = vi.fn();
const deactivateBackOfficeMock = vi.fn();
const sendBackOfficeActivationMock = vi.fn();
const deactivateCommercialeMock = vi.fn();
const sendCommercialeActivationMock = vi.fn();
const deactivateCommercantMock = vi.fn();
const sendCommercantActivationMock = vi.fn();
const resilierCommercantMock = vi.fn();

vi.mock('../../services/supervisorApi', () => ({
  getOverview: (...args: unknown[]) => getOverviewMock(...args),
  deactivateBackOffice: (...args: unknown[]) => deactivateBackOfficeMock(...args),
  sendBackOfficeActivation: (...args: unknown[]) => sendBackOfficeActivationMock(...args),
  deactivateCommerciale: (...args: unknown[]) => deactivateCommercialeMock(...args),
  sendCommercialeActivation: (...args: unknown[]) => sendCommercialeActivationMock(...args),
  deactivateCommercant: (...args: unknown[]) => deactivateCommercantMock(...args),
  sendCommercantActivation: (...args: unknown[]) => sendCommercantActivationMock(...args),
  resilierCommercant: (...args: unknown[]) => resilierCommercantMock(...args)
}));

function renderPage(directoryType: 'backOffices' | 'commerciales' | 'commercants' = 'backOffices') {
  return render(
    <MemoryRouter>
      <SupervisorDirectoryPage directoryType={directoryType} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  getOverviewMock.mockReset().mockResolvedValue({ backOffices: [], commerciales: [], commercants: [] });
  deactivateBackOfficeMock.mockReset();
  sendBackOfficeActivationMock.mockReset();
  deactivateCommercialeMock.mockReset();
  sendCommercialeActivationMock.mockReset();
  deactivateCommercantMock.mockReset();
  sendCommercantActivationMock.mockReset();
  resilierCommercantMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
  useSessionStore.getState().setSession(
    normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
  );
});

describe('SupervisorDirectoryPage', () => {
  it('affiche les back offices', async () => {
    getOverviewMock.mockResolvedValue({
      backOffices: [{ id: 1, nom: 'Doe', prenom: 'John', email: 'j@d.com', active: true }],
      commerciales: [],
      commercants: []
    });

    renderPage('backOffices');
    expect(await screen.findByText('John Doe')).toBeInTheDocument();
  });

  it('desactive un back office et rafraichit la liste sans effacer le message', async () => {
    getOverviewMock.mockResolvedValue({
      backOffices: [{ id: 1, nom: 'Doe', prenom: 'John', email: 'j@d.com', active: true }],
      commerciales: [],
      commercants: []
    });
    deactivateBackOfficeMock.mockResolvedValue({ message: 'Compte désactivé' });

    renderPage('backOffices');
    fireEvent.click(await screen.findByRole('button', { name: 'Désactiver' }));

    expect(await screen.findByText('Compte désactivé')).toBeInTheDocument();
  });

  it("n'appelle pas getOverview pour un role sans gestion staff", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL' })
    );
    renderPage('backOffices');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getOverviewMock).not.toHaveBeenCalled();
  });

  it("affiche un message d'erreur si le chargement echoue", async () => {
    getOverviewMock.mockRejectedValue(new Error('503'));
    renderPage('commercants');
    expect(await screen.findByText('Impossible de charger cette liste.')).toBeInTheDocument();
  });

  it('renvoie une activation a un back office en attente', async () => {
    getOverviewMock.mockResolvedValue({
      backOffices: [{ id: 1, nom: 'Doe', prenom: 'John', email: 'j@d.com', active: false }],
      commerciales: [], commercants: []
    });
    sendBackOfficeActivationMock.mockResolvedValue({ message: "E-mail d'activation renvoyé." });

    renderPage('backOffices');
    fireEvent.click(await screen.findByRole('button', { name: 'Renvoyer activation' }));

    expect(await screen.findByText("E-mail d'activation renvoyé.")).toBeInTheDocument();
    expect(sendBackOfficeActivationMock).toHaveBeenCalledWith(1);
  });

  it('filtre les back offices par service et par statut, puis reinitialise', async () => {
    getOverviewMock.mockResolvedValue({
      backOffices: [
        { id: 1, nom: 'Doe', prenom: 'John', email: 'j@d.com', active: true, service: 'Support' },
        { id: 2, nom: 'Smith', prenom: 'Anna', email: 'a@s.com', active: false, service: 'Conformité' }
      ],
      commerciales: [], commercants: []
    });

    renderPage('backOffices');
    await screen.findByText('John Doe');
    expect(screen.getByText('Anna Smith')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Service'), { target: { value: 'Support' } });
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('Anna Smith')).toBeNull();

    fireEvent.change(screen.getByLabelText('Service'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'inactive' } });
    expect(screen.queryByText('John Doe')).toBeNull();
    expect(screen.getByText('Anna Smith')).toBeInTheDocument();

    const resetButton = screen.getByRole('button', { name: 'Réinitialiser' });
    expect(resetButton).not.toBeDisabled();
    fireEvent.click(resetButton);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Anna Smith')).toBeInTheDocument();
  });

  it('affiche un etat vide quand aucun back office ne correspond aux filtres', async () => {
    getOverviewMock.mockResolvedValue({
      backOffices: [{ id: 1, nom: 'Doe', prenom: 'John', email: 'j@d.com', active: true, service: 'Support' }],
      commerciales: [], commercants: []
    });

    renderPage('backOffices');
    await screen.findByText('John Doe');

    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'inactive' } });
    expect(await screen.findByText('Aucun compte back office ne correspond aux filtres sélectionnés.')).toBeInTheDocument();
  });

  it('affiche les commerciales, filtre par region et desactive un compte', async () => {
    getOverviewMock.mockResolvedValue({
      backOffices: [],
      commerciales: [
        { id: 1, nom: 'Alaoui', prenom: 'Amine', email: 'a@a.com', active: true, region: 'Casablanca-Settat' },
        { id: 2, nom: 'Bennani', prenom: 'Sara', email: 's@b.com', active: true, region: 'Rabat-Salé' }
      ],
      commercants: []
    });
    deactivateCommercialeMock.mockResolvedValue({ message: 'Compte commercial désactivé.' });

    renderPage('commerciales');
    await screen.findByText('Amine Alaoui');
    expect(screen.getByText('Sara Bennani')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Région'), { target: { value: 'Casablanca-Settat' } });
    expect(screen.getByText('Amine Alaoui')).toBeInTheDocument();
    expect(screen.queryByText('Sara Bennani')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Désactiver' }));
    expect(await screen.findByText('Compte commercial désactivé.')).toBeInTheDocument();
    expect(deactivateCommercialeMock).toHaveBeenCalledWith(1);
  });

  it('affiche un etat vide quand la liste des commerciales est vide', async () => {
    getOverviewMock.mockResolvedValue({ backOffices: [], commerciales: [], commercants: [] });
    renderPage('commerciales');
    expect(await screen.findByText("Aucun compte commercial n'a été trouvé.")).toBeInTheDocument();
  });

  it('affiche les commercants, filtre par type et par affiliation, desactive et resilie un compte', async () => {
    getOverviewMock.mockResolvedValue({
      backOffices: [],
      commerciales: [],
      commercants: [
        { id: 1, nom: 'ACME SARL', email: 'a@acme.ma', active: true, typeCommercant: 'PERSONNE_MORALE', typeAffiliation: 'TPE' },
        { id: 2, nom: 'Epicerie du coin', email: 'e@e.ma', active: true, typeCommercant: 'PERSONNE_PHYSIQUE', typeAffiliation: 'E_COMMERCE' }
      ]
    });
    deactivateCommercantMock.mockResolvedValue({ message: 'Commerçant désactivé.' });

    renderPage('commercants');
    await screen.findByText('ACME SARL');
    expect(screen.getByText('Epicerie du coin')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Type de personne'), { target: { value: 'PERSONNE_MORALE' } });
    expect(screen.getByText('ACME SARL')).toBeInTheDocument();
    expect(screen.queryByText('Epicerie du coin')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Désactiver' })[0]);
    expect(await screen.findByText('Commerçant désactivé.')).toBeInTheDocument();
    expect(deactivateCommercantMock).toHaveBeenCalledWith(1);
  });

  it('resilie un commerçant apres confirmation, avec le motif saisi', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Contrat non respecté');
    getOverviewMock.mockResolvedValue({
      backOffices: [], commerciales: [],
      commercants: [{ id: 1, nom: 'ACME SARL', email: 'a@acme.ma', active: true, typeCommercant: 'PERSONNE_MORALE', typeAffiliation: 'TPE' }]
    });
    resilierCommercantMock.mockResolvedValue({ message: 'Commerçant résilié.' });

    renderPage('commercants');
    await screen.findByText('ACME SARL');

    fireEvent.click(screen.getByRole('button', { name: 'Résilier' }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(promptSpy).toHaveBeenCalled();
    expect(await screen.findByText('Commerçant résilié.')).toBeInTheDocument();
    expect(resilierCommercantMock).toHaveBeenCalledWith(1, 'Contrat non respecté');

    confirmSpy.mockRestore();
    promptSpy.mockRestore();
  });

  it("n'appelle pas l'API de resiliation si l'utilisateur annule la confirmation", async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    getOverviewMock.mockResolvedValue({
      backOffices: [], commerciales: [],
      commercants: [{ id: 1, nom: 'ACME SARL', email: 'a@acme.ma', active: true, typeCommercant: 'PERSONNE_MORALE', typeAffiliation: 'TPE' }]
    });

    renderPage('commercants');
    await screen.findByText('ACME SARL');
    fireEvent.click(screen.getByRole('button', { name: 'Résilier' }));

    expect(resilierCommercantMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('renvoie une activation a un commercant desactive', async () => {
    getOverviewMock.mockResolvedValue({
      backOffices: [], commerciales: [],
      commercants: [{ id: 1, nom: 'ACME SARL', email: 'a@acme.ma', active: false, typeCommercant: 'PERSONNE_MORALE', typeAffiliation: 'TPE' }]
    });
    sendCommercantActivationMock.mockResolvedValue({ message: "Activation renvoyée." });

    renderPage('commercants');
    await screen.findByText('ACME SARL');
    fireEvent.click(screen.getByRole('button', { name: 'Renvoyer activation' }));

    expect(await screen.findByText('Activation renvoyée.')).toBeInTheDocument();
    expect(sendCommercantActivationMock).toHaveBeenCalledWith(1);
  });

  it('pagine la liste des back offices avec plus de comptes que la taille de page', async () => {
    const backOffices = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1, nom: `Nom${i}`, prenom: `Prenom${i}`, email: `p${i}@d.com`, active: true
    }));
    getOverviewMock.mockResolvedValue({ backOffices, commerciales: [], commercants: [] });

    renderPage('backOffices');
    await screen.findByText('Prenom0 Nom0');
    expect(screen.queryByText('Prenom8 Nom8')).toBeNull();
    expect(screen.getByText('Page 1 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(await screen.findByText('Prenom8 Nom8')).toBeInTheDocument();
    expect(screen.getByText('Page 2 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Précédent' }));
    expect(await screen.findByText('Prenom0 Nom0')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '20' }));
    expect(await screen.findByText('Prenom9 Nom9')).toBeInTheDocument();
  });

  it("affiche une erreur si une desactivation echoue", async () => {
    getOverviewMock.mockResolvedValue({
      backOffices: [{ id: 1, nom: 'Doe', prenom: 'John', email: 'j@d.com', active: true }],
      commerciales: [], commercants: []
    });
    deactivateBackOfficeMock.mockRejectedValue({});

    renderPage('backOffices');
    fireEvent.click(await screen.findByRole('button', { name: 'Désactiver' }));

    expect(await screen.findByText('Impossible de désactiver le compte back office.')).toBeInTheDocument();
  });
});
