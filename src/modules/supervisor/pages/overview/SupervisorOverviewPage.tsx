import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { useNavigate } from 'react-router-dom';
import { useSupervisorDecisionData } from '../decision-dashboard/useSupervisorDecisionData';
import { barChartOptions, doughnutChartOptions } from '../decision-dashboard/chartOptions';
import { chartColors, isValidated } from '../decision-dashboard/supervisorDecisionMetrics';
import { resolveAffiliationStatusKey } from '../../../workspace/workspaceUtils';
import '../../../../styles/page.shared.scss';
import '../../../../styles/supervisor-overview.scss';

export default function SupervisorOverviewPage() {
  const navigate = useNavigate();
  const { isLoading, errorMessage, requests, metrics } = useSupervisorDecisionData(true);
  const conversionRate = requests.length
    ? Math.round((requests.filter(isValidated).length / requests.length) * 100)
    : 0;
  const pendingCount = requests.filter((request) => resolveAffiliationStatusKey(request) === 'pending').length;
  const originChartRef = useRef<HTMLCanvasElement>(null);
  const teamChartRef = useRef<HTMLCanvasElement>(null);
  const inventoryChartRef = useRef<HTMLCanvasElement>(null);
  const chartsRef = useRef<Chart[]>([]);

  function cardValue(label: string): number {
    return metrics.globalCards.find((card) => card.label === label)?.value ?? 0;
  }

  useEffect(() => {
    while (chartsRef.current.length) {
      chartsRef.current.pop()?.destroy();
    }

    if (isLoading) return;

    if (originChartRef.current) {
      chartsRef.current.push(new Chart(originChartRef.current, {
        type: 'bar',
        data: {
          labels: metrics.originPoints.map((point) => point.label),
          datasets: [{
            label: 'Demandes',
            data: metrics.originPoints.map((point) => point.value),
            backgroundColor: [chartColors.blue, chartColors.pink, chartColors.green],
            borderRadius: 8,
            borderSkipped: false,
            barPercentage: 0.55,
            categoryPercentage: 0.7
          }]
        },
        options: barChartOptions(false)
      }));
    }

    if (teamChartRef.current) {
      chartsRef.current.push(new Chart(teamChartRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Commerçants actifs', 'Commerciales', 'Back office'],
          datasets: [{
            label: 'Total',
            data: [
              cardValue('Commerçants actifs'),
              cardValue('Commerciales'),
              cardValue('Back office')
            ],
            backgroundColor: [chartColors.green, chartColors.blue, chartColors.navy],
            borderWidth: 0
          }]
        },
        options: doughnutChartOptions()
      }));
    }

    if (inventoryChartRef.current) {
      chartsRef.current.push(new Chart(inventoryChartRef.current, {
        type: 'doughnut',
        data: {
          labels: ['PDV', 'TPE'],
          datasets: [{
            label: 'Total',
            data: [cardValue('PDV'), cardValue('TPE')],
            backgroundColor: [chartColors.sky, chartColors.yellow],
            borderWidth: 0
          }]
        },
        options: doughnutChartOptions()
      }));
    }

    return () => {
      while (chartsRef.current.length) {
        chartsRef.current.pop()?.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, metrics.globalCards, metrics.originPoints]);

  return (
    <div className="page-grid bi-dashboard supervisor-decision-dashboard">
      {errorMessage && (
        <div className="page-alert error" role="alert">
          <span>{errorMessage}</span>
        </div>
      )}

      {isLoading && (
        <div className="page-loading commercial-loading">
          <div className="page-loading-spinner" />
          <span>Chargement de la vue globale...</span>
        </div>
      )}

      {!isLoading && (
        <section className="overview-command-center">
          <div className="overview-command-head">
            <div>
              <span>Vue globale</span>
              <h2>Graphes de pilotage superviseur</h2>
            </div>
            <button type="button" onClick={() => navigate('/supervisor/affiliation-requests')}>
              Voir les dossiers
            </button>
          </div>

          <div className="overview-mini-grid">
            <article>
              <span>Total demandes</span>
              <strong>{cardValue("Total demandes d'affiliation")}</strong>
              <small>Auto, prospection et extensions</small>
            </article>
            <article>
              <span>Commerçants actifs</span>
              <strong>{cardValue('Commerçants actifs')}</strong>
              <small>Portefeuille suivi</small>
            </article>
            <article>
              <span>Équipe terrain</span>
              <strong>{cardValue('Commerciales')}</strong>
              <small>Commerciales créées</small>
            </article>
            <article>
              <span>Parc TPE</span>
              <strong>{cardValue('TPE')}</strong>
              <small>Terminaux disponibles ou actifs</small>
            </article>
            <article>
              <span>Taux de conversion</span>
              <strong>{conversionRate}%</strong>
              <small>Dossiers validés ou actifs / total</small>
            </article>
            <article>
              <span>Dossiers en attente</span>
              <strong>{pendingCount}</strong>
              <small>À compléter ou non assignés</small>
            </article>
          </div>

          <div className="overview-visual-grid">
            <article className="overview-chart-panel overview-chart-panel--main">
              <div className="decision-card-title">
                <span>Demandes</span>
                <h3>Auto-affiliation, prospection directe et extension PDV</h3>
              </div>
              <div className="decision-chart-wrap">
                <canvas ref={originChartRef} />
              </div>
            </article>

            <article className="overview-chart-panel">
              <div className="decision-card-title">
                <span>Équipe & portefeuille</span>
                <h3>Commerçants actifs, commerciales et back office</h3>
              </div>
              <div className="decision-chart-wrap">
                <canvas ref={teamChartRef} />
              </div>
            </article>

            <article className="overview-chart-panel">
              <div className="decision-card-title">
                <span>Parc opérationnel</span>
                <h3>Points de vente et terminaux TPE</h3>
              </div>
              <div className="decision-chart-wrap">
                <canvas ref={inventoryChartRef} />
              </div>
            </article>
          </div>
        </section>
      )}
    </div>
  );
}
