import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReclamationItem,
  getReclamations,
} from '../../../backoffice/services/reclamationsApi';
import { getOverview } from '../../services/supervisorApi';
import { AFFILIATION_TYPE_VALUES, formatEnumLabel } from '../../services/supervisorUiUtils';
import {
  MOROCCO_REGIONS,
  UNKNOWN_REGION_KEY,
  UNKNOWN_REGION_LABEL,
  resolveRegionKey
} from '../../../../core/moroccoGeoData';
import '../../../../styles/page.shared.scss';
import '../../../../styles/reclamations-shared.scss';

type StatutFilter = 'all' | 'EN_ATTENTE' | 'EN_COURS' | 'RESOLU' | 'ESCALADE';
type TypeFilter = 'all' | 'CONNECTIVITE' | 'TRANSACTION' | 'MATERIEL' | 'LOGICIEL' | 'RESEAU' | 'AUTRE';

const PAGE_SIZE_OPTIONS = [10, 20, 40];
const TRAITE_STATUTS = new Set(['RESOLU', 'ESCALADE']);

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium' }).format(d);
}

function isTraite(item: ReclamationItem): boolean {
  return TRAITE_STATUTS.has(item.statut);
}

function PrioBadge({ priorite }: { priorite: string }) {
  const icons: Record<string, string> = {
    CRITIQUE: '🔴', HAUTE: '🟠', MOYENNE: '🟡', BASSE: '🟢',
  };
  return (
    <span className={`prio-badge prio-${priorite}`}>
      {icons[priorite] ?? '⚪'} {priorite}
    </span>
  );
}

function StatusBadge({ statut }: { statut: string }) {
  const labels: Record<string, string> = {
    EN_COURS: 'En cours', EN_ATTENTE: 'En attente', RESOLU: 'Résolu', ESCALADE: 'Escaladé',
  };
  return <span className={`reclam-status status-${statut}`}>{labels[statut] ?? statut}</span>;
}

function buildOptions(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => !!value))).sort((a, b) =>
    a.localeCompare(b, 'fr')
  );
}

export default function SupervisorReclamationsPage() {
  const [items, setItems] = useState<ReclamationItem[]>([]);
  const [boaDirectory, setBoaDirectory] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState<StatutFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [affiliationTypeFilter, setAffiliationTypeFilter] = useState('all');
  const [boaFilter, setBoaFilter] = useState('all');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const all = await getReclamations();
      setItems(all.sort((a, b) => b.idReclamation - a.idReclamation));
    } catch {
      setErrorMessage('Impossible de charger les réclamations.');
    } finally {
      setIsLoading(false);
    }

    // Chargee independamment : les filtres Region/BOA doivent toujours
    // proposer l'ensemble des back-offices existants, meme s'ils n'ont
    // traite aucune reclamation pour l'instant — un echec ici ne doit donc
    // pas empecher l'affichage des reclamations elles-memes.
    try {
      const overview = await getOverview();
      const names = Array.from(
        new Set(
          overview.backOffices
            .map((bo) => `${bo.prenom} ${bo.nom}`.trim())
            .filter((name) => name.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b, 'fr'));
      setBoaDirectory(names);
    } catch {
      setBoaDirectory([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const regionOptions = useMemo(
    () => [...MOROCCO_REGIONS.map((region) => ({ key: region.key, label: region.label })),
      { key: UNKNOWN_REGION_KEY, label: UNKNOWN_REGION_LABEL }],
    []
  );
  // Toujours toutes les valeurs de l'enum, meme si aucune reclamation
  // chargee n'en contient une (menu jamais vide).
  const affiliationTypeOptions = AFFILIATION_TYPE_VALUES;
  // Union du referentiel back-office complet et des noms deja vus sur des
  // reclamations (au cas ou un BOA aurait ete desactive entre-temps).
  const boaOptions = useMemo(
    () =>
      Array.from(
        new Set([...boaDirectory, ...buildOptions(items.filter(isTraite).map((item) => item.backOfficeTraitant))])
      ).sort((a, b) => a.localeCompare(b, 'fr')),
    [boaDirectory, items]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchStatut = statutFilter === 'all' || item.statut === statutFilter;
      const matchType = typeFilter === 'all' || item.typeProbleme === typeFilter;
      const matchRegion = regionFilter === 'all' || resolveRegionKey(item.region) === regionFilter;
      const matchAffiliationType = affiliationTypeFilter === 'all' || item.typeAffiliation === affiliationTypeFilter;
      const matchBoa = boaFilter === 'all' || (isTraite(item) && item.backOfficeTraitant === boaFilter);
      const matchSearch = !q || [
        item.description, item.typeProbleme, item.tpeModele,
        item.tpeNumeroSerie, item.tpeReference, item.commercantNom, String(item.idReclamation),
      ].join(' ').toLowerCase().includes(q);
      return matchStatut && matchType && matchRegion && matchAffiliationType && matchBoa && matchSearch;
    });
  }, [items, search, statutFilter, typeFilter, regionFilter, affiliationTypeFilter, boaFilter]);

  useEffect(() => {
    setPageIndex(0);
  }, [search, statutFilter, typeFilter, regionFilter, affiliationTypeFilter, boaFilter]);

  const totalPages = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const pagedItems = useMemo(() => {
    const start = safePageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePageIndex, pageSize]);
  const canGoToPreviousPage = safePageIndex > 0;
  const canGoToNextPage = safePageIndex < totalPages - 1;

  // Distinct des regions parmi les resultats filtres (metrique), a ne pas
  // confondre avec `regionOptions` qui liste TOUJOURS les 12 regions plus
  // "non renseignee" dans le menu de filtre.
  const regionsRepresentedCount = useMemo(
    () => new Set(filtered.map((item) => resolveRegionKey(item.region))).size,
    [filtered]
  );

  const traiteCount = filtered.filter(isTraite).length;
  const nonTraiteCount = filtered.length - traiteCount;

  function clearFilters() {
    setSearch('');
    setStatutFilter('all');
    setTypeFilter('all');
    setRegionFilter('all');
    setAffiliationTypeFilter('all');
    setBoaFilter('all');
  }

  return (
    <div className="reclam-page">
      {/* ── Stats ── */}
      <section className="reclam-stat-grid">
        <article className="reclam-stat">
          <span>Total</span>
          <strong>{filtered.length}</strong>
          <small>Réclamations correspondant aux filtres</small>
        </article>
        <article className="reclam-stat resolu">
          <span>Traitées</span>
          <strong>{traiteCount}</strong>
          <small>Résolues ou escaladées</small>
        </article>
        <article className="reclam-stat critique">
          <span>Non traitées</span>
          <strong>{nonTraiteCount}</strong>
          <small>En cours ou en attente</small>
        </article>
        <article className="reclam-stat moyen">
          <span>Régions</span>
          <strong>{regionsRepresentedCount}</strong>
          <small>Régions représentées</small>
        </article>
      </section>

      {/* ── Filters ── */}
      <section className="reclam-filters">
        <label>
          Recherche
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Description, TPE, commerçant, réf..."
          />
        </label>
        <label>
          Statut
          <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value as StatutFilter)}>
            <option value="all">Tous</option>
            <option value="EN_ATTENTE">En attente</option>
            <option value="EN_COURS">En cours</option>
            <option value="RESOLU">Résolu</option>
            <option value="ESCALADE">Escaladé</option>
          </select>
        </label>
        <label>
          Type de problème
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
            <option value="all">Tous</option>
            <option value="CONNECTIVITE">Connectivité</option>
            <option value="TRANSACTION">Transaction</option>
            <option value="MATERIEL">Matériel</option>
            <option value="LOGICIEL">Logiciel</option>
            <option value="RESEAU">Réseau</option>
            <option value="AUTRE">Autre</option>
          </select>
        </label>
        <label>
          Région
          <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
            <option value="all">Toutes</option>
            {regionOptions.map((region) => (
              <option key={region.key} value={region.key}>{region.label}</option>
            ))}
          </select>
        </label>
        <label>
          Type d'affiliation
          <select value={affiliationTypeFilter} onChange={(e) => setAffiliationTypeFilter(e.target.value)}>
            <option value="all">Tous</option>
            {affiliationTypeOptions.map((type) => (
              <option key={type} value={type}>{formatEnumLabel(type)}</option>
            ))}
          </select>
        </label>
        <label>
          BOA (traitée par)
          <select value={boaFilter} onChange={(e) => setBoaFilter(e.target.value)}>
            <option value="all">Tous</option>
            {boaOptions.map((boa) => (
              <option key={boa} value={boa}>{boa}</option>
            ))}
          </select>
        </label>
        <button className="btn-secondary" type="button" onClick={clearFilters}>
          Réinitialiser
        </button>
        <button className="btn-secondary" type="button" onClick={load}>
          Actualiser
        </button>
      </section>

      {errorMessage && <div className="page-alert error">{errorMessage}</div>}

      {/* ── Table ── */}
      <section className="reclam-table-card">
        <div className="reclam-table-head">
          <h3>Réclamations TPE</h3>
          <span>{filtered.length} réclamation{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoading && (
          <div className="reclam-loading">
            <span className="page-loading-spinner" />
            Chargement des réclamations...
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="reclam-empty">Aucune réclamation ne correspond aux filtres.</div>
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
                  <th>Commerçant</th>
                  <th>Région</th>
                  <th>Affiliation</th>
                  <th>Statut</th>
                  <th>BOA</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((item) => (
                  <tr key={item.idReclamation}>
                    <td><strong>#{item.idReclamation}</strong></td>
                    <td><PrioBadge priorite={item.priorite} /></td>
                    <td><span className="type-badge">{item.typeProbleme}</span></td>
                    <td>
                      <strong>{item.description.slice(0, 60)}{item.description.length > 60 ? '…' : ''}</strong>
                      {item.referenceChat && <span>Réf: {item.referenceChat}</span>}
                    </td>
                    <td>{item.commercantNom ?? <span>-</span>}</td>
                    <td>{item.region ?? <span>-</span>}</td>
                    <td>{item.typeAffiliation ? formatEnumLabel(item.typeAffiliation) : <span>-</span>}</td>
                    <td><StatusBadge statut={item.statut} /></td>
                    <td>{isTraite(item) ? (item.backOfficeTraitant ?? '-') : <span>-</span>}</td>
                    <td>{formatDate(item.dateCreation)}</td>
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
