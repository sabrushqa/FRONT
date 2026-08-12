import api from '../../../core/api';
import { resolveBackendApiUrl } from '../../../core/apiUrl';

export interface BackOfficeDirectoryItem {
  id: number;
  utilisateurId: number | null;
  nom: string;
  prenom: string;
  email: string;
  matricule: string;
  service: string;
  role: string;
  active: boolean;
  dateCreation: string | null;
  dateActivation: string | null;
}

export interface CommercialeDirectoryItem {
  id: number;
  utilisateurId: number | null;
  nom: string;
  prenom: string;
  email: string;
  matricule: string;
  region: string;
  telephone: string;
  role: string;
  active: boolean;
  dateCreation: string | null;
  dateActivation: string | null;
}

export interface CommercantDirectoryItem {
  id: number;
  utilisateurId: number | null;
  nom: string;
  email: string;
  typeCommercant: string;
  typeAffiliation: string;
  activite: string;
  ville: string;
  region: string;
  telephone: string;
  active: boolean;
  dateCreation: string | null;
  dateActivation: string | null;
}

export interface SupervisorOverviewResponse {
  backOffices: BackOfficeDirectoryItem[];
  commerciales: CommercialeDirectoryItem[];
  commercants: CommercantDirectoryItem[];
}

export interface SupervisorActionResponse {
  message: string;
  dossierId?: number | null;
}

export interface PdvMapItem {
  idPdv: number;
  nomPdv: string;
  ville: string;
  adresse: string;
  quartier: string;
  codePostal: string;
  latitude: number | null;
  longitude: number | null;
  statut: string;
  nomCommercant: string;
  typeCommercant: string;
  typeAffiliation: string;
  region: string;
}

export interface SupervisorPdvMapResponse {
  pdvs: PdvMapItem[];
}

export interface SupervisorTpeStockItem {
  id: string;
  numeroSerie: string;
  modele: string;
  typeCompatible: string;
  typeConnexion: string;
  statut: string;
  actif: boolean;
  commerciale: string;
  commercialeId: number | null;
  commercant: string;
  commercantId: number | null;
  pdv: string;
  dateActivation: string | null;
  dateAffectationCommerciale: string | null;
}

export interface SupervisorTpeStockResponse {
  tpes: SupervisorTpeStockItem[];
}

export interface AffiliationDocumentItem {
  documentId: number;
  typeDocument: string;
  fileName: string;
  dateUpload: string | null;
  statutDocument: string;
  downloadable: boolean;
}

export interface AffiliationRequestItem {
  dossierId: number;
  commercantId: number | null;
  utilisateurId: number | null;
  nomCommercant: string;
  email: string;
  telephone: string;
  telephoneSecondaire: string;
  adresse: string;
  ville: string;
  region: string;
  activite: string;
  secteur: string;
  mcc: string;
  chainePointVente: string;
  nombrePointsVente: number | null;
  typeCommercant: string;
  typeAffiliation: string;
  origineCreation: string;
  prospectStatus: string;
  derniereInteractionCommerciale: string | null;
  prochaineRelanceCommerciale: string | null;
  derniereInteractionType: string;
  prochaineRelanceType: string;
  rib: string;
  nom: string;
  prenom: string;
  cin: string;
  raisonSociale: string;
  rc: string;
  ice: string;
  formeJuridique: string;
  representantLegal: string;
  numeroAutoEntrepreneur: string;
  nomEntite: string;
  objet: string;
  patente: string;
  fonction: string;
  beneficiairesEffectifs: string;
  dateNaissance: string;
  nationalite: string;
  status: string;
  dateCreation: string | null;
  dateSoumission: string | null;
  compteActif: boolean;
  activationEmailSent: boolean;
  commercialAttribue: string;
  commercialAttribueId: number | null;
  backOfficeTraitant: string;
  backOfficeId: number | null;
  backOfficeUtilisateurId: number | null;
  motifRefus: string;
  dateTraitementBackOffice: string | null;
  contractDisponible: boolean;
  contractFileName: string;
  contractGeneratedAt: string | null;
  commercialReportDisponible: boolean;
  commercialReportFileName: string;
  commercialReportGeneratedAt: string | null;
  signedContractDisponible: boolean;
  signedContractFileName: string;
  signedContractUploadedAt: string | null;
  documents: AffiliationDocumentItem[];
  modeMiseADispositionTpe: string;
  nombreTpe: number | null;
  equipementTpe: string;
  connectiviteTpe: string;
  modeServiceEcommerce: string;
  siteMarchandUrl: string;
  applicationMobile: string;
  modeleQrSoftpos: string;
  commissionLocaleTpe: string;
  commissionEtrangereTpe: string;
  depotTpe: string;
  prixAchatTpe: string;
  prixLicenceTpe: string;
  abonnementPackage: string;
  commissionLocaleEcommerce: string;
  commissionEtrangereEcommerce: string;
  fraisMiseEnServiceEcommerce: string;
  commissionLocaleQrSoftpos: string;
  commissionEtrangereQrSoftpos: string;
  fraisServiceQrSoftpos: string;
  conditionsQrSoftpos: string;
  serviceCreditVoucher: boolean;
  serviceAnnulation: boolean;
  serviceDcc: boolean;
  servicePreAutorisationCartePresente: boolean;
  servicePreAutorisationCartePresenteConfirmationManuelle: boolean;
  servicePreAutorisationManuelleConfirmationCartePresente: boolean;
  serviceTransactionManuelle: boolean;
  serviceTransactionManuelleSansCvv: boolean;
  compteRenduQualification: string;
  compteRenduAcquereur: string;
  compteRenduOrigineProspect: string;
  compteRenduOrigineProspectDetail: string;
  compteRenduContactNomPrenom: string;
  compteRenduContactFonction: string;
  compteRenduPointVenteAcronyme: string;
  compteRenduActionnaires: string;
  compteRenduCommercant: string;
  compteRenduChaine: string;
  compteRenduRelationsLc: string;
  compteRenduDateOuverture: string;
  compteRenduNombreEmployes: string;
  compteRenduActivite: string;
  compteRenduMcc: string;
  compteRenduStandingMagasin: string;
  compteRenduNatureMarchandises: string;
  compteRenduSuperficieLocal: string;
  compteRenduStatutLocal: string;
  compteRenduChiffreAffairesAnnuel: string;
  compteRenduPartPaiementCarte: string;
  compteRenduPartCarteLocale: string;
  compteRenduProfilCommercant: string;
  compteRenduAppreciationVisite: string;
  compteRenduCommentaire: string;
  compteRenduFaitA: string;
  compteRenduDateVisite: string;
  dossierPrincipalId: number | null;
  nombreDemandesExtention: number | null;
  requestedPdvNom: string;
  requestedPdvAdresse: string;
  requestedPdvVille: string;
  requestedPdvCodePostal: string;
  requestedPdvTelephone: string;
  requestedPdvEmail: string;
  requestedPdvStatut: string;
  tpeDejaAffecte: boolean;
  nombreCorrections: number;
  dernierMotifCorrection: string;
}

export interface AffiliationActivationPayload {
  mcc: string;
  abonnementPackage: string;
  commissionLocaleTpe: string;
  commissionEtrangereTpe: string;
  depotTpe: string;
  prixAchatTpe: string;
  prixLicenceTpe: string;
  commissionLocaleEcommerce: string;
  commissionEtrangereEcommerce: string;
  fraisMiseEnServiceEcommerce: string;
  commissionLocaleQrSoftpos: string;
  commissionEtrangereQrSoftpos: string;
  fraisServiceQrSoftpos: string;
  conditionsQrSoftpos: string;
  serviceCreditVoucher: boolean;
  serviceAnnulation: boolean;
  serviceDcc: boolean;
  servicePreAutorisationCartePresente: boolean;
  servicePreAutorisationCartePresenteConfirmationManuelle: boolean;
  servicePreAutorisationManuelleConfirmationCartePresente: boolean;
  serviceTransactionManuelle: boolean;
  serviceTransactionManuelleSansCvv: boolean;
  compteRenduQualification: string;
  compteRenduAcquereur: string;
  compteRenduOrigineProspect: string;
  compteRenduOrigineProspectDetail: string;
  compteRenduContactNomPrenom: string;
  compteRenduContactFonction: string;
  compteRenduPointVenteAcronyme: string;
  compteRenduActionnaires: string;
  compteRenduCommercant: string;
  compteRenduChaine: string;
  compteRenduRelationsLc: string;
  compteRenduDateOuverture: string;
  compteRenduNombreEmployes: string;
  compteRenduActivite: string;
  compteRenduMcc: string;
  compteRenduStandingMagasin: string;
  compteRenduNatureMarchandises: string;
  compteRenduSuperficieLocal: string;
  compteRenduStatutLocal: string;
  compteRenduChiffreAffairesAnnuel: string;
  compteRenduPartPaiementCarte: string;
  compteRenduPartCarteLocale: string;
  compteRenduProfilCommercant: string;
  compteRenduAppreciationVisite: string;
  compteRenduCommentaire: string;
  compteRenduFaitA: string;
  compteRenduDateVisite: string;
}

export interface AffiliationReviewPayload {
  decision: 'ACCEPTE' | 'CORRECTION' | 'REFUSE';
  motifRefus: string;
}

export interface AffiliationAbandonPayload {
  motif: string;
}

export interface CommercialAffiliationDraftPayload extends AffiliationActivationPayload {
  typeCommercant: string;
  typeAffiliation: string;
  nom: string;
  prenom: string;
  cin: string;
  raisonSociale: string;
  nomEntite: string;
  activite: string;
  secteur: string;
  mcc: string;
  telephonePrincipal: string;
  telephoneSecondaire: string;
  email: string;
  adresse: string;
  ville: string;
  region: string;
  chainePointVente: string;
  nombrePointsVente: string;
  rc: string;
  ice: string;
  formeJuridique: string;
  representantLegal: string;
  numeroAutoEntrepreneur: string;
  objet: string;
  patente: string;
  fonction: string;
  beneficiairesEffectifs: string;
  dateNaissance: string;
  nationalite: string;
  modeMiseADispositionTpe: string;
  nombreTpe: string;
  equipementTpe: string;
  connectiviteTpe: string;
  modeServiceEcommerce: string;
  siteMarchandUrl: string;
  applicationMobile: string;
  modeleQrSoftpos: string;
  rib: string;
  pointVentesJson: string;
  cinDocumentName: string;
  ribDocumentName: string;
  patenteDocumentName: string;
  statutsDocumentName: string;
  rcDocumentName: string;
  iceDocumentName: string;
  cinRepresentantDocumentName: string;
  pvNominationDocumentName: string;
  attestationAeDocumentName: string;
  cinSignataireDocumentName: string;
  pvAssociationDocumentName: string;
  listeMembresDocumentName: string;
}

export interface StaffAffiliationOverviewResponse {
  requests: AffiliationRequestItem[];
}

export interface CommercialInteractionItem {
  interactionId: number;
  typeInteraction: string;
  resultat: string;
  commentaire: string;
  statut: string;
  dateInteraction: string | null;
  prochaineRelanceDate: string | null;
  prochaineRelanceType: string;
  prospectStatus: string;
  commercialNom: string;
}

export interface CommercialInteractionPayload {
  typeInteraction: string;
  resultat: string;
  commentaire: string;
  statut: string;
  dateInteraction: string;
  prochaineRelanceDate: string;
  prochaineRelanceType: string;
  prospectStatus: string;
}

export interface CommercialInteractionResponse {
  interactions: CommercialInteractionItem[];
  googleCalendarSynced?: boolean | null;
  googleCalendarMessage?: string | null;
  googleCalendarEventUrl?: string | null;
  microsoftCalendarSynced?: boolean | null;
  microsoftCalendarMessage?: string | null;
  microsoftCalendarEventUrl?: string | null;
}

export interface GoogleCalendarStatusResponse {
  configured: boolean;
  connected: boolean;
  message: string;
}

export interface GoogleCalendarAuthorizationResponse {
  authorizationUrl: string;
}

export interface MicrosoftCalendarStatusResponse {
  configured: boolean;
  connected: boolean;
  message: string;
}

export interface MicrosoftCalendarAuthorizationResponse {
  authorizationUrl: string;
}

const supervisorBase = resolveBackendApiUrl('/api/supervisor');
const staffAffiliationBase = resolveBackendApiUrl('/api/staff/affiliations');
const staffGoogleCalendarBase = resolveBackendApiUrl('/api/staff/google-calendar');
const staffMicrosoftCalendarBase = resolveBackendApiUrl('/api/staff/microsoft-calendar');
const notificationsBase = resolveBackendApiUrl('/api/notifications');

export interface NotificationApiItem {
  notificationId: number;
  dossierId: number | null;
  message: string;
  type: string;
  dateEnvoi: string | null;
  read: boolean;
}

export interface NotificationOverviewApiResponse {
  unreadCount: number;
  notifications: NotificationApiItem[];
}

export async function getNotifications(): Promise<NotificationOverviewApiResponse> {
  const res = await api.get<NotificationOverviewApiResponse>(notificationsBase);
  return res.data;
}

export async function markAllNotificationsAsRead(): Promise<NotificationOverviewApiResponse> {
  const res = await api.post<NotificationOverviewApiResponse>(`${notificationsBase}/read-all`, {});
  return res.data;
}

export async function getOverview(): Promise<SupervisorOverviewResponse> {
  const res = await api.get<SupervisorOverviewResponse>(`${supervisorBase}/overview`);
  return res.data;
}

export async function getPdvMap(): Promise<SupervisorPdvMapResponse> {
  const res = await api.get<SupervisorPdvMapResponse>(`${supervisorBase}/pdvs/map`);
  return res.data;
}

export async function regeocoderPdvs(): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(`${supervisorBase}/pdvs/regeocoder`, {});
  return res.data;
}

export async function createBackOffice(payload: {
  nom: string; prenom: string; email: string; matricule: string; service: string;
  peutValiderDossiers: boolean; peutAffecterTpe: boolean; peutGererReclamations: boolean;
}): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(`${supervisorBase}/back-offices`, payload);
  return res.data;
}

export async function createCommerciale(payload: {
  nom: string; prenom: string; email: string; matricule: string; region: string; telephone: string;
}): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(`${supervisorBase}/commerciales`, payload);
  return res.data;
}

export async function changePassword(payload: {
  currentPassword: string; newPassword: string; confirmPassword: string;
}): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(`${supervisorBase}/change-password`, payload);
  return res.data;
}

export async function deactivateBackOffice(id: number): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(`${supervisorBase}/back-offices/${id}/deactivate`, {});
  return res.data;
}

export async function sendBackOfficeActivation(id: number): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(`${supervisorBase}/back-offices/${id}/send-activation`, {});
  return res.data;
}

export async function deactivateCommerciale(id: number): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(`${supervisorBase}/commerciales/${id}/deactivate`, {});
  return res.data;
}

export async function sendCommercialeActivation(id: number): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(`${supervisorBase}/commerciales/${id}/send-activation`, {});
  return res.data;
}

export async function deactivateCommercant(id: number): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(`${supervisorBase}/commercants/${id}/deactivate`, {});
  return res.data;
}

export async function sendCommercantActivation(id: number): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(`${supervisorBase}/commercants/${id}/send-activation`, {});
  return res.data;
}

export async function getTpeStock(): Promise<SupervisorTpeStockResponse> {
  const res = await api.get<SupervisorTpeStockResponse>(`${supervisorBase}/tpes`);
  return res.data;
}

export async function getEligibleTpes(dossierId: number): Promise<SupervisorTpeStockResponse> {
  const res = await api.get<SupervisorTpeStockResponse>(`${supervisorBase}/tpes/eligible`, {
    params: { dossierId }
  });
  return res.data;
}

export async function activateTpe(id: string): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(`${supervisorBase}/tpes/${id}/activate`, {});
  return res.data;
}

export async function deactivateTpe(id: string): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(`${supervisorBase}/tpes/${id}/deactivate`, {});
  return res.data;
}

export async function assignTpeToCommercant(
  id: string, payload: { dossierId: number }
): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(`${supervisorBase}/tpes/${id}/assign-commercant`, payload);
  return res.data;
}

export async function assignAffiliationToCommerciale(
  dossierId: number, payload: { commercialeId: number }
): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(
    `${supervisorBase}/affiliations/${dossierId}/assign`, payload
  );
  return res.data;
}

export async function getAffiliationRequests(): Promise<StaffAffiliationOverviewResponse> {
  const res = await api.get<StaffAffiliationOverviewResponse>(staffAffiliationBase);
  return res.data;
}

export async function getCommercialInteractions(
  dossierId: number
): Promise<CommercialInteractionResponse> {
  const res = await api.get<CommercialInteractionResponse>(
    `${staffAffiliationBase}/${dossierId}/interactions`
  );
  return res.data;
}

export async function addCommercialInteraction(
  dossierId: number,
  payload: CommercialInteractionPayload
): Promise<CommercialInteractionResponse> {
  const res = await api.post<CommercialInteractionResponse>(
    `${staffAffiliationBase}/${dossierId}/interactions`,
    payload
  );
  return res.data;
}

export async function getGoogleCalendarStatus(): Promise<GoogleCalendarStatusResponse> {
  const res = await api.get<GoogleCalendarStatusResponse>(`${staffGoogleCalendarBase}/status`);
  return res.data;
}

export async function beginGoogleCalendarAuthorization(): Promise<GoogleCalendarAuthorizationResponse> {
  const res = await api.post<GoogleCalendarAuthorizationResponse>(
    `${staffGoogleCalendarBase}/authorization`,
    {}
  );
  return res.data;
}

export async function completeGoogleCalendarAuthorization(
  code: string,
  state: string
): Promise<GoogleCalendarStatusResponse> {
  const res = await api.post<GoogleCalendarStatusResponse>(
    `${staffGoogleCalendarBase}/callback`,
    { code, state }
  );
  return res.data;
}

export async function getMicrosoftCalendarStatus(): Promise<MicrosoftCalendarStatusResponse> {
  const res = await api.get<MicrosoftCalendarStatusResponse>(`${staffMicrosoftCalendarBase}/status`);
  return res.data;
}

export async function beginMicrosoftCalendarAuthorization(): Promise<MicrosoftCalendarAuthorizationResponse> {
  const res = await api.post<MicrosoftCalendarAuthorizationResponse>(
    `${staffMicrosoftCalendarBase}/authorization`,
    {}
  );
  return res.data;
}

export async function completeMicrosoftCalendarAuthorization(
  code: string,
  state: string
): Promise<MicrosoftCalendarStatusResponse> {
  const res = await api.post<MicrosoftCalendarStatusResponse>(
    `${staffMicrosoftCalendarBase}/callback`,
    { code, state }
  );
  return res.data;
}

function buildCommercialDraftBody(
  payload: CommercialAffiliationDraftPayload,
  files: Record<string, File | undefined> = {}
): CommercialAffiliationDraftPayload | FormData {
  const activeFiles = Object.entries(files).filter(
    (entry): entry is [string, File] => entry[1] instanceof File
  );
  if (activeFiles.length === 0) {
    return payload;
  }
  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));
  activeFiles.forEach(([key, file]) => {
    formData.append(key, file, file.name);
  });
  return formData;
}

export async function createCommercialDraft(
  payload: CommercialAffiliationDraftPayload,
  files: Record<string, File | undefined> = {}
): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(
    `${staffAffiliationBase}/drafts`,
    buildCommercialDraftBody(payload, files)
  );
  return res.data;
}

export async function saveCommercialDraft(
  dossierId: number,
  payload: CommercialAffiliationDraftPayload,
  files: Record<string, File | undefined> = {}
): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(
    `${staffAffiliationBase}/${dossierId}/draft`,
    buildCommercialDraftBody(payload, files)
  );
  return res.data;
}

export async function completeAffiliationRequest(
  dossierId: number, payload: AffiliationActivationPayload
): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(
    `${staffAffiliationBase}/${dossierId}/complète`,
    payload,
    { timeout: 300_000 } // 5 min — Chromium PDF peut prendre ~90s
  );
  return res.data;
}

export async function reviewAffiliationRequest(
  dossierId: number, payload: AffiliationReviewPayload
): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(`${staffAffiliationBase}/${dossierId}/review`, payload);
  return res.data;
}

export async function abandonAffiliationRequest(
  dossierId: number, payload: AffiliationAbandonPayload
): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(`${staffAffiliationBase}/${dossierId}/abandon`, payload);
  return res.data;
}

export async function forwardAffiliationToBackOffice(dossierId: number): Promise<SupervisorActionResponse> {
  const res = await api.post<SupervisorActionResponse>(`${staffAffiliationBase}/${dossierId}/forward-backoffice`, {});
  return res.data;
}

export async function downloadAffiliationDocument(dossierId: number, documentId: number): Promise<Blob> {
  const res = await api.get(`${staffAffiliationBase}/${dossierId}/documents/${documentId}/download`, { responseType: 'blob' });
  return res.data as Blob;
}

export async function downloadGeneratedContract(dossierId: number): Promise<Blob> {
  const res = await api.get(`${staffAffiliationBase}/${dossierId}/contract/download`, { responseType: 'blob' });
  return res.data as Blob;
}

export async function downloadCommercialReport(dossierId: number): Promise<Blob> {
  const res = await api.get(`${staffAffiliationBase}/${dossierId}/commercial-report/download`, { responseType: 'blob' });
  return res.data as Blob;
}

export async function downloadSignedContract(dossierId: number): Promise<Blob> {
  const res = await api.get(`${staffAffiliationBase}/${dossierId}/contract/signed/download`, { responseType: 'blob' });
  return res.data as Blob;
}

export async function downloadFullDossier(dossierId: number): Promise<Blob> {
  const res = await api.get(`${staffAffiliationBase}/${dossierId}/full-dossier/download`, { responseType: 'blob' });
  return res.data as Blob;
}
