import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useSessionStore,
  getSessionStore,
  normalizeUserSessionResponse,
  useEffectiveAffiliationType
} from './sessionStore';

function resetStore() {
  window.sessionStorage.clear();
  window.localStorage.clear();
  useSessionStore.getState().clearSession();
  useSessionStore.setState({ activeAffiliationProfile: 'ENCAISSEMENT' });
}

describe('normalizeUserSessionResponse', () => {
  it('applique les valeurs par defaut manquantes', () => {
    const result = normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 2 });

    expect(result.role).toBe('');
    expect(result.active).toBe(true);
    expect(result.summary).toEqual({
      totalTransactions: 0,
      totalPdvs: 0,
      totalTpes: 0,
      totalSousCommercants: 0
    });
    expect(result.sousCommercants).toEqual([]);
    expect(result.pdvs).toEqual([]);
  });

  it('deverrouille le workspace par defaut pour un role non-commercant', () => {
    const result = normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 2, role: 'SUPERVISEUR' });
    expect(result.workspaceUnlocked).toBe(true);
  });

  it('verrouille le workspace par defaut pour un commercant', () => {
    const result = normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 2, role: 'COMMERCANT' });
    expect(result.workspaceUnlocked).toBe(false);
  });

  it('deduit le tokenType a Bearer quand un accessToken est fourni', () => {
    const result = normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 2, accessToken: 'abc' });
    expect(result.tokenType).toBe('Bearer');
  });
});

describe('useSessionStore', () => {
  beforeEach(resetStore);

  it("n'a pas de session par defaut apres nettoyage", () => {
    expect(useSessionStore.getState().session).toBeNull();
  });

  it('setSession stocke la session en sessionStorage sans le token', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({
        utilisateurId: 1,
        commercantId: 2,
        role: 'COMMERCANT',
        accessToken: 'tok-123',
        refreshToken: 'ref-456'
      })
    );

    const state = useSessionStore.getState();
    expect(state.session?.role).toBe('COMMERCANT');
    expect(state.getAccessToken()).toBe('tok-123');
    expect(state.getRefreshToken()).toBe('ref-456');

    const stored = JSON.parse(window.sessionStorage.getItem('userSession')!);
    expect(stored.accessToken).toBeNull();
  });

  it('setSession conserve le token existant si le nouveau payload n\'en fournit pas', () => {
    const store = useSessionStore.getState();
    store.setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 2, role: 'COMMERCANT', accessToken: 'tok-first' })
    );
    store.setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 2, role: 'COMMERCANT', nom: 'Updated' })
    );

    expect(useSessionStore.getState().getAccessToken()).toBe('tok-first');
    expect(useSessionStore.getState().session?.nom).toBe('Updated');
  });

  it('clearSession supprime la session et les tokens', () => {
    const store = useSessionStore.getState();
    store.setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 2, role: 'COMMERCANT', accessToken: 'tok' })
    );
    store.clearSession();

    expect(useSessionStore.getState().session).toBeNull();
    expect(useSessionStore.getState().getAccessToken()).toBe('');
    expect(window.sessionStorage.getItem('userSession')).toBeNull();
  });

  it('updateTokens met a jour le token et la date d\'expiration de la session', () => {
    const store = useSessionStore.getState();
    store.setSession(normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 2, role: 'COMMERCANT' }));
    store.updateTokens('new-access', 'new-refresh', '2026-01-01T00:00:00Z');

    expect(useSessionStore.getState().getAccessToken()).toBe('new-access');
    expect(useSessionStore.getState().getRefreshToken()).toBe('new-refresh');
    expect(useSessionStore.getState().session?.tokenExpiresAt).toBe('2026-01-01T00:00:00Z');
  });

  it.each([
    ['SUPERVISEUR', true],
    ['BACK_OFFICE', true],
    ['COMMERCIAL', true],
    ['COMMERCANT', false]
  ])('isSupervisorWorkspaceSession retourne %s pour le role %s', (role, expected) => {
    const session = normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 2, role });
    expect(useSessionStore.getState().isSupervisorWorkspaceSession(session)).toBe(expected);
  });

  it.each([
    ['COMMERCIAL', '/commercial'],
    ['BACK_OFFICE', '/backoffice'],
    ['SUPERVISEUR', '/supervisor']
  ])('resolveWorkspaceBaseRoute retourne %s pour le role %s', (role, expectedRoute) => {
    const session = normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 2, role });
    expect(useSessionStore.getState().resolveWorkspaceBaseRoute(session)).toBe(expectedRoute);
  });

  it('resolveDashboardRoute redirige un commercant vers etat-dossier', () => {
    const session = normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 2, role: 'COMMERCANT' });
    expect(useSessionStore.getState().resolveDashboardRoute(session)).toBe('/commercant/etat-dossier');
  });

  it('resolveDashboardRoute redirige un superviseur vers overview', () => {
    const session = normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 2, role: 'SUPERVISEUR' });
    expect(useSessionStore.getState().resolveDashboardRoute(session)).toBe('/supervisor/overview');
  });

  it('getSessionStore expose les memes methodes stables que le hook', () => {
    expect(getSessionStore().setSession).toBe(useSessionStore.getState().setSession);
    expect(getSessionStore().clearSession).toBe(useSessionStore.getState().clearSession);
  });
});

describe('useEffectiveAffiliationType', () => {
  beforeEach(resetStore);

  it('renvoie directement le type quand il n\'est pas combine', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 2, typeAffiliation: 'E_COMMERCE' })
    );

    const { result } = renderHook(() => useEffectiveAffiliationType());
    expect(result.current).toBe('E_COMMERCE');
  });

  it('suit le profil actif pour un type combine', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 2, typeAffiliation: 'ENCAISSEMENT_ET_ECOMMERCE' })
    );

    const { result } = renderHook(() => useEffectiveAffiliationType());
    expect(result.current).toBe('ENCAISSEMENT');

    act(() => {
      useSessionStore.getState().setActiveAffiliationProfile('E_COMMERCE');
    });

    const { result: result2 } = renderHook(() => useEffectiveAffiliationType());
    expect(result2.current).toBe('E_COMMERCE');
  });
});
