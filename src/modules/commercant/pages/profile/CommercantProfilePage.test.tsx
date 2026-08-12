import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CommercantProfilePage from './CommercantProfilePage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

beforeEach(() => {
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
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
});
