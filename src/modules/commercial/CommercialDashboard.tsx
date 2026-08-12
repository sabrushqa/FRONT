import React, { useEffect, useState } from 'react';
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
import { currentSession } from '../auth/services/authApi';
import { normalizeUserSessionResponse } from '../../store/sessionStore';
import { resolveAffiliationStatusKey, isCommercialDirectRequest, isNewPdvRequest, isAutoAffiliationRequest, isSameRegionAsCommercial, formatRelativeDate } from '../workspace/workspaceUtils';
import '../../styles/workspace-page.scss';
import '../../styles/workspace-navbar.scss';
import '../../styles/workspace-drawer-actions.scss';
import '../../styles/commercial-page.scss';
import '../../styles/commercial-dashboard.scss';

export default function CommercialDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, setSession, clearSession } = useSessionStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingCounts, setIsRefreshingCounts] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pageTitle, setPageTitle] = useState('Dashboard commercial');
  const [pageDescription, setPageDescription] = useState('');

  const [counts, setCounts] = useState({
    affiliationRequests: 0,
    newPdvRequests: 0,
    commercialDirectRequests: 0,
    commercialDirectMerchants: 0,
    affiliationPending: 0,
    affiliationCorrection: 0,
    affiliationProgress: 0,
    affiliationSent: 0,
    affiliationRefused: 0,
  });

  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [unseenNotificationCount, setUnseenNotificationCount] = useState(0);

  const workspaceBaseRoute = '/commercial';
  const overviewRoute = `${workspaceBaseRoute}/dashboard`;
  const dossiersRoute = `${workspaceBaseRoute}/dossiers`;
  const profileRoute = `${workspaceBaseRoute}/profil`;

  useEffect(() => {
    const metaMap: Record<string, { title: string; description: string }> = {
      [`${workspaceBaseRoute}/dashboard`]: { title: 'Dashboard commercial', description: 'Consultez rapidement vos dossiers commerçants.' },
      [`${workspaceBaseRoute}/dossiers`]: { title: 'Dossiers commerçants', description: 'Consultez les demandes créées depuis le formulaire auto-affiliation.' },
      [`${workspaceBaseRoute}/demande-extention`]: { title: "Demandes d'extension", description: 'Traitez les demandes additionnelles des commerçants déjà affiliés.' },
      [`${workspaceBaseRoute}/demandes-commerciales`]: { title: 'Demandes commerciales', description: 'Reprenez les brouillons commerciaux.' },
      [`${workspaceBaseRoute}/commercants-ajoutes`]: { title: 'Commerçants ajoutés', description: 'Suivez les commerçants créés par le poste commercial.' },
      [`${workspaceBaseRoute}/calendrier`]: { title: 'Calendrier commercial', description: 'Planifiez et consultez les relances commerciales.' },
      [`${workspaceBaseRoute}/dossiers/new`]: { title: 'Nouvelle demande', description: 'Créez une affiliation par la commerciale.' },
      [`${workspaceBaseRoute}/profil`]: { title: 'Profil commercial', description: 'Retrouvez vos informations de session.' },
    };
    const path = location.pathname.split('?')[0];
    const meta = metaMap[path];
    if (meta) {
      setPageTitle(meta.title);
      setPageDescription(meta.description);
    }
  }, [location.pathname]);

  useEffect(() => {
    loadSession();
  }, []);

  // Rafraîchit la cloche de notifications périodiquement : sans ça, une
  // notification créée pendant que la page est déjà ouverte (nouvelle
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
      // Si la session est déjà valide (chargée par Login.tsx), évite un
      // aller-retour /me inutile qui crée une race condition avec les pages enfants.
      if (session) {
        await refreshCounts(true, session);
        await loadNotifications();
        return;
      }
      const response = await currentSession();
      const normalized = normalizeUserSessionResponse(response as Parameters<typeof normalizeUserSessionResponse>[0]);
      setSession(normalized);
      await refreshCounts(true, normalized);
      await loadNotifications();
    } catch {
      clearSession();
      window.sessionStorage.setItem('authSuccessMessage', 'Votre session a expiré. Connectez-vous de nouveau.');
      navigate('/login');
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshCounts(initialLoad = false, sessionData?: ReturnType<typeof normalizeUserSessionResponse>) {
    const nom = sessionData?.nom ?? session?.nom ?? '';
    const email = sessionData?.email ?? session?.email ?? '';
    const region = sessionData?.profile?.region ?? session?.profile?.region ?? '';
    if (!initialLoad) setIsRefreshingCounts(true);

    try {
      const affiliationResult = await getAffiliationRequests();
      const requests: AffiliationRequestItem[] = Array.isArray(affiliationResult.requests) ? affiliationResult.requests : [];

      const autoRequests = requests.filter(isAutoAffiliationRequest).filter((r) => isSameRegionAsCommercial(r, region));
      const newPdvReqs = requests.filter(isNewPdvRequest);
      const commercialDirectReqs = requests.filter(isCommercialDirectRequest).filter((r) => {
        const label = normalizeForMatch(r.commercialAttribue);
        if (!label) return false;
        const candidates = [nom, email].map(normalizeForMatch).filter(Boolean);
        return candidates.some((c) => label === c || label.includes(c) || c.includes(label));
      });

      const merchantKeys = new Set<number | string>();
      for (const r of commercialDirectReqs) {
        merchantKeys.add(r.commercantId ?? r.email ?? r.dossierId);
      }

      const statusCounts = { pending: 0, progress: 0, sent: 0, active: 0, refused: 0 };
      for (const req of autoRequests) {
        statusCounts[resolveAffiliationStatusKey(req)] += 1;
      }
      const correctionCount = [...autoRequests, ...commercialDirectReqs].filter(isCorrectionRequest).length;

      setCounts({
        affiliationRequests: autoRequests.length,
        newPdvRequests: newPdvReqs.length,
        commercialDirectRequests: commercialDirectReqs.length,
        commercialDirectMerchants: merchantKeys.size,
        affiliationPending: statusCounts.pending,
        affiliationCorrection: correctionCount,
        affiliationProgress: statusCounts.progress,
        affiliationSent: statusCounts.sent,
        affiliationRefused: statusCounts.refused,
      });
    } catch {
      setErrorMessage('Les indicateurs du workspace commercial sont indisponibles.');
    } finally {
      setIsRefreshingCounts(false);
    }
  }

  function normalizeForMatch(value: string | null | undefined): string {
    return (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  }

  function isCorrectionRequest(request: AffiliationRequestItem): boolean {
    return request.status === 'INCOMPLET';
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
      // Silencieux : la cloche reste vide si l'appel échoue.
    }
  }

  async function handleNotificationMenuOpened() {
    try {
      const response = await markAllNotificationsAsRead();
      setNotificationItems(response.notifications.map(mapNotification));
      setUnseenNotificationCount(response.unreadCount);
    } catch {
      // Ignore.
    }
  }

  const isOnOverview = location.pathname.split('?')[0] === overviewRoute;

  const summaryTiles: SummaryTile[] = isOnOverview ? [
    { label: 'À corriger', value: counts.affiliationCorrection, helper: 'Retours BOA avec motif' },
    { label: 'En cours', value: counts.affiliationProgress, helper: 'Contrat signé ou en attente back office' },
    { label: 'Refusés', value: counts.affiliationRefused, helper: 'Avec motif de retour' },
    { label: 'Contrat à signer', value: counts.affiliationSent, helper: 'Activation et contrat envoyés' },
  ] : [];

  const primaryDrawerItems: DrawerItem[] = [
    { route: overviewRoute, label: 'Dashboard', icon: 'dashboard', count: null, exact: true },
    { route: dossiersRoute, label: 'Auto-affiliation', icon: 'assignment', count: counts.affiliationRequests },
    { route: `${workspaceBaseRoute}/demande-extention`, label: "Demande d'extension", icon: 'add_business', count: counts.newPdvRequests },
    { route: `${workspaceBaseRoute}/demandes-commerciales`, label: 'Demandes commerciales', icon: 'edit_note', count: counts.commercialDirectRequests },
    { route: `${workspaceBaseRoute}/commercants-ajoutes`, label: 'Commerçants ajoutés', icon: 'storefront', count: counts.commercialDirectMerchants },
    { route: `${workspaceBaseRoute}/calendrier`, label: 'Calendrier', icon: 'event_note', count: null, exact: true },
    { route: `${dossiersRoute}/new`, label: 'Nouvelle demande', icon: 'add_box', count: null, exact: true },
    { route: profileRoute, label: 'Profil', icon: 'person', count: null, exact: true },
  ];

  return (
    <WorkspaceDashboard
      roleClass="role-commercial-user"
      isCommercialWorkspace={true}
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
