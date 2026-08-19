import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SupervisorActionResponse,
  SupervisorTpeStockItem,
  activateTpe,
  deactivateTpe,
  getTpeStock
} from '../../services/supervisorApi';
import { extractApiErrorMessage } from '../../services/supervisorUiUtils';
import '../../../../styles/page.shared.scss';
import '../../../../styles/supervisor-tpe-stock.scss';

const PAGE_SIZE_OPTIONS = [10, 20, 40];

function StatusBadge({ tpe }: { tpe: SupervisorTpeStockItem }) {
  if (!tpe.actif) {
    return <span className="tpe-status tpe-status-INACTIF">Inactif</span>;
  }
  if (tpe.statut === 'AFFECTE_COMMERCANT') {
    return <span className="tpe-status tpe-status-AFFECTE_COMMERCANT">Affecté</span>;
  }
  return <span className="tpe-status tpe-status-DISPONIBLE">Disponible</span>;
}

export default function SupervisorTpeStockPage() {
  const [tpes, setTpes] = useState<SupervisorTpeStockItem[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const loadTpes = useCallback(async (preserveFeedback = false) => {
    setIsLoading(true);
    if (!preserveFeedback) {
      setMessage('');
      setErrorMessage('');
    }
    try {
      const stock = await getTpeStock();
      setTpes(stock.tpes);
    } catch {
      setErrorMessage('Impossible de charger le stock TPE.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTpes();
  }, [loadTpes]);

  const stats = useMemo(() => {
    const actifs = tpes.filter((tpe) => tpe.actif);
    const affectes = actifs.filter((tpe) => tpe.statut === 'AFFECTE_COMMERCANT');
    return {
      total: tpes.length,
      disponibles: actifs.length - affectes.length,
      affectes: affectes.length,
      inactifs: tpes.length - actifs.length
    };
  }, [tpes]);

  const filteredTpes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tpes.filter((tpe) => {
      const matchType = !filterType || tpe.typeCompatible === filterType;
      const matchStatus =
        !filterStatus
        || (filterStatus === 'ACTIF' && tpe.actif)
        || (filterStatus === 'INACTIF' && !tpe.actif)
        || (filterStatus === 'DISPONIBLE' && tpe.actif && tpe.statut === 'DISPONIBLE')
        || (filterStatus === 'AFFECTE_COMMERCANT' && tpe.actif && tpe.statut === 'AFFECTE_COMMERCANT');
      const matchSearch = !q || [tpe.numeroSerie, tpe.modele, tpe.commercant, tpe.pdv]
        .join(' ')
        .toLowerCase()
        .includes(q);
      return matchType && matchStatus && matchSearch;
    });
  }, [tpes, filterType, filterStatus, search]);

  useEffect(() => {
    setPageIndex(0);
  }, [filterType, filterStatus, search]);

  const totalPages = Math.max(Math.ceil(filteredTpes.length / pageSize), 1);
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const pagedTpes = useMemo(() => {
    const start = safePageIndex * pageSize;
    return filteredTpes.slice(start, start + pageSize);
  }, [filteredTpes, safePageIndex, pageSize]);
  const canGoToPreviousPage = safePageIndex > 0;
  const canGoToNextPage = safePageIndex < totalPages - 1;

  async function runAction(action: () => Promise<SupervisorActionResponse>, fallback: string) {
    setIsLoading(true);
    setMessage('');
    setErrorMessage('');
    try {
      const response = await action();
      setMessage(response.message);
      await loadTpes(true);
    } catch (error) {
      setIsLoading(false);
      setErrorMessage(extractApiErrorMessage(error, fallback));
    }
  }

  function activate(tpe: SupervisorTpeStockItem) {
    void runAction(() => activateTpe(tpe.id), 'Impossible d’activer cette référence.');
  }

  function deactivate(tpe: SupervisorTpeStockItem) {
    void runAction(() => deactivateTpe(tpe.id), 'Impossible de désactiver cette référence.');
  }

  function clearFilters() {
    setSearch('');
    setFilterType('');
    setFilterStatus('');
  }

  return (
    <div className="tpe-stock-page">
      {/* ── Stats ── */}
      <section className="tpe-stat-grid">
        <article className="tpe-stat">
          <span>Total</span>
          <strong>{stats.total}</strong>
          <small>Références en stock</small>
        </article>
        <article className="tpe-stat disponible">
          <span>Disponibles</span>
          <strong>{stats.disponibles}</strong>
          <small>Actives, non affectées</small>
        </article>
        <article className="tpe-stat affecte">
          <span>Affectées</span>
          <strong>{stats.affectes}</strong>
          <small>Attribuées à un commerçant</small>
        </article>
        <article className="tpe-stat inactif">
          <span>Inactives</span>
          <strong>{stats.inactifs}</strong>
          <small>Désactivées</small>
        </article>
      </section>

      {message && <div className="page-alert success">{message}</div>}
      {errorMessage && <div className="page-alert error">{errorMessage}</div>}

      {/* ── Filters ── */}
      <section className="tpe-filters">
        <label>
          Recherche{' '}
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Référence, modèle, commerçant, PDV..."
          />
        </label>
        <label>
          Type{' '}
          <select value={filterType} onChange={(event) => setFilterType(event.target.value)}>
            <option value="">Tous</option>
            <option value="TPE">TPE</option>
            <option value="SOFTPOS">SoftPOS</option>
            <option value="QR_CODE">QR Code</option>
          </select>
        </label>
        <label>
          Statut{' '}
          <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
            <option value="">Tous</option>
            <option value="DISPONIBLE">Disponibles</option>
            <option value="AFFECTE_COMMERCANT">Affectées</option>
            <option value="INACTIF">Inactives</option>
          </select>
        </label>
        <button className="btn-secondary" type="button" onClick={clearFilters}>
          Réinitialiser
        </button>
        <button className="btn-secondary" type="button" onClick={() => loadTpes()}>
          Actualiser
        </button>
      </section>

      {/* ── Table ── */}
      <section className="tpe-table-card">
        <div className="tpe-table-head">
          <h3>Références TPE</h3>
          <span>
            {filteredTpes.length} référence{filteredTpes.length !== 1 ? 's' : ''}
            {isLoading ? ' · chargement…' : ''}
          </span>
        </div>

        {isLoading && tpes.length === 0 && (
          <div className="tpe-loading">
            <span className="page-loading-spinner" />{' '}
            Chargement du stock TPE...
          </div>
        )}

        {!isLoading && filteredTpes.length === 0 && (
          <div className="tpe-empty">Aucune référence ne correspond aux filtres.</div>
        )}

        {filteredTpes.length > 0 && (
          <div className="tpe-table-wrap">
            <table className="tpe-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Commerçant affecté</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedTpes.map((tpe) => (
                  <tr key={tpe.id}>
                    <td>
                      <strong>{tpe.numeroSerie}</strong>
                      <span>{tpe.modele} · {tpe.typeConnexion}</span>
                    </td>
                    <td><span className="type-badge">{tpe.typeCompatible}</span></td>
                    <td><StatusBadge tpe={tpe} /></td>
                    <td>
                      <strong>{tpe.commercant || 'Non affecté'}</strong>
                      <span>{tpe.pdv || 'Aucun point de vente'}</span>
                    </td>
                    <td className="tpe-actions">
                      {!tpe.actif && (
                        <button type="button" className="btn-activate" onClick={() => activate(tpe)} disabled={isLoading}>
                          Activer
                        </button>
                      )}
                      {tpe.actif && (
                        <button type="button" className="btn-deactivate" onClick={() => deactivate(tpe)} disabled={isLoading}>
                          Désactiver
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

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
                  Page {safePageIndex + 1} / {totalPages}
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
          </div>
        )}
      </section>
    </div>
  );
}
