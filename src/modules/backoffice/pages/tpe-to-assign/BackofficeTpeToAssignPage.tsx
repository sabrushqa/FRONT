import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../../../../store/sessionStore';
import { AffiliationRequestItem, getAffiliationRequests } from '../../../supervisor/services/supervisorApi';
import { formatEnumLabel } from '../../../supervisor/services/supervisorUiUtils';
import {
  getPendingAssignmentLabel,
  isHandledByCurrentBackOffice,
  isNewPdvRequest,
  needsManualAssignment
} from '../../../workspace/workspaceUtils';
import '../../../../styles/page.shared.scss';
import '../../../../styles/backoffice-tpe-to-assign.scss';

type TypeFilter = 'all' | 'TPE' | 'SOFTPOS' | 'QR_CODE' | 'E_COMMERCE' | 'ENCAISSEMENT_ET_ECOMMERCE';
type OriginFilter = 'all' | 'auto' | 'extension';

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium' }).format(date);
}

// Une extension (NOUVEAU_PDV) et un dossier initial rendent le meme
// CommercialDossierDetailPage, mais sous deux routes distinctes — meme
// resolution que BackofficeHistoryPage::resolveDetailRoute.
function resolveDetailRoute(request: AffiliationRequestItem): string {
  if (isNewPdvRequest(request)) {
    return `/backoffice/demande-extention/${request.dossierId}`;
  }
  return `/backoffice/dossiers/${request.dossierId}`;
}

export default function BackofficeTpeToAssignPage() {
  const navigate = useNavigate();
  const { session } = useSessionStore();
  const [requests, setRequests] = useState<AffiliationRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all');

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getAffiliationRequests()
      .then((response) => {
        if (!mounted) return;
        const pendingRequests = response.requests
          .filter(
            (request) =>
              needsManualAssignment(request) && isHandledByCurrentBackOffice(request, session)
          )
          .sort((left, right) => {
            const leftDate = left.dateTraitementBackOffice || left.dateSoumission || '';
            const rightDate = right.dateTraitementBackOffice || right.dateSoumission || '';
            return rightDate.localeCompare(leftDate) || right.dossierId - left.dossierId;
          });
        setRequests(pendingRequests);
        setErrorMessage('');
      })
      .catch(() => {
        if (mounted) setErrorMessage("Impossible de charger la liste des dossiers en attente d'affectation.");
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.utilisateurId, session?.email, session?.nom]);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesType = typeFilter === 'all' || request.typeAffiliation === typeFilter;
      const matchesOrigin =
        originFilter === 'all'
          || (originFilter === 'extension' ? isNewPdvRequest(request) : !isNewPdvRequest(request));
      const matchesSearch =
        !normalizedSearch ||
        [request.nomCommercant, request.email, request.region, String(request.dossierId)]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesType && matchesOrigin && matchesSearch;
    });
  }, [requests, searchTerm, typeFilter, originFilter]);

  const combinedCount = requests.filter((r) => r.typeAffiliation === 'ENCAISSEMENT_ET_ECOMMERCE').length;
  const ecommerceCount = requests.filter((r) => r.typeAffiliation === 'E_COMMERCE').length;
  const extensionCount = requests.filter(isNewPdvRequest).length;

  function clearFilters() {
    setSearchTerm('');
    setTypeFilter('all');
    setOriginFilter('all');
  }

  return (
    <div className="page-grid tpe-to-assign-page">
      <section className="stat-grid" aria-label="Résumé des affectations en attente">
        <article className="stat-card">
          <span>À affecter</span>
          <strong>{isLoading ? '—' : requests.length}</strong>
          <small>
            Dossiers avec contrat signé, en attente d'affectation
            {!isLoading && extensionCount > 0
              ? ` — dont ${extensionCount} extension${extensionCount > 1 ? 's' : ''}`
              : ''}
          </small>
        </article>
        <article className="stat-card">
          <span>Site e-commerce</span>
          <strong>{isLoading ? '—' : ecommerceCount}</strong>
          <small>Dossiers 100% e-commerce</small>
        </article>
        <article className="stat-card">
          <span>TPE + e-commerce</span>
          <strong>{isLoading ? '—' : combinedCount}</strong>
          <small>Dossiers "Encaissement et E-commerce"</small>
        </article>
      </section>

      <div className="page-card filter-card">
        {errorMessage && (
          <div className="page-alert error" role="alert">
            {errorMessage}
          </div>
        )}
        <div className="filters-layout">
          <div className="filter-row">
            <div className="search-field">
              <label htmlFor="tpe-to-assign-search">Recherche</label>
              <input
                id="tpe-to-assign-search"
                type="search"
                className="form-input"
                placeholder="Nom, e-mail, région ou dossier"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="filter-field">
              <label htmlFor="tpe-to-assign-type">Type d'affiliation</label>
              <select
                id="tpe-to-assign-type"
                className="form-input"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              >
                <option value="all">Tous</option>
                <option value="TPE">TPE</option>
                <option value="SOFTPOS">SoftPOS</option>
                <option value="QR_CODE">QR Code</option>
                <option value="E_COMMERCE">E-commerce</option>
                <option value="ENCAISSEMENT_ET_ECOMMERCE">Encaissement et E-commerce</option>
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="tpe-to-assign-origin">Origine</label>
              <select
                id="tpe-to-assign-origin"
                className="form-input"
                value={originFilter}
                onChange={(event) => setOriginFilter(event.target.value as OriginFilter)}
              >
                <option value="all">Toutes</option>
                <option value="auto">Auto-affiliation</option>
                <option value="extension">Extension</option>
              </select>
            </div>
            <button className="btn-secondary clear-filters-btn" type="button" onClick={clearFilters}>
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      <div className="page-card">
        {isLoading && (
          <div className="page-loading">
            <span className="page-loading-spinner" />
            <span>Chargement des dossiers en attente d'affectation...</span>
          </div>
        )}
        {!isLoading && !filteredRequests.length && (
          <div className="empty-state">
            Aucun dossier en attente d'affectation TPE, SoftPOS, QR Code ou site e-commerce.
          </div>
        )}
        {!isLoading && filteredRequests.length > 0 && (
          <>
            <div className="table-toolbar">
              <div className="table-summary">
                <strong>Dossiers à traiter</strong>
                <span>
                  {filteredRequests.length} dossier{filteredRequests.length > 1 ? 's' : ''} en attente
                  d'affectation.
                </span>
              </div>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dossier</th>
                    <th>Commerçant</th>
                    <th>Type d'affiliation</th>
                    <th>Reste à affecter</th>
                    <th>Contrat déposé le</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((item) => (
                    <tr key={item.dossierId}>
                      <td>
                        <strong>#{item.dossierId}</strong>
                        <span>{isNewPdvRequest(item) ? 'Extension' : 'Auto-affiliation'}</span>
                      </td>
                      <td>
                        <strong>{item.nomCommercant || item.email}</strong>
                        <span>{item.email || '-'}</span>
                      </td>
                      <td>{formatEnumLabel(item.typeAffiliation)}</td>
                      <td>
                        <span className="status-badge status-pending">
                          <span className="status-dot" aria-hidden="true" />
                          {getPendingAssignmentLabel(item)}
                        </span>
                      </td>
                      <td>{formatDate(item.dateTraitementBackOffice)}</td>
                      <td>
                        <button
                          className="btn-secondary table-action"
                          type="button"
                          onClick={() => navigate(resolveDetailRoute(item))}
                        >
                          Voir le dossier{' '}
                          <span className="material-icons" aria-hidden="true">arrow_forward</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
