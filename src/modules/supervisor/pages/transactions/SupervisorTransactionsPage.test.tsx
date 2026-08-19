import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SupervisorTransactionsPage from './SupervisorTransactionsPage';

function recentDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

const getOverviewMock = vi.fn();
const getCommercantTransactionsMock = vi.fn();
const downloadCommercantTicketMock = vi.fn();
const downloadExcelMock = vi.fn();

vi.mock('../../services/supervisorApi', () => ({
  getOverview: (...args: unknown[]) => getOverviewMock(...args),
  getCommercantTransactions: (...args: unknown[]) => getCommercantTransactionsMock(...args),
  downloadCommercantTicket: (...args: unknown[]) => downloadCommercantTicketMock(...args)
}));

vi.mock('../../../../core/excelExport', () => ({
  downloadExcel: (...args: unknown[]) => downloadExcelMock(...args)
}));

beforeEach(() => {
  getOverviewMock.mockReset().mockResolvedValue({
    backOffices: [],
    commerciales: [],
    commercants: [
      { id: 1, utilisateurId: 1, nom: 'ACME', email: '', typeCommercant: '', typeAffiliation: 'ENCAISSEMENT', activite: '', ville: 'Casablanca', region: '', telephone: '', active: true, dateCreation: null, dateActivation: null }
    ]
  });
  getCommercantTransactionsMock.mockReset().mockResolvedValue({
    commercantId: 1,
    commercantNom: 'ACME',
    // Dans la fenêtre "30 derniers jours" (preset par défaut) par rapport à
    // AUJOURD'HUI (pas une date fixe) — sinon le preset masque silencieusement
    // les transactions de test des que la vraie date depasse la fenetre.
    transactions: [
      { id: '1', canal: 'TPE', dateTransaction: recentDate(2), heureTransaction: '10:00', montant: 100, devise: 'MAD', statut: 'APPROVED', typePaiement: 'CB', tpe: 'TPE1', pdvId: 1, pdv: 'PDV1' },
      { id: '2', canal: 'TPE', dateTransaction: recentDate(1), heureTransaction: '11:00', montant: 50, devise: 'MAD', statut: 'DECLINED', typePaiement: 'CB', tpe: 'TPE2', pdvId: 2, pdv: 'PDV2' }
    ]
  });
  downloadCommercantTicketMock.mockReset();
  downloadExcelMock.mockReset().mockResolvedValue(undefined);
});

describe('SupervisorTransactionsPage', () => {
  it('filtre par plage de dates (Du/Au), prioritaire sur le preset Période', async () => {
    render(<SupervisorTransactionsPage />);
    await screen.findByText('#1');

    fireEvent.change(screen.getByLabelText('Du'), { target: { value: recentDate(1) } });

    await waitFor(() => expect(screen.queryByText('#1')).toBeNull());
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('désactive le select Période quand une plage de dates est active', async () => {
    render(<SupervisorTransactionsPage />);
    await screen.findByText('#1');

    fireEvent.change(screen.getByLabelText('Du'), { target: { value: recentDate(1) } });

    expect(screen.getByLabelText('Période')).toBeDisabled();
  });

  it('exporte les transactions filtrées en Excel avec le nom du commerçant', async () => {
    render(<SupervisorTransactionsPage />);
    await screen.findByText('#1');

    fireEvent.click(screen.getByRole('button', { name: 'Télécharger Excel' }));

    await waitFor(() => expect(downloadExcelMock).toHaveBeenCalledTimes(1));
    const [fileName, sheetName, , rows] = downloadExcelMock.mock.calls[0];
    expect(fileName).toContain('acme');
    expect(sheetName).toBe('Transactions');
    expect(rows).toHaveLength(2);
  });

  it('Réinitialiser efface aussi la plage de dates', async () => {
    render(<SupervisorTransactionsPage />);
    await screen.findByText('#1');

    fireEvent.change(screen.getByLabelText('Du'), { target: { value: recentDate(1) } });
    await waitFor(() => expect(screen.queryByText('#1')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));

    expect(await screen.findByText('#1')).toBeInTheDocument();
    expect((screen.getByLabelText('Du') as HTMLInputElement).value).toBe('');
  });

  it('telecharge le ticket de transaction (disponible uniquement pour une transaction approuvee)', async () => {
    const blob = new Blob(['pdf']);
    downloadCommercantTicketMock.mockResolvedValue(blob);

    render(<SupervisorTransactionsPage />);
    await screen.findByText('#1');

    // Seule la transaction #1 est APPROVED : #2 (DECLINED) n'a pas de bouton Ticket.
    fireEvent.click(screen.getByRole('button', { name: /Ticket/ }));
    await waitFor(() => expect(downloadCommercantTicketMock).toHaveBeenCalledWith(1, '1'));
    expect(screen.queryByText('Téléchargement du ticket impossible.')).toBeNull();
  });

  it('affiche une erreur si le telechargement du ticket echoue', async () => {
    downloadCommercantTicketMock.mockRejectedValue(new Error('503'));

    render(<SupervisorTransactionsPage />);
    await screen.findByText('#1');

    fireEvent.click(screen.getByRole('button', { name: /Ticket/ }));

    expect(await screen.findByText('Téléchargement du ticket impossible.')).toBeInTheDocument();
  });

  it("affiche une erreur si l'export Excel echoue", async () => {
    downloadExcelMock.mockRejectedValue(new Error('503'));

    render(<SupervisorTransactionsPage />);
    await screen.findByText('#1');

    fireEvent.click(screen.getByRole('button', { name: 'Télécharger Excel' }));

    expect(await screen.findByText('Export Excel impossible.')).toBeInTheDocument();
  });

  it('filtre par recherche texte et par statut', async () => {
    render(<SupervisorTransactionsPage />);
    await screen.findByText('#1');

    fireEvent.change(screen.getByPlaceholderText('ID, PDV, TPE, type…'), { target: { value: 'TPE1' } });
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.queryByText('#2')).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('ID, PDV, TPE, type…'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'Refusée' } });
    expect(screen.queryByText('#1')).toBeNull();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('filtre par TPE et par point de vente', async () => {
    render(<SupervisorTransactionsPage />);
    await screen.findByText('#1');

    fireEvent.change(screen.getByLabelText('TPE'), { target: { value: 'TPE1' } });
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.queryByText('#2')).toBeNull();

    fireEvent.change(screen.getByLabelText('TPE'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Point de vente'), { target: { value: 'PDV2' } });
    expect(screen.queryByText('#1')).toBeNull();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it("affiche une erreur si le chargement des commercants echoue", async () => {
    getOverviewMock.mockRejectedValue(new Error('503'));

    render(<SupervisorTransactionsPage />);

    expect(await screen.findByText('Impossible de charger la liste des commerçants.')).toBeInTheDocument();
  });

  it("affiche une erreur si le chargement des transactions echoue", async () => {
    getCommercantTransactionsMock.mockRejectedValue(new Error('503'));

    render(<SupervisorTransactionsPage />);

    expect(await screen.findByText('Impossible de charger les transactions de ce commerçant.')).toBeInTheDocument();
  });

  it('change la taille de page', async () => {
    render(<SupervisorTransactionsPage />);
    await screen.findByText('#1');

    fireEvent.click(screen.getByRole('button', { name: '40' }));

    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });
});
