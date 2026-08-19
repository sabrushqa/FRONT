import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getOverview,
  getCommercantTransactions,
  downloadCommercantTicket,
  CommercantDirectoryItem,
  SupervisorTransactionItem
} from '../../services/supervisorApi';
import { formatEnumLabel } from '../../services/supervisorUiUtils';
import { triggerBlobDownload } from '../../../../core/browserDownload';
import { downloadExcel } from '../../../../core/excelExport';
import { stripLeadingAndTrailingDashes } from '../../../../core/url';
import '../../../../styles/page.shared.scss';
import '../../../../styles/supervisor-transactions.scss';

const PAGE_SIZE_OPTIONS = [10, 20, 40];

type Periode = 'all' | '7' | '30' | '90';

const STATUS_META: Record<string, { tone: string; label: string; approved?: boolean }> = {
  APPROVED:   { tone: 'stx-tone-active',   label: 'Approuvée', approved: true },
  ACCEPTE:    { tone: 'stx-tone-active',   label: 'Approuvée', approved: true },
  DECLINED:   { tone: 'stx-tone-danger',   label: 'Refusée' },
  REFUSE:     { tone: 'stx-tone-danger',   label: 'Refusée' },
  REVERSED:   { tone: 'stx-tone-danger',   label: 'Annulée' },
  TIMEOUT:    { tone: 'stx-tone-progress', label: 'Expirée' },
  EXPIRED:    { tone: 'stx-tone-progress', label: 'Expirée' },
  PENDING:    { tone: 'stx-tone-progress', label: 'En attente' }
};

function statusMeta(status: string) {
  return STATUS_META[(status ?? '').toUpperCase()] ?? { tone: 'stx-tone-pending', label: status || '—' };
}

const CANAL_META: Record<string, { label: string; tone: string }> = {
  TPE:       { label: 'Encaissement TPE', tone: 'stx-tone-progress' },
  ECOMMERCE: { label: 'E-commerce',       tone: 'stx-tone-active' }
};

function canalMeta(canal: string) {
  return CANAL_META[(canal ?? '').toUpperCase()] ?? { label: canal || '—', tone: 'stx-tone-pending' };
}

// Comparaison inclusive sur la date seule (YYYY-MM-DD, format natif des
// <input type="date">) — meme logique que CommercantTransactionsPage.tsx.
function isWithinDateRange(dateTransaction: string, from: string, to: string): boolean {
  if (!dateTransaction) return !from && !to;
  const day = dateTransaction.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function isWithinPeriod(dateTransaction: string, periode: Periode): boolean {
  if (periode === 'all' || !dateTransaction) return true;
  const parsed = new Date(dateTransaction);
  if (Number.isNaN(parsed.getTime())) return true;
  const days = Number(periode);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return parsed >= cutoff;
}

// Options triees par frequence decroissante puis alphabetique — les
// terminaux/PDV les plus utilises remontent en haut du menu, cohérent avec
// "affichage dynamique" (les options ne sont jamais figées, elles suivent
// exactement ce que ce commerçant a réellement comme historique).
function buildFrequencyOptions(values: Array<string | null | undefined>): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
    .map(([value]) => value);
}

export default function SupervisorTransactionsPage() {
  const [commercants, setCommercants] = useState<CommercantDirectoryItem[]>([]);
  const [selectedCommercantId, setSelectedCommercantId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<SupervisorTransactionItem[]>([]);
  const [isLoadingCommercants, setIsLoadingCommercants] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [canalFilter, setCanalFilter] = useState('');
  const [tpeFilter, setTpeFilter] = useState('');
  const [pdvFilter, setPdvFilter] = useState('');
  const [periode, setPeriode] = useState<Periode>('30');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const loadCommercants = useCallback(async () => {
    setIsLoadingCommercants(true);
    try {
      const overview = await getOverview();
      const sorted = [...overview.commercants].sort((a, b) =>
        (a.nom || '').localeCompare(b.nom || '', 'fr')
      );
      setCommercants(sorted);
      setSelectedCommercantId((current) => current ?? sorted[0]?.id ?? null);
    } catch {
      setErrorMessage('Impossible de charger la liste des commerçants.');
    } finally {
      setIsLoadingCommercants(false);
    }
  }, []);

  useEffect(() => {
    void loadCommercants();
  }, [loadCommercants]);

  const loadTransactions = useCallback(async (commercantId: number) => {
    setIsLoadingTransactions(true);
    setErrorMessage('');
    try {
      const response = await getCommercantTransactions(commercantId);
      setTransactions(response.transactions);
    } catch {
      setTransactions([]);
      setErrorMessage('Impossible de charger les transactions de ce commerçant.');
    } finally {
      setIsLoadingTransactions(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCommercantId !== null) {
      void loadTransactions(selectedCommercantId);
    }
  }, [selectedCommercantId, loadTransactions]);

  // Les filtres TPE/PDV/statut dependent des donnees du commercant selectionne :
  // on les remet a zero a chaque changement de commercant pour ne pas garder un
  // filtre qui n'a plus de sens (ex: un TPE d'un autre commerçant).
  useEffect(() => {
    setSearch('');
    setStatusFilter('');
    setCanalFilter('');
    setTpeFilter('');
    setPdvFilter('');
    setDateFrom('');
    setDateTo('');
    setPageIndex(0);
  }, [selectedCommercantId]);

  useEffect(() => {
    setPageIndex(0);
  }, [search, statusFilter, canalFilter, tpeFilter, pdvFilter, periode, dateFrom, dateTo]);

  async function handleDownloadTicket(transactionId: string) {
    if (selectedCommercantId === null) return;
    setDownloadError('');
    setDownloadingId(transactionId);
    try {
      const blob = await downloadCommercantTicket(selectedCommercantId, transactionId);
      await triggerBlobDownload(blob, `ticket-${transactionId}.pdf`);
    } catch {
      setDownloadError('Téléchargement du ticket impossible.');
    } finally {
      setDownloadingId(null);
    }
  }

  const selectedCommercant = commercants.find((c) => c.id === selectedCommercantId) ?? null;
  // E-commerce pur : pas de TPE/PDV physique, le filtre n'a pas de sens.
  const hasPhysicalChannel = (selectedCommercant?.typeAffiliation ?? '') !== 'E_COMMERCE';

  // Transactions déjà triées par date décroissante côté API — le filtre de
  // période/statut/recherche s'applique par-dessus sans casser cet ordre.
  const filtered = useMemo(
    () =>
      transactions.filter((t) => {
        const matchSearch =
          !search || `${t.id} ${t.pdv} ${t.tpe} ${t.typePaiement}`.toLowerCase().includes(search.toLowerCase());
        const matchStatus = !statusFilter || statusMeta(t.statut).label === statusFilter;
        const matchCanal = !canalFilter || (t.canal ?? '').toUpperCase() === canalFilter;
        const matchTpe = !tpeFilter || t.tpe === tpeFilter;
        const matchPdv = !pdvFilter || t.pdv === pdvFilter;
        // Une plage de dates precise (Du/Au) prend le pas sur le preset
        // Periode des qu'elle est renseignee — evite de combiner deux
        // filtres de date contradictoires.
        const matchDate = dateFrom || dateTo
          ? isWithinDateRange(t.dateTransaction, dateFrom, dateTo)
          : isWithinPeriod(t.dateTransaction, periode);
        return matchSearch && matchStatus && matchCanal && matchTpe && matchPdv && matchDate;
      }),
    [transactions, search, statusFilter, canalFilter, tpeFilter, pdvFilter, periode, dateFrom, dateTo]
  );

  const totalPages = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const paginated = useMemo(
    () => filtered.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize),
    [filtered, safePageIndex, pageSize]
  );

  const totalAmount = filtered.reduce((sum, t) => sum + (t.montant ?? 0), 0);
  const approvedCount = filtered.filter((t) => statusMeta(t.statut).approved).length;
  const approvalRate = filtered.length > 0 ? Math.round((approvedCount / filtered.length) * 100) : 0;
  // Deduplique par libellé affiché, pas par code brut : TIMEOUT et EXPIRED
  // partagent le même libellé "Expirée" — sans ça le menu affichait deux
  // fois la même option.
  const statuses = [...new Set(
    transactions.map((t) => (t.statut ?? '').toUpperCase()).filter(Boolean).map((s) => statusMeta(s).label)
  )];
  // Options dynamiques : dérivées du seul historique déjà chargé pour ce
  // commerçant, jamais d'une liste fixe — un nouveau TPE affecté apparaît
  // automatiquement dès sa première transaction.
  const canalOptions = [...new Set(transactions.map((t) => (t.canal ?? '').toUpperCase()).filter(Boolean))];
  // Un commerçant "TPE + e-commerce" (ENCAISSEMENT_ET_ECOMMERCE) a les deux
  // canaux dans son historique : le filtre Canal n'apparaît que dans ce
  // cas-là — pour un commerçant mono-canal il serait toujours figé sur une
  // seule option, donc inutile.
  const showCanalFilter = canalOptions.length > 1;
  const tpeOptions = useMemo(() => buildFrequencyOptions(transactions.map((t) => t.tpe)), [transactions]);
  const pdvOptions = useMemo(() => buildFrequencyOptions(transactions.map((t) => t.pdv)), [transactions]);

  function clearFilters() {
    setSearch('');
    setStatusFilter('');
    setCanalFilter('');
    setTpeFilter('');
    setPdvFilter('');
    setPeriode('30');
    setDateFrom('');
    setDateTo('');
  }

  async function handleExportExcel() {
    setIsExporting(true);
    setExportError('');
    try {
      const period = dateFrom || dateTo ? `${dateFrom || 'debut'}_a_${dateTo || 'aujourdhui'}` : periode;
      const merchantSlug = stripLeadingAndTrailingDashes(
        (selectedCommercant?.nom || `commercant-${selectedCommercantId ?? ''}`)
          .toLowerCase().replace(/[^a-z0-9]+/g, '-')
      );
      await downloadExcel(
        `transactions-${merchantSlug}-${period}`,
        'Transactions',
        [
          { header: 'ID', key: 'id', value: (t: typeof filtered[number]) => t.id },
          { header: 'Date', key: 'date', value: (t) => t.dateTransaction || '' },
          { header: 'Heure', key: 'heure', value: (t) => t.heureTransaction || '' },
          { header: 'Montant', key: 'montant', value: (t) => t.montant ?? 0 },
          { header: 'Devise', key: 'devise', value: (t) => t.devise || '' },
          { header: 'Type', key: 'type', value: (t) => t.typePaiement || '' },
          { header: 'Canal', key: 'canal', value: (t) => canalMeta(t.canal).label },
          { header: 'Statut', key: 'statut', value: (t) => statusMeta(t.statut).label },
          { header: 'Terminal / Site', key: 'tpe', value: (t) => t.tpe || '' },
          { header: 'PDV', key: 'pdv', value: (t) => t.pdv || '' },
        ],
        filtered
      );
    } catch {
      setExportError('Export Excel impossible.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="stx-page">
      <section className="stx-picker">
        <label>
          Commerçant{' '}
          <select
            value={selectedCommercantId ?? ''}
            onChange={(e) => setSelectedCommercantId(e.target.value ? Number(e.target.value) : null)}
            disabled={isLoadingCommercants || commercants.length === 0}
          >
            {commercants.length === 0 && <option value="">Aucun commerçant</option>}
            {commercants.map((c) => (
              <option key={c.id} value={c.id}>{c.nom || `Commerçant #${c.id}`}</option>
            ))}
          </select>
        </label>

        {selectedCommercant && (
          <div className="stx-merchant-meta">
            <span className="stx-affiliation-badge">
              {formatEnumLabel(selectedCommercant.typeAffiliation) || 'Type non renseigné'}
            </span>
            {selectedCommercant.ville && <span className="stx-merchant-place">{selectedCommercant.ville}</span>}
          </div>
        )}

        <button
          type="button"
          className="btn-secondary"
          onClick={() => selectedCommercantId !== null && loadTransactions(selectedCommercantId)}
          disabled={selectedCommercantId === null || isLoadingTransactions}
        >
          Actualiser
        </button>
      </section>

      {errorMessage && <div className="page-alert error">{errorMessage}</div>}
      {downloadError && <div className="page-alert error">{downloadError}</div>}
      {exportError && <div className="page-alert error">{exportError}</div>}

      <section className="stx-stat-grid">
        <article className="stx-stat" title="Transactions correspondant aux filtres">
          <span>Total</span>
          <strong>{filtered.length}</strong>
        </article>
        <article className="stx-stat active" title="Taux d'approbation">
          <span>Approuvées</span>
          <strong>{approvedCount} · {approvalRate}%</strong>
        </article>
        <article className="stx-stat" title="Cumul des transactions filtrées">
          <span>Montant (MAD)</span>
          <strong>{totalAmount.toLocaleString('fr-FR')}</strong>
        </article>
        <article className="stx-stat" title={hasPhysicalChannel ? 'Terminaux distincts sur la période' : 'Vente en ligne uniquement'}>
          <span>{hasPhysicalChannel ? 'TPE utilisés' : 'Canal'}</span>
          <strong>{hasPhysicalChannel ? new Set(filtered.map((t) => t.tpe).filter(Boolean)).size : 'E-commerce'}</strong>
        </article>
      </section>

      <section className="stx-filters">
        <label>
          Recherche{' '}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ID, PDV, TPE, type…"
          />
        </label>
        <label>
          Statut{' '}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tous</option>
            {statuses.map((label) => <option key={label} value={label}>{label}</option>)}
          </select>
        </label>
        {showCanalFilter && (
          <label>
            Canal{' '}
            <select value={canalFilter} onChange={(e) => setCanalFilter(e.target.value)}>
              <option value="">Tous les canaux</option>
              {canalOptions.map((c) => <option key={c} value={c}>{canalMeta(c).label}</option>)}
            </select>
          </label>
        )}
        {hasPhysicalChannel && (
          <>
            <label>
              TPE{' '}
              <select value={tpeFilter} onChange={(e) => setTpeFilter(e.target.value)}>
                <option value="">Tous les TPE</option>
                {tpeOptions.map((tpe) => <option key={tpe} value={tpe}>{tpe}</option>)}
              </select>
            </label>
            <label>
              Point de vente{' '}
              <select value={pdvFilter} onChange={(e) => setPdvFilter(e.target.value)}>
                <option value="">Tous les PDV</option>
                {pdvOptions.map((pdv) => <option key={pdv} value={pdv}>{pdv}</option>)}
              </select>
            </label>
          </>
        )}
        <label>
          Période{' '}
          <select value={periode} onChange={(e) => setPeriode(e.target.value as Periode)} disabled={!!(dateFrom || dateTo)}>
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option>
            <option value="all">Toute la période</option>
          </select>
        </label>
        <label>
          Du{' '}
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label>
          Au{' '}
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        <button className="btn-secondary" type="button" onClick={clearFilters}>
          Réinitialiser
        </button>
        <button
          type="button"
          className="btn-export-excel"
          disabled={isExporting || filtered.length === 0}
          onClick={handleExportExcel}
          title="Télécharger la période affichée au format Excel"
        >
          {isExporting ? 'Export…' : 'Télécharger Excel'}
        </button>
      </section>

      <section className="stx-table-card">
        <div className="stx-table-head">
          <h3>Transactions {selectedCommercant ? `· ${selectedCommercant.nom}` : ''}</h3>
          <span>
            {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
            {isLoadingTransactions ? ' · chargement…' : ''}
          </span>
        </div>

        {isLoadingTransactions && transactions.length === 0 && (
          <div className="stx-loading">
            <span className="page-loading-spinner" />{' '}
            Chargement des transactions...
          </div>
        )}

        {!isLoadingTransactions && commercants.length === 0 && !isLoadingCommercants && (
          <div className="stx-empty">Aucun commerçant disponible.</div>
        )}

        {!isLoadingTransactions && commercants.length > 0 && filtered.length === 0 && (
          <div className="stx-empty">Aucune transaction ne correspond aux filtres.</div>
        )}

        {filtered.length > 0 && (
          <div className="stx-table-wrap">
            <table className="stx-table">
              <thead>
                <tr>
                  <th>#ID</th><th>Date</th><th>Heure</th><th>Montant</th>
                  <th>Type</th><th>Canal</th><th>Statut</th><th>Terminal / Site</th><th>PDV</th><th>Ticket</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((t) => {
                  const meta = statusMeta(t.statut);
                  const canal = canalMeta(t.canal);
                  return (
                    <tr key={t.id}>
                      <td data-label="ID"><strong>#{t.id}</strong></td>
                      <td data-label="Date">{t.dateTransaction || '—'}</td>
                      <td data-label="Heure">{t.heureTransaction || '—'}</td>
                      <td data-label="Montant"><strong>{(t.montant ?? 0).toLocaleString('fr-FR')} {t.devise}</strong></td>
                      <td data-label="Type">{t.typePaiement || '—'}</td>
                      <td data-label="Canal"><span className={`stx-status-chip ${canal.tone}`}>{canal.label}</span></td>
                      <td data-label="Statut"><span className={`stx-status-chip ${meta.tone}`}>{meta.label}</span></td>
                      <td data-label="Terminal / Site">{t.tpe || '—'}</td>
                      <td data-label="PDV">{t.pdv || '—'}</td>
                      <td data-label="Ticket">
                        {meta.approved ? (
                          <button
                            type="button"
                            className="stx-ticket-btn"
                            disabled={downloadingId === t.id}
                            onClick={() => handleDownloadTicket(t.id)}
                            title="Télécharger le ticket de transaction"
                          >
                            <span className="material-icons">receipt_long</span>
                            {downloadingId === t.id ? '…' : 'Ticket'}
                          </button>
                        ) : (
                          <span className="stx-ticket-unavailable">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
                <button type="button" disabled={safePageIndex === 0} onClick={() => setPageIndex((p) => Math.max(0, p - 1))}>
                  Précédent
                </button>
                <span>Page {safePageIndex + 1} / {totalPages}</span>
                <button type="button" disabled={safePageIndex >= totalPages - 1} onClick={() => setPageIndex((p) => p + 1)}>
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
