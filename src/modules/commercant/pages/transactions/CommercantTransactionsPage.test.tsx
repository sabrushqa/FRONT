import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CommercantTransactionsPage from './CommercantTransactionsPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const downloadExcelMock = vi.fn();
const downloadTransactionTicketMock = vi.fn();
const triggerBlobDownloadMock = vi.fn();

vi.mock('../../../../core/excelExport', () => ({
  downloadExcel: (...args: unknown[]) => downloadExcelMock(...args)
}));

vi.mock('../../services/commercantApi', () => ({
  downloadTransactionTicket: (...args: unknown[]) => downloadTransactionTicketMock(...args)
}));

vi.mock('../../../../core/browserDownload', () => ({
  triggerBlobDownload: (...args: unknown[]) => triggerBlobDownloadMock(...args)
}));

beforeEach(() => {
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
  useSessionStore.getState().setActiveAffiliationProfile('ENCAISSEMENT');
  downloadExcelMock.mockReset().mockImplementation(
    async (_fileName: string, _sheet: string, columns: Array<{ value: (row: unknown) => unknown }>, rows: unknown[]) => {
      // Execute chaque callback de colonne (comme le ferait le vrai downloadExcel
      // en construisant les lignes du classeur) pour couvrir ces fonctions.
      rows.forEach((row) => columns.forEach((col) => col.value(row)));
    }
  );
  downloadTransactionTicketMock.mockReset();
  triggerBlobDownloadMock.mockReset();
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

  it('telecharge le ticket de transaction pour une transaction approuvee', async () => {
    setSessionWithTransactions();
    const blob = new Blob(['pdf']);
    downloadTransactionTicketMock.mockResolvedValue(blob);

    render(<CommercantTransactionsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Ticket/ }));

    await waitFor(() => expect(downloadTransactionTicketMock).toHaveBeenCalledWith(1));
    expect(triggerBlobDownloadMock).toHaveBeenCalledWith(blob, 'ticket-1.pdf');
    expect(screen.queryByText('Téléchargement du ticket impossible.')).toBeNull();
  });

  it('affiche une erreur si le telechargement du ticket echoue', async () => {
    setSessionWithTransactions();
    downloadTransactionTicketMock.mockRejectedValue(new Error('503'));

    render(<CommercantTransactionsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Ticket/ }));

    expect(await screen.findByText('Téléchargement du ticket impossible.')).toBeInTheDocument();
  });

  it("affiche une erreur si l'export Excel echoue", async () => {
    setSessionWithTransactions();
    downloadExcelMock.mockRejectedValue(new Error('503'));

    render(<CommercantTransactionsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Excel/ }));

    expect(await screen.findByText('Export Excel impossible.')).toBeInTheDocument();
  });

  it('filtre par canal quand plusieurs canaux sont presents, filtre par plage "Au" et efface les dates', () => {
    // Compte non combine, mais dont les transactions couvrent deux canaux —
    // cas limite ou le filtre Canal doit malgre tout s'afficher (showCanalFilter).
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 1,
        role: 'COMMERCANT',
        transactions: [
          { id: 1, canal: 'TPE', dateTransaction: '2026-07-01', heureTransaction: '10:00', montant: 100, devise: 'MAD', statut: 'ACCEPTE', typePaiement: 'CB', tpe: 'TPE1', pdvId: 1, pdv: 'PDV1' },
          { id: 2, canal: 'ECOMMERCE', dateTransaction: '2026-07-02', heureTransaction: '11:00', montant: 50, devise: 'MAD', statut: 'ACCEPTE', typePaiement: 'CB', tpe: 'boutique.ma', pdvId: null, pdv: '' }
        ] as never
      })
    );
    render(<CommercantTransactionsPage />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Canal' }), { target: { value: 'TPE' } });
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.queryByText('#2')).toBeNull();

    fireEvent.change(screen.getByRole('combobox', { name: 'Canal' }), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Au'), { target: { value: '2026-07-01' } });
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.queryByText('#2')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Effacer les dates' }));
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('pagine la liste des transactions avec plus de 20 resultats', async () => {
    const transactions = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1, dateTransaction: '2026-07-01', heureTransaction: '10:00', montant: 10, devise: 'MAD',
      statut: 'ACCEPTE', typePaiement: 'CB', tpe: 'TPE1', pdvId: 1, pdv: 'PDV1'
    }));
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', transactions: transactions as never })
    );

    render(<CommercantTransactionsPage />);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.queryByText('#21')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '›' }));
    expect(await screen.findByText('#21')).toBeInTheDocument();
  });
});
