import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import WorkspaceDashboard, { DrawerItem, SummaryTile } from '../workspace/WorkspaceDashboard';
import { useSessionStore } from '../../store/sessionStore';
import { getAffiliationRequests, AffiliationRequestItem } from '../supervisor/services/supervisorApi';
import { getReclamationStats } from './services/reclamationsApi';
import { currentSession } from '../auth/services/authApi';
import { normalizeUserSessionResponse } from '../../store/sessionStore';
import {
  isAutoAffiliationRequest,
  isCommercialDirectRequest,
  isHandledByCurrentBackOffice,
  isNewPdvRequest,
  resolveAffiliationStatusKey
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
    affiliationPending: 0,
    affiliationProgress: 0,
    affiliationSent: 0,
    affiliationRefused: 0,
    commercialRequests: 0,
    reclamationsActives: 0,
  });

  const workspaceBaseRoute = '/backoffice';
  const overviewRoute = `${workspaceBaseRoute}/dashboard`;
  const dossiersRoute = `${workspaceBaseRoute}/dossiers`;

  useEffect(() => {
    const metaMap: Record<string, { title: string; description: string }> = {
      [`${workspaceBaseRoute}/dashboard`]: { title: 'Dashboard back office', description: 'Pilotez les dossiers à vérifier et les validations finales.' },
      [`${workspaceBaseRoute}/dossiers`]: { title: 'Dossiers back office', description: 'Consultez, vérifiez et traitez les dossiers transmis au back office.' },
      [`${workspaceBaseRoute}/demande-extention`]: { title: 'Demandes d\'extension', description: 'Validez ou refusez les extensions des commerçants déjà affiliés.' },
      [`${workspaceBaseRoute}/historique`]: { title: 'Historique back office', description: 'Consultez les dossiers déjà traités.' },
      [`${workspaceBaseRoute}/demandes-commerciales`]: { title: 'Demandes à valider', description: 'Consultez les prospections et demandes de nouveaux PDV.' },
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
      { route: dossiersRoute, label: 'Dossiers', icon: 'assignment', count: counts.affiliationRequests || null },
      { route: `${workspaceBaseRoute}/demande-extention`, label: 'Demande d\'extension', icon: 'add_business', count: counts.extentionRequests || null },
      { route: `${workspaceBaseRoute}/historique`, label: 'Historique', icon: 'history', count: null, exact: true },
      { route: `${workspaceBaseRoute}/demandes-commerciales`, label: 'Demandes à valider', icon: 'edit_note', count: counts.commercialRequests || null },
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
