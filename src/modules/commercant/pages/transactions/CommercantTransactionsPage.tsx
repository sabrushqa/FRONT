import React, { useMemo, useState } from 'react';
import { useSessionStore, useEffectiveAffiliationType } from '../../../../store/sessionStore';
import { downloadTransactionTicket } from '../../services/commercantApi';
import { triggerBlobDownload } from '../../../../core/browserDownload';
import { downloadExcel } from '../../../../core/excelExport';
import '../../../../styles/commercant-transactions.scss';

type Periode = 'all' | '7' | '30' | '90';

// Comparaison inclusive sur la date seule (YYYY-MM-DD, format natif des
// <input type="date">) — dateTransaction peut porter une heure, on ne
// compare que la partie date pour que "jusqu'au 15" inclue bien toute la
// journee du 15, pas seulement 00:00.
function isWithinDateRange(dateTransaction: string, from: string, to: string): boolean {
  if (!dateTransaction) return !from && !to;
  const day = dateTransaction.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

// Meme logique que SupervisorTransactionsPage.tsx : presets rapides
// (7/30/90 jours / toute la periode), pris en compte uniquement quand
// aucune plage Du/Au precise n'est renseignee.
function isWithinPeriod(dateTransaction: string, periode: Periode): boolean {
  if (periode === 'all' || !dateTransaction) return true;
  const parsed = new Date(dateTransaction);
  if (Number.isNaN(parsed.getTime())) return true;
  const days = Number(periode);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return parsed >= cutoff;
}

// Le statut brut vient soit du switch monétique (codes anglais : APPROVED,
// DECLINED…), soit d'anciennes données locales (codes français) — on
// normalise les deux vers un même rendu français plutôt que d'afficher le
// code brut tel quel dans le tableau.
const STATUS_META: Record<string, { tone: string; label: string; approved?: boolean }> = {
  APPROVED:   { tone: 'tone-active',   label: 'Approuvée', approved: true },
  ACCEPTE:    { tone: 'tone-active',   label: 'Approuvée', approved: true },
  APPROUVE:   { tone: 'tone-active',   label: 'Approuvée', approved: true },
  VALIDE:     { tone: 'tone-active',   label: 'Approuvée', approved: true },
  DECLINED:   { tone: 'tone-danger',   label: 'Refusée' },
  REFUSE:     { tone: 'tone-danger',   label: 'Refusée' },
  ECHOUE:     { tone: 'tone-danger',   label: 'Refusée' },
  ANNULE:     { tone: 'tone-danger',   label: 'Annulée' },
  REVERSED:   { tone: 'tone-danger',   label: 'Annulée' },
  TIMEOUT:    { tone: 'tone-progress', label: 'Expirée' },
  EXPIRED:    { tone: 'tone-progress', label: 'Expirée' },
  PENDING:    { tone: 'tone-progress', label: 'En attente' },
  EN_COURS:   { tone: 'tone-progress', label: 'En attente' },
  EN_ATTENTE: { tone: 'tone-progress', label: 'En attente' }
};

function statusMeta(status: string) {
  return STATUS_META[(status ?? '').toUpperCase()] ?? { tone: 'tone-pending', label: status || '—' };
}

const CANAL_META: Record<string, { label: string; tone: string }> = {
  TPE:       { label: 'Encaissement TPE', tone: 'tone-progress' },
  ECOMMERCE: { label: 'E-commerce',       tone: 'tone-active' }
};

function canalMeta(canal: string) {
  return CANAL_META[(canal ?? '').toUpperCase()] ?? { label: canal || '—', tone: 'tone-pending' };
}

export default function CommercantTransactionsPage() {
  const { session } = useSessionStore();
  // Un commercant a affiliation combinee bascule d'espace (ENCAISSEMENT /
  // E-COMMERCE, voir CommercantDashboard::profileSwitcher) : dans l'espace
  // e-commerce, seules les transactions e-commerce doivent apparaitre (et
  // inversement) — sans ca, ce tableau melangeait toujours les deux canaux
  // quel que soit l'espace consulte. Pour un compte mono-canal, le filtre
  // n'a aucun effet (toutes ses transactions partagent deja le meme canal).
  const hasCombinedAffiliation = session?.typeAffiliation === 'ENCAISSEMENT_ET_ECOMMERCE';
  const isEcommerce = useEffectiveAffiliationType() === 'E_COMMERCE';
  const allTransactions = session?.transactions ?? [];
  const transactions = hasCombinedAffiliation
    ? allTransactions.filter((t) => (t.canal ?? '').toUpperCase() === (isEcommerce ? 'ECOMMERCE' : 'TPE'))
    : allTransactions;

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [canalFilter, setCanalFilter] = useState('');
  const [periode, setPeriode]         = useState<Periode>('all');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [page, setPage]               = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const PAGE_SIZE = 20;

  async function handleDownloadTicket(transactionId: string) {
    setDownloadError('');
    setDownloadingId(transactionId);
    try {
      const blob = await downloadTransactionTicket(transactionId);
      await triggerBlobDownload(blob, `ticket-${transactionId}.pdf`);
    } catch {
      setDownloadError('Téléchargement du ticket impossible.');
    } finally {
      setDownloadingId(null);
    }
  }

  const filtered = useMemo(() =>
    transactions.filter((t) => {
      const matchSearch  = !search || `${t.id} ${t.pdv} ${t.tpe} ${t.typePaiement}`.toLowerCase().includes(search.toLowerCase());
      const matchStatus  = !statusFilter || statusMeta(t.statut).label === statusFilter;
      const matchCanal   = !canalFilter || (t.canal ?? '').toUpperCase() === canalFilter;
      // Une plage de dates precise (Du/Au) prend le pas sur le preset
      // Periode des qu'elle est renseignee.
      const matchDate    = dateFrom || dateTo
        ? isWithinDateRange(t.dateTransaction, dateFrom, dateTo)
        : isWithinPeriod(t.dateTransaction, periode);
      return matchSearch && matchStatus && matchCanal && matchDate;
    }),
    [transactions, search, statusFilter, canalFilter, periode, dateFrom, dateTo]
  );

  async function handleExportExcel() {
    setIsExporting(true);
    setDownloadError('');
    try {
      const period = dateFrom || dateTo ? `${dateFrom || 'debut'}_a_${dateTo || 'aujourdhui'}` : periode;
      await downloadExcel(
        `transactions-${period}`,
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
      setDownloadError("Export Excel impossible.");
    } finally {
      setIsExporting(false);
    }
  }

  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalAmount = filtered.reduce((s, t) => s + (t.montant ?? 0), 0);
  // Deduplique par libellé affiché, pas par code brut : TIMEOUT et EXPIRED
  // partagent le même libellé "Expirée" — sans ça le menu affichait deux
  // fois la même option.
  const statuses    = [...new Set(
    transactions.map((t) => (t.statut ?? '').toUpperCase()).filter(Boolean).map((s) => statusMeta(s).label)
  )];
  const canaux      = [...new Set(transactions.map((t) => (t.canal ?? '').toUpperCase()).filter(Boolean))];
  // Un commerçant mono-canal (TPE seul ou e-commerce seul) n'a pas besoin de
  // ce filtre : il n'apparaît que si l'historique contient réellement les
  // deux canaux (cas ENCAISSEMENT_ET_ECOMMERCE).
  const showCanalFilter = canaux.length > 1;

  return (
    <div className="co-page">
      {downloadError && <div className="co-error-banner">{downloadError}</div>}

      <div className="tx-kpi-row">
        {[
          { label: 'Total', value: filtered.length },
          { label: 'Montant (MAD)', value: totalAmount.toLocaleString('fr-FR') },
          ...(isEcommerce
            ? [{ label: 'Sites e-commerce utilisés', value: new Set(filtered.map((t) => t.tpe).filter(Boolean)).size }]
            : [
                { label: 'PDV actifs', value: new Set(filtered.map((t) => t.pdvId).filter(Boolean)).size },
                { label: 'TPE utilisés', value: new Set(filtered.map((t) => t.tpe).filter(Boolean)).size }
              ])
        ].map((k) => (
          <div key={k.label} className="tx-kpi">
            <span>{k.label}</span>
            <strong>{k.value}</strong>
          </div>
        ))}
      </div>

      <div className="tx-filters">
        <label className="tx-search">
          <span className="material-icons">search</span>
          <input
            type="text"
            placeholder="Rechercher ID, PDV, TPE, type…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </label>
        <select aria-label="Statut" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
          <option value="">Tous les statuts</option>
          {statuses.map((label) => <option key={label} value={label}>{label}</option>)}
        </select>
        {showCanalFilter && (
          <select aria-label="Canal" value={canalFilter} onChange={(e) => { setCanalFilter(e.target.value); setPage(0); }}>
            <option value="">Tous les canaux</option>
            {canaux.map((c) => <option key={c} value={c}>{canalMeta(c).label}</option>)}
          </select>
        )}
        <select aria-label="Période" value={periode} onChange={(e) => { setPeriode(e.target.value as Periode); setPage(0); }} disabled={!!(dateFrom || dateTo)}>
          <option value="7">7 derniers jours</option>
          <option value="30">30 derniers jours</option>
          <option value="90">90 derniers jours</option>
          <option value="all">Toute la période</option>
        </select>
        <label className="tx-date-filter">
          Du{' '}
          <input type="date" value={dateFrom} max={dateTo || undefined}
            onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} />
        </label>
        <label className="tx-date-filter">
          Au{' '}
          <input type="date" value={dateTo} min={dateFrom || undefined}
            onChange={(e) => { setDateTo(e.target.value); setPage(0); }} />
        </label>
        {(dateFrom || dateTo) && (
          <button type="button" className="tx-clear-dates" onClick={() => { setDateFrom(''); setDateTo(''); }}>
            Effacer les dates
          </button>
        )}
        <button
          type="button"
          className="tx-export-btn"
          disabled={isExporting || filtered.length === 0}
          onClick={handleExportExcel}
          title="Télécharger la période affichée au format Excel"
        >
          <span className="material-icons">file_download</span>
          {isExporting ? 'Export…' : 'Excel'}
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="co-empty">
          <span className="material-icons">receipt_long</span>
          <p>Aucune transaction disponible.</p>
        </div>
      ) : (
        <div className="table-shell">
          <div className="table-toolbar">
            <div className="table-summary">
              <strong>{filtered.length} résultat(s)</strong>
              <span>Page {page + 1} / {Math.max(1, totalPages)}</span>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table">
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
                      <td><strong>#{t.id}</strong></td>
                      <td>{t.dateTransaction || '—'}</td>
                      <td>{t.heureTransaction || '—'}</td>
                      <td><strong>{(t.montant ?? 0).toLocaleString('fr-FR')} {t.devise}</strong></td>
                      <td>{t.typePaiement || '—'}</td>
                      <td><span className={`co-status-chip ${canal.tone}`}>{canal.label}</span></td>
                      <td><span className={`co-status-chip ${meta.tone}`}>{meta.label}</span></td>
                      <td>{t.tpe || '—'}</td>
                      <td>{t.pdv || '—'}</td>
                      <td>
                        {meta.approved ? (
                          <button
                            type="button"
                            className="tx-ticket-btn"
                            disabled={downloadingId === t.id}
                            onClick={() => handleDownloadTicket(t.id)}
                            title="Télécharger le ticket de transaction"
                          >
                            <span className="material-icons">receipt_long</span>
                            {downloadingId === t.id ? '…' : 'Ticket'}
                          </button>
                        ) : (
                          <span className="tx-ticket-unavailable" title="Ticket disponible uniquement pour les transactions approuvées">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="table-pagination">
              <div className="pager-actions">
                <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</button>
                <span>{page + 1} / {totalPages}</span>
                <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>›</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
