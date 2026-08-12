import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import BackofficeReclamationHistoryPage from './BackofficeReclamationHistoryPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const getReclamationsMock = vi.fn();

vi.mock('../../services/reclamationsApi', () => ({
  getReclamations: (...args: unknown[]) => getReclamationsMock(...args)
}));

function item(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    idReclamation: 1, referenceChat: null, typeProbleme: 'MATERIEL', description: 'Panne', statut: 'RESOLU',
    priorite: 'HAUTE', dateCreation: '2026-07-01', dateResolution: '2026-07-02', commentaire: null, tpeId: null,
    tpeNumeroSerie: null, tpeModele: null, commercantId: null, commercantNom: 'ACME', region: null,
    typeAffiliation: null, backOfficeTraitant: null, backOfficeId: null, backOfficeUtilisateurId: null,
    dureeTraitementJours: 1, ...overrides
  };
}

beforeEach(() => {
  getReclamationsMock.mockReset();
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
  useSessionStore.getState().setSession(
    normalizeUserSessionResponse({ utilisateurId: 42, commercantId: 1, role: 'BACK_OFFICE' })
  );
});

describe('BackofficeReclamationHistoryPage', () => {
  it('fusionne les reclamations resolues et escaladees traitees par le back office connecte', async () => {
    getReclamationsMock.mockImplementation((params: { statut: string }) =>
      Promise.resolve(
        params.statut === 'RESOLU'
          ? [item({ idReclamation: 1, description: 'Panne resolue', backOfficeUtilisateurId: 42 })]
          : [item({ idReclamation: 2, description: 'Panne escaladee', statut: 'ESCALADE', backOfficeUtilisateurId: 42 })]
      )
    );

    render(<BackofficeReclamationHistoryPage />);

    expect(await screen.findByText('Panne resolue')).toBeInTheDocument();
    expect(screen.getByText('Panne escaladee')).toBeInTheDocument();
  });

  it("affiche un message d'erreur si le chargement echoue", async () => {
    getReclamationsMock.mockRejectedValue(new Error('503'));
    render(<BackofficeReclamationHistoryPage />);
    expect(await screen.findByText(/impossible/i)).toBeInTheDocument();
  });
});
