import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BackofficeReclamationHistoryPage from './BackofficeReclamationHistoryPage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

const getReclamationsMock = vi.fn();
const fetchReclamationPdfBlobMock = vi.fn();

vi.mock('../../services/reclamationsApi', () => ({
  getReclamations: (...args: unknown[]) => getReclamationsMock(...args),
  fetchReclamationPdfBlob: (...args: unknown[]) => fetchReclamationPdfBlobMock(...args)
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
  fetchReclamationPdfBlobMock.mockReset();
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

  it('filtre par statut final et par type de probleme', async () => {
    getReclamationsMock.mockImplementation((params: { statut: string }) =>
      Promise.resolve(
        params.statut === 'RESOLU'
          ? [item({ idReclamation: 1, description: 'Panne resolue', typeProbleme: 'MATERIEL', backOfficeUtilisateurId: 42 })]
          : [item({ idReclamation: 2, description: 'Panne escaladee', statut: 'ESCALADE', typeProbleme: 'RESEAU', backOfficeUtilisateurId: 42 })]
      )
    );

    render(<BackofficeReclamationHistoryPage />);
    await screen.findByText('Panne resolue');

    fireEvent.change(screen.getByRole('combobox', { name: /Statut final/ }), { target: { value: 'ESCALADE' } });
    expect(screen.queryByText('Panne resolue')).toBeNull();
    expect(screen.getByText('Panne escaladee')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: /Statut final/ }), { target: { value: 'all' } });
    fireEvent.change(screen.getByRole('combobox', { name: /^Type/ }), { target: { value: 'RESEAU' } });
    expect(screen.queryByText('Panne resolue')).toBeNull();
    expect(screen.getByText('Panne escaladee')).toBeInTheDocument();
  });

  it('ouvre la fiche PDF au clic sur "Voir / Imprimer"', async () => {
    getReclamationsMock.mockImplementation((params: { statut: string }) =>
      Promise.resolve(
        params.statut === 'RESOLU'
          ? [item({ idReclamation: 1, description: 'Panne resolue', backOfficeUtilisateurId: 42 })]
          : []
      )
    );
    fetchReclamationPdfBlobMock.mockResolvedValue(new Blob(['pdf']));
    const fakeTab = { close: vi.fn(), location: { href: '' } };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeTab as unknown as Window);

    render(<BackofficeReclamationHistoryPage />);
    await screen.findByText('Panne resolue');

    fireEvent.click(screen.getByRole('button', { name: 'Voir / Imprimer' }));

    await waitFor(() => expect(fetchReclamationPdfBlobMock).toHaveBeenCalledWith(1));
    expect(screen.queryByText(/Impossible d'ouvrir la fiche PDF/)).toBeNull();
    openSpy.mockRestore();
  });

  it("affiche une erreur si l'ouverture de la fiche PDF echoue", async () => {
    getReclamationsMock.mockImplementation((params: { statut: string }) =>
      Promise.resolve(
        params.statut === 'RESOLU'
          ? [item({ idReclamation: 1, description: 'Panne resolue', backOfficeUtilisateurId: 42 })]
          : []
      )
    );
    fetchReclamationPdfBlobMock.mockRejectedValue(new Error('503'));
    const fakeTab = { close: vi.fn(), location: { href: '' } };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeTab as unknown as Window);

    render(<BackofficeReclamationHistoryPage />);
    await screen.findByText('Panne resolue');

    fireEvent.click(screen.getByRole('button', { name: 'Voir / Imprimer' }));

    expect(await screen.findByText("Impossible d'ouvrir la fiche PDF de la réclamation #1.")).toBeInTheDocument();
    expect(fakeTab.close).toHaveBeenCalled();
    openSpy.mockRestore();
  });
});
