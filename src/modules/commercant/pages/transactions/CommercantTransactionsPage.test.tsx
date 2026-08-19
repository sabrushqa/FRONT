import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommercantTransactionsPage from './CommercantTransactionsPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const downloadExcelMock = vi.fn();
vi.mock('../../../../core/excelExport', () => ({
  downloadExcel: (...args: unknown[]) => downloadExcelMock(...args)
}));

beforeEach(() => {
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
  useSessionStore.getState().setActiveAffiliationProfile('ENCAISSEMENT');
  downloadExcelMock.mockReset().mockResolvedValue(undefined);
});

function setCombinedSessionWithTransactions() {
  useSessionStore.getState().setSession(
    normalizeUserSessionResponse({
      utilisateurId: 1,
      commercantId: 1,
      role: 'COMMERCANT',
      typeAffiliation: 'ENCAISSEMENT_ET_ECOMMERCE',
      transactions: [
        { id: 1, canal: 'TPE', dateTransaction: '2026-07-01', heureTransaction: '10:00', montant: 100, devise: 'MAD', statut: 'ACCEPTE', typePaiement: 'CB', tpe: 'TPE1', pdvId: 1, pdv: 'PDV1' },
        { id: 2, canal: 'ECOMMERCE', dateTransaction: '2026-07-02', heureTransaction: '11:00', montant: 50, devise: 'MAD', statut: 'ACCEPTE', typePaiement: 'CB', tpe: 'boutique.ma', pdvId: null, pdv: '' }
      ] as never
    })
  );
}

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
    fireEvent.change(screen.getByRole('combobox', { name: 'Statut' }), { target: { value: 'Refusée' } });
    expect(screen.queryByText('#1')).toBeNull();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('filtre par preset de période (7/30/90 jours / toute la période)', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        transactions: [
          { id: 1, dateTransaction: new Date().toISOString().slice(0, 10), heureTransaction: '10:00', montant: 100, devise: 'MAD', statut: 'ACCEPTE', typePaiement: 'CB', tpe: 'TPE1', pdvId: 1, pdv: 'PDV1' },
          { id: 2, dateTransaction: '2000-01-01', heureTransaction: '11:00', montant: 50, devise: 'MAD', statut: 'ACCEPTE', typePaiement: 'CB', tpe: 'TPE2', pdvId: 2, pdv: 'PDV2' }
        ] as never
      })
    );
    render(<CommercantTransactionsPage />);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Période' }), { target: { value: '7' } });
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.queryByText('#2')).toBeNull();
  });

  it('filtre par plage de dates (Du/Au)', () => {
    setSessionWithTransactions();
    render(<CommercantTransactionsPage />);
    fireEvent.change(screen.getByLabelText('Du'), { target: { value: '2026-07-02' } });
    expect(screen.queryByText('#1')).toBeNull();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('exporte les transactions filtrées en Excel', async () => {
    setSessionWithTransactions();
    render(<CommercantTransactionsPage />);
    fireEvent.change(screen.getByLabelText('Du'), { target: { value: '2026-07-02' } });

    fireEvent.click(screen.getByRole('button', { name: /Excel/ }));

    await screen.findByText('#2');
    expect(downloadExcelMock).toHaveBeenCalledTimes(1);
    const [fileName, sheetName, , rows] = downloadExcelMock.mock.calls[0];
    expect(fileName).toContain('2026-07-02');
    expect(sheetName).toBe('Transactions');
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(2);
  });

  it('désactive le bouton Excel quand aucun résultat', () => {
    setSessionWithTransactions();
    render(<CommercantTransactionsPage />);
    fireEvent.change(screen.getByPlaceholderText(/Rechercher/i), { target: { value: 'introuvable' } });
    expect(screen.getByRole('button', { name: /Excel/ })).toBeDisabled();
  });

  it('commercant combine en espace E-commerce : ne montre que les transactions e-commerce', () => {
    setCombinedSessionWithTransactions();
    useSessionStore.getState().setActiveAffiliationProfile('E_COMMERCE');
    render(<CommercantTransactionsPage />);
    expect(screen.queryByText('#1')).toBeNull();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('Sites e-commerce utilisés')).toBeInTheDocument();
    expect(screen.queryByText('PDV actifs')).toBeNull();
    expect(screen.queryByText('TPE utilisés')).toBeNull();
  });

  it('commercant combine en espace Encaissement : ne montre que les transactions TPE', () => {
    setCombinedSessionWithTransactions();
    useSessionStore.getState().setActiveAffiliationProfile('ENCAISSEMENT');
    render(<CommercantTransactionsPage />);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.queryByText('#2')).toBeNull();
    expect(screen.getByText('PDV actifs')).toBeInTheDocument();
    expect(screen.getByText('TPE utilisés')).toBeInTheDocument();
    expect(screen.queryByText('Sites e-commerce utilisés')).toBeNull();
  });
});
