import { describe, it, expect } from 'vitest';
import {
  normalizeForMatch,
  resolveRegionKey,
  resolveRegionLabel,
  resolveCityCoordinate,
  resolveCityDisplayName,
  jitterAroundCity,
  UNKNOWN_REGION_KEY,
  UNKNOWN_REGION_LABEL
} from './moroccoGeoData';

describe('normalizeForMatch', () => {
  it('supprime les accents, espaces superflus et met en minuscule', () => {
    expect(normalizeForMatch('  Al Hoceïma  ')).toBe('al hoceima');
  });

  it('renvoie une chaine vide pour null/undefined', () => {
    expect(normalizeForMatch(null)).toBe('');
    expect(normalizeForMatch(undefined)).toBe('');
  });
});

describe('resolveRegionKey', () => {
  it('trouve la region a partir du champ region', () => {
    expect(resolveRegionKey('Casablanca-Settat')).toBe('casablanca-settat');
  });

  it('retombe sur la ville si la region est vide ou non reconnue', () => {
    expect(resolveRegionKey('', 'Marrakech')).toBe('marrakech-safi');
    expect(resolveRegionKey('texte inconnu', 'Agadir')).toBe('souss-massa');
  });

  it('renvoie la cle inconnue si ni la region ni la ville ne correspondent', () => {
    expect(resolveRegionKey('Paris', 'Lyon')).toBe(UNKNOWN_REGION_KEY);
  });
});

describe('resolveRegionLabel', () => {
  it('renvoie le libelle correspondant a la cle', () => {
    expect(resolveRegionLabel('marrakech-safi')).toBe('Marrakech-Safi');
  });

  it('renvoie le libelle par defaut pour une cle inconnue', () => {
    expect(resolveRegionLabel('cle-inexistante')).toBe(UNKNOWN_REGION_LABEL);
  });
});

describe('resolveCityCoordinate', () => {
  it('trouve les coordonnees pour une ville connue (insensible a la casse/accents)', () => {
    const coord = resolveCityCoordinate('CASABLANCA');
    expect(coord?.name).toBe('Casablanca');
  });

  it('renvoie null pour une ville vide ou inconnue', () => {
    expect(resolveCityCoordinate('')).toBeNull();
    expect(resolveCityCoordinate('Ville Imaginaire')).toBeNull();
  });
});

describe('resolveCityDisplayName', () => {
  it('renvoie le nom officiel pour une ville connue', () => {
    expect(resolveCityDisplayName('marrakech')).toBe('Marrakech');
  });

  it('met en majuscule chaque mot pour une ville inconnue', () => {
    expect(resolveCityDisplayName('nouvelle ville')).toBe('Nouvelle Ville');
  });

  it("renvoie un libelle par defaut si la ville n'est pas renseignee", () => {
    expect(resolveCityDisplayName('')).toBe('Ville non renseignée');
    expect(resolveCityDisplayName(null)).toBe('Ville non renseignée');
  });
});

describe('jitterAroundCity', () => {
  it('renvoie toujours le meme decalage pour un meme identifiant (deterministe)', () => {
    const coordinate = { name: 'Casablanca', lat: 33.5731, lon: -7.5898 };
    const first = jitterAroundCity(coordinate, 42);
    const second = jitterAroundCity(coordinate, 42);
    expect(first).toEqual(second);
  });

  it('produit des positions differentes pour des identifiants differents', () => {
    const coordinate = { name: 'Casablanca', lat: 33.5731, lon: -7.5898 };
    const a = jitterAroundCity(coordinate, 1);
    const b = jitterAroundCity(coordinate, 2);
    expect(a).not.toEqual(b);
  });

  it('reste proche des coordonnees de la ville (moins de 1 degre)', () => {
    const coordinate = { name: 'Casablanca', lat: 33.5731, lon: -7.5898 };
    const result = jitterAroundCity(coordinate, 7);
    expect(Math.abs(result.lat - coordinate.lat)).toBeLessThan(1);
    expect(Math.abs(result.lon - coordinate.lon)).toBeLessThan(1);
  });
});
