import { describe, it, expect } from 'vitest';
import {
  getAffiliationStatusLabel,
  getAffiliationStatusTone,
  getAffiliationProductLabel,
  firstMeaningful,
  createAffiliationActivationPayload,
  createAffiliationActivationPayloadFromRequest,
  extractApiErrorMessage,
  isMeaningfulValue
} from './supervisorUiUtils';
import type { AffiliationRequestItem } from './supervisorApi';

function makeRequest(overrides: Partial<AffiliationRequestItem> = {}): AffiliationRequestItem {
  return { status: 'SOUMIS', ...overrides } as AffiliationRequestItem;
}

describe('getAffiliationStatusLabel', () => {
  it.each([
    ['EN_ATTENTE_ASSIGNATION', "En attente d'assignation"],
    ['EN_ATTENTE_VALIDATION_BOA', 'À valider par le back office'],
    ['ACTIF', 'Affiliation validée'],
    ['ABANDONNE', 'Abandonné'],
    ['CONTRAT_A_SIGNER', 'Contrat a signer'],
    ['EN_COURS', 'En cours'],
    ['BROUILLON', 'À compléter']
  ])('renvoie le libelle attendu pour %s', (status, expected) => {
    expect(getAffiliationStatusLabel(makeRequest({ status }))).toBe(expected);
  });
});

describe('getAffiliationStatusTone', () => {
  it.each([
    ['ACTIF', 'tone-active'],
    ['ABANDONNE', 'tone-danger'],
    ['CONTRAT_A_SIGNER', 'tone-info'],
    ['EN_COURS', 'tone-progress'],
    ['BROUILLON', 'tone-pending']
  ])('renvoie le ton attendu pour %s', (status, expected) => {
    expect(getAffiliationStatusTone(makeRequest({ status }))).toBe(expected);
  });
});

describe('getAffiliationProductLabel', () => {
  it('utilise les champs TPE pour un type TPE', () => {
    const request = makeRequest({
      typeAffiliation: 'TPE',
      modeMiseADispositionTpe: 'Location',
      equipementTpe: 'Autre',
      connectiviteTpe: 'GPRS'
    });
    expect(getAffiliationProductLabel(request)).toBe('Location');
  });

  it('utilise les champs e-commerce pour un type E_COMMERCE', () => {
    const request = makeRequest({
      typeAffiliation: 'E_COMMERCE',
      modeServiceEcommerce: '',
      siteMarchandUrl: 'https://boutique.ma'
    });
    expect(getAffiliationProductLabel(request)).toBe('https://boutique.ma');
  });

  it('retombe sur modeleQrSoftpos/activite pour les autres types', () => {
    const request = makeRequest({ typeAffiliation: 'QR_SOFTPOS', modeleQrSoftpos: '', activite: 'Restauration' });
    expect(getAffiliationProductLabel(request)).toBe('Restauration');
  });
});

describe('firstMeaningful', () => {
  it('renvoie la premiere valeur non vide apres nettoyage', () => {
    expect(firstMeaningful(null, undefined, '  ', 'valeur', 'autre')).toBe('valeur');
  });

  it("renvoie '-' si toutes les valeurs sont vides ou absentes", () => {
    expect(firstMeaningful(null, undefined, '', '   ')).toBe('-');
  });

  it('convertit les nombres en chaine', () => {
    expect(firstMeaningful(0, 42)).toBe('0');
  });
});

describe('createAffiliationActivationPayload', () => {
  it('cree un payload par defaut avec toutes les chaines vides et booleens a false', () => {
    const payload = createAffiliationActivationPayload();
    expect(payload.commissionLocaleTpe).toBe('');
    expect(payload.serviceCreditVoucher).toBe(false);
    expect(payload.serviceDcc).toBe(false);
  });
});

describe('createAffiliationActivationPayloadFromRequest', () => {
  it('reprend les valeurs de la demande quand elles existent', () => {
    const request = makeRequest({
      commissionLocaleTpe: '1.5',
      serviceCreditVoucher: true,
      compteRenduContactNomPrenom: '',
      nomCommercant: 'ACME SARL',
      compteRenduActivite: '',
      activite: 'Commerce',
      compteRenduFaitA: '',
      ville: 'Casablanca'
    });

    const payload = createAffiliationActivationPayloadFromRequest(request);

    expect(payload.commissionLocaleTpe).toBe('1.5');
    expect(payload.serviceCreditVoucher).toBe(true);
    expect(payload.compteRenduContactNomPrenom).toBe('ACME SARL');
    expect(payload.compteRenduCommercant).toBe('ACME SARL');
    expect(payload.compteRenduActivite).toBe('Commerce');
    expect(payload.compteRenduFaitA).toBe('Casablanca');
  });
});

describe('extractApiErrorMessage', () => {
  it('utilise la donnee string de la reponse si presente', () => {
    expect(extractApiErrorMessage({ response: { data: 'Erreur serveur' } }, 'fallback')).toBe('Erreur serveur');
  });

  it('utilise le champ message de la donnee objet si presente', () => {
    expect(extractApiErrorMessage({ response: { data: { message: 'Non autorise' } } }, 'fallback')).toBe(
      'Non autorise'
    );
  });

  it("retombe sur error.message si aucune donnee de reponse n'est exploitable", () => {
    expect(extractApiErrorMessage({ message: 'Network Error' }, 'fallback')).toBe('Network Error');
  });

  it('retombe sur le message par defaut en dernier recours', () => {
    expect(extractApiErrorMessage({}, 'Une erreur est survenue')).toBe('Une erreur est survenue');
    expect(extractApiErrorMessage(null, 'fallback')).toBe('fallback');
  });
});

describe('isMeaningfulValue', () => {
  it('est vrai pour une valeur non vide et differente de "-"', () => {
    expect(isMeaningfulValue('Casablanca')).toBe(true);
  });

  it('est faux pour une chaine vide ou "-"', () => {
    expect(isMeaningfulValue('')).toBe(false);
    expect(isMeaningfulValue('   ')).toBe(false);
    expect(isMeaningfulValue('-')).toBe(false);
  });
});
