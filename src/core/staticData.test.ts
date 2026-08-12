import { describe, it, expect } from 'vitest';
import { MCC_OPTIONS } from './mccOptions';
import { CITY_COORDINATES } from './moroccoGeoData';
import { QUARTIERS_PAR_VILLE } from './quartiersMaroc';
import { AGENCY_MANDATAIRE_OPTIONS } from './agencyMandataireOptions';
import {
  COMMERCIAL_REPORT_QUALIFICATION_OPTIONS,
  COMMERCIAL_REPORT_ORIGIN_OPTIONS,
  COMMERCIAL_REPORT_SURFACE_OPTIONS,
  COMMERCIAL_REPORT_LOCAL_STATUS_OPTIONS,
  COMMERCIAL_REPORT_CA_OPTIONS,
  COMMERCIAL_REPORT_PROFILE_OPTIONS,
  COMMERCIAL_REPORT_APPRECIATION_OPTIONS
} from './commercialReportOptions';

function expectUniqueNonEmptyOptions(options: Array<{ value: string; label: string }>) {
  expect(options.length).toBeGreaterThan(0);
  for (const option of options) {
    expect(option.value).not.toBe('');
    expect(option.label).not.toBe('');
  }
  const values = options.map((o) => o.value);
  expect(new Set(values).size).toBe(values.length);
}

describe('MCC_OPTIONS', () => {
  it('contient des options uniques et non vides', () => {
    expectUniqueNonEmptyOptions(MCC_OPTIONS);
  });
});

describe('CITY_COORDINATES', () => {
  it('a des coordonnees valides pour chaque ville', () => {
    const cities = Object.values(CITY_COORDINATES);
    expect(cities.length).toBeGreaterThan(0);
    for (const city of cities) {
      expect(city.lat).toBeGreaterThan(20);
      expect(city.lat).toBeLessThan(37);
      expect(city.lon).toBeGreaterThan(-18);
      expect(city.lon).toBeLessThan(0);
      expect(city.name).not.toBe('');
    }
  });
});

describe('QUARTIERS_PAR_VILLE', () => {
  it('associe chaque ville a une liste non vide de quartiers avec code postal', () => {
    const villes = Object.keys(QUARTIERS_PAR_VILLE);
    expect(villes.length).toBeGreaterThan(0);
    for (const ville of villes) {
      const quartiers = QUARTIERS_PAR_VILLE[ville];
      expect(quartiers.length).toBeGreaterThan(0);
      for (const q of quartiers) {
        expect(q.quartier).not.toBe('');
        expect(q.codePostal).toMatch(/^\d{5}$/);
      }
    }
  });
});

describe('AGENCY_MANDATAIRE_OPTIONS', () => {
  it('contient des options uniques et non vides', () => {
    expectUniqueNonEmptyOptions(AGENCY_MANDATAIRE_OPTIONS);
  });
});

describe('commercialReportOptions', () => {
  it.each([
    ['QUALIFICATION', COMMERCIAL_REPORT_QUALIFICATION_OPTIONS],
    ['ORIGIN', COMMERCIAL_REPORT_ORIGIN_OPTIONS],
    ['SURFACE', COMMERCIAL_REPORT_SURFACE_OPTIONS],
    ['LOCAL_STATUS', COMMERCIAL_REPORT_LOCAL_STATUS_OPTIONS],
    ['CA', COMMERCIAL_REPORT_CA_OPTIONS],
    ['PROFILE', COMMERCIAL_REPORT_PROFILE_OPTIONS],
    ['APPRECIATION', COMMERCIAL_REPORT_APPRECIATION_OPTIONS]
  ])('%s expose des options uniques et non vides', (_name, options) => {
    expectUniqueNonEmptyOptions(options);
  });
});
