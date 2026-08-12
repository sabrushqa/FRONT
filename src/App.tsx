import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthShell from './modules/auth/AuthShell';
import ProtectedRoute from './guards/ProtectedRoute';
import ErrorBoundary from './guards/ErrorBoundary';

// ── Workspace shells (lazy par rôle pour alléger le premier chargement) ───────
const SupervisorDashboard = lazy(() => import('./modules/supervisor/SupervisorDashboard'));
const CommercialDashboard = lazy(() => import('./modules/commercial/CommercialDashboard'));
const BackofficeDashboard = lazy(() => import('./modules/backoffice/BackofficeDashboard'));
const CommercantDashboard = lazy(() => import('./modules/commercant/CommercantDashboard'));

// ── Supervisor pages (lazy) ───────────────────────────────────────────────────
const SupervisorOverviewPage          = lazy(() => import('./modules/supervisor/pages/overview/SupervisorOverviewPage'));
const SupervisorPipelinePage          = lazy(() => import('./modules/supervisor/pages/pipeline/SupervisorPipelinePage'));
const SupervisorActivityConversionPage = lazy(() => import('./modules/supervisor/pages/activity-conversion/SupervisorActivityConversionPage'));
const SupervisorTeamPerformancePage   = lazy(() => import('./modules/supervisor/pages/team-performance/SupervisorTeamPerformancePage'));
const SupervisorAffiliationListPage   = lazy(() => import('./modules/supervisor/pages/affiliation-list/SupervisorAffiliationListPage'));
const SupervisorAffiliationDetailPage = lazy(() => import('./modules/supervisor/pages/affiliation-detail/SupervisorAffiliationDetailPage'));
const SupervisorDirectoryPage         = lazy(() => import('./modules/supervisor/pages/directory/SupervisorDirectoryPage'));
const SupervisorStaffCreatePage       = lazy(() => import('./modules/supervisor/pages/staff-create/SupervisorStaffCreatePage'));
const SupervisorTpeStockPage          = lazy(() => import('./modules/supervisor/pages/tpe-stock/SupervisorTpeStockPage'));
const SupervisorReclamationsPage      = lazy(() => import('./modules/supervisor/pages/reclamations/SupervisorReclamationsPage'));
const SupervisorGeoMapPage            = lazy(() => import('./modules/supervisor/pages/geo-map/SupervisorGeoMapPage'));
const SupervisorPdvMapPage            = lazy(() => import('./modules/supervisor/pages/pdv-map/SupervisorPdvMapPage'));
const SupervisorProfilePage           = lazy(() => import('./modules/supervisor/pages/profile/SupervisorProfilePage'));
const SupervisorSecurityPage          = lazy(() => import('./modules/supervisor/pages/security/SupervisorSecurityPage'));

// ── Commercial pages (lazy) ───────────────────────────────────────────────────
const CommercialOverviewPage       = lazy(() => import('./modules/commercial/pages/overview/CommercialOverviewPage'));
const CommercialDossiersPage       = lazy(() => import('./modules/commercial/pages/dossiers/CommercialDossiersPage'));
const CommercialDossierDetailPage  = lazy(() => import('./modules/commercial/pages/dossier-detail/CommercialDossierDetailPage'));
const CommercialDossierCreatePage  = lazy(() => import('./modules/commercial/pages/dossier-create/CommercialDossierCreatePage'));
const CommercialDirectRequestsPage = lazy(() => import('./modules/commercial/pages/direct-requests/CommercialDirectRequestsPage'));
const CommercialDirectMerchantsPage= lazy(() => import('./modules/commercial/pages/direct-merchants/CommercialDirectMerchantsPage'));
const CommercialCalendarPage       = lazy(() => import('./modules/commercial/pages/calendar/CommercialCalendarPage'));
const CommercialProfilePage        = lazy(() => import('./modules/commercial/pages/profile/CommercialProfilePage'));

// ── Backoffice pages (lazy) ───────────────────────────────────────────────────
const BackofficeOverviewPage              = lazy(() => import('./modules/backoffice/pages/overview/BackofficeOverviewPage'));
const BackofficeDossiersPage              = lazy(() => import('./modules/backoffice/pages/dossiers/BackofficeDossiersPage'));
const BackofficeDossierDetailPage         = lazy(() => import('./modules/backoffice/pages/dossier-detail/BackofficeDossierDetailPage'));
const BackofficeDemandeExtentionPage      = lazy(() => import('./modules/backoffice/pages/demande-extention/BackofficeDemandeExtentionPage'));
const BackofficeDemandeExtentionDetailPage= lazy(() => import('./modules/backoffice/pages/demande-extention-detail/BackofficeDemandeExtentionDetailPage'));
const BackofficeHistoryPage               = lazy(() => import('./modules/backoffice/pages/history/BackofficeHistoryPage'));
const BackofficeCommercialRequestsPage    = lazy(() => import('./modules/backoffice/pages/commercial-requests/BackofficeCommercialRequestsPage'));
const BackofficeCommercialRequestDetailPage = lazy(() => import('./modules/backoffice/pages/commercial-request-detail/BackofficeCommercialRequestDetailPage'));
const BackofficeProfilePage               = lazy(() => import('./modules/backoffice/pages/profile/BackofficeProfilePage'));
const BackofficeReclamationsPage          = lazy(() => import('./modules/backoffice/pages/reclamations/BackofficeReclamationsPage'));
const BackofficeReclamationHistoryPage    = lazy(() => import('./modules/backoffice/pages/reclamation-history/BackofficeReclamationHistoryPage'));

// ── Commercant pages (lazy) ───────────────────────────────────────────────────
const CommercantOverviewPage       = lazy(() => import('./modules/commercant/pages/overview/CommercantOverviewPage'));
const CommercantRequestStatusPage  = lazy(() => import('./modules/commercant/pages/request-status/CommercantRequestStatusPage'));
const CommercantProfilePage        = lazy(() => import('./modules/commercant/pages/profile/CommercantProfilePage'));
const CommercantTransactionsPage   = lazy(() => import('./modules/commercant/pages/transactions/CommercantTransactionsPage'));
const CommercantPdvsPage           = lazy(() => import('./modules/commercant/pages/pdvs/CommercantPdvsPage'));
const CommercantPdvRequestPage     = lazy(() => import('./modules/commercant/pages/pdv-request/CommercantPdvRequestPage'));
const CommercantSubCommercantsPage = lazy(() => import('./modules/commercant/pages/sub-commercants/CommercantSubCommercantsPage'));
const CommercantTpesPage           = lazy(() => import('./modules/commercant/pages/tpes/CommercantTpesPage'));
const CommercantReclamationsPage   = lazy(() => import('./modules/commercant/pages/reclamations/CommercantReclamationsPage'));

export default function App() {
  return (
    <ErrorBoundary>
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#64748b' }}>Chargement…</div>}>
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={<AuthShell mode="login" />} />
      <Route path="/register" element={<AuthShell mode="register" />} />
      <Route path="/forgot-password" element={<AuthShell mode="forgot" />} />
      <Route path="/activate-account" element={<AuthShell mode="activate" />} />
      <Route path="/inscription" element={<Navigate to="/register" replace />} />
      <Route path="/reset-password" element={<Navigate to="/forgot-password" replace />} />

      {/* Supervisor workspace */}
      <Route
        path="/supervisor"
        element={
          <ProtectedRoute roles={['SUPERVISEUR']}>
            <SupervisorDashboard />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<SupervisorOverviewPage />} />
        <Route path="pipeline" element={<SupervisorPipelinePage />} />
        <Route path="activite-conversion" element={<SupervisorActivityConversionPage />} />
        <Route path="performance-equipes" element={<SupervisorTeamPerformancePage />} />
        {/* Anciennes pages fusionnées — redirections pour ne pas casser d'anciens liens/marque-pages. */}
        <Route path="auto-affiliation-mois" element={<Navigate to="../activite-conversion" replace />} />
        <Route path="prospection-mois" element={<Navigate to="../activite-conversion" replace />} />
        <Route path="conversion-demandes" element={<Navigate to="../activite-conversion" replace />} />
        <Route path="segmentation-demandes" element={<Navigate to="../activite-conversion" replace />} />
        <Route path="performance-commerciale" element={<Navigate to="../performance-equipes" replace />} />
        <Route path="performance-boa" element={<Navigate to="../performance-equipes" replace />} />
        <Route path="top-prospection-commerciale" element={<Navigate to="../performance-equipes" replace />} />
        <Route path="top-auto-region" element={<Navigate to="../performance-equipes" replace />} />
        <Route path="affiliation-requests" element={<SupervisorAffiliationListPage />} />
        <Route path="affiliation-requests/:dossierId" element={<SupervisorAffiliationDetailPage />} />
        <Route path="prospections" element={<CommercialDirectRequestsPage scope="supervisor" />} />
        <Route path="back-offices" element={<SupervisorDirectoryPage directoryType="backOffices" />} />
        <Route path="commercial" element={<SupervisorDirectoryPage directoryType="commerciales" />} />
        <Route path="commerciales" element={<Navigate to="../commercial" replace />} />
        <Route path="commercants" element={<SupervisorDirectoryPage directoryType="commercants" />} />
        <Route path="tpes" element={<SupervisorTpeStockPage />} />
        <Route path="reclamations" element={<SupervisorReclamationsPage />} />
        <Route path="geo-map" element={<SupervisorGeoMapPage />} />
        <Route path="pdv-map" element={<SupervisorPdvMapPage />} />
        <Route path="back-offices/new" element={<SupervisorStaffCreatePage staffType="backOffice" />} />
        <Route path="commercial/new" element={<SupervisorStaffCreatePage staffType="commerciale" />} />
        <Route path="security" element={<SupervisorSecurityPage />} />
        <Route path="profil" element={<SupervisorProfilePage />} />
        <Route path="*" element={<Navigate to="overview" replace />} />
      </Route>

      {/* Commercial workspace */}
      <Route
        path="/commercial"
        element={
          <ProtectedRoute roles={['COMMERCIAL']}>
            <CommercialDashboard />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CommercialOverviewPage />} />
        <Route path="dossiers/new" element={<CommercialDossierCreatePage />} />
        <Route path="dossiers/:dossierId/continue" element={<CommercialDossierCreatePage />} />
        <Route path="dossiers/:dossierId" element={<CommercialDossierDetailPage requestScope="auto" />} />
        <Route path="dossiers" element={<CommercialDossiersPage requestScope="auto" />} />
        <Route path="demande-extention/:dossierId" element={<CommercialDossierDetailPage requestScope="new-pdv" />} />
        <Route path="demande-extention" element={<CommercialDossiersPage requestScope="new-pdv" />} />
        <Route path="demandes-pdv/:dossierId" element={<CommercialDossierDetailPage requestScope="new-pdv" />} />
        <Route path="demandes-pdv" element={<Navigate to="/commercial/demande-extention" replace />} />
        <Route path="demandes-commerciales/:dossierId/continue" element={<CommercialDossierCreatePage />} />
        <Route path="demandes-commerciales/:dossierId" element={<CommercialDossierDetailPage requestScope="commercial" />} />
        <Route path="demandes-commerciales" element={<CommercialDirectRequestsPage />} />
        <Route path="commercants-ajoutes" element={<CommercialDirectMerchantsPage />} />
        <Route path="calendrier" element={<CommercialCalendarPage />} />
        <Route path="profil" element={<CommercialProfilePage />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>

      {/* Backoffice workspace */}
      <Route path="/back-office" element={<Navigate to="/backoffice" replace />} />
      <Route
        path="/backoffice"
        element={
          <ProtectedRoute roles={['BACK_OFFICE']}>
            <BackofficeDashboard />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<BackofficeOverviewPage />} />
        <Route path="dossiers" element={<BackofficeDossiersPage />} />
        <Route path="dossiers/:dossierId" element={<BackofficeDossierDetailPage />} />
        <Route path="demande-extention" element={<BackofficeDemandeExtentionPage />} />
        <Route path="demande-extention/:dossierId" element={<BackofficeDemandeExtentionDetailPage />} />
        <Route path="historique" element={<BackofficeHistoryPage />} />
        <Route path="demandes-commerciales" element={<BackofficeCommercialRequestsPage />} />
        <Route path="demandes-commerciales/:dossierId" element={<BackofficeCommercialRequestDetailPage />} />
        <Route path="reclamations" element={<BackofficeReclamationsPage />} />
        <Route path="reclamations-historique" element={<BackofficeReclamationHistoryPage />} />
        <Route path="profil" element={<BackofficeProfilePage />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>

      {/* Commercant workspace */}
      <Route
        path="/commercant"
        element={
          <ProtectedRoute roles={['COMMERCANT', 'SOUS_COMMERCANT']}>
            <CommercantDashboard />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="etat-dossier" replace />} />
        <Route path="dashboard" element={<CommercantOverviewPage />} />
        <Route path="etat-dossier" element={<CommercantRequestStatusPage />} />
        <Route path="profil" element={<CommercantProfilePage />} />
        <Route path="transactions" element={<CommercantTransactionsPage />} />
        <Route path="points-de-vente" element={<CommercantPdvsPage />} />
        <Route path="demande-pdv" element={<CommercantPdvRequestPage />} />
        <Route path="sous-commercants" element={<CommercantSubCommercantsPage />} />
        <Route path="tpe" element={<CommercantTpesPage />} />
        <Route path="reclamations" element={<CommercantReclamationsPage />} />
        <Route path="*" element={<Navigate to="etat-dossier" replace />} />
      </Route>

      {/* Default */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}
