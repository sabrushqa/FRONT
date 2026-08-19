import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReclamationItem,
  ReclamationStats,
  fetchReclamationPdfBlob,
  getReclamations,
  getReclamationStats,
  updateReclamationStatut,
} from '../../services/reclamationsApi';
import { openBlobInNewTab } from '../../../../core/browserDownload';
import '../../../../styles/page.shared.scss';
import '../../../../styles/reclamations-shared.scss';

type PrioriteFilter = 'all' | 'CRITIQUE' | 'HAUTE' | 'MOYENNE' | 'BASSE';
type TypeFilter = 'all' | 'CONNECTIVITE' | 'TRANSACTION' | 'MATERIEL' | 'LOGICIEL' | 'RESEAU' | 'AUTRE';

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
    EN_COURS: 'En cours', EN_ATTENTE: 'En attente', RESOLU: 'Résolu', ESCALADE: 'Escaladé',
  };
  return <span className={`reclam-status status-${statut}`}>{labels[statut] ?? statut}</span>;
}

export default function BackofficeReclamationsPage() {
  const [items, setItems]       = useState<ReclamationItem[]>([]);
  const [stats, setStats]       = useState<ReclamationStats | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [search, setSearch]         = useState('');
  const [prioFilter, setPrio]       = useState<PrioriteFilter>('all');
  const [typeFilter, setType]       = useState<TypeFilter>('all');
  const [pageIndex, setPageIndex]   = useState(0);
  const [pageSize, setPageSize]     = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [data, statsData] = await Promise.all([
        getReclamations({ statut: 'EN_COURS' }),
        getReclamationStats(),
      ]);
      // Also fetch EN_ATTENTE and merge
      const waiting = await getReclamations({ statut: 'EN_ATTENTE' }).catch(() => []);
      const allActive = [...data, ...waiting].sort((a, b) => b.idReclamation - a.idReclamation);
      setItems(allActive);
      setStats(statsData);
    } catch {
      setErrorMsg('Impossible de charger les réclamations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUpdateStatut(id: number, statut: string) {
    setActionId(id);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await updateReclamationStatut(id, statut);
      setSuccessMsg(`Réclamation #${id} marquée comme ${statut === 'RESOLU' ? 'résolue' : 'escaladée'}.`);
      await load();
    } catch {
      setErrorMsg(`Impossible de mettre à jour la réclamation #${id}.`);
    } finally {
      setActionId(null);
    }
  }

  async function handleViewPdf(id: number) {
    // Ouvrir l'onglet AVANT l'await (fetch async) : sinon les navigateurs
    // bloquent l'ouverture comme un popup non sollicité — meme pattern que
    // CommercantRequestStatusPage.tsx::handleViewContract.
    const viewTab = window.open('', '_blank');
    try {
      const blob = await fetchReclamationPdfBlob(id);
      await openBlobInNewTab(blob, viewTab);
    } catch {
      viewTab?.close();
      setErrorMsg(`Impossible d'ouvrir la fiche PDF de la réclamation #${id}.`);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchPrio = prioFilter === 'all' || item.priorite === prioFilter;
      const matchType = typeFilter === 'all' || item.typeProbleme === typeFilter;
      const matchSearch = !q || [
        item.description, item.typeProbleme, item.tpeModele,
        item.tpeNumeroSerie, item.tpeReference, String(item.idReclamation),
      ].join(' ').toLowerCase().includes(q);
      return matchPrio && matchType && matchSearch;
    });
  }, [items, search, prioFilter, typeFilter]);

  useEffect(() => {
    setPageIndex(0);
  }, [search, prioFilter, typeFilter]);

  const totalPages = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const pagedItems = useMemo(() => {
    const start = safePageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePageIndex, pageSize]);
  const canGoToPreviousPage = safePageIndex > 0;
  const canGoToNextPage = safePageIndex < totalPages - 1;

  return (
    <div className="reclam-page">
      {/* ── Stats ── */}
      <section className="reclam-stat-grid">
        <article className="reclam-stat">
          <span>Total actif</span>
          <strong>{stats?.EN_COURS ?? 0}</strong>
          <small>Réclamations en cours</small>
        </article>
        <article className="reclam-stat critique">
          <span>Critique</span>
          <strong>{stats?.CRITIQUE ?? 0}</strong>
          <small>Priorité maximale</small>
        </article>
        <article className="reclam-stat haute">
          <span>Haute</span>
          <strong>{stats?.HAUTE ?? 0}</strong>
          <small>Traitement urgent</small>
        </article>
        <article className="reclam-stat moyen">
          <span>Connectivité</span>
          <strong>{stats?.CONNECTIVITE ?? 0}</strong>
          <small>Problèmes réseau / liaison</small>
        </article>
      </section>

      {/* ── Filters ── */}
      <section className="reclam-filters">
        <label>
          Recherche{' '}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Description, TPE, réf..."
          />
        </label>
        <label>
          Priorité{' '}
          <select value={prioFilter} onChange={(e) => setPrio(e.target.value as PrioriteFilter)}>
            <option value="all">Toutes</option>
            <option value="CRITIQUE">Critique</option>
            <option value="HAUTE">Haute</option>
            <option value="MOYENNE">Moyenne</option>
            <option value="BASSE">Basse</option>
          </select>
        </label>
        <label>
          Type{' '}
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

      {/* ── Alerts ── */}
      {errorMsg   && <div className="page-alert error">{errorMsg}</div>}
      {successMsg && <div className="page-alert success">{successMsg}</div>}

      {/* ── Table ── */}
      <section className="reclam-table-card">
        <div className="reclam-table-head">
          <h3>Réclamations actives</h3>
          <span>{filtered.length} réclamation{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoading && (
          <div className="reclam-loading">
            <span className="page-loading-spinner" />{' '}
            Chargement des réclamations...
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="reclam-empty">Aucune réclamation active ne correspond aux filtres.</div>
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
                  <th>Commerçant</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((item) => (
                  <tr key={item.idReclamation}>
                    <td data-label="#"><strong>#{item.idReclamation}</strong></td>
                    <td data-label="Priorité"><PrioBadge priorite={item.priorite} /></td>
                    <td data-label="Type"><span className="type-badge">{item.typeProbleme}</span></td>
                    <td data-label="Description">
                      {/* Label court genere par le chatbot (agent/graph/nodes.py::
                          _build_short_problem_label) — tri visuel rapide avant de
                          lire la description complete en dessous. */}
                      {item.resumeCourt && <div className="resume-court">{item.resumeCourt}</div>}
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
                        // Repli : TPE Oracle sans ligne locale correspondante
                        // (tpeId/tpeModele non résolus) — voir Item 1.
                        <span>{item.tpeReference}</span>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td data-label="Commerçant">
                      {item.commercantNom ?? <span>-</span>}
                    </td>
                    <td data-label="Statut"><StatusBadge statut={item.statut} /></td>
                    <td data-label="Date">{formatDate(item.dateCreation)}</td>
                    <td data-label="Actions">
                      <div className="reclam-actions">
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() => handleViewPdf(item.idReclamation)}
                          title="Ouvrir la fiche PDF (aperçu + impression)"
                        >
                          Voir / Imprimer
                        </button>
                        <button
                          className="btn-resolve"
                          type="button"
                          disabled={actionId === item.idReclamation}
                          onClick={() => handleUpdateStatut(item.idReclamation, 'RESOLU')}
                        >
                          Résoudre
                        </button>
                        <button
                          className="btn-escalate"
                          type="button"
                          disabled={actionId === item.idReclamation}
                          onClick={() => handleUpdateStatut(item.idReclamation, 'ESCALADE')}
                        >
                          Escalader
                        </button>
                      </div>
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
