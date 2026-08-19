import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getRiskOverview,
  SupervisorRiskOverviewResponse,
  MerchantRiskItem,
  SectorCanalItem,
  SectorTpeUsageItem
} from '../../services/supervisorApi';
import { formatEnumLabel } from '../../services/supervisorUiUtils';
import '../../../../styles/page.shared.scss';
import '../../../../styles/supervisor-risk.scss';

const LEVEL_META: Record<string, { tone: string; label: string }> = {
  ELEVE:  { tone: 'risk-tone-high', label: 'Risque élevé' },
  MOYEN:  { tone: 'risk-tone-medium', label: 'Risque moyen' },
  FAIBLE: { tone: 'risk-tone-low', label: 'Risque faible' }
};

function levelMeta(niveau: string) {
  return LEVEL_META[niveau] ?? { tone: 'risk-tone-low', label: niveau || '—' };
}

// Vert = canal qui fonctionne bien dans ce secteur (peu de refus), rouge =
// canal qui pose problème — lecture directe, pas besoin de deviner à partir
// d'un taux de refus brut.
function qualityTone(tauxRefus: number): string {
  if (tauxRefus >= 20) return 'risk-fill-high';
  if (tauxRefus >= 10) return 'risk-fill-medium';
  return 'risk-fill-good';
}

function qualityLabel(tauxRefus: number): string {
  if (tauxRefus >= 20) return 'Problématique';
  if (tauxRefus >= 10) return 'À surveiller';
  return 'Fonctionne bien';
}

interface SectorCanalGroup {
  secteur: string;
  tpe: SectorCanalItem | null;
  ecommerce: SectorCanalItem | null;
}

function groupBySector(items: SectorCanalItem[]): SectorCanalGroup[] {
  const bySector = new Map<string, SectorCanalGroup>();
  for (const item of items) {
    const group = bySector.get(item.secteur) ?? { secteur: item.secteur, tpe: null, ecommerce: null };
    if (item.canal.toUpperCase() === 'TPE') group.tpe = item;
    else if (item.canal.toUpperCase() === 'ECOMMERCE') group.ecommerce = item;
    bySector.set(item.secteur, group);
  }
  // Les secteurs avec les deux canaux (comparaison possible) remontent en premier.
  return [...bySector.values()].sort((a, b) => {
    const bothA = a.tpe && a.ecommerce ? 1 : 0;
    const bothB = b.tpe && b.ecommerce ? 1 : 0;
    return bothB - bothA || a.secteur.localeCompare(b.secteur, 'fr');
  });
}

function CanalMiniBar({ label, item }: { label: string; item: SectorCanalItem | null }) {
  if (!item) {
    return (
      <div className="risk-canal-mini">
        <span className="risk-canal-mini-label">{label}</span>
        <span className="risk-canal-mini-empty">Pas de données</span>
      </div>
    );
  }
  const approbation = Math.max(0, Math.round((100 - item.tauxRefus) * 10) / 10);
  return (
    <div className="risk-canal-mini">
      <span className="risk-canal-mini-label">{label}</span>
      <div className="risk-bar-track risk-bar-track-sm">
        <div className={`risk-bar-fill ${qualityTone(item.tauxRefus)}`} style={{ width: `${approbation}%` }} />
      </div>
      <span className="risk-canal-mini-meta">
        {approbation}% approuvé · {item.nombreTransactions} tx · {qualityLabel(item.tauxRefus)}
      </span>
    </div>
  );
}

// Deux lectures opposees de la meme donnee : un secteur en bas (peu de
// transactions par TPE) est une cible pour de l'accompagnement/formation ou
// une offre adaptee — un secteur en haut est un gros utilisateur, candidat a
// une offre de fidelisation/upsell plutot qu'a de la reconquete.
function UsageRow({ item, isOpportunite, isFidele }: { item: SectorTpeUsageItem; isOpportunite: boolean; isFidele: boolean }) {
  const tag = isOpportunite ? 'À accompagner' : isFidele ? 'À fidéliser' : '';
  const tagTone = isOpportunite ? 'risk-tone-medium' : isFidele ? 'risk-tone-low' : '';
  return (
    <div className="risk-usage-row">
      <span className="risk-bar-label">{item.secteur}</span>
      <span className="risk-usage-meta">
        {item.transactionsParTpe} tx/TPE · {item.nombreTpeActifs} TPE actifs
      </span>
      {tag && <span className={`risk-chip risk-chip-sm ${tagTone}`}>{tag}</span>}
    </div>
  );
}

function BarRow({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  const width = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <div className="risk-bar-row">
      <span className="risk-bar-label">{label}</span>
      <div className="risk-bar-track">
        <div className={`risk-bar-fill ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <strong className="risk-bar-value">{value}</strong>
    </div>
  );
}

function MerchantRow({ item }: { item: MerchantRiskItem }) {
  const meta = levelMeta(item.niveauRisque);
  return (
    <tr>
      <td data-label="Commerçant">
        <strong>{item.nom}</strong>
        <span className="risk-subtext">#{item.commercantId} · {formatEnumLabel(item.typeAffiliation)}</span>
      </td>
      <td data-label="Secteur / région">
        {item.secteur}
        <span className="risk-subtext">{item.region}</span>
      </td>
      <td data-label="Score">
        <span className={`risk-chip ${meta.tone}`}>{item.scoreRisque}% · {meta.label}</span>
      </td>
      <td data-label="Raisons" className="risk-reasons">
        {item.raisons.length > 0
          ? item.raisons.map((r, i) => <div key={i}>{r}</div>)
          : <span className="risk-subtext">—</span>}
      </td>
      <td data-label="Action recommandée">{item.actionRecommandee}</td>
    </tr>
  );
}

export default function SupervisorRiskOverviewPage() {
  const [data, setData] = useState<SupervisorRiskOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await getRiskOverview();
      setData(response);
    } catch {
      setErrorMessage(
        "Impossible de charger l'analyse de risque — vérifiez que le service lana-merchant-intelligence est démarré."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const priorityMerchants = data?.commercants.filter((m) => m.niveauRisque !== 'FAIBLE') ?? [];
  const maxSectorScore = Math.max(1, ...(data?.secteursRisque.map((s) => s.scoreMoyen) ?? [1]));
  const sectorCanalGroups = useMemo(
    () => groupBySector(data?.canalPerformance ?? []),
    [data]
  );
  const comparableSectors = sectorCanalGroups.filter((g) => g.tpe && g.ecommerce).length;

  return (
    <div className="risk-page">
      <div className="risk-page-head">
        <div>
          <span className="risk-badge">IA · lana-merchant-intelligence</span>
          <p>
            Score de risque d'abandon calculé à partir de l'historique réel des transactions
            (chiffre d'affaires, taux de refus, inactivité) — mis à jour à chaque chargement.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={load} disabled={isLoading}>
          Actualiser
        </button>
      </div>

      {errorMessage && <div className="page-alert error">{errorMessage}</div>}

      {data?.donneesTransactionnellesIndisponibles && (
        <div className="page-alert warning">
          Le service switch-monetique-service était injoignable pendant ce calcul —
          les chiffres ci-dessous sont partiels (voire sous-estimés). Ce n'est pas
          une absence de risque, cliquez sur « Actualiser » une fois le service
          revenu pour un score fiable.
        </div>
      )}

      {isLoading && !data && (
        <div className="risk-loading">
          <span className="page-loading-spinner" />{' '}
          Calcul des scores de risque en cours...
        </div>
      )}

      {data && (
        <>
          <section className="risk-kpi-row">
            <article className="risk-kpi">
              <span>Commerçants analysés</span>
              <strong>{data.commercantsAnalyses}</strong>
            </article>
            <article className="risk-kpi high">
              <span>Risque élevé</span>
              <strong>{data.nombreRisqueEleve}</strong>
            </article>
            <article className="risk-kpi medium">
              <span>Risque moyen</span>
              <strong>{data.nombreRisqueMoyen}</strong>
            </article>
            <article className="risk-kpi">
              <span>Score moyen</span>
              <strong>{data.scoreMoyen}%</strong>
            </article>
          </section>

          {data.commercantsIgnores > 0 && (
            <p className="risk-coverage-note">
              {data.commercantsIgnores} commerçant{data.commercantsIgnores !== 1 ? 's' : ''} sans historique de
              transaction exploitable {data.commercantsIgnores !== 1 ? 'ont été exclus' : 'a été exclu'} du calcul.
            </p>
          )}

          <section className="risk-panel">
            <h3>Risque par secteur</h3>
            {data.secteursRisque.length === 0 ? (
              <p className="risk-empty">Pas assez de données pour classer les secteurs.</p>
            ) : (
              data.secteursRisque.map((s) => (
                <BarRow
                  key={s.secteur}
                  label={`${s.secteur} (${s.nombreCommercants})`}
                  value={s.scoreMoyen}
                  max={maxSectorScore}
                  tone={s.nombreRisqueEleve > 0 ? 'risk-fill-high' : 'risk-fill-medium'}
                />
              ))
            )}
          </section>

          <section className="risk-panel">
            <h3>Performance par secteur : TPE vs e-commerce</h3>
            <p className="risk-panel-subtitle">
              Taux d'approbation par canal de paiement dans chaque secteur (secteurs avec au moins 5 transactions
              sur le canal, pour un échantillon fiable) — {comparableSectors} secteur{comparableSectors !== 1 ? 's' : ''} avec
              les deux canaux comparables.
            </p>
            {sectorCanalGroups.length === 0 ? (
              <p className="risk-empty">
                Pas assez de transactions par canal et par secteur pour une comparaison fiable pour le moment.
              </p>
            ) : (
              <div className="risk-canal-grid">
                {sectorCanalGroups.map((group) => (
                  <article key={group.secteur} className="risk-canal-card">
                    <h4>{group.secteur}</h4>
                    <CanalMiniBar label="TPE" item={group.tpe} />
                    <CanalMiniBar label="E-commerce" item={group.ecommerce} />
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="risk-panel">
            <h3>Usage du TPE par secteur : où cibler les offres</h3>
            <p className="risk-panel-subtitle">
              Nombre de transactions par TPE affecté, indépendamment du score de risque — sert à repérer les
              secteurs qui sous-utilisent leur terminal (cible pour un accompagnement ou une offre adaptée) et
              ceux qui l'utilisent intensément (cible pour une offre de fidélisation).
            </p>
            {data.usageTpeParSecteur.length === 0 ? (
              <p className="risk-empty">Aucun TPE actif avec historique exploitable pour le moment.</p>
            ) : (
              data.usageTpeParSecteur.map((item, index) => (
                <UsageRow
                  key={item.secteur}
                  item={item}
                  isOpportunite={index < 3}
                  isFidele={index >= data.usageTpeParSecteur.length - 3 && index >= 3}
                />
              ))
            )}
          </section>

          <section className="risk-table-card">
            <div className="risk-table-head">
              <h3>Commerçants à contacter en priorité</h3>
              <span>{priorityMerchants.length} sur {data.commercants.length}</span>
            </div>
            {priorityMerchants.length === 0 ? (
              <div className="risk-empty risk-empty-padded">
                Aucun commerçant en risque moyen ou élevé actuellement — activité globalement stable.
              </div>
            ) : (
              <div className="risk-table-wrap">
                <table className="risk-table">
                  <thead>
                    <tr>
                      <th>Commerçant</th><th>Secteur / région</th><th>Score</th>
                      <th>Raisons principales</th><th>Action recommandée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priorityMerchants.map((item) => <MerchantRow key={item.commercantId} item={item} />)}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
