import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CommercantTpesPage from './CommercantTpesPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const assignTpeToPdvMock = vi.fn();

vi.mock('../../services/commercantApi', () => ({
  assignTpeToPdv: (...args: unknown[]) => assignTpeToPdvMock(...args)
}));

beforeEach(() => {
  assignTpeToPdvMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

function setSessionWithTpe() {
  useSessionStore.getState().setSession(
    normalizeUserSessionResponse({
      utilisateurId: 1,
      commercantId: 1,
      role: 'COMMERCANT',
      typeAffiliation: 'ENCAISSEMENT',
      tpes: [{ id: 1, numeroSerie: 'SN1', modele: 'M1', statut: 'ACTIF', typeConnexion: 'GPRS', pdvId: null, pdv: '' } as never],
      pdvs: [{ id: 9, nom: 'PDV Centre' } as never]
    })
  );
}

describe('CommercantTpesPage', () => {
  it("le bouton Affecter est desactive tant qu'aucun PDV n'est selectionne", () => {
    setSessionWithTpe();
    render(<CommercantTpesPage />);
    expect(screen.getByRole('button', { name: 'Affecter' })).toBeDisabled();
  });

  it('affecte le TPE au PDV selectionne et affiche le message de succes', async () => {
    setSessionWithTpe();
    assignTpeToPdvMock.mockResolvedValue({ tpeId: 1, pdvId: 9, message: 'TPE affecté avec succès' });

    render(<CommercantTpesPage />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Affecter' }));

    expect(await screen.findByText('TPE affecté avec succès')).toBeInTheDocument();
    expect(assignTpeToPdvMock).toHaveBeenCalledWith(1, 9);
  });

  it("affiche une erreur si l'affectation echoue", async () => {
    setSessionWithTpe();
    assignTpeToPdvMock.mockRejectedValue({ response: { data: { message: 'PDV invalide' } } });

    render(<CommercantTpesPage />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Affecter' }));

    expect(await screen.findByText('PDV invalide')).toBeInTheDocument();
  });

  it("masque le formulaire d'affectation pour un sous-commercant", () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1, commercantId: 1, role: 'SOUS_COMMERCANT', typeAffiliation: 'ENCAISSEMENT',
        tpes: [{ id: 1, numeroSerie: 'SN1', statut: 'ACTIF' } as never]
      })
    );
    render(<CommercantTpesPage />);
    expect(screen.queryByRole('button', { name: 'Affecter' })).toBeNull();
  });
});
