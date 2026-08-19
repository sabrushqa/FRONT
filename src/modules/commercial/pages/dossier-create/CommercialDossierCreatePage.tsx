import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../../../../core/api';
import { resolveBackendApiUrl } from '../../../../core/apiUrl';
import {
  BUSINESS_PROVIDER_OPTIONS,
  LC_MANDATAIRE_OPTIONS,
  UMNIA_BANK_AGENCY_OPTIONS
} from '../../../../core/agencyMandataireOptions';
import { MCC_OPTIONS } from '../../../../core/mccOptions';
import {
  COMMERCIAL_REPORT_APPRECIATION_OPTIONS,
  COMMERCIAL_REPORT_CA_OPTIONS,
  COMMERCIAL_REPORT_LOCAL_STATUS_OPTIONS,
  COMMERCIAL_REPORT_ORIGIN_OPTIONS,
  COMMERCIAL_REPORT_PROFILE_OPTIONS,
  COMMERCIAL_REPORT_QUALIFICATION_OPTIONS,
  COMMERCIAL_REPORT_SURFACE_OPTIONS
} from '../../../../core/commercialReportOptions';
import { useSessionStore } from '../../../../store/sessionStore';
import '../../../../styles/page.shared.scss';
import '../../../../styles/dossier-create.scss';
import SubmitOverlay from '../../../workspace/SubmitOverlay';
import {
  AffiliationRequestItem,
  CommercialAffiliationDraftPayload,
  completeAffiliationRequest,
  createCommercialDraft,
  getAffiliationRequests,
  saveCommercialDraft
} from '../../../supervisor/services/supervisorApi';
import {
  AFFILIATION_PACKAGE_OPTIONS,
  createAffiliationActivationPayload,
  createAffiliationActivationPayloadFromRequest,
  extractApiErrorMessage
} from '../../../supervisor/services/supervisorUiUtils';
import {
  CORRECTION_CATEGORY_OPTIONS,
  CORRECTION_DOCUMENT_OPTIONS,
  CORRECTION_FIELD_OPTIONS,
  parseCorrectionRequest
} from '../../services/correctionRequestUtils';

type CreateStep = 'donnees' | 'negociable' | 'documents' | 'compteRendu';
const MAX_POINTS_VENTE = 10;
const MAX_TPE = 10;
type DocumentKey =
  | 'cinDocument'
  | 'ribDocument'
  | 'patenteDocument'
  | 'statutsDocument'
  | 'rcDocument'
  | 'iceDocument'
  | 'cinRepresentantDocument'
  | 'pvNominationDocument'
  | 'attestationAeDocument'
  | 'cinSignataireDocument'
  | 'pvAssociationDocument'
  | 'listeMembresDocument';

interface SelectOption {
  value: string;
  label: string;
}

interface CityOption extends SelectOption {
  region: string;
}

interface PointVenteFormData {
  nom: string;
  adresse: string;
  ville: string;
  codePostal: string;
  telephone: string;
  email: string;
}

interface DocumentConfig {
  key: DocumentKey;
  label: string;
  hint: string;
  optional?: boolean;
}

const CITY_REGION_OPTIONS: CityOption[] = [
  { value: 'Agadir', label: 'Agadir', region: 'Souss-Massa' },
  { value: 'Al Hoceima', label: 'Al Hoceïma', region: 'Tanger-Tetouan-Al Hoceima' },
  { value: 'Azrou', label: 'Azrou', region: 'Fes-Meknes' },
  { value: 'Beni Mellal', label: 'Béni Mellal', region: 'Beni Mellal-Khenifra' },
  { value: 'Berkane', label: 'Berkane', region: 'Oriental' },
  { value: 'Berrechid', label: 'Berrechid', region: 'Casablanca-Settat' },
  { value: 'Casablanca', label: 'Casablanca', region: 'Casablanca-Settat' },
  { value: 'Dakhla', label: 'Dakhla', region: 'Dakhla-Oued Ed-Dahab' },
  { value: 'El Jadida', label: 'El Jadida', region: 'Casablanca-Settat' },
  { value: 'Errachidia', label: 'Errachidia', region: 'Draa-Tafilalet' },
  { value: 'Essaouira', label: 'Essaouira', region: 'Marrakech-Safi' },
  { value: 'Fes', label: 'Fès', region: 'Fes-Meknes' },
  { value: 'Fquih Ben Salah', label: 'Fquih Ben Salah', region: 'Beni Mellal-Khenifra' },
  { value: 'Guelmim', label: 'Guelmim', region: 'Guelmim-Oued Noun' },
  { value: 'Ifrane', label: 'Ifrane', region: 'Fes-Meknes' },
  { value: 'Kenitra', label: 'Kénitra', region: 'Rabat-Sale-Kenitra' },
  { value: 'Khemisset', label: 'Khémisset', region: 'Rabat-Sale-Kenitra' },
  { value: 'Khenifra', label: 'Khénifra', region: 'Beni Mellal-Khenifra' },
  { value: 'Khouribga', label: 'Khouribga', region: 'Beni Mellal-Khenifra' },
  { value: 'Laayoune', label: 'Laâyoune', region: 'Laayoune-Sakia El Hamra' },
  { value: 'Larache', label: 'Larache', region: 'Tanger-Tetouan-Al Hoceima' },
  { value: 'Marrakech', label: 'Marrakech', region: 'Marrakech-Safi' },
  { value: 'Meknes', label: 'Meknès', region: 'Fes-Meknes' },
  { value: 'Mohammedia', label: 'Mohammedia', region: 'Casablanca-Settat' },
  { value: 'Nador', label: 'Nador', region: 'Oriental' },
  { value: 'Ouarzazate', label: 'Ouarzazate', region: 'Draa-Tafilalet' },
  { value: 'Oued Zem', label: 'Oued Zem', region: 'Beni Mellal-Khenifra' },
  { value: 'Oujda', label: 'Oujda', region: 'Oriental' },
  { value: 'Rabat', label: 'Rabat', region: 'Rabat-Sale-Kenitra' },
  { value: 'Safi', label: 'Safi', region: 'Marrakech-Safi' },
  { value: 'Sale', label: 'Salé', region: 'Rabat-Sale-Kenitra' },
  { value: 'Settat', label: 'Settat', region: 'Casablanca-Settat' },
  { value: 'Sidi Bennour', label: 'Sidi Bennour', region: 'Casablanca-Settat' },
  { value: 'Sidi Kacem', label: 'Sidi Kacem', region: 'Rabat-Sale-Kenitra' },
  { value: 'Tanger', label: 'Tanger', region: 'Tanger-Tetouan-Al Hoceima' },
  { value: 'Tan-Tan', label: 'Tan-Tan', region: 'Guelmim-Oued Noun' },
  { value: 'Taourirt', label: 'Taourirt', region: 'Oriental' },
  { value: 'Taroudant', label: 'Taroudant', region: 'Souss-Massa' },
  { value: 'Taza', label: 'Taza', region: 'Fes-Meknes' },
  { value: 'Temara', label: 'Témara', region: 'Rabat-Sale-Kenitra' },
  { value: 'Tetouan', label: 'Tétouan', region: 'Tanger-Tetouan-Al Hoceima' },
  { value: 'Tiznit', label: 'Tiznit', region: 'Souss-Massa' },
  { value: 'Zagora', label: 'Zagora', region: 'Draa-Tafilalet' }
];

const REGION_OPTIONS: SelectOption[] = Array.from(
  new Map(CITY_REGION_OPTIONS.map((option) => [option.region, { value: option.region, label: option.region }])).values()
);

const ACTIVITE_OPTIONS: SelectOption[] = [
  { value: 'Commerce de detail', label: 'Commerce de détail' },
  { value: 'Commerce de gros', label: 'Commerce de gros' },
  { value: 'Restauration', label: 'Restauration' },
  { value: 'Hotellerie', label: 'Hôtellerie' },
  { value: 'Services aux particuliers', label: 'Services aux particuliers' },
  { value: 'Services aux entreprises', label: 'Services aux entreprises' },
  { value: 'Sante', label: 'Santé' },
  { value: 'Education', label: 'Éducation / Formation' },
  { value: 'Transport', label: 'Transport / Logistique' },
  { value: 'Tourisme', label: 'Tourisme & loisirs' },
  { value: 'Artisanat', label: 'Artisanat' },
  { value: 'Agriculture', label: 'Agriculture / Agroalimentaire' },
  { value: 'Industrie', label: 'Industrie' },
  { value: 'BTP', label: 'BTP / Construction' },
  { value: 'IT', label: 'Informatique / IT' },
  { value: 'Telecom', label: 'Télécommunications' },
  { value: 'Finance', label: 'Finance / Assurance' },
  { value: 'Immobilier', label: 'Immobilier' },
  { value: 'Autres', label: 'Autres' }
];

const SECTEUR_OPTIONS: SelectOption[] = [
  { value: 'Alimentation', label: 'Alimentation & boissons' },
  { value: 'Mode', label: 'Mode & habillement' },
  { value: 'Beaute', label: 'Beauté & cosmétique' },
  { value: 'SantePharma', label: 'Santé & pharmacie' },
  { value: 'MaisonDeco', label: 'Maison & décoration' },
  { value: 'Electronique', label: 'Électronique & électroménager' },
  { value: 'SportLoisirs', label: 'Sport & loisirs' },
  { value: 'CultureDivertissement', label: 'Culture & divertissement' },
  { value: 'Automobile', label: 'Automobile' },
  { value: 'BricolageJardinage', label: 'Bricolage & jardinage' },
  { value: 'VoyagesTourisme', label: 'Voyages & tourisme' },
  { value: 'ServicesEntreprises', label: 'Services aux entreprises' },
  { value: 'ServicesParticuliers', label: 'Services aux particuliers' },
  { value: 'EducationFormation', label: 'Éducation & formation' },
  { value: 'BTPImmobilier', label: 'BTP & immobilier' },
  { value: 'IndustrieSecteur', label: 'Industrie' },
  { value: 'AgricultureAgroalimentaire', label: 'Agriculture & agroalimentaire' },
  { value: 'TransportLogistique', label: 'Transport & logistique' },
  { value: 'TelecomNumerique', label: 'Télécom & numérique' },
  { value: 'FinanceAssurance', label: 'Finance & assurance' },
  { value: 'AutresSecteur', label: 'Autres' }
];

const merchantTypes = [
  { value: 'PERSONNE_PHYSIQUE', label: 'Personne physique' },
  { value: 'PERSONNE_MORALE', label: 'Personne morale' },
  { value: 'AUTO_ENTREPRENEUR', label: 'Auto-entrepreneur' },
  { value: 'ASSOCIATION_FONDATION', label: 'Association / Fondation' }
];

const affiliationTypes = [
  { value: 'TPE', label: 'TPE' },
  { value: 'E_COMMERCE', label: 'E-commerce' },
  { value: 'ENCAISSEMENT_ET_ECOMMERCE', label: 'TPE + E-commerce' },
  { value: 'QR_CODE', label: 'QR Code' },
  { value: 'SOFTPOS', label: 'SoftPOS' }
];

const ecommerceServiceOptions = [
  { value: 'SiteMarchand', label: 'Intégration sur site marchand' },
  { value: 'ApplicationMobile', label: 'Intégration sur application mobile' },
  { value: 'PayByLinkManuel', label: 'PayByLink manuel' },
  { value: 'PayByLinkAutomatique', label: 'PayByLink automatique' }
];

const tpeServiceOptions = [
  { value: 'TPEAutonome', label: 'TPE autonome' },
  { value: 'SoftPos', label: 'Soft Pos' },
  { value: 'TPECentralise', label: 'TPE centralisé' },
  { value: 'MonetiqueIntegree', label: 'Monétique intégrée' }
];

const tpeConnectivityOptions = [
  { value: 'Fixe', label: 'Fixe' },
  { value: 'Mobile', label: 'Mobile' },
  { value: 'ADSL', label: 'ADSL' },
  { value: '4G5G', label: '4G / 5G' },
  { value: 'Wifi', label: 'WIFI' }
];

const qrSoftposModelOptions = [
  { value: 'QRCode', label: 'QR Code' },
  { value: 'SoftPOS', label: 'SoftPOS' }
];

function resolveQrSoftposOptions(typeAffiliation: string) {
  if (typeAffiliation === 'SOFTPOS') return qrSoftposModelOptions.filter((o) => o.value !== 'QRCode');
  if (typeAffiliation === 'QR_CODE') return qrSoftposModelOptions.filter((o) => o.value !== 'SoftPOS');
  return qrSoftposModelOptions;
}

const serviceFields: Array<{ key: keyof CommercialAffiliationDraftPayload; label: string }> = [
  { key: 'serviceCreditVoucher', label: 'Credit Voucher' },
  { key: 'serviceAnnulation', label: 'Annulation' },
  { key: 'serviceDcc', label: 'DCC' },
  { key: 'servicePreAutorisationCartePresente', label: 'Pré-autorisation Carte présente' },
  {
    key: 'servicePreAutorisationCartePresenteConfirmationManuelle',
    label: 'Pré-autorisation Carte présente + confirmation manuelle'
  },
  {
    key: 'servicePreAutorisationManuelleConfirmationCartePresente',
    label: 'Pré-autorisation manuelle + confirmation carte présente'
  },
  { key: 'serviceTransactionManuelle', label: 'Transaction manuelle' },
  { key: 'serviceTransactionManuelleSansCvv', label: 'Transaction manuelle sans CVV' }
];

const stepTabs: Array<{ key: CreateStep; index: number; label: string }> = [
  { key: 'donnees', index: 1, label: 'Données' },
  { key: 'negociable', index: 2, label: 'Négociable' },
  { key: 'documents', index: 3, label: 'Documents' },
  { key: 'compteRendu', index: 4, label: 'Compte rendu' }
];

const documentNamePayloadKeys: Record<DocumentKey, keyof CommercialAffiliationDraftPayload> = {
  cinDocument: 'cinDocumentName',
  ribDocument: 'ribDocumentName',
  patenteDocument: 'patenteDocumentName',
  statutsDocument: 'statutsDocumentName',
  rcDocument: 'rcDocumentName',
  iceDocument: 'iceDocumentName',
  cinRepresentantDocument: 'cinRepresentantDocumentName',
  pvNominationDocument: 'pvNominationDocumentName',
  attestationAeDocument: 'attestationAeDocumentName',
  cinSignataireDocument: 'cinSignataireDocumentName',
  pvAssociationDocument: 'pvAssociationDocumentName',
  listeMembresDocument: 'listeMembresDocumentName'
};

function hasText(value: string | number | null | undefined): boolean {
  return value !== null && value !== undefined && String(value).trim().length > 0;
}

function sanitizeDigits(value: string, maxLength?: number): string {
  const digitsOnly = value.replace(/\D+/g, '');
  return maxLength ? digitsOnly.slice(0, maxLength) : digitsOnly;
}

function sanitizeDecimal(value: string, maxLength?: number): string {
  const cleaned = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
  return maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

// Sans regex globale (Sonar S8786 : "[^\s@]+@[^\s@]+\.[^\s@]+" est signale
// comme motif a backtracking super-lineaire) — verification structurelle
// equivalente : partie locale non vide, un seul "@", domaine avec un "."
// ni en tete ni en fin.
function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;

  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0 || trimmed.includes('@', atIndex + 1)) return false;

  const domain = trimmed.slice(atIndex + 1);
  const dotIndex = domain.lastIndexOf('.');
  return dotIndex > 0 && dotIndex < domain.length - 1;
}

function emptyPointVente(): PointVenteFormData {
  return { nom: '', adresse: '', ville: '', codePostal: '', telephone: '', email: '' };
}

function resolveRegionForVille(ville: string): string {
  return CITY_REGION_OPTIONS.find((option) => option.value === ville)?.region ?? '';
}

function createInitialPayload(): CommercialAffiliationDraftPayload {
  return {
    ...createAffiliationActivationPayload(),
    typeCommercant: 'PERSONNE_PHYSIQUE',
    typeAffiliation: 'TPE',
    nom: '',
    prenom: '',
    cin: '',
    raisonSociale: '',
    nomEntite: '',
    activite: '',
    secteur: '',
    mcc: '',
    telephonePrincipal: '',
    telephoneSecondaire: '',
    email: '',
    adresse: '',
    ville: '',
    region: '',
    chainePointVente: '',
    nombrePointsVente: '',
    rc: '',
    ice: '',
    formeJuridique: '',
    representantLegal: '',
    numeroAutoEntrepreneur: '',
    objet: '',
    patente: '',
    fonction: '',
    beneficiairesEffectifs: '',
    dateNaissance: '',
    nationalite: '',
    modeMiseADispositionTpe: '',
    nombreTpe: '',
    equipementTpe: '',
    connectiviteTpe: '',
    modeServiceEcommerce: '',
    siteMarchandUrl: '',
    applicationMobile: '',
    modeleQrSoftpos: '',
    nombreQrSoftpos: '',
    rib: '',
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

function payloadFromRequest(request: AffiliationRequestItem): CommercialAffiliationDraftPayload {
  return {
    ...createInitialPayload(),
    ...createAffiliationActivationPayloadFromRequest(request),
    typeCommercant: request.typeCommercant || 'PERSONNE_PHYSIQUE',
    typeAffiliation: request.typeAffiliation || 'TPE',
    nom: request.nom || '',
    prenom: request.prenom || '',
    cin: request.cin || '',
    raisonSociale: request.raisonSociale || '',
    nomEntite: request.nomEntite || '',
    activite: request.activite || '',
    secteur: request.secteur || '',
    mcc: request.mcc || '',
    compteRenduMcc: request.compteRenduMcc || request.mcc || '',
    telephonePrincipal: request.telephone || '',
    telephoneSecondaire: request.telephoneSecondaire || '',
    email: request.email || '',
    adresse: request.adresse || '',
    ville: request.ville || '',
    region: resolveRegionForVille(request.ville || '') || request.region || '',
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
    pointVentesJson: '[]'
  };
}

function pointVentesFromRequest(request: AffiliationRequestItem, payload: CommercialAffiliationDraftPayload): PointVenteFormData[] {
  const count = Math.min(Number.parseInt(payload.nombrePointsVente || '0', 10) || 0, MAX_POINTS_VENTE);
  if (count < 1 || payload.typeAffiliation === 'E_COMMERCE') {
    return [];
  }

  const basePointVente: PointVenteFormData = {
    nom:
      request.requestedPdvNom ||
      request.nomCommercant ||
      request.raisonSociale ||
      request.nomEntite ||
      [request.nom, request.prenom].filter(Boolean).join(' ') ||
      'Point de vente principal',
    adresse: request.requestedPdvAdresse || request.adresse || '',
    ville: request.requestedPdvVille || request.ville || '',
    codePostal: request.requestedPdvCodePostal || '',
    telephone: request.requestedPdvTelephone || request.telephone || '',
    email: request.requestedPdvEmail || request.email || ''
  };

  return Array.from({ length: count }, (_, index) =>
    index === 0 ? basePointVente : { ...basePointVente, nom: `${basePointVente.nom} ${index + 1}` }
  );
}

function validateUploadSize(files: Array<File | undefined>): string {
  const activeFiles = files.filter((file): file is File => file instanceof File);
  const maxFileSize = 10 * 1024 * 1024;
  const maxTotalSize = 30 * 1024 * 1024;
  const oversized = activeFiles.find((file) => file.size > maxFileSize);
  if (oversized) {
    return `Le fichier ${oversized.name} dépasse 10 Mo.`;
  }
  const total = activeFiles.reduce((sum, file) => sum + file.size, 0);
  return total > maxTotalSize ? 'La taille totale des documents dépasse 30 Mo.' : '';
}

export default function CommercialDossierCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const params = useParams<{ dossierId: string }>();
  const { session } = useSessionStore();
  const currentDossierId = Number(params.dossierId);
  const isEditMode = Number.isFinite(currentDossierId) && currentDossierId > 0;
  const hasAccess = session?.role === 'COMMERCIAL';

  const [activeStep, setActiveStep] = useState<CreateStep>('donnees');
  const [form, setForm] = useState<CommercialAffiliationDraftPayload>(createInitialPayload);
  const [hasChain, setHasChain] = useState(false);
  const [pointVentes, setPointVentes] = useState<PointVenteFormData[]>([]);
  const [documentNames, setDocumentNames] = useState<Partial<Record<DocumentKey, string>>>({});
  const [documentFiles, setDocumentFiles] = useState<Partial<Record<DocumentKey, File>>>({});
  const [documentMessages, setDocumentMessages] = useState<Partial<Record<DocumentKey, string>>>({});
  const [loadedCorrectionMotif, setLoadedCorrectionMotif] = useState('');
  const [loadedRequestOrigineCreation, setLoadedRequestOrigineCreation] = useState('');
  const [loadedRequestStatus, setLoadedRequestStatus] = useState('');
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtractingRib, setIsExtractingRib] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isCombinedRequest = form.typeAffiliation === 'ENCAISSEMENT_ET_ECOMMERCE';
  const isTpeRequest = form.typeAffiliation === 'TPE' || isCombinedRequest;
  const isEcommerceRequest = form.typeAffiliation === 'E_COMMERCE' || isCombinedRequest;
  const isPureEcommerceRequest = form.typeAffiliation === 'E_COMMERCE';
  const isQrSoftposRequest = form.typeAffiliation === 'SOFTPOS' || form.typeAffiliation === 'QR_CODE';
  const showEncaissementPackage = isTpeRequest || isQrSoftposRequest;
  const showPointVentes = !isPureEcommerceRequest;
  const showPhysicalFields = form.typeCommercant === 'PERSONNE_PHYSIQUE';
  const showMoralFields = form.typeCommercant === 'PERSONNE_MORALE';
  const showAutoEntrepreneurFields = form.typeCommercant === 'AUTO_ENTREPRENEUR';
  const showAssociationFields = form.typeCommercant === 'ASSOCIATION_FONDATION';
  const isAutoAffiliationRequest = loadedRequestOrigineCreation === 'AUTO_AFFILIATION';
  const showAcquereurField = form.compteRenduQualification === 'AFFILIE';

  const filteredVilleOptions = useMemo(
    () => (form.region ? CITY_REGION_OPTIONS.filter((option) => option.region === form.region) : CITY_REGION_OPTIONS),
    [form.region]
  );

  const requiredDocuments = useMemo<DocumentConfig[]>(() => {
    switch (form.typeCommercant) {
      case 'PERSONNE_PHYSIQUE':
        return [
          { key: 'cinDocument', label: 'CIN', hint: 'Copie lisible de la CIN.' },
          { key: 'ribDocument', label: 'RIB', hint: 'Justificatif bancaire récent.' },
          { key: 'patenteDocument', label: 'Patente', hint: 'À joindre si applicable.', optional: true }
        ];
      case 'PERSONNE_MORALE':
        return [
          { key: 'statutsDocument', label: 'Statuts', hint: 'Version signée des statuts.' },
          { key: 'rcDocument', label: 'RC', hint: 'Extrait du registre de commerce.' },
          { key: 'iceDocument', label: 'ICE', hint: "Document mentionnant l'ICE." },
          { key: 'cinRepresentantDocument', label: 'CIN représentant légal', hint: 'Pièce du représentant légal.' },
          { key: 'pvNominationDocument', label: 'PV de nomination', hint: 'PV en vigueur.' },
          { key: 'ribDocument', label: 'RIB', hint: "Justificatif bancaire de l'entreprise." }
        ];
      case 'AUTO_ENTREPRENEUR':
        return [
          { key: 'cinDocument', label: 'CIN', hint: "Pièce d'identité recto-verso." },
          { key: 'attestationAeDocument', label: 'Attestation AE', hint: 'Attestation officielle à jour.' },
          { key: 'ribDocument', label: 'RIB', hint: "Document bancaire lié à l'activité." }
        ];
      case 'ASSOCIATION_FONDATION':
        return [
          { key: 'cinSignataireDocument', label: 'CIN signataire', hint: 'CIN de la personne signataire.' },
          { key: 'pvAssociationDocument', label: 'PV assemblée générale', hint: 'PV le plus récent.' },
          { key: 'statutsDocument', label: 'Statuts', hint: "Statuts signés de l'association." },
          { key: 'listeMembresDocument', label: 'Liste des membres', hint: 'Liste actualisée des membres.' },
          { key: 'ribDocument', label: 'RIB', hint: "Justificatif bancaire de l'entité." }
        ];
      default:
        return [];
    }
  }, [form.typeCommercant]);

  const currentOrigineDetailOptions = useMemo(() => {
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

  const showOrigineDetailField = !isAutoAffiliationRequest && currentOrigineDetailOptions.length > 0;
  const correctionRequest = useMemo(() => parseCorrectionRequest(loadedCorrectionMotif), [loadedCorrectionMotif]);
  const isCorrectionMode =
    searchParams.get('correction') === '1' && loadedRequestStatus === 'INCOMPLET';
  const hasCorrectionRequest = Boolean(
    isCorrectionMode &&
      (correctionRequest.detail ||
        correctionRequest.categories.length ||
        correctionRequest.fields.length ||
        correctionRequest.documents.length)
  );
  const editableCorrectionFields = correctionRequest.fields;
  const showCustomOrigineDetailOption = Boolean(
    form.compteRenduOrigineProspectDetail?.trim() &&
      !currentOrigineDetailOptions.some((option) => option.value === form.compteRenduOrigineProspectDetail)
  );

  useEffect(() => {
    if (!hasAccess || !isEditMode) {
      return;
    }
    let mounted = true;
    setIsLoadingDraft(true);
    setErrorMessage('');
    getAffiliationRequests()
      .then((response) => {
        if (!mounted) return;
        const request = response.requests.find((item) => item.dossierId === currentDossierId);
        if (!request) {
          setErrorMessage('Ce brouillon commercial est introuvable.');
          return;
        }
        const nextPayload = payloadFromRequest(request);
        setForm(nextPayload);
        setHasChain(hasText(nextPayload.chainePointVente));
        setLoadedRequestOrigineCreation(request.origineCreation || '');
        setLoadedRequestStatus(request.status || '');
        setLoadedCorrectionMotif(request.motifRefus || '');
        setPointVentes(pointVentesFromRequest(request, nextPayload));
        setDocumentNames(resolveExistingDocumentNames(request));
      })
      .catch((error) => {
        if (mounted) {
          setErrorMessage(extractApiErrorMessage(error, 'Impossible de charger le brouillon commercial.'));
        }
      })
      .finally(() => {
        if (mounted) setIsLoadingDraft(false);
      });
    return () => {
      mounted = false;
    };
  }, [currentDossierId, hasAccess, isEditMode]);

  function resolveExistingDocumentNames(request: AffiliationRequestItem): Partial<Record<DocumentKey, string>> {
    const names: Partial<Record<DocumentKey, string>> = {};
    request.documents?.forEach((document) => {
      const key = normalizeDocumentKey(document.typeDocument);
      if (key) {
        names[key] = document.fileName;
      }
    });
    return names;
  }

  function normalizeDocumentKey(value: string): DocumentKey | null {
    const normalized = value.replace(/Name$/, '');
    const backendDocumentMap: Record<string, DocumentKey> = {
      PIECE_IDENTITE: 'cinDocument',
      RIB: 'ribDocument',
      ATTESTATION_RIB: 'ribDocument',
      INSCRIPTION_PATENTE: 'patenteDocument',
      PATENTE: 'patenteDocument',
      STATUTS_SOCIETE: 'statutsDocument',
      STATUTS_ASSOCIATION: 'statutsDocument',
      REGISTRE_COMMERCE: 'rcDocument',
      ICE: 'iceDocument',
      CIN_REPRESENTANT_LEGAL: 'cinRepresentantDocument',
      PV_NOMINATION: 'pvNominationDocument',
      ATTESTATION_AUTO_ENTREPRENEUR: 'attestationAeDocument',
      CARTE_AUTO_ENTREPRENEUR: 'attestationAeDocument',
      CIN_SIGNATAIRE: 'cinSignataireDocument',
      PV_ASSOCIATION: 'pvAssociationDocument',
      PV_ASSEMBLEE_GENERALE: 'pvAssociationDocument',
      LISTE_MEMBRES: 'listeMembresDocument'
    };
    if (Object.prototype.hasOwnProperty.call(documentNamePayloadKeys, normalized)) {
      return normalized as DocumentKey;
    }
    return backendDocumentMap[normalized] ?? null;
  }

  function setFormField<K extends keyof CommercialAffiliationDraftPayload>(
    key: K,
    value: CommercialAffiliationDraftPayload[K]
  ) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'mcc' && !prev.compteRenduMcc) {
        next.compteRenduMcc = String(value ?? '');
      }
      return next;
    });
  }

  function onTypeCommercantChange(value: string) {
    setForm((prev) => ({ ...prev, typeCommercant: value }));
    setDocumentFiles({});
    setDocumentNames({});
    setDocumentMessages({});
  }

  function onTypeAffiliationChange(value: string) {
    setForm((prev) => ({
      ...prev,
      typeAffiliation: value,
      nombrePointsVente: value === 'E_COMMERCE' ? '' : prev.nombrePointsVente,
      abonnementPackage: value === 'E_COMMERCE' ? '' : prev.abonnementPackage
    }));
    if (value === 'E_COMMERCE') {
      setPointVentes([]);
    }
  }

  function onNombreTpeChange(value: string) {
    let cleanValue = value.replace(/\D+/g, '');
    if (Number.parseInt(cleanValue, 10) > MAX_TPE) cleanValue = String(MAX_TPE);
    setForm((prev) => ({ ...prev, nombreTpe: cleanValue }));
  }

  function onNombreQrSoftposChange(value: string) {
    let cleanValue = value.replace(/\D+/g, '');
    if (Number.parseInt(cleanValue, 10) > MAX_TPE) cleanValue = String(MAX_TPE);
    setForm((prev) => ({ ...prev, nombreQrSoftpos: cleanValue }));
  }

  function onNombrePointsVenteChange(value: string) {
    let cleanValue = value.replace(/\D+/g, '');
    if (Number.parseInt(cleanValue, 10) > MAX_POINTS_VENTE) cleanValue = String(MAX_POINTS_VENTE);
    setForm((prev) => ({ ...prev, nombrePointsVente: cleanValue }));
    const count = Math.min(Number.parseInt(cleanValue || '0', 10) || 0, MAX_POINTS_VENTE);
    setPointVentes((prev) => {
      const next = [...prev];
      while (next.length < count) next.push(emptyPointVente());
      return next.slice(0, count);
    });
  }

  function onHasChainChange(value: boolean) {
    setHasChain(value);
    if (!value) {
      setForm((prev) => ({ ...prev, chainePointVente: '', compteRenduChaine: '' }));
    }
  }

  function setPointVenteField(index: number, key: keyof PointVenteFormData, value: string) {
    setPointVentes((prev) => prev.map((pointVente, i) => (i === index ? { ...pointVente, [key]: value } : pointVente)));
  }

  function onVilleChange(value: string) {
    setForm((prev) => ({ ...prev, ville: value, region: resolveRegionForVille(value) }));
  }

  function onRegionChange(value: string) {
    setForm((prev) => ({
      ...prev,
      region: value,
      ville: prev.ville && resolveRegionForVille(prev.ville) !== value ? '' : prev.ville
    }));
  }

  function onOrigineProspectChange(value: string) {
    setForm((prev) => ({
      ...prev,
      compteRenduOrigineProspect: value,
      compteRenduOrigineProspectDetail: prev.compteRenduOrigineProspect === value ? prev.compteRenduOrigineProspectDetail : ''
    }));
  }

  async function onDocumentSelected(key: DocumentKey, event: React.ChangeEvent<HTMLInputElement>) {
    if (isCorrectionDocumentLocked(key)) {
      event.target.value = '';
      return;
    }
    const file = event.target.files?.[0];
    setDocumentMessages((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (!file) {
      setDocumentNames((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setDocumentFiles((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setFormField(documentNamePayloadKeys[key], '' as never);
      return;
    }

    const uploadMessage = validateUploadSize([...Object.values(documentFiles), file]);
    if (uploadMessage) {
      event.target.value = '';
      setErrorMessage(uploadMessage);
      return;
    }

    setDocumentNames((prev) => ({ ...prev, [key]: file.name }));
    setDocumentFiles((prev) => ({ ...prev, [key]: file }));
    setFormField(documentNamePayloadKeys[key], file.name as never);

    if (key !== 'ribDocument') {
      setDocumentMessages((prev) => ({ ...prev, [key]: 'Document importé sans vérification automatique.' }));
      return;
    }

    setForm((prev) => ({ ...prev, rib: '' }));
    setIsExtractingRib(true);
    setDocumentMessages((prev) => ({ ...prev, [key]: 'Extraction du RIB en cours...' }));
    try {
      const body = new FormData();
      body.append('documentKey', key);
      body.append('file', file, file.name);
      const response = await api.post<{
        ribExtraction?: { rib?: string | null; iban?: string | null; numeroCompte?: string | null } | null;
      }>(resolveBackendApiUrl('/api/affiliations/documents/validate'), body);
      const extracted = [
        response.data.ribExtraction?.rib,
        response.data.ribExtraction?.iban,
        response.data.ribExtraction?.numeroCompte
      ].find((value) => value?.trim())?.trim();
      if (extracted) {
        setForm((prev) => ({ ...prev, rib: prev.rib.trim() ? prev.rib : extracted }));
        setDocumentMessages((prev) => ({ ...prev, [key]: 'RIB extrait automatiquement.' }));
      } else {
        setDocumentMessages((prev) => ({ ...prev, [key]: 'Document importé. RIB non extrait automatiquement.' }));
      }
    } catch {
      setDocumentMessages((prev) => ({ ...prev, [key]: 'Document importé. Extraction RIB indisponible.' }));
    } finally {
      setIsExtractingRib(false);
    }
  }

  /** Sanitise une valeur qui doit être un entier : ne garde que les chiffres.
   *  Si la valeur est vide ou non numérique, renvoie '' (null côté backend). */
  function sanitizeIntField(value: string | null | undefined): string {
    if (!value) return '';
    const digits = String(value).replace(/\D+/g, '');
    return digits || '';
  }

  function buildPayload(): CommercialAffiliationDraftPayload {
    return {
      ...form,
      chainePointVente: hasChain ? form.chainePointVente : '',
      compteRenduChaine: hasChain ? form.compteRenduChaine : '',
      nombrePointsVente: sanitizeIntField(form.nombrePointsVente),
      nombreTpe: sanitizeIntField(form.nombreTpe),
      nombreQrSoftpos: sanitizeIntField(form.nombreQrSoftpos),
      pointVentesJson: JSON.stringify(
        (showPointVentes ? pointVentes : []).map((pointVente) => ({
          nom: pointVente.nom.trim(),
          adresse: pointVente.adresse.trim(),
          ville: pointVente.ville.trim(),
          codePostal: pointVente.codePostal.trim(),
          telephone: pointVente.telephone.trim(),
          email: pointVente.email.trim()
        }))
      )
    };
  }

  function findMissingDataFieldLabel(): string | null {
    const fields: Array<{ key: string; label: string; value: string | number | null | undefined }> = [
      { key: 'typeCommercant', label: 'Type commerçant', value: form.typeCommercant },
      { key: 'typeAffiliation', label: 'Type affiliation', value: form.typeAffiliation },
      { key: 'activite', label: 'Activité', value: form.activite },
      { key: 'secteur', label: 'Secteur', value: form.secteur },
      { key: 'mcc', label: 'MCC', value: form.mcc },
      { key: 'telephone', label: 'Téléphone principal', value: form.telephonePrincipal },
      { key: 'email', label: 'E-mail', value: form.email },
      { key: 'adresse', label: 'Adresse', value: form.adresse },
      { key: 'ville', label: 'Ville', value: form.ville },
      { key: 'region', label: 'Région', value: form.region },
      { key: 'rib', label: 'RIB', value: form.rib },
      ...(hasChain ? [{ key: 'chainePointVente', label: 'Chaîne point de vente', value: form.chainePointVente }] : []),
      ...merchantRequiredFieldLabels(),
      ...affiliationRequiredFieldLabels()
    ].filter((field) => !hasCorrectionRequest || isCorrectionFieldEditable(field.key));
    const missing = fields.find((field) => !hasText(field.value));
    if (missing) return missing.label;
    if ((!hasCorrectionRequest || isCorrectionFieldEditable('email')) && !isValidEmail(form.email)) return 'E-mail (format invalide)';
    return hasCorrectionRequest && !isCorrectionFieldEditable('pointVente') ? null : findMissingPointVenteLabel();
  }

  function merchantRequiredFieldLabels(): Array<{ key: string; label: string; value: string | number | null | undefined }> {
    switch (form.typeCommercant) {
      case 'PERSONNE_PHYSIQUE':
        return [
          { key: 'nom', label: 'Nom', value: form.nom },
          { key: 'prenom', label: 'Prénom', value: form.prenom },
          { key: 'cin', label: 'CIN', value: form.cin }
        ];
      case 'PERSONNE_MORALE':
        return [
          { key: 'raisonSociale', label: 'Raison sociale', value: form.raisonSociale },
          { key: 'rc', label: 'RC', value: form.rc },
          { key: 'ice', label: 'ICE', value: form.ice },
          { key: 'formeJuridique', label: 'Forme juridique', value: form.formeJuridique },
          { key: 'representantLegal', label: 'Représentant légal', value: form.representantLegal }
        ];
      case 'AUTO_ENTREPRENEUR':
        return [
          { key: 'nom', label: 'Nom', value: form.nom },
          { key: 'prenom', label: 'Prénom', value: form.prenom },
          { key: 'numeroAutoEntrepreneur', label: 'Numéro auto-entrepreneur', value: form.numeroAutoEntrepreneur }
        ];
      case 'ASSOCIATION_FONDATION':
        return [
          { key: 'nomEntite', label: 'Nom entité', value: form.nomEntite },
          { key: 'representantLegal', label: 'Représentant légal', value: form.representantLegal },
          { key: 'objet', label: 'Objet', value: form.objet }
        ];
      default:
        return [];
    }
  }

  function affiliationRequiredFieldLabels(): Array<{ key: string; label: string; value: string | number | null | undefined }> {
    const fields: Array<{ key: string; label: string; value: string | number | null | undefined }> = [];
    if (isTpeRequest) {
      fields.push(
        { key: 'modeMiseADispositionTpe', label: 'Mode de mise à disposition TPE', value: form.modeMiseADispositionTpe },
        { key: 'nombreTpe', label: 'Nombre TPE', value: form.nombreTpe },
        { key: 'equipementTpe', label: 'Équipement TPE', value: form.equipementTpe },
        { key: 'connectiviteTpe', label: 'Connectivité TPE', value: form.connectiviteTpe }
      );
    }
    if (isEcommerceRequest) {
      fields.push(
        { key: 'modeServiceEcommerce', label: 'Mode service e-commerce', value: form.modeServiceEcommerce },
        { key: 'siteMarchandUrl', label: 'Site marchand', value: form.siteMarchandUrl }
      );
    }
    if (isQrSoftposRequest) {
      fields.push(
        { key: 'modeleQrSoftpos', label: 'Modèle QR / SoftPOS', value: form.modeleQrSoftpos },
        { key: 'nombreQrSoftpos', label: 'Nombre QR / SoftPOS', value: form.nombreQrSoftpos }
      );
    }
    return fields;
  }

  function findMissingPointVenteLabel(): string | null {
    if (!showPointVentes) return null;
    const expectedCount = Number.parseInt(form.nombrePointsVente || '0', 10);
    if (!Number.isFinite(expectedCount) || expectedCount < 1) return 'Nombre points de vente';
    for (let index = 0; index < expectedCount; index += 1) {
      const pointVente = pointVentes[index];
      const prefix = `Point de vente ${index + 1}`;
      const missing = [
        { label: `${prefix} - nom`, value: pointVente?.nom },
        { label: `${prefix} - adresse`, value: pointVente?.adresse },
        { label: `${prefix} - ville`, value: pointVente?.ville },
        { label: `${prefix} - téléphone`, value: pointVente?.telephone }
      ].find((field) => !hasText(field.value));
      if (missing) return missing.label;
    }
    return null;
  }

  function findMissingNegotiableFieldLabel(): string | null {
    let fields: Array<{ key: string; label: string; value: string | number | null | undefined }> = [];
    if (isTpeRequest) {
      fields.push(
        { key: 'abonnementPackage', label: 'Abonnement', value: form.abonnementPackage },
        { key: 'commissionLocaleTpe', label: 'Commission locale TPE', value: form.commissionLocaleTpe },
        { key: 'commissionEtrangereTpe', label: 'Commission étrangère TPE', value: form.commissionEtrangereTpe },
        { key: 'depotTpe', label: 'Dépôt TPE', value: form.depotTpe },
        { key: 'prixAchatTpe', label: 'Prix achat TPE', value: form.prixAchatTpe },
        { key: 'prixLicenceTpe', label: 'Prix licence TPE', value: form.prixLicenceTpe }
      );
    }
    if (isEcommerceRequest) {
      fields.push(
        { key: 'commissionLocaleEcommerce', label: 'Commission locale e-commerce', value: form.commissionLocaleEcommerce },
        { key: 'commissionEtrangereEcommerce', label: 'Commission étrangère e-commerce', value: form.commissionEtrangereEcommerce },
        { key: 'fraisMiseEnServiceEcommerce', label: 'Frais de mise en service', value: form.fraisMiseEnServiceEcommerce }
      );
    }
    if (isQrSoftposRequest) {
      fields.push(
        { key: 'abonnementPackage', label: 'Abonnement', value: form.abonnementPackage },
        { key: 'commissionLocaleQrSoftpos', label: 'Commission locale QR / SoftPOS', value: form.commissionLocaleQrSoftpos },
        { key: 'commissionEtrangereQrSoftpos', label: 'Commission étrangère QR / SoftPOS', value: form.commissionEtrangereQrSoftpos },
        { key: 'fraisServiceQrSoftpos', label: 'Frais service QR / SoftPOS', value: form.fraisServiceQrSoftpos }
      );
    }
    fields = fields.filter((field) => !hasCorrectionRequest || isCorrectionFieldEditable(field.key));
    return fields.find((field) => !hasText(field.value))?.label ?? null;
  }

  function findMissingDocumentLabel(): string | null {
    const missing = requiredDocuments
      .filter((document) =>
        hasCorrectionRequest ? correctionRequest.documents.includes(document.key) : !document.optional
      )
      .find((document) => !documentNames[document.key] && !documentFiles[document.key]);
    return missing ? `Document ${missing.label}` : null;
  }

  function findMissingReportFieldLabel(): string | null {
    const fields: Array<{ key: string; label: string; value: string | number | null | undefined }> = [
      { key: 'compteRenduQualification', label: 'Qualification', value: form.compteRenduQualification },
      { key: 'compteRenduOrigineProspect', label: 'Origine prospect', value: form.compteRenduOrigineProspect },
      { key: 'compteRenduContactNomPrenom', label: 'Contact nom/prénom', value: form.compteRenduContactNomPrenom },
      { key: 'compteRenduContactFonction', label: 'Contact fonction', value: form.compteRenduContactFonction },
      { key: 'compteRenduPointVenteAcronyme', label: 'Point de vente acronyme', value: form.compteRenduPointVenteAcronyme },
      { key: 'compteRenduCommercant', label: 'Commerçant', value: form.compteRenduCommercant },
      ...(hasChain ? [{ key: 'compteRenduChaine', label: 'Chaîne', value: form.compteRenduChaine }] : []),
      { key: 'compteRenduActivite', label: 'Activité compte rendu', value: form.compteRenduActivite },
      { key: 'compteRenduMcc', label: 'MCC compte rendu', value: form.compteRenduMcc },
      { key: 'compteRenduStandingMagasin', label: 'Standing magasin', value: form.compteRenduStandingMagasin },
      { key: 'compteRenduNatureMarchandises', label: 'Nature marchandises / services', value: form.compteRenduNatureMarchandises },
      { key: 'compteRenduSuperficieLocal', label: 'Superficie local', value: form.compteRenduSuperficieLocal },
      { key: 'compteRenduStatutLocal', label: 'Statut local', value: form.compteRenduStatutLocal },
      { key: 'compteRenduChiffreAffairesAnnuel', label: 'CA annuel', value: form.compteRenduChiffreAffairesAnnuel },
      { key: 'compteRenduPartPaiementCarte', label: 'Part paiements cartes', value: form.compteRenduPartPaiementCarte },
      { key: 'compteRenduPartCarteLocale', label: 'Part cartes locales', value: form.compteRenduPartCarteLocale },
      { key: 'compteRenduProfilCommercant', label: 'Profil commerçant', value: form.compteRenduProfilCommercant },
      { key: 'compteRenduAppreciationVisite', label: 'Appréciation de la visite', value: form.compteRenduAppreciationVisite },
      { key: 'compteRenduFaitA', label: 'Fait à', value: form.compteRenduFaitA },
      { key: 'compteRenduDateVisite', label: 'Date visite', value: form.compteRenduDateVisite }
    ].filter((field) => !hasCorrectionRequest || isCorrectionFieldEditable(field.key));
    if (showAcquereurField && (!hasCorrectionRequest || isCorrectionFieldEditable('compteRenduAcquereur'))) {
      fields.push({ key: 'compteRenduAcquereur', label: 'Acquéreur', value: form.compteRenduAcquereur });
    }
    return fields.find((field) => !hasText(field.value))?.label ?? null;
  }

  function firstBlockingStep(): CreateStep | null {
    if (findMissingDataFieldLabel()) return 'donnees';
    if (findMissingNegotiableFieldLabel()) return 'negociable';
    if (findMissingDocumentLabel()) return 'documents';
    if (findMissingReportFieldLabel()) return 'compteRendu';
    return null;
  }

  function firstMissingFieldLabel(): string | null {
    return (
      findMissingDataFieldLabel() ||
      findMissingNegotiableFieldLabel() ||
      findMissingDocumentLabel() ||
      findMissingReportFieldLabel()
    );
  }

  const canGenerateContract = firstBlockingStep() === null;
  const generateContractHint = canGenerateContract
    ? 'Le dossier est prêt pour la génération du contrat.'
    : `Veuillez remplir: ${firstMissingFieldLabel()}.`;

  function goBack() {
    const isAutoContinueRoute = location.pathname.includes('/commercial/dossiers/');
    navigate(isEditMode && !isAutoAffiliationRequest && !isAutoContinueRoute ? '/commercial/demandes-commerciales' : '/commercial/dossiers');
  }

  async function persist(finalizeRequest: boolean) {
    if (isSubmitting) return;
    if (finalizeRequest && !canGenerateContract) {
      setErrorMessage(generateContractHint);
      const blockingStep = firstBlockingStep();
      if (blockingStep) setActiveStep(blockingStep);
      return;
    }
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const payload = buildPayload();
      const response = isEditMode
        ? await saveCommercialDraft(currentDossierId, payload, documentFiles)
        : await createCommercialDraft(payload, documentFiles);
      const dossierId = response.dossierId ?? currentDossierId;
      if (finalizeRequest && dossierId) {
        const completeResponse = await completeAffiliationRequest(dossierId, payload);
        setSuccessMessage(completeResponse.message);
      } else {
        setSuccessMessage(response.message);
      }
      navigate(isAutoAffiliationRequest ? '/commercial/dossiers' : '/commercial/demandes-commerciales');
    } catch (error) {
      setErrorMessage(
        extractApiErrorMessage(
          error,
          finalizeRequest ? 'Impossible de finaliser cette demande commerciale.' : "Impossible d'enregistrer le brouillon."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function saveDraft(event: React.FormEvent) {
    event.preventDefault();
    if (!isAutoAffiliationRequest) {
      void persist(false);
    }
  }

  function finalizeRequest(event: React.MouseEvent) {
    event.preventDefault();
    void persist(true);
  }

  function correctionLabels(values: string[], options: Array<{ value: string; label: string }>): string {
    return values
      .map((value) => options.find((option) => option.value === value)?.label ?? value)
      .join(', ');
  }

  function isCorrectionFieldEditable(...keys: string[]): boolean {
    if (!hasCorrectionRequest) return true;
    return keys.some((key) => {
      if (editableCorrectionFields.includes(key)) return true;
      if (key.startsWith('compteRendu') && editableCorrectionFields.includes('compteRendu')) return true;
      if (['commissionLocaleTpe', 'commissionEtrangereTpe', 'depotTpe', 'prixAchatTpe', 'prixLicenceTpe',
        'commissionLocaleEcommerce', 'commissionEtrangereEcommerce', 'fraisMiseEnServiceEcommerce',
        'commissionLocaleQrSoftpos', 'commissionEtrangereQrSoftpos', 'fraisServiceQrSoftpos', 'conditionsQrSoftpos'
      ].includes(key) && editableCorrectionFields.includes('commissions')) return true;
      if (['telephonePrincipal', 'telephoneSecondaire'].includes(key) && editableCorrectionFields.includes('telephone')) return true;
      if (['mcc', 'compteRenduMcc'].includes(key) && editableCorrectionFields.includes('mcc')) return true;
      if (key.startsWith('service') && editableCorrectionFields.includes('services')) return true;
      return false;
    });
  }

  function isCorrectionFieldLocked(...keys: string[]): boolean {
    return !isCorrectionFieldEditable(...keys);
  }

  function isCorrectionDocumentLocked(key: DocumentKey): boolean {
    return hasCorrectionRequest && !correctionRequest.documents.includes(key);
  }

  function renderSelect(options: SelectOption[], placeholder = 'Choisir') {
    return (
      <>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </>
    );
  }

  function renderInput(
    label: string,
    key: keyof CommercialAffiliationDraftPayload,
    options?: SelectOption[],
    props: React.InputHTMLAttributes<HTMLInputElement> & React.SelectHTMLAttributes<HTMLSelectElement> = {},
    fieldOptions: { sanitize?: 'digits' | 'decimal'; maxLength?: number } = {}
  ) {
    const value = String(form[key] ?? '');
    const lockedByCorrection = isCorrectionFieldLocked(String(key));
    function handleInputChange(raw: string) {
      let next = raw;
      if (fieldOptions.sanitize === 'digits') next = sanitizeDigits(next);
      if (fieldOptions.sanitize === 'decimal') next = sanitizeDecimal(next);
      if (fieldOptions.maxLength) next = next.slice(0, fieldOptions.maxLength);
      setFormField(key, next as never);
    }
    return (
      <label className={`form-group ${lockedByCorrection ? 'is-correction-locked' : ''} ${props.className ?? ''}`}>
        <span>{label}</span>
        {options ? (
          <select
            className="form-select"
            value={value}
            disabled={isSubmitting || props.disabled || lockedByCorrection}
            onChange={(event) => setFormField(key, event.target.value as never)}
          >
            {renderSelect(options)}
          </select>
        ) : (
          <input
            className="form-input"
            value={value}
            disabled={isSubmitting || props.disabled || lockedByCorrection}
            type={props.type ?? 'text'}
            inputMode={
              fieldOptions.sanitize === 'digits'
                ? 'numeric'
                : fieldOptions.sanitize === 'decimal'
                  ? 'decimal'
                  : props.inputMode
            }
            maxLength={fieldOptions.maxLength ?? props.maxLength}
            onChange={(event) => handleInputChange(event.target.value)}
          />
        )}
      </label>
    );
  }

  if (!hasAccess) {
    return (
      <div className="access-card">
        <strong>Accès indisponible</strong>
        <span>Cette création de demande est réservée au poste commercial.</span>
      </div>
    );
  }

  return (
    <>
    <SubmitOverlay visible={isSubmitting} accent="yellow" label="Traitement en cours…" />
    <div className="page-grid commercial-mode">
      <div className="page-card">
        <div className="page-head">
          <div>
            <span className="page-kicker">Affiliation par la commerciale</span>
            <h2>{isCorrectionMode ? 'Corriger la demande' : isEditMode ? 'Compléter la demande' : 'Nouvelle demande'}</h2>
            <p>Un seul formulaire, organisé en 4 étapes. Le dossier est transmis au back office après validation.</p>
          </div>
          <div className="header-actions">
            <button className="btn-secondary" type="button" onClick={goBack}>
              Retour à la liste
            </button>
          </div>
        </div>

        {errorMessage && <div className="page-alert error">{errorMessage}</div>}
        {successMessage && <div className="page-alert success">{successMessage}</div>}
        {hasCorrectionRequest && (
          <div className="page-alert warning correction-summary" role="note">
            <strong>Corrections demandées par BOA</strong>
            {correctionRequest.categories.length > 0 && (
              <span>Type: {correctionLabels(correctionRequest.categories, CORRECTION_CATEGORY_OPTIONS)}</span>
            )}
            {correctionRequest.fields.length > 0 && (
              <span>Champs: {correctionLabels(correctionRequest.fields, CORRECTION_FIELD_OPTIONS)}</span>
            )}
            {correctionRequest.documents.length > 0 && (
              <span>Documents: {correctionLabels(correctionRequest.documents, CORRECTION_DOCUMENT_OPTIONS)}</span>
            )}
            {correctionRequest.detail && <span>Motif: {correctionRequest.detail}</span>}
          </div>
        )}

        {isLoadingDraft && (
          <div className="page-loading">
            <span className="page-loading-spinner" />
            <span>Chargement du brouillon commercial...</span>
          </div>
        )}

        <div className="step-tabs">
          {stepTabs.map((step) => (
            <button
              key={step.key}
              type="button"
              className={activeStep === step.key ? 'is-active' : ''}
              onClick={() => setActiveStep(step.key)}
            >
              <span>{step.index}</span> {step.label}
            </button>
          ))}
        </div>
      </div>

      {!isLoadingDraft && (
        <div className="page-card">
          <form noValidate onSubmit={saveDraft}>
            {activeStep === 'donnees' && (
              <section>
                <div className="section-head">
                  <div>
                    <span className="page-kicker">Étape 1</span>
                    <h3>Données de la demande</h3>
                  </div>
                </div>

                <div className="form-grid">
                  <label className="form-group">
                    <span>Type commerçant</span>
                    <select
                      className="form-select"
                      value={form.typeCommercant}
                      disabled={isSubmitting || isCorrectionFieldLocked('typeCommercant')}
                      onChange={(event) => onTypeCommercantChange(event.target.value)}
                    >
                      {merchantTypes.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-group">
                    <span>Type d'affiliation</span>
                    <select
                      className="form-select"
                      value={form.typeAffiliation}
                      disabled={isSubmitting || isCorrectionFieldLocked('typeAffiliation')}
                      onChange={(event) => onTypeAffiliationChange(event.target.value)}
                    >
                      {affiliationTypes.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {(showPhysicalFields || showAutoEntrepreneurFields) && (
                    <>
                      {renderInput('Nom', 'nom')}
                      {renderInput('Prénom', 'prenom')}
                      {showPhysicalFields && renderInput('CIN', 'cin', undefined, {}, { maxLength: 12 })}
                      {showAutoEntrepreneurFields && renderInput('Numéro auto-entrepreneur', 'numeroAutoEntrepreneur', undefined, {}, { sanitize: 'digits', maxLength: 15 })}
                      {renderInput('Date de naissance', 'dateNaissance', undefined, { type: 'date' })}
                      {renderInput('Nationalité', 'nationalite')}
                      {renderInput('Taxe professionnelle', 'patente', undefined, {}, { sanitize: 'digits', maxLength: 20 })}
                    </>
                  )}

                  {showMoralFields && (
                    <>
                      {renderInput('Raison sociale', 'raisonSociale')}
                      {renderInput('RC', 'rc', undefined, {}, { sanitize: 'digits', maxLength: 20 })}
                      {renderInput('ICE', 'ice', undefined, {}, { sanitize: 'digits', maxLength: 15 })}
                      {renderInput('Forme juridique', 'formeJuridique')}
                      {renderInput('Fonction du signataire', 'fonction')}
                      {renderInput('Taxe professionnelle', 'patente', undefined, {}, { sanitize: 'digits', maxLength: 20 })}
                      {renderInput('Bénéficiaires effectifs', 'beneficiairesEffectifs')}
                    </>
                  )}

                  {showAssociationFields && (
                    <>
                      {renderInput('Nom entité', 'nomEntite')}
                      {renderInput('Objet', 'objet')}
                      {renderInput('Fonction du signataire', 'fonction')}
                      {renderInput('Bénéficiaires effectifs', 'beneficiairesEffectifs')}
                    </>
                  )}

                  {renderInput('Représentant légal', 'representantLegal')}
                  {renderInput('E-mail', 'email', undefined, { type: 'email' })}
                  {renderInput('Téléphone principal', 'telephonePrincipal', undefined, {}, { sanitize: 'digits', maxLength: 10 })}
                  {renderInput('Téléphone secondaire', 'telephoneSecondaire', undefined, {}, { sanitize: 'digits', maxLength: 10 })}
                  {renderInput('Adresse', 'adresse', undefined, { className: 'field-full' })}

                  <label className="form-group">
                    <span>Ville</span>
                    <select
                      className="form-select"
                      value={form.ville}
                      disabled={isSubmitting || isCorrectionFieldLocked('ville')}
                      onChange={(event) => onVilleChange(event.target.value)}
                    >
                      {renderSelect(filteredVilleOptions, 'Choisir une ville')}
                    </select>
                  </label>
                  <label className="form-group">
                    <span>Région</span>
                    <select
                      className="form-select"
                      value={form.region}
                      disabled={isSubmitting || isCorrectionFieldLocked('region')}
                      onChange={(event) => onRegionChange(event.target.value)}
                    >
                      {renderSelect(REGION_OPTIONS, 'Choisir une région')}
                    </select>
                  </label>

                  {renderInput('Activité', 'activite', ACTIVITE_OPTIONS)}
                  {renderInput('Secteur', 'secteur', SECTEUR_OPTIONS)}
                  {renderInput('MCC', 'mcc', MCC_OPTIONS)}
                  {/* Le RIB n'est saisi qu'a l'etape "Documents" (juste apres l'import du
                      justificatif bancaire, dont l'extraction le pre-remplit) : le dupliquer
                      ici creait deux champs RIB avec la meme valeur dans le formulaire. */}
                  <label className="form-group">
                    <span>Rattaché à une chaîne ?</span>
                    <select
                      className="form-select"
                      value={hasChain ? 'oui' : 'non'}
                      disabled={isSubmitting || isCorrectionFieldLocked('chainePointVente')}
                      onChange={(event) => onHasChainChange(event.target.value === 'oui')}
                    >
                      <option value="non">Non</option>
                      <option value="oui">Oui</option>
                    </select>
                  </label>
                  {hasChain && renderInput('Chaîne point de vente', 'chainePointVente')}

                  <label className="form-group">
                    <span>Nombre points de vente</span>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      max={MAX_POINTS_VENTE}
                      step={1}
                      value={form.nombrePointsVente}
                      disabled={isSubmitting || isPureEcommerceRequest || isCorrectionFieldLocked('pointVente')}
                      onChange={(event) => onNombrePointsVenteChange(event.target.value)}
                    />
                  </label>

                  {isTpeRequest && (
                    <>
                      {renderInput('Mode de mise à disposition TPE', 'modeMiseADispositionTpe', tpeServiceOptions)}
                      <label className="form-group">
                        <span>Nombre TPE</span>
                        <input
                          className="form-input"
                          type="number"
                          min={1}
                          max={MAX_TPE}
                          step={1}
                          value={form.nombreTpe}
                          disabled={isSubmitting || isCorrectionFieldLocked('nombreTpe')}
                          onChange={(event) => onNombreTpeChange(event.target.value)}
                        />
                      </label>
                      {renderInput('Équipement TPE', 'equipementTpe', tpeServiceOptions)}
                      {renderInput('Connectivité TPE', 'connectiviteTpe', tpeConnectivityOptions)}
                    </>
                  )}

                  {isEcommerceRequest && (
                    <>
                      {renderInput('Mode service e-commerce', 'modeServiceEcommerce', ecommerceServiceOptions)}
                      {renderInput('Site marchand', 'siteMarchandUrl')}
                      {renderInput('Application mobile', 'applicationMobile')}
                    </>
                  )}

                  {isQrSoftposRequest && (
                    <>
                      {renderInput('Modèle QR / SoftPOS', 'modeleQrSoftpos', resolveQrSoftposOptions(form.typeAffiliation))}
                      <label className="form-group">
                        <span>Nombre QR / SoftPOS</span>
                        <input
                          className="form-input"
                          type="number"
                          min={1}
                          max={MAX_TPE}
                          step={1}
                          value={form.nombreQrSoftpos}
                          disabled={isSubmitting || isCorrectionFieldLocked('nombreQrSoftpos')}
                          onChange={(event) => onNombreQrSoftposChange(event.target.value)}
                        />
                      </label>
                    </>
                  )}

                  {(isTpeRequest || isQrSoftposRequest) && (
                    <div className="field-full service-options">
                      <span className="service-options-title">Services LANA CASH</span>
                      {serviceFields.map((field) => (
                        <label key={field.key}>
                          <input
                            type="checkbox"
                            checked={Boolean(form[field.key])}
                            disabled={isSubmitting || isCorrectionFieldLocked(String(field.key))}
                            onChange={(event) => setFormField(field.key, event.target.checked as never)}
                          />
                          {field.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {showPointVentes && pointVentes.length > 0 && (
                  <div className="point-vente-list">
                    {pointVentes.map((pointVente, index) => (
                      <div className="point-vente-card" key={index}>
                        <h4>Point de vente {index + 1}</h4>
                        <div className="form-grid">
                          <label className="form-group">
                            <span>Nom du point de vente</span>
                            <input
                            className="form-input"
                            value={pointVente.nom}
                              disabled={isSubmitting || isCorrectionFieldLocked('pointVente')}
                              onChange={(event) => setPointVenteField(index, 'nom', event.target.value)}
                            />
                          </label>
                          <label className="form-group field-full">
                            <span>Adresse</span>
                            <input
                            className="form-input"
                            value={pointVente.adresse}
                              disabled={isSubmitting || isCorrectionFieldLocked('pointVente')}
                              onChange={(event) => setPointVenteField(index, 'adresse', event.target.value)}
                            />
                          </label>
                          <label className="form-group">
                            <span>Ville</span>
                            <select
                              className="form-select"
                              value={pointVente.ville}
                              disabled={isSubmitting || isCorrectionFieldLocked('pointVente')}
                              onChange={(event) => setPointVenteField(index, 'ville', event.target.value)}
                            >
                              {renderSelect(CITY_REGION_OPTIONS, 'Choisir une ville')}
                            </select>
                          </label>
                          <label className="form-group">
                            <span>Code postal</span>
                            <input
                              className="form-input"
                              value={pointVente.codePostal}
                              disabled={isSubmitting || isCorrectionFieldLocked('pointVente')}
                              inputMode="numeric"
                              maxLength={5}
                              onChange={(event) => setPointVenteField(index, 'codePostal', sanitizeDigits(event.target.value, 5))}
                            />
                          </label>
                          <label className="form-group">
                            <span>Téléphone</span>
                            <input
                              className="form-input"
                              value={pointVente.telephone}
                              disabled={isSubmitting || isCorrectionFieldLocked('pointVente')}
                              inputMode="numeric"
                              maxLength={10}
                              onChange={(event) => setPointVenteField(index, 'telephone', sanitizeDigits(event.target.value, 10))}
                            />
                          </label>
                          <label className="form-group">
                            <span>E-mail</span>
                            <input
                              className="form-input"
                              type="email"
                              value={pointVente.email}
                              disabled={isSubmitting || isCorrectionFieldLocked('pointVente')}
                              onChange={(event) => setPointVenteField(index, 'email', event.target.value)}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeStep === 'negociable' && (
              <section>
                <div className="section-head">
                  <div>
                    <span className="page-kicker">Étape 2</span>
                    <h3>Champs négociables</h3>
                  </div>
                </div>
                <div className="form-grid">
                  {showEncaissementPackage && renderInput('Abonnement', 'abonnementPackage', AFFILIATION_PACKAGE_OPTIONS)}
                  {isTpeRequest && (
                    <>
                      {renderInput('Commission locale TPE', 'commissionLocaleTpe', undefined, {}, { sanitize: 'decimal', maxLength: 6 })}
                      {renderInput('Commission étrangère TPE', 'commissionEtrangereTpe', undefined, {}, { sanitize: 'decimal', maxLength: 6 })}
                      {renderInput('Dépôt TPE', 'depotTpe', undefined, {}, { sanitize: 'decimal', maxLength: 10 })}
                      {renderInput('Prix achat TPE', 'prixAchatTpe', undefined, {}, { sanitize: 'decimal', maxLength: 10 })}
                      {renderInput('Prix licence TPE', 'prixLicenceTpe', undefined, {}, { sanitize: 'decimal', maxLength: 10 })}
                    </>
                  )}
                  {isEcommerceRequest && (
                    <>
                      {renderInput('Commission locale e-commerce', 'commissionLocaleEcommerce', undefined, {}, { sanitize: 'decimal', maxLength: 6 })}
                      {renderInput('Commission étrangère e-commerce', 'commissionEtrangereEcommerce', undefined, {}, { sanitize: 'decimal', maxLength: 6 })}
                      {renderInput('Frais de mise en service', 'fraisMiseEnServiceEcommerce', undefined, {}, { sanitize: 'decimal', maxLength: 10 })}
                    </>
                  )}
                  {isQrSoftposRequest && (
                    <>
                      {renderInput('Commission locale QR / SoftPOS', 'commissionLocaleQrSoftpos', undefined, {}, { sanitize: 'decimal', maxLength: 6 })}
                      {renderInput('Commission étrangère QR / SoftPOS', 'commissionEtrangereQrSoftpos', undefined, {}, { sanitize: 'decimal', maxLength: 6 })}
                      {renderInput('Frais service', 'fraisServiceQrSoftpos', undefined, {}, { sanitize: 'decimal', maxLength: 10 })}
                      {renderInput('Conditions spécifiques', 'conditionsQrSoftpos', undefined, { className: 'field-full' })}
                    </>
                  )}
                </div>
              </section>
            )}

            {activeStep === 'documents' && (
              <section>
                <div className="section-head">
                  <div>
                    <span className="page-kicker">Étape 3</span>
                    <h3>Documents</h3>
                  </div>
                </div>
                <div className="form-grid">
                  {renderInput('RIB', 'rib', undefined, { disabled: isExtractingRib }, { sanitize: 'digits', maxLength: 24 })}
                </div>
                <div className="documents-grid">
                  {requiredDocuments.map((document) => (
                    <label
                      className={`document-card${hasCorrectionRequest && correctionRequest.documents.includes(document.key) ? ' is-correction-target' : ''}${isCorrectionDocumentLocked(document.key) ? ' is-correction-locked' : ''}`}
                      key={document.key}
                      htmlFor={`commercial-doc-${document.key}`}
                    >
                      <span className="document-title">{document.label}</span>
                      {document.optional && <span className="document-flag">Optionnel</span>}
                      <span className="document-hint">{document.hint}</span>
                      <span className="document-file">{documentNames[document.key] || 'Aucun fichier'}</span>
                      {documentMessages[document.key] && (
                        <span className="document-message">{documentMessages[document.key]}</span>
                      )}
                      <span className="document-action">
                        {document.key === 'ribDocument' && isExtractingRib ? 'Extraction...' : 'Importer'}
                      </span>
                      <input
                        className="document-input"
                        id={`commercial-doc-${document.key}`}
                        type="file"
                        accept="image/*,.pdf"
                        disabled={isSubmitting || (document.key === 'ribDocument' && isExtractingRib) || isCorrectionDocumentLocked(document.key)}
                        onChange={(event) => void onDocumentSelected(document.key, event)}
                      />
                    </label>
                  ))}
                </div>
              </section>
            )}

            {activeStep === 'compteRendu' && (
              <section>
                <div className="section-head">
                  <div>
                    <span className="page-kicker">Étape 4</span>
                    <h3>Compte rendu commercial</h3>
                  </div>
                </div>
                <div className="form-grid">
                  {renderInput('Qualification', 'compteRenduQualification', COMMERCIAL_REPORT_QUALIFICATION_OPTIONS)}
                  {showAcquereurField && renderInput('Acquéreur *', 'compteRenduAcquereur')}
                  {isAutoAffiliationRequest ? (
                    <label className="form-group">
                      <span>Origine du prospect</span>
                      <input className="form-input" value="Auto-affiliation" disabled />
                    </label>
                  ) : (
                    <label className="form-group">
                      <span>Origine du prospect</span>
                      <select
                        className="form-select"
                        value={form.compteRenduOrigineProspect}
                        disabled={isSubmitting || isCorrectionFieldLocked('compteRendu')}
                        onChange={(event) => onOrigineProspectChange(event.target.value)}
                      >
                        {renderSelect(COMMERCIAL_REPORT_ORIGIN_OPTIONS)}
                      </select>
                    </label>
                  )}
                  {showOrigineDetailField && (
                    <label className="form-group field-full">
                      <span>{origineDetailLabel}</span>
                      <select
                        className="form-select"
                        value={form.compteRenduOrigineProspectDetail}
                        disabled={isSubmitting || isCorrectionFieldLocked('compteRendu')}
                        onChange={(event) => setFormField('compteRenduOrigineProspectDetail', event.target.value)}
                      >
                        <option value="">Choisir {origineDetailLabel.toLowerCase()}</option>
                        {showCustomOrigineDetailOption && (
                          <option value={form.compteRenduOrigineProspectDetail}>
                            {form.compteRenduOrigineProspectDetail}
                          </option>
                        )}
                        {currentOrigineDetailOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {renderInput('Nom et prénom du contact', 'compteRenduContactNomPrenom')}
                  {renderInput('Fonction du contact', 'compteRenduContactFonction')}
                  {renderInput('Acronyme point de vente', 'compteRenduPointVenteAcronyme')}
                  {renderInput('Actionnaires', 'compteRenduActionnaires')}
                  {renderInput('Commerçant', 'compteRenduCommercant')}
                  {hasChain && renderInput('Chaîne', 'compteRenduChaine')}
                  {renderInput('Relations LC', 'compteRenduRelationsLc', undefined, { className: 'field-full' })}
                  {renderInput('Date ouverture', 'compteRenduDateOuverture', undefined, { type: 'date' })}
                  {renderInput("Nombre d'employés", 'compteRenduNombreEmployes', undefined, {}, { sanitize: 'digits', maxLength: 6 })}
                  {renderInput('Activité', 'compteRenduActivite')}
                  {renderInput('MCC', 'compteRenduMcc', MCC_OPTIONS)}
                  {renderInput('Standing magasin', 'compteRenduStandingMagasin')}
                  <label className="form-group field-full">
                    <span>Nature marchandises / services</span>
                    <textarea
                      className="form-input"
                      rows={3}
                      value={form.compteRenduNatureMarchandises}
                      disabled={isSubmitting || isCorrectionFieldLocked('compteRendu')}
                      onChange={(event) => setFormField('compteRenduNatureMarchandises', event.target.value)}
                    />
                  </label>
                  {renderInput('Superficie local', 'compteRenduSuperficieLocal', COMMERCIAL_REPORT_SURFACE_OPTIONS)}
                  {renderInput('Statut local', 'compteRenduStatutLocal', COMMERCIAL_REPORT_LOCAL_STATUS_OPTIONS)}
                  {renderInput('CA annuel', 'compteRenduChiffreAffairesAnnuel', COMMERCIAL_REPORT_CA_OPTIONS)}
                  {renderInput('Part paiements cartes (%)', 'compteRenduPartPaiementCarte', undefined, {}, { sanitize: 'decimal', maxLength: 6 })}
                  {renderInput('Part cartes locales (%)', 'compteRenduPartCarteLocale', undefined, {}, { sanitize: 'decimal', maxLength: 6 })}
                  {renderInput('Profil commerçant', 'compteRenduProfilCommercant', COMMERCIAL_REPORT_PROFILE_OPTIONS)}
                  {renderInput('Appréciation de la visite', 'compteRenduAppreciationVisite', COMMERCIAL_REPORT_APPRECIATION_OPTIONS)}
                  <label className="form-group field-full">
                    <span>Commentaire visite</span>
                    <textarea
                      className="form-input"
                      rows={4}
                      value={form.compteRenduCommentaire}
                      disabled={isSubmitting || isCorrectionFieldLocked('compteRendu')}
                      onChange={(event) => setFormField('compteRenduCommentaire', event.target.value)}
                    />
                  </label>
                  {renderInput('Fait à', 'compteRenduFaitA')}
                  {renderInput('Date visite', 'compteRenduDateVisite', undefined, { type: 'date' })}
                </div>
              </section>
            )}

            <div className="form-actions sticky-actions">
              {!isAutoAffiliationRequest && (
                <button className="btn-secondary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer brouillon'}
                </button>
              )}
              <button className="btn-primary" type="button" disabled={isSubmitting} onClick={finalizeRequest}>
                {isCorrectionMode ? 'Renvoyer à BOA' : 'Soumettre au back office'}
              </button>
              <span className={`generation-hint ${canGenerateContract ? 'is-ready' : ''}`}>{generateContractHint}</span>
            </div>
          </form>
        </div>
      )}
    </div>
    </>
  );
}
