import React, { useState } from 'react';
import { useSessionStore, useEffectiveAffiliationType } from '../../../../store/sessionStore';
import { assignTpeToPdv } from '../../services/commercantApi';
import '../../../../styles/commercant-tpes.scss';

function statusTone(s: string): string {
  const u = (s ?? '').toUpperCase();
  if (u === 'ACTIF')   return 'tone-active';
  if (u === 'INACTIF') return 'tone-danger';
  return 'tone-pending';
}

export default function CommercantTpesPage() {
  const { session, setSession } = useSessionStore();
  const tpes = session?.tpes ?? [];
  const pdvs = session?.pdvs ?? [];
  const isSousCommercant = session?.role === 'SOUS_COMMERCANT';
  const isEcommerce = useEffectiveAffiliationType() === 'E_COMMERCE';

  const [pdvSelection,  setPdvSelection]  = useState<Record<string, string>>({});
  const [assigning,     setAssigning]     = useState<Record<string, boolean>>({});
  const [messages,      setMessages]      = useState<Record<string, string>>({});
  const [errors,        setErrors]        = useState<Record<string, string>>({});

  async function handleAssign(tpeId: string) {
    const rawPdvId = pdvSelection[tpeId];
    const pdvId = Number.parseInt(rawPdvId ?? '', 10);
    if (!Number.isFinite(pdvId) || pdvId < 1) {
      setErrors((e) => ({ ...e, [tpeId]: 'Sélectionnez un point de vente.' }));
      return;
    }
    setAssigning((a) => ({ ...a, [tpeId]: true }));
    setMessages((m) => { const n = { ...m }; delete n[tpeId]; return n; });
    setErrors((e)   => { const n = { ...e }; delete n[tpeId]; return n; });
    try {
      const res = await assignTpeToPdv(tpeId, pdvId);
      setMessages((m) => ({ ...m, [tpeId]: res.message }));
      if (session) {
        const updatedTpes = session.tpes.map((t) =>
          t.id === tpeId ? { ...t, pdvId, pdv: pdvs.find((p) => p.id === pdvId)?.nom ?? String(pdvId) } : t
        );
        setSession({ ...session, tpes: updatedTpes });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrors((e) => ({ ...e, [tpeId]: msg || 'Affectation impossible.' }));
    } finally {
      setAssigning((a) => ({ ...a, [tpeId]: false }));
    }
  }

  function canAssign(tpeId: string): boolean {
    const rawPdv = pdvSelection[tpeId];
    const pdvId  = Number.parseInt(rawPdv ?? '', 10);
    if (!Number.isFinite(pdvId) || pdvId < 1) return false;
    const tpe = tpes.find((t) => t.id === tpeId);
    return pdvId !== tpe?.pdvId;
  }

  return (
    <div className="co-page">
      <div className="co-page-head">
        <div>
          <span className="co-page-kicker">Terminaux</span>
          <h2>TPE</h2>
          <p>{isSousCommercant ? 'Terminaux de votre point de vente' : 'Affectez vos terminaux aux points de vente'}</p>
        </div>
        <span className="co-badge">{tpes.length} terminal(s)</span>
      </div>

      {!isSousCommercant && (messages[0] || errors[0]) && (
        <div className={`co-page-alert ${errors[0] ? 'is-error' : 'is-success'}`}>
          {messages[0] || errors[0]}
        </div>
      )}

      {isEcommerce ? (
        <div className="co-empty">
          <span className="material-icons">language</span>
          <p>Cette section ne s'applique pas aux comptes e-commerce. Consultez votre site marchand / application dans Vue d'ensemble.</p>
        </div>
      ) : tpes.length === 0 ? (
        <div className="co-empty">
          <span className="material-icons">point_of_sale</span>
          <p>Aucun terminal TPE disponible.</p>
        </div>
      ) : (
        <div className="tpe-grid">
          {tpes.map((tpe) => (
            <article key={tpe.id} className="tpe-card">
              <div className="tpe-card-head">
                <div className="tpe-avatar">
                  <span className="material-icons">point_of_sale</span>
                </div>
                <div>
                  <strong>{tpe.numeroSerie || `TPE #${tpe.id}`}</strong>
                  <span>{tpe.modele || '—'}</span>
                </div>
                <span className={`co-status-chip ${statusTone(tpe.statut)}`}>{tpe.statut || '—'}</span>
              </div>

              <div className="tpe-info-grid">
                {/* <span> plutot que <label> (Sonar S6853) : ce sont des legendes de
                    lecture seule, sans champ de formulaire associe. */}
                <div><span className="field-caption">Connexion</span><span>{tpe.typeConnexion || '—'}</span></div>
                <div><span className="field-caption">PDV actuel</span><span>{tpe.pdv || 'Non affecté'}</span></div>
              </div>

              {messages[tpe.id] && <p className="tpe-feedback is-success">{messages[tpe.id]}</p>}
              {errors[tpe.id]   && <p className="tpe-feedback is-error">{errors[tpe.id]}</p>}

              {!isSousCommercant && (
                <div className="tpe-assignment">
                  <label>
                    <span>Affecter au PDV</span>
                    <select
                      value={pdvSelection[tpe.id] ?? ''}
                      disabled={!!assigning[tpe.id]}
                      onChange={(e) => setPdvSelection((s) => ({ ...s, [tpe.id]: e.target.value }))}
                    >
                      <option value="">Sélectionner un PDV</option>
                      {pdvs.map((p) => (
                        <option key={p.id} value={p.id}>{p.nom || `PDV #${p.id}`}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="co-btn-primary"
                    disabled={!canAssign(tpe.id) || !!assigning[tpe.id]}
                    onClick={() => handleAssign(tpe.id)}
                  >
                    {assigning[tpe.id] ? 'Affectation…' : 'Affecter'}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
