import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatEnumLabel,
  getWorkspaceRoleLabel,
  isSupervisorRole,
  resolveAffiliationStatusKey,
  isCommercialDirectRequest,
  isNewPdvRequest,
  isAutoAffiliationRequest,
  isSameRegionAsCommercial,
  isHandledByCurrentBackOffice,
  formatRelativeDate
} from './workspaceUtils';

describe('formatEnumLabel', () => {
  it('renvoie une chaine vide pour une valeur absente', () => {
    expect(formatEnumLabel(null)).toBe('');
    expect(formatEnumLabel(undefined)).toBe('');
    expect(formatEnumLabel('')).toBe('');
  });

  it('remplace les underscores et met en majuscule chaque mot', () => {
    expect(formatEnumLabel('EN_ATTENTE_VALIDATION')).toBe('En Attente Validation');
    expect(formatEnumLabel('actif')).toBe('Actif');
  });
});

describe('getWorkspaceRoleLabel', () => {
  it.each([
    ['SUPERVISEUR', 'Superviseur'],
    ['COMMERCIAL', 'Commercial'],
    ['BACK_OFFICE', 'Back Office'],
    ['COMMERCANT', 'Commerçant'],
    ['SOUS_COMMERCANT', 'Sous-commerçant']
  ])('traduit %s en %s', (role, expected) => {
    expect(getWorkspaceRoleLabel(role)).toBe(expected);
  });

  it('renvoie le role brut si inconnu, ou une chaine vide si absent', () => {
    expect(getWorkspaceRoleLabel('AUTRE_ROLE')).toBe('AUTRE_ROLE');
    expect(getWorkspaceRoleLabel(null)).toBe('');
    expect(getWorkspaceRoleLabel(undefined)).toBe('');
  });
});

describe('isSupervisorRole', () => {
  it('est vrai uniquement pour SUPERVISEUR', () => {
    expect(isSupervisorRole('SUPERVISEUR')).toBe(true);
    expect(isSupervisorRole('COMMERCIAL')).toBe(false);
    expect(isSupervisorRole(null)).toBe(false);
  });
});

describe('resolveAffiliationStatusKey', () => {
  it.each([
    ['BROUILLON', 'pending'],
    ['EN_ATTENTE_ASSIGNATION', 'pending'],
    ['SOUMIS', 'pending'],
    ['EN_ATTENTE', 'pending'],
    ['INCOMPLET', 'pending'],
    ['EN_ATTENTE_VALIDATION_BOA', 'progress'],
    ['EN_COURS', 'progress'],
    ['TRANSMIS_BACK_OFFICE', 'progress'],
    ['CONTRAT_A_SIGNER', 'sent'],
    ['CONTRAT_ENVOYE', 'sent'],
    ['ACTIVATION_ENVOYEE', 'sent'],
    ['ACCEPTE', 'active'],
    ['ACTIF', 'active'],
    ['ABANDONNE', 'refused'],
    ['STATUT_INCONNU', 'pending'],
    [undefined, 'pending']
  ])('mappe le statut %s vers la cle %s', (status, expected) => {
    expect(resolveAffiliationStatusKey({ status })).toBe(expected);
  });
});

describe('isCommercialDirectRequest / isNewPdvRequest / isAutoAffiliationRequest', () => {
  it('identifie une demande commerciale directe par origine ou par statut BROUILLON', () => {
    expect(isCommercialDirectRequest({ origineCreation: 'COMMERCIAL_DIRECT', status: 'SOUMIS' })).toBe(true);
    expect(isCommercialDirectRequest({ origineCreation: 'AUTRE', status: 'BROUILLON' })).toBe(true);
    expect(isCommercialDirectRequest({ origineCreation: 'AUTRE', status: 'SOUMIS' })).toBe(false);
  });

  it('reste une demande commerciale directe meme avec le statut "a corriger" (INCOMPLET)', () => {
    // Regression: un dossier de prospection directe renvoye pour correction doit
    // rester classe "commercial direct" et ne jamais basculer en auto-affiliation.
    expect(isCommercialDirectRequest({ origineCreation: 'COMMERCIAL_DIRECT', status: 'INCOMPLET' })).toBe(true);
    expect(isAutoAffiliationRequest({ origineCreation: 'COMMERCIAL_DIRECT', status: 'INCOMPLET' })).toBe(false);
  });

  it('identifie une demande de nouveau PDV', () => {
    expect(isNewPdvRequest({ origineCreation: 'NOUVEAU_PDV' })).toBe(true);
    expect(isNewPdvRequest({ origineCreation: 'AUTRE' })).toBe(false);
  });

  it('une demande auto-affiliation exclut les deux autres categories', () => {
    expect(isAutoAffiliationRequest({ origineCreation: 'AUTRE', status: 'SOUMIS' })).toBe(true);
    expect(isAutoAffiliationRequest({ origineCreation: 'NOUVEAU_PDV', status: 'SOUMIS' })).toBe(false);
    expect(isAutoAffiliationRequest({ origineCreation: 'COMMERCIAL_DIRECT', status: 'SOUMIS' })).toBe(false);
    expect(isAutoAffiliationRequest({ origineCreation: 'AUTRE', status: 'BROUILLON' })).toBe(false);
  });
});

describe('isSameRegionAsCommercial', () => {
  it('compare les regions en ignorant casse et accents', () => {
    expect(isSameRegionAsCommercial({ region: 'Fès-Meknès' }, 'fes-meknes')).toBe(true);
    expect(isSameRegionAsCommercial({ region: 'Casablanca' }, 'Rabat')).toBe(false);
  });

  it('traite les valeurs absentes comme egales', () => {
    // `region` est typee `string` (jamais null) cote AffiliationRequestItem,
    // mais la fonction reste defensive a l'execution pour des donnees API
    // malformees — `as never` simule volontairement cette valeur hors-type,
    // meme idiome que isHandledByCurrentBackOffice plus bas dans ce fichier.
    expect(isSameRegionAsCommercial({ region: null as never }, undefined)).toBe(true);
  });
});

describe('isHandledByCurrentBackOffice', () => {
  it("compare par identifiant utilisateur en priorite quand les deux sont presents", () => {
    const request = { backOfficeUtilisateurId: 42, backOfficeTraitant: 'Autre Nom' };
    const session = { utilisateurId: 42, email: 'x@x.com', nom: 'X', profile: undefined };
    expect(isHandledByCurrentBackOffice(request, session as never)).toBe(true);
  });

  it('renvoie false si les identifiants different', () => {
    const request = { backOfficeUtilisateurId: 42, backOfficeTraitant: '' };
    const session = { utilisateurId: 7, email: '', nom: '', profile: undefined };
    expect(isHandledByCurrentBackOffice(request, session as never)).toBe(false);
  });

  it('retombe sur la correspondance exacte de nom/email quand les IDs sont absents', () => {
    const request = { backOfficeUtilisateurId: null, backOfficeTraitant: 'ali ben ali' };
    const session = { utilisateurId: null, email: '', nom: 'Ali Ben Ali', profile: undefined };
    expect(isHandledByCurrentBackOffice(request, session as never)).toBe(true);
  });

  it("n'effectue pas de correspondance partielle (Ali vs Ali Ben Ali)", () => {
    const request = { backOfficeUtilisateurId: null, backOfficeTraitant: 'ali ben ali' };
    const session = { utilisateurId: null, email: '', nom: 'Ali', profile: undefined };
    expect(isHandledByCurrentBackOffice(request, session as never)).toBe(false);
  });

  it('renvoie false si aucun backOfficeTraitant et pas de session', () => {
    expect(isHandledByCurrentBackOffice({ backOfficeUtilisateurId: null, backOfficeTraitant: '' }, null)).toBe(false);
  });
});

describe('formatRelativeDate', () => {
  afterEach(() => vi.useRealTimers());

  it('renvoie une chaine vide pour une date absente ou invalide', () => {
    expect(formatRelativeDate(null)).toBe('');
    expect(formatRelativeDate(undefined)).toBe('');
    expect(formatRelativeDate('pas-une-date')).toBe('');
  });

  it("renvoie Aujourd'hui / Hier / Il y a N jours selon l'ecart", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T12:00:00'));

    expect(formatRelativeDate('2026-07-29T08:00:00')).toBe("Aujourd'hui");
    expect(formatRelativeDate('2026-07-28T08:00:00')).toBe('Hier');
    expect(formatRelativeDate('2026-07-25T08:00:00')).toBe('Il y a 4 jours');
  });

  it('renvoie une date localisee au-dela de 7 jours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T12:00:00'));
    expect(formatRelativeDate('2026-07-01T08:00:00')).toBe(new Date('2026-07-01T08:00:00').toLocaleDateString('fr-MA'));
  });
});
