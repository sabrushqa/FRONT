import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommercialProfilePage from './CommercialProfilePage';
import { useSessionStore, normalizeUserSessionResponse } from '../../../../store/sessionStore';

function renderPage() {
  return render(
    <MemoryRouter>
      <CommercialProfilePage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('CommercialProfilePage', () => {
  it('calcule les initiales a partir du nom complet', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL', nom: 'Amine Alaoui', active: true })
    );
    renderPage();
    expect(screen.getByText('AA')).toBeInTheDocument();
  });

  it('affiche le statut Actif/Inactif selon la session', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL', active: false })
    );
    renderPage();
    expect(screen.getAllByText('Inactif').length).toBeGreaterThan(0);
  });

  it('pointe le lien "Mes dossiers" vers /commercial/dossiers pour un commercial', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCIAL', active: true })
    );
    renderPage();
    expect(screen.getByText('Mes dossiers').closest('a')).toHaveAttribute('href', '/commercial/dossiers');
  });

  it('pointe le lien "Mes dossiers" vers /supervisor/affiliation-requests pour un autre role', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR', active: true })
    );
    renderPage();
    expect(screen.getByText('Mes dossiers').closest('a')).toHaveAttribute('href', '/supervisor/affiliation-requests');
  });
});
