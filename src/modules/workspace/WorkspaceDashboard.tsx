import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../../store/sessionStore';
import { logout as apiLogout } from '../auth/services/authApi';
import { formatEnumLabel, getWorkspaceRoleLabel } from './workspaceUtils';
import '../../styles/workspace-shell.scss';

export interface DrawerItem {
  route: string;
  label: string;
  icon: string;
  count?: number | null;
  exact?: boolean;
}

export interface SummaryTile {
  label: string;
  value: string | number;
  helper: string;
}

export interface NotificationItem {
  notificationId: number;
  dossierId: number;
  title: string;
  helper: string;
  route: string;
  isNew: boolean;
  type?: string;
}

const NOTIFICATION_ICONS: Record<string, string> = {
  DOSSIER_A_ASSIGNER: 'person_add',
  DOSSIER_ASSIGNE: 'assignment_ind',
  CONTRAT_GENERE: 'description',
  CONTRAT_SIGNE: 'task_alt',
  DOSSIER_VALIDE: 'check_circle',
  DOSSIER_REFUSE: 'cancel',
  DOCUMENT_MANQUANT: 'warning',
  RELANCE_COMMERCIAL: 'alarm',
  DOSSIER_RENVOYE_COMMERCIAL: 'assignment_return',
  DOSSIER_ABANDONNE: 'block'
};

function getNotificationIcon(type?: string): string {
  return (type && NOTIFICATION_ICONS[type]) || 'notifications';
}

interface WorkspaceDashboardProps {
  roleClass: string; // e.g. "role-supervisor", "role-commercial-user", "role-backoffice", "role-merchant"
  isCommercialWorkspace?: boolean;
  primaryDrawerItems: DrawerItem[];
  secondaryDrawerItems?: DrawerItem[];
  summaryTiles?: SummaryTile[];
  notificationItems?: NotificationItem[];
  unseenNotificationCount?: number;
  canManageAffiliationRequests?: boolean;
  errorMessage?: string;
  isRefreshingCounts?: boolean;
  isLoading?: boolean;
  pageTitle?: string;
  pageDescription?: string;
  passwordActionRoute?: string;
  onNotificationMenuOpened?: () => void;
  // Lets a page override which drawer route is highlighted, for shared detail
  // routes reached from more than one list (e.g. a dossier detail opened from
  // "Prospections" should keep "Prospections" active, not the unrelated
  // "Demandes affiliation" item whose route prefix happens to match the URL).
  activeUrlOverride?: string;
  // Optional extra control rendered in the topbar, before the theme toggle -
  // e.g. the encaissement/e-commerce profile switcher for a merchant with a
  // combined affiliation.
  headerExtra?: React.ReactNode;
}

export default function WorkspaceDashboard({
  roleClass,
  isCommercialWorkspace = false,
  primaryDrawerItems,
  secondaryDrawerItems = [],
  summaryTiles = [],
  notificationItems = [],
  unseenNotificationCount = 0,
  canManageAffiliationRequests = false,
  errorMessage = '',
  isRefreshingCounts = false,
  isLoading = false,
  pageTitle = 'Espace équipe',
  pageDescription = '',
  passwordActionRoute = '/forgot-password',
  onNotificationMenuOpened,
  activeUrlOverride,
  headerExtra,
}: WorkspaceDashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, clearSession } = useSessionStore();

  const [isDrawerExpanded, setIsDrawerExpanded] = useState(() => window.innerWidth > 1040);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() => window.innerWidth <= 1040);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('app-theme');
    return stored === 'dark' ? 'dark' : 'light';
  });

  const notifMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth <= 1040;
      setIsMobileView(mobile);
      if (!mobile) {
        setIsDrawerOpen(false);
        setIsDrawerExpanded(true);
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const showDrawerText = isMobileView || isDrawerExpanded;
  const allDrawerItems = [...primaryDrawerItems, ...secondaryDrawerItems];

  function toggleDrawer() {
    if (isMobileView) {
      setIsDrawerOpen((v) => !v);
    } else {
      setIsDrawerExpanded((v) => !v);
    }
  }

  function closeMobileDrawer() {
    if (isMobileView) {
      setIsDrawerOpen(false);
    }
  }

  function normalizeUrl(url: string) {
    return url.split('?')[0]?.split('#')[0] ?? url;
  }

  function isActiveDrawerItem(item: DrawerItem, allItems: DrawerItem[]): boolean {
    const currentUrl = normalizeUrl(activeUrlOverride ?? location.pathname);
    const itemRoute = normalizeUrl(item.route);

    if (item.exact) {
      return currentUrl === itemRoute;
    }

    // A broader prefix-matched item (e.g. "Auto-affiliation" -> /commercial/dossiers)
    // must not light up alongside a more specific exact-match item nested under it
    // (e.g. "Nouvelle demande" -> /commercial/dossiers/new).
    const hasMoreSpecificExactMatch = allItems.some(
      (other) => other !== item && other.exact && normalizeUrl(other.route) === currentUrl
    );
    if (hasMoreSpecificExactMatch) {
      return false;
    }

    return currentUrl === itemRoute || currentUrl.startsWith(`${itemRoute}/`);
  }

  function handleNavSelection(route?: string) {
    if (route && normalizeUrl(location.pathname) !== normalizeUrl(route)) {
      navigate(route);
    }
    if (isMobileView) {
      closeMobileDrawer();
    }
    setShowAccountMenu(false);
    setShowNotifMenu(false);
  }

  function handleNotificationBtnClick() {
    const next = !showNotifMenu;
    setShowNotifMenu(next);
    setShowAccountMenu(false);
    if (next && onNotificationMenuOpened) {
      onNotificationMenuOpened();
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await apiLogout();
    } catch {
      // ignore
    } finally {
      clearSession();
      window.sessionStorage.setItem('authSuccessMessage', 'Vous avez été déconnecté.');
      navigate('/login');
    }
  }

  const nom = session?.nom ?? '';
  const avatarInitials = nom.slice(0, 2).toUpperCase();
  const roleLabel = getWorkspaceRoleLabel(session?.role);

  const drawerCollapsed = !isMobileView && !isDrawerExpanded;

  const shellClasses = [
    'ws-shell',
    roleClass,
    drawerCollapsed ? 'shell-drawer-collapsed' : '',
  ].filter(Boolean).join(' ');

  const drawerClasses = [
    'ws-drawer',
    drawerCollapsed ? 'drawer-collapsed' : '',
    isMobileView ? 'drawer-mobile' : '',
    isMobileView && isDrawerOpen ? 'is-open' : '',
  ].filter(Boolean).join(' ');

  if (isLoading && !session) {
    return (
      <section className="ws-splash">
        <div className="ws-splash-inner">
          <img src="/logo.png" alt="Lana Cash" className="ws-splash-logo" />
          <div className="ws-splash-spinner" />
          <p>Chargement de votre espace…</p>
        </div>
      </section>
    );
  }

  if (!isLoading && !session && errorMessage) {
    return (
      <section className="ws-splash ws-splash--error">
        <div className="ws-splash-inner">
          <span className="material-icons">error_outline</span>
          <p>{errorMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <div className={shellClasses}>
      {/* Mobile drawer overlay */}
      {isMobileView && isDrawerOpen && (
        <div className="drawer-overlay" onClick={closeMobileDrawer} />
      )}

      {/* DRAWER */}
      <aside className={drawerClasses}>
        <div className="drawer-inner">
          {/* Logo zone */}
          <div className="drawer-logo-zone">
            {showDrawerText && (
              <div className="drawer-logo-wrap">
                <img src="/logo.png" alt="Lana Cash" className="drawer-logo-img" />
              </div>
            )}
            <button
              className={`drawer-collapse-btn desktop-only${!showDrawerText ? ' drawer-collapse-btn--centered' : ''}`}
              type="button"
              onClick={toggleDrawer}
              aria-label="Réduire"
            >
              <span className="material-icons">
                {isDrawerExpanded ? 'chevron_left' : 'chevron_right'}
              </span>
            </button>
            <button
              className="drawer-collapse-btn mobile-only"
              type="button"
              onClick={closeMobileDrawer}
              aria-label="Fermer"
            >
              <span className="material-icons">close</span>
            </button>
          </div>

          {/* Compte utilisateur */}
          {showDrawerText ? (
            <div className="drawer-account">
              <div className="drawer-account-avatar">{avatarInitials}</div>
              <div className="drawer-account-info">
                <strong>{nom}</strong>
                <span>{roleLabel}</span>
              </div>
            </div>
          ) : (
            <div className="drawer-account-mini">
              <div className="drawer-account-avatar">{avatarInitials}</div>
            </div>
          )}

          {/* Navigation principale */}
          <nav className="drawer-nav">
            {showDrawerText && <p className="drawer-nav-heading">Navigation</p>}
            <ul className="drawer-nav-list">
              {primaryDrawerItems.map((item) => (
                <li key={item.route}>
                  <button
                    type="button"
                    className={`drawer-nav-item${isActiveDrawerItem(item, allDrawerItems) ? ' is-active' : ''}`}
                    onClick={() => handleNavSelection(item.route)}
                  >
                    <div className={`nav-item-inner${!showDrawerText ? ' nav-mini' : ''}`}>
                      <span className="nav-item-icon">
                        <span className="material-icons">{item.icon}</span>
                      </span>
                      {showDrawerText && (
                        <span className="nav-item-label">{item.label}</span>
                      )}
                      {showDrawerText && item.count != null && (
                        <span className="nav-item-badge">{item.count}</span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {secondaryDrawerItems.length > 0 && (
              <>
                <div className="drawer-nav-divider" />
                {showDrawerText && <p className="drawer-nav-heading">Administration</p>}
                <ul className="drawer-nav-list">
                  {secondaryDrawerItems.map((item) => (
                    <li key={item.route}>
                      <button
                        type="button"
                        className={`drawer-nav-item${isActiveDrawerItem(item, allDrawerItems) ? ' is-active' : ''}`}
                        onClick={() => handleNavSelection(item.route)}
                      >
                        <div className={`nav-item-inner${!showDrawerText ? ' nav-mini' : ''}`}>
                          <span className="nav-item-icon">
                            <span className="material-icons">{item.icon}</span>
                          </span>
                          {showDrawerText && (
                            <span className="nav-item-label">{item.label}</span>
                          )}
                          {showDrawerText && item.count != null && (
                            <span className="nav-item-badge">{item.count}</span>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </nav>

          {/* Footer drawer */}
          {showDrawerText && (
            <div className="drawer-footer">
              <span className="drawer-footer-label">Portail d'affiliation</span>
              <span className="drawer-footer-version">v2.0</span>
            </div>
          )}
        </div>
      </aside>

      {/* CONTENU PRINCIPAL */}
      <div className="ws-content">
        <div className="ws-body">
          {/* TOPBAR */}
          <header className="ws-topbar">
            <div className="topbar-left">
              {isMobileView && (
                <button className="topbar-menu-btn" type="button" onClick={toggleDrawer} aria-label="Menu">
                  <span className="material-icons">menu</span>
                </button>
              )}

              {(isMobileView || (!isMobileView && !isDrawerExpanded)) && (
                <div className="topbar-logo">
                  <img src="/logo.png" alt="Lana Cash" className="topbar-logo-img" />
                </div>
              )}

              <div className="topbar-breadcrumb">
                {!isCommercialWorkspace && (
                  <span className="topbar-breadcrumb-root">{roleLabel}</span>
                )}
                <div className="topbar-breadcrumb-copy">
                  <strong className="topbar-breadcrumb-page">{pageTitle}</strong>
                  <span className="topbar-breadcrumb-subtitle">{pageDescription}</span>
                </div>
              </div>
            </div>

            <div className="topbar-right">
              {/* Notifications */}
              {canManageAffiliationRequests && (
                <div ref={notifMenuRef} style={{ position: 'relative' }}>
                  <button
                    className="topbar-action-btn"
                    type="button"
                    onClick={handleNotificationBtnClick}
                    aria-label="Notifications"
                  >
                    <span className="material-icons">notifications_none</span>
                    {unseenNotificationCount > 0 && (
                      <span className="topbar-action-label">{unseenNotificationCount}</span>
                    )}
                  </button>

                  {showNotifMenu && (
                    <div className="ws-menu-panel">
                      <div className="menu-panel-head">
                        <strong>Notifications</strong>
                        <span>{unseenNotificationCount ? `${unseenNotificationCount} non lue(s)` : 'Tout est à jour'}</span>
                      </div>
                      {notificationItems.length === 0 ? (
                        <div className="menu-panel-empty">
                          <span className="material-icons">inbox</span>
                          <p>Aucune notification</p>
                        </div>
                      ) : (
                        notificationItems.map((item) => (
                          <button
                            key={item.notificationId}
                            type="button"
                            className={`menu-notif-item${item.isNew ? ' menu-notif-item--unread' : ''}`}
                            onClick={() => handleNavSelection(item.route)}
                          >
                            <span className="notif-icon">
                              <span className="material-icons">{getNotificationIcon(item.type)}</span>
                            </span>
                            <div className="notif-body">
                              <strong>{item.title}</strong>
                              <small>{item.helper}</small>
                            </div>
                            {item.isNew && <span className="notif-unread-mark" />}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {headerExtra}

              {/* Theme toggle */}
              <button
                className="topbar-action-btn topbar-theme-toggle"
                type="button"
                onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
                aria-label={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
                title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
              >
                <span className="material-icons">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
              </button>

              <div className="topbar-divider" />

              {/* Compte */}
              <div ref={accountMenuRef} style={{ position: 'relative' }}>
                <button
                  className="topbar-account-btn"
                  type="button"
                  onClick={() => { setShowAccountMenu((v) => !v); setShowNotifMenu(false); }}
                  aria-label="Mon compte"
                >
                  <div className="topbar-avatar">{avatarInitials}</div>
                  <div className="topbar-account-info">
                    <strong>{nom}</strong>
                    <span>{formatEnumLabel(session?.role)}</span>
                  </div>
                  <span className="material-icons topbar-account-caret">expand_more</span>
                </button>

                {showAccountMenu && (
                  <div className="ws-menu-panel">
                    <div className="menu-panel-head menu-panel-head--account">
                      <div className="menu-account-avatar">{avatarInitials}</div>
                      <div>
                        <strong>{nom}</strong>
                        <span>{session?.email}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => handleNavSelection(passwordActionRoute)}
                    >
                      <span className="material-icons">lock_outline</span>
                      <span>Modifier le mot de passe</span>
                    </button>
                    <button
                      type="button"
                      className="menu-item"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                    >
                      <span className="material-icons">logout</span>
                      <span>{isLoggingOut ? 'Déconnexion…' : 'Se déconnecter'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* SUMMARY TILES */}
          {summaryTiles.length > 0 && !isCommercialWorkspace && (
            <div className="ws-metrics">
              {summaryTiles.map((tile, idx) => (
                <div className="metric-card" key={idx}>
                  <span className="metric-label">{tile.label}</span>
                  <strong className="metric-value">{tile.value}</strong>
                  <small className="metric-helper">{tile.helper}</small>
                </div>
              ))}
            </div>
          )}

          {/* ALERTES */}
          {errorMessage && (
            <div className="ws-alert ws-alert--error" role="alert">
              <span className="material-icons">error_outline</span>
              <span>{errorMessage}</span>
            </div>
          )}
          {isRefreshingCounts && (
            <div className="ws-alert ws-alert--info" role="status">
              <span className="material-icons">sync</span>
              <span>Mise à jour en cours…</span>
            </div>
          )}

          {/* PAGE */}
          <main className="ws-page">
            {/* Boundary locale : sans elle, le seul <Suspense> de l'app (dans App.tsx,
                au-dessus de tout, sidebar comprise) reprend la main a chaque navigation
                entre pages lazy-loadees et remplace TOUTE la mise en page (sidebar,
                en-tete...) par le fallback texte le temps du chargement du chunk -
                donnant l'impression que "le design change" a chaque clic. */}
            <Suspense fallback={<div className="ws-page-loading"><span className="ws-page-loading-spinner" /></div>}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}
