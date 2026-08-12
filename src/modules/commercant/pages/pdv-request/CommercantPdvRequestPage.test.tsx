import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommercantPdvRequestPage from './CommercantPdvRequestPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const requestNewPdvProductMock = vi.fn();

vi.mock('../../services/commercantApi', () => ({
  requestNewPdvProduct: (...args: unknown[]) => requestNewPdvProductMock(...args)
}));

vi.mock('../../../../core/components/QuartierCombobox', () => ({
  default: () => <div data-testid="quartier-combobox" />
}));

vi.mock('../../../../core/components/PdvLocationPicker', () => ({
  default: () => <div data-testid="pdv-location-picker" />
}));

beforeEach(() => {
  requestNewPdvProductMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('CommercantPdvRequestPage', () => {
  it('bloque la soumission si des champs obligatoires manquent (TPE)', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'ENCAISSEMENT' })
    );
    render(<CommercantPdvRequestPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Soumettre la demande' }));

    expect(screen.getAllByText(/Veuillez remplir/).length).toBeGreaterThan(0);
    expect(requestNewPdvProductMock).not.toHaveBeenCalled();
  });

  it('affiche un avertissement d\'acces restreint pour un sous-commercant', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SOUS_COMMERCANT', typeAffiliation: 'ENCAISSEMENT' })
    );
    render(<CommercantPdvRequestPage />);

    expect(screen.getByText('Cette page est disponible uniquement pour le compte commerçant principal.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Soumettre la demande' })).toBeNull();
  });

  it('soumet une demande e-commerce valide sans champs PDV physiques', async () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT', typeAffiliation: 'E_COMMERCE' })
    );
    requestNewPdvProductMock.mockResolvedValue({ message: 'Demande envoyée avec succès' });

    render(<CommercantPdvRequestPage />);
    fireEvent.change(screen.getByLabelText(/Mode service/i), { target: { value: 'SiteMarchand' } });
    fireEvent.change(screen.getByLabelText(/Site marchand/i), { target: { value: 'https://boutique.ma' } });
    fireEvent.click(screen.getByRole('button', { name: 'Soumettre la demande' }));

    expect(await screen.findByText('Demande envoyée avec succès')).toBeInTheDocument();
  });
});
