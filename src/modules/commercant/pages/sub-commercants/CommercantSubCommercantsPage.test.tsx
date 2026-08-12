import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommercantSubCommercantsPage from './CommercantSubCommercantsPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const createSubMerchantMock = vi.fn();
const activateSubMerchantMock = vi.fn();
const deactivateSubMerchantMock = vi.fn();
const moveSubMerchantToPdvMock = vi.fn();

vi.mock('../../services/commercantApi', () => ({
  createSubMerchant: (...args: unknown[]) => createSubMerchantMock(...args),
  activateSubMerchant: (...args: unknown[]) => activateSubMerchantMock(...args),
  deactivateSubMerchant: (...args: unknown[]) => deactivateSubMerchantMock(...args),
  moveSubMerchantToPdv: (...args: unknown[]) => moveSubMerchantToPdvMock(...args)
}));

beforeEach(() => {
  createSubMerchantMock.mockReset();
  activateSubMerchantMock.mockReset();
  deactivateSubMerchantMock.mockReset();
  moveSubMerchantToPdvMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('CommercantSubCommercantsPage', () => {
  it("bloque la creation si prenom/nom/email manquent", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', pdvs: [{ id: 1, nom: 'PDV1', statut: 'ACTIF' } as never] })
    );
    render(<CommercantSubCommercantsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(screen.getByText("Le prénom, le nom et l'e-mail sont obligatoires.")).toBeInTheDocument();
    expect(createSubMerchantMock).not.toHaveBeenCalled();
  });

  it('cree un sous-commercant avec un PDV valide', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', pdvs: [{ id: 1, nom: 'PDV1', statut: 'ACTIF' } as never] })
    );
    createSubMerchantMock.mockResolvedValue({ id: 5, message: 'Sous-commerçant créé', activationEmailSent: true, activationMessage: 'Email envoyé' });

    render(<CommercantSubCommercantsPage />);
    fireEvent.change(screen.getByLabelText('Point de vente *'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Prénom *'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Nom *'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('E-mail *'), { target: { value: 'jane@doe.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByText('Sous-commerçant créé Email envoyé')).toBeInTheDocument();
  });

  it("active/desactive un sous-commercant existant", async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCANT',
        sousCommercants: [{ id: 2, nom: 'Doe', prenom: 'Jane', email: 'jane@doe.com', telephone: '', statut: 'ACTIF', active: true, pdvId: null, pdv: '', canalEcommerce: '' } as never]
      })
    );
    deactivateSubMerchantMock.mockResolvedValue({ id: 2, active: false, statut: 'INACTIF', message: 'Compte désactivé' });

    render(<CommercantSubCommercantsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Désactiver' }));

    expect(await screen.findByText('Compte désactivé')).toBeInTheDocument();
  });

  it("masque le formulaire de creation et les actions pour un sous-commercant", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SOUS_COMMERCANT' })
    );
    render(<CommercantSubCommercantsPage />);
    expect(screen.queryByText('Ajouter un sous-commerçant')).toBeNull();
  });

  it('cree un sous-commercant via un canal e-commerce', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'E_COMMERCE' })
    );
    createSubMerchantMock.mockResolvedValue({ id: 6, message: 'Compte créé', activationEmailSent: true, activationMessage: '' });

    render(<CommercantSubCommercantsPage />);
    fireEvent.change(screen.getByLabelText('Canal *'), { target: { value: 'SITE_MARCHAND' } });
    fireEvent.change(screen.getByLabelText('Prénom *'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Nom *'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('E-mail *'), { target: { value: 'jane@doe.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByText('Compte créé')).toBeInTheDocument();
    expect(createSubMerchantMock).toHaveBeenCalledWith(
      expect.objectContaining({ canalEcommerce: 'SITE_MARCHAND', prenom: 'Jane', nom: 'Doe', email: 'jane@doe.com' })
    );
  });

  it("bloque la creation e-commerce si aucun canal n'est selectionne", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'E_COMMERCE' })
    );
    render(<CommercantSubCommercantsPage />);
    fireEvent.change(screen.getByLabelText('Prénom *'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Nom *'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('E-mail *'), { target: { value: 'jane@doe.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(screen.getByText('Sélectionnez un canal (site marchand ou application mobile).')).toBeInTheDocument();
    expect(createSubMerchantMock).not.toHaveBeenCalled();
  });

  it('deplace un sous-commercant vers un autre PDV disponible', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'COMMERCANT',
        pdvs: [
          { id: 1, nom: 'PDV1', statut: 'ACTIF', sousCommercantId: 2 } as never,
          { id: 2, nom: 'PDV2', statut: 'ACTIF', sousCommercantId: null } as never
        ],
        sousCommercants: [{ id: 2, nom: 'Doe', prenom: 'Jane', email: 'jane@doe.com', telephone: '', statut: 'ACTIF', active: true, pdvId: 1, pdv: 'PDV1', canalEcommerce: '' } as never]
      })
    );
    moveSubMerchantToPdvMock.mockResolvedValue({ id: 2, pdvId: 2, message: 'Sous-commerçant déplacé' });

    render(<CommercantSubCommercantsPage />);
    fireEvent.change(screen.getByLabelText('Déplacer vers PDV'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Déplacer' }));

    expect(await screen.findByText('Sous-commerçant déplacé')).toBeInTheDocument();
    expect(moveSubMerchantToPdvMock).toHaveBeenCalledWith(2, 2);
  });
});
