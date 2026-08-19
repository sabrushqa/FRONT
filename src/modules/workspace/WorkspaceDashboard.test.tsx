import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import WorkspaceDashboard, { DrawerItem, NotificationItem, SummaryTile } from './WorkspaceDashboard';
import { useSessionStore, normalizeUserSessionResponse } from '../../store/sessionStore';

const logoutMock = vi.fn();

vi.mock('../auth/services/authApi', () => ({
  logout: (...args: unknown[]) => logoutMock(...args)
}));

const primaryDrawerItems: DrawerItem[] = [
  { route: '/supervisor/overview', label: 'Vue d\'ensemble', icon: 'dashboard', count: null, exact: true },
  { route: '/supervisor/affiliation-requests', label: 'Demandes', icon: 'assignment', count: 3 },
  { route: '/supervisor/affiliation-requests/new', label: 'Nouvelle demande', icon: 'add', count: null, exact: true }
];

function renderShell(props: Partial<React.ComponentProps<typeof WorkspaceDashboard>> = {}, initialPath = '/supervisor/overview') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="*"
          element={
            <WorkspaceDashboard
              roleClass="role-supervisor"
              primaryDrawerItems={primaryDrawerItems}
              pageTitle="Vue d'ensemble"
              {...props}
            />
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  logoutMock.mockReset().mockResolvedValue({ message: 'ok' });
  window.sessionStorage.clear();
  window.localStorage.clear();
  useSessionStore.getState().clearSession();
});

describe('WorkspaceDashboard - etats de chargement', () => {
  it("affiche l'ecran de chargement quand isLoading et pas de session", () => {
    renderShell({ isLoading: true });
    expect(screen.getByText('Chargement de votre espace…')).toBeInTheDocument();
  });

  it("affiche l'ecran d'erreur quand pas de session et un message d'erreur, sans etre en chargement", () => {
    renderShell({ isLoading: false, errorMessage: 'Session indisponible' });
    expect(screen.getByText('Session indisponible')).toBeInTheDocument();
  });

  it('affiche le contenu normal quand une session est presente', () => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR', nom: 'Jean Dupont' })
    );
    renderShell();
    expect(screen.getAllByText("Vue d'ensemble").length).toBeGreaterThan(0);
  });
});

describe('WorkspaceDashboard - navigation du menu', () => {
  beforeEach(() => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR', nom: 'Jean Dupont' })
    );
  });

  it('affiche un badge de compteur pour un item qui en a un', () => {
    renderShell();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it("marque comme actif l'item correspondant exactement a l'URL courante, pas le parent generique", () => {
    renderShell({}, '/supervisor/affiliation-requests/new');
    const newItemBtn = screen.getByText('Nouvelle demande').closest('button')!;
    const parentItemBtn = screen.getByText('Demandes').closest('button')!;
    expect(newItemBtn.className).toContain('is-active');
    expect(parentItemBtn.className).not.toContain('is-active');
  });

  it('marque comme actif un item non-exact quand aucun item exact plus specifique ne correspond', () => {
    renderShell({}, '/supervisor/affiliation-requests/42');
    const parentItemBtn = screen.getByText('Demandes').closest('button')!;
    expect(parentItemBtn.className).toContain('is-active');
  });
});

describe('WorkspaceDashboard - categories de navigation repliables', () => {
  const groupedItems: DrawerItem[] = [
    { route: '/supervisor/overview', label: 'Vue d\'ensemble', icon: 'dashboard', count: null, exact: true },
    { route: '/supervisor/affiliation-requests', label: 'Demandes affiliation', icon: 'assignment', count: null, exact: true, group: 'Dossiers' },
    { route: '/supervisor/prospections', label: 'Prospections commerciales', icon: 'campaign', count: null, exact: true, group: 'Dossiers' },
    { route: '/supervisor/commercants', label: 'Commerçants', icon: 'storefront', count: null, exact: true, group: 'Équipe' }
  ];

  beforeEach(() => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR', nom: 'Jean Dupont' })
    );
  });

  it('affiche un grand titre de categorie et regroupe les items qui partagent le meme groupe', () => {
    renderShell({ primaryDrawerItems: groupedItems });
    expect(screen.getByText('Dossiers')).toBeInTheDocument();
    expect(screen.getByText('Équipe')).toBeInTheDocument();
    expect(screen.getByText('Demandes affiliation')).toBeInTheDocument();
    expect(screen.getByText('Prospections commerciales')).toBeInTheDocument();
    // Un item sans groupe (Vue d'ensemble) reste affiche a plat, sans titre de categorie.
    const navItems = screen.getAllByText('Vue d\'ensemble').map((el) => el.closest('li')).filter(Boolean);
    expect(navItems.length).toBeGreaterThan(0);
  });

  it('replie et deplie une categorie au clic sur son titre', () => {
    renderShell({ primaryDrawerItems: groupedItems });
    const groupHead = screen.getByText('Dossiers').closest('button')!;
    const groupWrap = groupHead.parentElement!;

    expect(groupWrap.className).not.toContain('is-collapsed');
    expect(groupHead.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(groupHead);
    expect(groupWrap.className).toContain('is-collapsed');
    expect(groupHead.getAttribute('aria-expanded')).toBe('false');
    // Les items restent dans le DOM (repli en CSS via max-height), pas retires.
    expect(screen.getByText('Demandes affiliation')).toBeInTheDocument();

    fireEvent.click(groupHead);
    expect(groupWrap.className).not.toContain('is-collapsed');
  });
});

describe('WorkspaceDashboard - notifications', () => {
  beforeEach(() => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR', nom: 'Jean Dupont' })
    );
  });

  it("n'affiche pas la cloche si canManageAffiliationRequests est false", () => {
    renderShell({ canManageAffiliationRequests: false });
    expect(screen.queryByLabelText('Notifications')).toBeNull();
  });

  it('affiche le compteur de notifications non lues et la liste au clic', () => {
    const notificationItems: NotificationItem[] = [
      { notificationId: 1, dossierId: 5, title: 'Nouveau dossier', helper: "Aujourd'hui", route: '/supervisor/affiliation-requests/5', isNew: true }
    ];
    renderShell({ canManageAffiliationRequests: true, unseenNotificationCount: 2, notificationItems });

    expect(screen.getByText('2')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Notifications'));
    expect(screen.getByText('Nouveau dossier')).toBeInTheDocument();
  });

  it("appelle onNotificationMenuOpened a l'ouverture du menu de notifications", () => {
    const onNotificationMenuOpened = vi.fn();
    renderShell({ canManageAffiliationRequests: true, onNotificationMenuOpened });

    fireEvent.click(screen.getByLabelText('Notifications'));
    expect(onNotificationMenuOpened).toHaveBeenCalledTimes(1);
  });

  it("affiche un etat vide si aucune notification n'est presente", () => {
    renderShell({ canManageAffiliationRequests: true, notificationItems: [] });
    fireEvent.click(screen.getByLabelText('Notifications'));
    expect(screen.getByText('Aucune notification')).toBeInTheDocument();
  });
});

describe('WorkspaceDashboard - compte et deconnexion', () => {
  beforeEach(() => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR', nom: 'Jean Dupont', email: 'j@d.com' })
    );
  });

  it('affiche les initiales et le nom dans le bouton de compte', () => {
    renderShell();
    expect(screen.getAllByText('Jean Dupont').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Mon compte')).toHaveTextContent('JE');
  });

  it('deconnecte, efface la session et redirige vers /login', async () => {
    renderShell();
    fireEvent.click(screen.getByLabelText('Mon compte'));
    fireEvent.click(screen.getByText('Se déconnecter'));

    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(useSessionStore.getState().session).toBeNull());
    expect(window.sessionStorage.getItem('authSuccessMessage')).toBe('Vous avez été déconnecté.');
  });

  it('se deconnecte localement meme si apiLogout echoue', async () => {
    logoutMock.mockRejectedValue(new Error('network error'));
    renderShell();
    fireEvent.click(screen.getByLabelText('Mon compte'));
    fireEvent.click(screen.getByText('Se déconnecter'));

    await waitFor(() => expect(useSessionStore.getState().session).toBeNull());
  });
});

describe('WorkspaceDashboard - tuiles resumees et theme', () => {
  beforeEach(() => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR', nom: 'Jean Dupont' })
    );
  });

  it('affiche les tuiles resumees quand fournies et hors workspace commercial', () => {
    const summaryTiles: SummaryTile[] = [{ label: 'Total', value: 42, helper: 'aide' }];
    renderShell({ summaryTiles, isCommercialWorkspace: false });
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('masque les tuiles resumees en mode workspace commercial meme si fournies', () => {
    const summaryTiles: SummaryTile[] = [{ label: 'Total', value: 42, helper: 'aide' }];
    renderShell({ summaryTiles, isCommercialWorkspace: true });
    expect(screen.queryByText('42')).toBeNull();
  });

  it('bascule le theme et le persiste en localStorage', () => {
    renderShell();
    const themeBtn = screen.getByLabelText('Mode sombre');
    fireEvent.click(themeBtn);
    expect(window.localStorage.getItem('app-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('WorkspaceDashboard - menu mobile', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    useSessionStore.getState().setSession(
      normalizeUserSessionResponse({ utilisateurId: 1, commercantId: 1, role: 'SUPERVISEUR', nom: 'Jean Dupont' })
    );
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 480 });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: originalInnerWidth });
  });

  it('ouvre le tiroir de navigation (classe is-open) au clic sur le bouton menu en vue mobile', () => {
    renderShell();
    const menuBtn = screen.getByLabelText('Menu');

    const drawer = document.querySelector('.ws-drawer') as HTMLElement;
    expect(drawer.className).not.toContain('is-open');

    fireEvent.click(menuBtn);
    expect(drawer.className).toContain('is-open');
    expect(drawer.className).toContain('drawer-mobile');

    fireEvent.click(menuBtn);
    expect(drawer.className).not.toContain('is-open');
  });

  it("ferme le tiroir au clic sur l'overlay — un vrai <button> (accessibilite clavier native, Sonar S1082/S6819/S6842)", () => {
    renderShell();
    const menuBtn = screen.getByLabelText('Menu');
    const drawer = document.querySelector('.ws-drawer') as HTMLElement;

    fireEvent.click(menuBtn);
    expect(drawer.className).toContain('is-open');

    const overlay = screen.getByLabelText('Fermer le menu');
    // Un <button> HTML est nativement operable au clavier (Entree/Espace) par
    // le navigateur lui-meme — pas besoin de handler onKeyDown applicatif ni
    // de le re-tester ici, contrairement a un role="button" simule sur un <div>.
    expect(overlay.tagName).toBe('BUTTON');

    fireEvent.click(overlay);
    expect(drawer.className).not.toContain('is-open');
  });
});
