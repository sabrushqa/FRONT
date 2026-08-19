import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSessionStore } from '../../../../store/sessionStore';
import {
  BackOfficeDirectoryItem,
  CommercialeDirectoryItem,
  CommercantDirectoryItem,
  SupervisorOverviewResponse,
  deactivateBackOffice as apiDeactivateBackOffice,
  deactivateCommerciale as apiDeactivateCommerciale,
  deactivateCommercant as apiDeactivateCommercant,
  resilierCommercant as apiResilierCommercant,
  getOverview,
  sendBackOfficeActivation as apiSendBackOfficeActivation,
  sendCommercialeActivation as apiSendCommercialeActivation,
  sendCommercantActivation as apiSendCommercantActivation
} from '../../services/supervisorApi';
import { extractApiErrorMessage, formatEnumLabel } from '../../services/supervisorUiUtils';
import '../../../../styles/page.shared.scss';
import '../../../../styles/supervisor-directory.scss';

type DirectoryType = 'backOffices' | 'commerciales' | 'commercants';
type CommercialStatusFilter = 'all' | 'active' | 'inactive';

const PAGE_SIZE_OPTIONS = [8, 12, 20];

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('fr-MA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function normalizeFilterValue(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function affiliationToneClass(type: string): string {
  return type ? `affiliation-${normalizeFilterValue(type).replace(/[^a-z0-9]+/g, '-')}` : 'affiliation-none';
}

export default function SupervisorDirectoryPage({ directoryType = 'backOffices' }: { directoryType?: DirectoryType }) {
  const { session } = useSessionStore();
  const canManageStaff = session?.role === 'SUPERVISEUR';

  const createRoute = directoryType === 'commerciales' ? '/supervisor/commercial/new' : '/supervisor/back-offices/new';

  const [overview, setOverview] = useState<SupervisorOverviewResponse>({
    backOffices: [],
    commerciales: [],
    commercants: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const [commercialRegionFilter, setCommercialRegionFilter] = useState('all');
  const [commercialStatusFilter, setCommercialStatusFilter] = useState<CommercialStatusFilter>('all');
  const [commercantTypeFilter, setCommercantTypeFilter] = useState('all');
  const [commercantAffiliationFilter, setCommercantAffiliationFilter] = useState('all');
  const [commercantStatusFilter, setCommercantStatusFilter] = useState<CommercialStatusFilter>('all');
  const [backOfficeServiceFilter, setBackOfficeServiceFilter] = useState('all');
  const [backOfficeStatusFilter, setBackOfficeStatusFilter] = useState<CommercialStatusFilter>('all');

  const isBackOfficeDirectory = directoryType === 'backOffices';
  const isCommercialeDirectory = directoryType === 'commerciales';
  const isCommercantDirectory = directoryType === 'commercants';

  const loadDirectory = useCallback(
    async (resetMessages = true) => {
      if (!canManageStaff) {
        setIsLoading(false);
        return;
      }
      if (resetMessages) {
        setErrorMessage('');
        setSuccessMessage('');
      }
      setIsLoading(true);
      try {
        const response = await getOverview();
        setOverview(response);
      } catch {
        setErrorMessage('Impossible de charger cette liste.');
      } finally {
        setIsLoading(false);
      }
    },
    [canManageStaff]
  );

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const commercialRegionOptions = useMemo(() => {
    const regions = new Map<string, string>();
    overview.commerciales.forEach((item) => {
      const region = (item.region || '').trim();
      if (!region) return;
      regions.set(normalizeFilterValue(region), region);
    });
    return [...regions.values()].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [overview.commerciales]);

  const filteredCommerciales = useMemo(() => {
    return overview.commerciales.filter((item) => {
      const matchesRegion =
        commercialRegionFilter === 'all' ||
        normalizeFilterValue(item.region) === normalizeFilterValue(commercialRegionFilter);
      const matchesStatus =
        commercialStatusFilter === 'all' ||
        (commercialStatusFilter === 'active' ? item.active : !item.active);
      return matchesRegion && matchesStatus;
    });
  }, [overview.commerciales, commercialRegionFilter, commercialStatusFilter]);

  const commercantTypeOptions = useMemo(() => {
    const types = new Map<string, string>();
    overview.commercants.forEach((item) => {
      const type = (item.typeCommercant || '').trim();
      if (!type) return;
      types.set(normalizeFilterValue(type), type);
    });
    return [...types.values()].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [overview.commercants]);

  const commercantAffiliationOptions = useMemo(() => {
    const types = new Map<string, string>();
    overview.commercants.forEach((item) => {
      const type = (item.typeAffiliation || '').trim();
      if (!type) return;
      types.set(normalizeFilterValue(type), type);
    });
    return [...types.values()].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [overview.commercants]);

  const filteredCommercants = useMemo(() => {
    return overview.commercants.filter((item) => {
      const matchesType =
        commercantTypeFilter === 'all' ||
        normalizeFilterValue(item.typeCommercant) === normalizeFilterValue(commercantTypeFilter);
      const matchesAffiliation =
        commercantAffiliationFilter === 'all' ||
        normalizeFilterValue(item.typeAffiliation) === normalizeFilterValue(commercantAffiliationFilter);
      const matchesStatus =
        commercantStatusFilter === 'all' ||
        (commercantStatusFilter === 'active' ? item.active : !item.active);
      return matchesType && matchesAffiliation && matchesStatus;
    });
  }, [overview.commercants, commercantTypeFilter, commercantAffiliationFilter, commercantStatusFilter]);

  const backOfficeServiceOptions = useMemo(() => {
    const services = new Map<string, string>();
    overview.backOffices.forEach((item) => {
      const service = (item.service || '').trim();
      if (!service) return;
      services.set(normalizeFilterValue(service), service);
    });
    return [...services.values()].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [overview.backOffices]);

  const filteredBackOffices = useMemo(() => {
    return overview.backOffices.filter((item) => {
      const matchesService =
        backOfficeServiceFilter === 'all' ||
        normalizeFilterValue(item.service) === normalizeFilterValue(backOfficeServiceFilter);
      const matchesStatus =
        backOfficeStatusFilter === 'all' ||
        (backOfficeStatusFilter === 'active' ? item.active : !item.active);
      return matchesService && matchesStatus;
    });
  }, [overview.backOffices, backOfficeServiceFilter, backOfficeStatusFilter]);

  const activeItems = useMemo(() => {
    if (isCommercialeDirectory) return filteredCommerciales;
    if (isCommercantDirectory) return filteredCommercants;
    return filteredBackOffices;
  }, [filteredCommerciales, filteredCommercants, filteredBackOffices, isCommercialeDirectory, isCommercantDirectory]);

  const activeDirectoryCount = activeItems.length;
  const activeDirectoryTotalPages = Math.max(Math.ceil(activeDirectoryCount / pageSize), 1);

  useEffect(() => {
    const maxPageIndex = Math.max(Math.ceil(activeDirectoryCount / pageSize) - 1, 0);
    if (pageIndex > maxPageIndex) setPageIndex(maxPageIndex);
  }, [activeDirectoryCount, pageSize, pageIndex]);

  const currentPageStart = activeDirectoryCount ? pageIndex * pageSize + 1 : 0;
  const currentPageEnd = activeDirectoryCount ? Math.min((pageIndex + 1) * pageSize, activeDirectoryCount) : 0;
  const canGoToPreviousPage = pageIndex > 0;
  const canGoToNextPage = pageIndex + 1 < activeDirectoryTotalPages;

  function paginate<T>(items: T[]): T[] {
    const start = pageIndex * pageSize;
    return items.slice(start, start + pageSize);
  }

  function setPageSizeValue(size: number) {
    if (pageSize === size) return;
    setPageSize(size);
    setPageIndex(0);
  }

  function setCommercialRegionFilterValue(value: string) {
    setCommercialRegionFilter(value);
    setPageIndex(0);
  }

  function setCommercialStatusFilterValue(value: CommercialStatusFilter) {
    setCommercialStatusFilter(value);
    setPageIndex(0);
  }

  function clearCommercialFilters() {
    setCommercialRegionFilter('all');
    setCommercialStatusFilter('all');
    setPageSize(8);
    setPageIndex(0);
  }

  function setCommercantTypeFilterValue(value: string) {
    setCommercantTypeFilter(value);
    setPageIndex(0);
  }

  function setCommercantAffiliationFilterValue(value: string) {
    setCommercantAffiliationFilter(value);
    setPageIndex(0);
  }

  function setCommercantStatusFilterValue(value: CommercialStatusFilter) {
    setCommercantStatusFilter(value);
    setPageIndex(0);
  }

  function clearCommercantFilters() {
    setCommercantTypeFilter('all');
    setCommercantAffiliationFilter('all');
    setCommercantStatusFilter('all');
    setPageSize(8);
    setPageIndex(0);
  }

  function setBackOfficeServiceFilterValue(value: string) {
    setBackOfficeServiceFilter(value);
    setPageIndex(0);
  }

  function setBackOfficeStatusFilterValue(value: CommercialStatusFilter) {
    setBackOfficeStatusFilter(value);
    setPageIndex(0);
  }

  function clearBackOfficeFilters() {
    setBackOfficeServiceFilter('all');
    setBackOfficeStatusFilter('all');
    setPageSize(8);
    setPageIndex(0);
  }

  function goToPreviousPage() {
    if (canGoToPreviousPage) setPageIndex((p) => p - 1);
  }

  function goToNextPage() {
    if (canGoToNextPage) setPageIndex((p) => p + 1);
  }

  // Action a impact fort (label metier reel "abandonne=1" + desactivation du
  // compte) : confirmation explicite avant d'agir, contrairement a la simple
  // desactivation qui reste reversible via "Renvoyer activation".
  function handleResilier(item: CommercantDirectoryItem) {
    if (!window.confirm(`Résilier définitivement "${item.nom}" ? Le compte sera désactivé et le contrat marqué comme résilié.`)) {
      return;
    }
    const motif = window.prompt('Motif de la résiliation (optionnel) :') ?? undefined;
    void runAction(item.id, () => apiResilierCommercant(item.id, motif || undefined), 'Impossible de résilier ce commerçant.');
  }

  async function runAction(id: number, action: () => Promise<{ message: string }>, fallback: string) {
    setProcessingId(id);
    setIsProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const response = await action();
      setSuccessMessage(response.message);
      await loadDirectory(false);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, fallback));
    } finally {
      setIsProcessing(false);
      setProcessingId(null);
    }
  }

  if (!canManageStaff) {
    return (
      <div className="access-card">
        <strong>Accès indisponible</strong>
        <span>Cette page est réservée au superviseur.</span>
      </div>
    );
  }

  const pagedBackOffice = paginate(filteredBackOffices);
  const pagedCommerciale = paginate(filteredCommerciales);
  const pagedCommercant = paginate(filteredCommercants);

  const renderPagination = () => (
    <div className="table-pagination">
      <div className="page-size-switcher">
        <span>Lignes par page</span>
        {PAGE_SIZE_OPTIONS.map((size) => (
          <button
            key={size}
            type="button"
            className={pageSize === size ? 'is-selected' : ''}
            onClick={() => setPageSizeValue(size)}
          >
            {size}
          </button>
        ))}
      </div>
      <div className="pager-actions">
        <button type="button" disabled={!canGoToPreviousPage} onClick={goToPreviousPage}>Précédent</button>
        <span>Page {pageIndex + 1} / {activeDirectoryTotalPages}</span>
        <button type="button" disabled={!canGoToNextPage} onClick={goToNextPage}>Suivant</button>
      </div>
    </div>
  );

  const renderToolbar = () => (
    <div className="table-toolbar">
      <div className="table-summary">
        <strong>{activeDirectoryCount} comptes</strong>
        <span>Affichage {currentPageStart} à {currentPageEnd} sur {activeDirectoryCount}</span>
      </div>
    </div>
  );

  const hasCommercialFilters =
    commercialRegionFilter !== 'all' || commercialStatusFilter !== 'all' || pageSize !== 8;

  const renderCommercialFilters = () => (
    <div className="filters-layout">
      <div className="filter-row">
        <div className="filter-field">
          <label htmlFor="commercial-region-filter">Région</label>
          <select
            id="commercial-region-filter"
            className="form-input"
            value={commercialRegionFilter}
            onChange={(event) => setCommercialRegionFilterValue(event.target.value)}
          >
            <option value="all">Toutes les régions</option>
            {commercialRegionOptions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="commercial-status-filter">Statut</label>
          <select
            id="commercial-status-filter"
            className="form-input"
            value={commercialStatusFilter}
            onChange={(event) => setCommercialStatusFilterValue(event.target.value as CommercialStatusFilter)}
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Activés</option>
            <option value="inactive">Désactivés</option>
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="commercial-count-filter">Nombre</label>
          <select
            id="commercial-count-filter"
            className="form-input"
            value={pageSize}
            onChange={(event) => setPageSizeValue(Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} lignes
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="filter-actions">
        <span className="filter-group-label">
          {filteredCommerciales.length} commercial{filteredCommerciales.length > 1 ? 's' : ''}
        </span>
        <button
          type="button"
          className="clear-filters-btn"
          disabled={!hasCommercialFilters}
          onClick={clearCommercialFilters}
        >
          Réinitialiser
        </button>
        <Link className="btn-primary" to={createRoute}>
          Ajouter
        </Link>
      </div>
    </div>
  );

  const hasCommercantFilters =
    commercantTypeFilter !== 'all' ||
    commercantAffiliationFilter !== 'all' ||
    commercantStatusFilter !== 'all' ||
    pageSize !== 8;

  const renderCommercantFilters = () => (
    <div className="filters-layout">
      <div className="filter-row">
        <div className="filter-field">
          <label htmlFor="commercant-type-filter">Type de personne</label>
          <select
            id="commercant-type-filter"
            className="form-input"
            value={commercantTypeFilter}
            onChange={(event) => setCommercantTypeFilterValue(event.target.value)}
          >
            <option value="all">Tous les types</option>
            {commercantTypeOptions.map((type) => (
              <option key={type} value={type}>
                {formatEnumLabel(type)}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="commercant-affiliation-filter">Type d'affiliation</label>
          <select
            id="commercant-affiliation-filter"
            className="form-input"
            value={commercantAffiliationFilter}
            onChange={(event) => setCommercantAffiliationFilterValue(event.target.value)}
          >
            <option value="all">Tous les types d'affiliation</option>
            {commercantAffiliationOptions.map((type) => (
              <option key={type} value={type}>
                {formatEnumLabel(type)}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="commercant-status-filter">Statut</label>
          <select
            id="commercant-status-filter"
            className="form-input"
            value={commercantStatusFilter}
            onChange={(event) => setCommercantStatusFilterValue(event.target.value as CommercialStatusFilter)}
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Désactivés</option>
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="commercant-count-filter">Nombre</label>
          <select
            id="commercant-count-filter"
            className="form-input"
            value={pageSize}
            onChange={(event) => setPageSizeValue(Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} lignes
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="filter-actions">
        <span className="filter-group-label">
          {filteredCommercants.length} commerçant{filteredCommercants.length > 1 ? 's' : ''}
        </span>
        <button
          type="button"
          className="clear-filters-btn"
          disabled={!hasCommercantFilters}
          onClick={clearCommercantFilters}
        >
          Réinitialiser
        </button>
      </div>
    </div>
  );

  const hasBackOfficeFilters =
    backOfficeServiceFilter !== 'all' || backOfficeStatusFilter !== 'all' || pageSize !== 8;

  const renderBackOfficeFilters = () => (
    <div className="filters-layout">
      <div className="filter-row">
        <div className="filter-field">
          <label htmlFor="backoffice-service-filter">Service</label>
          <select
            id="backoffice-service-filter"
            className="form-input"
            value={backOfficeServiceFilter}
            onChange={(event) => setBackOfficeServiceFilterValue(event.target.value)}
          >
            <option value="all">Tous les services</option>
            {backOfficeServiceOptions.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="backoffice-status-filter">Statut</label>
          <select
            id="backoffice-status-filter"
            className="form-input"
            value={backOfficeStatusFilter}
            onChange={(event) => setBackOfficeStatusFilterValue(event.target.value as CommercialStatusFilter)}
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">En attente</option>
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="backoffice-count-filter">Nombre</label>
          <select
            id="backoffice-count-filter"
            className="form-input"
            value={pageSize}
            onChange={(event) => setPageSizeValue(Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} lignes
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="filter-actions">
        <span className="filter-group-label">
          {filteredBackOffices.length} compte{filteredBackOffices.length > 1 ? 's' : ''}
        </span>
        <button
          type="button"
          className="clear-filters-btn"
          disabled={!hasBackOfficeFilters}
          onClick={clearBackOfficeFilters}
        >
          Réinitialiser
        </button>
        <Link className="btn-primary" to={createRoute}>
          Ajouter
        </Link>
      </div>
    </div>
  );

  return (
    <div className="page-grid">
      <div className="page-card">
        {successMessage && <div className="page-alert success" role="status">{successMessage}</div>}
        {errorMessage && <div className="page-alert error" role="alert">{errorMessage}</div>}
        {!isLoading && isBackOfficeDirectory && overview.backOffices.length > 0 && renderBackOfficeFilters()}
        {!isLoading && isCommercialeDirectory && overview.commerciales.length > 0 && renderCommercialFilters()}
        {!isLoading && isCommercantDirectory && overview.commercants.length > 0 && renderCommercantFilters()}

        {isLoading && (
          <div className="page-loading">
            <div className="page-loading-spinner" />
            <span>Chargement de la liste...</span>
          </div>
        )}

        {!isLoading && isBackOfficeDirectory && !overview.backOffices.length && (
          <div className="empty-state">Aucun compte back office n'a été trouvé.</div>
        )}
        {!isLoading && isBackOfficeDirectory && overview.backOffices.length > 0 && !filteredBackOffices.length && (
          <div className="empty-state">Aucun compte back office ne correspond aux filtres sélectionnés.</div>
        )}
        {!isLoading && isCommercialeDirectory && !overview.commerciales.length && (
          <div className="empty-state">Aucun compte commercial n'a été trouvé.</div>
        )}
        {!isLoading && isCommercialeDirectory && overview.commerciales.length > 0 && !filteredCommerciales.length && (
          <div className="empty-state">Aucun commercial ne correspond aux filtres sélectionnés.</div>
        )}
        {!isLoading && isCommercantDirectory && !overview.commercants.length && (
          <div className="empty-state">Aucun commerçant n'a été trouvé.</div>
        )}
        {!isLoading && isCommercantDirectory && overview.commercants.length > 0 && !filteredCommercants.length && (
          <div className="empty-state">Aucun commerçant ne correspond aux filtres sélectionnés.</div>
        )}

        {!isLoading && isBackOfficeDirectory && filteredBackOffices.length > 0 && (
          <div className="table-shell">
            {renderToolbar()}
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Identité</th>
                    <th>Service</th>
                    <th>État</th>
                    <th>Dates</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedBackOffice.map((item: BackOfficeDirectoryItem) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.prenom} {item.nom}</strong>
                        <span>{item.email}</span>
                        <span>Matricule: {item.matricule || '-'}</span>
                      </td>
                      <td>
                        <strong>{item.service || '-'}</strong>
                        <span>{formatEnumLabel(item.role)}</span>
                      </td>
                      <td>
                        <span className={`status-chip ${item.active ? 'tone-active' : 'tone-pending'}`}>
                          {item.active ? 'Actif' : 'En attente'}
                        </span>
                      </td>
                      <td>
                        <strong>{formatDate(item.dateCreation)}</strong>
                        <span>Activation: {item.dateActivation ? formatDate(item.dateActivation) : 'Non activé'}</span>
                      </td>
                      <td>
                        {item.active ? (
                          <button
                            type="button"
                            className="btn-secondary btn-warn"
                            disabled={isProcessing && processingId === item.id}
                            onClick={() => runAction(item.id, () => apiDeactivateBackOffice(item.id), 'Impossible de désactiver le compte back office.')}
                          >
                            {isProcessing && processingId === item.id ? 'Mise à jour...' : 'Désactiver'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={isProcessing && processingId === item.id}
                            onClick={() => runAction(item.id, () => apiSendBackOfficeActivation(item.id), "Impossible de renvoyer l'e-mail d'activation au back office.")}
                          >
                            {isProcessing && processingId === item.id ? 'Envoi...' : 'Renvoyer activation'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </div>
        )}

        {!isLoading && isCommercialeDirectory && filteredCommerciales.length > 0 && (
          <div className="table-shell">
            {renderToolbar()}
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Identité</th>
                    <th>Région</th>
                    <th>Contact</th>
                    <th>État</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCommerciale.map((item: CommercialeDirectoryItem) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.prenom} {item.nom}</strong>
                        <span>{item.email}</span>
                        <span>Matricule: {item.matricule || '-'}</span>
                      </td>
                      <td>
                        <strong>{item.region || '-'}</strong>
                        <span>{formatEnumLabel(item.role)}</span>
                      </td>
                      <td>
                        <strong>{item.telephone || '-'}</strong>
                        <span>Activation: {item.dateActivation ? formatDate(item.dateActivation) : 'Non activé'}</span>
                      </td>
                      <td>
                        <span className={`status-chip ${item.active ? 'tone-active' : 'tone-pending'}`}>
                          {item.active ? 'Actif' : 'En attente'}
                        </span>
                      </td>
                      <td>
                        {item.active ? (
                          <button
                            type="button"
                            className="btn-secondary btn-warn"
                            disabled={isProcessing && processingId === item.id}
                            onClick={() => runAction(item.id, () => apiDeactivateCommerciale(item.id), 'Impossible de désactiver le compte commercial.')}
                          >
                            {isProcessing && processingId === item.id ? 'Mise à jour...' : 'Désactiver'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={isProcessing && processingId === item.id}
                            onClick={() => runAction(item.id, () => apiSendCommercialeActivation(item.id), "Impossible de renvoyer l'e-mail d'activation au commercial.")}
                          >
                            {isProcessing && processingId === item.id ? 'Envoi...' : 'Renvoyer activation'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </div>
        )}

        {!isLoading && isCommercantDirectory && filteredCommercants.length > 0 && (
          <div className="table-shell commercant-table-shell">
            {renderToolbar()}
            <div className="table-scroll">
              <table className="data-table commercant-table">
                <thead>
                  <tr>
                    <th>Commerçant</th>
                    <th>Type de personne</th>
                    <th>Type d'affiliation</th>
                    <th>Localisation</th>
                    <th>État</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCommercant.map((item: CommercantDirectoryItem) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.nom}</strong>
                        <span>{item.email || '-'}</span>
                      </td>
                      <td>
                        <strong>{formatEnumLabel(item.typeCommercant)}</strong>
                        <span>{item.activite || '-'}</span>
                      </td>
                      <td>
                        <span className={`affiliation-badge ${affiliationToneClass(item.typeAffiliation)}`}>
                          {item.typeAffiliation ? formatEnumLabel(item.typeAffiliation) : 'Non renseigné'}
                        </span>
                      </td>
                      <td>
                        <strong>{item.ville || '-'}</strong>
                        <span>{item.telephone || '-'}</span>
                      </td>
                      <td>
                        <span className={`status-chip ${item.active ? 'tone-active' : 'tone-pending'}`}>
                          {item.active ? 'Actif' : 'Désactivé'}
                        </span>
                      </td>
                      <td>
                        {item.active ? (
                          <div className="directory-actions-group">
                            <button
                              type="button"
                              className="btn-secondary btn-warn"
                              disabled={isProcessing && processingId === item.id}
                              onClick={() => runAction(item.id, () => apiDeactivateCommercant(item.id), 'Impossible de désactiver le compte commerçant.')}
                            >
                              {isProcessing && processingId === item.id ? 'Mise à jour...' : 'Désactiver'}
                            </button>
                            {item.typeAffiliation && (
                              <button
                                type="button"
                                className="btn-secondary btn-danger"
                                disabled={isProcessing && processingId === item.id}
                                onClick={() => handleResilier(item)}
                                title="Marque le contrat comme résilié (label réel pour le modèle de risque) et désactive le compte"
                              >
                                {isProcessing && processingId === item.id ? 'Mise à jour...' : 'Résilier'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={isProcessing && processingId === item.id}
                            onClick={() => runAction(item.id, () => apiSendCommercantActivation(item.id), "Impossible de renvoyer l'e-mail d'activation au commerçant.")}
                          >
                            {isProcessing && processingId === item.id ? 'Envoi...' : 'Renvoyer activation'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </div>
        )}
      </div>
    </div>
  );
}
