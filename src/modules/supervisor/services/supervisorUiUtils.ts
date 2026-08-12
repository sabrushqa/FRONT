import {
  AffiliationActivationPayload,
  AffiliationRequestItem
} from './supervisorApi';
import {
  formatEnumLabel,
  resolveAffiliationStatusKey
} from '../../workspace/workspaceUtils';

export { formatEnumLabel, resolveAffiliationStatusKey };

export const AFFILIATION_PACKAGE_OPTIONS = [
  { value: 'Abonnement Decouverte', label: 'Abonnement Découverte' },
  { value: 'Abonnement Essentiel', label: 'Abonnement Essentiel' },
  { value: 'Abonnement Premium', label: 'Abonnement Premium' }
];

// Toutes les valeurs possibles de l'enum backend TypeAffiliation. Une liste
// deroulante de filtre doit toujours proposer l'ensemble de ces valeurs,
// meme si aucune donnee chargee ne les contient actuellement — sinon
// l'utilisateur ne peut jamais filtrer sur un type absent du jeu de donnees
// courant (ex: 0 resultat affiche => menu vide).
export const AFFILIATION_TYPE_VALUES = [
  'TPE',
  'E_COMMERCE',
  'ENCAISSEMENT_ET_ECOMMERCE',
  'QR_CODE',
  'SOFTPOS'
];

export function getAffiliationStatusLabel(request: AffiliationRequestItem): string {
  if (request.status === 'EN_ATTENTE_ASSIGNATION') {
    return "En attente d'assignation";
  }

  if (request.status === 'EN_ATTENTE_VALIDATION_BOA') {
    return 'À valider par le back office';
  }

  if (request.status === 'INCOMPLET') {
    return 'À corriger';
  }

  if (request.status === 'ABANDONNE') {
    return 'Abandonné';
  }

  switch (resolveAffiliationStatusKey(request)) {
    case 'active':
      return 'Affiliation validée';
    case 'refused':
      return 'Refusé';
    case 'sent':
      return 'Contrat a signer';
    case 'progress':
      return 'En cours';
    default:
      return 'À compléter';
  }
}

export function getAffiliationStatusTone(request: AffiliationRequestItem): string {
  switch (resolveAffiliationStatusKey(request)) {
    case 'active':
      return 'tone-active';
    case 'refused':
      return 'tone-danger';
    case 'sent':
      return 'tone-info';
    case 'progress':
      return 'tone-progress';
    default:
      return 'tone-pending';
  }
}

export function getAffiliationProductLabel(request: AffiliationRequestItem): string {
  if (request.typeAffiliation === 'TPE') {
    return firstMeaningful(
      request.modeMiseADispositionTpe,
      request.equipementTpe,
      request.connectiviteTpe
    );
  }

  if (request.typeAffiliation === 'E_COMMERCE') {
    return firstMeaningful(request.modeServiceEcommerce, request.siteMarchandUrl);
  }

  return firstMeaningful(request.modeleQrSoftpos, request.activite);
}

export function firstMeaningful(
  ...values: Array<string | number | null | undefined>
): string {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    const asString = String(value).trim();
    if (asString) {
      return asString;
    }
  }
  return '-';
}

export function createAffiliationActivationPayload(): AffiliationActivationPayload {
  return {
    mcc: '',
    abonnementPackage: '',
    commissionLocaleTpe: '',
    commissionEtrangereTpe: '',
    depotTpe: '',
    prixAchatTpe: '',
    prixLicenceTpe: '',
    commissionLocaleEcommerce: '',
    commissionEtrangereEcommerce: '',
    fraisMiseEnServiceEcommerce: '',
    commissionLocaleQrSoftpos: '',
    commissionEtrangereQrSoftpos: '',
    fraisServiceQrSoftpos: '',
    conditionsQrSoftpos: '',
    serviceCreditVoucher: false,
    serviceAnnulation: false,
    serviceDcc: false,
    servicePreAutorisationCartePresente: false,
    servicePreAutorisationCartePresenteConfirmationManuelle: false,
    servicePreAutorisationManuelleConfirmationCartePresente: false,
    serviceTransactionManuelle: false,
    serviceTransactionManuelleSansCvv: false,
    compteRenduQualification: '',
    compteRenduAcquereur: '',
    compteRenduOrigineProspect: '',
    compteRenduOrigineProspectDetail: '',
    compteRenduContactNomPrenom: '',
    compteRenduContactFonction: '',
    compteRenduPointVenteAcronyme: '',
    compteRenduActionnaires: '',
    compteRenduCommercant: '',
    compteRenduChaine: '',
    compteRenduRelationsLc: '',
    compteRenduDateOuverture: '',
    compteRenduNombreEmployes: '',
    compteRenduActivite: '',
    compteRenduMcc: '',
    compteRenduStandingMagasin: '',
    compteRenduNatureMarchandises: '',
    compteRenduSuperficieLocal: '',
    compteRenduStatutLocal: '',
    compteRenduChiffreAffairesAnnuel: '',
    compteRenduPartPaiementCarte: '',
    compteRenduPartCarteLocale: '',
    compteRenduProfilCommercant: '',
    compteRenduAppreciationVisite: '',
    compteRenduCommentaire: '',
    compteRenduFaitA: '',
    compteRenduDateVisite: ''
  };
}

export function createAffiliationActivationPayloadFromRequest(
  request: AffiliationRequestItem
): AffiliationActivationPayload {
  return {
    mcc: request.mcc || request.compteRenduMcc || '',
    abonnementPackage: request.abonnementPackage || '',
    commissionLocaleTpe: request.commissionLocaleTpe || '',
    commissionEtrangereTpe: request.commissionEtrangereTpe || '',
    depotTpe: request.depotTpe || '',
    prixAchatTpe: request.prixAchatTpe || '',
    prixLicenceTpe: request.prixLicenceTpe || '',
    commissionLocaleEcommerce: request.commissionLocaleEcommerce || '',
    commissionEtrangereEcommerce: request.commissionEtrangereEcommerce || '',
    fraisMiseEnServiceEcommerce: request.fraisMiseEnServiceEcommerce || '',
    commissionLocaleQrSoftpos: request.commissionLocaleQrSoftpos || '',
    commissionEtrangereQrSoftpos: request.commissionEtrangereQrSoftpos || '',
    fraisServiceQrSoftpos: request.fraisServiceQrSoftpos || '',
    conditionsQrSoftpos: request.conditionsQrSoftpos || '',
    serviceCreditVoucher: Boolean(request.serviceCreditVoucher),
    serviceAnnulation: Boolean(request.serviceAnnulation),
    serviceDcc: Boolean(request.serviceDcc),
    servicePreAutorisationCartePresente: Boolean(request.servicePreAutorisationCartePresente),
    servicePreAutorisationCartePresenteConfirmationManuelle: Boolean(
      request.servicePreAutorisationCartePresenteConfirmationManuelle
    ),
    servicePreAutorisationManuelleConfirmationCartePresente: Boolean(
      request.servicePreAutorisationManuelleConfirmationCartePresente
    ),
    serviceTransactionManuelle: Boolean(request.serviceTransactionManuelle),
    serviceTransactionManuelleSansCvv: Boolean(request.serviceTransactionManuelleSansCvv),
    compteRenduQualification: request.compteRenduQualification || '',
    compteRenduAcquereur: request.compteRenduAcquereur || '',
    compteRenduOrigineProspect: request.compteRenduOrigineProspect || '',
    compteRenduOrigineProspectDetail: request.compteRenduOrigineProspectDetail || '',
    compteRenduContactNomPrenom: request.compteRenduContactNomPrenom || request.nomCommercant || '',
    compteRenduContactFonction: request.compteRenduContactFonction || '',
    compteRenduPointVenteAcronyme: request.compteRenduPointVenteAcronyme || '',
    compteRenduActionnaires: request.compteRenduActionnaires || '',
    compteRenduCommercant: request.compteRenduCommercant || request.nomCommercant || '',
    compteRenduChaine: request.compteRenduChaine || '',
    compteRenduRelationsLc: request.compteRenduRelationsLc || '',
    compteRenduDateOuverture: request.compteRenduDateOuverture || '',
    compteRenduNombreEmployes: request.compteRenduNombreEmployes || '',
    compteRenduActivite: request.compteRenduActivite || request.activite || '',
    compteRenduMcc: request.compteRenduMcc || request.mcc || '',
    compteRenduStandingMagasin: request.compteRenduStandingMagasin || '',
    compteRenduNatureMarchandises: request.compteRenduNatureMarchandises || '',
    compteRenduSuperficieLocal: request.compteRenduSuperficieLocal || '',
    compteRenduStatutLocal: request.compteRenduStatutLocal || '',
    compteRenduChiffreAffairesAnnuel: request.compteRenduChiffreAffairesAnnuel || '',
    compteRenduPartPaiementCarte: request.compteRenduPartPaiementCarte || '',
    compteRenduPartCarteLocale: request.compteRenduPartCarteLocale || '',
    compteRenduProfilCommercant: request.compteRenduProfilCommercant || '',
    compteRenduAppreciationVisite: request.compteRenduAppreciationVisite || '',
    compteRenduCommentaire: request.compteRenduCommentaire || '',
    compteRenduFaitA: request.compteRenduFaitA || request.ville || '',
    compteRenduDateVisite: request.compteRenduDateVisite || ''
  };
}

interface AxiosLikeError {
  response?: { data?: unknown };
  message?: string;
}

export function extractApiErrorMessage(error: unknown, fallback: string): string {
  const err = error as AxiosLikeError;
  const data = err?.response?.data;

  if (typeof data === 'string' && data.trim()) {
    return data.trim();
  }

  if (data && typeof data === 'object') {
    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }

  if (typeof err?.message === 'string' && err.message.trim()) {
    return err.message.trim();
  }

  return fallback;
}

export function isMeaningfulValue(value: string): boolean {
  const normalizedValue = value?.trim();
  return Boolean(normalizedValue && normalizedValue !== '-');
}
