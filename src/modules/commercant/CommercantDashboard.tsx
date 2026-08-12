import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import WorkspaceDashboard, { DrawerItem } from '../workspace/WorkspaceDashboard';
import { useSessionStore, useEffectiveAffiliationType, type AffiliationProfile } from '../../store/sessionStore';
import { currentSession } from '../auth/services/authApi';
import { normalizeUserSessionResponse } from '../../store/sessionStore';
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

  const workspaceBaseRoute = '/commercant';

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
    setIsLoading(true);
    try {
      if (session) {
        return;
      }
      const response = await currentSession();
      const normalized = normalizeUserSessionResponse(response as Parameters<typeof normalizeUserSessionResponse>[0]);
      setSession(normalized);
    } catch {
      clearSession();
      window.sessionStorage.setItem('authSuccessMessage', 'Votre session a expiré. Connectez-vous de nouveau.');
      navigate('/login');
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
    { route: `${workspaceBaseRoute}/profil`, label: 'Profil', icon: 'person', count: null, exact: true },
  ] : isMerchantWorkspaceUnlocked ? [
    { route: `${workspaceBaseRoute}/dashboard`, label: 'Tableau de bord', icon: 'dashboard', count: null, exact: true },
    { route: `${workspaceBaseRoute}/profil`, label: 'Profil', icon: 'person', count: null, exact: true },
    { route: `${workspaceBaseRoute}/transactions`, label: 'Transactions', icon: 'receipt_long', count: null, exact: true },
    ...(isEcommerce ? [] : [
      { route: `${workspaceBaseRoute}/points-de-vente`, label: 'Points de vente', icon: 'storefront', count: null, exact: true },
    ]),
    { route: `${workspaceBaseRoute}/demande-pdv`, label: 'Nouvelle demande', icon: 'add_business', count: null, exact: true },
    { route: `${workspaceBaseRoute}/sous-commercants`, label: 'Sous-commerçants', icon: 'group', count: null, exact: true },
    ...(isEcommerce ? [] : [
      { route: `${workspaceBaseRoute}/tpe`, label: 'Terminaux TPE', icon: 'devices', count: null, exact: true },
    ]),
    { route: `${workspaceBaseRoute}/reclamations`, label: 'Réclamations', icon: 'report_problem', count: null, exact: true },
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
