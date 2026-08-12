import React, { useMemo, useState } from 'react';
import { useSessionStore, useEffectiveAffiliationType, type UserSessionResponse } from '../../../../store/sessionStore';
import {
  createSubMerchant,
  activateSubMerchant,
  deactivateSubMerchant,
  moveSubMerchantToPdv
} from '../../services/commercantApi';
import '../../../../styles/commercant-sub-commercants.scss';

type SubMerchant = UserSessionResponse['sousCommercants'][number];

function extractError(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Une erreur est survenue.';
}

const CANAL_LABELS: Record<string, string> = {
  SITE_MARCHAND: 'Site marchand',
  APPLICATION_MOBILE: 'Application mobile'
};

export default function CommercantSubCommercantsPage() {
  const { session, setSession } = useSessionStore();
  const sousCommercants = session?.sousCommercants ?? [];
  const pdvs            = session?.pdvs ?? [];
  const assignablePdvs  = pdvs.filter((p) => (p.statut ?? '').toUpperCase() !== 'EN_VERIFICATION');
  const isSousCommercant = session?.role === 'SOUS_COMMERCANT';
  const isEcommerce = useEffectiveAffiliationType() === 'E_COMMERCE';

  /* ---- Create form ---- */
  const [form, setForm] = useState({ pdvId: '', canalEcommerce: '', prenom: '', nom: '', email: '', telephone: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [createErr, setCreateErr] = useState('');

  /* ---- Management ---- */
  const [pdvSelection, setPdvSelection] = useState<Record<number, string>>(() => {
    const sel: Record<number, string> = {};
    sousCommercants.forEach((sc) => { sel[sc.id] = sc.pdvId ? String(sc.pdvId) : ''; });
    return sel;
  });
  const [updating, setUpdating] = useState<Record<number, boolean>>({});
  const [mgmtMsg, setMgmtMsg] = useState('');
  const [mgmtErr, setMgmtErr] = useState('');

  useMemo(() => {
    const sel: Record<number, string> = {};
    sousCommercants.forEach((sc) => { sel[sc.id] = sc.pdvId ? String(sc.pdvId) : ''; });
    setPdvSelection(sel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sousCommercants.length]);

  function setUpdatingById(id: number, val: boolean) {
    setUpdating((u) => ({ ...u, [id]: val }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateMsg(''); setCreateErr('');
    if (!form.prenom.trim() || !form.nom.trim() || !form.email.trim()) {
      setCreateErr('Le prénom, le nom et l\'e-mail sont obligatoires.'); return;
    }

    const basePayload = { prenom: form.prenom.trim(), nom: form.nom.trim(), email: form.email.trim(), telephone: form.telephone.trim() };

    if (isEcommerce) {
      if (form.canalEcommerce !== 'SITE_MARCHAND' && form.canalEcommerce !== 'APPLICATION_MOBILE') {
        setCreateErr('Sélectionnez un canal (site marchand ou application mobile).'); return;
      }
      setIsCreating(true);
      try {
        const res = await createSubMerchant({ ...basePayload, canalEcommerce: form.canalEcommerce });
        setCreateMsg(res.message + (res.activationMessage ? ` ${res.activationMessage}` : ''));
        setForm({ pdvId: '', canalEcommerce: '', prenom: '', nom: '', email: '', telephone: '' });
      } catch (err) { setCreateErr(extractError(err)); }
      finally { setIsCreating(false); }
      return;
    }

    const pdvId = Number.parseInt(form.pdvId, 10);
    if (!Number.isFinite(pdvId) || pdvId < 1) { setCreateErr('Sélectionnez un point de vente.'); return; }
    setIsCreating(true);
    try {
      const res = await createSubMerchant({ ...basePayload, pdvId });
      setCreateMsg(res.message + (res.activationMessage ? ` ${res.activationMessage}` : ''));
      setForm({ pdvId: '', canalEcommerce: '', prenom: '', nom: '', email: '', telephone: '' });
    } catch (err) { setCreateErr(extractError(err)); }
    finally { setIsCreating(false); }
  }

  async function handleToggle(sc: SubMerchant) {
    if (updating[sc.id]) return;
    setUpdatingById(sc.id, true); setMgmtMsg(''); setMgmtErr('');
    try {
      const res = sc.active ? await deactivateSubMerchant(sc.id) : await activateSubMerchant(sc.id);
      setMgmtMsg(res.message);
      if (session) {
        const updated = session.sousCommercants.map((s) => s.id === sc.id ? { ...s, active: !sc.active } : s);
        setSession({ ...session, sousCommercants: updated });
      }
    } catch (err) { setMgmtErr(extractError(err)); }
    finally { setUpdatingById(sc.id, false); }
  }

  function isPdvTakenByOther(pdvId: number, scId: number): boolean {
    return pdvs.some((p) => p.id === pdvId && p.sousCommercantId !== null && p.sousCommercantId !== scId);
  }

  function isPdvInVerification(pdvId: number): boolean {
    return pdvs.some((p) => p.id === pdvId && (p.statut ?? '').toUpperCase() === 'EN_VERIFICATION');
  }

  function canMove(sc: SubMerchant): boolean {
    const rawId = pdvSelection[sc.id];
    const id = Number.parseInt(rawId ?? '', 10);
    return !updating[sc.id] && Number.isFinite(id) && id > 0 && id !== sc.pdvId && !isPdvTakenByOther(id, sc.id) && !isPdvInVerification(id);
  }

  async function handleMove(sc: SubMerchant) {
    if (!canMove(sc)) return;
    const pdvId = Number.parseInt(pdvSelection[sc.id] ?? '', 10);
    setUpdatingById(sc.id, true); setMgmtMsg(''); setMgmtErr('');
    try {
      const res = await moveSubMerchantToPdv(sc.id, pdvId);
      setMgmtMsg(res.message);
      if (session) {
        const updated = session.sousCommercants.map((s) => s.id === sc.id ? { ...s, pdvId, pdv: pdvs.find((p) => p.id === pdvId)?.nom ?? String(pdvId) } : s);
        setSession({ ...session, sousCommercants: updated });
      }
    } catch (err) { setMgmtErr(extractError(err)); }
    finally { setUpdatingById(sc.id, false); }
  }

  return (
    <div className="co-page">
      <div className="co-page-head">
        <div>
          <span className="co-page-kicker">Équipe</span>
          <h2>Sous-commerçants</h2>
          <p>{isEcommerce ? 'Ajoutez et gérez les comptes rattachés à votre site marchand ou application mobile' : 'Ajoutez et gérez les comptes rattachés à vos points de vente'}</p>
        </div>
        <span className="co-badge">{sousCommercants.length} compte(s)</span>
      </div>

      {/* Create form */}
      {!isSousCommercant && (
        <section className="co-section">
          <div className="co-section-head">
            <span className="material-icons">person_add</span>
            <div>
              <h3>Ajouter un sous-commerçant</h3>
              <p>{isEcommerce ? 'Le compte sera rattaché au canal sélectionné et un e-mail d\'activation sera envoyé.' : 'Le compte sera rattaché au point de vente sélectionné et un e-mail d\'activation sera envoyé.'}</p>
            </div>
          </div>

          <form className="co-form-grid" onSubmit={handleCreate}>
            {isEcommerce ? (
              <label className="co-field">
                <span>Canal *</span>
                <select value={form.canalEcommerce} disabled={isCreating} onChange={(e) => setForm((f) => ({ ...f, canalEcommerce: e.target.value }))}>
                  <option value="">Sélectionner un canal</option>
                  <option value="SITE_MARCHAND">Site marchand</option>
                  <option value="APPLICATION_MOBILE">Application mobile</option>
                </select>
              </label>
            ) : (
              <label className="co-field">
                <span>Point de vente *</span>
                <select value={form.pdvId} disabled={isCreating} onChange={(e) => setForm((f) => ({ ...f, pdvId: e.target.value }))}>
                  <option value="">Sélectionner un PDV</option>
                  {assignablePdvs.map((p) => <option key={p.id} value={p.id}>{p.nom || `PDV #${p.id}`}</option>)}
                </select>
              </label>
            )}
            <label className="co-field">
              <span>Prénom *</span>
              <input type="text" value={form.prenom} disabled={isCreating} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))} />
            </label>
            <label className="co-field">
              <span>Nom *</span>
              <input type="text" value={form.nom} disabled={isCreating} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
            </label>
            <label className="co-field">
              <span>E-mail *</span>
              <input type="email" value={form.email} disabled={isCreating} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </label>
            <label className="co-field">
              <span>Téléphone</span>
              <input type="tel" value={form.telephone} disabled={isCreating} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} />
            </label>
            <div className="co-form-actions">
              <button type="submit" className="co-btn-primary" disabled={isCreating || (!isEcommerce && !assignablePdvs.length)}>
                {isCreating ? 'Création…' : 'Ajouter'}
              </button>
            </div>
          </form>

          {createMsg && <p className="co-feedback is-success">{createMsg}</p>}
          {createErr && <p className="co-feedback is-error">{createErr}</p>}
        </section>
      )}

      {/* Management feedback */}
      {mgmtMsg && <p className="co-feedback is-success">{mgmtMsg}</p>}
      {mgmtErr && <p className="co-feedback is-error">{mgmtErr}</p>}

      {/* List */}
      {sousCommercants.length === 0 ? (
        <div className="co-empty">
          <span className="material-icons">group_off</span>
          <p>Aucun sous-commerçant enregistré.</p>
        </div>
      ) : (
        <div className="sm-list">
          {sousCommercants.map((sc) => (
            <article key={sc.id} className="sm-card">
              <div className="sm-card-head">
                <div className="sm-avatar">{(sc.prenom?.[0] ?? sc.nom?.[0] ?? '?').toUpperCase()}</div>
                <div className="sm-identity">
                  <strong>{sc.prenom} {sc.nom}</strong>
                  <span>{sc.email}</span>
                  {sc.telephone && <span>{sc.telephone}</span>}
                </div>
                <div className="sm-badges">
                  <span className={`co-status-chip ${sc.active ? 'tone-active' : 'tone-danger'}`}>
                    {sc.active ? 'Actif' : 'Inactif'}
                  </span>
                  {sc.pdv && <span className="co-status-chip tone-info">{sc.pdv}</span>}
                  {!sc.pdv && sc.canalEcommerce && (
                    <span className="co-status-chip tone-info">{CANAL_LABELS[sc.canalEcommerce] ?? sc.canalEcommerce}</span>
                  )}
                </div>
              </div>

              {!isSousCommercant && (
                <div className="sm-actions">
                  <button
                    type="button"
                    className={sc.active ? 'co-btn-warn' : 'co-btn-secondary'}
                    disabled={!!updating[sc.id]}
                    onClick={() => handleToggle(sc)}
                  >
                    {updating[sc.id] ? '…' : sc.active ? 'Désactiver' : 'Activer'}
                  </button>

                  {!isEcommerce && (
                  <label className="sm-move-label">
                    <span>Déplacer vers PDV</span>
                    <select
                      value={pdvSelection[sc.id] ?? ''}
                      disabled={!!updating[sc.id]}
                      onChange={(e) => setPdvSelection((s) => ({ ...s, [sc.id]: e.target.value }))}
                    >
                      <option value="">Sélectionner</option>
                      {assignablePdvs.map((p) => (
                        <option key={p.id} value={p.id} disabled={isPdvTakenByOther(p.id, sc.id)}>
                          {p.nom || `PDV #${p.id}`}{isPdvTakenByOther(p.id, sc.id) ? ' (occupé)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  )}

                  {!isEcommerce && (
                    <button
                      type="button"
                      className="co-btn-primary"
                      disabled={!canMove(sc)}
                      onClick={() => handleMove(sc)}
                    >
                      Déplacer
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
