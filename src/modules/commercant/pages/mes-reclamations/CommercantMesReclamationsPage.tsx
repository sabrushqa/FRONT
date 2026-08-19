import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MerchantReclamationItem,
  fetchMyReclamationPdfBlob,
  getMyReclamations,
} from '../../services/commercantApi';
import { openBlobInNewTab, triggerBlobDownload } from '../../../../core/browserDownload';
import '../../../../styles/page.shared.scss';
import '../../../../styles/reclamations-shared.scss';

// "Non traitées" (en cours de résolution) vs "historique" (clôturées) —
// demande explicite : le commerçant doit voir l'avancement de ses
// réclamations en cours ET son historique, avec possibilité d'imprimer.
type SectionFilter = 'ouvertes' | 'historique' | 'toutes';

const TYPE_LABELS: Record<string, string> = {
  CONNECTIVITE: 'Connectivité',
  TRANSACTION: 'Transaction',
  MATERIEL: 'Matériel',
  LOGICIEL: 'Logiciel',
  RESEAU: 'Réseau',
  AUTRE: 'Autre',
};

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
    EN_ATTENTE: 'En attente', EN_COURS: 'En cours', RESOLU: 'Résolu', ESCALADE: 'Escaladé',
  };
  return <span className={`reclam-status status-${statut}`}>{labels[statut] ?? statut}</span>;
}

const OPEN_STATUSES = new Set(['EN_ATTENTE', 'EN_COURS']);
const CLOSED_STATUSES = new Set(['RESOLU', 'ESCALADE']);

export default function CommercantMesReclamationsPage() {
  const [items, setItems] = useState<MerchantReclamationItem[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [section, setSection] = useState<SectionFilter>('ouvertes');

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await getMyReclamations();
      setItems(data.sort((a, b) => b.idReclamation - a.idReclamation));
    } catch {
      setErrorMsg('Impossible de charger vos réclamations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleViewPdf(id: number) {
    // Ouvrir l'onglet AVANT l'await (fetch async) : sinon les navigateurs
    // bloquent l'ouverture comme un popup non sollicité.
    const viewTab = window.open('', '_blank');
    try {
      const blob = await fetchMyReclamationPdfBlob(id);
      await openBlobInNewTab(blob, viewTab);
    } catch {
      viewTab?.close();
      setErrorMsg(`Impossible d'ouvrir la fiche PDF de la réclamation #${id}.`);
    }
  }

  async function handleDownloadPdf(id: number, referenceChat: string | null) {
    try {
      const blob = await fetchMyReclamationPdfBlob(id);
      await triggerBlobDownload(blob, `reclamation-${referenceChat || id}.pdf`);
    } catch {
      setErrorMsg(`Téléchargement impossible pour la réclamation #${id}.`);
    }
  }

  const openCount = useMemo(() => items.filter((i) => OPEN_STATUSES.has(i.statut)).length, [items]);
  const closedCount = useMemo(() => items.filter((i) => CLOSED_STATUSES.has(i.statut)).length, [items]);

  const filtered = useMemo(() => {
    if (section === 'ouvertes') return items.filter((i) => OPEN_STATUSES.has(i.statut));
    if (section === 'historique') return items.filter((i) => CLOSED_STATUSES.has(i.statut));
    return items;
  }, [items, section]);

  return (
    <div className="reclam-page">
      {/* ── Stats ── */}
      <section className="reclam-stat-grid">
        <article className="reclam-stat">
          <span>Total</span>
          <strong>{items.length}</strong>
          <small>Toutes réclamations envoyées</small>
        </article>
        <article className="reclam-stat haute">
          <span>Non traitées</span>
          <strong>{openCount}</strong>
          <small>En attente / en cours de traitement</small>
        </article>
        <article className="reclam-stat resolu">
          <span>Historique</span>
          <strong>{closedCount}</strong>
          <small>Résolues ou escaladées</small>
        </article>
      </section>

      {/* ── Filtres ── */}
      <section className="reclam-filters">
        <label>
          Affichage{' '}
          <select value={section} onChange={(e) => setSection(e.target.value as SectionFilter)}>
            <option value="ouvertes">Non traitées ({openCount})</option>
            <option value="historique">Historique ({closedCount})</option>
            <option value="toutes">Toutes ({items.length})</option>
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
          <h3>Mes réclamations</h3>
          <span>{filtered.length} réclamation{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoading && (
          <div className="reclam-loading">
            <span className="page-loading-spinner" />{' '}
            Chargement...
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="reclam-empty">
            {section === 'ouvertes'
              ? "Aucune réclamation en cours — tout est traité !"
              : "Aucune réclamation ne correspond à ce filtre."}
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
                  <th>Statut</th>
                  <th>Date création</th>
                  <th>Date résolution</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.idReclamation}>
                    <td data-label="#"><strong>#{item.idReclamation}</strong></td>
                    <td data-label="Priorité"><PrioBadge priorite={item.priorite} /></td>
                    <td data-label="Type">
                      <span className="type-badge">{TYPE_LABELS[item.typeProbleme] ?? item.typeProbleme}</span>
                    </td>
                    <td data-label="Description">
                      {item.resumeCourt && <div className="resume-court">{item.resumeCourt}</div>}
                      <strong>{item.description.slice(0, 70)}{item.description.length > 70 ? '…' : ''}</strong>
                    </td>
                    <td data-label="Statut"><StatusBadge statut={item.statut} /></td>
                    <td data-label="Date création">{formatDate(item.dateCreation)}</td>
                    <td data-label="Date résolution">{formatDate(item.dateResolution)}</td>
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
                          className="btn-secondary"
                          type="button"
                          onClick={() => handleDownloadPdf(item.idReclamation, item.referenceChat)}
                          title="Télécharger la fiche PDF"
                        >
                          Télécharger
                        </button>
                      </div>
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
