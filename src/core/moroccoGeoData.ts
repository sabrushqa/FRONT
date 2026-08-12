// Geographic reference data for the Morocco merchant-distribution map.
// City coordinates are approximate (city-center lat/lon) and are used to place
// real markers on an actual tiled map (see SupervisorGeoMapPage.tsx).

export interface CityCoordinate {
  name: string;
  lat: number;
  lon: number;
}

// Known city coordinates, keyed by normalized (accent-stripped, lowercased) name.
export const CITY_COORDINATES: Record<string, CityCoordinate> = {
  tanger: { name: 'Tanger', lat: 35.7595, lon: -5.834 },
  tetouan: { name: 'Tétouan', lat: 35.5785, lon: -5.3684 },
  'al hoceima': { name: 'Al Hoceïma', lat: 35.2517, lon: -3.9317 },
  nador: { name: 'Nador', lat: 35.174, lon: -2.9287 },
  oujda: { name: 'Oujda', lat: 34.6805, lon: -1.9086 },
  taza: { name: 'Taza', lat: 34.2133, lon: -4.0103 },
  fes: { name: 'Fès', lat: 34.0331, lon: -5.0003 },
  meknes: { name: 'Meknès', lat: 33.8935, lon: -5.5473 },
  azrou: { name: 'Azrou', lat: 33.4342, lon: -5.2236 },
  ifrane: { name: 'Ifrane', lat: 33.5228, lon: -5.1106 },
  kenitra: { name: 'Kénitra', lat: 34.261, lon: -6.5802 },
  rabat: { name: 'Rabat', lat: 34.0209, lon: -6.8416 },
  sale: { name: 'Salé', lat: 34.0531, lon: -6.7985 },
  khemisset: { name: 'Khémisset', lat: 33.8244, lon: -6.0661 },
  casablanca: { name: 'Casablanca', lat: 33.5731, lon: -7.5898 },
  mohammedia: { name: 'Mohammédia', lat: 33.6861, lon: -7.3828 },
  'el jadida': { name: 'El Jadida', lat: 33.2549, lon: -8.5058 },
  settat: { name: 'Settat', lat: 33.0014, lon: -7.6162 },
  khouribga: { name: 'Khouribga', lat: 32.8811, lon: -6.9063 },
  'beni mellal': { name: 'Béni Mellal', lat: 32.3373, lon: -6.3498 },
  khenifra: { name: 'Khénifra', lat: 32.9394, lon: -5.6693 },
  marrakech: { name: 'Marrakech', lat: 31.6295, lon: -7.9811 },
  safi: { name: 'Safi', lat: 32.2994, lon: -9.2372 },
  essaouira: { name: 'Essaouira', lat: 31.5085, lon: -9.7595 },
  agadir: { name: 'Agadir', lat: 30.4278, lon: -9.5981 },
  taroudant: { name: 'Taroudant', lat: 30.4703, lon: -8.877 },
  tiznit: { name: 'Tiznit', lat: 29.6974, lon: -9.7316 },
  ouarzazate: { name: 'Ouarzazate', lat: 30.9335, lon: -6.937 },
  errachidia: { name: 'Errachidia', lat: 31.9314, lon: -4.4241 },
  guelmim: { name: 'Guelmim', lat: 28.9863, lon: -10.0574 },
  'tan-tan': { name: 'Tan-Tan', lat: 28.4341, lon: -11.1031 },
  tantan: { name: 'Tan-Tan', lat: 28.4341, lon: -11.1031 },
  laayoune: { name: 'Laâyoune', lat: 27.1418, lon: -13.1953 },
  dakhla: { name: 'Dakhla', lat: 23.6848, lon: -15.937 }
};

export interface RegionDefinition {
  key: string;
  label: string;
  matchers: string[];
}

// The 12 official Moroccan regions, with substring matchers used to normalize the
// free-text `region` values actually stored in the database (missing accents,
// city names entered instead of the region, casing inconsistencies, etc.).
export const MOROCCO_REGIONS: RegionDefinition[] = [
  { key: 'tanger-tetouan-al-hoceima', label: 'Tanger-Tétouan-Al Hoceïma', matchers: ['tanger', 'tetouan', 'hoceima'] },
  { key: 'oriental', label: 'Oriental', matchers: ['oriental', 'oujda', 'nador'] },
  { key: 'fes-meknes', label: 'Fès-Meknès', matchers: ['fes', 'meknes', 'ifrane'] },
  { key: 'rabat-sale-kenitra', label: 'Rabat-Salé-Kénitra', matchers: ['rabat', 'sale', 'kenitra', 'khemisset'] },
  { key: 'beni-mellal-khenifra', label: 'Béni Mellal-Khénifra', matchers: ['beni mellal', 'khenifra'] },
  { key: 'casablanca-settat', label: 'Casablanca-Settat', matchers: ['casablanca', 'settat', 'mohammedia', 'el jadida'] },
  { key: 'marrakech-safi', label: 'Marrakech-Safi', matchers: ['marrakech', 'safi', 'essaouira'] },
  { key: 'draa-tafilalet', label: 'Drâa-Tafilalet', matchers: ['draa', 'tafilalet', 'errachidia', 'ouarzazate'] },
  { key: 'souss-massa', label: 'Souss-Massa', matchers: ['souss', 'massa', 'agadir', 'taroudant', 'tiznit'] },
  { key: 'guelmim-oued-noun', label: 'Guelmim-Oued Noun', matchers: ['guelmim', 'oued noun', 'tan-tan', 'tantan'] },
  { key: 'laayoune-sakia-el-hamra', label: 'Laâyoune-Sakia El Hamra', matchers: ['laayoune', 'sakia'] },
  { key: 'dakhla-oued-ed-dahab', label: 'Dakhla-Oued Ed-Dahab', matchers: ['dakhla'] }
];

export const UNKNOWN_REGION_KEY = 'non-renseignee';
export const UNKNOWN_REGION_LABEL = 'Région non renseignée';

export function normalizeForMatch(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export function resolveRegionKey(rawRegion: string | null | undefined, rawVille?: string | null): string {
  const normalizedRegion = normalizeForMatch(rawRegion);
  const normalizedVille = normalizeForMatch(rawVille);
  for (const region of MOROCCO_REGIONS) {
    if (region.matchers.some((matcher) => normalizedRegion.includes(matcher))) {
      return region.key;
    }
  }
  // Fall back to the city name when the region field itself is blank/junk.
  for (const region of MOROCCO_REGIONS) {
    if (region.matchers.some((matcher) => normalizedVille.includes(matcher))) {
      return region.key;
    }
  }
  return UNKNOWN_REGION_KEY;
}

export function resolveRegionLabel(key: string): string {
  return MOROCCO_REGIONS.find((region) => region.key === key)?.label ?? UNKNOWN_REGION_LABEL;
}

export function resolveCityCoordinate(rawVille: string | null | undefined): CityCoordinate | null {
  const key = normalizeForMatch(rawVille);
  if (!key) return null;
  return CITY_COORDINATES[key] ?? null;
}

export function resolveCityDisplayName(rawVille: string | null | undefined): string {
  const coordinate = resolveCityCoordinate(rawVille);
  if (coordinate) return coordinate.name;
  const trimmed = (rawVille ?? '').trim();
  if (!trimmed) return 'Ville non renseignée';
  return trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
}

// No PDV has a real GPS position (only a city name), so individual pins are
// spread around the city-center coordinate. The offset is derived from the
// PDV id rather than Math.random() so a given PDV always lands on the same
// spot across reloads instead of jumping around the map each time.
export function jitterAroundCity(coordinate: CityCoordinate, seedId: number): { lat: number; lon: number } {
  const hashA = Math.sin(seedId * 12.9898) * 43758.5453;
  const angle = (hashA - Math.floor(hashA)) * 2 * Math.PI;
  const hashB = Math.sin(seedId * 78.233) * 12543.1234;
  const radiusDegrees = 0.002 + (hashB - Math.floor(hashB)) * 0.005; // ~220m to ~800m

  const latitudeRadians = (coordinate.lat * Math.PI) / 180;
  return {
    lat: coordinate.lat + Math.cos(angle) * radiusDegrees,
    lon: coordinate.lon + (Math.sin(angle) * radiusDegrees) / Math.max(0.2, Math.cos(latitudeRadians))
  };
}
