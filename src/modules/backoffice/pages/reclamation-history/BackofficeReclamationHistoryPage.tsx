import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSessionStore } from '../../../../store/sessionStore';
import { ReclamationItem, getReclamations } from '../../services/reclamationsApi';
import '../../../../styles/page.shared.scss';
import '../../../../styles/reclamations-shared.scss';

type StatutFilter = 'all' | 'RESOLU' | 'ESCALADE';
type TypeFilter   = 'all' | 'CONNECTIVITE' | 'TRANSACTION' | 'MATERIEL' | 'LOGICIEL' | 'RESEAU' | 'AUTRE';

const PAGE_SIZE_OPTIONS = [10, 20, 40];

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium' }).format(d);
}

function PrioBadge({ priorite }: { priorite: string }) {
  return (
    <span className={`prio-badge prio-${priorite}`}>
      <span className="badge-dot" aria-hidden="true" />
      {priorite}
    </span>
  );
}

function StatusBadge({ statut }: { statut: string }) {
  const labels: Record<string, string> = {
    RESOLU: 'Résolu', ESCALADE: 'Escaladé', EN_COURS: 'En cours', EN_ATTENTE: 'En attente',
  };
  return <span className={`reclam-status status-${statut}`}>{labels[statut] ?? statut}</span>;
}

export default function BackofficeReclamationHistoryPage() {
  const { session } = useSessionStore();
  const [items, setItems]       = useState<ReclamationItem[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [search, setSearch]           = useState('');
  const [statutFilter, setStatut]     = useState<StatutFilter>('all');
  const [typeFilter, setType]         = useState<TypeFilter>('all');
  const [pageIndex, setPageIndex]     = useState(0);
  const [pageSize, setPageSize]       = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [resolved, escalated] = await Promise.all([
        getReclamations({ statut: 'RESOLU' }),
        getReclamations({ statut: 'ESCALADE' }),
      ]);
      const all = [...resolved, ...escalated]
        .filter((item) => item.backOfficeUtilisateurId === session?.utilisateurId)
        .sort((a, b) => b.idReclamation - a.idReclamation);
      setItems(all);
    } catch {
      setErrorMsg('Impossible de charger l\'historique des réclamations.');
    } finally {
      setLoading(false);
    }
  }, [session?.utilisateurId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchStatut = statutFilter === 'all' || item.statut === statutFilter;
      const matchType   = typeFilter === 'all' || item.typeProbleme === typeFilter;
      const matchSearch = !q || [
        item.description, item.typeProbleme, item.tpeModele,
        item.tpeNumeroSerie, item.tpeReference, String(item.idReclamation),
      ].join(' ').toLowerCase().includes(q);
      return matchStatut && matchType && matchSearch;
    });
  }, [items, search, statutFilter, typeFilter]);

  useEffect(() => {
    setPageIndex(0);
  }, [search, statutFilter, typeFilter]);

  const totalPages = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const pagedItems = useMemo(() => {
    const start = safePageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePageIndex, pageSize]);
  const canGoToPreviousPage = safePageIndex > 0;
  const canGoToNextPage = safePageIndex < totalPages - 1;

  const resolvedCount  = items.filter((i) => i.statut === 'RESOLU').length;
  const escalatedCount = items.filter((i) => i.statut === 'ESCALADE').length;

  return (
    <div className="reclam-page">
      {/* ── Stats ── */}
      <section className="reclam-stat-grid">
        <article className="reclam-stat">
          <span>Total traités</span>
          <strong>{items.length}</strong>
          <small>Réclamations clôturées</small>
        </article>
        <article className="reclam-stat resolu">
          <span>Résolus</span>
          <strong>{resolvedCount}</strong>
          <small>Traités par le back office</small>
        </article>
        <article className="reclam-stat critique">
          <span>Escaladés</span>
          <strong>{escalatedCount}</strong>
          <small>Transmis niveau supérieur</small>
        </article>
        <article className="reclam-stat moyen">
          <span>Transactions</span>
          <strong>{items.filter((i) => i.typeProbleme === 'TRANSACTION').length}</strong>
          <small>Incidents de paiement</small>
        </article>
      </section>

      {/* ── Filters ── */}
      <section className="reclam-filters">
        <label>
          Recherche
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Description, TPE, réf..."
          />
        </label>
        <label>
          Statut final
          <select value={statutFilter} onChange={(e) => setStatut(e.target.value as StatutFilter)}>
            <option value="all">Tous</option>
            <option value="RESOLU">Résolu</option>
            <option value="ESCALADE">Escaladé</option>
          </select>
        </label>
        <label>
          Type
          <select value={typeFilter} onChange={(e) => setType(e.target.value as TypeFilter)}>
            <option value="all">Tous</option>
            <option value="CONNECTIVITE">Connectivité</option>
            <option value="TRANSACTION">Transaction</option>
            <option value="MATERIEL">Matériel</option>
            <option value="LOGICIEL">Logiciel</option>
            <option value="RESEAU">Réseau</option>
            <option value="AUTRE">Autre</option>
          </select>
        </label>
        <button className="btn-secondary" type="button" onClick={load}>
          Actualiser
        </button>
      </section>

      {errorMsg && <div className="page-alert error">{errorMsg}</div>}

      {/* ── Table ── */}
      <section className="reclam-table-card">
        <div className="reclam-table-head">
          <h3>Mon historique de réclamations traitées</h3>
          <span>{filtered.length} réclamation{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoading && (
          <div className="reclam-loading">
            <span className="page-loading-spinner" />
            Chargement de l'historique...
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="reclam-empty">
            Aucune réclamation traitée ne correspond aux filtres.
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="reclam-table-wrap">
            <table className="reclam-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Priorité</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>TPE</th>
                  <th>Statut</th>
                  <th>Traité par (ID BO)</th>
                  <th>Date création</th>
                  <th>Date résolution</th>
                  <th>Durée de traitement</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((item) => (
                  <tr key={item.idReclamation}>
                    <td data-label="#"><strong>#{item.idReclamation}</strong></td>
                    <td data-label="Priorité"><PrioBadge priorite={item.priorite} /></td>
                    <td data-label="Type"><span className="type-badge">{item.typeProbleme}</span></td>
                    <td data-label="Description">
                      <strong>{item.description.slice(0, 60)}{item.description.length > 60 ? '…' : ''}</strong>
                      {item.referenceChat && <span>Réf: {item.referenceChat}</span>}
                    </td>
                    <td data-label="TPE">
                      {item.tpeModele ? (
                        <>
                          <strong>{item.tpeModele}</strong>
                          <span>{item.tpeNumeroSerie ?? '-'}</span>
                        </>
                      ) : item.tpeReference ? (
                        <span>{item.tpeReference}</span>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td data-label="Statut"><StatusBadge statut={item.statut} /></td>
                    <td data-label="Traité par">
                      {item.backOfficeId ? (
                        <>
                          <strong>BO #{item.backOfficeId}</strong>
                          {item.backOfficeTraitant && <span>{item.backOfficeTraitant}</span>}
                        </>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td data-label="Date création">{formatDate(item.dateCreation)}</td>
                    <td data-label="Date résolution">{formatDate(item.dateResolution)}</td>
                    <td data-label="Durée">
                      {item.dureeTraitementJours !== null ? (
                        <strong>{item.dureeTraitementJours} jour{item.dureeTraitementJours > 1 ? 's' : ''}</strong>
                      ) : (
                        <span>-</span>
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
