import type { AffiliationRequestItem } from '../supervisor/services/supervisorApi';
import type { UserSessionResponse } from '../../store/sessionStore';

export function formatEnumLabel(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getWorkspaceRoleLabel(role: string | null | undefined): string {
  switch (role) {
    case 'SUPERVISEUR': return 'Superviseur';
    case 'COMMERCIAL': return 'Commercial';
    case 'BACK_OFFICE': return 'Back Office';
    case 'COMMERCANT': return 'Commerçant';
    case 'SOUS_COMMERCANT': return 'Sous-commerçant';
    default: return role ?? '';
  }
}

export function isSupervisorRole(role: string | null | undefined): boolean {
  return role === 'SUPERVISEUR';
}

export type AffiliationStatusKey = 'pending' | 'progress' | 'sent' | 'active' | 'refused';

export function resolveAffiliationStatusKey(request: { status?: string }): AffiliationStatusKey {
  switch (request.status) {
    case 'BROUILLON':
    case 'EN_ATTENTE_ASSIGNATION':
    case 'SOUMIS':
    case 'EN_ATTENTE':
    case 'INCOMPLET':
      return 'pending';
    case 'EN_ATTENTE_VALIDATION_BOA':
    case 'EN_COURS':
    case 'TRANSMIS_BACK_OFFICE':
      return 'progress';
    case 'CONTRAT_A_SIGNER':
    case 'CONTRAT_ENVOYE':
    case 'ACTIVATION_ENVOYEE':
      return 'sent';
    case 'ACCEPTE':
    case 'ACTIF':
      return 'active';
    case 'ABANDONNE':
      return 'refused';
    default:
      return 'pending';
  }
}

export function isCommercialDirectRequest(request: Pick<AffiliationRequestItem, 'origineCreation' | 'status'>): boolean {
  return request.origineCreation === 'COMMERCIAL_DIRECT' || request.status === 'BROUILLON';
}

export function isNewPdvRequest(request: Pick<AffiliationRequestItem, 'origineCreation'>): boolean {
  return request.origineCreation === 'NOUVEAU_PDV';
}

export function isAutoAffiliationRequest(request: Pick<AffiliationRequestItem, 'origineCreation' | 'status'>): boolean {
  return !isCommercialDirectRequest(request) && !isNewPdvRequest(request);
}

function normalizeRegionValue(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

// Mirrors the backend's isSameCommercialRegion check (StaffAffiliationManagementService) so
// the commercial dashboard never surfaces auto-affiliation dossiers from another region.
export function isSameRegionAsCommercial(
  request: Pick<AffiliationRequestItem, 'region'>,
  commercialRegion: string | null | undefined
): boolean {
  return normalizeRegionValue(request.region) === normalizeRegionValue(commercialRegion);
}

// Shared between BackofficeOverviewPage and BackofficeHistoryPage so the "handled by me"
// attribution logic can't drift out of sync between the two pages. Uses exact equality only
// (no substring match) to avoid misattributing a dossier between two agents whose names/emails
// happen to overlap (e.g. "Ali" vs "Ali Ben Ali").
export function isHandledByCurrentBackOffice(
  request: Pick<AffiliationRequestItem, 'backOfficeUtilisateurId' | 'backOfficeTraitant'>,
  session: Pick<UserSessionResponse, 'utilisateurId' | 'email' | 'nom' | 'profile'> | null | undefined
): boolean {
  if (request.backOfficeUtilisateurId != null && session?.utilisateurId != null) {
    return request.backOfficeUtilisateurId === session.utilisateurId;
  }

  const traitant = (request.backOfficeTraitant ?? '').trim().toLowerCase();
  if (!traitant) return false;

  const candidates = [session?.email, session?.nom, session?.profile?.nom, session?.profile?.email]
    .map((value) => (value ?? '').trim().toLowerCase())
    .filter(Boolean);

  return candidates.some((value) => traitant === value);
}

export function formatRelativeDate(dateValue: string | null | undefined): string {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86400000);

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays > 1 && diffDays < 7) return `Il y a ${diffDays} jours`;
  return date.toLocaleDateString('fr-MA');
}
