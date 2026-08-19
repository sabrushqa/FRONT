import React, { useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { resolveBackendApiUrl } from '../../core/apiUrl';
import { getQuartiersForVille } from '../../core/quartiersMaroc';
import QuartierCombobox from '../../core/components/QuartierCombobox';
import PdvLocationPicker from '../../core/components/PdvLocationPicker';
import './Register.scss';

const MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;
const MAX_UPLOAD_REQUEST_BYTES = 50 * 1024 * 1024;
const MAX_POINTS_VENTE = 10;
const MAX_TPE = 10;
// Meme plafond que MAX_TPE, cote backend le meme MAX_TPE est reutilise pour
// valider la quantite SoftPOS/QR Code (voir AffiliationRegistrationService).
const MAX_QR_SOFTPOS = 10;
// 12s à l'origine — trop court sous charge réelle (CPU, sans batching) :
// une suite E2E de 20 dossiers enchaînés déclenche parfois des inférences
// >12s côté doc-classifier, faisant "abandonner" le front avant la réponse
// (le document reste "skipped" au lieu d'être classifié). 25s absorbe cette
// variance sans dégrader l'UX perçue (l'utilisateur voit "Validation..."
// un peu plus longtemps, plutôt qu'un abandon prématuré et un rejet à la
// soumission finale).
const DOCUMENT_AUTO_VALIDATION_TIMEOUT_MS = 25_000;
const DOCUMENT_AUTO_VALIDATION_MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024;
const DOCUMENT_AUTO_VALIDATION_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp']);
const DOCUMENT_AUTO_VALIDATION_SUPPORTED_KEYS = new Set<DocumentKey>([
  'cinDocument', 'ribDocument', 'patenteDocument', 'statutsDocument', 'rcDocument',
  'iceDocument', 'cinRepresentantDocument', 'attestationAeDocument', 'cinSignataireDocument'
]);

type CommercantType = 'PP' | 'PM' | 'AE' | 'Association';
type AffiliationType = 'TPE' | 'SoftPOS' | 'QRCode' | 'ECommerce' | 'EncaissementEcommerce';
type EncaissementProduit = 'TPE' | 'SoftPOS' | 'QRCode';
type FieldKey =
  | 'typeCommercant' | 'typeAffiliation' | 'nom' | 'prenom' | 'cin' | 'raisonSociale'
  | 'nomEntite' | 'activite' | 'secteur' | 'telephonePrincipal' | 'telephoneSecondaire'
  | 'email' | 'adresse' | 'ville' | 'region' | 'chainePointVente' | 'nombrePointsVente' | 'rc' | 'ice'
  | 'formeJuridique' | 'representantLegal' | 'numeroAutoEntrepreneur' | 'objet'
  | 'patente' | 'fonction' | 'beneficiairesEffectifs' | 'dateNaissance' | 'nationalite'
  | 'modeMiseADispositionTpe' | 'nombreTpe' | 'equipementTpe' | 'connectiviteTpe'
  | 'commissionLocaleTpe' | 'commissionEtrangereTpe' | 'depotTpe' | 'prixAchatTpe' | 'prixLicenceTpe'
  | 'modeServiceEcommerce' | 'siteMarchandUrl' | 'applicationMobile'
  | 'commissionLocaleEcommerce' | 'commissionEtrangereEcommerce' | 'fraisMiseEnServiceEcommerce'
  | 'modeleQrSoftpos' | 'nombreQrSoftpos' | 'commissionLocaleQrSoftpos' | 'commissionEtrangereQrSoftpos'
  | 'fraisServiceQrSoftpos' | 'conditionsQrSoftpos' | 'rib' | 'encaissementProduit';

type DocumentKey =
  | 'cinDocument' | 'ribDocument' | 'patenteDocument' | 'statutsDocument' | 'rcDocument'
  | 'iceDocument' | 'cinRepresentantDocument' | 'pvNominationDocument' | 'attestationAeDocument'
  | 'cinSignataireDocument' | 'pvAssociationDocument' | 'listeMembresDocument';

type DocumentStatus = 'validating' | 'valid' | 'invalid' | 'skipped';

interface RegisterProps {
  onBackToLogin?: () => void;
}

interface SelectOption {
  value: string;
  label: string;
  region?: string;
}

interface FieldConfig {
  key: FieldKey;
  label: string;
  placeholder: string;
  icon: 'identity' | 'activity' | 'hash' | 'phone' | 'mail' | 'map' | 'id' | 'building' | 'bank';
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autocomplete?: string;
  options?: SelectOption[];
  optional?: boolean;
  readonly?: boolean;
}

interface PointVenteFormData {
  nom: string;
  adresse: string;
  ville: string;
  quartier: string;
  telephone: string;
  codePostal: string;
  email: string;
  latitude: number | null;
  longitude: number | null;
}

interface DocumentConfig {
  key: DocumentKey;
  label: string;
  hint: string;
  optional?: boolean;
}

const stepLabels = ['Informations', 'Coordonnées', 'Documents'];

const commercantTypeOptions: SelectOption[] = [
  { value: 'PP', label: 'Personne physique' },
  { value: 'PM', label: 'Personne morale' },
  { value: 'AE', label: 'Auto-entrepreneur' },
  { value: 'Association', label: 'Association / Fondation' }
];

const affiliationTypeOptions: SelectOption[] = [
  { value: 'TPE', label: 'TPE' },
  { value: 'SoftPOS', label: 'SoftPOS' },
  { value: 'QRCode', label: 'QR Code' },
  { value: 'ECommerce', label: 'E-Commerce' },
  { value: 'EncaissementEcommerce', label: 'Encaissement + E-Commerce' }
];

const encaissementProduitOptions: SelectOption[] = [
  { value: 'TPE', label: 'TPE' },
  { value: 'SoftPOS', label: 'SoftPOS' },
  { value: 'QRCode', label: 'QR Code' }
];

const ecommerceServiceOptions: SelectOption[] = [
  { value: 'SiteMarchand', label: 'Intégration sur site marchand' },
  { value: 'ApplicationMobile', label: 'Intégration sur application mobile' },
  { value: 'PayByLinkManuel', label: 'PayByLink manuel' },
  { value: 'PayByLinkAutomatique', label: 'PayByLink automatique' }
];

const tpeServiceOptions: SelectOption[] = [
  { value: 'TPEAutonome', label: 'TPE autonome' },
  { value: 'SoftPos', label: 'Soft Pos' },
  { value: 'TPECentralise', label: 'TPE centralisé' },
  { value: 'MonetiqueIntegree', label: 'Monétique intégrée' }
];

const tpeConnectivityOptions: SelectOption[] = [
  { value: 'Fixe', label: 'Fixe' },
  { value: 'Mobile', label: 'Mobile' },
  { value: 'ADSL', label: 'ADSL' },
  { value: '4G5G', label: '4G / 5G' },
  { value: 'Wifi', label: 'WIFI' }
];

const qrSoftposModelOptions: SelectOption[] = [
  { value: 'QRCode', label: 'QR Code' },
  { value: 'SoftPOS', label: 'SoftPOS' }
];

const nationaliteOptions: SelectOption[] = [
  'Marocaine',
  'Afghane', 'Albanaise', 'Algérienne', 'Allemande', 'Américaine', 'Andorrane',
  'Angolaise', 'Antiguaise-et-Barbudienne', 'Argentine', 'Arménienne', 'Australienne',
  'Autrichienne', 'Azerbaïdjanaise', 'Bahamienne', 'Bahreïnienne', 'Bangladaise',
  'Barbadienne', 'Belge', 'Bélizienne', 'Béninoise', 'Bhoutanaise', 'Biélorusse',
  'Birmane', 'Bolivienne', 'Bosnienne', 'Botswanaise', 'Brésilienne', 'Britannique',
  'Brunéienne', 'Bulgare', 'Burkinabè', 'Burundaise', 'Cambodgienne', 'Camerounaise',
  'Canadienne', 'Cap-verdienne', 'Centrafricaine', 'Chilienne', 'Chinoise',
  'Chypriote', 'Colombienne', 'Comorienne', 'Congolaise', 'Costaricaine', 'Croate',
  'Cubaine', 'Danoise', 'Djiboutienne', 'Dominicaine', 'Dominiquaise', 'Égyptienne',
  'Émiratie', 'Équatorienne', 'Érythréenne', 'Espagnole', 'Estonienne',
  'Eswatinienne', 'Éthiopienne', 'Fidjienne', 'Finlandaise', 'Française', 'Gabonaise',
  'Gambienne', 'Géorgienne', 'Ghanéenne', 'Grecque', 'Grenadienne', 'Guatémaltèque',
  'Guinéenne', 'Bissau-guinéenne', 'Équato-guinéenne', 'Guyanienne', 'Haïtienne',
  'Hondurienne', 'Hongroise', 'Indienne', 'Indonésienne', 'Irakienne', 'Iranienne',
  'Irlandaise', 'Islandaise', 'Israélienne', 'Italienne', 'Ivoirienne', 'Jamaïcaine',
  'Japonaise', 'Jordanienne', 'Kazakhe', 'Kényane', 'Kirghize', 'Kiribatienne',
  'Koweïtienne', 'Laotienne', 'Lesothane', 'Lettone', 'Libanaise', 'Libérienne',
  'Libyenne', 'Liechtensteinoise', 'Lituanienne', 'Luxembourgeoise', 'Macédonienne',
  'Malgache', 'Malaisienne', 'Malawienne', 'Maldivienne', 'Malienne', 'Maltaise',
  'Marshallaise', 'Mauricienne', 'Mauritanienne', 'Mexicaine', 'Micronésienne',
  'Moldave', 'Monégasque', 'Mongole', 'Monténégrine', 'Mozambicaine', 'Namibienne',
  'Nauruane', 'Népalaise', 'Nicaraguayenne', 'Nigérienne', 'Nigériane',
  'Nord-coréenne', 'Norvégienne', 'Néo-zélandaise', 'Omanaise', 'Ougandaise',
  'Ouzbèke', 'Pakistanaise', 'Palaosienne', 'Palestinienne', 'Panaméenne',
  'Papouane-néo-guinéenne', 'Paraguayenne', 'Néerlandaise', 'Péruvienne',
  'Philippine', 'Polonaise', 'Portugaise', 'Qatarienne', 'Roumaine', 'Russe',
  'Rwandaise', 'Saint-lucienne', 'Saint-marinaise', 'Saint-vincentaise-et-grenadine',
  'Salomonaise', 'Salvadorienne', 'Samoane', 'Santoméenne', 'Saoudienne',
  'Sénégalaise', 'Serbe', 'Seychelloise', 'Sierra-léonaise', 'Singapourienne',
  'Slovaque', 'Slovène', 'Somalienne', 'Soudanaise', 'Sud-africaine',
  'Sud-coréenne', 'Sud-soudanaise', 'Sri-lankaise', 'Suédoise', 'Suisse',
  'Surinamaise', 'Syrienne', 'Tadjike', 'Tanzanienne', 'Tchadienne', 'Tchèque',
  'Thaïlandaise', 'Timoraise', 'Togolaise', 'Tongienne', 'Trinidadienne',
  'Tunisienne', 'Turkmène', 'Turque', 'Tuvaluane', 'Ukrainienne', 'Uruguayenne',
  'Vanuatuane', 'Vaticane', 'Vénézuélienne', 'Vietnamienne', 'Yéménite',
  'Zambienne', 'Zimbabwéenne'
].map((nationalite) => ({ value: nationalite, label: nationalite }));

// La configuration ne doit proposer que ce qui correspond au produit déjà
// choisi - proposer "QR Code" alors qu'on a choisi "SoftPOS" (et inversement)
// n'a pas de sens.
function resolveQrSoftposOptions(produit: 'SoftPOS' | 'QRCode' | ''): SelectOption[] {
  if (produit === 'SoftPOS') return qrSoftposModelOptions.filter((o) => o.value !== 'QRCode');
  if (produit === 'QRCode') return qrSoftposModelOptions.filter((o) => o.value !== 'SoftPOS');
  return qrSoftposModelOptions;
}

const villeOptions: SelectOption[] = [
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

const activiteOptions: SelectOption[] = [
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

const secteurOptions: SelectOption[] = [
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

type FormData = Record<FieldKey, string> & { acceptTerms: boolean };

function createInitialFormData(): FormData {
  return {
    typeCommercant: '',
    typeAffiliation: '',
    nom: '',
    prenom: '',
    cin: '',
    raisonSociale: '',
    nomEntite: '',
    activite: '',
    secteur: '',
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
    commissionLocaleTpe: '',
    commissionEtrangereTpe: '',
    depotTpe: '',
    prixAchatTpe: '',
    prixLicenceTpe: '',
    modeServiceEcommerce: '',
    siteMarchandUrl: '',
    applicationMobile: '',
    commissionLocaleEcommerce: '',
    commissionEtrangereEcommerce: '',
    fraisMiseEnServiceEcommerce: '',
    modeleQrSoftpos: '',
    nombreQrSoftpos: '',
    commissionLocaleQrSoftpos: '',
    commissionEtrangereQrSoftpos: '',
    fraisServiceQrSoftpos: '',
    conditionsQrSoftpos: '',
    rib: '',
    encaissementProduit: '',
    acceptTerms: false
  };
}

function resolveUploadLimitMessage(files: Array<File | undefined>): string | null {
  const validFiles = files.filter((f): f is File => f instanceof File);
  const oversized = validFiles.find((f) => f.size > MAX_UPLOAD_FILE_BYTES);
  if (oversized) return `Le fichier "${oversized.name}" dépasse la limite autorisée de 10 MB.`;
  const total = validFiles.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_UPLOAD_REQUEST_BYTES) return 'La taille totale des fichiers dépasse la limite autorisée de 50 MB.';
  return null;
}

function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === 'object' && 'message' in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message.trim();
    }
    if (typeof data === 'string' && data.trim()) return data.trim();
  }
  return "Votre demande n'est pas enregistrée. Merci de vérifier les informations saisies puis de réessayer.";
}

export default function Register({ onBackToLogin }: RegisterProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(createInitialFormData);
  const [hasChain, setHasChain] = useState(false);
  const [pointVentes, setPointVentes] = useState<PointVenteFormData[]>([]);
  const [documentNames, setDocumentNames] = useState<Partial<Record<DocumentKey, string>>>({});
  const [documentFiles, setDocumentFiles] = useState<Partial<Record<DocumentKey, File>>>({});
  const [documentValidationStates, setDocumentValidationStates] = useState<
    Partial<Record<DocumentKey, { status: DocumentStatus; message: string }>>
  >({});
  const [touchedFields, setTouchedFields] = useState<Set<FieldKey>>(new Set());
  const [touchedPointVenteFields, setTouchedPointVenteFields] = useState<Set<string>>(new Set());
  const [attemptedAdvance, setAttemptedAdvance] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [attemptedRib, setAttemptedRib] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState('');
  const [submitErrorMessage, setSubmitErrorMessage] = useState('');
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validationRequestIds = useRef<Partial<Record<DocumentKey, number>>>({});
  const validationWatchdogs = useRef<Partial<Record<DocumentKey, ReturnType<typeof setTimeout>>>>({});

  const selectedCommercantType = formData.typeCommercant as CommercantType | '';
  const selectedAffiliationType = formData.typeAffiliation as AffiliationType | '';
  const selectedEncaissementProduit = formData.encaissementProduit as EncaissementProduit | '';
  const hasEncaissementFields =
    selectedAffiliationType === 'TPE'
    || selectedAffiliationType === 'SoftPOS'
    || selectedAffiliationType === 'QRCode'
    || selectedAffiliationType === 'EncaissementEcommerce';
  const hasEcommerceFields =
    selectedAffiliationType === 'ECommerce' || selectedAffiliationType === 'EncaissementEcommerce';

  const commercantTypeLabel =
    commercantTypeOptions.find((o) => o.value === selectedCommercantType)?.label ?? 'Profil commerçant';
  const affiliationTypeLabel =
    affiliationTypeOptions.find((o) => o.value === selectedAffiliationType)?.label ?? "Type d'affiliation";

  const identityField: FieldConfig = useMemo(() => {
    switch (selectedCommercantType) {
      case 'PM':
        return { key: 'raisonSociale', label: 'Raison sociale', placeholder: 'Nom de la société', icon: 'building', autocomplete: 'organization' };
      case 'Association':
        return { key: 'nomEntite', label: "Nom de l'entité", placeholder: "Nom de l'association ou fondation", icon: 'building', autocomplete: 'organization' };
      case 'AE':
        return { key: 'nom', label: 'Nom', placeholder: "Nom de l'auto-entrepreneur", icon: 'identity', autocomplete: 'family-name' };
      case 'PP':
      default:
        return {
          key: 'nom',
          label: selectedCommercantType ? 'Nom' : 'Nom / raison sociale',
          placeholder: selectedCommercantType ? 'Nom du commerçant' : 'Nom du commerçant ou raison sociale',
          icon: 'identity',
          autocomplete: 'family-name'
        };
    }
  }, [selectedCommercantType]);

  const generalFields: FieldConfig[] = useMemo(
    () => [
      { key: 'typeCommercant', label: 'Type de commerçant', placeholder: 'Sélectionnez un type', icon: 'building', options: commercantTypeOptions },
      { key: 'typeAffiliation', label: "Type d'affiliation", placeholder: 'Sélectionnez une affiliation', icon: 'activity', options: affiliationTypeOptions },
      identityField,
      { key: 'activite', label: 'Activité', placeholder: 'Sélectionnez une activité', icon: 'activity', options: activiteOptions },
      { key: 'secteur', label: 'Secteur', placeholder: 'Sélectionnez un secteur', icon: 'activity', options: secteurOptions },
      { key: 'telephonePrincipal', label: 'Téléphone principal', placeholder: '+212 ...', icon: 'phone', type: 'tel', autocomplete: 'tel', inputMode: 'tel' }
    ],
    [identityField]
  );

  const specificFields: FieldConfig[] = useMemo(() => {
    switch (selectedCommercantType) {
      case 'PP':
        return [
          { key: 'prenom', label: 'Prénom', placeholder: 'Prénom du commerçant', icon: 'identity', autocomplete: 'given-name' },
          { key: 'cin', label: 'CIN', placeholder: 'Numéro CIN', icon: 'id' }
        ];
      case 'PM':
        return [
          { key: 'rc', label: 'RC', placeholder: 'Numéro du registre de commerce', icon: 'id' },
          { key: 'ice', label: 'ICE', placeholder: "Identifiant commun de l'entreprise", icon: 'id' },
          { key: 'formeJuridique', label: 'Forme juridique', placeholder: 'SARL, SA, SNC...', icon: 'building' },
          { key: 'representantLegal', label: 'Représentant légal', placeholder: 'Nom du représentant légal', icon: 'identity', autocomplete: 'name' }
        ];
      case 'AE':
        return [
          { key: 'prenom', label: 'Prénom', placeholder: "Prénom de l'auto-entrepreneur", icon: 'identity', autocomplete: 'given-name' },
          { key: 'numeroAutoEntrepreneur', label: 'Numéro auto-entrepreneur', placeholder: "Numéro d'immatriculation", icon: 'id' },
          { key: 'ice', label: 'ICE', placeholder: "Identifiant commun de l'entreprise", icon: 'id' }
        ];
      case 'Association':
        return [
          { key: 'representantLegal', label: 'Représentant légal', placeholder: 'Nom du signataire autorisé', icon: 'identity', autocomplete: 'name' },
          { key: 'objet', label: 'Objet', placeholder: "Objet ou activité de l'association", icon: 'activity' },
          { key: 'ice', label: 'ICE', placeholder: "Identifiant commun de l'entité", icon: 'id' }
        ];
      default:
        return [];
    }
  }, [selectedCommercantType]);

  const contractFields: FieldConfig[] = useMemo(
    () => [
      { key: 'fonction', label: 'Fonction du signataire', placeholder: 'Gérant, président, directeur...', icon: 'identity', optional: true },
      { key: 'beneficiairesEffectifs', label: 'Bénéficiaires effectifs', placeholder: 'Noms des bénéficiaires effectifs', icon: 'identity', optional: true },
      { key: 'dateNaissance', label: 'Date de naissance', placeholder: 'Date de naissance', icon: 'id', type: 'date', optional: true },
      { key: 'nationalite', label: 'Nationalité', placeholder: 'Sélectionnez une nationalité', icon: 'identity', options: nationaliteOptions, optional: true },
      { key: 'patente', label: 'Taxe professionnelle', placeholder: 'Numéro de patente', icon: 'id', optional: true }
    ],
    []
  );

  const affiliationSpecificFields: FieldConfig[] = useMemo(() => {
    switch (selectedAffiliationType) {
      case 'TPE':
        return [
          { key: 'modeMiseADispositionTpe', label: 'Service TPE', placeholder: 'Sélectionnez un service', icon: 'activity', options: tpeServiceOptions },
          { key: 'equipementTpe', label: 'Équipement', placeholder: 'Sélectionnez un équipement', icon: 'building', options: tpeServiceOptions },
          { key: 'connectiviteTpe', label: 'Connectivité', placeholder: 'Sélectionnez une connectivité', icon: 'activity', options: tpeConnectivityOptions },
          { key: 'nombreTpe', label: 'Nombre de TPE', placeholder: 'Nombre de terminaux', icon: 'hash', type: 'number', inputMode: 'numeric' }
        ];
      case 'ECommerce':
        return [
          { key: 'modeServiceEcommerce', label: 'Service e-commerce', placeholder: 'Sélectionnez un service', icon: 'activity', options: ecommerceServiceOptions },
          { key: 'siteMarchandUrl', label: 'URL site marchand', placeholder: 'https://...', icon: 'mail' },
          { key: 'applicationMobile', label: 'Application mobile', placeholder: "Nom de l'application ou optionnel", icon: 'activity', optional: true }
        ];
      case 'SoftPOS':
      case 'QRCode':
        return [
          {
            key: 'modeleQrSoftpos',
            label: selectedAffiliationType === 'SoftPOS' ? 'Configuration SoftPOS' : 'Configuration QR Code',
            placeholder: selectedAffiliationType === 'SoftPOS' ? 'Sélectionnez une configuration' : 'Sélectionnez une configuration QR',
            icon: 'activity',
            options: resolveQrSoftposOptions(selectedAffiliationType as 'SoftPOS' | 'QRCode')
          },
          {
            key: 'nombreQrSoftpos',
            label: selectedAffiliationType === 'SoftPOS' ? 'Nombre de SoftPOS' : 'Nombre de QR Code',
            placeholder: selectedAffiliationType === 'SoftPOS' ? 'Nombre de dispositifs' : 'Nombre de codes QR',
            icon: 'hash',
            type: 'number',
            inputMode: 'numeric'
          }
        ];
      case 'EncaissementEcommerce': {
        const produitFields: FieldConfig[] =
          selectedEncaissementProduit === 'TPE'
            ? [
                { key: 'modeMiseADispositionTpe', label: 'Service TPE', placeholder: 'Sélectionnez un service', icon: 'activity', options: tpeServiceOptions },
                { key: 'equipementTpe', label: 'Équipement', placeholder: 'Sélectionnez un équipement', icon: 'building', options: tpeServiceOptions },
                { key: 'connectiviteTpe', label: 'Connectivité', placeholder: 'Sélectionnez une connectivité', icon: 'activity', options: tpeConnectivityOptions },
                { key: 'nombreTpe', label: 'Nombre de TPE', placeholder: 'Nombre de terminaux', icon: 'hash', type: 'number', inputMode: 'numeric' }
              ]
            : selectedEncaissementProduit === 'SoftPOS' || selectedEncaissementProduit === 'QRCode'
              ? [
                  {
                    key: 'modeleQrSoftpos',
                    label: selectedEncaissementProduit === 'SoftPOS' ? 'Configuration SoftPOS' : 'Configuration QR Code',
                    placeholder: selectedEncaissementProduit === 'SoftPOS' ? 'Sélectionnez une configuration' : 'Sélectionnez une configuration QR',
                    icon: 'activity',
                    options: resolveQrSoftposOptions(selectedEncaissementProduit as 'SoftPOS' | 'QRCode')
                  },
                  {
                    key: 'nombreQrSoftpos',
                    label: selectedEncaissementProduit === 'SoftPOS' ? 'Nombre de SoftPOS' : 'Nombre de QR Code',
                    placeholder: selectedEncaissementProduit === 'SoftPOS' ? 'Nombre de dispositifs' : 'Nombre de codes QR',
                    icon: 'hash',
                    type: 'number',
                    inputMode: 'numeric'
                  }
                ]
              : [];
        return [
          { key: 'encaissementProduit', label: "Produit d'encaissement", placeholder: 'Sélectionnez un produit', icon: 'activity', options: encaissementProduitOptions },
          ...produitFields,
          { key: 'modeServiceEcommerce', label: 'Service e-commerce', placeholder: 'Sélectionnez un service', icon: 'activity', options: ecommerceServiceOptions },
          { key: 'siteMarchandUrl', label: 'URL site marchand', placeholder: 'https://...', icon: 'mail' },
          { key: 'applicationMobile', label: 'Application mobile', placeholder: "Nom de l'application ou optionnel", icon: 'activity', optional: true }
        ];
      }
      default:
        return [];
    }
  }, [selectedAffiliationType, selectedEncaissementProduit]);

  const contactAndSpecificFields: FieldConfig[] = useMemo(
    () => [
      { key: 'telephoneSecondaire', label: 'Téléphone secondaire', placeholder: 'Optionnel', icon: 'phone', type: 'tel', autocomplete: 'tel', inputMode: 'tel', optional: true },
      { key: 'email', label: 'E-mail', placeholder: 'contact@domaine.ma', icon: 'mail', type: 'email', autocomplete: 'email', inputMode: 'email' },
      { key: 'adresse', label: 'Adresse', placeholder: 'Adresse complète', icon: 'map', autocomplete: 'street-address' },
      { key: 'ville', label: 'Ville', placeholder: 'Sélectionnez une ville', icon: 'map', autocomplete: 'address-level2', options: villeOptions },
      { key: 'region', label: 'Région', placeholder: 'Région calculée selon la ville', icon: 'map', autocomplete: 'address-level1', readonly: true },
      ...(hasEncaissementFields
        ? [{ key: 'nombrePointsVente', label: 'Nombre de points de vente', placeholder: 'Nombre de points de vente', icon: 'hash', type: 'number', inputMode: 'numeric' } satisfies FieldConfig]
        : []),
      ...(hasChain
        ? [{ key: 'chainePointVente', label: 'Chaîne point de vente', placeholder: 'Nom de la chaîne', icon: 'activity' } satisfies FieldConfig]
        : []),
      ...specificFields,
      ...contractFields,
      ...affiliationSpecificFields
    ],
    [hasEncaissementFields, hasChain, specificFields, contractFields, affiliationSpecificFields]
  );

  const requiredDocuments: DocumentConfig[] = useMemo(() => {
    switch (selectedCommercantType) {
      case 'PP':
        return [
          { key: 'cinDocument', label: 'CIN', hint: 'Copie lisible de la CIN.' },
          { key: 'ribDocument', label: 'RIB', hint: 'Justificatif bancaire récent.' },
          { key: 'patenteDocument', label: 'Patente', hint: 'À joindre si applicable.', optional: true }
        ];
      case 'PM':
        return [
          { key: 'statutsDocument', label: 'Statuts', hint: 'Version signée des statuts.' },
          { key: 'rcDocument', label: 'RC', hint: 'Extrait du registre de commerce.' },
          { key: 'iceDocument', label: 'ICE', hint: "Document mentionnant l'ICE." },
          { key: 'cinRepresentantDocument', label: 'CIN représentant légal', hint: 'Pièce du représentant légal.' },
          { key: 'pvNominationDocument', label: 'PV de nomination', hint: 'PV en vigueur.' },
          { key: 'ribDocument', label: 'RIB', hint: "Justificatif bancaire de l'entreprise." }
        ];
      case 'AE':
        return [
          { key: 'cinDocument', label: 'CIN', hint: "Pièce d'identité recto-verso." },
          { key: 'attestationAeDocument', label: 'Attestation AE', hint: 'Attestation officielle à jour.' },
          { key: 'ribDocument', label: 'RIB', hint: "Document bancaire lié à l'activité." }
        ];
      case 'Association':
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
  }, [selectedCommercantType]);

  const mandatoryDocuments = requiredDocuments.filter((d) => !d.optional);
  const stepOneRequiredKeys = generalFields.filter((f) => !f.optional).map((f) => f.key);
  const stepTwoRequiredKeys = contactAndSpecificFields.filter((f) => !f.optional).map((f) => f.key);

  function hasFieldValue(key: FieldKey): boolean {
    return String(formData[key] ?? '').trim().length > 0;
  }

  function resolvePointVentesCount(): number {
    const parsed = Number.parseInt(formData.nombrePointsVente, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 0;
    return Math.min(parsed, MAX_POINTS_VENTE);
  }

  function arePointVentesComplete(): boolean {
    const expected = resolvePointVentesCount();
    if (expected < 1 || pointVentes.length !== expected) return false;
    return pointVentes.every(
      (pv) => pv.nom.trim() && pv.adresse.trim() && pv.ville.trim() && pv.telephone.trim()
    );
  }

  const isStepOneComplete = stepOneRequiredKeys.every(hasFieldValue);
  const isStepTwoComplete =
    stepTwoRequiredKeys.every(hasFieldValue) && (!hasEncaissementFields || arePointVentesComplete());
  const isStepThreeComplete =
    hasFieldValue('rib') &&
    mandatoryDocuments.every((d) => Boolean(documentNames[d.key])) &&
    formData.acceptTerms;
  const isAnyDocumentValidationPending = Object.values(documentValidationStates).some(
    (s) => s?.status === 'validating'
  );
  const canSubmit = isStepOneComplete && isStepTwoComplete && isStepThreeComplete && !isAnyDocumentValidationPending;
  const canContinue =
    currentStep === 1 ? isStepOneComplete : currentStep === 2 ? isStepTwoComplete : isStepThreeComplete;

  const progressPercentage = useMemo(() => {
    const keys = Array.from(new Set<FieldKey>([...stepOneRequiredKeys, ...stepTwoRequiredKeys, 'rib']));
    const completedFields = keys.filter(hasFieldValue).length;
    const completedDocs = mandatoryDocuments.filter((d) => Boolean(documentNames[d.key])).length;
    const completedTerms = formData.acceptTerms ? 1 : 0;
    const total = keys.length + mandatoryDocuments.length + 1;
    return Math.round(((completedFields + completedDocs + completedTerms) / total) * 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, documentNames, stepOneRequiredKeys, stepTwoRequiredKeys, mandatoryDocuments]);

  function isFieldRequired(key: FieldKey): boolean {
    if (currentStep === 1) return stepOneRequiredKeys.includes(key);
    if (currentStep === 2) return stepTwoRequiredKeys.includes(key);
    if (currentStep === 3 && key === 'rib') return true;
    return false;
  }

  function isFieldInvalid(key: FieldKey): boolean {
    if (!isFieldRequired(key)) return false;
    if (hasFieldValue(key)) return false;
    if (attemptedAdvance || attemptedSubmit) return true;
    if (key === 'rib') return attemptedRib;
    return touchedFields.has(key);
  }

  function isPointVenteFieldInvalid(index: number, key: keyof PointVenteFormData): boolean {
    if (!['nom', 'adresse', 'ville', 'telephone'].includes(key)) return false;
    const value = String(pointVentes[index]?.[key] ?? '');
    return !value.trim() && (touchedPointVenteFields.has(`${index}:${key}`) || attemptedAdvance || attemptedSubmit);
  }

  function clearSubmissionFeedback() {
    setSubmitSuccessMessage('');
    setSubmitErrorMessage('');
  }

  function resetDocuments() {
    setDocumentNames({});
    setDocumentFiles({});
    setDocumentValidationStates({});
    validationRequestIds.current = {};
    Object.values(validationWatchdogs.current).forEach((timer) => {
      if (timer) clearTimeout(timer);
    });
    validationWatchdogs.current = {};
  }

  function onCommercantTypeChange(type: CommercantType | '') {
    resetDocuments();
    setFormData((prev) => {
      const next = { ...prev, typeCommercant: type, rib: '', acceptTerms: false };
      const allSpecificKeys: FieldKey[] = [
        'nom', 'raisonSociale', 'nomEntite', 'prenom', 'cin', 'formeJuridique',
        'representantLegal', 'numeroAutoEntrepreneur', 'objet', 'patente', 'fonction',
        'beneficiairesEffectifs', 'dateNaissance', 'nationalite'
      ];
      allSpecificKeys.forEach((k) => { next[k] = ''; });
      if (type !== 'PM') next.rc = '';
      if (type !== 'PM' && type !== 'AE' && type !== 'Association') next.ice = '';
      return next;
    });
    setCurrentStep(1);
  }

  function onAffiliationTypeChange(type: AffiliationType | '') {
    const affiliationKeys: FieldKey[] = [
      'modeMiseADispositionTpe', 'nombreTpe', 'equipementTpe', 'connectiviteTpe',
      'commissionLocaleTpe', 'commissionEtrangereTpe', 'depotTpe', 'prixAchatTpe', 'prixLicenceTpe',
      'modeServiceEcommerce', 'siteMarchandUrl', 'applicationMobile',
      'commissionLocaleEcommerce', 'commissionEtrangereEcommerce', 'fraisMiseEnServiceEcommerce',
      'modeleQrSoftpos', 'nombreQrSoftpos', 'commissionLocaleQrSoftpos', 'commissionEtrangereQrSoftpos',
      'fraisServiceQrSoftpos', 'conditionsQrSoftpos', 'encaissementProduit'
    ];
    setFormData((prev) => {
      const next = { ...prev, typeAffiliation: type, acceptTerms: false };
      affiliationKeys.forEach((k) => { next[k] = ''; });
      if (type === 'ECommerce') next.nombrePointsVente = '';
      return next;
    });
    if (type === 'ECommerce') setPointVentes([]);
    setCurrentStep(1);
  }

  function onHasChainChange(value: boolean) {
    clearSubmissionFeedback();
    setHasChain(value);
    setFormData((prev) => ({
      ...prev,
      chainePointVente: value ? prev.chainePointVente : '',
      acceptTerms: false
    }));
    if (!value) {
      setTouchedFields((prev) => {
        const next = new Set(prev);
        next.delete('chainePointVente');
        return next;
      });
    }
  }

  function setFieldValue(key: FieldKey, value: string) {
    clearSubmissionFeedback();

    if (key === 'typeCommercant') {
      onCommercantTypeChange(value as CommercantType | '');
      return;
    }

    if (key === 'typeAffiliation') {
      onAffiliationTypeChange(value as AffiliationType | '');
      return;
    }

    const isNumeric = key === 'nombreTpe' || key === 'nombrePointsVente' || key === 'nombreQrSoftpos';
    let normalized = isNumeric ? value.replace(/\D+/g, '') : value;
    if (key === 'nombrePointsVente' && Number.parseInt(normalized, 10) > MAX_POINTS_VENTE) normalized = String(MAX_POINTS_VENTE);
    if (key === 'nombreTpe' && Number.parseInt(normalized, 10) > MAX_TPE) normalized = String(MAX_TPE);
    if (key === 'nombreQrSoftpos' && Number.parseInt(normalized, 10) > MAX_QR_SOFTPOS) normalized = String(MAX_QR_SOFTPOS);

    setFormData((prev) => {
      const next = { ...prev, [key]: normalized, acceptTerms: false };
      if (key === 'ville') {
        next.region = villeOptions.find((o) => o.value === normalized)?.region ?? '';
      }
      if (key === 'encaissementProduit') {
        // Efface les champs du produit d'encaissement precedent pour ne pas
        // soumettre des donnees perimees (ex: passer de TPE a QR Code).
        (['modeMiseADispositionTpe', 'equipementTpe', 'connectiviteTpe', 'nombreTpe', 'modeleQrSoftpos', 'nombreQrSoftpos'] as FieldKey[])
          .forEach((k) => { next[k] = ''; });
      }
      return next;
    });

    if (key === 'nombrePointsVente') {
      const count = Math.max(0, Math.min(Number.parseInt(normalized, 10) || 0, MAX_POINTS_VENTE));
      setPointVentes((old) =>
        Array.from({ length: count }, (_, i) => old[i] ?? { nom: '', adresse: '', ville: '', quartier: '', telephone: '', codePostal: '', email: '', latitude: null, longitude: null })
      );
    }

    setTouchedFields((prev) => {
      const next = new Set(prev);
      if (normalized.trim()) next.delete(key);
      return next;
    });

    if (key === 'rib' && normalized.trim()) setAttemptedRib(false);
  }

  function markFieldTouched(key: FieldKey) {
    setTouchedFields((prev) => new Set(prev).add(key));
  }

  function setPointVenteField(index: number, key: keyof PointVenteFormData, value: string) {
    clearSubmissionFeedback();
    setPointVentes((prev) =>
      prev.map((pv, i) => {
        if (i !== index) return pv;
        const updated = { ...pv, [key]: value };
        // Auto-remplit le code postal quand le quartier saisi correspond exactement
        // a une entree connue pour la ville choisie (liste officielle Barid Al-Maghrib).
        if (key === 'quartier') {
          const match = getQuartiersForVille(updated.ville).find(
            (entry) => entry.quartier.toLowerCase() === value.trim().toLowerCase()
          );
          if (match) updated.codePostal = match.codePostal;
        }
        return updated;
      })
    );
    setFormData((prev) => ({ ...prev, acceptTerms: false }));
    setTouchedPointVenteFields((prev) => {
      const next = new Set(prev);
      if (value.trim()) next.delete(`${index}:${key}`);
      return next;
    });
  }

  function setPointVentePosition(index: number, latitude: number, longitude: number) {
    clearSubmissionFeedback();
    setPointVentes((prev) => prev.map((pv, i) => (i === index ? { ...pv, latitude, longitude } : pv)));
    setFormData((prev) => ({ ...prev, acceptTerms: false }));
  }

  function canAccessStep(step: number): boolean {
    if (step <= 1) return true;
    if (step === 2) return isStepOneComplete;
    if (step === 3) return isStepOneComplete && isStepTwoComplete;
    return false;
  }

  function nextStep() {
    if (!canContinue) {
      setAttemptedAdvance(true);
      const keys = currentStep === 1 ? stepOneRequiredKeys : stepTwoRequiredKeys;
      setTouchedFields((prev) => new Set([...prev, ...keys]));
      if (currentStep === 2 && hasEncaissementFields) {
        setTouchedPointVenteFields((prev) => {
          const next = new Set(prev);
          pointVentes.forEach((_, i) =>
            ['nom', 'adresse', 'ville', 'telephone'].forEach((k) => next.add(`${i}:${k}`))
          );
          return next;
        });
      }
      return;
    }
    setAttemptedAdvance(false);
    setCurrentStep((s) => Math.min(s + 1, stepLabels.length));
  }

  function previousStep() {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }

  function isAutoValidationImage(file: File): boolean {
    if (file.type.startsWith('image/')) return true;
    const lower = file.name.toLowerCase();
    const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : '';
    return DOCUMENT_AUTO_VALIDATION_IMAGE_EXTENSIONS.has(ext);
  }

  function resolveImmediateValidationState(key: DocumentKey, file: File): { status: DocumentStatus; message: string } | null {
    if (!DOCUMENT_AUTO_VALIDATION_SUPPORTED_KEYS.has(key)) {
      return { status: 'skipped', message: 'Document conservé sans vérification automatique pour ce type de pièce.' };
    }
    if (!isAutoValidationImage(file)) {
      return { status: 'skipped', message: 'Document conservé sans vérification automatique. Importez une image jpg, jpeg, png, gif ou bmp pour la vérification IA.' };
    }
    if (file.size > DOCUMENT_AUTO_VALIDATION_MAX_FILE_SIZE_BYTES) {
      return { status: 'skipped', message: 'Document conservé sans vérification automatique car le fichier dépasse 16 MB.' };
    }
    return null;
  }

  function applyRibExtraction(ribValue: string | null | undefined) {
    if (!ribValue) return;
    setFormData((prev) => {
      if (prev.rib.trim()) return prev;
      return { ...prev, rib: ribValue, acceptTerms: false };
    });
  }

  function clearDocumentValidationWatchdog(key: DocumentKey) {
    const timer = validationWatchdogs.current[key];
    if (timer) {
      clearTimeout(timer);
      delete validationWatchdogs.current[key];
    }
  }

  async function onDocumentSelected(key: DocumentKey, file: File | undefined) {
    clearSubmissionFeedback();

    if (!file) {
      setDocumentNames((prev) => { const next = { ...prev }; delete next[key]; return next; });
      setDocumentFiles((prev) => { const next = { ...prev }; delete next[key]; return next; });
      setDocumentValidationStates((prev) => { const next = { ...prev }; delete next[key]; return next; });
      delete validationRequestIds.current[key];
      clearDocumentValidationWatchdog(key);
      if (key === 'ribDocument') {
        setFormData((prev) => ({ ...prev, rib: '', acceptTerms: false }));
      }
      return;
    }

    const allFiles = { ...documentFiles, [key]: file };
    const limitMessage = resolveUploadLimitMessage(Object.values(allFiles));
    if (limitMessage) {
      setSubmitErrorMessage(limitMessage);
      return;
    }

    if (key === 'ribDocument') {
      setFormData((prev) => ({ ...prev, rib: '', acceptTerms: false }));
    }

    const immediateState = resolveImmediateValidationState(key, file);
    if (immediateState) {
      delete validationRequestIds.current[key];
      setDocumentNames((prev) => ({ ...prev, [key]: file.name }));
      setDocumentFiles((prev) => ({ ...prev, [key]: file }));
      setDocumentValidationStates((prev) => ({ ...prev, [key]: immediateState }));
      return;
    }

    const requestId = (validationRequestIds.current[key] ?? 0) + 1;
    validationRequestIds.current[key] = requestId;
    setDocumentValidationStates((prev) => ({ ...prev, [key]: { status: 'validating', message: 'Validation du document en cours...' } }));

    validationWatchdogs.current[key] = setTimeout(() => {
      if (validationRequestIds.current[key] !== requestId) return;
      setDocumentNames((prev) => ({ ...prev, [key]: file.name }));
      setDocumentFiles((prev) => ({ ...prev, [key]: file }));
      setDocumentValidationStates((prev) => ({
        ...prev,
        [key]: { status: 'skipped', message: 'La vérification prend trop de temps. La pièce reste jointe sans blocage.' }
      }));
      delete validationRequestIds.current[key];
      clearDocumentValidationWatchdog(key);
    }, DOCUMENT_AUTO_VALIDATION_TIMEOUT_MS + 1000);

    try {
      const fd = new FormData();
      fd.append('documentKey', key);
      fd.append('file', file, file.name);
      const response = await axios.post<{
        status: 'VALID' | 'INVALID' | 'SKIPPED';
        reason?: string;
        ribExtraction?: { rib?: string | null; iban?: string | null } | null;
      }>(resolveBackendApiUrl('/api/affiliations/documents/validate'), fd, {
        signal: AbortSignal.timeout(DOCUMENT_AUTO_VALIDATION_TIMEOUT_MS)
      });

      if (validationRequestIds.current[key] !== requestId) return;
      clearDocumentValidationWatchdog(key);

      const data = response.data;
      const status: DocumentStatus = data.status === 'VALID' ? 'valid' : data.status === 'INVALID' ? 'invalid' : 'skipped';
      const message = data.reason?.trim() || getDocumentValidationLabel(status);

      setDocumentNames((prev) => ({ ...prev, [key]: file.name }));
      setDocumentFiles((prev) => ({ ...prev, [key]: file }));
      setDocumentValidationStates((prev) => ({ ...prev, [key]: { status, message } }));

      if (key === 'ribDocument') {
        const extracted = data.ribExtraction?.rib || extractRibFromIban(data.ribExtraction?.iban ?? null);
        applyRibExtraction(extracted);
      }
    } catch {
      if (validationRequestIds.current[key] !== requestId) return;
      clearDocumentValidationWatchdog(key);
      setDocumentNames((prev) => ({ ...prev, [key]: file.name }));
      setDocumentFiles((prev) => ({ ...prev, [key]: file }));
      setDocumentValidationStates((prev) => ({
        ...prev,
        [key]: { status: 'skipped', message: 'Impossible de vérifier automatiquement cette pièce. La pièce reste jointe sans blocage.' }
      }));
    }
  }

  function extractRibFromIban(iban: string | null): string {
    if (!iban) return '';
    const compact = iban.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!compact.startsWith('MA') || compact.length <= 4) return '';
    return compact.slice(4);
  }

  function getDocumentValidationLabel(status: DocumentStatus): string {
    switch (status) {
      case 'validating': return 'Vérification';
      case 'valid': return 'Valide';
      case 'invalid': return 'À vérifier';
      case 'skipped': return 'Non vérifié';
    }
  }

  function buildPayload(): Record<string, string> {
    const { acceptTerms, encaissementProduit, ...fields } = formData;
    void acceptTerms;
    void encaissementProduit;
    return {
      ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v ?? '').trim()])),
      chainePointVente: hasChain ? formData.chainePointVente.trim() : '',
      pointVentesJson: JSON.stringify(
        (hasEncaissementFields ? pointVentes : []).map((pv) => ({
          nom: pv.nom.trim(),
          adresse: pv.adresse.trim(),
          ville: pv.ville.trim(),
          quartier: pv.quartier.trim(),
          codePostal: pv.codePostal.trim(),
          telephone: pv.telephone.trim(),
          email: pv.email.trim(),
          latitude: pv.latitude,
          longitude: pv.longitude
        }))
      ),
      cinDocumentName: documentNames.cinDocument ?? '',
      ribDocumentName: documentNames.ribDocument ?? '',
      patenteDocumentName: documentNames.patenteDocument ?? '',
      statutsDocumentName: documentNames.statutsDocument ?? '',
      rcDocumentName: documentNames.rcDocument ?? '',
      iceDocumentName: documentNames.iceDocument ?? '',
      cinRepresentantDocumentName: documentNames.cinRepresentantDocument ?? '',
      pvNominationDocumentName: documentNames.pvNominationDocument ?? '',
      attestationAeDocumentName: documentNames.attestationAeDocument ?? '',
      cinSignataireDocumentName: documentNames.cinSignataireDocument ?? '',
      pvAssociationDocumentName: documentNames.pvAssociationDocument ?? '',
      listeMembresDocumentName: documentNames.listeMembresDocument ?? ''
    };
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (isSubmitting) return;

    if (!canSubmit) {
      setAttemptedSubmit(true);
      setAttemptedRib(true);
      return;
    }

    const limitMessage = resolveUploadLimitMessage(Object.values(documentFiles));
    if (limitMessage) {
      setSubmitErrorMessage(limitMessage);
      return;
    }

    clearSubmissionFeedback();
    setIsSubmitting(true);

    const payload = buildPayload();
    const multipart = new FormData();
    multipart.append('payload', JSON.stringify(payload));
    Object.entries(documentFiles).forEach(([key, file]) => {
      if (file instanceof File) multipart.append(key, file, file.name);
    });

    try {
      const response = await axios.post<{
        message: string;
        dossierId: number;
        documentsCount: number;
        notificationMessage?: string;
      }>(resolveBackendApiUrl('/api/affiliations'), multipart);

      const data = response.data;
      const loginMessage = data.notificationMessage || "Votre demande a bien été enregistrée. Un commercial Lana Cash vous contactera prochainement.";
      const notificationPart = data.notificationMessage ? ` ${data.notificationMessage}` : '';
      const successMessage = `${data.message}${notificationPart} Dossier #${data.dossierId} créé avec ${data.documentsCount ?? 0} document(s). Redirection vers la connexion...`;

      setSubmitSuccessMessage(successMessage);
      setFormData(createInitialFormData());
      setHasChain(false);
      setPointVentes([]);
      resetDocuments();
      setCurrentStep(1);
      setAttemptedSubmit(false);
      setAttemptedRib(false);

      window.sessionStorage.setItem('authSuccessMessage', loginMessage);

      if (redirectTimerRef.current !== null) clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = setTimeout(() => {
        onBackToLogin?.();
      }, 1000);
    } catch (error) {
      const msg = extractErrorMessage(error);
      setSubmitErrorMessage(`Votre demande n'est pas enregistrée. ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const isRibFieldLocked = !Boolean(documentNames.ribDocument || documentFiles.ribDocument || documentValidationStates.ribDocument);
  const ribFieldPlaceholder = isRibFieldLocked
    ? "Importez d'abord l'image du RIB"
    : documentValidationStates.ribDocument?.status === 'validating'
      ? 'Extraction du RIB en cours...'
      : 'RIB extrait automatiquement - corrigez si besoin';
  const ribFieldMessage = isRibFieldLocked
    ? "Le champ RIB sera pré-rempli à partir de l'image du justificatif RIB."
    : documentValidationStates.ribDocument?.status === 'validating'
      ? "Le RIB est en cours d'extraction depuis l'image importée."
      : "Le RIB a été pré-rempli depuis l'image. Vous pouvez uniquement le corriger si besoin.";

  return (
    <div className="auth-panel register-angular-panel">
      <div className="progress-head">
        <div>
          <h1 className="card-title">Créez votre compte partenaire</h1>
        </div>
        <div className="progress-meta">
          <span>Progression</span>
          <strong>{progressPercentage}%</strong>
        </div>
      </div>

      <div className="progress-track" aria-hidden="true">
        <span className="progress-fill" style={{ width: `${progressPercentage}%` }} />
      </div>

      {submitSuccessMessage && <p className="submit-feedback submit-feedback-success">{submitSuccessMessage}</p>}
      {submitErrorMessage && <p className="submit-feedback submit-feedback-error">{submitErrorMessage}</p>}

      <div className="stepper">
        {stepLabels.map((label, index) => {
          const step = index + 1;
          return (
            <button
              key={label}
              className={`step-chip${currentStep === step ? ' is-active' : ''}${canAccessStep(step) && currentStep > step ? ' is-complete' : ''}`}
              type="button"
              disabled={!canAccessStep(step) || isSubmitting}
              onClick={() => { if (!isSubmitting && canAccessStep(step)) setCurrentStep(step); }}
            >
              <span className="step-index">{step}</span>
              <span className="step-text">{label}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={onSubmit}>
        {currentStep === 1 && (
          <div className="step-panel">
            <div className="step-heading">
              <span className="step-kicker">Partie 1 sur 3</span>
              <h2>Informations générales</h2>
              <p>Commencez par le profil commerçant et le type d'affiliation.</p>
            </div>
            <div className="fields-grid">
              {generalFields.map((field) => (
                <FormField
                  key={field.key}
                  field={field}
                  value={formData[field.key]}
                  invalid={isFieldInvalid(field.key)}
                  required={isFieldRequired(field.key)}
                  disabled={isSubmitting}
                  onChange={(value) => setFieldValue(field.key, value)}
                  onBlur={() => markFieldTouched(field.key)}
                />
              ))}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="step-panel">
            <div className="step-heading">
              <span className="step-kicker">Partie 2 sur 3</span>
              <h2>Coordonnées et détails</h2>
              <p>Complétez les coordonnées et les informations liées au profil {commercantTypeLabel.toLowerCase()}.</p>
            </div>

            <div className="badge-row">
              <div className="type-badge"><span>Type sélectionné</span><strong>{commercantTypeLabel}</strong></div>
              <div className="type-badge"><span>Affiliation</span><strong>{affiliationTypeLabel}</strong></div>
            </div>

            <div className="fields-grid">
              <div className="field">
                <label htmlFor="register-has-chain">Rattaché à une chaîne ?</label>
                <div className="input-wrap input-wrap-select">
                  <Icon type="activity" />
                  <select
                    id="register-has-chain"
                    value={hasChain ? 'oui' : 'non'}
                    disabled={isSubmitting}
                    onChange={(e) => onHasChainChange(e.target.value === 'oui')}
                  >
                    <option value="non">Non</option>
                    <option value="oui">Oui</option>
                  </select>
                </div>
              </div>
              {contactAndSpecificFields.map((field) => (
                <FormField
                  key={field.key}
                  field={field}
                  value={formData[field.key]}
                  invalid={isFieldInvalid(field.key)}
                  required={isFieldRequired(field.key)}
                  disabled={isSubmitting}
                  onChange={(value) => setFieldValue(field.key, value)}
                  onBlur={() => markFieldTouched(field.key)}
                />
              ))}
            </div>

            {hasEncaissementFields && pointVentes.length > 0 && (
              <div className="pdv-list">
                {pointVentes.map((pointVente, index) => (
                  <div className="pdv-item" key={index}>
                    <div className="pdv-title"><span>Point de vente {index + 1}</span></div>
                    <div className="pdv-item-layout">
                    <div className="fields-grid pdv-fields-grid">
                      <PointVenteField
                        id={`pdv-nom-${index}`}
                        label="Nom du point de vente"
                        value={pointVente.nom}
                        invalid={isPointVenteFieldInvalid(index, 'nom')}
                        disabled={isSubmitting}
                        onChange={(v) => setPointVenteField(index, 'nom', v)}
                        onBlur={() => setTouchedPointVenteFields((prev) => new Set(prev).add(`${index}:nom`))}
                      />
                      <PointVenteField
                        id={`pdv-adresse-${index}`}
                        label="Adresse"
                        value={pointVente.adresse}
                        invalid={isPointVenteFieldInvalid(index, 'adresse')}
                        disabled={isSubmitting}
                        onChange={(v) => setPointVenteField(index, 'adresse', v)}
                        onBlur={() => setTouchedPointVenteFields((prev) => new Set(prev).add(`${index}:adresse`))}
                      />
                      <div className={`field${isPointVenteFieldInvalid(index, 'ville') ? ' field-invalid' : ''}`}>
                        <label htmlFor={`pdv-ville-${index}`}>
                          Ville <span className="required-mark">*</span>
                        </label>
                        <div className={`input-wrap input-wrap-select${isPointVenteFieldInvalid(index, 'ville') ? ' is-invalid' : ''}`}>
                          <select
                            id={`pdv-ville-${index}`}
                            value={pointVente.ville}
                            disabled={isSubmitting}
                            onChange={(e) => setPointVenteField(index, 'ville', e.target.value)}
                            onBlur={() => setTouchedPointVenteFields((prev) => new Set(prev).add(`${index}:ville`))}
                          >
                            <option value="">Sélectionnez une ville</option>
                            {villeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        {isPointVenteFieldInvalid(index, 'ville') && <p className="field-error">Ce champ est obligatoire.</p>}
                      </div>
                      <QuartierCombobox
                        id={`pdv-quartier-${index}`}
                        label="Quartier"
                        value={pointVente.quartier}
                        ville={pointVente.ville}
                        optional
                        disabled={isSubmitting}
                        onChange={(v) => setPointVenteField(index, 'quartier', v)}
                      />
                      <PointVenteField
                        id={`pdv-telephone-${index}`}
                        label="Téléphone"
                        type="tel"
                        value={pointVente.telephone}
                        invalid={isPointVenteFieldInvalid(index, 'telephone')}
                        disabled={isSubmitting}
                        onChange={(v) => setPointVenteField(index, 'telephone', v)}
                        onBlur={() => setTouchedPointVenteFields((prev) => new Set(prev).add(`${index}:telephone`))}
                      />
                      <PointVenteField
                        id={`pdv-cp-${index}`}
                        label="Code postal"
                        value={pointVente.codePostal}
                        optional
                        disabled={isSubmitting}
                        onChange={(v) => setPointVenteField(index, 'codePostal', v)}
                      />
                      <PointVenteField
                        id={`pdv-email-${index}`}
                        label="E-mail"
                        type="email"
                        value={pointVente.email}
                        optional
                        disabled={isSubmitting}
                        onChange={(v) => setPointVenteField(index, 'email', v)}
                      />
                    </div>
                    <div className="pdv-location-field">
                      {/* <span> plutot que <label> (Sonar S6853) : PdvLocationPicker
                          n'est pas un unique champ de formulaire associable. */}
                      <span className="field-caption">Emplacement sur la carte</span>
                      <PdvLocationPicker
                        ville={pointVente.ville}
                        latitude={pointVente.latitude}
                        longitude={pointVente.longitude}
                        disabled={isSubmitting}
                        onChange={(lat, lon) => setPointVentePosition(index, lat, lon)}
                      />
                    </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="step-panel">
            <div className="step-heading">
              <span className="step-kicker">Partie 3 sur 3</span>
              <h2>Documents et validation</h2>
              <p>Ajoutez les pièces du dossier et validez la demande.</p>
            </div>

            <div className="fields-grid fields-grid-final">
              <FormField
                field={{ key: 'rib', label: 'RIB', placeholder: ribFieldPlaceholder, icon: 'bank', readonly: isRibFieldLocked }}
                value={formData.rib}
                invalid={isFieldInvalid('rib')}
                required
                disabled={isSubmitting}
                note={ribFieldMessage}
                onChange={(value) => setFieldValue('rib', value)}
                onBlur={() => { setAttemptedRib(true); markFieldTouched('rib'); }}
              />
            </div>

            <div className="docs-section">
              <div className="docs-head">
                <h3>Pièces du dossier</h3>
                <p>
                  Les images compatibles sont vérifiées automatiquement pour la CIN, le RIB, la patente,
                  les statuts, le RC, l'ICE et l'attestation AE. Les PDF et les autres pièces restent acceptées sans blocage.
                </p>
              </div>
              <div className="docs-grid docs-grid-simple">
                {requiredDocuments.map((document) => {
                  const validation = documentValidationStates[document.key];
                  return (
                    <label className="doc-card doc-card-simple" key={document.key} htmlFor={`doc-${document.key}`}>
                      <span className="doc-meta">
                        <span className="doc-title">{document.label}</span>
                        {document.optional && <span className="doc-flag">Optionnel</span>}
                      </span>
                      <span className="doc-caption">{document.hint}</span>
                      {validation && (
                        <span className={`doc-status is-${validation.status}`}>
                          {getDocumentValidationLabel(validation.status)}
                        </span>
                      )}
                      <span className={`doc-file${!documentNames[document.key] ? ' is-empty' : ''}`}>
                        {documentNames[document.key] || 'Aucun fichier'}
                      </span>
                      {validation?.message && <span className="doc-validation-note">{validation.message}</span>}
                      <span className="doc-action">
                        {validation?.status === 'validating' ? 'Validation...' : 'Importer'}
                      </span>
                      <input
                        className="doc-input"
                        id={`doc-${document.key}`}
                        type="file"
                        disabled={isSubmitting || validation?.status === 'validating'}
                        onChange={(e) => void onDocumentSelected(document.key, e.target.files?.[0])}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <label className="terms-row" htmlFor="acceptTerms">
              <input
                id="acceptTerms"
                type="checkbox"
                checked={formData.acceptTerms}
                disabled={isSubmitting}
                onChange={(e) => setFormData((prev) => ({ ...prev, acceptTerms: e.target.checked }))}
              />
              <span>Je confirme l'exactitude des informations et l'import des pièces demandées.</span>
            </label>

            <p className="summary-note">
              Votre demande sera transmise à l'équipe commerciale. Un commercial vous contactera avant l'envoi de l'e-mail d'activation.
            </p>
          </div>
        )}

        <div className="step-actions">
          {currentStep > 1 && (
            <button className="ghost-btn" type="button" disabled={isSubmitting} onClick={previousStep}>
              Retour
            </button>
          )}
          {currentStep < stepLabels.length && (
            <button className="next-btn" type="button" disabled={!canContinue || isSubmitting} onClick={nextStep}>
              Continuer
            </button>
          )}
          {currentStep === stepLabels.length && (
            <button className="login-btn" type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? 'Envoi en cours...' : isAnyDocumentValidationPending ? 'Validation des pièces...' : 'Finaliser la demande'}
            </button>
          )}
        </div>
      </form>

      <div className="alt-row">
        <span>Vous avez déjà un compte ?</span>
        <button className="inline-link" type="button" onClick={onBackToLogin}>
          Retour à la connexion
        </button>
      </div>
    </div>
  );
}

const QUANTITY_FIELD_LIMITS: Partial<Record<FieldKey, number>> = {
  nombrePointsVente: MAX_POINTS_VENTE,
  nombreTpe: MAX_TPE,
  nombreQrSoftpos: MAX_QR_SOFTPOS
};

// Sonar S3358 : extrait des ternaires imbriquées min/max ci-dessous — un seul
// des champs "nombre..." est actif a la fois, donc une simple table suffit.
function resolveNumberFieldMin(field: FieldConfig): number | undefined {
  if (field.key in QUANTITY_FIELD_LIMITS) return 1;
  return field.type === 'number' ? 0 : undefined;
}

function resolveNumberFieldMax(field: FieldConfig): number | undefined {
  return QUANTITY_FIELD_LIMITS[field.key];
}

function FormField({
  field, value, invalid, required, disabled, note, onChange, onBlur
}: {
  field: FieldConfig;
  value: string;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
  note?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  return (
    <div className={`field${invalid ? ' field-invalid' : ''}`}>
      <label htmlFor={`register-${field.key}`}>
        {field.label}
        {required && <span className="required-mark">*</span>}
      </label>
      <div className={`input-wrap${field.options?.length ? ' input-wrap-select' : ''}${invalid ? ' is-invalid' : ''}`}>
        <Icon type={field.icon} />
        {field.options?.length ? (
          <select
            id={`register-${field.key}`}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          >
            <option value="">{field.placeholder}</option>
            {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input
            id={`register-${field.key}`}
            type={field.type ?? 'text'}
            placeholder={field.placeholder}
            autoComplete={field.autocomplete ?? 'off'}
            inputMode={field.inputMode}
            min={resolveNumberFieldMin(field)}
            max={resolveNumberFieldMax(field)}
            step={field.type === 'number' ? 1 : undefined}
            disabled={disabled}
            readOnly={field.readonly ?? false}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
          />
        )}
      </div>
      {note && <p className="field-note">{note}</p>}
      {invalid && <p className="field-error">Ce champ est obligatoire.</p>}
    </div>
  );
}

function PointVenteField({
  id, label, value = '', invalid = false, optional = false, type = 'text', disabled = false, onChange, onBlur, listOptions
}: {
  id: string;
  label: string;
  value?: string;
  invalid?: boolean;
  optional?: boolean;
  type?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  listOptions?: string[];
}) {
  const listId = listOptions ? `${id}-list` : undefined;
  return (
    <div className={`field${invalid ? ' field-invalid' : ''}`}>
      <label htmlFor={id}>
        {label}{!optional && <span className="required-mark">*</span>}
      </label>
      <div className={`input-wrap${invalid ? ' is-invalid' : ''}`}>
        <input
          id={id}
          type={type}
          placeholder={optional ? 'Optionnel' : label}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          list={listId}
          autoComplete="off"
        />
        {listId && listOptions && (
          <datalist id={listId}>
            {listOptions.map((option) => <option key={option} value={option} />)}
          </datalist>
        )}
      </div>
      {invalid && <p className="field-error">Ce champ est obligatoire.</p>}
    </div>
  );
}

function Icon({ type }: { type: FieldConfig['icon'] }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {type === 'identity' && <><path d="M20 21a8 8 0 1 0-16 0" /><circle cx="12" cy="8" r="4" /></>}
      {type === 'activity' && <><path d="M4 19h16" /><path d="M6 15h12" /><path d="M8 11h8" /><path d="M10 7h4" /></>}
      {type === 'hash' && <path d="M5 9h14M4 15h14M10 4 8 20M16 4l-2 16" />}
      {type === 'phone' && <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" />}
      {type === 'mail' && <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>}
      {type === 'map' && <><path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></>}
      {type === 'id' && <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M8 10h8M8 14h5" /></>}
      {type === 'building' && <><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /></>}
      {type === 'bank' && <><path d="M3 10 12 4l9 6" /><path d="M5 10v8M9 10v8M15 10v8M19 10v8" /><path d="M3 18h18" /></>}
    </svg>
  );
}
