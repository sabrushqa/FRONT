import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import WorkspaceDashboard, { DrawerItem, NotificationItem } from '../workspace/WorkspaceDashboard';
import { useSessionStore, useEffectiveAffiliationType, type AffiliationProfile } from '../../store/sessionStore';
import { currentSession } from '../auth/services/authApi';
import { normalizeUserSessionResponse } from '../../store/sessionStore';
import { getMerchantNotifications, markMerchantNotificationsAsRead, CommercantNotificationItem } from './services/commercantApi';
import { formatRelativeDate } from '../workspace/workspaceUtils';
import '../../styles/workspace-page.scss';
import '../../styles/workspace-navbar.scss';
import '../../styles/workspace-drawer-actions.scss';
import '../../styles/workspace-commercant-drawer.scss';
import '../../styles/commercant-page.scss';
import '../../styles/commercant-dashboard.scss';

export default function CommercantDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, setSession, clearSession, activeAffiliationProfile, setActiveAffiliationProfile } = useSessionStore();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [pageTitle, setPageTitle] = useState('État du dossier');
  const [pageDescription, setPageDescription] = useState('');
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [unseenNotificationCount, setUnseenNotificationCount] = useState(0);

  const workspaceBaseRoute = '/commercant';

  // Ex: "Votre contrat de nouveau point de vente est disponible..." (creee
  // par StaffAffiliationManagementService::createNotification cote back
  // office quand une demande d'extension est validee) — sans cette cloche,
  // le commerçant ne savait que via l'e-mail qu'un contrat l'attendait.
  const mapNotification = useCallback((item: CommercantNotificationItem): NotificationItem => ({
    notificationId: item.notificationId,
    dossierId: item.dossierId ?? 0,
    title: item.message,
    helper: formatRelativeDate(item.dateEnvoi),
    route: `${workspaceBaseRoute}/demande-pdv`,
    isNew: !item.read,
    type: item.type
  }), [workspaceBaseRoute]);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await getMerchantNotifications();
      setNotificationItems(response.notifications.map(mapNotification));
      setUnseenNotificationCount(response.unreadCount);
    } catch {
      // Silencieux : la cloche reste vide si l'appel echoue.
    }
  }, [mapNotification]);

  async function handleNotificationMenuOpened() {
    try {
      const response = await markMerchantNotificationsAsRead();
      setNotificationItems(response.notifications.map(mapNotification));
      setUnseenNotificationCount(response.unreadCount);
    } catch {
      // Ignore.
    }
  }

  // Notifications non pertinentes tant que l'espace n'est pas debloque (pas
  // encore de "Nouvelle demande" possible), ni pour un sous-commerçant (qui
  // ne soumet pas d'extension). Chargees des que l'espace s'ouvre, puis
  // rafraichies periodiquement : sans ca, une notification creee pendant que
  // la page est deja ouverte (contrat genere par le back office) ne serait
  // visible qu'apres un rechargement complet — meme logique que CommercialDashboard.tsx.
  useEffect(() => {
    if (!session?.workspaceUnlocked || session.role === 'SOUS_COMMERCANT') return;
    void loadNotifications();
    const intervalId = window.setInterval(() => { void loadNotifications(); }, 45000);
    return () => window.clearInterval(intervalId);
  }, [session?.workspaceUnlocked, session?.role, loadNotifications]);

  useEffect(() => {
    const metaMap: Record<string, { title: string; description: string }> = {
      [`${workspaceBaseRoute}/dashboard`]: { title: 'Tableau de bord', description: 'Suivez les transactions, les points de vente, les sous-commerçants et les TPE.' },
      [`${workspaceBaseRoute}/etat-dossier`]: { title: 'État du dossier', description: 'Suivez le traitement de votre demande d\'affiliation.' },
      [`${workspaceBaseRoute}/profil`]: { title: 'Profil commerçant', description: 'Retrouvez les informations principales de votre compte marchand.' },
      [`${workspaceBaseRoute}/transactions`]: { title: 'Transactions', description: 'Consultez les transactions récentes de votre compte.' },
      [`${workspaceBaseRoute}/points-de-vente`]: { title: 'Points de vente', description: 'Affichez les points de vente rattachés à votre compte.' },
      [`${workspaceBaseRoute}/demande-pdv`]: { title: 'Demande PDV', description: 'Demandez un nouveau point de vente.' },
      [`${workspaceBaseRoute}/sous-commercants`]: { title: 'Sous-commerçants', description: 'Suivez les comptes secondaires liés à vos points de vente.' },
      [`${workspaceBaseRoute}/tpe`]: { title: 'Terminaux TPE', description: 'Visualisez les terminaux attribués à votre activité.' },
      [`${workspaceBaseRoute}/reclamations`]: { title: 'Réclamations', description: 'Accédez au suivi des incidents et demandes d\'assistance.' },
      [`${workspaceBaseRoute}/mes-reclamations`]: { title: 'Mes réclamations', description: 'Suivez l\'avancement de vos réclamations en cours et consultez votre historique.' },
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

  useEffect(() => {
    if (isLoading || !session) return;
    if (session.role === 'SOUS_COMMERCANT') return;

    const path = location.pathname.split('?')[0];
    const isRequestStatusRoute = path === `${workspaceBaseRoute}/etat-dossier` || path === workspaceBaseRoute;

    if (!session.workspaceUnlocked && !isRequestStatusRoute) {
      navigate(`${workspaceBaseRoute}/etat-dossier`, { replace: true });
      return;
    }

    if (session.workspaceUnlocked && isRequestStatusRoute) {
      navigate(`${workspaceBaseRoute}/dashboard`, { replace: true });
    }
  }, [isLoading, session, location.pathname, navigate]);

  async function loadSession() {
    setErrorMessage('');
    // Une session en cache (sessionStorage) sert un affichage instantane, mais
    // ne doit jamais empecher de recharger les donnees fraiches depuis le
    // backend : sans ca, un commerçant qui reste connecte (ou recharge la
    // page) ne voyait JAMAIS ses PDV/TPE/compteurs se mettre a jour apres
    // qu'un back-office valide une demande d'extension et affecte un TPE —
    // seule une deconnexion/reconnexion complette rafraichissait quoi que ce
    // soit. On garde `session` a l'ecran pendant le fetch (pas de flash de
    // chargement) et on ne redirige vers /login que si on n'avait rien a
    // afficher en attendant (pas de session en cache).
    const hadCachedSession = !!session;
    if (!hadCachedSession) setIsLoading(true);
    try {
      const response = await currentSession();
      const normalized = normalizeUserSessionResponse(response as Parameters<typeof normalizeUserSessionResponse>[0]);
      setSession(normalized);
    } catch {
      if (!hadCachedSession) {
        clearSession();
        window.sessionStorage.setItem('authSuccessMessage', 'Votre session a expiré. Connectez-vous de nouveau.');
        navigate('/login');
      }
      // Sinon : echec transitoire du rafraichissement, on garde les donnees
      // deja en cache plutot que de deconnecter un commerçant deja valide.
    } finally {
      setIsLoading(false);
    }
  }

  const isSubMerchant = session?.role === 'SOUS_COMMERCANT';
  const isMerchantWorkspaceUnlocked = session?.workspaceUnlocked === true;
  // E-commerce merchants have no physical point de vente / TPE — they operate
  // a site marchand / application mobile instead (see CommercantOverviewPage,
  // CommercantProfilePage, CommercantSubCommercantsPage).
  const isEcommerce = useEffectiveAffiliationType() === 'E_COMMERCE';
  const hasCombinedAffiliation = session?.typeAffiliation === 'ENCAISSEMENT_ET_ECOMMERCE';

  const primaryDrawerItems: DrawerItem[] = isSubMerchant ? [
    { route: `${workspaceBaseRoute}/dashboard`, label: 'Dashboard', icon: 'dashboard', count: null, exact: true },
    { route: `${workspaceBaseRoute}/transactions`, label: 'Transactions', icon: 'receipt_long', count: null, exact: true },
    ...(isEcommerce ? [] : [
      { route: `${workspaceBaseRoute}/points-de-vente`, label: 'Infos PDV', icon: 'storefront', count: null, exact: true },
      { route: `${workspaceBaseRoute}/tpe`, label: 'Terminaux TPE', icon: 'devices', count: null, exact: true },
    ]),
    // Absentes jusqu'ici de ce menu (omission, pas un choix metier — le
    // backend (ChatbotProxyController/ReclamationController) accepte deja
    // SOUS_COMMERCANT et scope correctement au PDV/TPE du sous-commerçant) :
    // sans ces deux entrees, le chat et l'historique des reclamations
    // n'etaient accessibles que par URL directe, jamais depuis la navigation.
    { route: `${workspaceBaseRoute}/reclamations`, label: 'Réclamations', icon: 'report_problem', count: null, exact: true },
    { route: `${workspaceBaseRoute}/mes-reclamations`, label: 'Mes réclamations', icon: 'fact_check', count: null, exact: true },
    { route: `${workspaceBaseRoute}/profil`, label: 'Profil', icon: 'person', count: null, exact: true },
  ] : isMerchantWorkspaceUnlocked ? [
    { route: `${workspaceBaseRoute}/dashboard`, label: 'Tableau de bord', icon: 'dashboard', count: null, exact: true },
    { route: `${workspaceBaseRoute}/profil`, label: 'Profil', icon: 'person', count: null, exact: true },
    { route: `${workspaceBaseRoute}/transactions`, label: 'Transactions', icon: 'receipt_long', count: null, exact: true },
    ...(isEcommerce ? [] : [
      { route: `${workspaceBaseRoute}/points-de-vente`, label: 'Points de vente', icon: 'storefront', count: null, exact: true },
      // Extension d'affiliation : reservee au canal encaissement (TPE/SoftPOS/QR
      // Code) — un commercant e-commerce (pur, ou bascule sur l'espace
      // E-commerce d'une affiliation combinee) n'a plus de nouvelle demande a
      // faire ici, voir CommercantPdvRequestPage.tsx.
      { route: `${workspaceBaseRoute}/demande-pdv`, label: 'Nouvelle demande', icon: 'add_business', count: null, exact: true },
    ]),
    // Les sous-commercants ne sont geres que pour le canal encaissement (TPE) —
    // ni pour un commercant e-commerce pur, ni pour le cote e-commerce d'une
    // affiliation combinee (cf. CommercantSubCommercantsPage.tsx et le meme
    // garde-fou cote backend, MerchantWorkspaceManagementService::createSubMerchant).
    ...(isEcommerce ? [] : [
      { route: `${workspaceBaseRoute}/sous-commercants`, label: 'Sous-commerçants', icon: 'group', count: null, exact: true },
      { route: `${workspaceBaseRoute}/tpe`, label: 'Terminaux TPE', icon: 'devices', count: null, exact: true },
    ]),
    { route: `${workspaceBaseRoute}/reclamations`, label: 'Réclamations', icon: 'report_problem', count: null, exact: true },
    { route: `${workspaceBaseRoute}/mes-reclamations`, label: 'Mes réclamations', icon: 'fact_check', count: null, exact: true },
  ] : [
    { route: `${workspaceBaseRoute}/etat-dossier`, label: 'État demande', icon: 'assignment', count: null, exact: true },
  ];

  const profileSwitcher = hasCombinedAffiliation ? (
    <div
      className={`profile-toggle-track${activeAffiliationProfile === 'E_COMMERCE' ? ' is-ecommerce' : ''}`}
      role="radiogroup"
      aria-label="Profil affiché"
    >
      <button
        type="button"
        role="radio"
        aria-checked={activeAffiliationProfile === 'ENCAISSEMENT'}
        className={`profile-toggle-btn${activeAffiliationProfile === 'ENCAISSEMENT' ? ' is-active' : ''}`}
        onClick={() => setActiveAffiliationProfile('ENCAISSEMENT')}
      >
        Compte Encaissement
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={activeAffiliationProfile === 'E_COMMERCE'}
        className={`profile-toggle-btn${activeAffiliationProfile === 'E_COMMERCE' ? ' is-active' : ''}`}
        onClick={() => setActiveAffiliationProfile('E_COMMERCE')}
      >
        Compte E-commerce
      </button>
    </div>
  ) : null;

  return (
    <WorkspaceDashboard
      roleClass={isSubMerchant ? 'role-merchant role-submerchant' : 'role-merchant'}
      isCommercialWorkspace={true}
      primaryDrawerItems={primaryDrawerItems}
      secondaryDrawerItems={[]}
      summaryTiles={[]}
      notificationItems={notificationItems}
      unseenNotificationCount={unseenNotificationCount}
      onNotificationMenuOpened={handleNotificationMenuOpened}
      canManageAffiliationRequests={false}
      errorMessage={errorMessage}
      isLoading={isLoading}
      pageTitle={pageTitle}
      pageDescription={pageDescription}
      passwordActionRoute="/forgot-password"
      headerExtra={profileSwitcher}
    />
  );
}
