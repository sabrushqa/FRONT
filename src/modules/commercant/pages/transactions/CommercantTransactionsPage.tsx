import React, { useMemo, useState } from 'react';
import { useSessionStore } from '../../../../store/sessionStore';
import '../../../../styles/commercant-transactions.scss';

function statusTone(status: string): string {
  const s = (status ?? '').toUpperCase();
  if (['ACCEPTE', 'APPROUVE', 'VALIDE'].includes(s)) return 'tone-active';
  if (['REFUSE', 'ECHOUE', 'ANNULE'].includes(s))    return 'tone-danger';
  if (['EN_COURS', 'EN_ATTENTE'].includes(s))         return 'tone-progress';
  return 'tone-pending';
}

export default function CommercantTransactionsPage() {
  const { session } = useSessionStore();
  const transactions  = session?.transactions ?? [];
  const isSousCommercant = session?.role === 'SOUS_COMMERCANT';

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]               = useState(0);
  const PAGE_SIZE = 20;

  const filtered = useMemo(() =>
    transactions.filter((t) => {
      const matchSearch  = !search || `${t.id} ${t.pdv} ${t.tpe} ${t.typePaiement}`.toLowerCase().includes(search.toLowerCase());
      const matchStatus  = !statusFilter || (t.statut ?? '').toUpperCase() === statusFilter;
      return matchSearch && matchStatus;
    }),
    [transactions, search, statusFilter]
  );

  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalAmount = filtered.reduce((s, t) => s + (t.montant ?? 0), 0);
  const statuses    = [...new Set(transactions.map((t) => (t.statut ?? '').toUpperCase()).filter(Boolean))];

  return (
    <div className="co-page">
      <div className="co-page-head">
        <div>
          <span className="co-page-kicker">Historique</span>
          <h2>Transactions</h2>
          <p>{isSousCommercant ? 'Transactions de votre point de vente' : 'Historique récent du commerçant'}</p>
        </div>
        <span className="co-badge">{transactions.length} trans.</span>
      </div>

      <div className="tx-kpi-row">
        {[
          { label: 'Total', value: filtered.length },
          { label: 'Montant (MAD)', value: totalAmount.toLocaleString('fr-FR') },
          { label: 'PDV actifs', value: new Set(filtered.map((t) => t.pdvId).filter(Boolean)).size },
          { label: 'TPE utilisés', value: new Set(filtered.map((t) => t.tpe).filter(Boolean)).size }
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
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
          <option value="">Tous les statuts</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
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
                  <th>Type</th><th>Statut</th><th>TPE</th><th>PDV</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((t) => (
                  <tr key={t.id}>
                    <td><strong>#{t.id}</strong></td>
                    <td>{t.dateTransaction || '—'}</td>
                    <td>{t.heureTransaction || '—'}</td>
                    <td><strong>{(t.montant ?? 0).toLocaleString('fr-FR')} {t.devise}</strong></td>
                    <td>{t.typePaiement || '—'}</td>
                    <td><span className={`co-status-chip ${statusTone(t.statut)}`}>{t.statut || '—'}</span></td>
                    <td>{t.tpe || '—'}</td>
                    <td>{t.pdv || '—'}</td>
                  </tr>
                ))}
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
