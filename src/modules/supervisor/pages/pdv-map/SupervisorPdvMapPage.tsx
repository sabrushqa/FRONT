import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvent } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { getPdvMap, regeocoderPdvs, PdvMapItem } from '../../services/supervisorApi';
import {
  MOROCCO_REGIONS,
  UNKNOWN_REGION_KEY,
  resolveRegionKey,
  resolveCityCoordinate,
  resolveCityDisplayName,
  normalizeForMatch
} from '../../../../core/moroccoGeoData';
import '../../../../styles/page.shared.scss';
import '../../../../styles/supervisor-geo-map.scss';
import '../../../../styles/supervisor-pdv-map.scss';

const MOROCCO_CENTER: [number, number] = [31.6, -7.2];
const MOROCCO_DEFAULT_ZOOM = 6;
const MOROCCO_MIN_ZOOM = 5;
// Large margin around Morocco's actual extent so panning to the edges (Sahara,
// Rif) never feels clipped, while still keeping the rest of the world out of view.
const MOROCCO_BOUNDS: L.LatLngBoundsExpression = [
  [19, -19],
  [37, 1]
];
const CITY_ZOOM = 13;
const PIN_ZOOM_THRESHOLD = 11;

const storeIconCache = new Map<string, L.DivIcon>();

function resolveStoreIcon(color: string): L.DivIcon {
  const cached = storeIconCache.get(color);
  if (cached) return cached;
  const icon = L.divIcon({
    className: 'pdv-map-store-icon',
    html: `<span class="pdv-map-store-icon-badge" style="background:${color}"><span class="material-icons">storefront</span></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
    popupAnchor: [0, -26]
  });
  storeIconCache.set(color, icon);
  return icon;
}

const TYPE_AFFILIATION_OPTIONS = [
  { value: 'TPE', label: 'TPE' },
  { value: 'E_COMMERCE', label: 'E-commerce' },
  { value: 'SOFTPOS', label: 'SoftPOS' },
  { value: 'QR_CODE', label: 'QR Code' }
];

const TYPE_COMMERCANT_OPTIONS = [
  { value: 'PERSONNE_PHYSIQUE', label: 'Personne physique' },
  { value: 'PERSONNE_MORALE', label: 'Personne morale' },
  { value: 'AUTO_ENTREPRENEUR', label: 'Auto-entrepreneur' },
  { value: 'ASSOCIATION_FONDATION', label: 'Association / Fondation' }
];

const TYPE_AFFILIATION_COLORS: Record<string, string> = {
  TPE: '#2E86DE',
  E_COMMERCE: '#27AE60',
  SOFTPOS: '#F39C12',
  QR_CODE: '#8E44AD'
};
const UNKNOWN_TYPE_COLOR = '#7F8C8D';

const REGION_COLORS: Record<string, string> = {
  'tanger-tetouan-al-hoceima': '#2E86DE',
  oriental: '#F39C12',
  'fes-meknes': '#8E44AD',
  'rabat-sale-kenitra': '#16A085',
  'beni-mellal-khenifra': '#D35400',
  'casablanca-settat': '#C0392B',
  'marrakech-safi': '#27AE60',
  'draa-tafilalet': '#7F8C8D',
  'souss-massa': '#2980B9',
  'guelmim-oued-noun': '#E67E22',
  'laayoune-sakia-el-hamra': '#9B59B6',
  'dakhla-oued-ed-dahab': '#34495E',
  [UNKNOWN_REGION_KEY]: '#B0BEC5'
};

function formatEnumLabel(value: string, options: Array<{ value: string; label: string }>): string {
  return options.find((option) => option.value === value)?.label ?? (value || 'Non renseigné');
}

// The drawer/layout can still be settling when Leaflet first measures its
// container, which leaves the map stuck at a stale (often world-view) zoom.
function MapAutoFit() {
  const map = useMap();
  useEffect(() => {
    const resetView = () => {
      map.invalidateSize();
      map.setView(MOROCCO_CENTER, MOROCCO_DEFAULT_ZOOM);
    };
    const timeoutId = window.setTimeout(resetView, 0);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => {
      window.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [map]);
  return null;
}

function ZoomWatcher({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMapEvent('zoomend', () => onZoomChange(map.getZoom()));
  useEffect(() => {
    onZoomChange(map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

interface FlyTarget {
  center: [number, number];
  zoom: number;
}

function FlyToTarget({ target }: { target: FlyTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target.center, target.zoom);
  }, [target, map]);
  return null;
}

interface CityAggregate {
  key: string;
  name: string;
  count: number;
  lat: number | null;
  lon: number | null;
  regionKey: string;
}

export default function SupervisorPdvMapPage() {
  const [pdvs, setPdvs] = useState<PdvMapItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [villeFilter, setVilleFilter] = useState('all');
  const [typeAffiliationFilter, setTypeAffiliationFilter] = useState<string[]>([]);
  const [typeCommercantFilter, setTypeCommercantFilter] = useState<string[]>([]);
  const [zoom, setZoom] = useState(MOROCCO_DEFAULT_ZOOM);
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);
  const [copiedPdvId, setCopiedPdvId] = useState<number | null>(null);
  const [isRegeocoding, setIsRegeocoding] = useState(false);
  const [regeocodeMessage, setRegeocodeMessage] = useState('');

  function loadPdvMap() {
    setIsLoading(true);
    return getPdvMap()
      .then((response) => {
        setPdvs(Array.isArray(response.pdvs) ? response.pdvs : []);
        setErrorMessage('');
      })
      .catch(() => {
        setErrorMessage('Impossible de charger les points de vente.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  useEffect(() => {
    loadPdvMap();
  }, []);

  async function handleRegeocoder() {
    setIsRegeocoding(true);
    setRegeocodeMessage('');
    try {
      const response = await regeocoderPdvs();
      setRegeocodeMessage(response.message);
      await loadPdvMap();
    } catch {
      setRegeocodeMessage('Le ré-géocodage a échoué.');
    } finally {
      setIsRegeocoding(false);
    }
  }

  const villeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const point of pdvs) {
      const key = normalizeForMatch(point.ville);
      if (key && !seen.has(key)) {
        seen.set(key, resolveCityDisplayName(point.ville));
      }
    }
    return Array.from(seen.entries())
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [pdvs]);

  function toggleTypeAffiliation(value: string) {
    setTypeAffiliationFilter((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  function toggleTypeCommercant(value: string) {
    setTypeCommercantFilter((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  function clearFilters() {
    setVilleFilter('all');
    setTypeAffiliationFilter([]);
    setTypeCommercantFilter([]);
  }

  const filteredPdvs = useMemo(() => {
    return pdvs.filter((point) => {
      if (villeFilter !== 'all' && normalizeForMatch(point.ville) !== villeFilter) return false;
      if (typeAffiliationFilter.length && !typeAffiliationFilter.includes(point.typeAffiliation)) return false;
      if (typeCommercantFilter.length && !typeCommercantFilter.includes(point.typeCommercant)) return false;
      return true;
    });
  }, [pdvs, villeFilter, typeAffiliationFilter, typeCommercantFilter]);

  const cityAggregates = useMemo(() => {
    const map = new Map<string, CityAggregate>();
    for (const point of filteredPdvs) {
      const cityKey = normalizeForMatch(point.ville) || '__unknown__';
      const regionKey = resolveRegionKey(point.region, point.ville);
      const existing = map.get(cityKey);
      if (existing) {
        existing.count += 1;
      } else {
        const coordinate = resolveCityCoordinate(point.ville);
        map.set(cityKey, {
          key: cityKey,
          name: resolveCityDisplayName(point.ville),
          count: 1,
          lat: coordinate?.lat ?? null,
          lon: coordinate?.lon ?? null,
          regionKey
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [filteredPdvs]);

  const mappedCities = useMemo(
    () => cityAggregates.filter((city) => city.lat !== null && city.lon !== null),
    [cityAggregates]
  );
  const maxCityCount = Math.max(...mappedCities.map((c) => c.count), 1);

  const pinnedPdvs = useMemo(() => {
    return filteredPdvs
      .filter((point) => point.latitude !== null && point.longitude !== null)
      .map((point) => ({
        point,
        position: { lat: point.latitude as number, lon: point.longitude as number }
      }));
  }, [filteredPdvs]);

  const showPins = zoom >= PIN_ZOOM_THRESHOLD;
  const totalPdvs = filteredPdvs.length;
  const villesCouvertes = cityAggregates.filter((c) => c.key !== '__unknown__').length;
  const activeFilterCount =
    (villeFilter !== 'all' ? 1 : 0) + typeAffiliationFilter.length + typeCommercantFilter.length;

  function bubbleRadius(count: number): number {
    const minR = 6;
    const maxR = 26;
    return minR + (maxR - minR) * Math.sqrt(count / maxCityCount);
  }

  function handleCityClick(city: CityAggregate) {
    if (city.lat === null || city.lon === null) return;
    setFlyTarget({ center: [city.lat, city.lon], zoom: CITY_ZOOM });
  }

  function handleResetView() {
    setFlyTarget({ center: MOROCCO_CENTER, zoom: MOROCCO_DEFAULT_ZOOM });
  }

  async function handleCopyAddress(point: PdvMapItem) {
    const text = `${point.nomPdv} — ${point.adresse}, ${point.ville}`.trim();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPdvId(point.idPdv);
      window.setTimeout(() => setCopiedPdvId((current) => (current === point.idPdv ? null : current)), 2000);
    } catch {
      // Clipboard access can be blocked by the browser; silently ignore.
    }
  }

  if (isLoading) {
    return (
      <div className="geo-map-page pdv-map-page">
        <div className="page-loading">
          <span className="page-loading-spinner" />
          <span>Chargement des points de vente...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="geo-map-page pdv-map-page">
      {errorMessage && <div className="page-alert error">{errorMessage}</div>}

      <section className="pdv-map-layout">
      <div className="pdv-map-side">
      <section className="geo-kpi-grid">
        <article className="geo-kpi-card">
          <span>Points de vente</span>
          <strong>{totalPdvs}</strong>
          <small>Selon les filtres actifs</small>
        </article>
        <article className="geo-kpi-card">
          <span>Villes couvertes</span>
          <strong>{villesCouvertes}</strong>
          <small>Villes distinctes identifiées</small>
        </article>
        <article className="geo-kpi-card">
          <span>Niveau de zoom</span>
          <strong>{showPins ? 'Points de vente' : "Vue d'ensemble"}</strong>
          <small>{showPins ? 'Zoomé sur une zone' : 'Zoomez pour voir les pins'}</small>
        </article>
      </section>

      <div className="pdv-map-filters">
        <div className="pdv-map-filters-head">
          <div className="pdv-map-filters-title">
            <span className="material-icons">filter_alt</span>
            <span>Filtres</span>
            {activeFilterCount > 0 && <span className="pdv-map-filters-count">{activeFilterCount}</span>}
          </div>
          {activeFilterCount > 0 && (
            <button type="button" className="pdv-map-filters-reset" onClick={clearFilters}>
              <span className="material-icons">close</span>
              Réinitialiser
            </button>
          )}
        </div>

        <div className="pdv-map-filters-body">
          <label className="pdv-map-filter-field">
            <span>Ville</span>
            <select value={villeFilter} onChange={(event) => setVilleFilter(event.target.value)}>
              <option value="all">Toutes les villes</option>
              {villeOptions.map((ville) => (
                <option key={ville.key} value={ville.key}>
                  {ville.name}
                </option>
              ))}
            </select>
          </label>

          <div className="pdv-map-filter-field">
            <span>Type d'affiliation</span>
            <div className="pdv-map-pill-group">
              {TYPE_AFFILIATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`pdv-map-pill${typeAffiliationFilter.includes(option.value) ? ' is-active' : ''}`}
                  onClick={() => toggleTypeAffiliation(option.value)}
                >
                  <span className="material-icons">check</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pdv-map-filter-field">
            <span>Type de commerçant</span>
            <div className="pdv-map-pill-group">
              {TYPE_COMMERCANT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`pdv-map-pill${typeCommercantFilter.includes(option.value) ? ' is-active' : ''}`}
                  onClick={() => toggleTypeCommercant(option.value)}
                >
                  <span className="material-icons">check</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pdv-map-filters-foot">
          <span className="material-icons">refresh</span>
          <span>Points de vente jamais positionnés</span>
          <button type="button" onClick={handleRegeocoder} disabled={isRegeocoding}>
            {isRegeocoding ? 'Géocodage en cours…' : 'Ré-géocoder'}
          </button>
        </div>
      </div>

      {regeocodeMessage && <p className="pdv-map-regeocode-feedback">{regeocodeMessage}</p>}
      </div>

      <div className="pdv-map-map-col">
        <div className="geo-map-card">
          <div className="geo-map-head">
            <div>
              <span className="card-kicker">Carte des points de vente</span>
              <h3>{showPins ? 'Points de vente de la zone' : 'Répartition par ville'}</h3>
              <p>
                {showPins
                  ? 'Cliquez un point pour voir ses informations.'
                  : "Cliquez une ville pour zoomer, ou dézoomez pour revenir à l'ensemble."}
              </p>
            </div>
            <button type="button" className="btn-secondary" onClick={handleResetView}>
              Vue d'ensemble
            </button>
          </div>

          <MapContainer
            className="geo-map-leaflet"
            center={MOROCCO_CENTER}
            zoom={MOROCCO_DEFAULT_ZOOM}
            minZoom={MOROCCO_MIN_ZOOM}
            maxBounds={MOROCCO_BOUNDS}
            maxBoundsViscosity={1.0}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapAutoFit />
            <ZoomWatcher onZoomChange={setZoom} />
            <FlyToTarget target={flyTarget} />

            {!showPins &&
              mappedCities.map((city) => {
                const radius = bubbleRadius(city.count);
                const color = REGION_COLORS[city.regionKey] ?? REGION_COLORS[UNKNOWN_REGION_KEY];
                return (
                  <CircleMarker
                    key={city.key}
                    center={[city.lat as number, city.lon as number]}
                    radius={radius}
                    pathOptions={{ fillColor: color, fillOpacity: 0.82, color: '#ffffff', weight: 1.5 }}
                    eventHandlers={{ click: () => handleCityClick(city) }}
                  >
                    <Tooltip direction="top" offset={[0, -radius]} sticky>
                      {city.name} · {city.count} PDV
                    </Tooltip>
                  </CircleMarker>
                );
              })}

            {showPins && (
              <MarkerClusterGroup
                chunkedLoading
                maxClusterRadius={50}
                spiderfyOnMaxZoom
                showCoverageOnHover={false}
              >
                {pinnedPdvs.map(({ point, position }) => {
                  const color = TYPE_AFFILIATION_COLORS[point.typeAffiliation] ?? UNKNOWN_TYPE_COLOR;
                  return (
                    <Marker
                      key={point.idPdv}
                      position={[position.lat, position.lon]}
                      icon={resolveStoreIcon(color)}
                    >
                      <Popup>
                        <div className="pdv-map-popup">
                          <strong>{point.nomPdv || 'Point de vente'}</strong>
                          <span>
                            {point.adresse || 'Adresse non renseignée'}
                            {point.quartier ? `, ${point.quartier}` : ''}, {point.ville}
                            {point.codePostal ? ` ${point.codePostal}` : ''}
                          </span>
                          <span>Commerçant : {point.nomCommercant || 'Non renseigné'}</span>
                          <span>Type d'affiliation : {formatEnumLabel(point.typeAffiliation, TYPE_AFFILIATION_OPTIONS)}</span>
                          <span>Type de commerçant : {formatEnumLabel(point.typeCommercant, TYPE_COMMERCANT_OPTIONS)}</span>
                          <span>Statut : {point.statut || 'Non renseigné'}</span>
                          <div className="pdv-map-popup-actions">
                            <button type="button" className="btn-secondary" onClick={() => handleCopyAddress(point)}>
                              {copiedPdvId === point.idPdv ? 'Adresse copiée' : "Copier l'adresse"}
                            </button>
                            <a
                              className="btn-secondary"
                              href={`https://www.openstreetmap.org/?mlat=${position.lat}&mlon=${position.lon}#map=17/${position.lat}/${position.lon}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Ouvrir dans OpenStreetMap
                            </a>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MarkerClusterGroup>
            )}
          </MapContainer>

          <div className="geo-map-legend">
            {showPins
              ? TYPE_AFFILIATION_OPTIONS.map((option) => (
                  <span className="geo-legend-item" key={option.value}>
                    <span
                      className="geo-legend-dot"
                      style={{ background: TYPE_AFFILIATION_COLORS[option.value] ?? UNKNOWN_TYPE_COLOR }}
                    />
                    {option.label}
                  </span>
                ))
              : MOROCCO_REGIONS.map((region) => (
                  <span className="geo-legend-item" key={region.key}>
                    <span className="geo-legend-dot" style={{ background: REGION_COLORS[region.key] }} />
                    {region.label}
                  </span>
                ))}
          </div>
        </div>
      </div>
      </section>
    </div>
  );
}
