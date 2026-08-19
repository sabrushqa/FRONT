import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import WorkspaceDashboard, { DrawerItem, NotificationItem, SummaryTile } from '../workspace/WorkspaceDashboard';
import { useSessionStore } from '../../store/sessionStore';
import {
  getAffiliationRequests,
  getNotifications,
  markAllNotificationsAsRead,
  AffiliationRequestItem,
  NotificationApiItem
} from '../supervisor/services/supervisorApi';
import { getReclamationStats } from './services/reclamationsApi';
import { currentSession } from '../auth/services/authApi';
import { normalizeUserSessionResponse } from '../../store/sessionStore';
import {
  isAutoAffiliationRequest,
  isCommercialDirectRequest,
  isHandledByCurrentBackOffice,
  isNewPdvRequest,
  needsManualAssignment,
  resolveAffiliationStatusKey,
  formatRelativeDate
} from '../workspace/workspaceUtils';
import '../../styles/workspace-page.scss';
import '../../styles/workspace-navbar.scss';
import '../../styles/workspace-drawer-actions.scss';
import '../../styles/backoffice-page.scss';
import '../../styles/backoffice-dashboard.scss';

export default function BackofficeDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, setSession, clearSession } = useSessionStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingCounts, setIsRefreshingCounts] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pageTitle, setPageTitle] = useState('Dashboard back office');
  const [pageDescription, setPageDescription] = useState('');

  const [counts, setCounts] = useState({
    affiliationRequests: 0,
    extentionRequests: 0,
    tpeToAssign: 0,
    affiliationPending: 0,
    affiliationProgress: 0,
    affiliationSent: 0,
    affiliationRefused: 0,
    commercialRequests: 0,
    reclamationsActives: 0,
  });

  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [unseenNotificationCount, setUnseenNotificationCount] = useState(0);

  const workspaceBaseRoute = '/backoffice';
  const overviewRoute = `${workspaceBaseRoute}/dashboard`;
  const dossiersRoute = `${workspaceBaseRoute}/dossiers`;
  const extentionRoute = `${workspaceBaseRoute}/demande-extention`;
  const tpeToAssignRoute = `${workspaceBaseRoute}/tpe-a-affecter`;

  // Ex: "Le contrat du dossier #X ... a été signé — une référence TPE/SoftPOS/
  // QR et/ou un site e-commerce doit être affecté" (StaffAffiliationManagementService::
  // notifyBackOfficeTpeAssignmentNeeded) — sans cette cloche, le BOA ne savait
  // que via l'e-mail qu'une affectation l'attendait. Ce type de notification
  // redirige vers la liste "TPE à affecter" (filtrée sur le BOA connecté) plutôt
  // que vers le dossier precis : avec plusieurs dossiers en attente, le BOA a
  // besoin de la vue d'ensemble, pas seulement de celui qui vient de le notifier.
  const mapNotification = useCallback((item: NotificationApiItem): NotificationItem => ({
    notificationId: item.notificationId,
    dossierId: item.dossierId ?? 0,
    title: item.message,
    helper: formatRelativeDate(item.dateEnvoi),
    route: item.type === 'DOSSIER_TPE_A_AFFECTER'
      ? tpeToAssignRoute
      : item.dossierId
        ? `${item.isNewPdvRequest ? extentionRoute : dossiersRoute}/${item.dossierId}`
        : dossiersRoute,
    isNew: !item.read,
    type: item.type
  }), [dossiersRoute, extentionRoute, tpeToAssignRoute]);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await getNotifications();
      setNotificationItems(response.notifications.map(mapNotification));
      setUnseenNotificationCount(response.unreadCount);
    } catch {
      // Silencieux : la cloche reste vide si l'appel echoue.
    }
  }, [mapNotification]);

  async function handleNotificationMenuOpened() {
    try {
      const response = await markAllNotificationsAsRead();
      setNotificationItems(response.notifications.map(mapNotification));
      setUnseenNotificationCount(response.unreadCount);
    } catch {
      // Ignore.
    }
  }

  // Rafraichit la cloche periodiquement : sans ca, une notification creee
  // pendant que la page est deja ouverte ne serait visible qu'apres un
  // rechargement complet — meme logique que CommercialDashboard.tsx.
  useEffect(() => {
    void loadNotifications();
    const intervalId = window.setInterval(() => { void loadNotifications(); }, 45000);
    return () => window.clearInterval(intervalId);
  }, [loadNotifications]);

  useEffect(() => {
    const metaMap: Record<string, { title: string; description: string }> = {
      [`${workspaceBaseRoute}/dashboard`]: { title: 'Dashboard back office', description: 'Pilotez les dossiers à vérifier et les validations finales.' },
      [`${workspaceBaseRoute}/dossiers`]: { title: 'Dossier Auto-affiliation', description: 'Consultez, vérifiez et traitez les dossiers d\'auto-affiliation transmis au back office.' },
      [`${workspaceBaseRoute}/demande-extention`]: { title: 'Demandes d\'extension', description: 'Validez ou refusez les extensions des commerçants déjà affiliés.' },
      [`${workspaceBaseRoute}/tpe-a-affecter`]: { title: 'TPE à affecter', description: 'Dossiers avec contrat signé dont la référence TPE/SoftPOS/QR et/ou le site e-commerce reste à affecter.' },
      [`${workspaceBaseRoute}/historique`]: { title: 'Historique back office', description: 'Consultez les dossiers déjà traités.' },
      [`${workspaceBaseRoute}/demandes-commerciales`]: { title: 'Dossier Prospection commerciale', description: 'Consultez et validez les demandes de prospection commerciale.' },
      [`${workspaceBaseRoute}/reclamations`]: { title: 'Réclamations TPE', description: 'Traitez les incidents signalés par le chatbot de support TPE.' },
      [`${workspaceBaseRoute}/reclamations-historique`]: { title: 'Historique réclamations', description: 'Consultez les réclamations résolues ou escaladées.' },
      [`${workspaceBaseRoute}/profil`]: { title: 'Profil back office', description: 'Retrouvez vos informations de session.' },
    };
    const path = location.pathname.split('?')[0];
    const meta = metaMap[path];
    if (meta) {
      setPageTitle(meta.title);
      setPageDescription(meta.description);
    } else if (path.match(/\/dossiers\/\d+/)) {
      setPageTitle('Dossier commerçant');
      setPageDescription('Affichez le détail du dossier puis finalisez le traitement back office.');
    }
  }, [location.pathname]);

  useEffect(() => {
    loadSession();
  }, []);

  async function loadSession() {
    setErrorMessage('');
    setIsLoading(true);
    try {
      if (session) {
        await refreshCounts(true, session);
        return;
      }
      const response = await currentSession();
      const normalized = normalizeUserSessionResponse(response as Parameters<typeof normalizeUserSessionResponse>[0]);
      setSession(normalized);
      await refreshCounts(true, normalized);
    } catch {
      clearSession();
      window.sessionStorage.setItem('authSuccessMessage', 'Votre session a expiré. Connectez-vous de nouveau.');
      navigate('/login');
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshCounts(initialLoad = false, sessionData = session) {
    if (!initialLoad) setIsRefreshingCounts(true);
    try {
      const affiliationResult = await getAffiliationRequests();
      const requests: AffiliationRequestItem[] = Array.isArray(affiliationResult.requests) ? affiliationResult.requests : [];
      const autoRequests = requests.filter(isAutoAffiliationRequest);
      const extentionRequests = requests.filter(isNewPdvRequest);
      const commercialRequests = requests.filter(isCommercialDirectRequest);
      const currentSessionValue = sessionData ?? useSessionStore.getState().session;
      const handledAutoRequests = autoRequests.filter((request) =>
        isHandledByCurrentBackOffice(request, currentSessionValue)
      );
      const tpeToAssignCount = requests.filter(
        (request) => needsManualAssignment(request) && isHandledByCurrentBackOffice(request, currentSessionValue)
      ).length;
      const statusCounts = { pending: 0, progress: 0, sent: 0, active: 0, refused: 0 };
      for (const req of handledAutoRequests) {
        statusCounts[resolveAffiliationStatusKey(req)] += 1;
      }
      let reclamActives = 0;
      let reclamationStatsUnavailable = false;
      if (currentSessionValue?.peutGererReclamations !== false) {
        try {
          const rStats = await getReclamationStats();
          reclamActives = (rStats.EN_COURS ?? 0) + (rStats.EN_ATTENTE ?? 0);
        } catch {
          reclamationStatsUnavailable = true;
        }
      }

      setCounts({
        // Both counts reflect actionable items ("à traiter"), matching the semantics implied
        // by the drawer badges — a dossier already treated shouldn't inflate either number.
        affiliationRequests: autoRequests.filter((request) => request.status === 'EN_ATTENTE_VALIDATION_BOA').length,
        extentionRequests: extentionRequests.filter((request) => request.status === 'EN_ATTENTE_VALIDATION_BOA').length,
        tpeToAssign: tpeToAssignCount,
        affiliationPending: statusCounts.pending,
        affiliationProgress: statusCounts.progress,
        affiliationSent: statusCounts.sent,
        affiliationRefused: statusCounts.refused,
        commercialRequests: commercialRequests.filter((request) => request.status === 'EN_ATTENTE_VALIDATION_BOA').length,
        reclamationsActives: reclamActives,
      });
      setErrorMessage(
        reclamationStatsUnavailable
          ? 'Le nombre de réclamations actives est momentanément indisponible.'
          : ''
      );
    } catch {
      setErrorMessage('Les indicateurs du workspace back office sont indisponibles.');
    } finally {
      setIsRefreshingCounts(false);
    }
  }

  const isOnOverview = location.pathname.split('?')[0] === overviewRoute;

  const summaryTiles: SummaryTile[] = isOnOverview ? [
    { label: 'À traiter', value: counts.affiliationPending, helper: 'Dossiers en attente de traitement' },
    { label: 'Réclamations à traiter', value: counts.reclamationsActives, helper: 'En cours ou en attente' },
  ] : [];

  const peutValiderDossiers = session?.peutValiderDossiers !== false;
  const peutGererReclamations = session?.peutGererReclamations !== false;

  const primaryDrawerItems: DrawerItem[] = [
    { route: overviewRoute, label: 'Dashboard', icon: 'dashboard', count: null, exact: true },
    ...(peutValiderDossiers ? [
      { route: dossiersRoute, label: 'Dossier Auto-affiliation', icon: 'assignment', count: counts.affiliationRequests || null },
      { route: `${workspaceBaseRoute}/demande-extention`, label: 'Demande d\'extension', icon: 'add_business', count: counts.extentionRequests || null },
      { route: `${workspaceBaseRoute}/tpe-a-affecter`, label: 'TPE à affecter', icon: 'point_of_sale', count: counts.tpeToAssign || null, exact: true },
      { route: `${workspaceBaseRoute}/historique`, label: 'Historique', icon: 'history', count: null, exact: true },
      { route: `${workspaceBaseRoute}/demandes-commerciales`, label: 'Dossier Prospection commerciale', icon: 'edit_note', count: counts.commercialRequests || null },
    ] : []),
    ...(peutGererReclamations ? [
      { route: `${workspaceBaseRoute}/reclamations`, label: 'Réclamations TPE', icon: 'support_agent', count: counts.reclamationsActives || null, exact: true },
      { route: `${workspaceBaseRoute}/reclamations-historique`, label: 'Historique réclamations', icon: 'task_alt', count: null, exact: true },
    ] : []),
    { route: `${workspaceBaseRoute}/profil`, label: 'Profil', icon: 'person', count: null, exact: true },
  ];

  return (
    <WorkspaceDashboard
      roleClass="role-backoffice"
      primaryDrawerItems={primaryDrawerItems}
      secondaryDrawerItems={[]}
      summaryTiles={summaryTiles}
      notificationItems={notificationItems}
      unseenNotificationCount={unseenNotificationCount}
      onNotificationMenuOpened={handleNotificationMenuOpened}
      canManageAffiliationRequests={true}
      errorMessage={errorMessage}
      isRefreshingCounts={isRefreshingCounts}
      isLoading={isLoading}
      pageTitle={pageTitle}
      pageDescription={pageDescription}
      passwordActionRoute="/forgot-password"
    />
  );
}
