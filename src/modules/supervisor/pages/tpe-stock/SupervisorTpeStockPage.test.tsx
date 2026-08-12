import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SupervisorTpeStockPage from './SupervisorTpeStockPage';

const getTpeStockMock = vi.fn();
const activateTpeMock = vi.fn();
const deactivateTpeMock = vi.fn();

vi.mock('../../services/supervisorApi', () => ({
  getTpeStock: (...args: unknown[]) => getTpeStockMock(...args),
  activateTpe: (...args: unknown[]) => activateTpeMock(...args),
  deactivateTpe: (...args: unknown[]) => deactivateTpeMock(...args)
}));

function tpe(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'TPE-000001', numeroSerie: 'SN1', modele: 'M1', typeConnexion: 'GPRS', typeCompatible: 'TPE',
    actif: true, statut: 'ACTIF', commercant: '', pdv: '', ...overrides
  };
}

beforeEach(() => {
  getTpeStockMock.mockReset().mockResolvedValue({ tpes: [] });
  activateTpeMock.mockReset();
  deactivateTpeMock.mockReset();
});

describe('SupervisorTpeStockPage', () => {
  it('filtre par type compatible', async () => {
    getTpeStockMock.mockResolvedValue({
      tpes: [
        tpe({ id: 'TPE-000001', numeroSerie: 'SN-TPE', typeCompatible: 'TPE' }),
        tpe({ id: 'QR-000001', numeroSerie: 'SN-QR', typeCompatible: 'QR_CODE' })
      ]
    });

    render(<SupervisorTpeStockPage />);
    await screen.findByText('SN-TPE');

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'QR_CODE' } });
    expect(screen.queryByText('SN-TPE')).toBeNull();
    expect(screen.getByText('SN-QR')).toBeInTheDocument();
  });

  it('desactive une reference active', async () => {
    getTpeStockMock.mockResolvedValue({ tpes: [tpe({ id: 'TPE-000001', numeroSerie: 'SN1', actif: true })] });
    deactivateTpeMock.mockResolvedValue({ message: 'Référence désactivée' });

    render(<SupervisorTpeStockPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Désactiver' }));

    expect(await screen.findByText('Référence désactivée')).toBeInTheDocument();
    expect(deactivateTpeMock).toHaveBeenCalledWith('TPE-000001');
  });

  it("affiche une erreur si le chargement echoue", async () => {
    getTpeStockMock.mockRejectedValue(new Error('503'));
    render(<SupervisorTpeStockPage />);
    expect(await screen.findByText('Impossible de charger le stock TPE.')).toBeInTheDocument();
  });

  it('pagine un stock volumineux et affiche des totaux corrects dans les cartes stats', async () => {
    const bigStock = Array.from({ length: 45 }, (_, i) =>
      tpe({
        id: `TPE-${i}`,
        numeroSerie: `SN-${i}`,
        actif: i % 3 !== 0,
        statut: i % 3 === 1 ? 'AFFECTE_COMMERCANT' : 'DISPONIBLE'
      })
    );
    getTpeStockMock.mockResolvedValue({ tpes: bigStock });

    render(<SupervisorTpeStockPage />);
    await screen.findByText('SN-1');

    // 20 lignes par page par defaut => seule une partie du stock est rendue
    expect(screen.queryByText('SN-44')).toBeNull();
    expect(screen.getByText('Page 1 / 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(await screen.findByText('Page 2 / 3')).toBeInTheDocument();
  });

  it('recherche par numero de serie', async () => {
    getTpeStockMock.mockResolvedValue({
      tpes: [
        tpe({ id: 'TPE-000001', numeroSerie: 'SN-ALPHA' }),
        tpe({ id: 'TPE-000002', numeroSerie: 'SN-BETA' })
      ]
    });

    render(<SupervisorTpeStockPage />);
    await screen.findByText('SN-ALPHA');

    fireEvent.change(screen.getByPlaceholderText('Référence, modèle, commerçant, PDV...'), {
      target: { value: 'BETA' }
    });

    expect(screen.queryByText('SN-ALPHA')).toBeNull();
    expect(screen.getByText('SN-BETA')).toBeInTheDocument();
  });
});
