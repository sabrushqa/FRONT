import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AffiliationRequestItem, getAffiliationRequests } from '../../../supervisor/services/supervisorApi';
import { useSessionStore } from '../../../../store/sessionStore';
import {
  formatEnumLabel,
  getAffiliationStatusLabel,
  resolveAffiliationStatusKey
} from '../../../supervisor/services/supervisorUiUtils';
import '../../../../styles/page.shared.scss';
import '../../../../styles/backoffice-commercial-requests.scss';

type Option = {
  key: string;
  label: string;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium' }).format(date);
}

function buildOptions(values: string[], allLabel: string, formatLabel: (value: string) => string = (value) => value): Option[] {
  return [
    { key: 'all', label: allLabel },
    ...Array.from(new Set(values))
      .sort((left, right) => left.localeCompare(right, 'fr'))
      .map((value) => ({ key: value, label: formatLabel(value) }))
  ];
}

function resolveCommercialLabel(request: AffiliationRequestItem): string {
  return request.commercialAttribue?.trim() || 'Non renseignée';
}

function isCommercialProspectionToReview(request: AffiliationRequestItem): boolean {
  return (
    request.origineCreation === 'COMMERCIAL_DIRECT' &&
    request.status === 'EN_ATTENTE_VALIDATION_BOA'
  );
}

function resolveDetailRoute(request: AffiliationRequestItem): string {
  return `/backoffice/demandes-commerciales/${request.dossierId}`;
}

export default function BackofficeCommercialRequestsPage() {
  const navigate = useNavigate();
  const { session } = useSessionStore();
  const canValidateDossiers = session?.peutValiderDossiers !== false;
  const [requests, setRequests] = useState<AffiliationRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [commercantFilter, setCommercantFilter] = useState('');
  const [commercialFilter, setCommercialFilter] = useState('all');
  const [affiliationTypeFilter, setAffiliationTypeFilter] = useState('all');

  useEffect(() => {
    let mounted = true;
    if (!canValidateDossiers) {
      setRequests([]);
      setIsLoading(false);
      return () => {
        mounted = false;
      };
    }
    setIsLoading(true);
    getAffiliationRequests()
      .then((response) => {
        if (!mounted) return;
        setRequests(
          response.requests
            .filter(isCommercialProspectionToReview)
            .sort((left, right) => right.dossierId - left.dossierId)
        );
        setErrorMessage('');
      })
      .catch(() => {
        if (mounted) setErrorMessage('Impossible de charger les demandes créées par les commerciales.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [canValidateDossiers]);

  if (!canValidateDossiers) {
    return (
      <div className="access-card">
        <strong>Accès indisponible</strong>
        <span>Votre compte back office n'est pas autorisé à valider ou refuser les demandes.</span>
      </div>
    );
  }

  const commercialOptions = useMemo(
    () => buildOptions(requests.map(resolveCommercialLabel), 'Toutes les commerciales'),
    [requests]
  );
  const affiliationTypeOptions = useMemo(
    () => buildOptions(requests.map((request) => request.typeAffiliation).filter(Boolean), 'Tous les types', formatEnumLabel),
    [requests]
  );

  const requestStats = useMemo(() => {
    const corrected = requests.filter((request) => request.nombreCorrections > 0).length;
    return {
      total: requests.length,
      newRequests: requests.length - corrected,
      corrected
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const normalizedCommercant = commercantFilter.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesCommercial = commercialFilter === 'all' || resolveCommercialLabel(request) === commercialFilter;
      const matchesType = affiliationTypeFilter === 'all' || request.typeAffiliation === affiliationTypeFilter;
      const matchesCommercant =
        !normalizedCommercant ||
        [request.nomCommercant, request.email, request.telephone, String(request.dossierId)]
          .join(' ')
          .toLowerCase()
          .includes(normalizedCommercant);
      return matchesCommercial && matchesType && matchesCommercant;
    });
  }, [requests, commercantFilter, commercialFilter, affiliationTypeFilter]);

  function clearFilters() {
    setCommercantFilter('');
    setCommercialFilter('all');
    setAffiliationTypeFilter('all');
  }

  return (
    <div className="commercial-requests-page">
      <section className="prospection-stats" aria-label="Résumé des demandes">
        <article className="prospection-stat prospection-stat--total">
          <span className="material-icons" aria-hidden="true">inbox</span>
          <div><strong>{isLoading ? '—' : requestStats.total}</strong><small>Total en attente</small></div>
        </article>
        <article className="prospection-stat prospection-stat--new">
          <span className="material-icons" aria-hidden="true">fiber_new</span>
          <div><strong>{isLoading ? '—' : requestStats.newRequests}</strong><small>Nouveaux dossiers</small></div>
        </article>
        <article className="prospection-stat prospection-stat--corrected">
          <span className="material-icons" aria-hidden="true">published_with_changes</span>
          <div><strong>{isLoading ? '—' : requestStats.corrected}</strong><small>À revalider</small></div>
        </article>
      </section>

      <section className="filter-card" aria-labelledby="prospection-filters-title">
        <div className="filter-head">
          <div>
            <span className="filter-head__icon material-icons" aria-hidden="true">tune</span>
            <div>
              <strong id="prospection-filters-title">Rechercher et filtrer</strong>
              <span>Affinez la file de traitement selon vos critères.</span>
            </div>
          </div>
          <button className="btn-secondary" type="button" onClick={clearFilters}>
            <span className="material-icons" aria-hidden="true">restart_alt</span>
            Réinitialiser
          </button>
        </div>

        <div className="filter-grid">
          <label className="form-group">
            <span>Commerçant</span>
            <div className="filter-input-wrap">
              <span className="material-icons" aria-hidden="true">search</span>
              <input
                className="form-input"
                value={commercantFilter}
                onChange={(event) => setCommercantFilter(event.target.value)}
                placeholder="Nom, email ou dossier"
              />
            </div>
          </label>
          <label className="form-group">
            <span>Commerciale</span>
            <select className="form-select" value={commercialFilter} onChange={(event) => setCommercialFilter(event.target.value)}>
              {commercialOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-group">
            <span>Type d'affiliation</span>
            <select className="form-select" value={affiliationTypeFilter} onChange={(event) => setAffiliationTypeFilter(event.target.value)}>
              {affiliationTypeOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="table-card" aria-labelledby="prospection-table-title">
        {errorMessage && <div className="page-alert error">{errorMessage}</div>}
        {isLoading && (
          <div className="loading-state">
            <span className="page-loading-spinner" />
            <span>Chargement des demandes commerciales...</span>
          </div>
        )}
        {!isLoading && !filteredRequests.length && (
          <div className="empty-state">Aucune prospection à traiter ne correspond aux filtres.</div>
        )}
        {!isLoading && filteredRequests.length > 0 && (
          <div className="table-wrap">
            <div className="table-summary">
              <div>
                <strong id="prospection-table-title">Dossiers à contrôler</strong>
                <span>{filteredRequests.length} {filteredRequests.length > 1 ? 'demandes affichées' : 'demande affichée'}</span>
              </div>
              <span className="table-summary__hint"><span className="material-icons" aria-hidden="true">info</span>Ouvrez un dossier pour vérifier ses pièces.</span>
            </div>
            <table className="commercial-table">
              <thead>
                <tr>
                  <th>Dossier</th>
                  <th>Commerçant</th>
                  <th>Commerciale</th>
                  <th>Affiliation</th>
                  <th>État</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((item) => (
                  <tr key={item.dossierId}>
                    <td data-label="Dossier">
                      <strong className="dossier-reference">#{item.dossierId}</strong>
                      <span>{formatEnumLabel(item.typeCommercant)}</span>
                    </td>
                    <td data-label="Commerçant">
                      <strong>{item.nomCommercant || item.email}</strong>
                      <span>{item.email || '-'}</span>
                    </td>
                    <td data-label="Commerciale">
                      <strong>{item.commercialAttribue || 'Non renseignée'}</strong>
                    </td>
                    <td data-label="Affiliation">
                      <strong>{formatEnumLabel(item.typeAffiliation)}</strong>
                      <span>{item.activite || '-'}</span>
                    </td>
                    <td data-label="État">
                      <span className={`status-badge status-${resolveAffiliationStatusKey(item)}`}>
                        <span className="status-dot" aria-hidden="true" />
                        {getAffiliationStatusLabel(item)}
                      </span>
                      {item.status === 'EN_ATTENTE_VALIDATION_BOA' && item.nombreCorrections > 0 && (
                        <span
                          className="status-badge status-correction"
                          title="Ce dossier a été renvoyé au commercial pour correction avant de revenir au back office."
                        >
                          Corrigé — à revalider ({item.nombreCorrections})
                        </span>
                      )}
                    </td>
                    <td data-label="Date">
                      <strong>{formatDate(item.dateSoumission)}</strong>
                    </td>
                    <td data-label="Actions">
                      <button className="btn-secondary table-action" type="button" onClick={() => navigate(resolveDetailRoute(item))}>
                        Consulter
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
