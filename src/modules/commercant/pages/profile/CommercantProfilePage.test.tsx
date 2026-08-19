import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CommercantProfilePage from './CommercantProfilePage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

beforeEach(() => {
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
  useSessionStore.getState().setActiveAffiliationProfile('ENCAISSEMENT');
});

describe('CommercantProfilePage', () => {
  it('affiche le site marchand comme lien pour une URL http(s) valide', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        typeAffiliation: 'E_COMMERCE',
        profile: { typeAffiliation: 'E_COMMERCE', siteMarchandUrl: 'https://boutique.ma' }
      })
    );
    render(<CommercantProfilePage />);
    const link = screen.getByText('https://boutique.ma');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://boutique.ma');
  });

  it("n'affiche pas de lien cliquable pour un schema dangereux (javascript:)", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        typeAffiliation: 'E_COMMERCE',
        profile: { typeAffiliation: 'E_COMMERCE', siteMarchandUrl: 'javascript:alert(1)' }
      })
    );
    render(<CommercantProfilePage />);
    const value = screen.getByText('javascript:alert(1)');
    expect(value.tagName).not.toBe('A');
  });

  it("n'affiche pas les champs e-commerce pour une affiliation encaissement", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        typeAffiliation: 'ENCAISSEMENT',
        profile: { siteMarchandUrl: 'https://boutique.ma' }
      })
    );
    render(<CommercantProfilePage />);
    expect(screen.queryByText('Site marchand')).toBeNull();
  });

  it("masque le resume d'activite pour un sous-commercant", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SOUS_COMMERCANT' })
    );
    render(<CommercantProfilePage />);
    expect(screen.queryByText("Résumé d'activité")).toBeNull();
    expect(screen.getByText('Sous-commerçant')).toBeInTheDocument();
  });

  it("affiche le resume d'activite pour un commercant principal", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        summary: { totalTransactions: 5, totalPdvs: 2, totalTpes: 1, totalSousCommercants: 3 }
      })
    );
    render(<CommercantProfilePage />);
    expect(screen.getByText("Résumé d'activité")).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it("masque Points de vente et Terminaux TPE pour une affiliation e-commerce pure", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        typeAffiliation: 'E_COMMERCE',
        profile: { typeAffiliation: 'E_COMMERCE' },
        summary: { totalTransactions: 5, totalPdvs: 2, totalTpes: 1, totalSousCommercants: 3 }
      })
    );
    render(<CommercantProfilePage />);
    expect(screen.queryByText('Points de vente')).toBeNull();
    expect(screen.queryByText('Terminaux TPE')).toBeNull();
    // Sous-commercants n'existe que pour le canal encaissement (TPE).
    expect(screen.queryByText('Sous-commerçants')).toBeNull();
  });

  it("commercant combine bascule sur E-commerce : masque PDV/TPE, affiche le site marchand", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        typeAffiliation: 'ENCAISSEMENT_ET_ECOMMERCE',
        profile: { typeAffiliation: 'ENCAISSEMENT_ET_ECOMMERCE', siteMarchandUrl: 'https://boutique.ma' },
        summary: { totalTransactions: 5, totalPdvs: 2, totalTpes: 1, totalSousCommercants: 3 }
      })
    );
    useSessionStore.getState().setActiveAffiliationProfile('E_COMMERCE');
    render(<CommercantProfilePage />);
    expect(screen.queryByText('Points de vente')).toBeNull();
    expect(screen.queryByText('Terminaux TPE')).toBeNull();
    expect(screen.queryByText('Sous-commerçants')).toBeNull();
    expect(screen.getByText('https://boutique.ma')).toBeInTheDocument();
    expect(screen.getByText("Type d'affiliation").nextSibling).toHaveTextContent('E-commerce');
  });

  it("n'affiche que les transactions du canal actif dans le resume, pour un commercant combine", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        typeAffiliation: 'ENCAISSEMENT_ET_ECOMMERCE',
        profile: { typeAffiliation: 'ENCAISSEMENT_ET_ECOMMERCE' },
        // summary.totalTransactions est un total brut backend (les 2 canaux
        // melanges) : le resume doit l'ignorer pour un commercant combine et
        // ne compter que les transactions du canal de l'espace actif.
        summary: { totalTransactions: 5, totalPdvs: 2, totalTpes: 1, totalSousCommercants: 3 },
        transactions: [
          { id: 1, canal: 'TPE', dateTransaction: '2026-07-01', pdv: 'PDV1', tpe: 'TPE1' } as never,
          { id: 2, canal: 'ECOMMERCE', dateTransaction: '2026-07-02', pdv: '', tpe: 'boutique.ma' } as never,
          { id: 3, canal: 'ECOMMERCE', dateTransaction: '2026-07-03', pdv: '', tpe: 'boutique.ma' } as never
        ]
      })
    );

    useSessionStore.getState().setActiveAffiliationProfile('ENCAISSEMENT');
    const { unmount } = render(<CommercantProfilePage />);
    expect(screen.getByText('Transactions').previousElementSibling).toHaveTextContent('1');
    unmount();

    useSessionStore.getState().setActiveAffiliationProfile('E_COMMERCE');
    render(<CommercantProfilePage />);
    expect(screen.getByText('Transactions').previousElementSibling).toHaveTextContent('2');
  });

  it("commercant combine bascule sur Encaissement : affiche PDV/TPE, masque le site marchand", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        typeAffiliation: 'ENCAISSEMENT_ET_ECOMMERCE',
        profile: { typeAffiliation: 'ENCAISSEMENT_ET_ECOMMERCE', siteMarchandUrl: 'https://boutique.ma' },
        summary: { totalTransactions: 5, totalPdvs: 2, totalTpes: 1, totalSousCommercants: 3 }
      })
    );
    useSessionStore.getState().setActiveAffiliationProfile('ENCAISSEMENT');
    render(<CommercantProfilePage />);
    expect(screen.getByText('Points de vente')).toBeInTheDocument();
    expect(screen.getByText('Terminaux TPE')).toBeInTheDocument();
    expect(screen.queryByText('Site marchand')).toBeNull();
    expect(screen.getByText("Type d'affiliation").nextSibling).toHaveTextContent('Encaissement');
  });
});
