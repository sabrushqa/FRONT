import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CommercantPdvsPage from './CommercantPdvsPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

beforeEach(() => {
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('CommercantPdvsPage', () => {
  it('affiche un message adapte aux comptes e-commerce', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        typeAffiliation: 'E_COMMERCE',
        pdvs: [{ id: 1, nom: 'PDV1' } as never]
      })
    );
    render(<CommercantPdvsPage />);
    expect(screen.getByText(/ne s'applique pas aux comptes e-commerce/)).toBeInTheDocument();
  });

  it("affiche un etat vide quand aucun pdv n'existe", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'ENCAISSEMENT' })
    );
    render(<CommercantPdvsPage />);
    expect(screen.getByText('Aucun point de vente enregistré.')).toBeInTheDocument();
  });

  it('affiche la liste des pdvs avec statut et sous-commercant affecte', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        typeAffiliation: 'ENCAISSEMENT',
        pdvs: [
          {
            id: 1, nom: 'Boutique Centre', ville: 'Casablanca', adresse: 'Rue 1', telephone: '0600000000',
            email: 'x@x.com', codePostal: '20000', dateCreation: '2026-01-01', statut: 'ACTIF',
            sousCommercantId: 5, sousCommercant: 'Jane Doe', sousCommercantEmail: 'jane@x.com', sousCommercantStatut: 'ACTIF', sousCommercantActive: true
          } as never
        ]
      })
    );
    render(<CommercantPdvsPage />);
    expect(screen.getByText('Boutique Centre')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it("masque l'affectation sous-commercant pour un sous-commercant connecte", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'SOUS_COMMERCANT',
        typeAffiliation: 'ENCAISSEMENT',
        pdvs: [{ id: 1, nom: 'Boutique Centre', statut: 'ACTIF' } as never]
      })
    );
    render(<CommercantPdvsPage />);
    expect(screen.getByText('Infos PDV')).toBeInTheDocument();
    expect(screen.queryByText('Disponible pour affectation')).toBeNull();
  });
});
