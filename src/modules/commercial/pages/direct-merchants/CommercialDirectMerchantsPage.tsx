import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAffiliationRequests, AffiliationRequestItem } from '../../../supervisor/services/supervisorApi';
import { useSessionStore } from '../../../../store/sessionStore';
import {
  formatEnumLabel,
  getAffiliationStatusLabel,
  resolveAffiliationStatusKey
} from '../../../supervisor/services/supervisorUiUtils';
import '../../../../styles/page.shared.scss';
import '../../../../styles/commercial-direct-merchants.scss';

type MerchantAction = 'relance' | 'visite';

export default function CommercialDirectMerchantsPage() {
  const navigate = useNavigate();
  const { session } = useSessionStore();
  const hasAccess = session?.role === 'COMMERCIAL';

  const [merchants, setMerchants] = useState<AffiliationRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [affiliationTypeFilter, setAffiliationTypeFilter] = useState('all');

  function uniqueMerchants(requests: AffiliationRequestItem[]): AffiliationRequestItem[] {
    const seen = new Set<number | string>();
    return [...requests]
      .sort((left, right) => right.dossierId - left.dossierId)
      .filter((request) => {
        const key = request.commercantId ?? request.email ?? request.dossierId;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }

  async function loadMerchants() {
    if (!hasAccess) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await getAffiliationRequests();
      const all = Array.isArray(response.requests) ? response.requests : [];
      const direct = uniqueMerchants(all.filter((request) => request.origineCreation === 'COMMERCIAL_DIRECT'));
      setMerchants(direct);
      setErrorMessage('');
    } catch {
      setErrorMessage(
        'Impossible de charger les commerçants ajoutés pour le moment. Réessayez dans quelques secondes.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadMerchants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const affiliationTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const merchant of merchants) {
      counts.set(merchant.typeAffiliation, (counts.get(merchant.typeAffiliation) ?? 0) + 1);
    }
    return [
      { key: 'all', label: 'Tous les types', count: merchants.length },
      ...Array.from(counts.entries()).map(([key, count]) => ({
        key,
        label: formatEnumLabel(key),
        count
      }))
    ];
  }, [merchants]);

  const filteredMerchants = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return merchants.filter((merchant) => {
      const matchesType =
        affiliationTypeFilter === 'all' || merchant.typeAffiliation === affiliationTypeFilter;
      const searchable = [
        merchant.dossierId,
        merchant.nomCommercant,
        merchant.nom,
        merchant.prenom,
        merchant.email,
        merchant.telephone,
        merchant.ville,
        merchant.region,
        merchant.typeAffiliation,
        merchant.status
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(' ')
        .toLowerCase();
      return matchesType && (!term || searchable.includes(term));
    });
  }, [merchants, searchTerm, affiliationTypeFilter]);

  function clearFilters() {
    setSearchTerm('');
    setAffiliationTypeFilter('all');
  }

  function openDossier(merchant: AffiliationRequestItem) {
    navigate(`/commercial/demandes-commerciales/${merchant.dossierId}`);
  }
  function continueDossier(merchant: AffiliationRequestItem) {
    navigate(`/commercial/demandes-commerciales/${merchant.dossierId}/continue`);
  }
  function openInteraction(merchant: AffiliationRequestItem, action: MerchantAction) {
    const recipient = merchant.email || '';
    const subject =
      action === 'visite'
        ? `Planification de visite - dossier #${merchant.dossierId}`
        : `Relance dossier affiliation #${merchant.dossierId}`;
    const body =
      action === 'visite'
        ? `Bonjour ${merchant.nomCommercant || ''},%0D%0A%0D%0ANous souhaitons planifier une visite commerciale pour finaliser votre dossier d'affiliation.%0D%0A%0D%0ACordialement.`
        : `Bonjour ${merchant.nomCommercant || ''},%0D%0A%0D%0ANous revenons vers vous concernant votre dossier d'affiliation #${merchant.dossierId}.%0D%0A%0D%0ACordialement.`;
    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${body}`;
  }

  function canContinue(merchant: AffiliationRequestItem): boolean {
    return merchant.status === 'BROUILLON' || merchant.status === 'SOUMIS';
  }
  function getStatusLabel(merchant: AffiliationRequestItem): string {
    return merchant.status === 'BROUILLON' ? 'Brouillon' : getAffiliationStatusLabel(merchant);
  }
  function getStatusKey(merchant: AffiliationRequestItem): string {
    return merchant.status === 'BROUILLON' ? 'draft' : resolveAffiliationStatusKey(merchant);
  }
  function getNextActionLabel(merchant: AffiliationRequestItem): string {
    if (merchant.status === 'BROUILLON') {
      return 'Compléter le brouillon';
    }
    if (merchant.status === 'SOUMIS') {
      return 'Finaliser la demande';
    }
    if (merchant.status === 'ABANDONNE') {
      return 'Relancer après abandon';
    }
    if (!merchant.compteRenduDateVisite) {
      return 'Visite à planifier';
    }
    return 'Suivi commercial';
  }

  if (!hasAccess) {
    return (
      <div className="access-card">
        <strong>Accès indisponible</strong>
        <span>Cette page est réservée au poste commercial.</span>
      </div>
    );
  }

  return (
    <div className="page-grid dashboard-page direct-merchants-page commercial-mode">
      <div className="page-card filter-card">
        <div className="filter-panel merchants-filter-panel">
          <div className="filter-panel-head">
            <div>
              <strong>Commerçants ajoutés par la commerciale</strong>
              <span>Suivi des contacts, dossier lié, état, relance et visite commerciale.</span>
            </div>
          </div>

          <div className="filter-form-grid merchants-filter-grid">
            <div className="search-field">
              <label htmlFor="merchants-search">Recherche</label>
              <input
                id="merchants-search"
                type="search"
                className="form-input"
                placeholder="Nom, prénom, e-mail, téléphone ou dossier"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="filter-field">
              <label htmlFor="merchants-type">Type d'affiliation</label>
              <select
                id="merchants-type"
                className="form-input"
                value={affiliationTypeFilter}
                onChange={(e) => setAffiliationTypeFilter(e.target.value)}
              >
                {affiliationTypes.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
            </div>

            <button type="button" className="clear-filters-btn" onClick={clearFilters}>
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

        {isLoading ? (
          <div className="page-loading">
            <div className="page-loading-spinner" />
            <span>Chargement des commerçants ajoutés...</span>
          </div>
        ) : !filteredMerchants.length ? (
          <div className="empty-state">
            Aucun commerçant ajouté par la commerciale ne correspond aux critères.
          </div>
        ) : (
          <>
            <div className="table-toolbar">
              <div className="table-summary">
                <strong>{filteredMerchants.length} commerçant(s)</strong>
                <span>Suivi du portefeuille direct créé par le poste commercial.</span>
              </div>
            </div>

            <div className="table-scroll">
              <table className="data-table request-table direct-request-table">
                <thead>
                  <tr>
                    <th>Dossier</th>
                    <th>Commerçant</th>
                    <th>Affiliation</th>
                    <th>État</th>
                    <th>Dernière visite</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMerchants.map((merchant) => (
                    <tr key={merchant.dossierId} className={`row-${getStatusKey(merchant)}`}>
                      <td>
                        <strong>#{merchant.dossierId}</strong>
                        <span>{formatEnumLabel(merchant.typeCommercant)}</span>
                      </td>
                      <td>
                        <strong>{merchant.nomCommercant || merchant.email || 'Commerçant sans nom'}</strong>
                        <span>
                          {merchant.nom} {merchant.prenom}
                        </span>
                        <span>{merchant.email || '-'}</span>
                        <span>{merchant.telephone || '-'}</span>
                      </td>
                      <td>
                        <strong>{formatEnumLabel(merchant.typeAffiliation)}</strong>
                        <span>
                          {merchant.ville || '-'} / {merchant.region || '-'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge status-${getStatusKey(merchant)}`}>
                          {getStatusLabel(merchant)}
                        </span>
                        <span className="table-meta">{getNextActionLabel(merchant)}</span>
                      </td>
                      <td>
                        <strong>{merchant.compteRenduDateVisite || 'À planifier'}</strong>
                        <span>CR: {merchant.compteRenduDateVisite ? 'généré' : 'non généré'}</span>
                      </td>
                      <td>
                        <div className="table-actions">
                          {canContinue(merchant) && (
                            <button
                              type="button"
                              className="action-btn action-btn-primary"
                              onClick={() => continueDossier(merchant)}
                            >
                              Compléter
                            </button>
                          )}
                          <button type="button" className="action-btn" onClick={() => openDossier(merchant)}>
                            Dossier
                          </button>
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => openInteraction(merchant, 'relance')}
                          >
                            Relancer
                          </button>
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => openInteraction(merchant, 'visite')}
                          >
                            Visite
                          </button>
                        </div>
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
