import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BackofficeProfilePage from './BackofficeProfilePage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

function renderPage() {
  return render(
    <MemoryRouter>
      <BackofficeProfilePage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('BackofficeProfilePage', () => {
  it('affiche l\'action "Dossiers a traiter" si peutValiderDossiers est vrai', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE', peutValiderDossiers: true, peutGererReclamations: false })
    );
    renderPage();
    expect(screen.getByText('Dossiers à traiter')).toBeInTheDocument();
    expect(screen.queryByText('Réclamations TPE')).toBeNull();
  });

  it('masque les deux actions restreintes si les deux permissions sont fausses', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'BACK_OFFICE', peutValiderDossiers: false, peutGererReclamations: false })
    );
    renderPage();
    expect(screen.queryByText('Dossiers à traiter')).toBeNull();
    expect(screen.queryByText('Réclamations TPE')).toBeNull();
    expect(screen.getByText('Réinitialiser le mot de passe')).toBeInTheDocument();
  });
});
