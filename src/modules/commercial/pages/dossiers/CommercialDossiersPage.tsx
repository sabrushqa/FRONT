import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAffiliationRequests, AffiliationRequestItem } from '../../../supervisor/services/supervisorApi';
import { useSessionStore } from '../../../../store/sessionStore';
import {
  formatEnumLabel,
  getAffiliationProductLabel,
  getAffiliationStatusLabel,
  resolveAffiliationStatusKey
} from '../../../supervisor/services/supervisorUiUtils';
import '../../../../styles/page.shared.scss';
import '../../../../styles/commercial-dossiers.scss';
import { buildCorrectionEmailBody, summarizeCorrectionRequest } from '../../services/correctionRequestUtils';
import {
  isAutoAffiliationRequest as sharedIsAutoAffiliationRequest,
  isCommercialDirectRequest as sharedIsCommercialDirectRequest,
  isNewPdvRequest as sharedIsNewPdvRequest
} from '../../../workspace/workspaceUtils';

type ExtendedStatusFilter = 'all' | 'pending' | 'correction' | 'progress' | 'sent' | 'active' | 'refused';
type ResolvedStatusFilter = Exclude<ExtendedStatusFilter, 'all'>;
type RequestScope = 'auto' | 'new-pdv';

interface AffiliationTypeOption {
  key: string;
  label: string;
  count: number;
}

const PAGE_SIZE_OPTIONS = [8, 12, 20];

function toDateKey(dateValue: string | null | undefined): string | null {
  if (!dateValue) {
    return null;
  }
  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function CommercialDossiersPage({ requestScope = 'auto' }: { requestScope?: RequestScope }) {
  const navigate = useNavigate();
  const { session } = useSessionStore();

  const role = session?.role;
  const hasAccess = role === 'SUPERVISEUR' || role === 'COMMERCIAL' || role === 'BACK_OFFICE';
  const isCommercialRole = role === 'COMMERCIAL';
  const isBackOfficeRole = role === 'BACK_OFFICE';
  const canAccessPage = hasAccess && !(isBackOfficeRole && session?.peutValiderDossiers === false);
  const defaultStatusFilter: ExtendedStatusFilter =
    isCommercialRole && requestScope !== 'new-pdv' ? 'active' : 'all';

  const [requests, setRequests] = useState<AffiliationRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [affiliationTypeFilter, setAffiliationTypeFilter] = useState('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExtendedStatusFilter>(defaultStatusFilter);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const [successMessage, setSuccessMessage] = useState('');

  // Alias sur la logique partagee (workspaceUtils) plutot qu'une redefinition locale,
  // pour garantir qu'un dossier de prospection directe (COMMERCIAL_DIRECT), quel que
  // soit son statut (y compris "a corriger" / INCOMPLET), ne s'affiche jamais dans
  // l'espace des dossiers auto-affiliation.
  const isCommercialDirectRequest = sharedIsCommercialDirectRequest;
  const isNewPdvRequest = sharedIsNewPdvRequest;
  const isAutoAffiliationRequest = sharedIsAutoAffiliationRequest;
  function isBackOfficeReviewRequest(request: AffiliationRequestItem): boolean {
    return request.status === 'EN_ATTENTE_VALIDATION_BOA';
  }

  useEffect(() => {
    setStatusFilter(defaultStatusFilter);
    setPageIndex(0);
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestScope]);

  async function loadRequests() {
    if (!canAccessPage) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await getAffiliationRequests();
      const allRequests = Array.isArray(response.requests) ? response.requests : [];
      const visibleRequests = isBackOfficeRole
        ? allRequests.filter((request) =>
            requestScope === 'new-pdv'
              ? isNewPdvRequest(request)
              : isBackOfficeReviewRequest(request) && isAutoAffiliationRequest(request)
          )
        : isCommercialRole
          ? allRequests.filter((request) =>
              requestScope === 'new-pdv' ? isNewPdvRequest(request) : isAutoAffiliationRequest(request)
            )
          : allRequests;
      const sorted = [...visibleRequests].sort((left, right) => {
        const leftDay = toDateKey(left.dateSoumission) || '';
        const rightDay = toDateKey(right.dateSoumission) || '';
        if (leftDay !== rightDay) {
          return rightDay.localeCompare(leftDay);
        }
        return right.dossierId - left.dossierId;
      });
      setRequests(sorted);
      setErrorMessage('');
    } catch {
      setErrorMessage('Impossible de charger la liste des dossiers.');
    } finally {
      setIsLoading(false);
    }
  }

  const statusCounts = useMemo<Record<ResolvedStatusFilter, number>>(() => {
    const counts: Record<ResolvedStatusFilter, number> = {
      pending: 0,
      correction: 0,
      progress: 0,
      sent: 0,
      active: 0,
      refused: 0
    };
    for (const request of requests) {
      const key = getStatusKey(request) as ResolvedStatusFilter;
      if (key in counts) {
        counts[key] += 1;
      }
    }
    return counts;
  }, [requests]);

  const affiliationTypeOptions = useMemo<AffiliationTypeOption[]>(() => {
    const typeCounts = new Map<string, number>();
    for (const request of requests) {
      const typeKey = request.typeAffiliation || '';
      typeCounts.set(typeKey, (typeCounts.get(typeKey) ?? 0) + 1);
    }
    return [
      { key: 'all', label: 'Tous les types', count: requests.length },
      ...[...typeCounts.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
        .map(([key, count]) => ({ key, label: formatEnumLabel(key), count }))
    ];
  }, [requests]);

  const filterOptions = useMemo(
    () => [
      { key: 'all' as const, label: 'Tous', count: requests.length },
      { key: 'pending' as const, label: 'À traiter', count: statusCounts.pending },
      { key: 'correction' as const, label: 'À corriger', count: statusCounts.correction },
      { key: 'sent' as const, label: 'À signer', count: statusCounts.sent },
      { key: 'progress' as const, label: 'En traitement', count: statusCounts.progress },
      { key: 'active' as const, label: 'Validés', count: statusCounts.active },
      { key: 'refused' as const, label: 'Refusés', count: statusCounts.refused }
    ],
    [requests.length, statusCounts]
  );

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const minDate = toDateKey(dateFromFilter);
    const maxDate = toDateKey(dateToFilter);

    return requests.filter((request) => {
      const matchesStatus =
        statusFilter === 'all' || getStatusKey(request) === statusFilter;
      if (!matchesStatus) {
        return false;
      }

      const matchesAffiliationType =
        affiliationTypeFilter === 'all' || request.typeAffiliation === affiliationTypeFilter;
      if (!matchesAffiliationType) {
        return false;
      }

      const submittedDay = toDateKey(request.dateSoumission);
      const matchesDateRange =
        (!minDate || (!!submittedDay && submittedDay >= minDate)) &&
        (!maxDate || (!!submittedDay && submittedDay <= maxDate));
      if (!matchesDateRange) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        request.nomCommercant,
        request.email,
        request.telephone,
        request.activite,
        request.ville,
        request.region,
        request.typeAffiliation,
        request.typeCommercant,
        String(request.dossierId)
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [requests, searchTerm, statusFilter, affiliationTypeFilter, dateFromFilter, dateToFilter]);

  const autoAffiliationRequests = useMemo(
    () => {
      if (isBackOfficeRole) {
        return filteredRequests;
      }
      return filteredRequests.filter((request) =>
        requestScope === 'new-pdv' ? isNewPdvRequest(request) : isAutoAffiliationRequest(request)
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredRequests, requestScope, isBackOfficeRole]
  );

  const filteredTotalPages = Math.max(Math.ceil(autoAffiliationRequests.length / pageSize), 1);
  const safePageIndex = Math.min(pageIndex, filteredTotalPages - 1);
  const pagedRequests = useMemo(() => {
    const start = safePageIndex * pageSize;
    return autoAffiliationRequests.slice(start, start + pageSize);
  }, [autoAffiliationRequests, safePageIndex, pageSize]);

  const currentPageStart = autoAffiliationRequests.length ? safePageIndex * pageSize + 1 : 0;
  const currentPageEnd = autoAffiliationRequests.length
    ? Math.min((safePageIndex + 1) * pageSize, autoAffiliationRequests.length)
    : 0;
  const canGoToPreviousPage = safePageIndex > 0;
  const canGoToNextPage = safePageIndex + 1 < filteredTotalPages;

  const hasAdvancedFilters = Boolean(
    affiliationTypeFilter !== 'all' ||
      dateFromFilter ||
      dateToFilter ||
      searchTerm.trim() ||
      statusFilter !== 'all'
  );

  const tableTitle =
    isBackOfficeRole
      ? requestScope === 'new-pdv'
        ? "Demandes d'extension rattachées à votre BO"
        : 'Dossiers en attente de décision BO'
      : requestScope === 'new-pdv' ? "Demandes d'extension" : 'Demandes auto-affiliation';
  const tableSubtitle =
    isBackOfficeRole
      ? requestScope === 'new-pdv'
        ? `${autoAffiliationRequests.length} demande(s) d'extension en suivi back office.`
        : `${autoAffiliationRequests.length} dossier(s) prêt(s) pour validation ou refus.`
      : requestScope === 'new-pdv'
      ? `${autoAffiliationRequests.length} demande(s) envoyée(s) par des commerçants déjà affiliés.`
      : `${autoAffiliationRequests.length} dossier(s) créé(s) depuis le formulaire commerçant.`;
  const emptyStateLabel =
    isBackOfficeRole
      ? requestScope === 'new-pdv'
        ? "Aucune demande d'extension rattachée à votre back office."
        : 'Aucun dossier ne nécessite une validation ou un refus back office.'
      : requestScope === 'new-pdv'
      ? "Aucune demande d'extension ne correspond aux critères sélectionnés."
      : 'Aucun dossier ne correspond aux critères sélectionnés.';
  const showBackOfficeMeta = !isCommercialRole;
  const dossiersRoute = isCommercialRole
    ? '/commercial/dossiers'
    : isBackOfficeRole
      ? requestScope === 'new-pdv' ? '/backoffice/demande-extention' : '/backoffice/dossiers'
    : '/supervisor/affiliation-requests';

  function resetPage() {
    setPageIndex(0);
  }

  function clearFilters() {
    setSearchTerm('');
    setAffiliationTypeFilter('all');
    setDateFromFilter('');
    setDateToFilter('');
    setStatusFilter(defaultStatusFilter);
    setPageIndex(0);
  }

  function getStatusKey(request: AffiliationRequestItem): ExtendedStatusFilter {
    if (request.status === 'BROUILLON') {
      return 'pending';
    }
    if (request.status === 'INCOMPLET') {
      return 'correction';
    }
    return resolveAffiliationStatusKey(request) as ExtendedStatusFilter;
  }

  function getStatusLabel(request: AffiliationRequestItem): string {
    if (request.status === 'BROUILLON') {
      return 'Brouillon';
    }
    const statusKey = getStatusKey(request);
    if (statusKey === 'active') {
      return 'Validé';
    }
    if (statusKey === 'refused') {
      return 'Refusé';
    }
    if (statusKey === 'sent') {
      return 'À signer';
    }
    if (statusKey === 'progress') {
      return 'En traitement';
    }
    if (statusKey === 'pending') {
      return 'À traiter';
    }
    if (statusKey === 'correction') {
      return 'À corriger';
    }
    return getAffiliationStatusLabel(request);
  }

  function getDetailActionLabel(request: AffiliationRequestItem): string {
    if (isBackOfficeRole && request.status === 'EN_ATTENTE_VALIDATION_BOA') {
      return 'Traiter le dossier';
    }
    return 'Consulter';
  }

  function canCompleteRequest(request: AffiliationRequestItem): boolean {
    return isCommercialRole && (
      request.status === 'SOUMIS' ||
      request.status === 'BROUILLON' ||
      request.status === 'INCOMPLET'
    );
  }

  function isCorrectionRequest(request: AffiliationRequestItem): boolean {
    return request.status === 'INCOMPLET';
  }

  function canEditInteractionsFor(request: AffiliationRequestItem): boolean {
    return isCommercialRole && isCorrectionRequest(request);
  }

  function openCorrectionEmail(request: AffiliationRequestItem) {
    const recipient = request.email?.trim();
    if (!recipient) {
      setErrorMessage("Aucune adresse e-mail commerçant n'est disponible pour ce dossier.");
      return;
    }
    const subject = `Complément demandé pour votre dossier #${request.dossierId}`;
    const body = buildCorrectionEmailBody({
      dossierId: request.dossierId,
      nomCommercant: request.nomCommercant,
      motifRefus: request.motifRefus
    });
    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function openDetail(request: AffiliationRequestItem, mode: 'view' | 'edit' = 'view') {
    if (isCommercialRole && isNewPdvRequest(request)) {
      const newPdvRoute = `/commercial/demande-extention/${request.dossierId}`;
      navigate(mode === 'edit' ? `${newPdvRoute}?mode=edit` : newPdvRoute);
      return;
    }
    if (isBackOfficeRole && isNewPdvRequest(request)) {
      navigate(`/backoffice/demande-extention/${request.dossierId}`);
      return;
    }
    if (isCommercialRole && isCommercialDirectRequest(request)) {
      const commercialRequestRoute = `/commercial/demandes-commerciales/${request.dossierId}`;
      navigate(mode === 'edit' ? `${commercialRequestRoute}/continue` : commercialRequestRoute);
      return;
    }
    if (isCommercialRole && mode === 'edit') {
      if (isCorrectionRequest(request)) {
        navigate(`/commercial/dossiers/${request.dossierId}/continue?correction=1`);
        return;
      }
      const targetUrl = `${dossiersRoute}/${request.dossierId}`;
      navigate(`${targetUrl}?mode=edit`);
      return;
    }
    const targetUrl = `${dossiersRoute}/${request.dossierId}`;
    navigate(mode === 'edit' ? `${targetUrl}?mode=edit` : targetUrl);
  }

  function printRequest(request: AffiliationRequestItem) {
    const printWindow = window.open('', '_blank', 'width=980,height=720');
    if (!printWindow) {
      return;
    }
    const commercantLabel = request.nomCommercant || request.email || '-';
    const submittedAt = request.dateSoumission
      ? new Date(request.dateSoumission).toLocaleDateString('fr-MA')
      : '-';
    const statusLabel = getStatusLabel(request);
    const affiliationLabel = formatEnumLabel(request.typeAffiliation);
    const commercantTypeLabel = formatEnumLabel(request.typeCommercant);
    const productLabel = getAffiliationProductLabel(request);

    printWindow.document.write(`
      <!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>Dossier #${request.dossierId}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #16354c; }
            .sheet { max-width: 860px; margin: 0 auto; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            p { margin: 0 0 18px; color: #55758d; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
            .card { padding: 16px 18px; border: 1px solid #f0e0b8; border-radius: 14px; background: #fff; }
            .card strong { display: block; margin-bottom: 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #8a6a00; }
            .card span { font-size: 15px; line-height: 1.45; }
          </style>
        </head>
        <body>
          <div class="sheet">
            <h1>Dossier #${request.dossierId}</h1>
            <p>${escapeHtml(commercantLabel)}</p>
            <div class="grid">
              <div class="card"><strong>Commerçant</strong><span>${escapeHtml(commercantLabel)}</span></div>
              <div class="card"><strong>E-mail</strong><span>${escapeHtml(request.email || '-')}</span></div>
              <div class="card"><strong>Téléphone</strong><span>${escapeHtml(request.telephone || '-')}</span></div>
              <div class="card"><strong>Date de dépôt</strong><span>${escapeHtml(submittedAt)}</span></div>
              <div class="card"><strong>État</strong><span>${escapeHtml(statusLabel)}</span></div>
              <div class="card"><strong>Affiliation</strong><span>${escapeHtml(affiliationLabel)}</span></div>
              <div class="card"><strong>Type commerçant</strong><span>${escapeHtml(commercantTypeLabel)}</span></div>
              <div class="card"><strong>Produit</strong><span>${escapeHtml(productLabel)}</span></div>
              <div class="card"><strong>Ville</strong><span>${escapeHtml(request.ville || '-')}</span></div>
              <div class="card"><strong>Région</strong><span>${escapeHtml(request.region || '-')}</span></div>
              <div class="card"><strong>Activité</strong><span>${escapeHtml(request.activite || '-')}</span></div>
              <div class="card"><strong>Commercial attribué</strong><span>${escapeHtml(request.commercialAttribue || 'Non renseigné')}</span></div>
              <div class="card"><strong>Back-office</strong><span>${escapeHtml(request.backOfficeTraitant || 'Non renseigné')}</span></div>
              <div class="card"><strong>Motif</strong><span>${escapeHtml(summarizeCorrectionRequest(request.motifRefus) || '-')}</span></div>
            </div>
          </div>
          <script>
            window.addEventListener('load', function () { window.print(); });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  if (!canAccessPage) {
    return (
      <div className="access-card">
        <strong>Accès indisponible</strong>
        <span>Votre compte n'est pas autorisé à traiter cette liste de dossiers.</span>
      </div>
    );
  }

  return (
    <>
    <div className="page-grid dashboard-page commercial-mode">
      <div className="page-card filter-card">
        {errorMessage && (
          <div className="page-alert error" role="alert">
            {errorMessage}
          </div>
        )}

        <div className="filters-layout">
          <div className="filter-row">
            <div className="search-field">
              <label htmlFor="dossiers-search">Recherche</label>
              <input
                id="dossiers-search"
                type="search"
                className="form-input"
                placeholder="Nom du commerçant, ville, e-mail ou numéro de dossier"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  resetPage();
                }}
              />
            </div>

            <div className="filter-field">
              <label htmlFor="dossiers-type">Type d’affiliation</label>
              <select
                id="dossiers-type"
                className="form-input"
                value={affiliationTypeFilter}
                onChange={(e) => {
                  setAffiliationTypeFilter(e.target.value);
                  resetPage();
                }}
              >
                {affiliationTypeOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="date-field">
              <label htmlFor="dossiers-date-from">Date début</label>
              <input
                id="dossiers-date-from"
                type="date"
                className="form-input"
                value={dateFromFilter}
                onChange={(e) => {
                  const value = e.target.value;
                  setDateFromFilter(value);
                  if (dateToFilter && value && value > dateToFilter) {
                    setDateToFilter(value);
                  }
                  resetPage();
                }}
              />
            </div>

            <div className="date-field">
              <label htmlFor="dossiers-date-to">Date fin</label>
              <input
                id="dossiers-date-to"
                type="date"
                className="form-input"
                value={dateToFilter}
                onChange={(e) => {
                  const value = e.target.value;
                  setDateToFilter(value);
                  if (dateFromFilter && value && value < dateFromFilter) {
                    setDateFromFilter(value);
                  }
                  resetPage();
                }}
              />
            </div>
          </div>

          <div className="filter-actions">
            {!isBackOfficeRole && filterOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`status-filter status-${option.key}${statusFilter === option.key ? ' is-selected' : ''}`}
                  onClick={() => {
                    setStatusFilter(option.key);
                    resetPage();
                  }}
                >
                  {option.label} ({option.count})
                </button>
              ))}
            <button
              type="button"
              className="clear-filters-btn"
              disabled={!hasAdvancedFilters}
              onClick={clearFilters}
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      <div className="page-card table-card">
        {errorMessage && (
          <div className="page-alert error" role="alert">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="page-alert success" role="status">
            {successMessage}
          </div>
        )}
        {isLoading ? (
          <div className="page-loading">
            <div className="page-loading-spinner" />
            <span>Chargement des dossiers...</span>
          </div>
        ) : !autoAffiliationRequests.length ? (
          <div className="empty-state">{emptyStateLabel}</div>
        ) : (
          <>
            <div className="table-toolbar">
              <div className="table-summary">
                <strong>{tableTitle}</strong>
                <span>{tableSubtitle}</span>
              </div>
            </div>

            <div className="table-scroll">
              <table className="data-table request-table">
                <thead>
                  <tr>
                    <th>Dossier</th>
                    <th>Commerçant</th>
                    <th>Affiliation</th>
                    <th>État</th>
                    <th>Date de dépôt</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRequests.map((item) => (
                    <tr key={item.dossierId} className={`row-${getStatusKey(item)}`}>
                      <td>
                        <strong>#{item.dossierId}</strong>
                        <span>{formatEnumLabel(item.typeCommercant)}</span>
                      </td>
                      <td>
                        <strong>{item.nomCommercant || item.email}</strong>
                        <span>{item.email || '-'}</span>
                        <span>{item.telephone || '-'}</span>
                      </td>
                      <td>
                        <strong>{formatEnumLabel(item.typeAffiliation)}</strong>
                        <span>{item.activite || '-'}</span>
                        <span>{getAffiliationProductLabel(item)}</span>
                      </td>
                      <td>
                        <span className={`status-badge status-${getStatusKey(item)}`}>
                          {getStatusLabel(item)}
                        </span>
                        {item.status === 'EN_ATTENTE_VALIDATION_BOA' && item.nombreCorrections > 0 && (
                          <span className="status-badge status-correction" title="Ce dossier a été renvoyé au commercial pour correction avant de revenir au back office.">
                            Corrigé — à revalider ({item.nombreCorrections})
                          </span>
                        )}
                        <span className="table-meta">
                          Commercial attribué: {item.commercialAttribue || 'Non renseigné'}
                        </span>
                        {showBackOfficeMeta && (
                          <span className="table-meta">
                            Back-office: {item.backOfficeTraitant || 'Non renseigné'}
                          </span>
                        )}
                        {item.motifRefus && (
                          <span className="table-meta">
                            {item.status === 'INCOMPLET' ? 'Motif correction' : 'Motif refus'}: {summarizeCorrectionRequest(item.motifRefus)}
                          </span>
                        )}
                        {!item.motifRefus
                          && item.status === 'EN_ATTENTE_VALIDATION_BOA'
                          && item.nombreCorrections > 0
                          && item.dernierMotifCorrection && (
                            <span className="table-meta">
                              Dernier motif de correction: {summarizeCorrectionRequest(item.dernierMotifCorrection)}
                            </span>
                        )}
                      </td>
                      <td>
                        <strong>
                          {item.dateSoumission
                            ? new Date(item.dateSoumission).toLocaleDateString('fr-MA')
                            : '-'}
                        </strong>
                        <span>
                          {item.ville || '-'} / {item.region || '-'}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button type="button" className="action-btn" onClick={() => openDetail(item)}>
                            {getDetailActionLabel(item)}
                          </button>
                          {canCompleteRequest(item) && (
                            <button
                              type="button"
                              className="action-btn action-btn-primary"
                              onClick={() => openDetail(item, 'edit')}
                            >
                              {isCorrectionRequest(item) ? 'Corriger' : 'Compléter'}
                            </button>
                          )}
                          {canEditInteractionsFor(item) && (
                            <button
                              type="button"
                              className="action-btn"
                              onClick={() => openCorrectionEmail(item)}
                            >
                              Email
                            </button>
                          )}
                          <button
                            type="button"
                            className="icon-action-btn"
                            aria-label="Imprimer le dossier"
                            onClick={() => printRequest(item)}
                          >
                            ⎙
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-pagination">
              <div className="page-size-switcher">
                <span>Lignes par page</span>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={pageSize === size ? 'is-selected' : ''}
                    onClick={() => {
                      if (pageSize !== size) {
                        setPageSize(size);
                        setPageIndex(0);
                      }
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>

              <div className="pager-actions">
                <button
                  type="button"
                  disabled={!canGoToPreviousPage}
                  onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                >
                  Précédent
                </button>
                <span>
                  Page {safePageIndex + 1} / {filteredTotalPages}
                </span>
                <button
                  type="button"
                  disabled={!canGoToNextPage}
                  onClick={() => setPageIndex((p) => p + 1)}
                >
                  Suivant
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
