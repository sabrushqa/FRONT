import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSessionStore } from '../../../../store/sessionStore';
import { requestNewPdvProduct, CommercantPdvProductRequest } from '../../services/commercantApi';
import { getQuartiersForVille } from '../../../../core/quartiersMaroc';
import QuartierCombobox from '../../../../core/components/QuartierCombobox';
import PdvLocationPicker from '../../../../core/components/PdvLocationPicker';
import '../../../../styles/commercant-pdv-request.scss';

const VILLES = ['Agadir','Al Hoceima','Azrou','Beni Mellal','Berkane','Berrechid','Casablanca','Dakhla','El Jadida','Errachidia','Essaouira','Fes','Fquih Ben Salah','Guelmim','Ifrane','Kenitra','Khemisset','Khenifra','Khouribga','Laayoune','Larache','Marrakech','Meknes','Mohammedia','Nador','Ouarzazate','Oued Zem','Oujda','Rabat','Safi','Sale','Settat','Sidi Bennour','Sidi Kacem','Tanger','Tan-Tan','Taourirt','Taroudant','Taza','Temara','Tetouan','Tiznit','Zagora'];
const ENCAISSEMENT_PRODUCTS = [{ value:'TPE', label:'TPE' },{ value:'SOFTPOS', label:'SoftPOS' }];
const ECOMMERCE_PRODUCTS = [{ value:'E_COMMERCE', label:'E-commerce' }];
const PRODUCTS  = [...ENCAISSEMENT_PRODUCTS, ...ECOMMERCE_PRODUCTS];
const MAX_TPE = 10;
const CONNECT   = [{ value:'Fixe', label:'Fixe' },{ value:'Mobile', label:'Mobile' },{ value:'ADSL', label:'ADSL' },{ value:'4G5G', label:'4G/5G' },{ value:'Wifi', label:'WIFI' }];
const EQUIP     = [{ value:'TPEAutonome', label:'TPE autonome' },{ value:'TPECentralise', label:'TPE centralisé' },{ value:'MonetiqueIntegree', label:'Monétique intégrée' }];
const QRSOFTPOS = [{ value:'QRCode', label:'QR Code' },{ value:'SoftPOS', label:'SoftPOS' }];

// La configuration ne doit proposer que ce qui correspond au produit deja choisi.
function resolveQrSoftposOptions(typeAffiliation: string) {
  if (typeAffiliation === 'SOFTPOS') return QRSOFTPOS.filter((o) => o.value !== 'QRCode');
  if (typeAffiliation === 'QR_CODE') return QRSOFTPOS.filter((o) => o.value !== 'SoftPOS');
  return QRSOFTPOS;
}
const ECOMM     = [{ value:'SiteMarchand', label:'Site marchand' },{ value:'ApplicationMobile', label:'Application mobile' },{ value:'PayByLinkManuel', label:'PayByLink manuel' },{ value:'PayByLinkAutomatique', label:'PayByLink automatique' }];

function normalizeAffiliationType(value: string | null | undefined): string {
  const normalized = (value || '').trim().toUpperCase();
  return normalized === 'E_COMMERCE' ? 'E_COMMERCE' : 'ENCAISSEMENT';
}

function resolveDefaultProduct(affiliationFamily: string): string {
  return affiliationFamily === 'E_COMMERCE' ? 'E_COMMERCE' : 'TPE';
}

function resolveAffiliationLabel(affiliationFamily: string): string {
  return affiliationFamily === 'E_COMMERCE' ? 'E-commerce' : 'Encaissement';
}

function createForm(affiliationFamily = 'ENCAISSEMENT'): CommercantPdvProductRequest {
  return { nom:'', adresse:'', ville:'', quartier:'', codePostal:'', telephone:'', email:'', typeAffiliation: resolveDefaultProduct(affiliationFamily), nombreTpe:'1', equipementTpe:'', connectiviteTpe:'', modeMiseADispositionTpe:'', modeleQrSoftpos:'', modeServiceEcommerce:'', siteMarchandUrl:'', applicationMobile:'', latitude: null, longitude: null };
}

function extractError(err: unknown): string {
  const e = err as { response?: { data?: { message?: string; error?: string } } };
  return e?.response?.data?.message || e?.response?.data?.error || 'Impossible d\'envoyer la demande.';
}

export default function CommercantPdvRequestPage() {
  const { session } = useSessionStore();
  const isMerchantAccount = session?.role === 'COMMERCANT';
  const allowedAffiliationFamily = normalizeAffiliationType(session?.typeAffiliation || session?.profile?.typeAffiliation);
  const allowedAffiliationLabel = resolveAffiliationLabel(allowedAffiliationFamily);
  const allowedProducts = useMemo(
    () => allowedAffiliationFamily === 'E_COMMERCE' ? ECOMMERCE_PRODUCTS : ENCAISSEMENT_PRODUCTS,
    [allowedAffiliationFamily]
  );

  const [form, setForm]             = useState<CommercantPdvProductRequest>(() => createForm(allowedAffiliationFamily));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempted, setAttempted]   = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg]     = useState('');
  const [submitted, setSubmitted]   = useState<Array<{ nom:string; ville:string; typeAffiliation:string }>>([]);

  const isTpe      = form.typeAffiliation === 'TPE';
  const isQrSoft   = ['QR_CODE','SOFTPOS'].includes(form.typeAffiliation);
  const isEcomm    = form.typeAffiliation === 'E_COMMERCE';

  useEffect(() => {
    setForm((current) => (
      allowedProducts.some((product) => product.value === current.typeAffiliation)
        ? current
        : createForm(allowedAffiliationFamily)
    ));
  }, [allowedAffiliationFamily, allowedProducts]);

  function firstMissing(): string {
    if (!isEcomm) {
      if (!form.nom.trim())           return 'Nom du point de vente';
      if (!form.adresse.trim())       return 'Adresse';
      if (!form.ville)                return 'Ville';
      if (!form.telephone.trim())     return 'Téléphone';
    }
    if (!form.typeAffiliation)      return 'Produit demandé';
    if (!allowedProducts.some((product) => product.value === form.typeAffiliation)) return 'Produit compatible avec votre affiliation';
    if (isTpe && !form.nombreTpe)   return 'Nombre de TPE';
    if (isTpe && !form.equipementTpe) return 'Équipement TPE';
    if (isTpe && !form.connectiviteTpe) return 'Connectivité';
    if (isQrSoft && !form.modeleQrSoftpos) return 'Modèle QR / SoftPOS';
    if (isEcomm && !form.modeServiceEcommerce) return 'Mode de service e-commerce';
    if (isEcomm && !form.siteMarchandUrl && !form.applicationMobile) return 'Site marchand ou application';
    return '';
  }

  const missing = firstMissing();

  function setField(key: keyof CommercantPdvProductRequest, val: string) {
    setForm((f) => {
      if (key === 'nombreTpe') {
        let cleanValue = val.replace(/\D+/g, '');
        if (Number.parseInt(cleanValue, 10) > MAX_TPE) cleanValue = String(MAX_TPE);
        return { ...f, nombreTpe: cleanValue };
      }
      if (key === 'quartier') {
        const match = getQuartiersForVille(f.ville).find(
          (entry) => entry.quartier.toLowerCase() === val.trim().toLowerCase()
        );
        return { ...f, quartier: val, codePostal: match ? match.codePostal : f.codePostal };
      }
      if (key !== 'typeAffiliation') return { ...f, [key]: val };
      return {
        ...f,
        typeAffiliation: val,
        nombreTpe: val === 'TPE' ? f.nombreTpe || '1' : '',
        equipementTpe: '',
        connectiviteTpe: '',
        modeMiseADispositionTpe: '',
        modeleQrSoftpos: '',
        modeServiceEcommerce: '',
        siteMarchandUrl: '',
        applicationMobile: ''
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setSuccessMsg(''); setErrorMsg('');
    if (!isMerchantAccount) { setErrorMsg('Cette demande est réservée au compte commerçant principal.'); return; }
    if (missing) { setErrorMsg(`Veuillez remplir : ${missing}`); return; }
    setIsSubmitting(true);
    const snapshot = { ...form };
    try {
      const res = await requestNewPdvProduct(snapshot);
      setSuccessMsg(res.message);
      const label = isEcomm
        ? (snapshot.siteMarchandUrl || snapshot.applicationMobile || 'Nouveau canal e-commerce')
        : snapshot.nom;
      setSubmitted((s) => [{ nom: label, ville: isEcomm ? '' : snapshot.ville, typeAffiliation: PRODUCTS.find((p) => p.value === snapshot.typeAffiliation)?.label ?? snapshot.typeAffiliation }, ...s]);
      setForm(createForm(allowedAffiliationFamily));
      setAttempted(false);
    } catch (err) { setErrorMsg(extractError(err)); }
    finally { setIsSubmitting(false); }
  }

  function setPosition(latitude: number, longitude: number) {
    setForm((f) => ({ ...f, latitude, longitude }));
  }

  function req(key: keyof CommercantPdvProductRequest): boolean {
    if (!attempted) return false;
    if (isEcomm && ['nom','adresse','ville','telephone'].includes(key)) return false;
    if (['nom','adresse','ville','telephone','typeAffiliation'].includes(key)) return !String(form[key]).trim();
    if (isTpe    && key === 'nombreTpe')         return !form.nombreTpe;
    if (isTpe    && key === 'equipementTpe')     return !form.equipementTpe;
    if (isTpe    && key === 'connectiviteTpe')   return !form.connectiviteTpe;
    if (isQrSoft && key === 'modeleQrSoftpos')   return !form.modeleQrSoftpos;
    if (isEcomm  && key === 'modeServiceEcommerce') return !form.modeServiceEcommerce;
    return false;
  }

  const pendingPdvs = isEcomm ? [] : (session?.pdvs ?? []).filter((p) => (p.statut ?? '').toUpperCase() === 'EN_VERIFICATION');

  return (
    <div className="co-page">
      <div className="co-page-head">
        <div>
          <span className="co-page-kicker">Expansion</span>
          <h2>{isEcomm ? 'Nouveau canal e-commerce' : 'Nouvelle demande'}</h2>
          <p>Ajoutez une extension pour votre affiliation {allowedAffiliationLabel}.</p>
        </div>
      </div>

      {!isMerchantAccount && (
        <div className="co-page-alert is-warning">
          <span className="material-icons">info</span>
          Cette page est disponible uniquement pour le compte commerçant principal.
        </div>
      )}

      {isMerchantAccount && (
        <form className="pdv-req-form" onSubmit={handleSubmit} noValidate>

          {/* Section PDV — not applicable to e-commerce accounts, which have a
              site marchand / application mobile instead of a physical PDV. */}
          {!isEcomm && (
          <section className="pdv-req-section">
            <div className="pdv-req-section-head">
              <span className="material-icons">storefront</span>
              <div><h3>Point de vente</h3><p>Informations du nouveau PDV</p></div>
            </div>
            <div className="pdv-req-grid">
              <label className={`co-field${req('nom') ? ' is-invalid' : ''}`}>
                <span>Nom du point de vente *</span>
                <input type="text" value={form.nom} disabled={isSubmitting} onChange={(e) => setField('nom', e.target.value)} />
              </label>
              <label className={`co-field${req('ville') ? ' is-invalid' : ''}`}>
                <span>Ville *</span>
                <select value={form.ville} disabled={isSubmitting} onChange={(e) => setField('ville', e.target.value)}>
                  <option value="">Sélectionner</option>
                  {VILLES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className={`co-field${req('telephone') ? ' is-invalid' : ''}`}>
                <span>Téléphone *</span>
                <input type="tel" value={form.telephone} disabled={isSubmitting} onChange={(e) => setField('telephone', e.target.value)} />
              </label>
              <label className="co-field field-full">
                <span>Adresse *</span>
                <input type="text" value={form.adresse} disabled={isSubmitting} onChange={(e) => setField('adresse', e.target.value)} />
              </label>
              <QuartierCombobox
                id="pdv-req-quartier"
                label="Quartier"
                value={form.quartier}
                ville={form.ville}
                disabled={isSubmitting}
                variant="co-field"
                onChange={(v) => setField('quartier', v)}
              />
              <label className="co-field">
                <span>Code postal</span>
                <input type="text" value={form.codePostal} disabled={isSubmitting} onChange={(e) => setField('codePostal', e.target.value)} />
              </label>
              <label className="co-field">
                <span>E-mail PDV</span>
                <input type="email" value={form.email} disabled={isSubmitting} onChange={(e) => setField('email', e.target.value)} />
              </label>
            </div>
            <div className="pdv-req-location-field">
              <label>Emplacement sur la carte</label>
              <PdvLocationPicker
                ville={form.ville}
                latitude={form.latitude}
                longitude={form.longitude}
                disabled={isSubmitting}
                onChange={setPosition}
              />
            </div>
          </section>
          )}

          {/* Section Produit */}
          <section className="pdv-req-section">
            <div className="pdv-req-section-head">
              <span className="material-icons">devices</span>
              <div><h3>{allowedAffiliationLabel}</h3><p>{allowedAffiliationFamily === 'E_COMMERCE' ? 'Extension e-commerce uniquement.' : 'Choisissez le design d’encaissement: TPE ou SoftPOS.'}</p></div>
            </div>
            <div className="pdv-req-grid">
              <div className="product-selector">
                {allowedProducts.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={`product-btn${form.typeAffiliation === p.value ? ' is-active' : ''}`}
                    onClick={() => setField('typeAffiliation', p.value)}
                    disabled={isSubmitting}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {isTpe && (
                <>
                  <label className={`co-field${req('nombreTpe') ? ' is-invalid' : ''}`}>
                    <span>Nombre de TPE *</span>
                    <input type="number" min={1} max={MAX_TPE} value={form.nombreTpe} disabled={isSubmitting} onChange={(e) => setField('nombreTpe', e.target.value)} />
                  </label>
                  <label className={`co-field${req('equipementTpe') ? ' is-invalid' : ''}`}>
                    <span>Équipement *</span>
                    <select value={form.equipementTpe} disabled={isSubmitting} onChange={(e) => setField('equipementTpe', e.target.value)}>
                      <option value="">Sélectionner</option>
                      {EQUIP.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <label className={`co-field${req('connectiviteTpe') ? ' is-invalid' : ''}`}>
                    <span>Connectivité *</span>
                    <select value={form.connectiviteTpe} disabled={isSubmitting} onChange={(e) => setField('connectiviteTpe', e.target.value)}>
                      <option value="">Sélectionner</option>
                      {CONNECT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                </>
              )}

              {isQrSoft && (
                <label className={`co-field${req('modeleQrSoftpos') ? ' is-invalid' : ''}`}>
                  <span>Modèle *</span>
                  <select value={form.modeleQrSoftpos} disabled={isSubmitting} onChange={(e) => setField('modeleQrSoftpos', e.target.value)}>
                    <option value="">Sélectionner</option>
                    {resolveQrSoftposOptions(form.typeAffiliation).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              )}

              {isEcomm && (
                <>
                  <label className={`co-field${req('modeServiceEcommerce') ? ' is-invalid' : ''}`}>
                    <span>Mode service *</span>
                    <select value={form.modeServiceEcommerce} disabled={isSubmitting} onChange={(e) => setField('modeServiceEcommerce', e.target.value)}>
                      <option value="">Sélectionner</option>
                      {ECOMM.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <label className="co-field">
                    <span>URL site marchand</span>
                    <input type="url" value={form.siteMarchandUrl} disabled={isSubmitting} onChange={(e) => setField('siteMarchandUrl', e.target.value)} />
                  </label>
                  <label className="co-field">
                    <span>Application mobile</span>
                    <input type="text" value={form.applicationMobile} disabled={isSubmitting} onChange={(e) => setField('applicationMobile', e.target.value)} />
                  </label>
                </>
              )}
            </div>
          </section>

          {successMsg && <p className="co-feedback is-success">{successMsg}</p>}
          {errorMsg   && <p className="co-feedback is-error">{errorMsg}</p>}

          <div className="co-form-actions">
            <button type="submit" className="co-btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Envoi en cours…' : 'Soumettre la demande'}
            </button>
            {attempted && missing && <span className="co-hint-error">Veuillez remplir : {missing}</span>}
          </div>
        </form>
      )}

      {/* Pending requests */}
      {(submitted.length > 0 || pendingPdvs.length > 0) && (
        <section className="pdv-pending">
          <h3>Demandes en cours</h3>
          {[...submitted, ...pendingPdvs.map((p) => ({ nom: p.nom || 'Nouveau PDV', ville: p.ville, typeAffiliation: 'En traitement' }))].map((req, i) => (
            <div key={i} className="pdv-pending-row">
              <span className="material-icons">storefront</span>
              <div><strong>{req.nom}</strong><span>{req.ville} · {req.typeAffiliation}</span></div>
              <span className="co-status-chip tone-progress">En vérification</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
