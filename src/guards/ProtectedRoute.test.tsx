import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { useSessionStore, normalizeUserSessionResponse } from '../store/sessionStore';

function renderProtected(props: { roles?: string[]; commercant?: boolean } = {}) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute {...props}>
              <p>contenu protege</p>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<p>page login</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    useSessionStore.getState().clearSession();
  });

  it('redirige vers /login quand il n\'y a ni session ni token', () => {
    renderProtected();
    expect(screen.getByText('page login')).toBeInTheDocument();
  });

  it('affiche les enfants quand une session existe sans contrainte de role', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT' })
    );

    renderProtected();
    expect(screen.getByText('contenu protege')).toBeInTheDocument();
  });

  it('redirige vers /login si le role de la session n\'est pas autorise', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT' })
    );

    renderProtected({ roles: ['SUPERVISEUR'] });
    expect(screen.getByText('page login')).toBeInTheDocument();
  });

  it('affiche les enfants si le role de la session est autorise', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );

    renderProtected({ roles: ['SUPERVISEUR', 'BACK_OFFICE'] });
    expect(screen.getByText('contenu protege')).toBeInTheDocument();
  });

  it('redirige vers /login si commercant est requis mais le role differe', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR' })
    );

    renderProtected({ commercant: true });
    expect(screen.getByText('page login')).toBeInTheDocument();
  });

  it('affiche les enfants si commercant est requis et le role correspond', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'COMMERCANT' })
    );

    renderProtected({ commercant: true });
    expect(screen.getByText('contenu protege')).toBeInTheDocument();
  });
});
