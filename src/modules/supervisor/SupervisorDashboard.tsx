import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import WorkspaceDashboard, { DrawerItem, NotificationItem, SummaryTile } from '../workspace/WorkspaceDashboard';
import { useSessionStore } from '../../store/sessionStore';
import {
  getOverview,
  getAffiliationRequests,
  getNotifications,
  markAllNotificationsAsRead,
  AffiliationRequestItem,
  NotificationApiItem
} from './services/supervisorApi';
import { currentSession } from '../auth/services/authApi';
import { normalizeUserSessionResponse } from '../../store/sessionStore';
import { resolveAffiliationStatusKey, isSupervisorRole, formatRelativeDate } from '../workspace/workspaceUtils';
import '../../styles/workspace-page.scss';
import '../../styles/workspace-navbar.scss';
import '../../styles/workspace-drawer-actions.scss';
import '../../styles/supervisor-page.scss';
import '../../styles/supervisor-dashboard.scss';

export default function SupervisorDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, setSession, clearSession, resolveDashboardRoute } = useSessionStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingCounts, setIsRefreshingCounts] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pageTitle, setPageTitle] = useState('Vue d\'ensemble');
  const [pageDescription, setPageDescription] = useState('');

  const [counts, setCounts] = useState({
    affiliationRequests: 0,
    affiliationPending: 0,
    affiliationProgress: 0,
    affiliationSent: 0,
    affiliationActive: 0,
    affiliationRefused: 0,
    backOffices: 0,
    commerciales: 0,
    commercants: 0,
  });

  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [unseenNotificationCount, setUnseenNotificationCount] = useState(0);

  const canManageStaff = isSupervisorRole(session?.role);
  const canManageAffiliationRequests = session?.role === 'SUPERVISEUR' || session?.role === 'COMMERCIAL' || session?.role === 'BACK_OFFICE';

  const workspaceBaseRoute = '/supervisor';
  const overviewRoute = `${workspaceBaseRoute}/overview`;
  const dossiersRoute = `${workspaceBaseRoute}/affiliation-requests`;
  const profileRoute = `${workspaceBaseRoute}/profil`;
  const passwordActionRoute = canManageStaff ? `${workspaceBaseRoute}/security` : '/forgot-password';

  // Route metadata
  useEffect(() => {
    const metaMap: Record<string, { title: string; description: string }> = {
      [`${workspaceBaseRoute}/overview`]: { title: 'Vue d\'ensemble', description: 'Suivez les indicateurs du poste commercial ou superviseur depuis un tableau de bord dédié.' },
      [`${workspaceBaseRoute}/pipeline`]: { title: 'Pipeline des dossiers', description: 'Identifiez les étapes où les demandes sont bloquées.' },
      [`${workspaceBaseRoute}/activite-conversion`]: { title: 'Activité & Conversion', description: 'Conversion par origine, volume du mois et segmentation des demandes en un seul écran.' },
      [`${workspaceBaseRoute}/performance-equipes`]: { title: 'Performance des équipes', description: 'Commerciales et back office : assignations, validations, taux de conversion et délais de traitement.' },
      [`${workspaceBaseRoute}/affiliation-requests`]: { title: 'Demandes d\'affiliation', description: 'Travaillez la liste des dossiers dans un écran séparé puis ouvrez chaque dossier sur sa propre page.' },
      [`${workspaceBaseRoute}/prospections`]: { title: 'Prospections commerciales', description: 'Consultez toutes les demandes créées par les commerciales, filtrables par commerciale, région, statut et type d\'interaction.' },
      [`${workspaceBaseRoute}/back-offices`]: { title: 'Équipe back office', description: 'Visualisez et pilotez les comptes back office dans une liste professionnelle.' },
      [`${workspaceBaseRoute}/commercial`]: { title: 'Équipe commerciale', description: 'Suivez les comptes commerciaux avec un affichage Material plus lisible.' },
      [`${workspaceBaseRoute}/commercants`]: { title: 'Portefeuille commerçants', description: 'Retrouvez les commerçants actifs ou désactivés dans une page dédiée.' },
      [`${workspaceBaseRoute}/tpes`]: { title: 'Stock TPE', description: 'Gérez les références TPE, SoftPOS et QR Code.' },
      [`${workspaceBaseRoute}/reclamations`]: { title: 'Réclamations TPE', description: 'Consultez les réclamations reçues, traitées ou non, par région, BOA et type d\'affiliation.' },
      [`${workspaceBaseRoute}/geo-map`]: { title: 'Répartition géographique', description: 'Visualisez la répartition des commerçants par ville et région sur la carte du Maroc.' },
      [`${workspaceBaseRoute}/pdv-map`]: { title: 'Carte des points de vente', description: 'Zoomez sur une ville pour voir les points de vente et filtrez par ville, type d\'affiliation et type de commerçant.' },
      [`${workspaceBaseRoute}/back-offices/new`]: { title: 'Créer un back office', description: 'Préparez un compte back office et envoyez son e-mail d\'activation.' },
      [`${workspaceBaseRoute}/commercial/new`]: { title: 'Créer un commercial', description: 'Ajoutez un compte commercial depuis un formulaire séparé.' },
      [`${workspaceBaseRoute}/security`]: { title: 'Sécurité du compte', description: 'Mettez à jour le mot de passe superviseur depuis une page distincte.' },
    };
    const path = location.pathname.split('?')[0];
    const meta = metaMap[path];
    if (meta) {
      setPageTitle(meta.title);
      setPageDescription(meta.description);
    } else if (path.match(/\/affiliation-requests\/\d+/)) {
      setPageTitle('Dossier commerçant');
      setPageDescription('Consultez toutes les informations du dossier.');
    }
  }, [location.pathname]);

  useEffect(() => {
    loadSession();
  }, []);

  // Rafraîchit la cloche de notifications périodiquement : sans ça, une
  // notification créée pendant que la page est déjà ouverte (nouvelle demande,
  // assignation) ne serait visible qu'après un rechargement complet.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 45000);
    return () => window.clearInterval(intervalId);
  }, []);

  async function loadSession() {
    setErrorMessage('');
    setIsLoading(true);
    try {
      if (session) {
        await refreshCounts(true, session.role);
        await loadNotifications();
        return;
      }
      const response = await currentSession();
      const normalized = normalizeUserSessionResponse(response as Parameters<typeof normalizeUserSessionResponse>[0]);
      setSession(normalized);
      await refreshCounts(true, normalized.role);
      await loadNotifications();
    } catch {
      setErrorMessage('Votre session équipe est indisponible.');
      clearSession();
      window.sessionStorage.setItem('authSuccessMessage', 'Votre session a expiré. Connectez-vous de nouveau.');
      navigate('/login');
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshCounts(initialLoad = false, role?: string) {
    const currentRole = role ?? session?.role;
    const canManage = currentRole === 'SUPERVISEUR' || currentRole === 'COMMERCIAL' || currentRole === 'BACK_OFFICE';
    const isSupervisor = currentRole === 'SUPERVISEUR';

    if (!initialLoad) {
      setIsRefreshingCounts(true);
    }

    try {
      const [overviewResult, affiliationResult] = await Promise.all([
        isSupervisor ? getOverview() : Promise.resolve({ backOffices: [], commerciales: [], commercants: [] }),
        canManage ? getAffiliationRequests() : Promise.resolve({ requests: [] }),
      ]);

      const requests: AffiliationRequestItem[] = Array.isArray(affiliationResult.requests) ? affiliationResult.requests : [];
      const statusCounts = { pending: 0, progress: 0, sent: 0, active: 0, refused: 0 };
      for (const req of requests) {
        statusCounts[resolveAffiliationStatusKey(req)] += 1;
      }

      setCounts({
        affiliationRequests: requests.length,
        affiliationPending: statusCounts.pending,
        affiliationProgress: statusCounts.progress,
        affiliationSent: statusCounts.sent,
        affiliationActive: statusCounts.active,
        affiliationRefused: statusCounts.refused,
        backOffices: overviewResult.backOffices.length,
        commerciales: overviewResult.commerciales.length,
        commercants: overviewResult.commercants.length,
      });
    } catch {
      setErrorMessage('Les indicateurs du workspace sont indisponibles.');
    } finally {
      setIsRefreshingCounts(false);
    }
  }

  function mapNotification(item: NotificationApiItem): NotificationItem {
    return {
      notificationId: item.notificationId,
      dossierId: item.dossierId ?? 0,
      title: item.message,
      helper: formatRelativeDate(item.dateEnvoi),
      route: item.dossierId ? `${dossiersRoute}/${item.dossierId}` : dossiersRoute,
      isNew: !item.read,
      type: item.type
    };
  }

  async function loadNotifications() {
    try {
      const response = await getNotifications();
      setNotificationItems(response.notifications.map(mapNotification));
      setUnseenNotificationCount(response.unreadCount);
    } catch {
      // Silencieux : la cloche reste vide si l'appel échoue, pas bloquant pour le reste du tableau de bord.
    }
  }

  async function handleNotificationMenuOpened() {
    try {
      const response = await markAllNotificationsAsRead();
      setNotificationItems(response.notifications.map(mapNotification));
      setUnseenNotificationCount(response.unreadCount);
    } catch {
      // Ignore : au pire l'utilisateur revoit le badge non lu au prochain chargement.
    }
  }

  const summaryTiles: SummaryTile[] = (() => {
    const isOnOverview = location.pathname.split('?')[0] === overviewRoute;
    if (!isOnOverview) return [];

    if (canManageStaff) {
      // La page /supervisor/overview affiche déjà ses propres cartes (overview-mini-grid) :
      // pas de doublon ici pour le rôle superviseur.
      return [];
    }

    if (canManageAffiliationRequests) {
      return [
        { label: 'À compléter', value: counts.affiliationPending, helper: 'Dossiers soumis' },
        { label: 'En cours', value: counts.affiliationProgress, helper: 'Contrat signé ou en attente back office' },
        { label: 'Refusés', value: counts.affiliationRefused, helper: 'Avec motif de retour' },
        { label: 'Contrat à signer', value: counts.affiliationSent, helper: 'Activation et contrat envoyés' },
      ];
    }
    return [];
  })();

  const primaryDrawerItems: DrawerItem[] = [
    { route: overviewRoute, label: 'Vue d\'ensemble', icon: 'dashboard', count: null, exact: true },
    ...(canManageStaff ? [
      { route: `${workspaceBaseRoute}/pipeline`, label: 'Pipeline dossiers', icon: 'account_tree', count: null, exact: true },
      { route: `${workspaceBaseRoute}/activite-conversion`, label: 'Activité & Conversion', icon: 'published_with_changes', count: null, exact: true },
      { route: `${workspaceBaseRoute}/performance-equipes`, label: 'Perf. équipes', icon: 'leaderboard', count: null, exact: true },
    ] : []),
    ...(canManageAffiliationRequests ? [{ route: dossiersRoute, label: 'Demandes affiliation', icon: 'assignment', count: counts.affiliationRequests }] : []),
    ...(canManageAffiliationRequests ? [{ route: `${workspaceBaseRoute}/prospections`, label: 'Prospections commerciales', icon: 'campaign', count: null, exact: true }] : []),
    ...(canManageStaff ? [
      { route: `${workspaceBaseRoute}/back-offices`, label: 'Back office', icon: 'inventory_2', count: null, exact: true },
      { route: `${workspaceBaseRoute}/commercial`, label: 'Commerciales', icon: 'support_agent', count: null, exact: true },
      { route: `${workspaceBaseRoute}/commercants`, label: 'Commerçants', icon: 'storefront', count: null, exact: true },
      { route: `${workspaceBaseRoute}/tpes`, label: 'Stock TPE', icon: 'point_of_sale', count: null, exact: true },
      { route: `${workspaceBaseRoute}/reclamations`, label: 'Réclamations TPE', icon: 'report_problem', count: null, exact: true },
      { route: `${workspaceBaseRoute}/geo-map`, label: 'Répartition géographique', icon: 'map', count: null, exact: true },
      { route: `${workspaceBaseRoute}/pdv-map`, label: 'Carte des points de vente', icon: 'pin_drop', count: null, exact: true },
    ] : []),
  ];

  const secondaryDrawerItems: DrawerItem[] = canManageStaff ? [
    { route: `${workspaceBaseRoute}/back-offices/new`, label: 'Ajouter back office', icon: 'person_add', count: null, exact: true },
    { route: `${workspaceBaseRoute}/commercial/new`, label: 'Ajouter commerciale', icon: 'group_add', count: null, exact: true },
    { route: `${workspaceBaseRoute}/security`, label: 'Sécurité', icon: 'lock', count: null, exact: true },
  ] : [];

  // A dossier detail page is shared by "Demandes affiliation" and "Prospections
  // commerciales" (both open /supervisor/affiliation-requests/:id). Without this,
  // the URL prefix always highlights "Demandes affiliation" even when the dossier
  // was opened from Prospections. CommercialDirectRequestsPage sets this via
  // navigate(route, { state: { activeDrawerRoute: ... } }).
  const activeUrlOverride = (location.state as { activeDrawerRoute?: string } | null)?.activeDrawerRoute;

  return (
    <WorkspaceDashboard
      roleClass="role-supervisor"
      primaryDrawerItems={primaryDrawerItems}
      secondaryDrawerItems={secondaryDrawerItems}
      summaryTiles={summaryTiles}
      notificationItems={notificationItems}
      unseenNotificationCount={unseenNotificationCount}
      onNotificationMenuOpened={handleNotificationMenuOpened}
      canManageAffiliationRequests={canManageAffiliationRequests}
      errorMessage={errorMessage}
      isRefreshingCounts={isRefreshingCounts}
      isLoading={isLoading}
      pageTitle={pageTitle}
      pageDescription={pageDescription}
      passwordActionRoute={passwordActionRoute}
      activeUrlOverride={activeUrlOverride}
    />
  );
}
