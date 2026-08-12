import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAffiliationRequests,
  AffiliationRequestItem,
  assignAffiliationToCommerciale,
  getOverview,
  CommercialeDirectoryItem
} from '../../services/supervisorApi';
import { useSessionStore } from '../../../../store/sessionStore';
import {
  formatEnumLabel,
  getAffiliationProductLabel,
  getAffiliationStatusLabel,
  resolveAffiliationStatusKey
} from '../../services/supervisorUiUtils';
import { isAutoAffiliationRequest, isCommercialDirectRequest } from '../../../workspace/workspaceUtils';
import '../../../../styles/page.shared.scss';
import '../../../../styles/supervisor-affiliation-list.scss';

type ExtendedStatusFilter = 'all' | 'pending' | 'progress' | 'sent' | 'active' | 'refused';
type ResolvedStatusFilter = Exclude<ExtendedStatusFilter, 'all'>;
type AssignmentFilter = 'all' | 'unassigned' | 'assigned';

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

function isUnassignedRequest(request: AffiliationRequestItem): boolean {
  return request.status === 'EN_ATTENTE_ASSIGNATION';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeRegionForMatch(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export default function SupervisorAffiliationListPage() {
  const navigate = useNavigate();
  const { session } = useSessionStore();

  const role = session?.role;
  const hasAccess = role === 'SUPERVISEUR' || role === 'COMMERCIAL' || role === 'BACK_OFFICE';
  const isSupervisorRole = role === 'SUPERVISEUR';
  const isCommercialRole = role === 'COMMERCIAL';
  const isBackOfficeRole = role === 'BACK_OFFICE';
  const defaultStatusFilter: ExtendedStatusFilter = isCommercialRole ? 'active' : 'all';

  const [requests, setRequests] = useState<AffiliationRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [affiliationTypeFilter, setAffiliationTypeFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [villeFilter, setVilleFilter] = useState('all');
  const [commercialFilter, setCommercialFilter] = useState('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExtendedStatusFilter>(defaultStatusFilter);
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const [commerciales, setCommerciales] = useState<CommercialeDirectoryItem[]>([]);
  const [assigningDossierId, setAssigningDossierId] = useState<number | null>(null);
  const [selectedCommercialeId, setSelectedCommercialeId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    loadRequests();
    if (isSupervisorRole) {
      loadCommerciales();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCommerciales() {
    try {
      const overview = await getOverview();
      setCommerciales(Array.isArray(overview.commerciales) ? overview.commerciales : []);
    } catch {
      setCommerciales([]);
    }
  }

  async function loadRequests() {
    if (!hasAccess) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await getAffiliationRequests();
      // Exclut les dossiers de prospection directe (COMMERCIAL_DIRECT), quel que soit
      // leur statut (y compris "a corriger" / INCOMPLET) : ils ont leur propre espace
      // dedie et ne doivent jamais apparaitre dans la liste auto-affiliation/extension.
      const autoAffiliationRequests = (Array.isArray(response.requests) ? response.requests : []).filter(
        (request) => !isCommercialDirectRequest(request)
      );
      const sorted = [...autoAffiliationRequests].sort((left, right) => {
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
      progress: 0,
      sent: 0,
      active: 0,
      refused: 0
    };
    for (const request of requests) {
      const key = resolveAffiliationStatusKey(request) as ResolvedStatusFilter;
      if (key in counts) {
        counts[key] += 1;
      }
    }
    return counts;
  }, [requests]);

  const assignmentCounts = useMemo(() => {
    let unassigned = 0;
    let assigned = 0;
    for (const request of requests) {
      if (isUnassignedRequest(request)) {
        unassigned += 1;
      } else {
        assigned += 1;
      }
    }
    return { unassigned, assigned };
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

  const regionOptions = useMemo<AffiliationTypeOption[]>(() => {
    const regionCounts = new Map<string, number>();
    for (const request of requests) {
      const regionKey = (request.region || '').trim();
      if (!regionKey) continue;
      regionCounts.set(regionKey, (regionCounts.get(regionKey) ?? 0) + 1);
    }
    return [
      { key: 'all', label: 'Toutes les régions', count: requests.length },
      ...[...regionCounts.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
        .map(([key, count]) => ({ key, label: key, count }))
    ];
  }, [requests]);

  const villeOptions = useMemo<AffiliationTypeOption[]>(() => {
    const normalizedRegion = regionFilter === 'all' ? null : regionFilter.trim().toLowerCase();
    const scopedRequests = normalizedRegion
      ? requests.filter((r) => (r.region || '').trim().toLowerCase() === normalizedRegion)
      : requests;

    const villeCounts = new Map<string, number>();
    for (const request of scopedRequests) {
      const villeKey = (request.ville || '').trim();
      if (!villeKey) continue;
      villeCounts.set(villeKey, (villeCounts.get(villeKey) ?? 0) + 1);
    }
    return [
      { key: 'all', label: 'Toutes les villes', count: scopedRequests.length },
      ...[...villeCounts.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
        .map(([key, count]) => ({ key, label: key, count }))
    ];
  }, [requests, regionFilter]);

  const commercialFilterOptions = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const request of requests) {
      if (!request.commercialAttribueId) continue;
      const key = String(request.commercialAttribueId);
      const existing = counts.get(key);
      counts.set(key, {
        label: request.commercialAttribue || `Commercial #${key}`,
        count: (existing?.count ?? 0) + 1
      });
    }
    return [
      { key: 'all', label: 'Tous les commerciaux', count: requests.length },
      ...[...counts.entries()]
        .sort((a, b) => a[1].label.localeCompare(b[1].label, 'fr'))
        .map(([key, value]) => ({ key, label: value.label, count: value.count }))
    ];
  }, [requests]);

  const filterOptions = useMemo(
    () => [
      { key: 'all' as const, label: 'Tous', count: requests.length },
      { key: 'pending' as const, label: 'À traiter', count: statusCounts.pending },
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
        statusFilter === 'all' || resolveAffiliationStatusKey(request) === statusFilter;
      if (!matchesStatus) {
        return false;
      }

      const matchesAffiliationType =
        affiliationTypeFilter === 'all' || request.typeAffiliation === affiliationTypeFilter;
      if (!matchesAffiliationType) {
        return false;
      }

      const matchesAssignment =
        assignmentFilter === 'all' ||
        (assignmentFilter === 'unassigned' ? isUnassignedRequest(request) : !isUnassignedRequest(request));
      if (!matchesAssignment) {
        return false;
      }

      const matchesRegion =
        regionFilter === 'all' || (request.region || '').trim() === regionFilter;
      if (!matchesRegion) {
        return false;
      }

      const matchesVille =
        villeFilter === 'all' || (request.ville || '').trim() === villeFilter;
      if (!matchesVille) {
        return false;
      }

      const matchesCommercial =
        commercialFilter === 'all' || String(request.commercialAttribueId ?? '') === commercialFilter;
      if (!matchesCommercial) {
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
  }, [
    requests,
    searchTerm,
    statusFilter,
    affiliationTypeFilter,
    assignmentFilter,
    regionFilter,
    villeFilter,
    commercialFilter,
    dateFromFilter,
    dateToFilter
  ]);

  const filteredTotalPages = Math.max(Math.ceil(filteredRequests.length / pageSize), 1);
  const safePageIndex = Math.min(pageIndex, filteredTotalPages - 1);
  const pagedFilteredRequests = useMemo(() => {
    const start = safePageIndex * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, safePageIndex, pageSize]);

  const currentPageStart = filteredRequests.length ? safePageIndex * pageSize + 1 : 0;
  const currentPageEnd = filteredRequests.length
    ? Math.min((safePageIndex + 1) * pageSize, filteredRequests.length)
    : 0;
  const canGoToPreviousPage = safePageIndex > 0;
  const canGoToNextPage = safePageIndex + 1 < filteredTotalPages;

  const hasAdvancedFilters = Boolean(
    affiliationTypeFilter !== 'all' ||
      assignmentFilter !== 'all' ||
      regionFilter !== 'all' ||
      villeFilter !== 'all' ||
      commercialFilter !== 'all' ||
      dateFromFilter ||
      dateToFilter ||
      searchTerm.trim() ||
      statusFilter !== 'all'
  );

  const showBackOfficeMeta = !isCommercialRole;
  const dossiersRoute = isCommercialRole
    ? '/commercial/dossiers'
    : '/supervisor/affiliation-requests';

  function resetPage() {
    setPageIndex(0);
  }

  function clearFilters() {
    setSearchTerm('');
    setAffiliationTypeFilter('all');
    setAssignmentFilter('all');
    setRegionFilter('all');
    setVilleFilter('all');
    setCommercialFilter('all');
    setDateFromFilter('');
    setDateToFilter('');
    setStatusFilter(defaultStatusFilter);
    setPageIndex(0);
  }

  function getStatusKey(request: AffiliationRequestItem): ExtendedStatusFilter {
    return resolveAffiliationStatusKey(request) as ExtendedStatusFilter;
  }

  function getStatusLabel(request: AffiliationRequestItem): string {
    const statusKey = getStatusKey(request);
    if (statusKey === 'active') {
      return 'Validé';
    }
    if (statusKey === 'refused') {
      return 'Refusé';
    }
    if (statusKey === 'pending' || statusKey === 'sent' || statusKey === 'progress') {
      return 'À traiter';
    }
    return getAffiliationStatusLabel(request);
  }

  function getDetailActionLabel(request: AffiliationRequestItem): string {
    if (isCommercialRole && canCompleteRequest(request)) {
      return 'Dossier';
    }
    if (isBackOfficeRole && request.status === 'EN_ATTENTE_VALIDATION_BOA') {
      return 'Traiter le dossier';
    }
    return 'Consulter';
  }

  function canCompleteRequest(request: AffiliationRequestItem): boolean {
    return isCommercialRole && request.status === 'SOUMIS';
  }

  function canForwardRequest(request: AffiliationRequestItem): boolean {
    return isCommercialRole && request.status === 'ACCEPTE';
  }

  function canAssignRequest(request: AffiliationRequestItem): boolean {
    return isSupervisorRole && request.status === 'EN_ATTENTE_ASSIGNATION';
  }

  function commercialesForRegion(region: string): CommercialeDirectoryItem[] {
    const normalizedRegion = normalizeRegionForMatch(region);
    if (!normalizedRegion) {
      return [];
    }
    return commerciales.filter((c) => normalizeRegionForMatch(c.region) === normalizedRegion);
  }

  function openAssignRow(request: AffiliationRequestItem) {
    setAssigningDossierId(request.dossierId);
    setSelectedCommercialeId('');
  }

  function cancelAssignRow() {
    setAssigningDossierId(null);
    setSelectedCommercialeId('');
  }

  async function confirmAssignRow(dossierId: number) {
    if (!selectedCommercialeId) {
      return;
    }
    setIsAssigning(true);
    try {
      await assignAffiliationToCommerciale(dossierId, { commercialeId: Number(selectedCommercialeId) });
      setAssigningDossierId(null);
      setSelectedCommercialeId('');
      await loadRequests();
    } catch {
      setErrorMessage("Impossible d'assigner ce dossier au commercial sélectionné.");
    } finally {
      setIsAssigning(false);
    }
  }

  function openDetail(request: AffiliationRequestItem, mode: 'view' | 'edit' = 'view') {
    const targetUrl = `${dossiersRoute}/${request.dossierId}`;
    if (mode === 'edit' && isCommercialRole && isAutoAffiliationRequest(request)) {
      navigate(`${targetUrl}/continue`);
      return;
    }
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
            .card { padding: 16px 18px; border: 1px solid #d8edf7; border-radius: 14px; background: #fff; }
            .card strong { display: block; margin-bottom: 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #5d8097; }
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
              <div class="card"><strong>Motif de refus</strong><span>${escapeHtml(request.motifRefus || '-')}</span></div>
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

  if (!hasAccess) {
    return (
      <div className="access-card">
        <strong>Accès indisponible</strong>
        <span>
          Cette page est accessible uniquement aux superviseurs, commerciaux et équipes back-office.
        </span>
      </div>
    );
  }

  return (
    <div className={`page-grid dashboard-page supervisor-affiliation-page${isCommercialRole || isSupervisorRole ? ' commercial-mode' : ''}`}>
      <div className="page-card filter-card">
        {errorMessage && (
          <div className="page-alert error" role="alert">
            {errorMessage}
          </div>
        )}

        <div className="filters-layout">
          <div className="filter-row">
            <div className="search-field">
              <label htmlFor="affiliation-search">Recherche</label>
              <input
                id="affiliation-search"
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
              <label htmlFor="affiliation-type">Type d’affiliation</label>
              <select
                id="affiliation-type"
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

            <div className="filter-field">
              <label htmlFor="affiliation-region">Région</label>
              <select
                id="affiliation-region"
                className="form-input"
                value={regionFilter}
                onChange={(e) => {
                  setRegionFilter(e.target.value);
                  setVilleFilter('all');
                  resetPage();
                }}
              >
                {regionOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="affiliation-ville">Ville</label>
              <select
                id="affiliation-ville"
                className="form-input"
                value={villeFilter}
                onChange={(e) => {
                  setVilleFilter(e.target.value);
                  resetPage();
                }}
              >
                {villeOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </div>

            {isSupervisorRole && (
              <div className="filter-field">
                <label htmlFor="affiliation-commercial">Commercial</label>
                <select
                  id="affiliation-commercial"
                  className="form-input"
                  value={commercialFilter}
                  onChange={(e) => {
                    setCommercialFilter(e.target.value);
                    resetPage();
                  }}
                >
                  {commercialFilterOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label} ({option.count})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="date-field date-range-field">
              <label htmlFor="affiliation-date-from">Période</label>
              <div className="date-range-inputs">
                <input
                  id="affiliation-date-from"
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
                <span className="date-range-sep">→</span>
                <input
                  id="affiliation-date-to"
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
          </div>

          <div className="filter-actions">
            <span className="filter-group-label">Statut</span>
            {filterOptions.map((option) => (
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

          {isSupervisorRole && (
            <div className="filter-actions assignment-filter-actions">
              <span className="filter-group-label">Assignation</span>
              <button
                type="button"
                className={`status-filter${assignmentFilter === 'all' ? ' is-selected' : ''}`}
                onClick={() => {
                  setAssignmentFilter('all');
                  resetPage();
                }}
              >
                Toutes ({requests.length})
              </button>
              <button
                type="button"
                className={`status-filter status-pending${assignmentFilter === 'unassigned' ? ' is-selected' : ''}`}
                onClick={() => {
                  setAssignmentFilter('unassigned');
                  resetPage();
                }}
              >
                Non assignées ({assignmentCounts.unassigned})
              </button>
              <button
                type="button"
                className={`status-filter status-active${assignmentFilter === 'assigned' ? ' is-selected' : ''}`}
                onClick={() => {
                  setAssignmentFilter('assigned');
                  resetPage();
                }}
              >
                Assignées ({assignmentCounts.assigned})
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="page-card table-card">
        {isLoading ? (
          <div className="page-loading">
            <div className="page-loading-spinner" />
            <span>Chargement des dossiers...</span>
          </div>
        ) : !filteredRequests.length ? (
          <div className="empty-state">Aucun dossier ne correspond aux critères sélectionnés.</div>
        ) : (
          <>
            <div className="table-toolbar">
              <div className="table-summary">
                <strong>{filteredRequests.length} dossiers</strong>
                <span>
                  Affichage {currentPageStart} à {currentPageEnd} sur {filteredRequests.length}
                </span>
              </div>
            </div>

            <div className="table-scroll">
              <table className="data-table request-table">
                <thead>
                  <tr>
                    <th>Dossier</th>
                    <th>Commerçant</th>
                    <th>Affiliation</th>
                    <th>Localisation</th>
                    <th>État</th>
                    <th>Assignation</th>
                    <th>Date de dépôt</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedFilteredRequests.map((item) => (
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
                        <strong>{item.ville || '-'}</strong>
                        <span>{item.region || '-'}</span>
                      </td>
                      <td>
                        <span className={`status-badge status-${getStatusKey(item)}`}>
                          {getStatusLabel(item)}
                        </span>
                        {showBackOfficeMeta && (
                          <span className="table-meta">
                            Back-office: {item.backOfficeTraitant || 'Non renseigné'}
                          </span>
                        )}
                        {item.motifRefus && (
                          <span className="table-meta">Motif de refus: {item.motifRefus}</span>
                        )}
                      </td>
                      <td>
                        {isUnassignedRequest(item) ? (
                          <span className="status-badge status-pending">Non assignée</span>
                        ) : (
                          <>
                            <span className="status-badge status-active">Assignée</span>
                            <span className="table-meta">{item.commercialAttribue || 'Non renseigné'}</span>
                          </>
                        )}
                      </td>
                      <td>
                        <strong>
                          {item.dateSoumission
                            ? new Date(item.dateSoumission).toLocaleDateString('fr-MA')
                            : '-'}
                        </strong>
                      </td>
                      <td>
                        {canAssignRequest(item) && assigningDossierId === item.dossierId ? (
                          <div className="table-actions">
                            <select
                              className="form-input"
                              value={selectedCommercialeId}
                              onChange={(e) => setSelectedCommercialeId(e.target.value)}
                            >
                              <option value="">Choisir un commercial ({item.region || '-'})</option>
                              {commercialesForRegion(item.region).length === 0 && (
                                <option value="" disabled>
                                  Aucun commercial pour cette région
                                </option>
                              )}
                              {commercialesForRegion(item.region).map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.prenom} {c.nom} - {c.region || '-'}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="action-btn action-btn-primary"
                              disabled={!selectedCommercialeId || isAssigning}
                              onClick={() => confirmAssignRow(item.dossierId)}
                            >
                              Confirmer
                            </button>
                            <button type="button" className="action-btn" onClick={cancelAssignRow}>
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <div className="table-actions">
                            <button
                              type="button"
                              className="action-btn"
                              onClick={() => openDetail(item)}
                            >
                              {getDetailActionLabel(item)}
                            </button>
                            {canAssignRequest(item) && (
                              <button
                                type="button"
                                className="action-btn action-btn-primary"
                                onClick={() => openAssignRow(item)}
                              >
                                Assigner
                              </button>
                            )}
                            {canCompleteRequest(item) && (
                              <button
                                type="button"
                                className="action-btn action-btn-primary"
                                onClick={() => openDetail(item, 'edit')}
                              >
                                Compléter
                              </button>
                            )}
                            {canForwardRequest(item) && (
                              <button
                                type="button"
                                className="action-btn action-btn-primary"
                                onClick={() => openDetail(item)}
                              >
                                Finaliser affiliation
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
                        )}
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
  );
}
