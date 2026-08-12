import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../../../../store/sessionStore';
import { getLatestContract, downloadLatestContract, uploadSignedContract, verifyContractSignature, CommercantContractOverview } from '../../services/commercantApi';
import { openBlobInNewTab, triggerBlobDownload } from '../../../../core/browserDownload';
import './CommercantRequestStatusPage.scss';

type StepState = 'done' | 'current' | 'pending' | 'danger';

interface TimelineStep {
  label: string;
  caption: string;
  tag: string;
  state: StepState;
}

function resolveTimelineSteps(status: string, contractInfo: CommercantContractOverview | null): TimelineStep[] {
  const signedContractReceived = !!contractInfo?.signedContractDisponible;
  const contractReady = !!contractInfo?.contractDisponible
    || ['CONTRAT_A_SIGNER', 'ACCEPTE', 'ABANDONNE'].includes(status);
  const createdState: StepState = 'done';
  const submittedState: StepState = ['', 'BROUILLON'].includes(status) ? 'current' : 'done';
  let instructionState: StepState = 'pending';
  let contractState: StepState = 'pending';
  let activationState: StepState = 'pending';

  if (['SOUMIS', 'INCOMPLET', 'EN_ATTENTE_VALIDATION_BOA'].includes(status)) {
    instructionState = status === 'INCOMPLET' ? 'danger' : 'current';
  } else if (contractReady || status === 'ACCEPTE' || status === 'ABANDONNE') {
    instructionState = 'done';
  }

  if (contractReady) {
    contractState = status === 'ABANDONNE' ? 'danger' : 'done';
  }

  if (status === 'ACCEPTE') activationState = 'done';
  else if (status === 'ABANDONNE') activationState = 'danger';
  else if (status === 'CONTRAT_A_SIGNER' || signedContractReceived) activationState = 'current';

  return [
    { label: 'Création du compte', caption: 'Compte commerçant créé et accès à l\'espace activé.', tag: 'Terminé', state: createdState },
    { label: 'Dépôt du dossier', caption: 'Informations d\'affiliation enregistrées sur la plateforme.', tag: submittedState === 'done' ? 'Terminé' : 'En cours', state: submittedState },
    {
      label: 'Instruction et vérification',
      caption: status === 'INCOMPLET' ? 'Un complément est attendu avant nouvelle validation.' : 'Votre dossier est examiné par l\'équipe commerciale.',
      tag: instructionState === 'done' ? 'Terminé' : instructionState === 'danger' ? 'Action requise' : `En cours${contractInfo?.commercialAttribue ? ` - ${contractInfo.commercialAttribue}` : ''}`,
      state: instructionState
    },
    { label: 'Génération du contrat', caption: 'Le contrat d\'affiliation est préparé avant signature.', tag: contractState === 'done' ? (contractInfo?.contractGeneratedAt || 'Terminé') : contractState === 'danger' ? 'Suspendu' : 'À venir', state: contractState },
    { label: 'Signature et activation', caption: status === 'ACCEPTE' ? 'Contrat validé et espace commerçant activé.' : status === 'ABANDONNE' ? 'Votre demande a été abandonnée. Consultez le motif.' : 'Déposez votre contrat signé pour finaliser l\'affiliation.', tag: activationState === 'done' ? 'Activé' : activationState === 'danger' ? 'Abandonné' : 'À venir', state: activationState }
  ];
}

function progressPercent(status: string): number {
  switch (status) {
    case 'SOUMIS': case 'INCOMPLET': case 'EN_ATTENTE_VALIDATION_BOA': return 40;
    case 'CONTRAT_A_SIGNER': case 'ABANDONNE': return 60;
    case 'ACCEPTE': return 100;
    default: return 20;
  }
}

function statusToneClass(status: string): string {
  switch (status) {
    case 'ACCEPTE': return 'tone-active';
    case 'ABANDONNE': return 'tone-danger';
    case 'CONTRAT_A_SIGNER': return 'tone-progress';
    default: return 'tone-info';
  }
}

function formatDossierStatus(status: string): string {
  const map: Record<string, string> = {
    BROUILLON: 'Brouillon', EN_ATTENTE_ASSIGNATION: "En attente d'assignation", SOUMIS: 'Soumis', INCOMPLET: 'Complément demandé',
    EN_ATTENTE_VALIDATION_BOA: 'En attente de validation back-office',
    CONTRAT_A_SIGNER: 'Contrat à signer',
    ACCEPTE: 'Accepté', ABANDONNE: 'Abandonné',
  };
  return map[status] || status;
}

export default function CommercantRequestStatusPage() {
  const { session } = useSessionStore();
  const [contractInfo, setContractInfo] = useState<CommercantContractOverview | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [contractMessage, setContractMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [verifyResult, setVerifyResult] = useState<{ signed: boolean; message: string } | null>(null);

  useEffect(() => { loadContract(); }, []);

  async function loadContract() {
    try { const data = await getLatestContract(); setContractInfo(data); } catch { /* no contract yet */ }
  }

  const currentStatus = contractInfo?.dossierStatus || session?.dossierStatus || '';
  const steps = resolveTimelineSteps(currentStatus, contractInfo);
  const currentStep = steps.find((s) => s.state === 'current' || s.state === 'danger') ?? steps[steps.length - 1];
  const progress = progressPercent(currentStatus);
  const refusalReason = session?.dossierMotifRefus || '';
  const dossierReference = `DOS-${String(contractInfo?.dossierId ?? session?.commercantId ?? 0).padStart(4, '0')}`;
  const canUpload = currentStatus === 'CONTRAT_A_SIGNER';
  const displayContract: CommercantContractOverview = contractInfo ?? { dossierId: 0, dossierStatus: currentStatus, contractDisponible: false, contractFileName: '', contractGeneratedAt: null, signedContractDisponible: false, signedContractFileName: '', signedContractUploadedAt: null, commercialAttribue: '' };

  async function handleDownloadContract() {
    try {
      const blob = await downloadLatestContract();
      await triggerBlobDownload(blob, displayContract.contractFileName || 'contrat.pdf');
    } catch {
      setErrorMessage('Téléchargement impossible.');
    }
  }

  async function handleViewContract() {
    // Open the tab synchronously (before the await) so browsers don't treat it
    // as an unrequested popup.
    const viewTab = window.open('', '_blank');
    try {
      const blob = await downloadLatestContract();
      await openBlobInNewTab(blob, viewTab);
    } catch {
      viewTab?.close();
      setErrorMessage('Ouverture impossible.');
    }
  }

  async function handleVerifySignature() {
    if (!selectedFile) return;
    setIsVerifying(true); setVerifyResult(null); setUploadError('');
    try {
      const res = await verifyContractSignature(selectedFile);
      setVerifyResult(res);
    } catch {
      setVerifyResult({ signed: false, message: 'Vérification impossible. Veuillez réessayer.' });
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleUploadSignedContract() {
    if (!selectedFile) return;
    setIsUploading(true); setErrorMessage(''); setUploadError(''); setVerifyResult(null);
    try {
      const res = await uploadSignedContract(selectedFile);
      setContractMessage(res.message || 'Contrat signé envoyé.');
      setUploadError('');
      setSelectedFile(null);
      await loadContract();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      const msg = e?.response?.data?.message || 'Envoi impossible.';
      setUploadError(msg);
      setErrorMessage('');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="request-status-layout commercant-page">
      {errorMessage && <div className="page-alert error" role="alert" style={{ margin: '0 0 12px' }}>{errorMessage}</div>}

      <section className="content-card request-status-card">
        <div className="card-head card-head--compact">
          <div>
            <h2>Progression de la demande</h2>
            <p>{currentStep?.label ?? 'Création du compte'}</p>
          </div>
        </div>

        <div className="where-now">
          <svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
          <span>{currentStep?.caption ?? 'Votre dossier est en cours de préparation.'}</span>
        </div>

        <div>
          <div className="progress-header">
            <h3>Avancement global</h3>
            <span className="progress-pct">{progress}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="steps-timeline steps-timeline--compact">
          {steps.map((step, idx) => (
            <div key={idx} className={`step-row is-${step.state}`}>
              <div className="step-rail">
                <div className="step-dot">
                  {step.state === 'done' ? (
                    <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                  )}
                </div>
                {idx < steps.length - 1 && <div className="step-line" />}
              </div>
              <div className="step-body">
                <div className="step-title">{step.label}</div>
                <span className="step-tag">{step.tag}</span>
              </div>
            </div>
          ))}
        </div>

        {refusalReason && (
          <div className="alert-box danger">
            <strong>Motif de refus</strong>
            <span>{refusalReason}</span>
          </div>
        )}
      </section>

      <section className="content-card contract-card contract-card--priority">
        <div className="card-head contract-head">
          <div>
            <h2>Contrat d'affiliation</h2>
            <p>Dossier #{dossierReference}</p>
          </div>
          <div className="contract-meta">
            {displayContract.commercialAttribue && <span>Commerciale: {displayContract.commercialAttribue}</span>}
            {displayContract.contractGeneratedAt && <span>Généré: {displayContract.contractGeneratedAt}</span>}
            <span>Signé: {displayContract.signedContractUploadedAt || 'Non déposé'}</span>
          </div>
        </div>

        <div className="contract-status-row">
          <span className={`contract-status-pill ${statusToneClass(currentStatus)}`}>{formatDossierStatus(currentStatus)}</span>
          {displayContract.contractDisponible && <span className="contract-helper">Ouvrez ou imprimez votre contrat directement depuis ce bloc.</span>}
        </div>

        {displayContract.contractDisponible ? (
          <div className="contract-actions">
            <button className="ghost-btn" type="button" onClick={handleViewContract}>Voir</button>
            <button className="ghost-btn" type="button" onClick={handleDownloadContract}>Télécharger</button>
            <button className="ghost-btn" type="button" onClick={() => window.print()}>Imprimer</button>
          </div>
        ) : (
          <div className="contract-empty">Contrat non disponible pour le moment</div>
        )}

        {displayContract.contractDisponible && canUpload && (
          <div className="contract-upload">
            <label className="upload-field">
              <span>Déposer le contrat signé</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => { setSelectedFile(e.target.files?.[0] ?? null); setUploadError(''); setVerifyResult(null); }}
              />
            </label>
            <div className="upload-actions">
              <span>{selectedFile?.name || displayContract.signedContractFileName || 'Aucun fichier'}</span>
              <button className="ghost-btn" type="button" disabled={!selectedFile || isVerifying || isUploading} onClick={handleVerifySignature}>
                {isVerifying ? 'Vérification...' : 'Vérifier la signature'}
              </button>
              <button className="primary-btn" type="button" disabled={!selectedFile || isUploading || isVerifying} onClick={handleUploadSignedContract}>
                {isUploading ? 'Envoi en cours...' : 'Envoyer'}
              </button>
            </div>
            {verifyResult && (
              <div className={`upload-error-banner${verifyResult.signed ? ' upload-success-banner' : ''}`} role="alert">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style={{ flexShrink: 0 }}>
                  {verifyResult.signed
                    ? <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    : <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />}
                </svg>
                <span>{verifyResult.message}</span>
              </div>
            )}
            {uploadError && (
              <div className="upload-error-banner" role="alert">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        )}

        {displayContract.contractDisponible && !canUpload && (
          <div className="info-banner">
            {currentStatus === 'ACCEPTE' ? 'Dossier accepté. Espace ouvert.' : currentStatus === 'ABANDONNE' ? 'Dossier abandonné. Voir le motif.' : 'Contrat signé en cours de vérification.'}
          </div>
        )}

        {contractMessage && <p className="page-text" style={{ color: '#027a48', fontSize: '12px' }}>{contractMessage}</p>}
      </section>
    </div>
  );
}
