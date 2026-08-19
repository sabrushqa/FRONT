import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSessionStore } from '../../../../store/sessionStore';
import { triggerBlobDownload } from '../../../../core/browserDownload';
import {
  AffiliationActivationPayload,
  AffiliationDocumentItem,
  AffiliationRequestItem,
  completeAffiliationRequest,
  downloadAffiliationDocument,
  downloadFullDossier as apiDownloadFullDossier,
  downloadGeneratedContract as apiDownloadGeneratedContract,
  downloadSignedContract as apiDownloadSignedContract,
  forwardAffiliationToBackOffice,
  getAffiliationRequests,
  reviewAffiliationRequest
} from '../../services/supervisorApi';
import {
  AFFILIATION_PACKAGE_OPTIONS,
  createAffiliationActivationPayload,
  createAffiliationActivationPayloadFromRequest,
  extractApiErrorMessage,
  firstMeaningful,
  formatEnumLabel,
  getAffiliationStatusLabel,
  getAffiliationStatusTone,
  isMeaningfulValue
} from '../../services/supervisorUiUtils';
import '../../../../styles/page.shared.scss';
import '../../../../styles/dossier-detail.scss';
import '../../../../styles/supervisor-affiliation-detail.scss';
import SubmitOverlay from '../../../workspace/SubmitOverlay';
import CorrectionMultiSelect from '../../../commercial/components/CorrectionMultiSelect';
import {
  CORRECTION_CATEGORY_OPTIONS,
  CORRECTION_DOCUMENT_OPTIONS,
  CORRECTION_FIELD_OPTIONS,
  serializeCorrectionRequest,
  summarizeCorrectionRequest
} from '../../../commercial/services/correctionRequestUtils';

interface DetailRow {
  label: string;
  value: string;
}

function filterRows(rows: DetailRow[]): DetailRow[] {
  return rows.filter((row) => isMeaningfulValue(row.value));
}

function formatBooleanValue(value: boolean): string {
  return value ? 'Oui' : 'Non';
}

async function resolveDownloadErrorMessage(error: unknown, fallback: string): Promise<string> {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    try {
      const rawText = (await data.text()).trim();
      if (rawText) {
        try {
          const parsed = JSON.parse(rawText) as { message?: string };
          if (typeof parsed.message === 'string' && parsed.message.trim()) {
            return parsed.message.trim();
          }
        } catch {
          return rawText;
        }
      }
    } catch {
      return fallback;
    }
  }
  return extractApiErrorMessage(error, fallback);
}

export default function SupervisorAffiliationDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ dossierId: string }>();
  const [searchParams] = useSearchParams();
  const { session } = useSessionStore();

  const [requestItem, setRequestItem] = useState<AffiliationRequestItem | null>(null);
  const [form, setForm] = useState<AffiliationActivationPayload>(createAffiliationActivationPayload());
  const [reviewMotif, setReviewMotif] = useState('');
  const [reviewCategories, setReviewCategories] = useState<string[]>([]);
  const [reviewFields, setReviewFields] = useState<string[]>([]);
  const [reviewDocuments, setReviewDocuments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isDownloadingFullDossier, setIsDownloadingFullDossier] = useState(false);
  const [isPrintingDossier, setIsPrintingDossier] = useState(false);
  const [activeTab, setActiveTab] = useState<'apercu' | 'configuration' | 'suivi' | 'contrat'>('apercu');

  const role = session?.role ?? '';
  const hasAccess = role === 'SUPERVISEUR' || role === 'COMMERCIAL' || role === 'BACK_OFFICE';
  const isCommercialRole = role === 'COMMERCIAL';
  const isBackOfficeRole = role === 'BACK_OFFICE';
  const canDownloadDossierDocuments = hasAccess;
  const isAutoAffiliationRequest = requestItem?.origineCreation === 'AUTO_AFFILIATION';
  const isCommercialDirectRequest = requestItem?.origineCreation === 'COMMERCIAL_DIRECT';

  const requestedMode: 'view' | 'edit' = searchParams.get('mode') === 'edit' ? 'edit' : 'view';

  const dossierId = Number(params.dossierId);

  const canEditRequest = isCommercialRole && !!requestItem && requestItem.status === 'SOUMIS';
  const canForwardToBackOffice =
    isCommercialRole && !!requestItem && requestItem.status === 'ACCEPTE';
  const canReviewRequest =
    isBackOfficeRole && !!requestItem && requestItem.status === 'EN_ATTENTE_VALIDATION_BOA';

  const mode: 'view' | 'edit' =
    requestItem?.compteActif || !canEditRequest ? 'view' : requestedMode;

  const dossiersRoute = isCommercialRole ? '/commercial/dossiers' : '/supervisor/affiliation-requests';

  // ENCAISSEMENT_ET_ECOMMERCE exige a la fois les champs TPE et e-commerce
  // cote backend (StaffAffiliationManagementService::applyNegotiableFields) :
  // meme correctif que CommercialDossierDetailPage.tsx.
  const isTpeRequest =
    requestItem?.typeAffiliation === 'TPE' || requestItem?.typeAffiliation === 'ENCAISSEMENT_ET_ECOMMERCE';
  const isEcommerceRequest =
    requestItem?.typeAffiliation === 'E_COMMERCE' || requestItem?.typeAffiliation === 'ENCAISSEMENT_ET_ECOMMERCE';
  const isQrSoftposRequest =
    requestItem?.typeAffiliation === 'SOFTPOS' || requestItem?.typeAffiliation === 'QR_CODE';

  const loadRequest = useCallback(
    async (id: number, resetMessages = true) => {
      if (!hasAccess) {
        setIsLoading(false);
        return;
      }
      if (resetMessages) {
        setErrorMessage('');
        setSuccessMessage('');
      }
      setIsLoading(true);
      try {
        const response = await getAffiliationRequests();
        const matched = response.requests.find((r) => r.dossierId === id);
        if (!matched) {
          if (resetMessages) {
            setRequestItem(null);
            setErrorMessage("Le dossier demandé n'existe pas ou n'est plus disponible.");
          }
          return;
        }
        setRequestItem(matched);
        setForm(createAffiliationActivationPayloadFromRequest(matched));
        setReviewMotif(matched.motifRefus || '');
      } catch {
        setRequestItem(null);
        setErrorMessage('Impossible de charger le détail du dossier.');
      } finally {
        setIsLoading(false);
      }
    },
    [hasAccess]
  );

  useEffect(() => {
    if (!Number.isFinite(dossierId)) {
      setIsLoading(false);
      setErrorMessage('Identifiant de dossier invalide.');
      return;
    }
    void loadRequest(dossierId);
  }, [dossierId, loadRequest]);

  const documents = requestItem?.documents ?? [];

  const identityRows = useMemo<DetailRow[]>(() => {
    if (!requestItem) return [];
    return filterRows([
      { label: 'Nom commerçant', value: firstMeaningful(requestItem.nomCommercant) },
      { label: 'Type commerçant', value: formatEnumLabel(requestItem.typeCommercant) },
      { label: 'Activité', value: firstMeaningful(requestItem.activite) },
      { label: 'Secteur', value: firstMeaningful(requestItem.secteur) },
      { label: 'MCC', value: firstMeaningful(requestItem.mcc) },
      { label: 'Chaîne point de vente', value: firstMeaningful(requestItem.chainePointVente) },
      { label: 'Nombre points de vente', value: firstMeaningful(requestItem.nombrePointsVente) },
      { label: "Nombre de demandes d'extension", value: firstMeaningful(requestItem.nombreDemandesExtention) }
    ]);
  }, [requestItem]);

  const dossierRows = useMemo<DetailRow[]>(() => {
    if (!requestItem) return [];
    return filterRows([
      { label: 'Type affiliation', value: formatEnumLabel(requestItem.typeAffiliation) },
      { label: 'Statut', value: getAffiliationStatusLabel(requestItem) },
      { label: 'Date soumission', value: firstMeaningful(requestItem.dateSoumission) },
      { label: 'RIB', value: firstMeaningful(requestItem.rib) },
      { label: 'Compte actif', value: formatBooleanValue(requestItem.compteActif) },
      { label: 'E-mail activation envoyé', value: formatBooleanValue(requestItem.activationEmailSent) }
    ]);
  }, [requestItem]);

  const merchantProfileRows = useMemo<DetailRow[]>(() => {
    if (!requestItem) return [];
    switch (requestItem.typeCommercant) {
      case 'PERSONNE_PHYSIQUE':
        return filterRows([
          { label: 'Nom', value: firstMeaningful(requestItem.nom) },
          { label: 'Prénom', value: firstMeaningful(requestItem.prenom) },
          { label: 'CIN', value: firstMeaningful(requestItem.cin) }
        ]);
      case 'PERSONNE_MORALE':
        return filterRows([
          { label: 'Raison sociale', value: firstMeaningful(requestItem.raisonSociale) },
          { label: 'RC', value: firstMeaningful(requestItem.rc) },
          { label: 'ICE', value: firstMeaningful(requestItem.ice) },
          { label: 'Forme juridique', value: firstMeaningful(requestItem.formeJuridique) },
          { label: 'Représentant légal', value: firstMeaningful(requestItem.representantLegal) }
        ]);
      case 'AUTO_ENTREPRENEUR':
        return filterRows([
          { label: 'Nom', value: firstMeaningful(requestItem.nom) },
          { label: 'Prénom', value: firstMeaningful(requestItem.prenom) },
          { label: 'Numéro auto-entrepreneur', value: firstMeaningful(requestItem.numeroAutoEntrepreneur) }
        ]);
      case 'ASSOCIATION_FONDATION':
        return filterRows([
          { label: 'Nom entité', value: firstMeaningful(requestItem.nomEntite) },
          { label: 'Représentant légal', value: firstMeaningful(requestItem.representantLegal) },
          { label: 'Objet', value: firstMeaningful(requestItem.objet) }
        ]);
      default:
        return [];
    }
  }, [requestItem]);

  const contactRows = useMemo<DetailRow[]>(() => {
    if (!requestItem) return [];
    return filterRows([
      { label: 'E-mail', value: firstMeaningful(requestItem.email) },
      { label: 'Téléphone principal', value: firstMeaningful(requestItem.telephone) },
      { label: 'Téléphone secondaire', value: firstMeaningful(requestItem.telephoneSecondaire) },
      { label: 'Adresse', value: firstMeaningful(requestItem.adresse) },
      { label: 'Ville', value: firstMeaningful(requestItem.ville) },
      { label: 'Région', value: firstMeaningful(requestItem.region) }
    ]);
  }, [requestItem]);

  const configurationRows = useMemo<DetailRow[]>(() => {
    if (!requestItem) return [];
    const rows: DetailRow[] = [];
    if (isTpeRequest) {
      rows.push(
        { label: 'Mode de mise à disposition', value: firstMeaningful(requestItem.modeMiseADispositionTpe) },
        { label: 'Équipement', value: firstMeaningful(requestItem.equipementTpe) },
        { label: 'Connectivité', value: firstMeaningful(requestItem.connectiviteTpe) },
        { label: 'Nombre TPE', value: firstMeaningful(requestItem.nombreTpe) }
      );
    }
    if (isEcommerceRequest) {
      rows.push(
        { label: 'Mode service', value: firstMeaningful(requestItem.modeServiceEcommerce) },
        { label: 'Site marchand', value: firstMeaningful(requestItem.siteMarchandUrl) },
        { label: 'Application mobile', value: firstMeaningful(requestItem.applicationMobile) }
      );
    }
    if (!isTpeRequest && !isEcommerceRequest) {
      rows.push(
        { label: 'Modèle QR / SoftPOS', value: firstMeaningful(requestItem.modeleQrSoftpos) },
        { label: 'Nombre QR / SoftPOS', value: firstMeaningful(requestItem.nombreQrSoftpos) }
      );
    }
    return filterRows(rows);
  }, [requestItem, isTpeRequest, isEcommerceRequest]);

  const negotiableRows = useMemo<DetailRow[]>(() => {
    if (!requestItem) return [];
    const rows: DetailRow[] = [];
    if (isTpeRequest) {
      rows.push(
        { label: 'Commission locale TPE', value: firstMeaningful(requestItem.commissionLocaleTpe) },
        { label: 'Commission étrangère TPE', value: firstMeaningful(requestItem.commissionEtrangereTpe) },
        { label: 'Dépôt', value: firstMeaningful(requestItem.depotTpe) },
        { label: 'Prix achat', value: firstMeaningful(requestItem.prixAchatTpe) },
        { label: 'Prix licence', value: firstMeaningful(requestItem.prixLicenceTpe) },
        { label: 'Abonnement', value: firstMeaningful(requestItem.abonnementPackage) }
      );
    }
    if (isEcommerceRequest) {
      rows.push(
        { label: 'Commission locale e-commerce', value: firstMeaningful(requestItem.commissionLocaleEcommerce) },
        { label: 'Commission étrangère e-commerce', value: firstMeaningful(requestItem.commissionEtrangereEcommerce) },
        { label: 'Frais de mise en service', value: firstMeaningful(requestItem.fraisMiseEnServiceEcommerce) }
      );
    }
    if (!isTpeRequest && !isEcommerceRequest) {
      rows.push(
        { label: 'Commission locale', value: firstMeaningful(requestItem.commissionLocaleQrSoftpos) },
        { label: 'Commission étrangère', value: firstMeaningful(requestItem.commissionEtrangereQrSoftpos) },
        { label: 'Frais service', value: firstMeaningful(requestItem.fraisServiceQrSoftpos) },
        { label: 'Abonnement', value: firstMeaningful(requestItem.abonnementPackage) },
        { label: 'Conditions', value: firstMeaningful(requestItem.conditionsQrSoftpos) }
      );
    }
    return filterRows(rows);
  }, [requestItem, isTpeRequest, isEcommerceRequest]);

  const workflowRows = useMemo<DetailRow[]>(() => {
    if (!requestItem) return [];
    return filterRows([
      { label: 'Commerciale', value: firstMeaningful(requestItem.commercialAttribue) },
      { label: 'Back office', value: firstMeaningful(requestItem.backOfficeTraitant) },
      { label: 'Contrat généré', value: firstMeaningful(requestItem.contractGeneratedAt) },
      { label: 'Contrat signé', value: firstMeaningful(requestItem.signedContractUploadedAt) },
      { label: 'Traitement', value: firstMeaningful(requestItem.dateTraitementBackOffice) },
      {
        label: requestItem.status === 'INCOMPLET' ? 'Motif correction' : 'Motif refus',
        value: firstMeaningful(summarizeCorrectionRequest(requestItem.motifRefus))
      },
      {
        label: 'Corrections déjà demandées',
        value: requestItem.nombreCorrections > 0 ? String(requestItem.nombreCorrections) : ''
      },
      {
        label: 'Dernier motif de correction',
        value: !requestItem.motifRefus
          ? firstMeaningful(summarizeCorrectionRequest(requestItem.dernierMotifCorrection))
          : ''
      }
    ]);
  }, [requestItem]);

  const contractRows = useMemo<DetailRow[]>(() => {
    if (!requestItem) return [];
    return filterRows([
      { label: 'Contrat généré', value: firstMeaningful(requestItem.contractFileName) },
      { label: 'Date de génération', value: firstMeaningful(requestItem.contractGeneratedAt) },
      { label: 'Contrat signé', value: firstMeaningful(requestItem.signedContractFileName) },
      { label: 'Date dépôt', value: firstMeaningful(requestItem.signedContractUploadedAt) }
    ]);
  }, [requestItem]);

  const shouldShowContractCard =
    !!requestItem &&
    (requestItem.contractDisponible || requestItem.signedContractDisponible || contractRows.length > 0);

  const headerTitle = requestItem
    ? `#${requestItem.dossierId} - ${requestItem.nomCommercant || requestItem.email}`
    : 'Dossier commerçant';

  const primaryActionLabel = 'Générer le contrat et envoyer l’activation';
  const hasReviewProblemSelection =
    reviewCategories.length > 0 || reviewFields.length > 0 || reviewDocuments.length > 0;
  const hasReviewMotif = Boolean(reviewMotif.trim());
  const hasReviewCorrectionIntent = hasReviewProblemSelection || hasReviewMotif;
  const isReviewCorrectionReady =
    reviewCategories.length > 0 &&
    hasReviewMotif &&
    (!reviewCategories.includes('DOCUMENTS') || reviewDocuments.length > 0) &&
    (!reviewCategories.includes('DONNEES_COMMERCANT') || reviewFields.length > 0) &&
    (!reviewCategories.includes('CONDITIONS_COMMERCIALES') || reviewFields.length > 0) &&
    (!reviewCategories.includes('COMPTE_RENDU') || reviewFields.length > 0);

  function setFormField(field: keyof AffiliationActivationPayload, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function openEditMode() {
    if (!canEditRequest) return;
    navigate(`/supervisor/affiliation-requests/${dossierId}?mode=edit`, { replace: true });
  }

  function openViewMode() {
    navigate(`/supervisor/affiliation-requests/${dossierId}`, { replace: true });
  }

  function backToList() {
    navigate(dossiersRoute);
  }

  async function printDossier() {
    if (!requestItem || isPrintingDossier) return;
    setErrorMessage('');
    setIsPrintingDossier(true);
    try {
      const blob = await apiDownloadFullDossier(requestItem.dossierId);
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setIsPrintingDossier(false);
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 60000);
      };
    } catch (error) {
      setErrorMessage(
        await resolveDownloadErrorMessage(error, "Impossible de préparer le dossier pour l'impression.")
      );
      setIsPrintingDossier(false);
    }
  }

  async function submitActivation(event: React.FormEvent) {
    event.preventDefault();
    if (!requestItem || !canEditRequest || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const response = await completeAffiliationRequest(requestItem.dossierId, form);
      setSuccessMessage(response.message);
      openViewMode();
      await loadRequest(requestItem.dossierId, false);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, 'Impossible de générer le contrat du dossier.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function forwardToBackOffice() {
    if (!requestItem || !canForwardToBackOffice || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const response = await forwardAffiliationToBackOffice(requestItem.dossierId);
      setSuccessMessage(response.message);
      await loadRequest(requestItem.dossierId, false);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, 'Impossible de convertir ce dossier en affiliation.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function buildReviewCorrectionMotif(): string {
    return serializeCorrectionRequest({
      categories: reviewCategories,
      fields: reviewFields,
      documents: reviewDocuments,
      detail: reviewMotif
    });
  }

  async function submitReview(decision: 'ACCEPTE' | 'CORRECTION') {
    if (!requestItem || !canReviewRequest || isSubmitting) return;
    if (decision === 'ACCEPTE' && hasReviewCorrectionIntent) {
      setErrorMessage('Retirez les problèmes et le motif de correction avant de valider le dossier.');
      return;
    }
    if (decision === 'CORRECTION' && !isReviewCorrectionReady) {
      setErrorMessage(
        'Pour demander une correction, choisissez le type de problème, les champs ou documents concernés si nécessaire, puis renseignez le motif.'
      );
      return;
    }
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const response = await reviewAffiliationRequest(requestItem.dossierId, {
        decision,
        motifRefus: decision === 'CORRECTION' ? buildReviewCorrectionMotif() : ''
      });
      setSuccessMessage(response.message);
      setRequestItem((current) =>
        current
          ? {
              ...current,
              status: decision === 'ACCEPTE' ? 'CONTRAT_A_SIGNER' : 'INCOMPLET',
              motifRefus: decision === 'CORRECTION' ? buildReviewCorrectionMotif() : '',
              dateTraitementBackOffice: new Date().toISOString()
            }
          : current
      );
      setReviewMotif('');
      setReviewCategories([]);
      setReviewFields([]);
      setReviewDocuments([]);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, 'Impossible de traiter ce dossier.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function downloadDocument(document: AffiliationDocumentItem) {
    if (!requestItem || !canDownloadDossierDocuments) return;
    if (!document.downloadable) {
      setErrorMessage(
        "Ce document n'a pas été téléversé sur le serveur. Il faut soumettre un nouveau dossier avec les vrais fichiers."
      );
      return;
    }
    setErrorMessage('');
    try {
      const blob = await downloadAffiliationDocument(requestItem.dossierId, document.documentId);
      await triggerBlobDownload(blob, document.fileName || `document-${document.documentId}`);
    } catch (error) {
      setErrorMessage(await resolveDownloadErrorMessage(error, 'Impossible de télécharger le document.'));
    }
  }

  async function downloadGeneratedContract() {
    if (!requestItem?.contractDisponible) return;
    setErrorMessage('');
    try {
      const blob = await apiDownloadGeneratedContract(requestItem.dossierId);
      await triggerBlobDownload(blob, requestItem.contractFileName || `contrat-${requestItem.dossierId}.pdf`);
    } catch (error) {
      setErrorMessage(await resolveDownloadErrorMessage(error, 'Impossible de télécharger le contrat.'));
    }
  }

  async function downloadSignedContract() {
    if (!requestItem?.signedContractDisponible) return;
    setErrorMessage('');
    try {
      const blob = await apiDownloadSignedContract(requestItem.dossierId);
      await triggerBlobDownload(
        blob,
        requestItem.signedContractFileName || `contrat-signé-${requestItem.dossierId}`
      );
    } catch (error) {
      setErrorMessage(await resolveDownloadErrorMessage(error, 'Impossible de télécharger le contrat signé.'));
    }
  }

  async function downloadFullDossier() {
    if (!requestItem) return;
    setErrorMessage('');
    setIsDownloadingFullDossier(true);
    try {
      const blob = await apiDownloadFullDossier(requestItem.dossierId);
      await triggerBlobDownload(blob, `dossier-${requestItem.dossierId}-complet.pdf`);
    } catch (error) {
      setErrorMessage(await resolveDownloadErrorMessage(error, 'Impossible de télécharger le dossier complet.'));
    } finally {
      setIsDownloadingFullDossier(false);
    }
  }

  if (!hasAccess) {
    return (
      <div className="access-card">
        <strong>Accès indisponible</strong>
        <span>Cette page dossier est réservée aux superviseurs, commerciales et back office.</span>
      </div>
    );
  }

  return (
    <>
      <SubmitOverlay
        visible={isSubmitting}
        accent={isBackOfficeRole ? 'pink' : 'yellow'}
        label="Traitement en cours…"
      />

      <div className={`page-grid supervisor-affiliation-detail-page${isCommercialRole ? ' commercial-mode' : ''}`}>
        <div className="page-card dossier-summary-card">
          <div className="page-head">
            <div className="dossier-hero-copy">
              {requestItem && (
                <span className="page-kicker">
                  {isCommercialDirectRequest ? 'Prospection commerciale' : 'Auto-affiliation'}
                </span>
              )}
              <h2>{headerTitle}</h2>
              {requestItem && (
                <div className="dossier-hero-tags" aria-label="Résumé du dossier">
                  <span>{formatEnumLabel(requestItem.typeAffiliation)}</span>
                  <span>{formatEnumLabel(requestItem.typeCommercant)}</span>
                </div>
              )}
            </div>

            <div className="header-actions">
              <button type="button" className="btn-secondary" onClick={backToList}>
                Retour à la liste
              </button>

              {requestItem && mode === 'view' && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isPrintingDossier}
                  onClick={printDossier}
                >
                  {isPrintingDossier ? 'Préparation...' : 'Imprimer le dossier'}
                </button>
              )}

              {requestItem && mode === 'view' && (isAutoAffiliationRequest || isCommercialDirectRequest) && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isDownloadingFullDossier}
                  onClick={downloadFullDossier}
                >
                  {isDownloadingFullDossier ? 'Génération...' : 'Télécharger le dossier complet'}
                </button>
              )}

              {requestItem && canEditRequest && mode === 'view' && (
                <button type="button" className="btn-secondary" onClick={openEditMode}>
                  Compléter et générer le contrat
                </button>
              )}

              {requestItem && canForwardToBackOffice && (
                <button type="button" className="btn-primary" disabled={isSubmitting} onClick={forwardToBackOffice}>
                  {isSubmitting ? 'Envoi...' : 'Convertir en affiliation'}
                </button>
              )}

              {requestItem && canEditRequest && mode === 'edit' && (
                <button type="button" className="btn-primary" onClick={openViewMode}>
                  Voir le détail
                </button>
              )}
            </div>
          </div>

          {isLoading && (
            <div className="page-loading">
              <div className="page-loading-spinner" />
              <span>Chargement du détail du dossier...</span>
            </div>
          )}

          {errorMessage && <div className="page-alert error" role="alert">{errorMessage}</div>}
          {successMessage && <div className="page-alert success" role="status">{successMessage}</div>}

          {requestItem && (
            <div className="status-strip">
              <span className={`status-chip ${getAffiliationStatusTone(requestItem)}`}>
                {getAffiliationStatusLabel(requestItem)}
              </span>
              <span className="status-strip-meta">
                <strong>Commerciale</strong>
                <span>{requestItem.commercialAttribue || 'Aucune commerciale attribuée'}</span>
              </span>
              <span className="status-strip-meta">
                <strong>Back office</strong>
                <span>{requestItem.backOfficeTraitant || 'Aucun traitement back office'}</span>
              </span>
              {requestItem.motifRefus && (
                <span className="status-strip-meta status-strip-meta-warn">
                  <strong>Motif</strong>
                  <span>{summarizeCorrectionRequest(requestItem.motifRefus)}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {requestItem && !isLoading && (
          <div className="detail-tabs">
            <button
              type="button"
              className={`detail-tab-btn${activeTab === 'apercu' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('apercu')}
            >
              Aperçu
            </button>
            {(configurationRows.length > 0 || negotiableRows.length > 0) && (
              <button
                type="button"
                className={`detail-tab-btn${activeTab === 'configuration' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('configuration')}
              >
                Configuration
              </button>
            )}
            <button
              type="button"
              className={`detail-tab-btn${activeTab === 'suivi' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('suivi')}
            >
              Suivi &amp; documents
            </button>
            {shouldShowContractCard && (
              <button
                type="button"
                className={`detail-tab-btn${activeTab === 'contrat' ? ' is-active' : ''}`}
                onClick={() => setActiveTab('contrat')}
              >
                Contrat
              </button>
            )}
          </div>
        )}

        {requestItem && !isLoading && activeTab === 'apercu' && (
          <div className="detail-grid">
            {identityRows.length > 0 && (
              <div
                className={`info-card${identityRows.length >= 6 ? ' card-wide' : ''}${identityRows.length >= 8 ? ' list-2cols' : ''}`}
              >
                <h3>Identité commerçant</h3>
                <div className="info-list">
                  {identityRows.map((row) => (
                    <span key={row.label}><strong>{row.label}:</strong><span>{row.value}</span></span>
                  ))}
                </div>
              </div>
            )}

            {dossierRows.length > 0 && (
              <div
                className={`info-card${dossierRows.length <= 4 ? ' card-compact' : ''}${dossierRows.length >= 7 ? ' card-wide' : ''}${dossierRows.length >= 8 ? ' list-2cols' : ''}`}
              >
                <h3>Informations dossier</h3>
                <div className="info-list">
                  {dossierRows.map((row) => (
                    <span key={row.label}><strong>{row.label}:</strong><span>{row.value}</span></span>
                  ))}
                </div>
              </div>
            )}

            {merchantProfileRows.length > 0 && (
              <div
                className={`info-card${merchantProfileRows.length <= 3 ? ' card-compact' : ''}${merchantProfileRows.length >= 6 ? ' card-wide' : ''}${merchantProfileRows.length >= 8 ? ' list-2cols' : ''}`}
              >
                <h3>Profil commerçant</h3>
                <div className="info-list">
                  {merchantProfileRows.map((row) => (
                    <span key={row.label}><strong>{row.label}:</strong><span>{row.value}</span></span>
                  ))}
                </div>
              </div>
            )}

            {contactRows.length > 0 && (
              <div
                className={`info-card${contactRows.length >= 6 ? ' card-wide' : ''}${contactRows.length >= 8 ? ' list-2cols' : ''}`}
              >
                <h3>Coordonnées</h3>
                <div className="info-list">
                  {contactRows.map((row) => (
                    <span key={row.label}><strong>{row.label}:</strong><span>{row.value}</span></span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {requestItem && !isLoading && activeTab === 'configuration' && (
          <div className="detail-grid">
            {configurationRows.length > 0 && (
              <div
                className={`info-card${configurationRows.length <= 4 ? ' card-compact' : ''}${configurationRows.length >= 7 ? ' card-wide' : ''}${configurationRows.length >= 8 ? ' list-2cols' : ''}`}
              >
                <h3>Configuration demandée</h3>
                <div className="info-list">
                  {configurationRows.map((row) => (
                    <span key={row.label}><strong>{row.label}:</strong><span>{row.value}</span></span>
                  ))}
                </div>
              </div>
            )}

            {negotiableRows.length > 0 && (
              <div
                className={`info-card${negotiableRows.length <= 4 ? ' card-compact' : ''}${negotiableRows.length >= 7 ? ' card-wide' : ''}${negotiableRows.length >= 8 ? ' list-2cols' : ''}`}
              >
                <h3>Champs négociables</h3>
                <div className="info-list">
                  {negotiableRows.map((row) => (
                    <span key={row.label}><strong>{row.label}:</strong><span>{row.value}</span></span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {requestItem && !isLoading && activeTab === 'suivi' && (
          <div className="detail-grid">
            {workflowRows.length > 0 && (
              <div
                className={`info-card${workflowRows.length >= 6 ? ' card-wide' : ''}${workflowRows.length >= 8 ? ' list-2cols' : ''}`}
              >
                <h3>Suivi dossier</h3>
                <div className="info-list">
                  {workflowRows.map((row) => (
                    <span key={row.label}><strong>{row.label}:</strong><span>{row.value}</span></span>
                  ))}
                </div>
              </div>
            )}

            <div className={`info-card card-wide card-documents${documents.length >= 8 ? ' card-full' : ''}`}>
              <h3>Documents</h3>
              {documents.length > 0 ? (
                <div className="info-list">
                  {documents.map((document) => (
                    <span key={document.documentId} className="document-row">
                      <span>
                        <strong>{formatEnumLabel(document.typeDocument)}:</strong> {document.fileName || '-'}
                      </span>
                      {canDownloadDossierDocuments && (
                        <button type="button" className="btn-secondary" onClick={() => downloadDocument(document)}>
                          {document.downloadable ? 'Télécharger' : 'Indisponible'}
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="page-text">Aucun document disponible sur ce dossier.</div>
              )}
            </div>
          </div>
        )}

        {requestItem && !isLoading && activeTab === 'contrat' && shouldShowContractCard && (
          <div className="detail-grid">
            <div className={`info-card card-wide${contractRows.length >= 6 ? ' list-2cols' : ''}`}>
              <h3>Contrat</h3>
              {contractRows.length > 0 ? (
                <div className="info-list">
                  {contractRows.map((row) => (
                    <span key={row.label}><strong>{row.label}:</strong><span>{row.value}</span></span>
                  ))}
                </div>
              ) : (
                <div className="page-text">Aucune information de contrat disponible.</div>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!requestItem.contractDisponible}
                  onClick={downloadGeneratedContract}
                >
                  Télécharger le contrat
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!requestItem.signedContractDisponible}
                  onClick={downloadSignedContract}
                >
                  Télécharger le contrat signé
                </button>
              </div>
            </div>
          </div>
        )}

        {requestItem && mode === 'edit' && canEditRequest && (
          <div className="page-card">
            <div className="section-head">
              <div>
                <span className="page-kicker">Complétion</span>
                <h3>Renseigner les champs restants</h3>
              </div>
            </div>

            <form noValidate onSubmit={submitActivation}>
              {isTpeRequest && (
                <div className="form-grid">
                  <label className="form-field">
                    <span>Abonnement</span>
                    <select
                      className="form-select"
                      value={form.abonnementPackage}
                      disabled={isSubmitting}
                      onChange={(e) => setFormField('abonnementPackage', e.target.value)}
                    >
                      <option value="">Choisir un abonnement</option>
                      {AFFILIATION_PACKAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Commission locale TPE</span>
                    <input className="form-input" value={form.commissionLocaleTpe} disabled={isSubmitting}
                      onChange={(e) => setFormField('commissionLocaleTpe', e.target.value)} />
                  </label>
                  <label className="form-field">
                    <span>Commission étrangère TPE</span>
                    <input className="form-input" value={form.commissionEtrangereTpe} disabled={isSubmitting}
                      onChange={(e) => setFormField('commissionEtrangereTpe', e.target.value)} />
                  </label>
                  <label className="form-field">
                    <span>Dépôt TPE</span>
                    <input className="form-input" value={form.depotTpe} disabled={isSubmitting}
                      onChange={(e) => setFormField('depotTpe', e.target.value)} />
                  </label>
                  <label className="form-field">
                    <span>Prix achat TPE</span>
                    <input className="form-input" value={form.prixAchatTpe} disabled={isSubmitting}
                      onChange={(e) => setFormField('prixAchatTpe', e.target.value)} />
                  </label>
                  <label className="form-field">
                    <span>Prix licence TPE</span>
                    <input className="form-input" value={form.prixLicenceTpe} disabled={isSubmitting}
                      onChange={(e) => setFormField('prixLicenceTpe', e.target.value)} />
                  </label>
                </div>
              )}

              {isEcommerceRequest && (
                <div className="form-grid">
                  <label className="form-field">
                    <span>Commission locale e-commerce</span>
                    <input className="form-input" value={form.commissionLocaleEcommerce} disabled={isSubmitting}
                      onChange={(e) => setFormField('commissionLocaleEcommerce', e.target.value)} />
                  </label>
                  <label className="form-field">
                    <span>Commission étrangère e-commerce</span>
                    <input className="form-input" value={form.commissionEtrangereEcommerce} disabled={isSubmitting}
                      onChange={(e) => setFormField('commissionEtrangereEcommerce', e.target.value)} />
                  </label>
                  <label className="form-field">
                    <span>Frais mise en service</span>
                    <input className="form-input" value={form.fraisMiseEnServiceEcommerce} disabled={isSubmitting}
                      onChange={(e) => setFormField('fraisMiseEnServiceEcommerce', e.target.value)} />
                  </label>
                </div>
              )}

              {isQrSoftposRequest && (
                <div className="form-grid">
                  <label className="form-field">
                    <span>Abonnement</span>
                    <select
                      className="form-select"
                      value={form.abonnementPackage}
                      disabled={isSubmitting}
                      onChange={(e) => setFormField('abonnementPackage', e.target.value)}
                    >
                      <option value="">Choisir un abonnement</option>
                      {AFFILIATION_PACKAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Commission locale QR / SoftPOS</span>
                    <input className="form-input" value={form.commissionLocaleQrSoftpos} disabled={isSubmitting}
                      onChange={(e) => setFormField('commissionLocaleQrSoftpos', e.target.value)} />
                  </label>
                  <label className="form-field">
                    <span>Commission étrangère QR / SoftPOS</span>
                    <input className="form-input" value={form.commissionEtrangereQrSoftpos} disabled={isSubmitting}
                      onChange={(e) => setFormField('commissionEtrangereQrSoftpos', e.target.value)} />
                  </label>
                  <label className="form-field">
                    <span>Frais service</span>
                    <input className="form-input" value={form.fraisServiceQrSoftpos} disabled={isSubmitting}
                      onChange={(e) => setFormField('fraisServiceQrSoftpos', e.target.value)} />
                  </label>
                  <label className="form-field field-full">
                    <span>Conditions spécifiques</span>
                    <input className="form-input" value={form.conditionsQrSoftpos} disabled={isSubmitting}
                      onChange={(e) => setFormField('conditionsQrSoftpos', e.target.value)} />
                  </label>
                </div>
              )}

              <div className="form-actions">
                <button className="btn-primary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Envoi en cours...' : primaryActionLabel}
                </button>
                <button className="btn-secondary" type="button" disabled={isSubmitting} onClick={openViewMode}>
                  Revenir au détail
                </button>
              </div>
            </form>
          </div>
        )}

        {requestItem && canReviewRequest && (
          <div className="page-card">
            <div className="section-head">
              <div>
                <span className="page-kicker">Back office</span>
                <h3>Valider ou demander correction</h3>
              </div>
            </div>

            <div className="correction-review-grid">
              <CorrectionMultiSelect
                label="Type de problème"
                options={CORRECTION_CATEGORY_OPTIONS}
                values={reviewCategories}
                disabled={isSubmitting}
                placeholder="Choisir les types"
                onChange={setReviewCategories}
              />
              <CorrectionMultiSelect
                label="Champs concernés"
                options={CORRECTION_FIELD_OPTIONS}
                values={reviewFields}
                disabled={isSubmitting}
                placeholder="Choisir les champs"
                onChange={setReviewFields}
              />
              <CorrectionMultiSelect
                label="Documents concernés"
                options={CORRECTION_DOCUMENT_OPTIONS}
                values={reviewDocuments}
                disabled={isSubmitting}
                placeholder="Choisir les documents"
                onChange={setReviewDocuments}
              />
              <label className="form-field field-full">
                <span>Motif détaillé</span>
                <textarea
                  className="form-input"
                  rows={4}
                  value={reviewMotif}
                  disabled={isSubmitting}
                  placeholder="Expliquer clairement ce qui doit être corrigé avant renvoi au commercial..."
                  onChange={(e) => setReviewMotif(e.target.value)}
                />
              </label>
            </div>

            <div className="form-actions">
              <button
                className="btn-primary"
                type="button"
                disabled={isSubmitting || hasReviewCorrectionIntent}
                onClick={() => submitReview('ACCEPTE')}
              >
                {isSubmitting ? 'Traitement...' : 'Valider'}
              </button>
              <button
                className="btn-secondary"
                type="button"
                disabled={isSubmitting || !isReviewCorrectionReady}
                onClick={() => submitReview('CORRECTION')}
              >
                Demander correction
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
