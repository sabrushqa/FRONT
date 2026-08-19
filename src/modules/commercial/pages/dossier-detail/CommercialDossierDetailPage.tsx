import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSessionStore } from '../../../../store/sessionStore';
import { triggerBlobDownload } from '../../../../core/browserDownload';
import {
  AffiliationActivationPayload,
  AffiliationDocumentItem,
  AffiliationRequestItem,
  CommercialAffiliationDraftPayload,
  completeAffiliationRequest,
  downloadAffiliationDocument,
  downloadCommercialReport as apiDownloadCommercialReport,
  downloadFullDossier as apiDownloadFullDossier,
  downloadGeneratedContract as apiDownloadGeneratedContract,
  downloadSignedContract as apiDownloadSignedContract,
  getAffiliationRequests,
  getEligibleTpes,
  assignTpeToCommercant,
  assignEcommerceSiteToCommercant,
  abandonAffiliationRequest,
  reviewAffiliationRequest,
  saveCommercialDraft,
  type SupervisorTpeStockItem
} from '../../../supervisor/services/supervisorApi';
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
} from '../../../supervisor/services/supervisorUiUtils';
import {
  BUSINESS_PROVIDER_OPTIONS,
  LC_MANDATAIRE_OPTIONS,
  UMNIA_BANK_AGENCY_OPTIONS,
  AgencyMandataireOption
} from '../../../../core/agencyMandataireOptions';
import { MCC_OPTIONS } from '../../../../core/mccOptions';
import {
  CORRECTION_CATEGORY_OPTIONS,
  CORRECTION_DOCUMENT_OPTIONS,
  CORRECTION_FIELD_OPTIONS,
  serializeCorrectionRequest,
  summarizeCorrectionRequest
} from '../../services/correctionRequestUtils';
import CorrectionMultiSelect from '../../components/CorrectionMultiSelect';
import {
  COMMERCIAL_REPORT_APPRECIATION_OPTIONS,
  COMMERCIAL_REPORT_CA_OPTIONS,
  COMMERCIAL_REPORT_LOCAL_STATUS_OPTIONS,
  COMMERCIAL_REPORT_ORIGIN_OPTIONS,
  COMMERCIAL_REPORT_PROFILE_OPTIONS,
  COMMERCIAL_REPORT_QUALIFICATION_OPTIONS,
  COMMERCIAL_REPORT_SURFACE_OPTIONS
} from '../../../../core/commercialReportOptions';
import '../../../../styles/page.shared.scss';
import '../../../../styles/dossier-detail.scss';
import '../../../../styles/commercial-dossier-detail.scss';
import SubmitOverlay from '../../../workspace/SubmitOverlay';

type RequestScope = 'auto' | 'new-pdv' | 'commercial';

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

function sanitizeDecimal(value: string, maxLength?: number): string {
  const cleaned = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function sanitizeDigits(value: string, maxLength?: number): string {
  const digitsOnly = value.replace(/\D+/g, '');
  return maxLength ? digitsOnly.slice(0, maxLength) : digitsOnly;
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

export default function CommercialDossierDetailPage({
  requestScope = 'auto'
}: {
  requestScope?: RequestScope;
}) {
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
  const [abandonMotif, setAbandonMotif] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingFullDossier, setIsDownloadingFullDossier] = useState(false);
  const [isPrintingDossier, setIsPrintingDossier] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'apercu' | 'configuration' | 'suivi' | 'contrat'>('apercu');
  const [eligibleTpes, setEligibleTpes] = useState<SupervisorTpeStockItem[]>([]);
  const [isLoadingTpes, setIsLoadingTpes] = useState(false);
  const [isAssigningTpe, setIsAssigningTpe] = useState(false);
  const [selectedTpeId, setSelectedTpeId] = useState('');
  const [tpeMessage, setTpeMessage] = useState('');
  const [ecommerceSiteUrl, setEcommerceSiteUrl] = useState('');
  const [isAssigningEcommerceSite, setIsAssigningEcommerceSite] = useState(false);
  const [ecommerceSiteMessage, setEcommerceSiteMessage] = useState('');

  const role = session?.role ?? '';
  const hasAccess = role === 'SUPERVISEUR' || role === 'COMMERCIAL' || role === 'BACK_OFFICE';
  const isCommercialRole = role === 'COMMERCIAL';
  const isBackOfficeRole = role === 'BACK_OFFICE';
  const canAccessPage = hasAccess && !(isBackOfficeRole && session?.peutValiderDossiers === false);
  const canDownloadDossierDocuments = hasAccess;

  const requestedMode: 'view' | 'edit' = searchParams.get('mode') === 'edit' ? 'edit' : 'view';

  const dossierId = Number(params.dossierId);

  const workspaceBase =
    role === 'BACK_OFFICE' ? '/backoffice' : role === 'SUPERVISEUR' ? '/supervisor' : '/commercial';

  const isAutoAffiliationRequest = requestItem?.origineCreation === 'AUTO_AFFILIATION';
  const isNewPdvRequest = requestItem?.origineCreation === 'NOUVEAU_PDV';
  const isCommercialDirectRequest = requestItem?.origineCreation === 'COMMERCIAL_DIRECT';

  const detailBase = useMemo(() => {
    if (requestScope === 'commercial') {
      return `${workspaceBase}/demandes-commerciales`;
    }
    if (requestScope === 'new-pdv') {
      return `${workspaceBase}/demande-extention`;
    }
    if (isCommercialRole) {
      return '/commercial/dossiers';
    }
    if (isBackOfficeRole) {
      return '/backoffice/dossiers';
    }
    return '/supervisor/affiliation-requests';
  }, [requestScope, workspaceBase, isCommercialRole, isBackOfficeRole]);

  const dossiersRoute = detailBase;
  const principalDossierPath = requestItem?.dossierPrincipalId
    ? `${workspaceBase === '/supervisor' ? '/supervisor/affiliation-requests' : `${workspaceBase}/dossiers`}/${requestItem.dossierPrincipalId}`
    : '';

  const canEditRequest =
    isCommercialRole &&
    !!requestItem &&
    (requestItem.status === 'SOUMIS' || requestItem.status === 'BROUILLON');
  const canReviewRequest =
    isBackOfficeRole && !!requestItem && requestItem.status === 'EN_ATTENTE_VALIDATION_BOA';
  const canAbandonCorrection =
    isCommercialRole
    && !!requestItem
    && requestItem.status === 'INCOMPLET';
  // Aligne strictement sur le backend (getEligibleTpesForDossier /
  // validateTpeAssignment) qui n'autorise l'affectation qu'une fois le
  // contrat reellement SIGNE ET DEPOSE (ACCEPTE) — avant ce correctif, le
  // bloc s'affichait deja au statut CONTRAT_A_SIGNER (contrat genere/envoye,
  // pas encore signe), et l'API retournait alors systematiquement un stock
  // vide : l'utilisateur voyait a tort "Aucun TPE disponible pour ce type de
  // dossier" au lieu de comprendre qu'il fallait d'abord attendre la
  // signature du commercant.
  const canAssignTpe =
    isBackOfficeRole
    && session?.peutAffecterTpe !== false
    && !!requestItem
    && requestItem.typeAffiliation !== 'E_COMMERCE'
    && !requestItem.tpeDejaAffecte
    && requestItem.status === 'ACCEPTE';
  // ENCAISSEMENT_ET_ECOMMERCE combine les deux canaux : ce dossier doit donner
  // acces aux DEUX blocs d'affectation en meme temps (TPE demande(s) ci-dessus
  // ET site e-commerce ici) — un dossier E_COMMERCE pur n'a que celui-ci.
  const canAssignEcommerceSite =
    isBackOfficeRole
    && session?.peutAffecterTpe !== false
    && !!requestItem
    && (requestItem.typeAffiliation === 'E_COMMERCE' || requestItem.typeAffiliation === 'ENCAISSEMENT_ET_ECOMMERCE')
    && !requestItem.ecommerceSiteDejaAffecte
    && requestItem.status === 'ACCEPTE';

  const mode: 'view' | 'edit' =
    (requestItem?.compteActif && !isNewPdvRequest) || !canEditRequest ? 'view' : requestedMode;

  // ENCAISSEMENT_ET_ECOMMERCE exige a la fois les champs TPE et e-commerce
  // cote backend (StaffAffiliationManagementService::applyNegotiableFields,
  // case ENCAISSEMENT_ET_ECOMMERCE -> applyTpeNegotiableFields +
  // applyEcommerceNegotiableFields) : sans l'inclure ici, aucun des deux
  // blocs de champs (dont "Commission locale TPE") ne s'affichait pour ce
  // type, rendant le formulaire impossible a completer.
  const isTpeRequest =
    requestItem?.typeAffiliation === 'TPE' || requestItem?.typeAffiliation === 'ENCAISSEMENT_ET_ECOMMERCE';
  const isEcommerceRequest =
    requestItem?.typeAffiliation === 'E_COMMERCE' || requestItem?.typeAffiliation === 'ENCAISSEMENT_ET_ECOMMERCE';
  const isQrSoftposRequest =
    requestItem?.typeAffiliation === 'SOFTPOS' || requestItem?.typeAffiliation === 'QR_CODE';

  const loadRequest = useCallback(
    async (id: number, resetMessages = true) => {
      if (!canAccessPage) {
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
    [canAccessPage]
  );

  useEffect(() => {
    if (!Number.isFinite(dossierId)) {
      setIsLoading(false);
      setErrorMessage('Identifiant de dossier invalide.');
      return;
    }
    void loadRequest(dossierId);
  }, [dossierId, loadRequest]);

  const loadEligibleTpes = useCallback(async () => {
    if (!requestItem) return;
    setIsLoadingTpes(true);
    try {
      const response = await getEligibleTpes(requestItem.dossierId);
      setEligibleTpes(response.tpes);
      setSelectedTpeId((prev) => (response.tpes.some((t) => String(t.id) === prev) ? prev : ''));
    } catch {
      setEligibleTpes([]);
    } finally {
      setIsLoadingTpes(false);
    }
  }, [requestItem]);

  useEffect(() => {
    if (canAssignTpe) {
      void loadEligibleTpes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAssignTpe, requestItem?.dossierId]);

  useEffect(() => {
    if (canAssignEcommerceSite) {
      setEcommerceSiteUrl((prev) => prev || requestItem?.siteMarchandUrl || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAssignEcommerceSite, requestItem?.dossierId]);

  async function assignTpe() {
    if (!requestItem || !selectedTpeId || isAssigningTpe) return;
    setIsAssigningTpe(true);
    setTpeMessage('');
    try {
      const response = await assignTpeToCommercant(selectedTpeId, { dossierId: requestItem.dossierId });
      setTpeMessage(response.message);
      setSelectedTpeId('');
      await Promise.all([loadEligibleTpes(), loadRequest(requestItem.dossierId, false)]);
    } catch (error) {
      setTpeMessage(extractApiErrorMessage(error, "Impossible d'affecter cette référence TPE."));
    } finally {
      setIsAssigningTpe(false);
    }
  }

  async function assignEcommerceSite() {
    if (!requestItem || isAssigningEcommerceSite) return;
    setIsAssigningEcommerceSite(true);
    setEcommerceSiteMessage('');
    try {
      const response = await assignEcommerceSiteToCommercant({
        dossierId: requestItem.dossierId,
        url: ecommerceSiteUrl.trim() || undefined
      });
      setEcommerceSiteMessage(response.message);
      await loadRequest(requestItem.dossierId, false);
    } catch (error) {
      setEcommerceSiteMessage(extractApiErrorMessage(error, "Impossible d'affecter ce site e-commerce."));
    } finally {
      setIsAssigningEcommerceSite(false);
    }
  }

  const documents = requestItem?.documents ?? [];

  // Compte-rendu origine détail (mandataire / agence) helpers
  const currentOrigineDetailOptions: AgencyMandataireOption[] = useMemo(() => {
    switch (form.compteRenduOrigineProspect) {
      case 'APPORTEUR_AFFAIRES':
        return BUSINESS_PROVIDER_OPTIONS;
      case 'MANDATAIRES':
      case 'AUTRE_BANQUES':
        return LC_MANDATAIRE_OPTIONS;
      case 'UMNIA_BANK':
      case 'UMNIA':
        return UMNIA_BANK_AGENCY_OPTIONS;
      default:
        return [];
    }
  }, [form.compteRenduOrigineProspect]);

  const origineDetailLabel = useMemo(() => {
    switch (form.compteRenduOrigineProspect) {
      case 'APPORTEUR_AFFAIRES':
        return "Apporteur d'affaires";
      case 'UMNIA_BANK':
      case 'UMNIA':
        return 'Agence Umnia Bank';
      default:
        return 'Mandataire';
    }
  }, [form.compteRenduOrigineProspect]);

  const showAcquereurField = form.compteRenduQualification === 'AFFILIE';
  const showOrigineDetailField = !isAutoAffiliationRequest && currentOrigineDetailOptions.length > 0;
  const showCustomOrigineDetailOption = (() => {
    const detail = form.compteRenduOrigineProspectDetail?.trim();
    return Boolean(
      detail && !currentOrigineDetailOptions.some((option) => option.value === detail)
    );
  })();

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
      !isNewPdvRequest
        ? { label: "Nombre de demandes d'extension", value: firstMeaningful(requestItem.nombreDemandesExtention) }
        : { label: '', value: '' }
    ]);
  }, [requestItem, isNewPdvRequest]);

  const extensionMerchantRows = useMemo<DetailRow[]>(() => {
    if (!requestItem) return [];
    return filterRows([
      { label: 'Nom commerçant', value: firstMeaningful(requestItem.nomCommercant) },
      { label: 'Nom', value: firstMeaningful(requestItem.nom) },
      { label: 'Prénom', value: firstMeaningful(requestItem.prenom) },
      { label: 'E-mail', value: firstMeaningful(requestItem.email) },
      { label: 'Téléphone', value: firstMeaningful(requestItem.telephone) },
      { label: 'Activité', value: firstMeaningful(requestItem.activite) },
      { label: 'Type commerçant', value: formatEnumLabel(requestItem.typeCommercant) }
    ]);
  }, [requestItem]);

  const extensionPdvRows = useMemo<DetailRow[]>(() => {
    if (!requestItem) return [];
    return filterRows([
      { label: 'Nom PDV demandé', value: firstMeaningful(requestItem.requestedPdvNom) },
      { label: 'Adresse PDV', value: firstMeaningful(requestItem.requestedPdvAdresse) },
      { label: 'Ville PDV', value: firstMeaningful(requestItem.requestedPdvVille) },
      { label: 'Code postal', value: firstMeaningful(requestItem.requestedPdvCodePostal) },
      { label: 'Téléphone PDV', value: firstMeaningful(requestItem.requestedPdvTelephone) },
      { label: 'E-mail PDV', value: firstMeaningful(requestItem.requestedPdvEmail) },
      { label: 'Statut PDV', value: formatEnumLabel(requestItem.requestedPdvStatut) }
    ]);
  }, [requestItem]);

  const extensionProductRows = useMemo<DetailRow[]>(() => {
    if (!requestItem) return [];
    return filterRows([
      { label: 'Produit demandé', value: formatEnumLabel(requestItem.typeAffiliation) },
      { label: 'Nombre TPE', value: firstMeaningful(requestItem.nombreTpe) },
      { label: 'Mode mise à disposition', value: firstMeaningful(requestItem.modeMiseADispositionTpe) },
      { label: 'Équipement', value: firstMeaningful(requestItem.equipementTpe) },
      { label: 'Connectivité', value: firstMeaningful(requestItem.connectiviteTpe) },
      { label: 'Modèle SoftPOS', value: firstMeaningful(requestItem.modeleQrSoftpos) },
      { label: 'Nombre QR / SoftPOS', value: firstMeaningful(requestItem.nombreQrSoftpos) },
      { label: 'Mode service e-commerce', value: firstMeaningful(requestItem.modeServiceEcommerce) },
      { label: 'Site marchand', value: firstMeaningful(requestItem.siteMarchandUrl) },
      { label: 'Application mobile', value: firstMeaningful(requestItem.applicationMobile) }
    ]);
  }, [requestItem]);

  const dossierRows = useMemo<DetailRow[]>(() => {
    if (!requestItem) return [];
    return filterRows([
      { label: 'Type affiliation', value: formatEnumLabel(requestItem.typeAffiliation) },
      { label: 'Origine création', value: formatEnumLabel(requestItem.origineCreation) },
      { label: 'Statut', value: getAffiliationStatusLabel(requestItem) },
      { label: 'Statut prospect', value: formatEnumLabel(requestItem.prospectStatus) },
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
    // Accumule (pas de retour anticipe) : un dossier ENCAISSEMENT_ET_ECOMMERCE
    // doit afficher a la fois les lignes TPE et e-commerce, pas seulement les
    // premieres qui correspondent.
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
      { label: 'Compte-rendu généré', value: firstMeaningful(requestItem.commercialReportGeneratedAt) },
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

  const commercialReportRows = useMemo<DetailRow[]>(() => {
    if (!requestItem) return [];
    return filterRows([
      { label: 'Qualification', value: firstMeaningful(requestItem.compteRenduQualification) },
      { label: 'Acquéreur', value: firstMeaningful(requestItem.compteRenduAcquereur) },
      { label: 'Origine prospect', value: firstMeaningful(requestItem.compteRenduOrigineProspect) },
      { label: 'Détail origine', value: firstMeaningful(requestItem.compteRenduOrigineProspectDetail) },
      { label: 'Contact (nom prénom)', value: firstMeaningful(requestItem.compteRenduContactNomPrenom) },
      { label: 'Fonction contact', value: firstMeaningful(requestItem.compteRenduContactFonction) },
      { label: 'Acronyme point de vente', value: firstMeaningful(requestItem.compteRenduPointVenteAcronyme) },
      { label: 'Actionnaires', value: firstMeaningful(requestItem.compteRenduActionnaires) },
      { label: 'Commerçant', value: firstMeaningful(requestItem.compteRenduCommercant) },
      { label: 'Chaîne', value: firstMeaningful(requestItem.compteRenduChaine) },
      { label: 'Relations LC', value: firstMeaningful(requestItem.compteRenduRelationsLc) },
      { label: 'Date ouverture', value: firstMeaningful(requestItem.compteRenduDateOuverture) },
      { label: "Nombre d'employés", value: firstMeaningful(requestItem.compteRenduNombreEmployes) },
      { label: 'Activité', value: firstMeaningful(requestItem.compteRenduActivite) },
      { label: 'MCC', value: firstMeaningful(requestItem.compteRenduMcc) },
      { label: 'Standing magasin', value: firstMeaningful(requestItem.compteRenduStandingMagasin) },
      { label: 'Nature marchandises', value: firstMeaningful(requestItem.compteRenduNatureMarchandises) },
      { label: 'Superficie local', value: firstMeaningful(requestItem.compteRenduSuperficieLocal) },
      { label: 'Statut local', value: firstMeaningful(requestItem.compteRenduStatutLocal) },
      { label: "Chiffre d'affaires annuel", value: firstMeaningful(requestItem.compteRenduChiffreAffairesAnnuel) },
      { label: 'Part paiement carte', value: firstMeaningful(requestItem.compteRenduPartPaiementCarte) },
      { label: 'Part carte locale', value: firstMeaningful(requestItem.compteRenduPartCarteLocale) },
      { label: 'Profil commerçant', value: firstMeaningful(requestItem.compteRenduProfilCommercant) },
      { label: 'Appréciation de la visite', value: firstMeaningful(requestItem.compteRenduAppreciationVisite) },
      { label: 'Commentaire', value: firstMeaningful(requestItem.compteRenduCommentaire) },
      { label: 'Fait à', value: firstMeaningful(requestItem.compteRenduFaitA) },
      { label: 'Date visite', value: firstMeaningful(requestItem.compteRenduDateVisite) }
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

  const shouldShowCommercialReportCard =
    !!requestItem && (requestItem.commercialReportDisponible || commercialReportRows.length > 0);

  const headerTitle = (() => {
    if (!requestItem) return 'Dossier commerçant';
    if (isNewPdvRequest) {
      return `Demande PDV #${requestItem.dossierId} - ${requestItem.nomCommercant || requestItem.email}`;
    }
    return `#${requestItem.dossierId} - ${requestItem.nomCommercant || requestItem.email}`;
  })();

  const primaryActionLabel = isNewPdvRequest
    ? 'Générer le compte-rendu et le contrat PDV'
    : 'Générer le compte-rendu, le contrat et envoyer l’activation';
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

  function setFormField(field: keyof AffiliationActivationPayload, value: string | boolean) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'mcc' && typeof value === 'string') {
        next.compteRenduMcc = value;
      }
      return next;
    });
  }

  function onOrigineProspectChange(value: string) {
    setForm((prev) => {
      const next = { ...prev, compteRenduOrigineProspect: value };
      if (prev.compteRenduOrigineProspect !== value) {
        next.compteRenduOrigineProspectDetail = '';
      }
      return next;
    });
  }

  function openEditMode() {
    if (!canEditRequest || !requestItem) return;
    if (isCommercialDirectRequest) {
      navigate(`${workspaceBase}/demandes-commerciales/${requestItem.dossierId}/continue`);
      return;
    }
    navigate(`${detailBase}/${dossierId}?mode=edit`, { replace: true });
  }

  function openViewMode() {
    navigate(`${detailBase}/${dossierId}`, { replace: true });
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

  function buildDraftPayload(): CommercialAffiliationDraftPayload {
    const request = requestItem!;
    return {
      ...form,
      typeCommercant: request.typeCommercant || 'PERSONNE_PHYSIQUE',
      typeAffiliation: request.typeAffiliation || 'TPE',
      nom: request.nom || '',
      prenom: request.prenom || '',
      cin: request.cin || '',
      raisonSociale: request.raisonSociale || '',
      nomEntite: request.nomEntite || '',
      activite: request.activite || '',
      secteur: request.secteur || '',
      mcc: form.mcc || request.mcc || '',
      telephonePrincipal: request.telephone || '',
      telephoneSecondaire: request.telephoneSecondaire || '',
      email: request.email || '',
      adresse: request.adresse || '',
      ville: request.ville || '',
      region: request.region || '',
      chainePointVente: request.chainePointVente || '',
      nombrePointsVente: request.nombrePointsVente == null ? '' : String(request.nombrePointsVente),
      rc: request.rc || '',
      ice: request.ice || '',
      formeJuridique: request.formeJuridique || '',
      representantLegal: request.representantLegal || '',
      numeroAutoEntrepreneur: request.numeroAutoEntrepreneur || '',
      objet: request.objet || '',
      patente: request.patente || '',
      fonction: request.fonction || '',
      beneficiairesEffectifs: request.beneficiairesEffectifs || '',
      dateNaissance: request.dateNaissance || '',
      nationalite: request.nationalite || '',
      modeMiseADispositionTpe: request.modeMiseADispositionTpe || '',
      nombreTpe: request.nombreTpe == null ? '' : String(request.nombreTpe),
      equipementTpe: request.equipementTpe || '',
      connectiviteTpe: request.connectiviteTpe || '',
      modeServiceEcommerce: request.modeServiceEcommerce || '',
      siteMarchandUrl: request.siteMarchandUrl || '',
      applicationMobile: request.applicationMobile || '',
      modeleQrSoftpos: request.modeleQrSoftpos || '',
      nombreQrSoftpos: request.nombreQrSoftpos == null ? '' : String(request.nombreQrSoftpos),
      rib: request.rib || '',
      pointVentesJson: '[]',
      cinDocumentName: '',
      ribDocumentName: '',
      patenteDocumentName: '',
      statutsDocumentName: '',
      rcDocumentName: '',
      iceDocumentName: '',
      cinRepresentantDocumentName: '',
      pvNominationDocumentName: '',
      attestationAeDocumentName: '',
      cinSignataireDocumentName: '',
      pvAssociationDocumentName: '',
      listeMembresDocumentName: ''
    };
  }

  async function submitActivation(event: React.FormEvent) {
    event.preventDefault();
    if (!requestItem || !canEditRequest || isSubmitting) return;
    if (showAcquereurField && !form.compteRenduAcquereur?.trim()) {
      setErrorMessage('Le champ Acquéreur est obligatoire pour un commerçant déjà affilié.');
      return;
    }
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

  async function saveDraft(event: React.MouseEvent) {
    event.preventDefault();
    if (!requestItem || !canEditRequest || isAutoAffiliationRequest || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const response = await saveCommercialDraft(requestItem.dossierId, buildDraftPayload());
      setSuccessMessage(response.message);
      await loadRequest(requestItem.dossierId, false);
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, "Impossible d'enregistrer le brouillon du dossier."));
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

  async function submitAbandonCorrection() {
    if (!requestItem || !canAbandonCorrection || isSubmitting) return;
    const motif = abandonMotif.trim();
    if (!motif) {
      setErrorMessage("Le motif d'abandon est obligatoire.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const response = await abandonAffiliationRequest(requestItem.dossierId, { motif });
      setSuccessMessage(response.message);
      setRequestItem((current) =>
        current
          ? {
              ...current,
              status: 'ABANDONNE',
              prospectStatus: 'ABANDONNE',
              motifRefus: motif
            }
          : current
      );
      setAbandonMotif('');
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, "Impossible d'abandonner ce dossier."));
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

  async function downloadCommercialReport() {
    if (!requestItem?.commercialReportDisponible) return;
    setErrorMessage('');
    try {
      const blob = await apiDownloadCommercialReport(requestItem.dossierId);
      await triggerBlobDownload(
        blob,
        requestItem.commercialReportFileName || `compte-rendu-${requestItem.dossierId}.pdf`
      );
    } catch (error) {
      setErrorMessage(await resolveDownloadErrorMessage(error, 'Impossible de télécharger le compte rendu.'));
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

  if (!canAccessPage) {
    return (
      <div className="access-card">
        <strong>Accès indisponible</strong>
        <span>Votre compte n'est pas autorisé à traiter ce dossier.</span>
      </div>
    );
  }

  const showServiceOptions = isTpeRequest || isQrSoftposRequest;

  return (
    <>
      <SubmitOverlay
        visible={isSubmitting}
        accent={isBackOfficeRole ? 'pink' : 'yellow'}
        label="Traitement en cours…"
      />

      <div className={`page-grid commercial-dossier-detail-page${isCommercialRole ? ' commercial-mode' : ''}`}>
        <div className="page-card">
          <div className="page-head">
            <div>
              {requestItem && (
                <span className="page-kicker">
                  {isCommercialDirectRequest
                    ? 'Prospection commerciale'
                    : isNewPdvRequest
                      ? 'Extension point de vente'
                      : 'Auto-affiliation'}
                </span>
              )}
              <h2>{headerTitle}</h2>
              {requestItem && (
                <p className="page-subtle">
                  {formatEnumLabel(requestItem.typeAffiliation)} / {formatEnumLabel(requestItem.typeCommercant)}
                </p>
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
                <button type="button" className="btn-primary" onClick={openEditMode}>
                  Compléter et transmettre au back office
                </button>
              )}

              {requestItem && canEditRequest && mode === 'edit' && (
                <button type="button" className="btn-secondary" onClick={openViewMode}>
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

        {requestItem && canReviewRequest && (
          <div className="page-card">
            <div className="section-head">
              <div>
                <span className="page-kicker">Back office</span>
                <h3>Valider avant envoi du contrat, ou demander correction</h3>
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
                {isSubmitting ? 'Traitement...' : 'Valider et générer le contrat'}
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

        {requestItem && canAbandonCorrection && (
          <div className="page-card">
            <div className="section-head">
              <div>
                <span className="page-kicker">Correction</span>
                <h3>Abandonner le dossier</h3>
              </div>
            </div>
            <div className="form-grid">
              <label className="form-field field-full">
                <span>Motif d'abandon</span>
                <textarea
                  className="form-input"
                  rows={3}
                  value={abandonMotif}
                  disabled={isSubmitting}
                  placeholder="Exemple: commerçant injoignable après relances, documents non transmis..."
                  onChange={(event) => setAbandonMotif(event.target.value)}
                />
              </label>
            </div>
            <div className="form-actions">
              <button
                className="btn-secondary"
                type="button"
                disabled={isSubmitting || !abandonMotif.trim()}
                onClick={submitAbandonCorrection}
              >
                {isSubmitting ? 'Traitement...' : 'Marquer abandonné'}
              </button>
            </div>
          </div>
        )}

        {canAssignTpe && (
          <div className="page-card">
            <div style={{ padding: '14px 24px' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '15px' }}>Affecter un TPE</h3>
              <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--color-text-muted, #666)' }}>
                Nombre demandé dans le dossier :{' '}
                <strong>{requestItem?.nombreTpe ? requestItem.nombreTpe : 1}</strong>
              </p>
              {tpeMessage && (
                <div className="page-alert success" role="status" style={{ marginBottom: '10px' }}>
                  {tpeMessage}
                </div>
              )}

              {isLoadingTpes ? (
                <p style={{ margin: 0 }}>Chargement du stock disponible...</p>
              ) : eligibleTpes.length === 0 ? (
                <p style={{ margin: 0 }}>
                  Aucun TPE disponible pour ce type de dossier — contactez le superviseur pour approvisionner le stock.
                </p>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                  <label className="form-field" style={{ flex: 1 }}>
                    <span>Référence TPE ({eligibleTpes.length} disponible{eligibleTpes.length > 1 ? 's' : ''})</span>
                    <select
                      className="form-input"
                      value={selectedTpeId}
                      disabled={isAssigningTpe}
                      onChange={(e) => setSelectedTpeId(e.target.value)}
                    >
                      <option value="">Sélectionner une référence...</option>
                      {eligibleTpes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.numeroSerie} — {item.modele} ({item.typeCompatible})
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="btn-primary"
                    type="button"
                    disabled={!selectedTpeId || isAssigningTpe}
                    onClick={() => assignTpe()}
                  >
                    {isAssigningTpe ? 'Affectation...' : 'Affecter'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {canAssignEcommerceSite && (
          <div className="page-card">
            <div style={{ padding: '14px 24px' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '15px' }}>Affecter un site e-commerce</h3>
              <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--color-text-muted, #666)' }}>
                Interface ce dossier avec switch-monetique-service : confirmez l'URL du site marchand,
                l'identifiant du site est généré automatiquement par Switch.
              </p>
              {ecommerceSiteMessage && (
                <div className="page-alert success" role="status" style={{ marginBottom: '10px' }}>
                  {ecommerceSiteMessage}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                <label className="form-field" style={{ flex: 1, minWidth: '240px' }}>
                  <span>URL du site marchand</span>
                  <input
                    className="form-input"
                    type="text"
                    value={ecommerceSiteUrl}
                    disabled={isAssigningEcommerceSite}
                    onChange={(e) => setEcommerceSiteUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </label>
                <button
                  className="btn-primary"
                  type="button"
                  disabled={isAssigningEcommerceSite}
                  onClick={() => assignEcommerceSite()}
                >
                  {isAssigningEcommerceSite ? 'Affectation...' : 'Affecter'}
                </button>
              </div>
            </div>
          </div>
        )}

        {requestItem && !isLoading && !isNewPdvRequest && (
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

        {requestItem && !isLoading && isNewPdvRequest && (
          <div className="detail-grid">
            {extensionMerchantRows.length > 0 && (
              <div className={`info-card card-wide${extensionMerchantRows.length >= 6 ? ' list-2cols' : ''}`}>
                <h3>Commerçant</h3>
                <div className="info-list">
                  {extensionMerchantRows.map((row) => (
                    <span key={row.label}><strong>{row.label}:</strong> {row.value}</span>
                  ))}
                </div>
              </div>
            )}

            {extensionPdvRows.length > 0 && (
              <div className={`info-card card-wide${extensionPdvRows.length >= 6 ? ' list-2cols' : ''}`}>
                <h3>{requestItem.requestedPdvDejaExistant ? 'Point de vente existant — TPE seulement' : 'Nouveau point de vente'}</h3>
                {requestItem.requestedPdvDejaExistant && (
                  <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--color-text-muted, #666)' }}>
                    Extension de TPE sur un point de vente déjà actif — aucun nouveau point de vente n'est créé.
                  </p>
                )}
                <div className="info-list">
                  {extensionPdvRows.map((row) => (
                    <span key={row.label}><strong>{row.label}:</strong> {row.value}</span>
                  ))}
                </div>
              </div>
            )}

            {extensionProductRows.length > 0 && (
              <div className={`info-card card-wide${extensionProductRows.length >= 6 ? ' list-2cols' : ''}`}>
                <h3>Produit demandé</h3>
                <div className="info-list">
                  {extensionProductRows.map((row) => (
                    <span key={row.label}><strong>{row.label}:</strong> {row.value}</span>
                  ))}
                </div>
              </div>
            )}

            {workflowRows.length > 0 && (
              <div className={`info-card card-wide${workflowRows.length >= 6 ? ' list-2cols' : ''}`}>
                <h3>Suivi demande</h3>
                <div className="info-list">
                  {workflowRows.map((row) => (
                    <span key={row.label}><strong>{row.label}:</strong> {row.value}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="info-card card-wide">
              <h3>Dossier principal</h3>
              <div className="info-list">
                <span><strong>ID dossier principal:</strong> {requestItem.dossierPrincipalId ?? 'Non renseigné'}</span>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!principalDossierPath}
                  onClick={() => principalDossierPath && navigate(principalDossierPath)}
                >
                  Voir le dossier complet
                </button>
              </div>
            </div>
          </div>
        )}

        {requestItem && !isLoading && !isNewPdvRequest && activeTab === 'apercu' && (
          <div className="detail-grid">
            {identityRows.length > 0 && (
              <div
                className={`info-card${identityRows.length >= 6 ? ' card-wide' : ''}${identityRows.length >= 8 ? ' list-2cols' : ''}`}
              >
                <h3>Identité commerçant</h3>
                <div className="info-list">
                  {identityRows.map((row) => (
                    <span key={row.label}><strong>{row.label}:</strong> {row.value}</span>
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
                    <span key={row.label}><strong>{row.label}:</strong> {row.value}</span>
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
                    <span key={row.label}><strong>{row.label}:</strong> {row.value}</span>
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
                    <span key={row.label}><strong>{row.label}:</strong> {row.value}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {requestItem && !isLoading && !isNewPdvRequest && activeTab === 'configuration' && (
          <div className="detail-grid">
            {configurationRows.length > 0 && (
              <div
                className={`info-card${configurationRows.length <= 4 ? ' card-compact' : ''}${configurationRows.length >= 7 ? ' card-wide' : ''}${configurationRows.length >= 8 ? ' list-2cols' : ''}`}
              >
                <h3>Configuration demandée</h3>
                <div className="info-list">
                  {configurationRows.map((row) => (
                    <span key={row.label}><strong>{row.label}:</strong> {row.value}</span>
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
                    <span key={row.label}><strong>{row.label}:</strong> {row.value}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {requestItem && !isLoading && !isNewPdvRequest && activeTab === 'suivi' && (
          <div className="detail-grid">
            {workflowRows.length > 0 && (
              <div
                className={`info-card${workflowRows.length >= 6 ? ' card-wide' : ''}${workflowRows.length >= 8 ? ' list-2cols' : ''}`}
              >
                <h3>Suivi dossier</h3>
                <div className="info-list">
                  {workflowRows.map((row) => (
                    <span key={row.label}><strong>{row.label}:</strong> {row.value}</span>
                  ))}
                </div>
              </div>
            )}

            {shouldShowCommercialReportCard && (
              <div
                className={`info-card card-wide${commercialReportRows.length >= 8 ? ' list-2cols card-full' : ''}`}
              >
                <h3>Compte-rendu commercial</h3>
                {commercialReportRows.length > 0 ? (
                  <div className="info-list">
                    {commercialReportRows.map((row) => (
                      <span key={row.label}><strong>{row.label}:</strong> {row.value}</span>
                    ))}
                  </div>
                ) : (
                  <div className="page-text">Aucune information de compte rendu saisie.</div>
                )}

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={!requestItem.commercialReportDisponible}
                    onClick={downloadCommercialReport}
                  >
                    Télécharger le compte rendu
                  </button>
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

        {requestItem && !isLoading && !isNewPdvRequest && activeTab === 'contrat' && shouldShowContractCard && (
          <div className="detail-grid">
            <div className={`info-card card-wide${contractRows.length >= 6 ? ' list-2cols' : ''}`}>
              <h3>Contrat</h3>
              {contractRows.length > 0 ? (
                <div className="info-list">
                  {contractRows.map((row) => (
                    <span key={row.label}><strong>{row.label}:</strong> {row.value}</span>
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
              <div className="form-grid">
                <label className="form-field">
                  <span>MCC</span>
                  <select
                    className="form-select"
                    value={form.mcc}
                    disabled={isSubmitting}
                    onChange={(e) => setFormField('mcc', e.target.value)}
                  >
                    <option value="">Choisir un MCC</option>
                    {MCC_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Conditions tarifaires */}
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
                    <input className="form-input" value={form.commissionLocaleTpe} disabled={isSubmitting} inputMode="decimal" maxLength={6}
                      onChange={(e) => setFormField('commissionLocaleTpe', sanitizeDecimal(e.target.value, 6))} />
                  </label>
                  <label className="form-field">
                    <span>Commission étrangère TPE</span>
                    <input className="form-input" value={form.commissionEtrangereTpe} disabled={isSubmitting} inputMode="decimal" maxLength={6}
                      onChange={(e) => setFormField('commissionEtrangereTpe', sanitizeDecimal(e.target.value, 6))} />
                  </label>
                  <label className="form-field">
                    <span>Dépôt TPE</span>
                    <input className="form-input" value={form.depotTpe} disabled={isSubmitting} inputMode="decimal" maxLength={10}
                      onChange={(e) => setFormField('depotTpe', sanitizeDecimal(e.target.value, 10))} />
                  </label>
                  <label className="form-field">
                    <span>Prix achat TPE</span>
                    <input className="form-input" value={form.prixAchatTpe} disabled={isSubmitting} inputMode="decimal" maxLength={10}
                      onChange={(e) => setFormField('prixAchatTpe', sanitizeDecimal(e.target.value, 10))} />
                  </label>
                  <label className="form-field">
                    <span>Prix licence TPE</span>
                    <input className="form-input" value={form.prixLicenceTpe} disabled={isSubmitting} inputMode="decimal" maxLength={10}
                      onChange={(e) => setFormField('prixLicenceTpe', sanitizeDecimal(e.target.value, 10))} />
                  </label>
                </div>
              )}

              {isEcommerceRequest && (
                <div className="form-grid">
                  <label className="form-field">
                    <span>Commission locale e-commerce</span>
                    <input className="form-input" value={form.commissionLocaleEcommerce} disabled={isSubmitting} inputMode="decimal" maxLength={6}
                      onChange={(e) => setFormField('commissionLocaleEcommerce', sanitizeDecimal(e.target.value, 6))} />
                  </label>
                  <label className="form-field">
                    <span>Commission étrangère e-commerce</span>
                    <input className="form-input" value={form.commissionEtrangereEcommerce} disabled={isSubmitting} inputMode="decimal" maxLength={6}
                      onChange={(e) => setFormField('commissionEtrangereEcommerce', sanitizeDecimal(e.target.value, 6))} />
                  </label>
                  <label className="form-field">
                    <span>Frais de mise en service</span>
                    <input className="form-input" value={form.fraisMiseEnServiceEcommerce} disabled={isSubmitting} inputMode="decimal" maxLength={10}
                      onChange={(e) => setFormField('fraisMiseEnServiceEcommerce', sanitizeDecimal(e.target.value, 10))} />
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
                    <input className="form-input" value={form.commissionLocaleQrSoftpos} disabled={isSubmitting} inputMode="decimal" maxLength={6}
                      onChange={(e) => setFormField('commissionLocaleQrSoftpos', sanitizeDecimal(e.target.value, 6))} />
                  </label>
                  <label className="form-field">
                    <span>Commission étrangère QR / SoftPOS</span>
                    <input className="form-input" value={form.commissionEtrangereQrSoftpos} disabled={isSubmitting} inputMode="decimal" maxLength={6}
                      onChange={(e) => setFormField('commissionEtrangereQrSoftpos', sanitizeDecimal(e.target.value, 6))} />
                  </label>
                  <label className="form-field">
                    <span>Frais service</span>
                    <input className="form-input" value={form.fraisServiceQrSoftpos} disabled={isSubmitting} inputMode="decimal" maxLength={10}
                      onChange={(e) => setFormField('fraisServiceQrSoftpos', sanitizeDecimal(e.target.value, 10))} />
                  </label>
                  <label className="form-field field-full">
                    <span>Conditions spécifiques</span>
                    <input className="form-input" value={form.conditionsQrSoftpos} disabled={isSubmitting}
                      onChange={(e) => setFormField('conditionsQrSoftpos', e.target.value)} />
                  </label>
                </div>
              )}

              {showServiceOptions && (
                <div className="form-grid">
                  <div className="field-full service-options">
                    <span className="service-options-title">Services LANA CASH</span>
                    <label><input type="checkbox" checked={form.serviceCreditVoucher} disabled={isSubmitting}
                      onChange={(e) => setFormField('serviceCreditVoucher', e.target.checked)} /> Credit Voucher</label>
                    <label><input type="checkbox" checked={form.serviceAnnulation} disabled={isSubmitting}
                      onChange={(e) => setFormField('serviceAnnulation', e.target.checked)} /> Annulation</label>
                    <label><input type="checkbox" checked={form.serviceDcc} disabled={isSubmitting}
                      onChange={(e) => setFormField('serviceDcc', e.target.checked)} /> DCC</label>
                    <label><input type="checkbox" checked={form.servicePreAutorisationCartePresente} disabled={isSubmitting}
                      onChange={(e) => setFormField('servicePreAutorisationCartePresente', e.target.checked)} /> Pré-autorisation Carte présente</label>
                    <label><input type="checkbox" checked={form.servicePreAutorisationCartePresenteConfirmationManuelle} disabled={isSubmitting}
                      onChange={(e) => setFormField('servicePreAutorisationCartePresenteConfirmationManuelle', e.target.checked)} /> Pré-autorisation Carte présente + confirmation manuelle</label>
                    <label><input type="checkbox" checked={form.servicePreAutorisationManuelleConfirmationCartePresente} disabled={isSubmitting}
                      onChange={(e) => setFormField('servicePreAutorisationManuelleConfirmationCartePresente', e.target.checked)} /> Pré-autorisation manuelle + confirmation carte présente</label>
                    <label><input type="checkbox" checked={form.serviceTransactionManuelle} disabled={isSubmitting}
                      onChange={(e) => setFormField('serviceTransactionManuelle', e.target.checked)} /> Transaction manuelle</label>
                    <label><input type="checkbox" checked={form.serviceTransactionManuelleSansCvv} disabled={isSubmitting}
                      onChange={(e) => setFormField('serviceTransactionManuelleSansCvv', e.target.checked)} /> Transaction manuelle sans CVV</label>
                  </div>
                </div>
              )}

              {/* Compte-rendu commercial */}
              <h3>Compte-rendu commercial</h3>

              <div className="form-grid">
                <label className="form-field">
                  <span>Qualification</span>
                  <select className="form-input" value={form.compteRenduQualification} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduQualification', e.target.value)}>
                    <option value="">Choisir</option>
                    {COMMERCIAL_REPORT_QUALIFICATION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>

                {showAcquereurField && (
                  <label className="form-field">
                    <span>Acquéreur *</span>
                    <input className="form-input" value={form.compteRenduAcquereur} disabled={isSubmitting} required
                      onChange={(e) => setFormField('compteRenduAcquereur', e.target.value)} />
                  </label>
                )}

                <label className="form-field">
                  <span>Origine du prospect</span>
                  {isAutoAffiliationRequest ? (
                    <input className="form-input" value="Auto-affiliation" disabled />
                  ) : (
                    <select className="form-input" value={form.compteRenduOrigineProspect} disabled={isSubmitting}
                      onChange={(e) => onOrigineProspectChange(e.target.value)}>
                      <option value="">Choisir</option>
                      {COMMERCIAL_REPORT_ORIGIN_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  )}
                </label>

                {showOrigineDetailField && (
                  <label className="form-field field-full">
                    <span>{origineDetailLabel}</span>
                    <select className="form-input" value={form.compteRenduOrigineProspectDetail} disabled={isSubmitting}
                      onChange={(e) => setFormField('compteRenduOrigineProspectDetail', e.target.value)}>
                      <option value="">Choisir {origineDetailLabel.toLowerCase()}</option>
                      {showCustomOrigineDetailOption && (
                        <option value={form.compteRenduOrigineProspectDetail}>
                          {form.compteRenduOrigineProspectDetail}
                        </option>
                      )}
                      {currentOrigineDetailOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="form-field">
                  <span>Nom et prénom du contact</span>
                  <input className="form-input" value={form.compteRenduContactNomPrenom} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduContactNomPrenom', e.target.value)} />
                </label>

                <label className="form-field">
                  <span>Fonction du contact</span>
                  <input className="form-input" value={form.compteRenduContactFonction} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduContactFonction', e.target.value)} />
                </label>

                <label className="form-field">
                  <span>Acronyme point de vente</span>
                  <input className="form-input" value={form.compteRenduPointVenteAcronyme} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduPointVenteAcronyme', e.target.value)} />
                </label>

                <label className="form-field">
                  <span>Actionnaires</span>
                  <input className="form-input" value={form.compteRenduActionnaires} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduActionnaires', e.target.value)} />
                </label>

                <label className="form-field">
                  <span>Commerçant</span>
                  <input className="form-input" value={form.compteRenduCommercant} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduCommercant', e.target.value)} />
                </label>

                <label className="form-field">
                  <span>Chaîne</span>
                  <input className="form-input" value={form.compteRenduChaine} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduChaine', e.target.value)} />
                </label>

                <label className="form-field field-full">
                  <span>Relations avec autres commerçants LC</span>
                  <input className="form-input" value={form.compteRenduRelationsLc} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduRelationsLc', e.target.value)} />
                </label>

                <label className="form-field">
                  <span>Date ouverture</span>
                  <input type="date" className="form-input" value={form.compteRenduDateOuverture} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduDateOuverture', e.target.value)} />
                </label>

                <label className="form-field">
                  <span>Nombre d'employés</span>
                  <input className="form-input" value={form.compteRenduNombreEmployes} disabled={isSubmitting} inputMode="numeric" maxLength={6}
                    onChange={(e) => setFormField('compteRenduNombreEmployes', sanitizeDigits(e.target.value, 6))} />
                </label>

                <label className="form-field">
                  <span>Activité du commerçant</span>
                  <input className="form-input" value={form.compteRenduActivite} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduActivite', e.target.value)} />
                </label>

                <label className="form-field">
                  <span>Standing du magasin</span>
                  <input className="form-input" value={form.compteRenduStandingMagasin} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduStandingMagasin', e.target.value)} />
                </label>

                <label className="form-field field-full">
                  <span>Nature marchandises / services</span>
                  <textarea className="form-input" rows={3} value={form.compteRenduNatureMarchandises} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduNatureMarchandises', e.target.value)} />
                </label>

                <label className="form-field">
                  <span>Superficie local</span>
                  <select className="form-input" value={form.compteRenduSuperficieLocal} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduSuperficieLocal', e.target.value)}>
                    <option value="">Choisir</option>
                    {COMMERCIAL_REPORT_SURFACE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Statut local</span>
                  <select className="form-input" value={form.compteRenduStatutLocal} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduStatutLocal', e.target.value)}>
                    <option value="">Choisir</option>
                    {COMMERCIAL_REPORT_LOCAL_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Chiffre d'affaires annuel</span>
                  <select className="form-input" value={form.compteRenduChiffreAffairesAnnuel} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduChiffreAffairesAnnuel', e.target.value)}>
                    <option value="">Choisir</option>
                    {COMMERCIAL_REPORT_CA_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Part paiements cartes (%)</span>
                  <input className="form-input" value={form.compteRenduPartPaiementCarte} disabled={isSubmitting} inputMode="decimal" maxLength={6}
                    onChange={(e) => setFormField('compteRenduPartPaiementCarte', sanitizeDecimal(e.target.value, 6))} />
                </label>

                <label className="form-field">
                  <span>Part cartes locales (%)</span>
                  <input className="form-input" value={form.compteRenduPartCarteLocale} disabled={isSubmitting} inputMode="decimal" maxLength={6}
                    onChange={(e) => setFormField('compteRenduPartCarteLocale', sanitizeDecimal(e.target.value, 6))} />
                </label>

                <label className="form-field">
                  <span>Profil commerçant</span>
                  <select className="form-input" value={form.compteRenduProfilCommercant} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduProfilCommercant', e.target.value)}>
                    <option value="">Choisir</option>
                    {COMMERCIAL_REPORT_PROFILE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Appréciation de la visite</span>
                  <select className="form-input" value={form.compteRenduAppreciationVisite} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduAppreciationVisite', e.target.value)}>
                    <option value="">Choisir</option>
                    {COMMERCIAL_REPORT_APPRECIATION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>

                <label className="form-field field-full">
                  <span>Commentaire visite</span>
                  <textarea className="form-input" rows={4} value={form.compteRenduCommentaire} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduCommentaire', e.target.value)} />
                </label>

                <label className="form-field">
                  <span>Fait à</span>
                  <input className="form-input" value={form.compteRenduFaitA} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduFaitA', e.target.value)} />
                </label>

                <label className="form-field">
                  <span>Date visite</span>
                  <input type="date" className="form-input" value={form.compteRenduDateVisite} disabled={isSubmitting}
                    onChange={(e) => setFormField('compteRenduDateVisite', e.target.value)} />
                </label>
              </div>

              <div className="form-actions">
                {!isAutoAffiliationRequest && !isNewPdvRequest && (
                  <button className="btn-secondary" type="button" disabled={isSubmitting} onClick={saveDraft}>
                    Enregistrer brouillon
                  </button>
                )}
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
      </div>

      {requestItem && (
        <div className="print-sheet">
          <header className="print-sheet-head">
            <img src="/logo.png" alt="Lana Cash" className="print-sheet-logo" />
            <div className="print-sheet-title">
              <h1>Fiche d'auto-affiliation</h1>
              <span>
                Dossier #{requestItem.dossierId} · Imprimé le {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date())}
              </span>
            </div>
          </header>

          <div className="print-sheet-grid">
            <section>
              <h2>Identité &amp; activité</h2>
              <div className="print-row-list">
                {[...merchantProfileRows, ...identityRows].map((row) => (
                  <span key={row.label}><strong>{row.label}</strong>{row.value}</span>
                ))}
              </div>
            </section>

            <section>
              <h2>Coordonnées</h2>
              <div className="print-row-list">
                {contactRows.map((row) => (
                  <span key={row.label}><strong>{row.label}</strong>{row.value}</span>
                ))}
              </div>
            </section>

            <section>
              <h2>Produit &amp; configuration</h2>
              <div className="print-row-list">
                {dossierRows.map((row) => (
                  <span key={row.label}><strong>{row.label}</strong>{row.value}</span>
                ))}
                {configurationRows.map((row) => (
                  <span key={row.label}><strong>{row.label}</strong>{row.value}</span>
                ))}
              </div>
            </section>

            <section>
              <h2>Compte-rendu &amp; contrat</h2>
              <div className="print-row-list">
                {[
                  { label: 'Qualification', value: firstMeaningful(requestItem.compteRenduQualification) },
                  { label: 'Appréciation de la visite', value: firstMeaningful(requestItem.compteRenduAppreciationVisite) },
                  ...contractRows
                ]
                  .filter((row) => isMeaningfulValue(row.value))
                  .map((row) => (
                    <span key={row.label}><strong>{row.label}</strong>{row.value}</span>
                  ))}
              </div>
            </section>

            <section className="print-sheet-documents">
              <h2>Documents déposés</h2>
              {documents.length > 0 ? (
                <div className="print-row-list">
                  {documents.map((document) => (
                    <span key={document.documentId}>
                      <strong>{formatEnumLabel(document.typeDocument)}</strong>
                      {document.fileName || 'Non déposé'}
                    </span>
                  ))}
                </div>
              ) : (
                <span>Aucun document déposé sur ce dossier.</span>
              )}
            </section>
          </div>

          <footer className="print-sheet-foot">
            Lana Cash — Portail d'affiliation · Document généré automatiquement, à conserver dans le dossier physique du commerçant.
          </footer>
        </div>
      )}
    </>
  );
}
