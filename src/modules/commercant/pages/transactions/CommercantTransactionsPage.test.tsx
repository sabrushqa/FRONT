import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommercantTransactionsPage from './CommercantTransactionsPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

beforeEach(() => {
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

function setSessionWithTransactions() {
  useSessionStore.getState().setSession(
    normalizeUserSessionResponse({
      utilisateurId: 1,
      commercantId: 1,
      role: 'COMMERCANT',
      transactions: [
        { id: 1, dateTransaction: '2026-07-01', heureTransaction: '10:00', montant: 100, devise: 'MAD', statut: 'ACCEPTE', typePaiement: 'CB', tpe: 'TPE1', pdvId: 1, pdv: 'PDV1' },
        { id: 2, dateTransaction: '2026-07-02', heureTransaction: '11:00', montant: 50, devise: 'MAD', statut: 'REFUSE', typePaiement: 'CB', tpe: 'TPE2', pdvId: 2, pdv: 'PDV2' }
      ] as never
    })
  );
}

describe('CommercantTransactionsPage', () => {
  it("affiche un etat vide sans transaction", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT' })
    );
    render(<CommercantTransactionsPage />);
    expect(screen.getByText('Aucune transaction disponible.')).toBeInTheDocument();
  });

  it('affiche toutes les transactions et calcule le montant total', () => {
    setSessionWithTransactions();
    render(<CommercantTransactionsPage />);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('filtre par recherche texte (ID, PDV, TPE)', () => {
    setSessionWithTransactions();
    render(<CommercantTransactionsPage />);
    fireEvent.change(screen.getByPlaceholderText(/Rechercher/i), { target: { value: 'PDV1' } });
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.queryByText('#2')).toBeNull();
  });

  it('filtre par statut', () => {
    setSessionWithTransactions();
    render(<CommercantTransactionsPage />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'REFUSE' } });
    expect(screen.queryByText('#1')).toBeNull();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });
});
