import React, { useCallback, useEffect, useState } from 'react';
import { useSessionStore, useEffectiveAffiliationType } from '../../../../store/sessionStore';
import {
  requestNewPdvProduct,
  CommercantPdvProductRequest,
  getLatestContract,
  downloadLatestContract,
  uploadSignedContract,
  verifyContractSignature,
  CommercantContractOverview
} from '../../services/commercantApi';
import { getQuartiersForVille } from '../../../../core/quartiersMaroc';
import QuartierCombobox from '../../../../core/components/QuartierCombobox';
import PdvLocationPicker from '../../../../core/components/PdvLocationPicker';
import { openBlobInNewTab, triggerBlobDownload } from '../../../../core/browserDownload';
import '../../../../styles/commercant-pdv-request.scss';
import '../request-status/CommercantRequestStatusPage.scss';

// Statuts de dossier pour lesquels une demande d'extension (nouveau PDV/TPE/
// canal e-commerce) est encore "en vie" : le contrat de cette extension doit
// alors etre visible ici, tant qu'elle n'est pas absorbee dans l'espace
// principal (ACCEPTE) ou definitivement close (ABANDONNE, affiche pour que
// le commercant voie le motif).
const EXTENSION_CONTRACT_STATUSES = new Set([
  'SOUMIS', 'INCOMPLET', 'EN_ATTENTE_VALIDATION_BOA', 'CONTRAT_A_SIGNER', 'ABANDONNE'
]);

function formatDossierStatusLabel(status: string): string {
  const map: Record<string, string> = {
    SOUMIS: 'Soumis',
    INCOMPLET: 'Complément demandé',
    EN_ATTENTE_VALIDATION_BOA: 'En attente de validation back-office',
    CONTRAT_A_SIGNER: 'Contrat à signer',
    ABANDONNE: 'Abandonné',
  };
  return map[status] || status;
}

const VILLES = ['Agadir','Al Hoceima','Azrou','Beni Mellal','Berkane','Berrechid','Casablanca','Dakhla','El Jadida','Errachidia','Essaouira','Fes','Fquih Ben Salah','Guelmim','Ifrane','Kenitra','Khemisset','Khenifra','Khouribga','Laayoune','Larache','Marrakech','Meknes','Mohammedia','Nador','Ouarzazate','Oued Zem','Oujda','Rabat','Safi','Sale','Settat','Sidi Bennour','Sidi Kacem','Tanger','Tan-Tan','Taourirt','Taroudant','Taza','Temara','Tetouan','Tiznit','Zagora'];
// Les demandes d'extension ne couvrent plus que l'encaissement (TPE / SoftPOS
// / QR Code) : l'extension "nouveau canal e-commerce" a ete retiree, quel que
// soit le type d'affiliation d'origine du commercant (y compris un
// commercant deja affilie e-commerce, qui ne peut plus demander de canal
// e-commerce supplementaire ici — seul un encaissement peut etre ajoute).
const ENCAISSEMENT_PRODUCTS = [{ value:'TPE', label:'TPE' },{ value:'SOFTPOS', label:'SoftPOS' }];
const PRODUCTS  = ENCAISSEMENT_PRODUCTS;
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
function createForm(): CommercantPdvProductRequest {
  return { nom:'', adresse:'', ville:'', quartier:'', codePostal:'', telephone:'', email:'', typeAffiliation: 'TPE', nombreTpe:'1', equipementTpe:'', connectiviteTpe:'', modeMiseADispositionTpe:'', modeleQrSoftpos:'', nombreQrSoftpos:'', modeServiceEcommerce:'', siteMarchandUrl:'', applicationMobile:'', latitude: null, longitude: null, existingPdvId: null };
}

function extractError(err: unknown): string {
  const e = err as { response?: { data?: { message?: string; error?: string } } };
  return e?.response?.data?.message || e?.response?.data?.error || 'Impossible d\'envoyer la demande.';
}

export default function CommercantPdvRequestPage() {
  const { session } = useSessionStore();
  const isMerchantAccount = session?.role === 'COMMERCANT';
  // L'extension "nouveau canal e-commerce" est retiree : un commercant
  // e-commerce (pur, ou bascule sur l'espace E-commerce d'une affiliation
  // combinee) n'a plus de nouvelle demande a faire — l'extension ne concerne
  // plus que l'encaissement (TPE / SoftPOS), reserve aux comptes encaissement.
  // L'entree "Nouvelle demande" est deja masquee du menu pour ces comptes
  // (CommercantDashboard.tsx) ; ce garde-fou couvre un acces direct par URL.
  const isEcommerce = useEffectiveAffiliationType() === 'E_COMMERCE';
  const allowedAffiliationLabel = 'Encaissement';
  const allowedProducts = ENCAISSEMENT_PRODUCTS;

  const [form, setForm]             = useState<CommercantPdvProductRequest>(() => createForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 'new' = ouvrir un nouveau point de vente (comportement historique), 'existing'
  // = ajouter des terminaux sur un PDV deja possede (pas de champs d'adresse a
  // ressaisir).
  const [pdvMode, setPdvMode] = useState<'new' | 'existing'>('new');
  const existingActivePdvs = (session?.pdvs ?? []).filter(
    (p) => (p.statut ?? '').toUpperCase() === 'ACTIF'
  );

  // Contrat de la demande d'extension la plus recente (nouveau PDV/TPE/canal
  // e-commerce) : cote Spring, /contracts/latest resout deja le dossier le
  // plus recent du commercant (peu importe son origineCreation), donc des
  // qu'une extension est soumise elle devient naturellement "la derniere" —
  // voir MerchantContractManagementService::readLatestMerchantDossier.
  const [extensionContract, setExtensionContract] = useState<CommercantContractOverview | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [isVerifyingContract, setIsVerifyingContract] = useState(false);
  const [isUploadingContract, setIsUploadingContract] = useState(false);
  const [contractVerifyResult, setContractVerifyResult] = useState<{ signed: boolean; message: string } | null>(null);
  const [contractUploadMessage, setContractUploadMessage] = useState('');
  const [contractUploadError, setContractUploadError] = useState('');
  const [contractLoadError, setContractLoadError] = useState('');

  const loadExtensionContract = useCallback(async () => {
    try {
      const data = await getLatestContract();
      setExtensionContract(EXTENSION_CONTRACT_STATUSES.has(data.dossierStatus) ? data : null);
    } catch {
      // Pas de dossier/contrat pour l'instant — rien a afficher, ce n'est pas
      // une erreur bloquante pour le reste de la page.
      setExtensionContract(null);
    }
  }, []);

  useEffect(() => { void loadExtensionContract(); }, [loadExtensionContract]);

  const canUploadExtensionContract = extensionContract?.dossierStatus === 'CONTRAT_A_SIGNER';

  async function handleViewExtensionContract() {
    const viewTab = window.open('', '_blank');
    try {
      const blob = await downloadLatestContract();
      await openBlobInNewTab(blob, viewTab);
    } catch {
      viewTab?.close();
      setContractLoadError('Ouverture impossible.');
    }
  }

  async function handleDownloadExtensionContract() {
    try {
      const blob = await downloadLatestContract();
      await triggerBlobDownload(blob, extensionContract?.contractFileName || 'contrat.pdf');
    } catch {
      setContractLoadError('Téléchargement impossible.');
    }
  }

  async function handleVerifyExtensionSignature() {
    if (!contractFile) return;
    setIsVerifyingContract(true); setContractVerifyResult(null); setContractUploadError('');
    try {
      const res = await verifyContractSignature(contractFile);
      setContractVerifyResult(res);
    } catch {
      setContractVerifyResult({ signed: false, message: 'Vérification impossible. Veuillez réessayer.' });
    } finally {
      setIsVerifyingContract(false);
    }
  }

  async function handleUploadExtensionContract() {
    if (!contractFile) return;
    setIsUploadingContract(true); setContractUploadError(''); setContractVerifyResult(null);
    try {
      const res = await uploadSignedContract(contractFile);
      setContractUploadMessage(res.message || 'Contrat signé envoyé.');
      setContractFile(null);
      await loadExtensionContract();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setContractUploadError(e?.response?.data?.message || 'Envoi impossible.');
    } finally {
      setIsUploadingContract(false);
    }
  }
  const [attempted, setAttempted]   = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg]     = useState('');
  const [submitted, setSubmitted]   = useState<Array<{ nom:string; ville:string; typeAffiliation:string }>>([]);

  const isTpe      = form.typeAffiliation === 'TPE';
  const isQrSoft   = ['QR_CODE','SOFTPOS'].includes(form.typeAffiliation);
  const useExistingPdv = pdvMode === 'existing';

  useEffect(() => {
    setForm((current) => (
      allowedProducts.some((product) => product.value === current.typeAffiliation)
        ? current
        : createForm()
    ));
  }, [allowedProducts]);

  function firstMissing(): string {
    if (useExistingPdv) {
      if (!form.existingPdvId) return 'Point de vente existant';
    } else {
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
    if (isQrSoft && !form.nombreQrSoftpos) return 'Nombre QR / SoftPOS';
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
      if (key === 'nombreQrSoftpos') {
        let cleanValue = val.replace(/\D+/g, '');
        if (Number.parseInt(cleanValue, 10) > MAX_TPE) cleanValue = String(MAX_TPE);
        return { ...f, nombreQrSoftpos: cleanValue };
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
        nombreQrSoftpos: '',
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
    // existingPdvId n'a de sens que dans ce mode : on l'efface sinon, meme si
    // un choix precedent trainait dans le state, pour ne jamais l'envoyer par
    // erreur avec une demande de nouveau PDV.
    const snapshot = { ...form, existingPdvId: useExistingPdv ? form.existingPdvId : null };
    try {
      const res = await requestNewPdvProduct(snapshot);
      setSuccessMsg(res.message);
      const selectedExistingPdv = useExistingPdv
        ? existingActivePdvs.find((p) => p.id === snapshot.existingPdvId)
        : undefined;
      const label = selectedExistingPdv?.nom || snapshot.nom;
      const villeLabel = selectedExistingPdv?.ville || snapshot.ville;
      setSubmitted((s) => [{ nom: label, ville: villeLabel, typeAffiliation: PRODUCTS.find((p) => p.value === snapshot.typeAffiliation)?.label ?? snapshot.typeAffiliation }, ...s]);
      setForm(createForm());
      setPdvMode('new');
      setAttempted(false);
      await loadExtensionContract();
    } catch (err) { setErrorMsg(extractError(err)); }
    finally { setIsSubmitting(false); }
  }

  function setPosition(latitude: number, longitude: number) {
    setForm((f) => ({ ...f, latitude, longitude }));
  }

  function req(key: keyof CommercantPdvProductRequest): boolean {
    if (!attempted) return false;
    if (useExistingPdv && ['nom','adresse','ville','telephone'].includes(key)) return false;
    if (useExistingPdv && key === 'existingPdvId') return !form.existingPdvId;
    if (['nom','adresse','ville','telephone','typeAffiliation'].includes(key)) return !String(form[key]).trim();
    if (isTpe    && key === 'nombreTpe')         return !form.nombreTpe;
    if (isTpe    && key === 'equipementTpe')     return !form.equipementTpe;
    if (isTpe    && key === 'connectiviteTpe')   return !form.connectiviteTpe;
    if (isQrSoft && key === 'modeleQrSoftpos')   return !form.modeleQrSoftpos;
    if (isQrSoft && key === 'nombreQrSoftpos')   return !form.nombreQrSoftpos;
    return false;
  }

  const pendingPdvs = (session?.pdvs ?? []).filter((p) => (p.statut ?? '').toUpperCase() === 'EN_VERIFICATION');

  return (
    <div className="co-page">
      <div className="co-page-head">
        <div>
          <span className="co-page-kicker">Expansion</span>
          <h2>Nouvelle demande</h2>
          <p>Ajoutez une extension pour votre affiliation {allowedAffiliationLabel}.</p>
        </div>
      </div>

      {!isMerchantAccount && (
        <div className="co-page-alert is-warning">
          <span className="material-icons">info</span>{' '}
          Cette page est disponible uniquement pour le compte commerçant principal.
        </div>
      )}

      {isMerchantAccount && isEcommerce && (
        <div className="co-page-alert is-warning">
          <span className="material-icons">info</span>{' '}
          Aucune nouvelle demande n'est disponible pour un compte e-commerce : l'extension est réservée à l'encaissement (TPE, SoftPOS, QR Code).
        </div>
      )}

      {isMerchantAccount && !isEcommerce && (
        <form className="pdv-req-form" onSubmit={handleSubmit} noValidate>

          <section className="pdv-req-section">
            <div className="pdv-req-section-head">
              <span className="material-icons">storefront</span>
              <div>
                <h3>Point de vente</h3>
                <p>Choisissez : ouvrir un nouveau point de vente équipé de TPE, ou ajouter uniquement des TPE à un point de vente que vous avez déjà.</p>
              </div>
            </div>

            <div style={{ padding: '16px 18px 0' }}>
              <div className="product-selector" style={{ marginBottom: '10px' }}>
                <button
                  type="button"
                  className={`product-btn${pdvMode === 'new' ? ' is-active' : ''}`}
                  onClick={() => setPdvMode('new')}
                  disabled={isSubmitting}
                >
                  Nouveau PDV + TPE
                </button>
                <button
                  type="button"
                  className={`product-btn${pdvMode === 'existing' ? ' is-active' : ''}`}
                  onClick={() => setPdvMode('existing')}
                  disabled={isSubmitting || existingActivePdvs.length === 0}
                >
                  PDV existant, juste des TPE
                </button>
              </div>

              <p style={{ margin: '0 0 4px', fontSize: '11.5px', color: '#64748B' }}>
                {useExistingPdv
                  ? 'Aucune adresse à ressaisir : sélectionnez le point de vente déjà actif sur votre compte, seuls le nombre et le type de TPE sont demandés.'
                  : 'Renseignez les informations complètes du nouveau point de vente, ainsi que les TPE qui y seront installés.'}
              </p>
            </div>

            {useExistingPdv ? (
              existingActivePdvs.length === 0 ? (
                <p className="co-hint-error" style={{ margin: 0 }}>
                  Aucun point de vente actif trouvé sur votre compte.
                </p>
              ) : (
                <div className="pdv-req-grid">
                  <label className={`co-field field-full${req('existingPdvId') ? ' is-invalid' : ''}`}>
                    <span>Point de vente *</span>
                    <select
                      value={form.existingPdvId ?? ''}
                      disabled={isSubmitting}
                      onChange={(e) => setForm((f) => ({ ...f, existingPdvId: e.target.value ? Number(e.target.value) : null }))}
                    >
                      <option value="">Sélectionner un point de vente</option>
                      {existingActivePdvs.map((p) => (
                        <option key={p.id} value={p.id}>{p.nom} — {p.ville}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )
            ) : (
            <>
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
              {/* <span> plutot que <label> (Sonar S6853) : PdvLocationPicker
                  n'est pas un unique champ de formulaire associable. */}
              <span className="field-caption">Emplacement sur la carte</span>
              <PdvLocationPicker
                ville={form.ville}
                latitude={form.latitude}
                longitude={form.longitude}
                disabled={isSubmitting}
                onChange={setPosition}
              />
            </div>
            </>
            )}
          </section>

          {/* Section Produit */}
          <section className="pdv-req-section">
            <div className="pdv-req-section-head">
              <span className="material-icons">devices</span>
              <div><h3>{allowedAffiliationLabel}</h3><p>Choisissez le design d’encaissement: TPE ou SoftPOS.</p></div>
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
                <>
                  <label className={`co-field${req('modeleQrSoftpos') ? ' is-invalid' : ''}`}>
                    <span>Modèle *</span>
                    <select value={form.modeleQrSoftpos} disabled={isSubmitting} onChange={(e) => setField('modeleQrSoftpos', e.target.value)}>
                      <option value="">Sélectionner</option>
                      {resolveQrSoftposOptions(form.typeAffiliation).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <label className={`co-field${req('nombreQrSoftpos') ? ' is-invalid' : ''}`}>
                    <span>Nombre *</span>
                    <input type="number" min={1} max={MAX_TPE} value={form.nombreQrSoftpos} disabled={isSubmitting} onChange={(e) => setField('nombreQrSoftpos', e.target.value)} />
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

      {/* Contrat de la demande d'extension en cours — genere par le back
          office une fois la demande validee, a signer et redeposer ici,
          exactement comme pour l'affiliation initiale (CommercantRequestStatusPage). */}
      {extensionContract && (
        <section className="content-card contract-card">
          <div className="card-head contract-head">
            <div>
              <h2>Contrat de votre demande</h2>
              <p>Dossier #{String(extensionContract.dossierId).padStart(4, '0')}</p>
            </div>
            <div className="contract-meta">
              {extensionContract.contractGeneratedAt && <span>Généré: {extensionContract.contractGeneratedAt}</span>}
              <span>Signé: {extensionContract.signedContractUploadedAt || 'Non déposé'}</span>
            </div>
          </div>

          <div className="contract-status-row">
            <span className={`contract-status-pill ${extensionContract.dossierStatus === 'ABANDONNE' ? 'tone-danger' : 'tone-progress'}`}>
              {formatDossierStatusLabel(extensionContract.dossierStatus)}
            </span>
            {extensionContract.contractDisponible && <span className="contract-helper">Ouvrez ou imprimez votre contrat directement depuis ce bloc.</span>}
          </div>

          {extensionContract.dossierStatus === 'ABANDONNE' && (
            <div className="alert-box danger">
              <strong>Demande abandonnée</strong>
              <span>Contactez votre conseiller commercial pour connaître le motif.</span>
            </div>
          )}

          {contractLoadError && <p className="co-hint-error">{contractLoadError}</p>}

          {extensionContract.contractDisponible ? (
            <div className="contract-actions">
              <button className="ghost-btn" type="button" onClick={handleViewExtensionContract}>Voir</button>
              <button className="ghost-btn" type="button" onClick={handleDownloadExtensionContract}>Télécharger</button>
              <button className="ghost-btn" type="button" onClick={() => window.print()}>Imprimer</button>
            </div>
          ) : (
            <div className="contract-empty">Contrat non disponible pour le moment — en attente de validation par le back office.</div>
          )}

          {extensionContract.contractDisponible && canUploadExtensionContract && (
            <div className="contract-upload">
              <label className="upload-field">
                <span>Déposer le contrat signé</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => { setContractFile(e.target.files?.[0] ?? null); setContractUploadError(''); setContractVerifyResult(null); }}
                />
              </label>
              <div className="upload-actions">
                <span>{contractFile?.name || extensionContract.signedContractFileName || 'Aucun fichier'}</span>
                <button className="ghost-btn" type="button" disabled={!contractFile || isVerifyingContract || isUploadingContract} onClick={handleVerifyExtensionSignature}>
                  {isVerifyingContract ? 'Vérification...' : 'Vérifier la signature'}
                </button>
                <button className="primary-btn" type="button" disabled={!contractFile || isUploadingContract || isVerifyingContract} onClick={handleUploadExtensionContract}>
                  {isUploadingContract ? 'Envoi en cours...' : 'Envoyer'}
                </button>
              </div>
              {contractVerifyResult && (
                <div className={`upload-error-banner${contractVerifyResult.signed ? ' upload-success-banner' : ''}`} role="alert">
                  <span>{contractVerifyResult.message}</span>
                </div>
              )}
              {contractUploadError && (
                <div className="upload-error-banner" role="alert">
                  <span>{contractUploadError}</span>
                </div>
              )}
            </div>
          )}

          {contractUploadMessage && <p className="page-text" style={{ color: '#027a48', fontSize: '12px' }}>{contractUploadMessage}</p>}
        </section>
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
