import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { useNavigate } from 'react-router-dom';
import { useSupervisorDecisionData } from '../decision-dashboard/useSupervisorDecisionData';
import { horizontalBarOptions } from '../decision-dashboard/chartOptions';
import { chartColors, isValidated } from '../decision-dashboard/supervisorDecisionMetrics';
import { downloadExcel } from '../../../../core/excelExport';
import { resolveAffiliationStatusKey } from '../../../workspace/workspaceUtils';
import '../../../../styles/page.shared.scss';
import '../../../../styles/supervisor-overview.scss';

// Une couleur par etape du pipeline (ordre = PipelineKey / metrics.pipelinePoints),
// pour que chaque barre du graphe se distingue visuellement au premier coup d'oeil.
const PIPELINE_COLORS = [
  chartColors.slate,
  chartColors.sky,
  chartColors.yellow,
  chartColors.blue,
  chartColors.red,
  chartColors.red,
  chartColors.navy,
  chartColors.navy,
  chartColors.green
];

export default function SupervisorOverviewPage() {
  const navigate = useNavigate();
  const { isLoading, errorMessage, requests, metrics } = useSupervisorDecisionData(true);
  const conversionRate = requests.length
    ? Math.round((requests.filter(isValidated).length / requests.length) * 100)
    : 0;
  const pendingCount = requests.filter((request) => resolveAffiliationStatusKey(request) === 'pending').length;
  const pipelineChartRef = useRef<HTMLCanvasElement>(null);
  const chartsRef = useRef<Chart[]>([]);

  function cardValue(label: string): number {
    return metrics.globalCards.find((card) => card.label === label)?.value ?? 0;
  }

  const totalDemandes = requests.length;

  useEffect(() => {
    while (chartsRef.current.length) {
      chartsRef.current.pop()?.destroy();
    }

    if (isLoading) return;

    if (pipelineChartRef.current) {
      chartsRef.current.push(new Chart(pipelineChartRef.current, {
        type: 'bar',
        data: {
          labels: metrics.pipelinePoints.map((point) => point.label),
          datasets: [{
            label: 'Dossiers',
            data: metrics.pipelinePoints.map((point) => point.value),
            backgroundColor: metrics.pipelinePoints.map((_, index) => PIPELINE_COLORS[index % PIPELINE_COLORS.length]),
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: horizontalBarOptions(false)
      }));
    }

    return () => {
      while (chartsRef.current.length) {
        chartsRef.current.pop()?.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, metrics.pipelinePoints]);

  async function exportOverview() {
    await downloadExcel(
      'vue-ensemble-superviseur',
      'Vue globale',
      [
        { header: 'Indicateur', key: 'label', value: (c: (typeof metrics.globalCards)[number]) => c.label },
        { header: 'Valeur', key: 'value', value: (c: (typeof metrics.globalCards)[number]) => c.value },
        { header: 'Détail', key: 'helper', value: (c: (typeof metrics.globalCards)[number]) => c.helper }
      ],
      metrics.globalCards
    );
  }

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
            <div className="overview-command-actions">
              <button type="button" className="overview-export-btn" onClick={() => void exportOverview()}>
                <span className="material-icons">grid_on</span>
                Exporter en Excel
              </button>
              <button
                type="button"
                className="overview-goto-btn"
                onClick={() => navigate('/supervisor/affiliation-requests')}
              >
                Voir les dossiers
                <span className="material-icons">arrow_forward</span>
              </button>
            </div>
          </div>

          <div className="overview-mini-grid">
            <article>
              <span>Total demandes</span>
              <strong>{cardValue("Total demandes d'affiliation")}</strong>
              <small>Auto, prospection et extensions</small>
            </article>
            <article>
              <span>Dossiers en attente</span>
              <strong>{pendingCount}</strong>
              <small>À compléter ou non assignés</small>
            </article>
            <article>
              <span>Taux de conversion</span>
              <strong>{conversionRate}%</strong>
              <small>Dossiers validés ou actifs / total</small>
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
          </div>

          <div className="overview-pipeline-row">
            <article className="overview-chart-panel">
              <div className="decision-card-title">
                <span>Pipeline</span>
                <h3>Où les dossiers sont bloqués, par statut</h3>
              </div>
              <div className="decision-chart-wrap">
                <canvas ref={pipelineChartRef} />
              </div>
            </article>

            <div className="pipeline-status-grid">
              {metrics.pipelinePoints.map((point) => {
                const percent = totalDemandes ? Math.round((point.value / totalDemandes) * 100) : 0;
                return (
                  <div className="pipeline-status-card" key={point.label}>
                    <div>
                      <span>{point.label}</span>
                      <strong>{point.value}</strong>
                    </div>
                    <div className="pipeline-bar">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                    <small>{percent}% du total</small>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
