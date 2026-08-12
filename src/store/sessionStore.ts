import { create } from 'zustand';

export interface UserSessionResponse {
  utilisateurId: number;
  commercantId: number;
  email: string;
  nom: string;
  role: string;
  active: boolean;
  dossierStatus?: string;
  workspaceUnlocked?: boolean;
  dossierMotifRefus?: string;
  typeCommercant: string;
  typeAffiliation: string;
  message: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenType?: string | null;
  tokenExpiresAt?: string | null;
  summary: {
    totalTransactions: number;
    totalPdvs: number;
    totalTpes: number;
    totalSousCommercants: number;
  };
  profile: {
    nom: string;
    email: string;
    telephone: string;
    ville: string;
    region: string;
    activite: string;
    typeCommercant: string;
    typeAffiliation: string;
    siteMarchandUrl: string;
    applicationMobile: string;
    modeServiceEcommerce: string;
  };
  sousCommercants: Array<{
    id: number;
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
    statut: string;
    active: boolean | null;
    pdvId: number | null;
    pdv: string;
    canalEcommerce: string;
  }>;
  pdvs: Array<{
    id: number;
    nom: string;
    ville: string;
    adresse: string;
    telephone: string;
    statut: string;
    email: string;
    codePostal: string;
    dateCreation: string;
    sousCommercantId: number | null;
    sousCommercant: string;
    sousCommercantEmail: string;
    sousCommercantStatut: string;
    sousCommercantActive: boolean | null;
  }>;
  tpes: Array<{
    id: string;
    numeroSerie: string;
    modele: string;
    statut: string;
    typeConnexion: string;
    pdvId: number | null;
    pdv: string;
  }>;
  transactions: Array<{
    id: number;
    dateTransaction: string;
    heureTransaction: string;
    montant: number | null;
    devise: string;
    statut: string;
    typePaiement: string;
    tpe: string;
    pdvId: number | null;
    pdv: string;
  }>;
  peutValiderDossiers?: boolean | null;
  peutAffecterTpe?: boolean | null;
  peutGererReclamations?: boolean | null;
}

const DEFAULT_SUMMARY: UserSessionResponse['summary'] = {
  totalTransactions: 0,
  totalPdvs: 0,
  totalTpes: 0,
  totalSousCommercants: 0
};

const DEFAULT_PROFILE: UserSessionResponse['profile'] = {
  nom: '-',
  email: '-',
  telephone: '-',
  ville: '-',
  region: '-',
  activite: '-',
  typeCommercant: 'COMMERCANT',
  typeAffiliation: 'STANDARD',
  siteMarchandUrl: '',
  applicationMobile: '',
  modeServiceEcommerce: ''
};

export function normalizeUserSessionResponse(
  session: Partial<UserSessionResponse> & Pick<UserSessionResponse, 'utilisateurId' | 'commercantId'>
): UserSessionResponse {
  const profile = { ...DEFAULT_PROFILE, ...(session.profile ?? {}) };
  return {
    utilisateurId: session.utilisateurId,
    commercantId: session.commercantId,
    email: session.email ?? profile.email,
    nom: session.nom ?? profile.nom,
    role: session.role ?? '',
    active: session.active ?? true,
    dossierStatus: session.dossierStatus ?? '',
    workspaceUnlocked:
      session.workspaceUnlocked ?? (session.role ? session.role !== 'COMMERCANT' : false),
    dossierMotifRefus: session.dossierMotifRefus ?? '',
    typeCommercant: session.typeCommercant ?? profile.typeCommercant,
    typeAffiliation: session.typeAffiliation ?? profile.typeAffiliation,
    message: session.message ?? '',
    accessToken: session.accessToken ?? null,
    refreshToken: session.refreshToken ?? null,
    tokenType: session.tokenType ?? (session.accessToken ? 'Bearer' : null),
    tokenExpiresAt: session.tokenExpiresAt ?? null,
    summary: { ...DEFAULT_SUMMARY, ...(session.summary ?? {}) },
    profile: {
      ...profile,
      nom: profile.nom || session.nom || '-',
      email: profile.email || session.email || '-',
      typeCommercant: profile.typeCommercant || session.typeCommercant || 'COMMERCANT',
      typeAffiliation: profile.typeAffiliation || session.typeAffiliation || 'STANDARD'
    },
    sousCommercants: Array.isArray(session.sousCommercants) ? session.sousCommercants : [],
    pdvs: Array.isArray(session.pdvs) ? session.pdvs : [],
    tpes: Array.isArray(session.tpes) ? session.tpes : [],
    transactions: Array.isArray(session.transactions) ? session.transactions : [],
    peutValiderDossiers: session.peutValiderDossiers ?? true,
    peutAffecterTpe: session.peutAffecterTpe ?? true,
    peutGererReclamations: session.peutGererReclamations ?? true
  };
}

const STORAGE_KEY = 'userSession';
const TOKEN_KEY = 'userAccessToken';
const REFRESH_KEY = 'userRefreshToken';
const SUPERVISOR_ROLES = new Set(['SUPERVISEUR', 'BACK_OFFICE', 'COMMERCIAL']);

// Un commercant avec l'affiliation combinee ENCAISSEMENT_ET_ECOMMERCE a deux
// "profils" dans son espace commercant (encaissement / e-commerce), bascules
// via un menu deroulant. Pour tout autre type d'affiliation, ce profil n'a
// aucun effet : useEffectiveAffiliationType() renvoie directement le type reel.
export type AffiliationProfile = 'ENCAISSEMENT' | 'E_COMMERCE';

interface SessionState {
  session: UserSessionResponse | null;
  setSession: (s: UserSessionResponse) => void;
  clearSession: () => void;
  getAccessToken: () => string;
  getRefreshToken: () => string;
  updateTokens: (accessToken: string, refreshToken: string, tokenExpiresAt: string) => void;
  isSupervisorWorkspaceSession: (s?: UserSessionResponse | null) => boolean;
  resolveWorkspaceBaseRoute: (s?: UserSessionResponse | null) => '/supervisor' | '/commercial' | '/backoffice';
  resolveDashboardRoute: (s?: UserSessionResponse | null) => string;
  activeAffiliationProfile: AffiliationProfile;
  setActiveAffiliationProfile: (profile: AffiliationProfile) => void;
}

function readStoredSession(): UserSessionResponse | null {
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return normalizeUserSessionResponse(JSON.parse(raw) as UserSessionResponse);
  } catch {
    return null;
  }
}

export const useSessionStore = create<SessionState>((set, get) => {
  const store: SessionState = {
    session: readStoredSession(),

    setSession(incoming: UserSessionResponse) {
      const existing = get().session;
      const existingToken = get().getAccessToken();
      const existingRefreshToken = get().getRefreshToken();
      const accessToken = incoming.accessToken ?? existingToken;
      const refreshToken = incoming.refreshToken ?? existingRefreshToken;

      const merged = normalizeUserSessionResponse(
        accessToken
          ? {
              ...(existing ?? ({} as UserSessionResponse)),
              ...incoming,
              accessToken: null,
              refreshToken: null,
              tokenType: incoming.tokenType ?? existing?.tokenType ?? 'Bearer',
              tokenExpiresAt: incoming.tokenExpiresAt ?? existing?.tokenExpiresAt ?? null
            }
          : incoming
      );

      window.sessionStorage.removeItem(STORAGE_KEY);
      window.sessionStorage.removeItem(TOKEN_KEY);
      window.sessionStorage.removeItem(REFRESH_KEY);
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(REFRESH_KEY);

      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      if (accessToken) window.sessionStorage.setItem(TOKEN_KEY, accessToken);
      if (refreshToken) window.sessionStorage.setItem(REFRESH_KEY, refreshToken);

      set({ session: merged });
    },

    clearSession() {
      window.sessionStorage.removeItem(STORAGE_KEY);
      window.sessionStorage.removeItem(TOKEN_KEY);
      window.sessionStorage.removeItem(REFRESH_KEY);
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(REFRESH_KEY);
      set({ session: null });
    },

    getAccessToken() {
      return window.sessionStorage.getItem(TOKEN_KEY) ?? '';
    },

    getRefreshToken() {
      return window.sessionStorage.getItem(REFRESH_KEY) ?? '';
    },

    updateTokens(accessToken: string, refreshToken: string, tokenExpiresAt: string) {
      window.sessionStorage.setItem(TOKEN_KEY, accessToken);
      if (refreshToken) window.sessionStorage.setItem(REFRESH_KEY, refreshToken);

      const current = get().session;
      if (!current) return;
      const updated = { ...current, tokenExpiresAt };
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      set({ session: updated });
    },

    isSupervisorWorkspaceSession(s?: UserSessionResponse | null) {
      const resolved = s ?? get().session;
      return !!resolved?.role && SUPERVISOR_ROLES.has(resolved.role);
    },

    resolveWorkspaceBaseRoute(s?: UserSessionResponse | null) {
      const resolved = s ?? get().session;
      if (resolved?.role === 'COMMERCIAL') return '/commercial';
      if (resolved?.role === 'BACK_OFFICE') return '/backoffice';
      return '/supervisor';
    },

    resolveDashboardRoute(s?: UserSessionResponse | null) {
      if (!get().isSupervisorWorkspaceSession(s)) {
        return '/commercant/etat-dossier';
      }

      const base = get().resolveWorkspaceBaseRoute(s);
      if (base === '/commercial') return '/commercial/dashboard';
      if (base === '/backoffice') return '/backoffice/dashboard';
      return '/supervisor/overview';
    },

    activeAffiliationProfile: 'ENCAISSEMENT',

    setActiveAffiliationProfile(profile: AffiliationProfile) {
      set({ activeAffiliationProfile: profile });
    }
  };

  return store;
});

// A utiliser en dehors des composants React (ex: intercepteurs axios) - contrairement
// a un acces direct au store, ceci renvoie toujours l'etat courant (getState() est live),
// alors qu'un objet capture une seule fois resterait fige sur sa valeur de creation.
export function getSessionStore(): SessionState {
  return useSessionStore.getState();
}

// A utiliser partout ou le code testait auparavant `session?.typeAffiliation`
// directement (ex: `=== 'E_COMMERCE'`) - se comporte a l'identique pour tous
// les comptes a type unique, et suit le profil actif pour un compte combine.
export function useEffectiveAffiliationType(): string {
  const session = useSessionStore((s) => s.session);
  const activeProfile = useSessionStore((s) => s.activeAffiliationProfile);
  if (session?.typeAffiliation !== 'ENCAISSEMENT_ET_ECOMMERCE') {
    return session?.typeAffiliation ?? '';
  }
  return activeProfile === 'E_COMMERCE' ? 'E_COMMERCE' : 'ENCAISSEMENT';
}
