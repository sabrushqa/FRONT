import React, { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { getOverview, CommercantDirectoryItem } from '../../services/supervisorApi';
import {
  MOROCCO_REGIONS,
  UNKNOWN_REGION_KEY,
  resolveRegionKey,
  resolveRegionLabel,
  resolveCityCoordinate,
  resolveCityDisplayName,
  normalizeForMatch
} from '../../../../core/moroccoGeoData';
import '../../../../styles/page.shared.scss';
import '../../../../styles/supervisor-geo-map.scss';

const MOROCCO_CENTER: [number, number] = [31.6, -7.2];
const MOROCCO_DEFAULT_ZOOM = 6;

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

// The drawer/layout can still be settling when Leaflet first measures its
// container, which leaves the map stuck at a stale (often world-view) zoom.
// Re-measuring after mount, and on every resize, keeps it framed on Morocco.
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

interface CityAggregate {
  key: string;
  name: string;
  count: number;
  lat: number | null;
  lon: number | null;
  regionKey: string;
}

export default function SupervisorGeoMapPage() {
  const [commercants, setCommercants] = useState<CommercantDirectoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getOverview()
      .then((response) => {
        if (!mounted) return;
        setCommercants(Array.isArray(response.commercants) ? response.commercants : []);
        setErrorMessage('');
      })
      .catch(() => {
        if (mounted) setErrorMessage('Impossible de charger la répartition géographique.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const cityAggregates = useMemo(() => {
    const map = new Map<string, CityAggregate>();
    for (const commercant of commercants) {
      const cityKey = normalizeForMatch(commercant.ville) || '__unknown__';
      const regionKey = resolveRegionKey(commercant.region, commercant.ville);
      const existing = map.get(cityKey);
      if (existing) {
        existing.count += 1;
      } else {
        const coordinate = resolveCityCoordinate(commercant.ville);
        map.set(cityKey, {
          key: cityKey,
          name: resolveCityDisplayName(commercant.ville),
          count: 1,
          lat: coordinate?.lat ?? null,
          lon: coordinate?.lon ?? null,
          regionKey
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [commercants]);

  const regionAggregates = useMemo(() => {
    const counts = new Map<string, number>();
    for (const commercant of commercants) {
      const key = resolveRegionKey(commercant.region, commercant.ville);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const allKeys = [...MOROCCO_REGIONS.map((r) => r.key), UNKNOWN_REGION_KEY];
    const maxCount = Math.max(...Array.from(counts.values()), 1);
    return allKeys
      .map((key) => ({
        key,
        label: resolveRegionLabel(key),
        count: counts.get(key) ?? 0,
        percent: Math.round(((counts.get(key) ?? 0) / maxCount) * 100)
      }))
      .filter((region) => region.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [commercants]);

  const mappedCities = useMemo(
    () => cityAggregates.filter((city) => city.lat !== null && city.lon !== null),
    [cityAggregates]
  );
  const maxCityCount = Math.max(...mappedCities.map((c) => c.count), 1);
  const maxOverallCityCount = Math.max(...cityAggregates.map((c) => c.count), 1);

  const totalCommercants = commercants.length;
  const villesCouvertes = cityAggregates.filter((c) => c.key !== '__unknown__').length;
  const regionsCouvertes = regionAggregates.filter((r) => r.key !== UNKNOWN_REGION_KEY).length;
  const topRegion = regionAggregates[0];

  function bubbleRadius(count: number): number {
    const minR = 6;
    const maxR = 26;
    return minR + (maxR - minR) * Math.sqrt(count / maxCityCount);
  }

  if (isLoading) {
    return (
      <div className="geo-map-page">
        <div className="page-loading">
          <span className="page-loading-spinner" />
          <span>Chargement de la répartition géographique...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="geo-map-page">
      {errorMessage && <div className="page-alert error">{errorMessage}</div>}

      <section className="geo-kpi-grid">
        <article className="geo-kpi-card">
          <span>Commerçants</span>
          <strong>{totalCommercants}</strong>
          <small>Total sur le portefeuille</small>
        </article>
        <article className="geo-kpi-card">
          <span>Villes couvertes</span>
          <strong>{villesCouvertes}</strong>
          <small>Villes distinctes identifiées</small>
        </article>
        <article className="geo-kpi-card">
          <span>Régions couvertes</span>
          <strong>{regionsCouvertes} / 12</strong>
          <small>Régions officielles représentées</small>
        </article>
        <article className="geo-kpi-card">
          <span>Région leader</span>
          <strong>{topRegion ? topRegion.count : 0}</strong>
          <small>{topRegion ? topRegion.label : '-'}</small>
        </article>
      </section>

      <section className="geo-main-grid">
        <div className="geo-map-card">
          <div className="geo-map-head">
            <div>
              <span className="card-kicker">Carte du Maroc</span>
              <h3>Répartition des commerçants par ville</h3>
              <p>Taille de bulle proportionnelle au nombre de commerçants.</p>
            </div>
          </div>
          <MapContainer
            className="geo-map-leaflet"
            center={MOROCCO_CENTER}
            zoom={MOROCCO_DEFAULT_ZOOM}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapAutoFit />
            {mappedCities.map((city) => {
              const radius = bubbleRadius(city.count);
              const color = REGION_COLORS[city.regionKey] ?? REGION_COLORS[UNKNOWN_REGION_KEY];
              return (
                <CircleMarker
                  key={city.key}
                  center={[city.lat as number, city.lon as number]}
                  radius={radius}
                  pathOptions={{
                    fillColor: color,
                    fillOpacity: 0.82,
                    color: '#ffffff',
                    weight: 1.5
                  }}
                >
                  <Tooltip direction="top" offset={[0, -radius]} sticky>
                    {city.name} · {city.count}
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
          <div className="geo-map-legend">
            {MOROCCO_REGIONS.map((region) => (
              <span className="geo-legend-item" key={region.key}>
                <span className="geo-legend-dot" style={{ background: REGION_COLORS[region.key] }} />
                {region.label}
              </span>
            ))}
          </div>
        </div>

        <div className="geo-side-panel">
          <div className="geo-panel-card">
            <div className="geo-panel-head">
              <h3>Par région</h3>
              <span>{regionAggregates.length} région(s)</span>
            </div>
            <div className="geo-panel-list">
              {regionAggregates.map((region) => (
                <div className="geo-panel-row" key={region.key}>
                  <span
                    className="geo-region-dot"
                    style={{ background: REGION_COLORS[region.key] ?? REGION_COLORS[UNKNOWN_REGION_KEY] }}
                  />
                  <span className="geo-panel-label">{region.label}</span>
                  <div className="geo-panel-bar-wrap">
                    <div className="geo-panel-bar" style={{ width: `${region.percent}%` }} />
                  </div>
                  <strong>{region.count}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="geo-panel-card">
            <div className="geo-panel-head">
              <h3>Par ville</h3>
              <span>{cityAggregates.length} ville(s)</span>
            </div>
            <div className="geo-panel-list geo-panel-list--scroll">
              {cityAggregates.map((city) => (
                <div className="geo-panel-row" key={city.key}>
                  <span
                    className="geo-region-dot"
                    style={{ background: REGION_COLORS[city.regionKey] ?? REGION_COLORS[UNKNOWN_REGION_KEY] }}
                  />
                  <span className="geo-panel-label">{city.name}</span>
                  <div className="geo-panel-bar-wrap">
                    <div
                      className="geo-panel-bar"
                      style={{ width: `${Math.max(4, Math.round((city.count / maxOverallCityCount) * 100))}%` }}
                    />
                  </div>
                  <strong>{city.count}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
