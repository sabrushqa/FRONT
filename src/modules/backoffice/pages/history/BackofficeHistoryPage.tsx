import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../../../../store/sessionStore';
import { AffiliationRequestItem, getAffiliationRequests } from '../../../supervisor/services/supervisorApi';
import {
  formatEnumLabel,
  getAffiliationStatusLabel,
  resolveAffiliationStatusKey
} from '../../../supervisor/services/supervisorUiUtils';
import { isHandledByCurrentBackOffice } from '../../../workspace/workspaceUtils';
import '../../../../styles/page.shared.scss';
import '../../../../styles/backoffice-history.scss';

type HistoryTypeFilter = 'all' | 'auto' | 'prospection' | 'extension';
type HistoryStatusFilter = 'all' | 'VALIDE' | 'ABANDONNE';

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium' }).format(date);
}

function isProspectionRequest(request: AffiliationRequestItem): boolean {
  return request.origineCreation === 'COMMERCIAL_DIRECT';
}

function isExtensionRequest(request: AffiliationRequestItem): boolean {
  return request.origineCreation === 'NOUVEAU_PDV';
}

function isBackOfficeValidatedRequest(request: AffiliationRequestItem): boolean {
  return request.status === 'CONTRAT_A_SIGNER' || request.status === 'ACCEPTE';
}

function isBackOfficeHandledDecision(request: AffiliationRequestItem): boolean {
  return isBackOfficeValidatedRequest(request) || request.status === 'ABANDONNE';
}

function resolveDetailRoute(request: AffiliationRequestItem): string {
  if (request.origineCreation === 'COMMERCIAL_DIRECT') {
    return `/backoffice/demandes-commerciales/${request.dossierId}`;
  }
  if (request.origineCreation === 'NOUVEAU_PDV') {
    return `/backoffice/demande-extention/${request.dossierId}`;
  }
  return `/backoffice/dossiers/${request.dossierId}`;
}

export default function BackofficeHistoryPage() {
  const navigate = useNavigate();
  const { session } = useSessionStore();
  const [requests, setRequests] = useState<AffiliationRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<HistoryTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>('all');

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getAffiliationRequests()
      .then((response) => {
        if (!mounted) return;
        const handledRequests = response.requests
          .filter(
            (request) =>
              isBackOfficeHandledDecision(request) &&
              isHandledByCurrentBackOffice(request, session)
          )
          .sort((left, right) => getRequestTimestamp(right) - getRequestTimestamp(left));
        setRequests(handledRequests);
        setErrorMessage('');
      })
      .catch(() => {
        if (mounted) setErrorMessage('Impossible de charger l\'historique des dossiers traités.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.utilisateurId, session?.email, session?.nom]);

  function getRequestTimestamp(request: AffiliationRequestItem): number {
    const date = request.dateTraitementBackOffice || request.dateSoumission;
    if (!date) return request.dossierId;
    const timestamp = new Date(date).getTime();
    return Number.isNaN(timestamp) ? request.dossierId : timestamp;
  }

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesType =
        typeFilter === 'all' ||
        (typeFilter === 'prospection'
          ? isProspectionRequest(request)
          : typeFilter === 'extension'
            ? isExtensionRequest(request)
            : !isProspectionRequest(request) && !isExtensionRequest(request));
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'VALIDE' ? isBackOfficeValidatedRequest(request) : request.status === statusFilter);
      const matchesSearch =
        !normalizedSearch ||
        [request.nomCommercant, request.email, request.telephone, request.region, String(request.dossierId)]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [requests, searchTerm, typeFilter, statusFilter]);

  const acceptedCount = requests.filter(isBackOfficeValidatedRequest).length;
  const abandonedCount = requests.filter((request) => request.status === 'ABANDONNE').length;
  const autoCount = requests.filter((request) => !isProspectionRequest(request) && !isExtensionRequest(request)).length;
  const prospectionCount = requests.filter(isProspectionRequest).length;
  const extensionCount = requests.filter(isExtensionRequest).length;

  function clearFilters() {
    setSearchTerm('');
    setTypeFilter('all');
    setStatusFilter('all');
  }

  return (
    <div className="history-page">
      <section className="history-stats" aria-label="Résumé de l'historique">
        <article className="history-stat history-stat--total">
          <span className="material-icons" aria-hidden="true">fact_check</span>
          <div><strong>{isLoading ? '—' : requests.length}</strong><small>Total traités</small></div>
        </article>
        <article className="history-stat history-stat--accepted">
          <span className="material-icons" aria-hidden="true">task_alt</span>
          <div><strong>{isLoading ? '—' : acceptedCount}</strong><small>Acceptés</small></div>
        </article>
        <article className="history-stat history-stat--abandoned">
          <span className="material-icons" aria-hidden="true">cancel</span>
          <div><strong>{isLoading ? '—' : abandonedCount}</strong><small>Abandonnés</small></div>
        </article>
        <article className="history-stat history-stat--auto">
          <span className="material-icons" aria-hidden="true">assignment_ind</span>
          <div><strong>{isLoading ? '—' : autoCount}</strong><small>Auto-affiliation</small></div>
        </article>
        <article className="history-stat history-stat--prospection">
          <span className="material-icons" aria-hidden="true">person_search</span>
          <div><strong>{isLoading ? '—' : prospectionCount}</strong><small>Prospection</small></div>
        </article>
        <article className="history-stat history-stat--extension">
          <span className="material-icons" aria-hidden="true">add_business</span>
          <div><strong>{isLoading ? '—' : extensionCount}</strong><small>Extension</small></div>
        </article>
      </section>

      <section className="filter-card" aria-labelledby="history-filters-title">
        <div className="summary-head">
          <div className="summary-head__title">
            <span className="summary-head__icon material-icons" aria-hidden="true">manage_search</span>
            <div>
              <strong id="history-filters-title">Historique des dossiers traités</strong>
              <span>Uniquement les validations et refus effectués par le BOA connecté.</span>
            </div>
          </div>
          <button className="btn-secondary" type="button" onClick={clearFilters}>
            <span className="material-icons" aria-hidden="true">restart_alt</span>{' '}
            Réinitialiser
          </button>
        </div>

        <div className="filter-grid">
          <label className="form-group">
            <span>Recherche</span>
            <div className="filter-input-wrap">
              <span className="material-icons" aria-hidden="true">search</span>
              <input
                className="form-input"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Nom, email, région ou dossier"
              />
            </div>
          </label>
          <label className="form-group">
            <span>Origine</span>
            <select className="form-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as HistoryTypeFilter)}>
              <option value="all">Toutes</option>
              <option value="auto">Auto-affiliation</option>
              <option value="prospection">Prospection</option>
              <option value="extension">Extension</option>
            </select>
          </label>
          <label className="form-group">
            <span>État</span>
            <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as HistoryStatusFilter)}>
              <option value="all">Tous</option>
              <option value="VALIDE">Validés</option>
              <option value="ABANDONNE">Abandonnés</option>
            </select>
          </label>
        </div>
      </section>

      <section className="table-card" aria-labelledby="history-table-title">
        {errorMessage && <div className="page-alert error">{errorMessage}</div>}
        {isLoading && (
          <div className="loading-state">
            <span className="page-loading-spinner" />
            <span>Chargement de l'historique...</span>
          </div>
        )}
        {!isLoading && !filteredRequests.length && (
          <div className="empty-state">Aucun dossier traité ne correspond aux filtres.</div>
        )}
        {!isLoading && filteredRequests.length > 0 && (
          <div className="table-wrap">
            <div className="table-summary">
              <div>
                <strong id="history-table-title">Dossiers archivés</strong>
                <span>{filteredRequests.length} {filteredRequests.length > 1 ? 'dossiers affichés' : 'dossier affiché'}</span>
              </div>
              <span className="table-summary__hint"><span className="material-icons" aria-hidden="true">history</span>Ouvrez un dossier pour revoir son traitement.</span>
            </div>
            <table className="history-table">
              <thead>
                <tr>
                  <th>Dossier</th>
                  <th>Commerçant</th>
                  <th>Origine</th>
                  <th>État</th>
                  <th>Traitement</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((item) => (
                  <tr key={item.dossierId}>
                    <td data-label="Dossier">
                      <strong>#{item.dossierId}</strong>
                      <span>{formatEnumLabel(item.typeAffiliation)}</span>
                    </td>
                    <td data-label="Commerçant">
                      <strong>{item.nomCommercant || item.email}</strong>
                      <span>{item.email || '-'}</span>
                    </td>
                    <td data-label="Origine">
                      <strong>{isProspectionRequest(item) ? 'Prospection' : 'Auto-affiliation'}</strong>
                      <span>{item.commercialAttribue || 'Non renseignée'}</span>
                    </td>
                    <td data-label="État">
                      <span className={`status-badge status-${resolveAffiliationStatusKey(item)}`}>
                        <span className="status-dot" aria-hidden="true" />
                        {getAffiliationStatusLabel(item)}
                      </span>
                    </td>
                    <td data-label="Traitement">
                      <strong>{formatDate(item.dateTraitementBackOffice)}</strong>
                      {item.dateSoumission && <span>Soumis le {formatDate(item.dateSoumission)}</span>}
                    </td>
                    <td data-label="Actions">
                      <button className="btn-secondary table-action" type="button" onClick={() => navigate(resolveDetailRoute(item))}>
                        Consulter{' '}
                        <span className="material-icons" aria-hidden="true">arrow_forward</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
